/**
 * I sei aspetti dei lotti di ILSIDER nella città isometrica (T12, fase B):
 * fermo, cantiere, acciaio con forni nuovi, bosco giovane, energia, mare e
 * cultura. Gli edifici di OpenStreetMap dentro i lotti non si disegnano: ogni
 * lotto ha il suo aspetto per stato (scelta confermata nella fase A).
 *
 * L'aspetto «fermo» dipende dal reparto, così ogni lotto si riconosce: cumuli e
 * macchine di ripresa ai parchi minerali, batterie di forni alle cokerie,
 * altoforni con i cowper, la navata dell'acciaieria, i capannoni lunghi dei
 * laminatoi, le gru ferme sulle banchine. Ogni aspetto è fatto di poche
 * geometrie unite; le parti che si muovono sono ripetute (InstancedMesh) e
 * aggiornate in blocco.
 */
import * as THREE from 'three';
import { centroid, geo, hash01, hashString, pick, pointInPolygon, type GeoBuilding, type Pt } from '../plastico/data.js';
import type { LotLook } from '../plastico/looks.js';
import { Alberi, CostruttoreEdifici, unisci } from './edifici.js';
import { TAVOLOZZA } from './aspetto.js';
import { Geo3, Indice, colore, contorniDa, meshDa, nelLotto } from './geo3.js';
import { COLORI, LIVELLO_MARE, QUOTE } from './suolo.js';
import { MODULO_INDUSTRIALE, SCALA_SUOLO, textureFacciata, textureSuolo, type Suolo } from './texture.js';

export interface Animato {
  update(t: number): void;
}

export interface AspettoLotto {
  gruppo: THREE.Group;
  animati: Animato[];
}

const FONDO: Record<LotLook, { suolo: Suolo; tinta: string }> = {
  fermo: { suolo: 'piazzale', tinta: '#e6d6c2' },
  lavori: { suolo: 'terra', tinta: '#e6cfa6' },
  acciaio: { suolo: 'piazzale', tinta: '#f4f1ea' },
  bosco: { suolo: 'erba', tinta: '#d9f0b8' },
  energia: { suolo: 'erba', tinta: '#f1f3d6' },
  mare: { suolo: 'lastricato', tinta: '#ffffff' },
};

const RUGGINE = ['#8f5a3c', '#7d5640', '#9c6a4a', '#6f5a4b', '#85644f'];

/** Generatore ripetibile per un lotto e un aspetto. */
function caso(seed: string): () => number {
  let i = 0;
  const base = hashString(seed) * 1e6;
  return () => hash01(base, i++);
}

interface Telaio {
  quad: Pt[];
  P: (u: number, v: number) => Pt;
  angolo: number;
  larghezza: number;
  profondita: number;
}

function telaio(quad: Pt[]): Telaio {
  const [q0, q1, , q3] = quad as [Pt, Pt, Pt, Pt];
  return {
    quad,
    P: (u, v) => nelLotto(quad, u, v),
    angolo: Math.atan2(q1[1] - q0[1], q1[0] - q0[0]),
    larghezza: Math.hypot(q1[0] - q0[0], q1[1] - q0[1]),
    profondita: Math.hypot(q3[0] - q0[0], q3[1] - q0[1]),
  };
}

/**
 * Lati del lotto che danno sull'acqua vera (mare, canale): un lato conta se la
 * maggior parte dei punti appena fuori dal lato cade in un'acqua di OpenStreetMap.
 * Restituisce gli indici dei lati: 0 = q0→q1, 1 = q1→q2, 2 = q2→q3, 3 = q3→q0.
 */
export function waterSides(quad: Pt[], waters: Pt[][] = geo.acqua): number[] {
  const sides: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = quad[i]!;
    const b = quad[(i + 1) % 4]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    // Anello antiorario: la normale esterna è (dy, −dx).
    const nx = (b[1] - a[1]) / len;
    const ny = -(b[0] - a[0]) / len;
    let wet = 0;
    const samples = 7;
    for (let k = 1; k <= samples; k++) {
      const t = k / (samples + 1);
      const point: Pt = [a[0] + (b[0] - a[0]) * t + nx * 12, a[1] + (b[1] - a[1]) * t + ny * 12];
      if (waters.some((ring) => pointInPolygon(point, ring))) wet += 1;
    }
    if (wet >= Math.ceil(samples / 2)) sides.push(i);
  }
  return sides;
}

const perLotto = new Map<string, GeoBuilding[]>();

/** Edifici di OpenStreetMap che cadono nel lotto. */
export function edificiDelLotto(quad: Pt[]): GeoBuilding[] {
  const key = JSON.stringify(quad[0]);
  let list = perLotto.get(key);
  if (list === undefined) {
    list = geo.edifici.filter((b) => pointInPolygon(centroid(b.p), quad));
    perLotto.set(key, list);
  }
  return list;
}

/** Costruisce un aspetto di un lotto: lo usano la scena e le prove. */
export function costruisciAspetto(id: string, quad: Pt[], look: LotLook): AspettoLotto {
  const t = telaio(quad);
  const rnd = caso(`${id}:${look}`);
  const gruppo = new THREE.Group();
  gruppo.name = `${id}:${look}`;
  const animati: Animato[] = [];
  // Fondo alla quota dei lotti: nessuna piastra rialzata.
  const fondo = new Geo3();
  fondo.flat(quad, QUOTE.lotti, colore(FONDO[look].tinta), SCALA_SUOLO);
  gruppo.add(meshDa(fondo, new THREE.MeshLambertMaterial({ vertexColors: true, map: textureSuolo(FONDO[look].suolo) }), { nome: 'fondo-lotto' }));
  const solidi = new Geo3();
  // Contorni come per la città (T12c).
  solidi.contorni = [];
  switch (look) {
    case 'fermo':
      fermo(id, t, solidi, gruppo, rnd);
      break;
    case 'lavori':
      lavori(t, solidi, gruppo, animati, rnd);
      break;
    case 'acciaio':
      acciaio(id, t, solidi, gruppo, animati, rnd);
      break;
    case 'bosco':
      bosco(t, solidi, gruppo);
      break;
    case 'energia':
      energia(t, solidi, gruppo, animati, rnd);
      break;
    case 'mare':
      mare(id, t, solidi, gruppo, rnd);
      break;
  }
  if (!solidi.empty) gruppo.add(meshDa(solidi, new THREE.MeshLambertMaterial({ vertexColors: true }), { nome: 'strutture-lotto', proietta: true }));
  const linee = contorniDa(solidi, TAVOLOZZA.contorno, 'contorni-lotto');
  if (linee !== null) gruppo.add(linee);
  return { gruppo, animati };
}

// ---------- Fermo ----------

function fermo(id: string, t: Telaio, g: Geo3, gruppo: THREE.Group, rnd: () => number): void {
  const rug = () => colore(pick(RUGGINE, rnd()));
  const ang = t.angolo;
  // Fuori dai parchi minerali, gli edifici veri del reparto restano, spenti e arrugginiti:
  // lo stabilimento di oggi. Le strutture tipiche del reparto si mettono dove c'è spazio.
  const indice = new Indice(30);
  if (id !== 'lotto-parchi-minerali') {
    const edifici = new CostruttoreEdifici();
    for (const b of edificiDelLotto(t.quad)) {
      edifici.aggiungi(b, 'capannone', 0, true);
      indice.add(b.p);
    }
    for (const m of edifici.meshes()) gruppo.add(m);
  }
  /** Primo punto libero (raggio r metri) vicino a (u, v), cercando a spirale. */
  const posto = (u: number, v: number, r: number): Pt | null => {
    for (let k = 0; k < 40; k++) {
      const a = k * 2.4;
      const d = k * 0.012;
      const uu = u + Math.cos(a) * d;
      const vv = v + Math.sin(a) * d;
      if (uu < 0.04 || uu > 0.96 || vv < 0.04 || vv > 0.96) continue;
      const [x, y] = t.P(uu, vv);
      if (!indice.dentro(x, y, r) && !indice.dentro(x, y, r * 0.5)) {
        const box: Pt[] = [
          [x - r, y - r],
          [x + r, y - r],
          [x + r, y + r],
          [x - r, y + r],
        ];
        indice.add(box);
        return [x, y];
      }
    }
    return null;
  };
  switch (id) {
    case 'lotto-parchi-minerali':
      parchiFermi(t, g, rnd);
      break;
    case 'lotto-cokerie': {
      // Batterie di forni a coke: blocchi lunghi e bassi di mattoni scuri, con le torri del carbone e i camini.
      for (let k = 0; k < 4; k++) {
        const p = posto(0.45, 0.18 + k * 0.17, 40);
        if (p === null) continue;
        g.box(p[0], p[1], Math.min(260, t.larghezza * 0.3), 16, 14, ang, 0, colore('#6b4a3a'));
        g.box(p[0], p[1], Math.min(260, t.larghezza * 0.3), 18, 1.2, ang, 14, colore('#4f3a30'));
        const q = posto(0.75, 0.18 + k * 0.17, 12);
        if (q !== null) g.box(q[0], q[1], 18, 18, 38, ang, 0, rug());
      }
      for (const u of [0.12, 0.2, 0.3]) {
        const p = posto(u, 0.85, 8);
        if (p !== null) g.cylinder(p[0], p[1], 5, 3.4, 95, 0, 12, colore('#8b7b6e'));
      }
      break;
    }
    case 'lotto-altoforni': {
      // Altoforni: tino alto, bocca conica, tubazioni di discesa; accanto i cowper (cilindri con la cupola).
      for (let k = 0; k < 3; k++) {
        const p = posto(0.22 + k * 0.28, 0.45, 30);
        if (p === null) continue;
        const [x, y] = p;
        g.cylinder(x, y, 11, 9, 48, 0, 16, rug());
        g.cylinder(x, y, 9, 4, 18, 48, 16, rug());
        g.cylinder(x, y, 3, 3, 22, 66, 10, colore('#6f5a4b'));
        g.beam(new THREE.Vector3(x, 80, -y), new THREE.Vector3(x + 22, 20, -(y + 8)), 2.4, colore('#7d5640'));
        for (let c = 0; c < 4; c++) {
          const q = posto(0.14 + k * 0.28 + c * 0.045, 0.72, 8);
          if (q === null) continue;
          g.cylinder(q[0], q[1], 6, 6, 42, 0, 14, colore('#a58466'));
          g.cylinder(q[0], q[1], 6, 1.5, 5, 42, 14, colore('#8f6e55'));
        }
      }
      break;
    }
    case 'lotto-acciaieria': {
      // Acciaieria: i camini dei convertitori, alti e affiancati.
      for (const u of [0.25, 0.42, 0.59, 0.76]) {
        const p = posto(u, 0.2, 8);
        if (p !== null) g.cylinder(p[0], p[1], 4.5, 3.2, 80, 0, 12, colore('#8b7b6e'));
      }
      break;
    }
    case 'lotto-laminatoi': {
      // Laminatoi: rotoli d'acciaio e lamiere accatastati all'aperto, arrugginiti.
      for (let k = 0; k < 14; k++) {
        const p = posto(0.1 + rnd() * 0.8, 0.1 + rnd() * 0.8, 10);
        if (p === null) continue;
        for (let r = 0; r < 4; r++) g.cylinder(p[0] + r * 3.2 - 5, p[1], 1.4, 1.4, 2.2, QUOTE.lotti, 8, rug());
      }
      break;
    }
    case 'lotto-banchine': {
      // Banchine: gru a portale ferme e arrugginite, qualche cumulo.
      for (let k = 0; k < 4; k++) gruPortale(t, g, 0.15 + k * 0.23, 0.12, colore(pick(['#9c6a4a', '#b0633c', '#8f5a3c'], rnd())));
      for (let k = 0; k < 5; k++) {
        const p = posto(0.1 + rnd() * 0.8, 0.45 + rnd() * 0.4, 20);
        if (p !== null) mucchio(g, p[0], p[1], 16 + rnd() * 10, 8 + rnd() * 5, colore(pick(['#8a3b22', '#3a3431'], rnd())));
      }
      break;
    }
  }
  // Ovunque, erbacce e cespugli tra gli impianti: lo stabilimento è fermo.
  const alberi = new Alberi();
  for (let k = 0; k < 160; k++) {
    const [x, y] = t.P(0.03 + rnd() * 0.94, 0.03 + rnd() * 0.94);
    alberi.add(x, y, 'cespuglio', Math.round(x * 3 + y * 7), 1, 1);
  }
  for (const m of alberi.meshes()) gruppo.add(m);
}

/** Mucchio a cono basso, fatto di triangoli. */
function mucchio(g: Geo3, x: number, y: number, r: number, h: number, c: THREE.Color): void {
  const lati = 8;
  for (let i = 0; i < lati; i++) {
    const a0 = (i / lati) * Math.PI * 2;
    const a1 = ((i + 1) / lati) * Math.PI * 2;
    g.tri(new THREE.Vector3(x + Math.cos(a0) * r, QUOTE.lotti, -(y + Math.sin(a0) * r)), new THREE.Vector3(x + Math.cos(a1) * r, QUOTE.lotti, -(y + Math.sin(a1) * r)), new THREE.Vector3(x, h, -y), c.clone().multiplyScalar(0.82 + 0.18 * Math.cos(a0 - 2.4)));
  }
}

function gruPortale(t: Telaio, g: Geo3, u: number, v: number, c: THREE.Color): void {
  const [x, y] = t.P(u, v);
  const ux = Math.cos(t.angolo);
  const uy = Math.sin(t.angolo);
  const P = (a: number, b: number, h: number) => new THREE.Vector3(x + ux * a - uy * b, h, -(y + uy * a + ux * b));
  for (const a of [-7, 7]) for (const b of [-6, 6]) g.beam(P(a, b, 0), P(a, b, 22), 1.2, c);
  g.beam(P(-7, -6, 22), P(-7, 6, 22), 1.4, c);
  g.beam(P(7, -6, 22), P(7, 6, 22), 1.4, c);
  g.box(x, y, 16, 14, 6, t.angolo, 22, c);
  g.beam(P(0, -30, 30), P(0, 20, 26), 2, c);
}

function parchiFermi(t: Telaio, g: Geo3, rnd: () => number): void {
  const colori = ['#8a3b22', '#2f2b29', '#a8a29a', '#7a3220', '#3a3431'];
  const file = 6;
  const P3 = ([x, y]: Pt, h: number) => new THREE.Vector3(x, h, -y);
  for (let i = 0; i < file; i++) {
    const v0 = 0.08 + (i * 0.84) / file;
    const v1 = v0 + 0.84 / file - 0.035;
    const a = t.P(0.06, v0);
    const b = t.P(0.94, v0);
    const d = t.P(0.94, v1);
    const e = t.P(0.06, v1);
    const altezza = 12 + hash01(i, 90) * 6;
    const c = colore(colori[i % colori.length]!);
    const mid1: Pt = [(a[0] + e[0]) / 2, (a[1] + e[1]) / 2];
    const mid2: Pt = [(b[0] + d[0]) / 2, (b[1] + d[1]) / 2];
    const r1: Pt = [mid1[0] + (mid2[0] - mid1[0]) * 0.06, mid1[1] + (mid2[1] - mid1[1]) * 0.06];
    const r2: Pt = [mid2[0] + (mid1[0] - mid2[0]) * 0.06, mid2[1] + (mid1[1] - mid2[1]) * 0.06];
    const y0 = QUOTE.lotti;
    g.quad(P3(a, y0), P3(b, y0), P3(r2, altezza), P3(r1, altezza), c);
    g.quad(P3(d, y0), P3(e, y0), P3(r1, altezza), P3(r2, altezza), c.clone().multiplyScalar(0.8));
    g.tri(P3(e, y0), P3(a, y0), P3(r1, altezza), c.clone().multiplyScalar(0.9));
    g.tri(P3(b, y0), P3(d, y0), P3(r2, altezza), c.clone().multiplyScalar(0.9));
  }
  // Binari e macchine di ripresa ferme tra un cumulo e l'altro.
  for (let i = 1; i < file; i++) {
    const v = 0.08 + (i * 0.84) / file - 0.018;
    const a = t.P(0.04, v);
    const b = t.P(0.96, v);
    g.beam(P3(a, QUOTE.lotti + 0.3), P3(b, QUOTE.lotti + 0.3), 0.5, colore(COLORI.rotaia));
    const [x, y] = t.P(0.2 + hash01(i, 91) * 0.6, v);
    const ang = t.angolo + hash01(i, 92) * 0.6 - 0.3;
    g.box(x, y, 14, 10, 6, ang, 0, colore('#9a5b35'));
    g.box(x, y, 5, 5, 14, ang, 6, colore('#b68f45'));
    g.beam(new THREE.Vector3(x, 17, -y), new THREE.Vector3(x + Math.cos(ang) * 40, 10, -(y + Math.sin(ang) * 40)), 2.2, colore('#9a5b35'));
  }
  // Nastri trasportatori sui cavalletti, verso lo stabilimento.
  for (const v of [0.04, 0.97]) {
    const a = t.P(0.02, v);
    const b = t.P(0.98, v);
    g.beam(P3(a, 10), P3(b, 10), 2.4, colore('#8b7a68'));
    for (let k = 0; k <= 12; k++) {
      const [x, y] = t.P(0.02 + (k / 12) * 0.96, v);
      g.box(x, y, 1.2, 1.2, 9, t.angolo, 0, colore('#7d6656'));
    }
  }
  void rnd;
}

// ---------- Cantiere ----------

function lavori(t: Telaio, g: Geo3, gruppo: THREE.Group, animati: Animato[], rnd: () => number): void {
  // Recinzione arancione lungo i quattro lati.
  const arancio = colore('#e07b39');
  for (let i = 0; i < 4; i++) {
    const a = t.quad[i]!;
    const b = t.quad[(i + 1) % 4]!;
    g.walls([a, b, b, a], QUOTE.lotti, 2.2, arancio);
  }
  // Tutta l'area lavorata (T12c): una griglia di celle di circa 110 m, in ognuna un pezzo di
  // cantiere scelto in modo ripetibile. Nessun piazzale vuoto, anche sui lotti di un chilometro.
  const nu = Math.max(3, Math.round(t.larghezza / 110));
  const nv = Math.max(3, Math.round(t.profondita / 110));
  const terra = colore('#b8935f');
  const cemento = colore('#d9d2c4');
  const ux = Math.cos(t.angolo);
  const uy = Math.sin(t.angolo);
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const u = (i + 0.5) / nu;
      const v = (j + 0.5) / nv;
      // Le celle della fila delle strutture a metà e delle gru restano a loro.
      if (v > 0.62 && v < 0.82) continue;
      const [x, y] = t.P(u + (rnd() - 0.5) * 0.3 / nu, v + (rnd() - 0.5) * 0.3 / nv);
      const scelta = rnd();
      const R = (a: number, b: number): Pt => [x + ux * a - uy * b, y + uy * a + ux * b];
      if (scelta < 0.22) {
        // Scavo: fondo scuro, quattro scarpate, una rampa.
        const w = 34 + rnd() * 30;
        const d = 24 + rnd() * 20;
        const fondo = QUOTE.lotti + 0.02;
        g.flat([R(-w / 2, -d / 2), R(w / 2, -d / 2), R(w / 2, d / 2), R(-w / 2, d / 2)], fondo, colore('#8a6a45'));
        g.flat([R(-w / 2 + 4, -d / 2 + 4), R(w / 2 - 4, -d / 2 + 4), R(w / 2 - 4, d / 2 - 4), R(-w / 2 + 4, d / 2 - 4)], fondo + 0.02, colore('#6f5236'));
        g.walls([R(-w / 2, -d / 2), R(w / 2, -d / 2), R(w / 2, d / 2), R(-w / 2, d / 2)], fondo, fondo + 0.9, colore('#e07b39'));
      } else if (scelta < 0.42) {
        for (let k = 0; k < 3; k++) mucchio(g, x + (rnd() - 0.5) * 50, y + (rnd() - 0.5) * 50, 8 + rnd() * 9, 4 + rnd() * 5, k === 2 ? colore('#a9a39a') : terra);
      } else if (scelta < 0.58) {
        // Baracche di cantiere in fila, bianche e blu, con il bagno chimico.
        for (let k = 0; k < 4; k++) {
          const [bx, by] = R(-12 + k * 7, 0);
          g.box(bx, by, 6, 2.5, 2.6, t.angolo, QUOTE.lotti, colore(pick(['#f2f2ee', '#3f7a9b', '#e2c35a'], rnd())));
        }
        const [wx, wy] = R(18, 0);
        g.box(wx, wy, 1.3, 1.3, 2.3, t.angolo, QUOTE.lotti, colore('#2e9d5b'));
      } else if (scelta < 0.74) {
        // Mezzi: escavatore (scocca, braccio), camion con il cassone, rullo.
        g.box(x, y, 5, 3, 2.4, t.angolo + rnd(), QUOTE.lotti, colore('#f2b632'));
        g.box(x + 3, y, 6, 0.8, 0.8, t.angolo + 0.6, 3.2, colore('#e0a520'));
        const [cx, cy] = R(14, 6);
        g.box(cx, cy, 9, 2.6, 2.8, t.angolo, QUOTE.lotti, colore('#d63a2a'));
        g.box(cx - 2, cy, 5, 2.6, 1.2, t.angolo, 2.9, colore('#9a8a72'));
        const [rx, ry] = R(-12, -8);
        g.box(rx, ry, 4, 2, 2, t.angolo, QUOTE.lotti, colore('#f2b632'));
      } else if (scelta < 0.88) {
        // Cataste: tubi e pallet di blocchi.
        for (let k = 0; k < 6; k++) {
          const [px, py] = R(-15 + (k % 3) * 10, -6 + Math.floor(k / 3) * 10);
          g.box(px, py, 6, 4, 1.4 + rnd() * 1.4, t.angolo, QUOTE.lotti, k % 2 === 0 ? cemento : colore('#9aa4ab'));
        }
      } else {
        // Recinto interno con i new jersey e un'area di stoccaggio di ghiaia.
        const w = 40;
        g.walls([R(-w / 2, -w / 2), R(w / 2, -w / 2), R(w / 2, w / 2), R(-w / 2, w / 2)], QUOTE.lotti, 1.1, colore('#f4f2ea'));
        mucchio(g, x, y, 12, 5, colore('#a9a39a'));
      }
    }
  }
  // Strutture a metà (pilastri e solai), baracche e ruspe.
  for (let k = 0; k < 3; k++) {
    const [x, y] = t.P(0.2 + k * 0.3, 0.72);
    const piani = 2 + Math.floor(rnd() * 3);
    for (let p = 0; p <= piani; p++) g.box(x, y, 50, 30, 0.6, t.angolo, p * 4, colore('#d9d2c4'));
    for (let a = -2; a <= 2; a++) {
      for (const b of [-1, 1]) {
        const ux = Math.cos(t.angolo);
        const uy = Math.sin(t.angolo);
        g.box(x + ux * a * 12 - uy * b * 13, y + uy * a * 12 + ux * b * 13, 0.8, 0.8, piani * 4, t.angolo, 0, colore('#cfc8ba'));
      }
    }
  }
  for (let k = 0; k < 6; k++) {
    const [x, y] = t.P(0.06 + k * 0.035, 0.06);
    g.box(x, y, 6, 2.5, 2.6, t.angolo, QUOTE.lotti, colore(pick(['#f2f2ee', '#3f7a9b', '#e2c35a'], rnd())));
  }
  for (let k = 0; k < 4; k++) {
    const [x, y] = t.P(0.15 + rnd() * 0.7, 0.3 + rnd() * 0.3);
    g.box(x, y, 6, 3, 3, t.angolo + rnd() * 3, QUOTE.lotti, colore('#f2b632'));
    g.box(x, y, 3, 2.6, 2.4, t.angolo, 3, colore('#e0a520'));
  }
  // Gru a torre: torre fissa, braccio che gira piano (ripetuto, aggiornato in blocco).
  const giallo = colore('#f2b632');
  const posti: { x: number; y: number; fase: number; vel: number }[] = [];
  for (let k = 0; k < 3; k++) {
    const [x, y] = t.P(0.25 + k * 0.25, 0.35 + rnd() * 0.3);
    g.box(x, y, 2.4, 2.4, 52, 0, 0, giallo);
    posti.push({ x, y, fase: rnd() * Math.PI * 2, vel: 0.08 + rnd() * 0.08 });
  }
  const braccio = unisci([new THREE.BoxGeometry(56, 1.6, 1.6).translate(16, 0, 0), new THREE.BoxGeometry(6, 4, 3).translate(-12, -2, 0)], [colore('#f2b632'), colore('#55524b')]);
  const bracci = new THREE.InstancedMesh(braccio, new THREE.MeshLambertMaterial({ vertexColors: true }), posti.length);
  bracci.castShadow = true;
  bracci.name = 'bracci-gru';
  gruppo.add(bracci);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const asse = new THREE.Vector3(0, 1, 0);
  const uno = new THREE.Vector3(1, 1, 1);
  animati.push({
    update: (tempo) => {
      posti.forEach((p, i) => {
        q.setFromAxisAngle(asse, p.fase + tempo * p.vel);
        m.compose(new THREE.Vector3(p.x, 52, -p.y), q, uno);
        bracci.setMatrixAt(i, m);
      });
      bracci.instanceMatrix.needsUpdate = true;
    },
  });
  animati[animati.length - 1]!.update(0);
}

// ---------- Acciaio con forni nuovi ----------

function acciaio(id: string, t: Telaio, g: Geo3, gruppo: THREE.Group, animati: Animato[], rnd: () => number): void {
  // Capannoni nuovi, bianchi e azzurri, con la facciata industriale e i lucernari: in due file.
  const pareti = new Geo3();
  const edifici = new CostruttoreEdifici();
  const lunga = Math.min(320, t.larghezza * 0.34);
  for (let i = 0; i < 4; i++) {
    for (const u of [0.26, 0.62]) {
      const [x, y] = t.P(u, 0.16 + i * 0.21);
      const ux = Math.cos(t.angolo);
      const uy = Math.sin(t.angolo);
      const R = (a: number, b: number): Pt => [x + ux * a - uy * b, y + uy * a + ux * b];
      const ring = [R(-lunga / 2, -32), R(lunga / 2, -32), R(lunga / 2, 32), R(-lunga / 2, 32)];
      pareti.walls(ring, 0, 26, colore(i % 2 === 0 ? '#eef1f3' : '#dfe8f0'), { moduloU: MODULO_INDUSTRIALE, moduloV: 0 });
      navataTetto(g, x, y, lunga, 64, 26, t.angolo, colore(i % 2 === 0 ? '#4a7bb0' : '#5b8fc4'));
    }
  }
  gruppo.add(meshDa(pareti, new THREE.MeshLambertMaterial({ vertexColors: true, map: textureFacciata('industriale') }), { nome: 'capannoni-nuovi', proietta: true }));
  // Uffici, parcheggio dei camion, un solo camino bianco e rosso con poco fumo.
  for (let i = 0; i < 4; i++) {
    const [x, y] = t.P(0.08, 0.2 + i * 0.18);
    edifici.aggiungi({ id: hashString(`${id}:uffici:${i}`), p: rettangolo(x, y, 36, 22, t.angolo), k: 'negozi' }, 'pubblico');
  }
  for (let i = 0; i < 8; i++) {
    const [x, y] = t.P(0.9, 0.12 + i * 0.04);
    g.box(x, y, 14, 3, 4, t.angolo, QUOTE.lotti, colore(i % 3 === 0 ? '#c4483a' : '#e9e6df'));
  }
  const [cx, cy] = t.P(0.85, 0.5);
  edifici.ciminiera(cx, cy, 0, 110, '#c4483a');
  for (const m of edifici.meshes()) gruppo.add(m);
  // Il fumo lo disegna la vita della città (vita.ts), secondo la produzione letta dal motore.
  void animati;
  void rnd;
}

/** Camino dell'aspetto «acciaio» di un lotto: posizione e quota della bocca (il fumo è in vita.ts). */
export function caminoAcciaio(quad: Pt[]): { x: number; y: number; quota: number } {
  const [x, y] = telaio(quad).P(0.85, 0.5);
  return { x, y, quota: 112 };
}

function navataTetto(g: Geo3, x: number, y: number, lunga: number, larga: number, alta: number, angolo: number, tetto: THREE.Color): void {
  const ux = Math.cos(angolo);
  const uy = Math.sin(angolo);
  const P = (a: number, b: number, h: number) => new THREE.Vector3(x + ux * a - uy * b, h, -(y + uy * a + ux * b));
  const colmo = alta + larga * 0.12;
  g.quad(P(-lunga / 2, -larga / 2, alta), P(lunga / 2, -larga / 2, alta), P(lunga / 2, 0, colmo), P(-lunga / 2, 0, colmo), tetto);
  g.quad(P(lunga / 2, larga / 2, alta), P(-lunga / 2, larga / 2, alta), P(-lunga / 2, 0, colmo), P(lunga / 2, 0, colmo), tetto.clone().multiplyScalar(0.85));
  const timpano = colore('#eef1f3');
  g.tri(P(-lunga / 2, -larga / 2, alta), P(-lunga / 2, 0, colmo), P(-lunga / 2, larga / 2, alta), timpano);
  g.tri(P(lunga / 2, larga / 2, alta), P(lunga / 2, 0, colmo), P(lunga / 2, -larga / 2, alta), timpano);
  // Lucernari lungo il colmo.
  for (let a = -lunga / 2 + 8; a < lunga / 2 - 4; a += 10) g.box(x + ux * a - uy * -larga * 0.25, y + uy * a + ux * -larga * 0.25, 5, 2.2, 0.6, angolo, alta + larga * 0.06, colore('#bcd3e0'));
}

function rettangolo(x: number, y: number, w: number, d: number, angolo: number): Pt[] {
  const ux = Math.cos(angolo);
  const uy = Math.sin(angolo);
  const R = (a: number, b: number): Pt => [x + ux * a - uy * b, y + uy * a + ux * b];
  return [R(-w / 2, -d / 2), R(w / 2, -d / 2), R(w / 2, d / 2), R(-w / 2, d / 2)];
}

// ---------- Bosco giovane ----------

function bosco(t: Telaio, g: Geo3, gruppo: THREE.Group): void {
  const sentiero = colore('#e2d6b3');
  g.ribbon([t.P(0, 0.5), t.P(0.3, 0.42), t.P(0.6, 0.58), t.P(1, 0.5)], 4, QUOTE.lotti + 0.02, sentiero);
  g.ribbon([t.P(0.5, 0), t.P(0.45, 0.4), t.P(0.55, 1)], 4, QUOTE.lotti + 0.02, sentiero);
  const alberi = new Alberi();
  const passoU = 11 / t.larghezza;
  const passoV = 11 / t.profondita;
  let k = 0;
  for (let u = 0.02; u < 0.98; u += passoU) {
    for (let v = 0.02; v < 0.98; v += passoV) {
      k += 1;
      const ju = u + (hash01(k, 95) - 0.5) * passoU * 0.8;
      const jv = v + (hash01(k, 96) - 0.5) * passoV * 0.8;
      // I sentieri restano liberi.
      if (Math.abs(jv - (0.5 + Math.sin(ju * 6) * 0.06)) < 0.025 || Math.abs(ju - 0.5) < 0.012) continue;
      const [x, y] = t.P(ju, jv);
      alberi.add(x, y, hash01(k, 97) < 0.12 ? 'pino' : 'giovane', k * 13 + 5, hash01(k, 98) < 0.3 ? 1.5 : 1, hash01(k, 99) < 0.5 ? 0 : 1);
    }
  }
  for (const m of alberi.meshes()) gruppo.add(m);
}

// ---------- Energia ----------

function energia(t: Telaio, g: Geo3, gruppo: THREE.Group, animati: Animato[], rnd: () => number): void {
  // Pannelli solari in file nella metà vicina: lunghe falde inclinate verso sud.
  const pannello = colore('#2f4f7f');
  const telaio = colore('#c9ced3');
  for (let r = 0; r < 10; r++) {
    const v = 0.06 + r * 0.045;
    const a = t.P(0.05, v);
    const b = t.P(0.95, v);
    const P3 = ([x, y]: Pt, h: number, dv: number) => {
      const [x2, y2] = t.P(0.05, v + dv);
      const [x1, y1] = t.P(0.05, v);
      return new THREE.Vector3(x + (x2 - x1), h, -(y + (y2 - y1)));
    };
    g.quad(P3(a, 1, 0), P3(b, 1, 0), P3(b, 3.2, 0.022), P3(a, 3.2, 0.022), pannello);
    g.beam(P3(a, 0.9, 0), P3(b, 0.9, 0), 0.2, telaio);
  }
  // Pale eoliche nella metà lontana: torre fissa, rotore ripetuto che gira.
  const posti: { x: number; y: number; fase: number; vel: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const [x, y] = t.P(0.15 + (i % 3) * 0.35, 0.62 + Math.floor(i / 3) * 0.25);
    g.cylinder(x, y, 2.2, 1.4, 80, 0, 10, colore('#f7f7f5'));
    g.box(x, y, 8, 4, 4, t.angolo + Math.PI / 2, 79, colore('#f1f1ee'));
    posti.push({ x, y, fase: rnd() * Math.PI, vel: 0.9 + rnd() * 0.3 });
  }
  const pala = new THREE.BoxGeometry(1.6, 34, 0.5).translate(0, 17, 0);
  const rotore = unisci([0, 1, 2].map((k) => pala.clone().rotateZ((k * Math.PI * 2) / 3)), [0, 1, 2].map(() => colore('#fbfbf9')));
  const rotori = new THREE.InstancedMesh(rotore, new THREE.MeshLambertMaterial({ vertexColors: true }), posti.length);
  rotori.castShadow = true;
  rotori.name = 'rotori';
  gruppo.add(rotori);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const uno = new THREE.Vector3(1, 1, 1);
  // I rotori guardano a sud-ovest, il vento dominante sul golfo.
  animati.push({
    update: (tempo) => {
      posti.forEach((p, i) => {
        e.set(0, Math.PI / 4, p.fase + tempo * p.vel, 'YXZ');
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(p.x, 81, -p.y), q, uno);
        rotori.setMatrixAt(i, m);
      });
      rotori.instanceMatrix.needsUpdate = true;
    },
  });
  animati[animati.length - 1]!.update(0);
}

// ---------- Mare e cultura ----------

function mare(id: string, t: Telaio, g: Geo3, gruppo: THREE.Group, rnd: () => number): void {
  // Sui lati che toccano il mare vero: banchina aperta, bitte e barche ormeggiate fuori, sull'acqua.
  const barche: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  for (const side of waterSides(t.quad)) {
    const a = t.quad[side]!;
    const b = t.quad[(side + 1) % 4]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ox = (b[1] - a[1]) / len;
    const oy = -(b[0] - a[0]) / len;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const [cx, cy] = [(a[0] + b[0]) / 2 - ox * 10, (a[1] + b[1]) / 2 - oy * 10];
    g.box(cx, cy, len * 0.94, 18, 0.5, ang, QUOTE.lotti, colore('#e3dccb'));
    for (let k = 1; k < 12; k++) {
      const x = a[0] + ((b[0] - a[0]) * k) / 12 - ox * 2;
      const y = a[1] + ((b[1] - a[1]) * k) / 12 - oy * 2;
      g.cylinder(x, y, 0.5, 0.45, 1, QUOTE.lotti, 6, colore('#55524b'));
    }
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
    for (let k = 0; k < 6; k++) {
      const s = 0.15 + k * 0.14;
      m.compose(new THREE.Vector3(a[0] + (b[0] - a[0]) * s + ox * 14, LIVELLO_MARE, -(a[1] + (b[1] - a[1]) * s + oy * 14)), q, new THREE.Vector3(1.4, 1.4, 1.4));
      barche.push(m.clone());
    }
  }
  if (barche.length > 0) {
    const barca = unisci([new THREE.BoxGeometry(9, 1.2, 3).translate(0, 0.3, 0), new THREE.BoxGeometry(3, 1.4, 2.2).translate(-0.8, 1.4, 0), new THREE.BoxGeometry(0.2, 6, 0.2).translate(1.5, 3.5, 0)], [colore('#ffffff'), colore('#e9eef2'), colore('#6b6f73')]);
    const mesh = new THREE.InstancedMesh(barca, new THREE.MeshLambertMaterial({ vertexColors: true }), barche.length);
    barche.forEach((mm, i) => mesh.setMatrixAt(i, mm));
    mesh.name = 'barche-lotto';
    gruppo.add(mesh);
  }
  // Una piazza chiara al centro, edifici pubblici colorati intorno, alberi lungo i viali.
  const piazza: Pt[] = [t.P(0.35, 0.35), t.P(0.65, 0.35), t.P(0.65, 0.65), t.P(0.35, 0.65)];
  g.flat(piazza, QUOTE.lotti + 0.02, colore('#f3ead6'));
  const edifici = new CostruttoreEdifici();
  const spots: [number, number][] = [
    [0.2, 0.22],
    [0.5, 0.18],
    [0.8, 0.22],
    [0.8, 0.76],
    [0.5, 0.82],
    [0.2, 0.76],
  ];
  spots.forEach(([u, v], i) => {
    const [x, y] = t.P(u, v);
    edifici.aggiungi({ id: hashString(`${id}:museo:${i}`), p: rettangolo(x, y, Math.min(60, t.larghezza * 0.16), Math.min(36, t.profondita * 0.16), t.angolo), k: 'pubblico' }, i % 2 === 0 ? 'pubblico' : 'citta-vecchia');
  });
  for (const mesh of edifici.meshes()) gruppo.add(mesh);
  const alberi = new Alberi();
  for (let i = 0; i < 16; i++) {
    const s = i / 15;
    for (const [u, v] of [
      [0.3 + s * 0.4, 0.3],
      [0.3 + s * 0.4, 0.7],
      [0.3, 0.3 + s * 0.4],
      [0.7, 0.3 + s * 0.4],
    ] as [number, number][]) {
      const [x, y] = t.P(u, v);
      alberi.add(x, y, i % 3 === 0 ? 'pino' : 'latifoglia', Math.round(x * 5 + y * 3), 0.9, 0);
    }
  }
  for (let i = 0; i < 30; i++) {
    const [x, y] = t.P(0.08 + rnd() * 0.84, 0.3 + rnd() * 0.4);
    alberi.add(x, y, 'latifoglia', Math.round(x * 7 + y * 11), 0.9, 1);
  }
  for (const mesh of alberi.meshes()) gruppo.add(mesh);
}
