/**
 * Edifici con carattere (T12c): ogni edificio è composto da parti (corpo, piano
 * terra, balconi, coronamento, tetto) scelte in modo ripetibile
 * dall'identificativo della sagoma (tipi.ts, variante). Vale per tutta la zona e
 * per i lotti di ILSIDER.
 *
 * Tipi: palazzina con balconi e stenditoi (a volte con negozi e tende al piano
 * terra), casa bassa con terrazzo e pergolato o tetto in coppi, casa della Città
 * Vecchia, palazzo del centro con zoccolo bugnato e cornicione, scuola o edificio
 * pubblico, chiesa con campanile o cupola, negozi con tende, capannone con gronda
 * colorata e lucernari, impianto con ciminiera, garage e annessi. Sui tetti piani:
 * cisterne, antenne e parabole. Nessun edificio reale è ricostruito: forme e colori
 * sono tipici, non copiati.
 *
 * I balconi in rilievo stanno in una geometria a parte (con i loro contorni): la
 * scena li accende solo al livello alto e da vicino; altrimenti sono dipinti nella
 * facciata «balconi».
 */
import * as THREE from 'three';
import { hash01, pick, type GeoBuilding, type Pt } from '../plastico/data.js';
import { TAVOLOZZA } from './aspetto.js';
import type { CostruttoreEdifici } from './edifici.js';
import { allarga, colore, obb, type Geo3 } from './geo3.js';
import { CAMPATA, MODULO_INDUSTRIALE, PIANO } from './texture.js';
import { variante, type StileFacciata, type TipoEdificio, type Variante } from './tipi.js';

/** Altezza del piano terra dei negozi e dello zoccolo, in metri. */
const TERRA = 3.8;

type Box = ReturnType<typeof obb>;

/** Lati di un anello con la loro lunghezza, dal più lungo. */
function lati(ring: Pt[]): { a: Pt; b: Pt; len: number }[] {
  const out: { a: Pt; b: Pt; len: number }[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    out.push({ a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) });
  }
  return out.sort((x, y) => y.len - x.len);
}

/** Punto a metà di un lato spostato di `d` metri verso l'esterno (anello antiorario), e angolo del lato. */
function fuori(a: Pt, b: Pt, len: number, d: number): { x: number; y: number; ang: number; ox: number; oy: number } {
  const ox = (b[1] - a[1]) / len;
  const oy = -(b[0] - a[0]) / len;
  return { x: (a[0] + b[0]) / 2 + ox * d, y: (a[1] + b[1]) / 2 + oy * d, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), ox, oy };
}

/**
 * Aggiunge un edificio del catalogo. `tag` è il quartiere (per lo strato);
 * `ruggine` dà lamiere e tetti arrugginiti (impianti fermi dei lotti).
 */
export function aggiungiEdificio(c: CostruttoreEdifici, b: GeoBuilding, tipo: TipoEdificio, tag = 0, ruggine = false): Variante {
  const box = obb(b.p);
  const v = variante(b, tipo, box.fill > 0.82 && box.hv > 2.5);
  c.conteggio[tipo] += 1;
  const r = (s: number) => hash01(b.id, 900 + s);
  c.accendiContorni(true);
  const h = v.altezza;
  const pareti = (stile: StileFacciata) => c.pareti.get(stile)!;
  const opz = (stile: StileFacciata) => (stile === 'industriale' ? { moduloU: MODULO_INDUSTRIALE, moduloV: 0, tag } : { moduloU: CAMPATA, moduloV: PIANO, tag });
  const parete = colore(ruggine ? pick(TAVOLOZZA.ruggini, r(21)) : v.parete);
  const copertura = colore(ruggine ? pick(TAVOLOZZA.tettiRuggine, r(22)) : v.copertura);

  // Corpo, con il piano terra a parte se ci sono negozi o lo zoccolo.
  const base = v.negozi || v.zoccolo ? Math.min(TERRA, h * 0.5) : 0;
  if (v.negozi) {
    pareti('vetrine').walls(b.p, 0, base, colore('#f6efe2'), { moduloU: CAMPATA, moduloV: 0, tag });
    tende(c, b, r, base - 0.4);
  } else if (v.zoccolo) {
    pareti('cieco').walls(b.p, 0, base, colore(TAVOLOZZA.zoccolo), { moduloU: CAMPATA, moduloV: 0, tag });
  }
  pareti(v.facciata).walls(b.p, base, h, parete, opz(v.facciata));
  if (v.zoccolo) c.parti.walls(allarga(b.p, 0.15), base, base + 0.35, colore(TAVOLOZZA.cornice), { tag });
  if (v.balconi) balconi(c, b, r, base, h, parete, tag, v.tipo === 'centro');

  // Tetto.
  if (v.tipo === 'chiesa') {
    chiesa(c, b, box, h, parete, copertura, v, tag);
  } else if (v.tetto === 'falde-coppi' || v.tetto === 'falde-lamiera') {
    if (v.gronda !== null) c.parti.walls(allarga(b.p, 0.25), h - 0.7, h, colore(v.gronda), { tag });
    c.tettoAFalde(box, h, v.tetto === 'falde-coppi' ? 0.5 : 0.22, copertura, parete, tag);
    if (v.lucernari) c.fileLucernari(b, box, h + box.hv * 0.11, true);
  } else {
    const terrazza = v.tetto === 'terrazza';
    if (v.cornice > 0) {
      const largo = allarga(b.p, v.cornice);
      c.parti.walls(largo, h - 0.5, h + 0.05, colore(TAVOLOZZA.cornice), { tag });
      c.tetti.flat(largo, h + 0.05, copertura, 8, tag);
      c.tetti.walls(largo, h + 0.05, h + (terrazza ? 1.0 : 0.5), colore(TAVOLOZZA.calce), { tag });
    } else {
      if (v.gronda !== null) c.parti.walls(allarga(b.p, 0.25), h - 0.7, h, colore(v.gronda), { tag });
      c.tetti.flat(b.p, h, copertura, 8, tag);
      const alto = terrazza ? 1.0 : 0.4;
      c.tetti.walls(b.p, h, h + alto, terrazza ? colore(TAVOLOZZA.calce) : parete.clone().multiplyScalar(0.92), { tag });
    }
    const quota = h + (v.cornice > 0 ? 0.05 : 0);
    c.dettagliTetto(b, box, quota, v);
    if (v.lucernari) c.fileLucernari(b, box, quota, false);
    if (v.pergolato && box.hu > 3 && box.hv > 2.5) pergolato(c.parti, box, quota, tag);
    parabole(c, b, box, quota, v.parabole);
  }
  if (v.ciminiera > 0) c.ciminiera(box.cx + 4, box.cy, h * 0.2, v.ciminiera, ruggine ? '#7a7470' : TAVOLOZZA.fasciaCiminiera);
  c.accendiContorni(false);
  return v;
}

/** Chiesa: navata con il tetto in coppi, rosone dipinto (facciata «chiesa»), campanile o cupola. */
function chiesa(c: CostruttoreEdifici, b: GeoBuilding, box: Box, h: number, parete: THREE.Color, coppi: THREE.Color, v: Variante, tag: number): void {
  c.tettoAFalde(box, h, 0.45, coppi, parete, tag);
  const ang = Math.atan2(box.uy, box.ux);
  if (v.campanile === 'campanile') {
    // Torre quadrata a un angolo della navata, con la cella campanaria più chiara e la cuspide.
    const lato = Math.max(4, Math.min(7, box.hv * 0.6));
    const x = box.cx + box.ux * (box.hu - lato / 2) - box.uy * (box.hv + lato / 2 - 0.5);
    const y = box.cy + box.uy * (box.hu - lato / 2) + box.ux * (box.hv + lato / 2 - 0.5);
    const alta = h + 12 + hash01(b.id, 931) * 8;
    c.parti.box(x, y, lato, lato, alta - 4, ang, 0, parete, tag);
    c.parti.box(x, y, lato, lato, 3.2, ang, alta - 4, colore(TAVOLOZZA.cornice), tag);
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const P = (a: number, d: number, yy: number) => new THREE.Vector3(x + ux * a - uy * d, yy, -(y + uy * a + ux * d));
    const cima = P(0, 0, alta + 4);
    const l = lato / 2;
    const k = [P(-l, -l, alta - 0.8), P(l, -l, alta - 0.8), P(l, l, alta - 0.8), P(-l, l, alta - 0.8)];
    for (let i = 0; i < 4; i++) c.parti.tri(k[i]!, k[(i + 1) % 4]!, cima, coppi, tag);
  } else {
    // Cupola: tamburo ottagonale e calotta a spicchi sopra il colmo.
    const raggio = Math.max(3, Math.min(8, box.hv * 0.7));
    const quota = h + box.hv * 0.45;
    c.parti.cylinder(box.cx, box.cy, raggio, raggio, 4, quota - 1, 8, parete, colore(TAVOLOZZA.cornice));
    c.parti.cylinder(box.cx, box.cy, raggio, raggio * 0.55, raggio * 0.6, quota + 3, 8, coppi);
    c.parti.cylinder(box.cx, box.cy, raggio * 0.55, 0, raggio * 0.5, quota + 3 + raggio * 0.6, 8, coppi);
  }
}

/** Balconi sui lati lunghi, a ogni piano: soletta, ringhiera e, su alcuni, panni stesi (geometria a parte). */
function balconi(c: CostruttoreEdifici, b: GeoBuilding, r: (s: number) => number, base: number, h: number, intonaco: THREE.Color, tag: number, piccoli: boolean): void {
  const g = c.balconi;
  const ringhiera = colore(pick(TAVOLOZZA.ringhiere, r(10)));
  const soletta = intonaco.clone().lerp(new THREE.Color('#ffffff'), 0.45);
  const piani = Math.floor((h - base) / PIANO);
  const scelti = lati(b.p)
    .filter((l) => l.len >= 7)
    .slice(0, piccoli ? 2 : 4);
  scelti.forEach((l, s) => {
    const largo = piccoli ? Math.min(3, l.len * 0.3) : Math.min(l.len * 0.62, l.len - 2.5);
    const prof = piccoli ? 0.8 : 1.3;
    const o = fuori(l.a, l.b, l.len, 0);
    const ux = Math.cos(o.ang);
    const uy = Math.sin(o.ang);
    // Punto del balcone: t lungo il lato, d verso l'esterno dal muro, quota yy.
    const P = (t: number, d: number, yy: number) => new THREE.Vector3(l.a[0] + (l.b[0] - l.a[0]) / 2 + ux * t + o.ox * d, yy, -(l.a[1] + (l.b[1] - l.a[1]) / 2 + uy * t + o.oy * d));
    const w = largo / 2;
    for (let k = 1; k < piani; k++) {
      const y = base + k * PIANO;
      // Solo le facce che si vedono: il piano e il fronte della soletta, il fronte della ringhiera.
      g.quad(P(-w, 0, y + 0.22), P(-w, prof, y + 0.22), P(w, prof, y + 0.22), P(w, 0, y + 0.22), soletta, tag);
      g.quad(P(-w, prof, y), P(w, prof, y), P(w, prof, y + 0.22), P(-w, prof, y + 0.22), soletta.clone().multiplyScalar(0.9), tag);
      g.quad(P(-w, prof, y + 0.22), P(w, prof, y + 0.22), P(w, prof, y + 1.22), P(-w, prof, y + 1.22), ringhiera, tag);
      // Contorni dei balconi: una riga sola, il bordo in alto della ringhiera.
      g.contorni = c.lineeBalconi;
      const p0 = P(-w, prof, y + 1.22);
      const p1 = P(w, prof, y + 1.22);
      g.spigolo(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      g.contorni = null;
      // Panni stesi: tre rettangoli colorati davanti alla ringhiera, su un balcone su tre.
      if (!piccoli && hash01(b.id, 950 + s * 13 + k) < 0.33) {
        for (let q = 0; q < 3; q++) {
          const t = (q - 1) * Math.min(1.1, largo / 4);
          const tinta = colore(pick(TAVOLOZZA.panni, hash01(b.id, 960 + s * 7 + k * 3 + q)));
          g.quad(P(t - 0.35, prof + 0.08, y + 0.3), P(t + 0.35, prof + 0.08, y + 0.3), P(t + 0.35, prof + 0.08, y + 1.1), P(t - 0.35, prof + 0.08, y + 1.1), tinta, tag);
        }
      }
    }
  });
}

/** Tende da sole dei negozi sui due lati più lunghi: falde inclinate a righe di colore pieno. */
function tende(c: CostruttoreEdifici, b: GeoBuilding, r: (s: number) => number, y: number): void {
  const tinta = colore(pick(TAVOLOZZA.tende, r(20)));
  for (const l of lati(b.p).slice(0, 2)) {
    if (l.len < 5) continue;
    const ux = (l.b[0] - l.a[0]) / l.len;
    const uy = (l.b[1] - l.a[1]) / l.len;
    const ox = uy;
    const oy = -ux;
    const moduli = Math.max(1, Math.floor((l.len - 1) / 4));
    const P = (t: number, d: number, yy: number) => new THREE.Vector3(l.a[0] + ux * t + ox * d, yy, -(l.a[1] + uy * t + oy * d));
    for (let m = 0; m < moduli; m++) {
      const t0 = 0.5 + (m * (l.len - 1)) / moduli + 0.3;
      const t1 = 0.5 + ((m + 1) * (l.len - 1)) / moduli - 0.3;
      const col = m % 2 === 0 ? tinta : tinta.clone().lerp(new THREE.Color('#ffffff'), 0.25);
      const a = P(t0, 1.7, y - 0.8);
      const bb = P(t1, 1.7, y - 0.8);
      c.parti.quad(P(t0, 0.05, y), P(t1, 0.05, y), bb, a, col);
      c.parti.spigolo(a.x, a.y, a.z, bb.x, bb.y, bb.z);
    }
  }
}

/** Pergolato di legno su un terrazzo. */
function pergolato(g: Geo3, box: Box, h: number, tag: number): void {
  const legno = colore('#9a6a43');
  const ang = Math.atan2(box.uy, box.ux);
  const w = Math.min(4, box.hu);
  const d = Math.min(3, box.hv);
  const cx = box.cx + box.ux * (box.hu - w / 2 - 0.4);
  const cy = box.cy + box.uy * (box.hu - w / 2 - 0.4);
  for (const [su, sv] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    const x = cx + (Math.cos(ang) * (su * w)) / 2 - (Math.sin(ang) * (sv * d)) / 2;
    const y = cy + (Math.sin(ang) * (su * w)) / 2 + (Math.cos(ang) * (sv * d)) / 2;
    g.box(x, y, 0.15, 0.15, 2.3, ang, h, legno, tag);
  }
  g.box(cx, cy, w + 0.3, d + 0.3, 0.12, ang, h + 2.3, colore('#7fae4f'), tag);
}

/** Parabole sui tetti piani: piatti bianchi inclinati verso sud. */
function parabole(c: CostruttoreEdifici, b: GeoBuilding, box: Box, h: number, quante: number): void {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < quante; i++) {
    const u = (hash01(b.id, 970 + i) - 0.5) * box.hu * 1.4;
    const w = (hash01(b.id, 980 + i) - 0.5) * box.hv * 1.4;
    const x = box.cx + box.ux * u - box.uy * w;
    const y = box.cy + box.uy * u + box.ux * w;
    q.setFromEuler(new THREE.Euler(0.9, hash01(b.id, 990 + i) * 0.6 - 0.3, 0, 'YXZ'));
    m.compose(new THREE.Vector3(x, h + 0.9, -y), q, new THREE.Vector3(1, 1, 1));
    c.parabole.push(m.clone());
  }
}
