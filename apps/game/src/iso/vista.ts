/**
 * La vista della città isometrica (T12, fase B): camera ortografica con angolo
 * fisso (elevazione 30°, vista dimetrica 2:1), quattro orientamenti a scatti di
 * 90°, spostamento e ingrandimento. Modulo puro: niente pagina, si prova da solo.
 *
 * - Il passaggio da un orientamento all'altro e gli ingrandimenti dai pulsanti
 *   sono morbidi, con un fattore che dipende dal tempo trascorso
 *   (1 − exp(−k·dt)): lo stesso movimento a 30 o a 120 immagini al secondo.
 * - Si limita la vista, non solo il centro: l'impronta a terra di ciò che si vede
 *   resta dentro la zona (più un margine), tenendo conto dell'ingrandimento e
 *   dell'orientamento. Se la vista è più grande della zona, il centro resta al centro.
 */
import * as THREE from 'three';
import type { Pt } from '../plastico/data.js';

export const ELEVAZIONE = (30 * Math.PI) / 180;
/** Primo orientamento: si guarda da sud-est verso nord-ovest (azimut 45°). */
export const AZIMUT_BASE = Math.PI / 4;
export const PASSO_ROTAZIONE = Math.PI / 2;
/** Pixel per metro: dal colpo d'occhio sulla zona al dettaglio di un isolato. */
export const PPM_MIN = 0.3;
export const PPM_MAX = 8;
/** Rapidità dei movimenti morbidi (per secondo). */
export const RAPIDITA = 9;
/** Distanza della camera dal centro lungo la direzione di vista: basta a stare sopra le ciminiere. */
const DISTANZA = 3000;

export interface Limiti {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Stato {
  centro: Pt;
  ppm: number;
  /** Angolo di vista continuo (radianti): AZIMUT_BASE + k · 90°. */
  azimut: number;
}

/** Direzione dal centro verso la camera, per un azimut. */
export function direzioneCamera(azimut: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(Math.cos(ELEVAZIONE) * Math.sin(azimut), Math.sin(ELEVAZIONE), Math.cos(ELEVAZIONE) * Math.cos(azimut));
}

// Vettori riusati a ogni immagine: niente oggetti nuovi nel ciclo di disegno.
const CENTRO = new THREE.Vector3();
const DIREZIONE = new THREE.Vector3();

/** Assi a terra della vista: destra dello schermo e «in avanti» (verso l'alto dello schermo), in coordinate (x, nord). */
export function assiATerra(azimut: number): { destra: Pt; avanti: Pt } {
  // La camera guarda verso −direzione; in avanti è la sua parte orizzontale.
  const d = direzioneCamera(azimut);
  const fx = -d.x;
  const fz = -d.z;
  const len = Math.hypot(fx, fz);
  const avanti: Pt = [fx / len, -fz / len];
  // Destra = avanti ruotato di −90° nel piano (x, nord).
  const destra: Pt = [avanti[1], -avanti[0]];
  return { destra, avanti };
}

/** Mezze misure dell'impronta a terra della vista, in metri: lungo la destra e in avanti. */
export function impronta(ppm: number, w: number, h: number): { lungoDestra: number; inAvanti: number } {
  return { lungoDestra: w / 2 / ppm, inAvanti: h / 2 / ppm / Math.sin(ELEVAZIONE) };
}

/** Centro ammesso perché tutta l'impronta della vista stia dentro i limiti. */
export function limitaCentro(centro: Pt, ppm: number, azimut: number, w: number, h: number, lim: Limiti): Pt {
  const { destra, avanti } = assiATerra(azimut);
  const { lungoDestra, inAvanti } = impronta(ppm, w, h);
  const ex = Math.abs(destra[0]) * lungoDestra + Math.abs(avanti[0]) * inAvanti;
  const ey = Math.abs(destra[1]) * lungoDestra + Math.abs(avanti[1]) * inAvanti;
  const fit = (v: number, min: number, max: number, e: number) => (max - min <= 2 * e ? (min + max) / 2 : Math.min(max - e, Math.max(min + e, v)));
  return [fit(centro[0], lim.minX, lim.maxX, ex), fit(centro[1], lim.minY, lim.maxY, ey)];
}

/** Fattore di avvicinamento per un passo di tempo: 1 − exp(−k·dt). */
export function fattore(dt: number, rapidita = RAPIDITA): number {
  return 1 - Math.exp(-rapidita * Math.max(0, dt));
}

export class Vista {
  /** Stato mostrato. */
  readonly ora: Stato;
  /** Stato verso cui si va. */
  readonly meta: Stato;
  private passi = 0;
  w = 1;
  h = 1;

  constructor(
    centro: Pt,
    ppm: number,
    readonly limiti: Limiti,
  ) {
    this.ora = { centro: [...centro], ppm, azimut: AZIMUT_BASE };
    this.meta = { centro: [...centro], ppm, azimut: AZIMUT_BASE };
  }

  /** Orientamento corrente, da 0 a 3. */
  get orientamento(): number {
    return ((this.passi % 4) + 4) % 4;
  }

  dimensioni(w: number, h: number): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.limita();
    this.ora.centro = limitaCentro(this.ora.centro, this.ora.ppm, this.ora.azimut, this.w, this.h, this.limiti);
  }

  private limita(): void {
    this.meta.ppm = Math.min(PPM_MAX, Math.max(PPM_MIN, this.meta.ppm));
    this.meta.centro = limitaCentro(this.meta.centro, this.meta.ppm, this.meta.azimut, this.w, this.h, this.limiti);
  }

  /** Ruota di un quarto di giro (verso = +1 o −1), con passaggio morbido. */
  ruota(verso: 1 | -1): void {
    this.passi += verso;
    this.meta.azimut = AZIMUT_BASE + this.passi * PASSO_ROTAZIONE;
    this.limita();
  }

  /** Trascinamento di (dx, dy) pixel: la città segue il dito, subito. */
  trascina(dx: number, dy: number): void {
    const { destra, avanti } = assiATerra(this.ora.azimut);
    const k = 1 / this.ora.ppm;
    const kv = k / Math.sin(ELEVAZIONE);
    this.meta.centro = [this.ora.centro[0] - destra[0] * dx * k + avanti[0] * dy * kv, this.ora.centro[1] - destra[1] * dx * k + avanti[1] * dy * kv];
    this.limita();
    this.ora.centro = [...this.meta.centro];
  }

  /** Punto a terra sotto un punto dello schermo (pixel dalla sinistra e dall'alto). */
  aTerra(sx: number, sy: number, stato: Stato = this.ora): Pt {
    const { destra, avanti } = assiATerra(stato.azimut);
    const a = (sx - this.w / 2) / stato.ppm;
    const b = (this.h / 2 - sy) / stato.ppm / Math.sin(ELEVAZIONE);
    return [stato.centro[0] + destra[0] * a + avanti[0] * b, stato.centro[1] + destra[1] * a + avanti[1] * b];
  }

  /** Punto dello schermo di un punto a terra (quota 0). */
  aSchermo(p: Pt, stato: Stato = this.ora): { x: number; y: number } {
    const { destra, avanti } = assiATerra(stato.azimut);
    const dx = p[0] - stato.centro[0];
    const dy = p[1] - stato.centro[1];
    const a = dx * destra[0] + dy * destra[1];
    const b = dx * avanti[0] + dy * avanti[1];
    return { x: this.w / 2 + a * stato.ppm, y: this.h / 2 - b * stato.ppm * Math.sin(ELEVAZIONE) };
  }

  /**
   * Ingrandisce di `k` volte tenendo fermo il punto dello schermo (sx, sy).
   * `subito` per rotella e dita (si segue la mano), altrimenti passaggio morbido.
   */
  ingrandisci(k: number, sx = this.w / 2, sy = this.h / 2, subito = false): void {
    const base = subito ? this.ora : this.meta;
    const fermo = this.aTerra(sx, sy, base);
    const ppm = Math.min(PPM_MAX, Math.max(PPM_MIN, base.ppm * k));
    const r = base.ppm / ppm;
    this.meta.ppm = ppm;
    this.meta.centro = [fermo[0] + (base.centro[0] - fermo[0]) * r, fermo[1] + (base.centro[1] - fermo[1]) * r];
    this.limita();
    if (subito) {
      this.ora.ppm = this.meta.ppm;
      this.ora.centro = [...this.meta.centro];
    }
  }

  /** Porta un punto a terra nel punto dello schermo (sx, sy), senza cambiare ingrandimento né orientamento. */
  porta(p: Pt, sx: number, sy: number, subito = true): void {
    const qui = this.aTerra(sx, sy, this.meta);
    this.meta.centro = [this.meta.centro[0] + p[0] - qui[0], this.meta.centro[1] + p[1] - qui[1]];
    this.limita();
    if (subito) this.ora.centro = [...this.meta.centro];
  }

  /** Centra un punto con un ingrandimento, subito. */
  centra(p: Pt, ppm?: number): void {
    if (ppm !== undefined) this.meta.ppm = ppm;
    this.meta.centro = [...p];
    this.limita();
    this.ora.ppm = this.meta.ppm;
    this.ora.centro = [...this.meta.centro];
  }

  /** Avanza i movimenti morbidi di dt secondi; true se la vista si sta ancora muovendo. */
  aggiorna(dt: number): boolean {
    const f = fattore(dt);
    const o = this.ora;
    const m = this.meta;
    o.centro[0] += (m.centro[0] - o.centro[0]) * f;
    o.centro[1] += (m.centro[1] - o.centro[1]) * f;
    // L'ingrandimento si avvicina in scala logaritmica: lo stesso ritmo da lontano e da vicino.
    o.ppm = Math.exp(Math.log(o.ppm) + (Math.log(m.ppm) - Math.log(o.ppm)) * f);
    o.azimut += (m.azimut - o.azimut) * f;
    const fermo = Math.hypot(m.centro[0] - o.centro[0], m.centro[1] - o.centro[1]) * o.ppm < 0.05 && Math.abs(Math.log(m.ppm / o.ppm)) < 1e-4 && Math.abs(m.azimut - o.azimut) < 1e-4;
    if (fermo) {
      o.centro[0] = m.centro[0];
      o.centro[1] = m.centro[1];
      o.ppm = m.ppm;
      o.azimut = m.azimut;
    }
    return !fermo;
  }

  /** Mette la camera ortografica nello stato mostrato. */
  applica(camera: THREE.OrthographicCamera): void {
    const o = this.ora;
    const halfW = this.w / 2 / o.ppm;
    const halfH = this.h / 2 / o.ppm;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.near = 1;
    camera.far = DISTANZA * 3;
    const centro = CENTRO.set(o.centro[0], 0, -o.centro[1]);
    camera.position.copy(centro).addScaledVector(direzioneCamera(o.azimut, DIREZIONE), DISTANZA);
    camera.up.set(0, 1, 0);
    camera.lookAt(centro);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }
}
