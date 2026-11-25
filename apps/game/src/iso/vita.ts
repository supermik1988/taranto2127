/**
 * La vita della città (T12c, fase B): auto sulle strade principali, treni sui
 * binari, barche che entrano ed escono dai moli, fumo dalle ciminiere, persone
 * nelle piazze, gabbiani sul mare.
 *
 * Ciò che racconta lo stato della città si legge dal motore, non si inventa
 * (`vitaDaStato`): il fumo dipende da quanto producono gli impianti del lotto (un
 * lotto fermo non fuma), il traffico e le persone dalla popolazione, le barche
 * dalle attività del mare e della cultura e dai lotti «mare e cultura».
 *
 * Tutto è disegnato in blocco: una InstancedMesh per tipo, aggiornata una volta
 * per immagine; niente ombre portate dalle cose che si muovono (la mappa d'ombra
 * non si ridisegna). Con «riduci animazioni» nulla si muove; al livello basso
 * resta solo il fumo. Varianti e percorsi solo da hash01: niente Math.random.
 */
import type { GameState } from '@taranto2127/sim';
import * as THREE from 'three';
import { newGame } from '../engine.js';
import { centroid, geo, hash01, pick, pointInPolygon, type Pt } from '../plastico/data.js';
import { lotLook } from '../plastico/looks.js';
import { unisci } from './edifici.js';
import { datiSuolo } from './griglia.js';
import { LIVELLO_MARE, QUOTE } from './suolo.js';

// ---------- Dal motore ----------

/** Quanto mostrare: ogni valore è un fattore (1 = come all'avvio della partita). */
export interface StatoVita {
  /** Fumo per lotto, da 0 (fermo) a 1 (piena produzione). */
  fumo: Record<string, number>;
  traffico: number;
  barche: number;
  persone: number;
}

/**
 * Addetti all'acciaio per un lotto a piena produzione: stima dichiarata in
 * docs/GRAFICA.md (il motore conta gli addetti del settore, non per lotto).
 */
export const ADDETTI_PER_LOTTO = 1500;

let riferimento: { popolazione: number; mare: number } | null = null;

/** Popolazione e addetti del mare e della cultura all'avvio della partita (dati del motore). */
function rif(): { popolazione: number; mare: number } {
  if (riferimento === null) {
    const s = newGame(0).state;
    riferimento = { popolazione: popolazione(s), mare: s.labor.employed.sea + s.labor.employed['culture-tourism'] };
  }
  return riferimento;
}

const popolazione = (s: GameState) => Object.values(s.districts).reduce((n, d) => n + d.population.young + d.population.adult + d.population.elder, 0);
const tra = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Legge dal motore quanta vita mostrare. Funzione pura dello stato. */
export function vitaDaStato(s: GameState): StatoVita {
  const r = rif();
  const acciaio = s.plantLots.filter((l) => lotLook(s, l.id) === 'acciaio');
  const produzione = acciaio.length === 0 ? 0 : tra(s.labor.employed.steel / (ADDETTI_PER_LOTTO * acciaio.length), 0.25, 1);
  const fumo = Object.fromEntries(s.plantLots.map((l) => [l.id, lotLook(s, l.id) === 'acciaio' ? produzione : 0]));
  const traffico = tra(popolazione(s) / r.popolazione, 0.3, 1.5);
  const mare = s.plantLots.filter((l) => lotLook(s, l.id) === 'mare').length;
  const addettiMare = s.labor.employed.sea + s.labor.employed['culture-tourism'];
  const barche = tra(0.6 * (addettiMare / r.mare) + 0.25 * mare + 0.15, 0.2, 1.6);
  return { fumo, traffico, barche, persone: traffico };
}

// ---------- Nella scena ----------

/** Quante cose al massimo (fattore 1,5 o 1,6 del motore). */
export const MASSIMI = { auto: 320, vagoni: 14, barche: 40, sbuffi: 8, persone: 360, gabbiani: 30 } as const;

interface Percorso {
  punti: Pt[];
  /** Lunghezza progressiva a ogni punto. */
  lunghezze: number[];
  totale: number;
}

function percorso(punti: Pt[]): Percorso {
  const lunghezze = [0];
  for (let i = 1; i < punti.length; i++) lunghezze.push(lunghezze[i - 1]! + Math.hypot(punti[i]![0] - punti[i - 1]![0], punti[i]![1] - punti[i - 1]![1]));
  return { punti, lunghezze, totale: lunghezze.at(-1)! };
}

/** Punto e direzione a una distanza lungo il percorso. */
function lungo(p: Percorso, s: number, out: { x: number; y: number; ang: number; i?: number }): void {
  const d = tra(s, 0, p.totale);
  // Si riparte dal tratto dell'ultima volta (le cose si muovono poco tra un'immagine e l'altra).
  let i = Math.min(Math.max(1, out.i ?? 1), p.punti.length - 1);
  while (i > 1 && p.lunghezze[i - 1]! > d) i--;
  while (i < p.punti.length - 1 && p.lunghezze[i]! < d) i++;
  out.i = i;
  const a = p.punti[i - 1]!;
  const b = p.punti[i]!;
  const seg = p.lunghezze[i]! - p.lunghezze[i - 1]! || 1;
  const t = (d - p.lunghezze[i - 1]!) / seg;
  out.x = a[0] + (b[0] - a[0]) * t;
  out.y = a[1] + (b[1] - a[1]) * t;
  out.ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
}

interface Mobile {
  percorso: Percorso;
  s: number;
  v: number;
  verso: 1 | -1;
  corsia: number;
  attesa: number;
  /** Tratto del percorso in cui si trova (per la ricerca incrementale). */
  tratto?: number;
}

/** Un camino che fuma: posizione, quota della bocca, lotto da cui dipende. */
export interface Camino {
  x: number;
  y: number;
  quota: number;
  lotto: string;
}

const nelMare = (p: Pt) => geo.acqua.some((w) => pointInPolygon(p, w));

export class Vita {
  readonly gruppo = new THREE.Group();
  private readonly auto: THREE.InstancedMesh;
  private readonly vagoni: THREE.InstancedMesh;
  private readonly barche: THREE.InstancedMesh;
  private readonly sbuffi: THREE.InstancedMesh;
  private readonly persone: THREE.InstancedMesh;
  private readonly gabbiani: THREE.InstancedMesh;
  private readonly mobiliAuto: Mobile[] = [];
  private readonly treni: Mobile[] = [];
  private readonly rotte: Mobile[] = [];
  private readonly posti: { x: number; y: number; r: number; fase: number }[] = [];
  private readonly voli: { x: number; y: number; r: number; quota: number; fase: number; vel: number }[] = [];
  private camini: Camino[] = [];
  private stato: StatoVita = { fumo: {}, traffico: 1, barche: 1, persone: 1 };
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly sc = new THREE.Vector3(1, 1, 1);
  private readonly asse = new THREE.Vector3(0, 1, 0);
  private readonly p: { x: number; y: number; ang: number; i?: number } = { x: 0, y: 0, ang: 0 };
  /** Quanto mostrare per livello: 'tutto', 'meno' (livello medio), 'fumo' (livello basso). */
  private misura: 'tutto' | 'meno' | 'fumo' = 'tutto';
  /** Sotto 1,2 pixel per metro auto, persone e gabbiani sono meno di un pixel: non si aggiornano. */
  private vicino = true;

  constructor() {
    this.gruppo.name = 'vita';
    const lambert = (opts: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, ...opts });
    // Auto: scocca e abitacolo, colore per istanza.
    const auto = unisci([new THREE.BoxGeometry(4.2, 1.1, 1.8).translate(0, 0.75, 0), new THREE.BoxGeometry(2.2, 0.8, 1.6).translate(-0.3, 1.65, 0)], [new THREE.Color('#ffffff'), new THREE.Color('#dfe6ec')]);
    this.auto = this.istanze('auto-in-movimento', auto, lambert(), MASSIMI.auto);
    const vagone = unisci([new THREE.BoxGeometry(18, 3.2, 3).translate(0, 2.2, 0), new THREE.BoxGeometry(18.2, 0.6, 3.1).translate(0, 3.9, 0)], [new THREE.Color('#e9e4d8'), new THREE.Color('#2f6f9f')]);
    this.vagoni = this.istanze('treni', vagone, lambert(), MASSIMI.vagoni);
    const barca = unisci([new THREE.BoxGeometry(10, 1.4, 3.4).translate(0, 0.4, 0), new THREE.BoxGeometry(3.4, 1.6, 2.4).translate(-1, 1.8, 0)], [new THREE.Color('#ffffff'), new THREE.Color('#eef2f5')]);
    this.barche = this.istanze('barche-in-movimento', barca, lambert(), MASSIMI.barche);
    this.sbuffi = this.istanze('fumo', new THREE.IcosahedronGeometry(6, 1), new THREE.MeshLambertMaterial({ color: '#f7f7f4', transparent: true, opacity: 0.6, depthWrite: false }), 64 * MASSIMI.sbuffi);
    const persona = unisci([new THREE.CylinderGeometry(0.35, 0.4, 1.3, 5).translate(0, 0.65, 0), new THREE.SphereGeometry(0.3, 5, 4).translate(0, 1.55, 0)], [new THREE.Color('#ffffff'), new THREE.Color('#e8b896')]);
    this.persone = this.istanze('persone', persona, lambert(), MASSIMI.persone);
    const ala = unisci([new THREE.BoxGeometry(0.4, 0.12, 1.6).translate(0, 0, 0.8).rotateY(0.5), new THREE.BoxGeometry(0.4, 0.12, 1.6).translate(0, 0, -0.8).rotateY(-0.5)], [new THREE.Color('#ffffff'), new THREE.Color('#ffffff')]);
    this.gabbiani = this.istanze('gabbiani', ala, lambert(), MASSIMI.gabbiani);
    this.percorsi();
  }

  private istanze(nome: string, g: THREE.BufferGeometry, mat: THREE.Material, n: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(g, mat, n);
    mesh.name = nome;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.gruppo.add(mesh);
    return mesh;
  }

  /** Percorsi fissi, ripetibili: strade principali, binari, rotte delle barche, piazze, voli. */
  private percorsi(): void {
    const tinta = new THREE.Color();
    // Auto: sulle strade di classe 1-3, una ogni ~120 m di strada, al massimo MASSIMI.auto.
    const strade = geo.strade.filter((s) => s.c <= 3 && s.l.length >= 2).map((s) => ({ p: percorso(s.l), c: s.c }));
    strade.sort((a, b) => b.p.totale - a.p.totale);
    let k = 0;
    for (const s of strade) {
      const quante = Math.max(1, Math.round(s.p.totale / 120));
      for (let i = 0; i < quante && k < MASSIMI.auto; i++, k++) {
        const h = hash01(k, 1201);
        this.mobiliAuto.push({ percorso: s.p, s: h * s.p.totale, v: (s.c === 1 ? 16 : 11) + hash01(k, 1202) * 4, verso: hash01(k, 1203) < 0.5 ? 1 : -1, corsia: s.c === 1 ? 3.5 : 2, attesa: 0 });
        this.auto.setColorAt(k, tinta.set(pick(['#d63a2a', '#f4f4f0', '#2f6f9f', '#3b3f45', '#f0b429', '#9aa4ab', '#2e9d5b', '#f4f4f0'], hash01(k, 1204))));
      }
    }
    // Treni: due convogli di sette vagoni sui binari più lunghi.
    const binari = geo.ferrovie.filter((f) => f.length >= 2).map((f) => percorso(f)).sort((a, b) => b.totale - a.totale);
    for (let t = 0; t < 2 && t < binari.length; t++) {
      this.treni.push({ percorso: binari[t]!, s: binari[t]!.totale * (0.3 + t * 0.4), v: 14, verso: t === 0 ? 1 : -1, corsia: 0, attesa: 0 });
    }
    // Barche: da ogni molo verso il largo, dove a 500 m c'è ancora acqua; vanno e tornano con una sosta.
    let b = 0;
    for (const molo of geo.moli) {
      const c = centroid(molo);
      for (let tent = 0; tent < 8 && b < MASSIMI.barche; tent++) {
        const ang = hash01(b, tent, 1301) * Math.PI * 2;
        const fuori: Pt = [c[0] + Math.cos(ang) * 500, c[1] + Math.sin(ang) * 500];
        const mezzo: Pt = [c[0] + Math.cos(ang) * 250, c[1] + Math.sin(ang) * 250];
        const inizio: Pt = [c[0] + Math.cos(ang) * 40, c[1] + Math.sin(ang) * 40];
        if (!nelMare(fuori) || !nelMare(mezzo) || !nelMare(inizio)) continue;
        this.rotte.push({ percorso: percorso([inizio, mezzo, fuori]), s: hash01(b, 1302) * 500, v: 4 + hash01(b, 1303) * 3, verso: 1, corsia: 0, attesa: hash01(b, 1304) * 8 });
        b++;
        break;
      }
    }
    // Persone: nelle piazze, a gruppetti, su piccoli giri.
    const piazze = datiSuolo.aree.piazze.filter((r) => r.length >= 3);
    for (let i = 0; i < MASSIMI.persone && piazze.length > 0; i++) {
      const r = piazze[i % piazze.length]!;
      const c = centroid(r);
      const xs = r.map((p) => p[0]);
      const ys = r.map((p) => p[1]);
      const rx = (Math.max(...xs) - Math.min(...xs)) * 0.3;
      const ry = (Math.max(...ys) - Math.min(...ys)) * 0.3;
      const pp: Pt = [c[0] + (hash01(i, 1401) - 0.5) * rx, c[1] + (hash01(i, 1402) - 0.5) * ry];
      this.posti.push({ x: pp[0], y: pp[1], r: 1 + hash01(i, 1403) * 3, fase: hash01(i, 1404) * 6.28 });
      this.persone.setColorAt(i, tinta.set(pick(['#d9442c', '#2f7fbf', '#f4f4f0', '#3b3f45', '#2e9d5b', '#f0b429', '#e94f9a'], hash01(i, 1405))));
    }
    // Gabbiani: cerchi larghi sul mare vicino alla costa.
    const sulMare = geo.moli.map((m) => centroid(m));
    for (let i = 0; i < MASSIMI.gabbiani && sulMare.length > 0; i++) {
      const c = sulMare[Math.floor(hash01(i, 1501) * sulMare.length)]!;
      this.voli.push({ x: c[0] + (hash01(i, 1502) - 0.5) * 200, y: c[1] + (hash01(i, 1503) - 0.5) * 200, r: 30 + hash01(i, 1504) * 60, quota: 18 + hash01(i, 1505) * 25, fase: hash01(i, 1506) * 6.28, vel: 0.15 + hash01(i, 1507) * 0.15 });
    }
    for (const mesh of [this.auto, this.persone]) if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
  }

  /** I camini che possono fumare (ciminiere dello stabilimento e camini dei lotti). */
  impostaCamini(camini: Camino[]): void {
    this.camini = camini;
  }

  /** Lo stato letto dal motore. */
  impostaStato(stato: StatoVita): void {
    this.stato = stato;
  }

  /** Livello di dettaglio e ingrandimento. */
  impostaVista(livello: 'alto' | 'medio' | 'basso', ppm: number): void {
    this.misura = livello === 'alto' ? 'tutto' : livello === 'medio' ? 'meno' : 'fumo';
    this.vicino = ppm >= 1.2;
  }

  /** Quanti oggetti in movimento sono accesi ora (per le prove). */
  accesi(): number {
    return this.auto.count + this.vagoni.count + this.barche.count + this.sbuffi.count + this.persone.count + this.gabbiani.count;
  }

  /**
   * Aggiorna posizioni e quantità al tempo `t` (secondi), dopo `dt` secondi.
   * Con dt = 0 (riduci animazioni) le cose restano dove sono.
   */
  aggiorna(t: number, dt: number): void {
    const tutto = this.misura === 'tutto';
    this.muovi(this.auto, this.mobiliAuto, !tutto || !this.vicino ? 0 : Math.round((this.mobiliAuto.length * this.stato.traffico) / 1.5), dt, 0.3, true);
    // Ai livelli medio e basso resta solo il fumo (legato allo stato dei lotti).
    this.muoviTreni(tutto ? this.treni.length : 0, dt);
    this.muovi(this.barche, this.rotte, !tutto ? 0 : Math.round((this.rotte.length * this.stato.barche) / 1.6), dt, LIVELLO_MARE + 0.3, false);
    this.fuma(t);
    // Persone e gabbiani solo al livello alto e da vicino.
    const nPersone = tutto && this.vicino ? Math.round((this.posti.length * this.stato.persone) / 1.5) : 0;
    this.persone.count = nPersone;
    for (let i = 0; i < nPersone; i++) {
      const p = this.posti[i]!;
      const a = p.fase + t * 0.4;
      this.v.set(p.x + Math.cos(a) * p.r, QUOTE.segni, -(p.y + Math.sin(a) * p.r));
      this.q.setFromAxisAngle(this.asse, -a);
      this.persone.setMatrixAt(i, this.m.compose(this.v, this.q, this.sc));
    }
    this.persone.instanceMatrix.needsUpdate = nPersone > 0;
    const nGabbiani = tutto ? this.voli.length : 0;
    this.gabbiani.count = nGabbiani;
    for (let i = 0; i < nGabbiani; i++) {
      const g = this.voli[i]!;
      const a = g.fase + t * g.vel;
      this.v.set(g.x + Math.cos(a) * g.r, g.quota + Math.sin(t * 2 + i) * 0.6, -(g.y + Math.sin(a) * g.r));
      this.q.setFromAxisAngle(this.asse, -a);
      this.gabbiani.setMatrixAt(i, this.m.compose(this.v, this.q, this.sc));
    }
    this.gabbiani.instanceMatrix.needsUpdate = nGabbiani > 0;
    // Niente ordini di disegno per ciò che non c'è.
    for (const mesh of [this.auto, this.vagoni, this.barche, this.sbuffi, this.persone, this.gabbiani]) mesh.visible = mesh.count > 0;
  }

  /** Mobili lungo i percorsi, avanti e indietro (le auto cambiano corsia al ritorno, le barche sostano). */
  private muovi(mesh: THREE.InstancedMesh, mobili: Mobile[], n: number, dt: number, quota: number, corsia: boolean): void {
    mesh.count = n;
    for (let i = 0; i < n; i++) {
      const o = mobili[i]!;
      if (o.attesa > 0) o.attesa = Math.max(0, o.attesa - dt);
      else o.s += o.v * o.verso * dt;
      if (o.s > o.percorso.totale || o.s < 0) {
        o.verso = o.verso === 1 ? -1 : 1;
        o.s = tra(o.s, 0, o.percorso.totale);
        if (!corsia) o.attesa = 6;
      }
      this.p.i = o.tratto;
      lungo(o.percorso, o.s, this.p);
      o.tratto = this.p.i;
      const ang = this.p.ang + (o.verso === 1 ? 0 : Math.PI);
      // Corsia di destra rispetto al verso di marcia.
      const off = corsia ? o.corsia : 0;
      const x = this.p.x + Math.sin(ang) * off;
      const y = this.p.y - Math.cos(ang) * off;
      this.v.set(x, quota + (corsia ? QUOTE.strada : 0), -y);
      this.q.setFromAxisAngle(this.asse, ang);
      mesh.setMatrixAt(i, this.m.compose(this.v, this.q, this.sc));
    }
    mesh.instanceMatrix.needsUpdate = n > 0;
  }

  /** Treni: sette vagoni in fila lungo il binario. */
  private muoviTreni(n: number, dt: number): void {
    let k = 0;
    for (let i = 0; i < n; i++) {
      const o = this.treni[i]!;
      o.s += o.v * o.verso * dt;
      if (o.s > o.percorso.totale - 10 || o.s < 140) {
        o.verso = o.verso === 1 ? -1 : 1;
        o.s = tra(o.s, 140, o.percorso.totale - 10);
      }
      for (let c = 0; c < 7 && k < MASSIMI.vagoni; c++, k++) {
        this.p.i = undefined;
        lungo(o.percorso, o.s - o.verso * c * 19, this.p);
        this.v.set(this.p.x, QUOTE.dati, -this.p.y);
        this.q.setFromAxisAngle(this.asse, this.p.ang);
        this.vagoni.setMatrixAt(k, this.m.compose(this.v, this.q, this.sc));
      }
    }
    this.vagoni.count = k;
    this.vagoni.instanceMatrix.needsUpdate = k > 0;
  }

  /** Fumo: per ogni camino, sbuffi che salgono e si allargano, quanti la produzione del lotto. */
  private fuma(t: number): void {
    let k = 0;
    const max = this.sbuffi.instanceMatrix.count;
    for (let c = 0; c < this.camini.length; c++) {
      const cam = this.camini[c]!;
      const intensita = this.stato.fumo[cam.lotto] ?? 0;
      const n = Math.round(MASSIMI.sbuffi * intensita);
      for (let i = 0; i < n && k < max; i++, k++) {
        const f = (t * 0.1 + i / Math.max(1, n) + hash01(c, 1601)) % 1;
        const s = (0.5 + f * 1.8) * (0.6 + intensita * 0.6);
        this.v.set(cam.x + f * 40, cam.quota + f * 70, -(cam.y + f * 15));
        this.sc.setScalar(s);
        this.sbuffi.setMatrixAt(k, this.m.compose(this.v, this.q.identity(), this.sc));
      }
    }
    this.sc.setScalar(1);
    this.sbuffi.count = k;
    this.sbuffi.instanceMatrix.needsUpdate = k > 0;
  }
}
