/**
 * La vista della città isometrica (T12, fase B): camera ortografica con angolo
 * fisso (elevazione 30°, vista dimetrica 2:1), quattro orientamenti a scatti di
 * 90°, spostamento e ingrandimento. Modulo puro: niente pagina, si prova da solo.
 *
 * - Il passaggio da un orientamento all'altro e gli ingrandimenti dai pulsanti
 *   sono morbidi, con un fattore che dipende dal tempo trascorso
 *   (1 − exp(−k·dt)): lo stesso movimento a 30 o a 120 immagini al secondo.
 * - Si limita la vista, non solo il centro, sull'area libera della tela (T12e): la
 *   tela meno i comandi che la coprono (barra in alto, comandi del tempo, colonna dei
 *   pulsanti, pulsanti di ingrandimento, finestre aperte). Ogni punto della zona si può
 *   portare dentro l'area libera, e non oltre: quando un estremo della zona arriva al bordo
 *   dell'area libera la vista si ferma. Se la zona è più piccola dell'area libera, resta al
 *   centro dell'area libera.
 * - Distanza massima calcolata, non fissa (correzione di T12e decisa da Michele): sul
 *   telefono in verticale la zona riempie in larghezza l'area libera e almeno il 70%
 *   dell'area libera cade sopra la zona; sugli schermi larghi la zona entra tutta.
 */
import * as THREE from 'three';
import type { Pt } from '../plastico/data.js';

export const ELEVAZIONE = (30 * Math.PI) / 180;
/** Primo orientamento: si guarda da sud-est verso nord-ovest (azimut 45°). */
export const AZIMUT_BASE = Math.PI / 4;
export const PASSO_ROTAZIONE = Math.PI / 2;
/**
 * Pixel per metro: dal colpo d'occhio sulla zona al dettaglio di un isolato. PPM_MIN è il
 * minimo di partenza; se la zona intera non entra nell'area libera si scende ancora (ppmPerTutta).
 */
export const PPM_MIN = 0.3;
export const PPM_MAX = 8;
/** Rapidità dei movimenti morbidi (per secondo). */
export const RAPIDITA = 9;
/** Distanza minima della camera dal centro lungo la direzione di vista: basta a stare sopra le ciminiere. */
const DISTANZA = 3000;
/** Alla distanza massima la zona occupa al più questa parte dell'area libera: un po' d'aria attorno. */
const RESPIRO = 0.96;
/** Margine in pixel dentro l'area libera: i bordi della zona non toccano i comandi, a ogni ingrandimento. */
export const MARGINE_PX = 8;

export interface Limiti {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Rettangolo della tela libero dai comandi, in pixel dalla sinistra e dall'alto della tela. */
export interface Area {
  left: number;
  top: number;
  right: number;
  bottom: number;
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

/** Estremi della zona sugli assi della vista (metri lungo la destra e in avanti). */
function estremi(azimut: number, lim: Limiti): { destra: Pt; avanti: Pt; a0: number; a1: number; b0: number; b1: number } {
  const { destra, avanti } = assiATerra(azimut);
  let a0 = Infinity;
  let a1 = -Infinity;
  let b0 = Infinity;
  let b1 = -Infinity;
  for (const [x, y] of [
    [lim.minX, lim.minY],
    [lim.maxX, lim.minY],
    [lim.maxX, lim.maxY],
    [lim.minX, lim.maxY],
  ] as const) {
    const a = x * destra[0] + y * destra[1];
    const b = x * avanti[0] + y * avanti[1];
    a0 = Math.min(a0, a);
    a1 = Math.max(a1, a);
    b0 = Math.min(b0, b);
    b1 = Math.max(b1, b);
  }
  return { destra, avanti, a0, a1, b0, b1 };
}

/** Tutta la tela come area libera. */
export const tutta = (w: number, h: number): Area => ({ left: 0, top: 0, right: w, bottom: h });

/** Ingrandimento più grande a cui la zona intera entra nell'area libera (con un po' d'aria). */
export function ppmPerTutta(azimut: number, lim: Limiti, area: Area): number {
  const { a0, a1, b0, b1 } = estremi(azimut, lim);
  const largo = Math.max(1, area.right - area.left);
  const alto = Math.max(1, area.bottom - area.top);
  return RESPIRO * Math.min(largo / (a1 - a0), alto / ((b1 - b0) * Math.sin(ELEVAZIONE)));
}

/** Quota dell'area libera che, alla distanza massima sul telefono in verticale, deve cadere sopra la zona. */
export const COPERTURA_MINIMA = 0.7;
/** Il calcolo cerca un po' di più, perché la prova non stia sul filo (centraggio e arrotondamenti). */
const COPERTURA_CERCATA = 0.74;

/** Area di un poligono (formula di Gauss), in valore assoluto. */
function areaPoligono(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i]!;
    const [x2, y2] = p[(i + 1) % p.length]!;
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** Ritaglia un poligono convesso con un rettangolo (Sutherland-Hodgman). */
export function ritaglia(poligono: Pt[], r: Area): Pt[] {
  let out = poligono;
  const lati: [(p: Pt) => boolean, (a: Pt, b: Pt) => Pt][] = [
    [(p) => p[0] >= r.left, (a, b) => [r.left, a[1] + ((b[1] - a[1]) * (r.left - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= r.right, (a, b) => [r.right, a[1] + ((b[1] - a[1]) * (r.right - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= r.top, (a, b) => [a[0] + ((b[0] - a[0]) * (r.top - a[1])) / (b[1] - a[1]), r.top]],
    [(p) => p[1] <= r.bottom, (a, b) => [a[0] + ((b[0] - a[0]) * (r.bottom - a[1])) / (b[1] - a[1]), r.bottom]],
  ];
  for (const [dentro, taglio] of lati) {
    const prima = out;
    out = [];
    for (let i = 0; i < prima.length; i++) {
      const a = prima[i]!;
      const b = prima[(i + 1) % prima.length]!;
      if (dentro(b)) {
        if (!dentro(a)) out.push(taglio(a, b));
        out.push(b);
      } else if (dentro(a)) out.push(taglio(a, b));
    }
    if (out.length === 0) return [];
  }
  return out;
}

/** Quota di un rettangolo dello schermo che cade sopra un poligono dello schermo (0-1). */
export function copertura(poligono: Pt[], r: Area): number {
  const tot = Math.max(1e-9, (r.right - r.left) * (r.bottom - r.top));
  return areaPoligono(ritaglia(poligono, r)) / tot;
}

/** Quota dell'area libera sopra la zona, con il centro della zona al centro dell'area libera. */
export function coperturaCentrata(ppm: number, azimut: number, lim: Limiti, area: Area): number {
  const { destra, avanti, a0, a1, b0, b1 } = estremi(azimut, lim);
  const am = (a0 + a1) / 2;
  const bm = (b0 + b1) / 2;
  const mx = (area.left + area.right) / 2;
  const my = (area.top + area.bottom) / 2;
  const kv = ppm * Math.sin(ELEVAZIONE);
  const poligono: Pt[] = [
    [lim.minX, lim.minY],
    [lim.maxX, lim.minY],
    [lim.maxX, lim.maxY],
    [lim.minX, lim.maxY],
  ].map(([x, y]) => {
    const a = x! * destra[0] + y! * destra[1];
    const b = x! * avanti[0] + y! * avanti[1];
    return [mx + (a - am) * ppm, my - (b - bm) * kv] as Pt;
  });
  return copertura(poligono, area);
}

/**
 * Distanza massima (T12e, correzione decisa da Michele). Se l'area libera è più alta che
 * larga (telefono in verticale): l'ingrandimento più piccolo a cui la zona riempie in
 * larghezza l'area libera e almeno il 70% dell'area libera cade sopra la zona. Altrimenti
 * (computer, telefono in orizzontale): quello a cui la zona entra tutta, con il 4% d'aria.
 */
export function ppmDistanzaMassima(azimut: number, lim: Limiti, area: Area): number {
  const largo = area.right - area.left;
  const alto = area.bottom - area.top;
  if (alto <= largo) return ppmPerTutta(azimut, lim, area);
  const { a0, a1 } = estremi(azimut, lim);
  let basso = largo / (a1 - a0); // la zona riempie in larghezza
  if (coperturaCentrata(basso, azimut, lim, area) >= COPERTURA_CERCATA) return basso;
  let altoPpm = basso;
  while (coperturaCentrata(altoPpm, azimut, lim, area) < COPERTURA_CERCATA && altoPpm < PPM_MAX) altoPpm *= 2;
  // Ricerca per bisezione: la copertura cresce con l'ingrandimento.
  for (let i = 0; i < 40; i++) {
    const m = (basso + altoPpm) / 2;
    if (coperturaCentrata(m, azimut, lim, area) >= COPERTURA_CERCATA) altoPpm = m;
    else basso = m;
  }
  return altoPpm;
}

/**
 * Centro ammesso: ogni punto della zona si può portare dentro l'area libera, e la vista si
 * ferma quando un estremo della zona arriva al bordo dell'area libera. Su un asse in cui la
 * zona è più piccola dell'area libera, la zona sta al centro dell'area libera.
 */
export function limitaCentro(centro: Pt, ppm: number, azimut: number, w: number, h: number, lim: Limiti, area: Area = tutta(w, h)): Pt {
  const { destra, avanti, a0, a1, b0, b1 } = estremi(azimut, lim);
  const k = ppm;
  const kv = ppm * Math.sin(ELEVAZIONE);
  // Sullo schermo: x = w/2 + (a − ca)·k; y = h/2 − (b − cb)·kv.
  const caMin = a0 + (w / 2 - area.left) / k; // l'estremo sinistro della zona al bordo sinistro libero
  const caMax = a1 - (area.right - w / 2) / k; // l'estremo destro al bordo destro libero
  const cbMin = b0 + (area.bottom - h / 2) / kv; // l'estremo più vicino al bordo basso libero
  const cbMax = b1 - (h / 2 - area.top) / kv; // l'estremo più lontano al bordo alto libero
  const ca0 = centro[0] * destra[0] + centro[1] * destra[1];
  const cb0 = centro[0] * avanti[0] + centro[1] * avanti[1];
  const ca = caMin > caMax ? (a0 + a1) / 2 + (w / 2 - (area.left + area.right) / 2) / k : Math.min(caMax, Math.max(caMin, ca0));
  const cb = cbMin > cbMax ? (b0 + b1) / 2 + ((area.top + area.bottom) / 2 - h / 2) / kv : Math.min(cbMax, Math.max(cbMin, cb0));
  return [destra[0] * ca + avanti[0] * cb, destra[1] * ca + avanti[1] * cb];
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
  /** Area libera dai comandi (null = tutta la tela). */
  private area: Area | null = null;

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
    this.ora.ppm = Math.min(PPM_MAX, Math.max(this.ppmMinimo(this.ora.azimut), this.ora.ppm));
    this.ora.centro = limitaCentro(this.ora.centro, this.ora.ppm, this.ora.azimut, this.w, this.h, this.limiti, this.libera);
  }

  /** L'area della tela libera dai comandi (pixel dalla sinistra e dall'alto della tela). */
  get libera(): Area {
    const a0 = this.area;
    if (a0 === null) return tutta(this.w, this.h);
    const a = { left: a0.left + MARGINE_PX, top: a0.top + MARGINE_PX, right: a0.right - MARGINE_PX, bottom: a0.bottom - MARGINE_PX };
    // Mai meno di un quinto della tela per lato: un'area assurda non deve bloccare la vista.
    const left = Math.min(Math.max(0, a.left), this.w * 0.8);
    const top = Math.min(Math.max(0, a.top), this.h * 0.8);
    return { left, top, right: Math.max(left + this.w * 0.2, Math.min(this.w, a.right)), bottom: Math.max(top + this.h * 0.2, Math.min(this.h, a.bottom)) };
  }

  /** Cambia l'area libera (comandi che si aprono e si chiudono, finestra che cambia): si riapplicano i limiti. */
  impostaAreaLibera(area: Area | null): void {
    const prima = this.area;
    if (prima === area) return;
    if (prima !== null && area !== null && Math.abs(prima.left - area.left) + Math.abs(prima.top - area.top) + Math.abs(prima.right - area.right) + Math.abs(prima.bottom - area.bottom) < 1) return;
    this.area = area;
    this.dimensioni(this.w, this.h);
  }

  /** Ingrandimento minimo (distanza massima): vedi ppmDistanzaMassima; al più PPM_MIN. */
  ppmMinimo(azimut = this.meta.azimut): number {
    return Math.min(PPM_MIN, ppmDistanzaMassima(azimut, this.limiti, this.libera));
  }

  private limita(): void {
    this.meta.ppm = Math.min(PPM_MAX, Math.max(this.ppmMinimo(), this.meta.ppm));
    this.meta.centro = limitaCentro(this.meta.centro, this.meta.ppm, this.meta.azimut, this.w, this.h, this.limiti, this.libera);
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
    const ppm = Math.min(PPM_MAX, Math.max(this.ppmMinimo(), base.ppm * k));
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
    // Da lontano la vista a terra arriva a decine di chilometri verso l'orizzonte: la camera si
    // allontana quanto serve perché nulla resti dietro di lei o oltre il piano di fondo (T12e).
    const distanza = Math.max(DISTANZA, (this.h / 2 / o.ppm / Math.sin(ELEVAZIONE)) * Math.cos(ELEVAZIONE) + 1000);
    camera.near = 1;
    camera.far = distanza * 2 + DISTANZA;
    const centro = CENTRO.set(o.centro[0], 0, -o.centro[1]);
    camera.position.copy(centro).addScaledVector(direzioneCamera(o.azimut, DIREZIONE), distanza);
    camera.up.set(0, 1, 0);
    camera.lookAt(centro);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }
}
