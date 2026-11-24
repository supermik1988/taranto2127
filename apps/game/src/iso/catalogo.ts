/**
 * Edifici con carattere (T12c): ogni edificio è composto da parti (corpo, piano
 * terra, balconi, coronamento, tetto) scelte in modo ripetibile
 * dall'identificativo della sagoma. Nella fase A si usano solo dentro il
 * riquadro del campione (aspetto.ts); fuori resta l'edificio di T12.
 *
 * Tipi del campione: palazzina con balconi e stenditoi (a volte con negozi e
 * tende al piano terra), casa bassa con terrazzo o tetto a falde, garage e
 * annessi, capannone con gronda colorata e lucernari, impianto, edificio
 * pubblico con cornicione, negozi con tende. Sui tetti piani: cisterne,
 * antenne e parabole. Nessun edificio reale è ricostruito: forme e colori sono
 * tipici, non copiati.
 */
import * as THREE from 'three';
import { hash01, pick, type GeoBuilding, type Pt } from '../plastico/data.js';
import { TAVOLOZZA, type Luce } from './aspetto.js';
import type { CostruttoreEdifici } from './edifici.js';
import { allarga, colore, obb, type Geo3 } from './geo3.js';
import { CAMPATA, MODULO_INDUSTRIALE, PIANO } from './texture.js';
import { variante, type TipoEdificio } from './tipi.js';

/** Altezza del piano terra dei negozi, in metri. */
const TERRA = 3.8;

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
 * Aggiunge un edificio del catalogo nuovo. `luce` dice se raccogliere i contorni
 * (variante illustrata) e se scurire il piede delle pareti e il suolo attorno
 * (ombre di contatto, variante predisegnata).
 */
export function aggiungiNuovo(c: CostruttoreEdifici, b: GeoBuilding, tipo: TipoEdificio, tag: number, luce: Luce): void {
  const box = obb(b.p);
  const v = variante(b, tipo, box.fill > 0.82 && box.hv > 2.5);
  c.conteggio[tipo] += 1;
  c.nuovi += 1;
  const r = (s: number) => hash01(b.id, 900 + s);
  const piede = luce.contatto ? { alto: 2.4, scuro: 0.58 } : undefined;
  c.accendiContorni(luce.contorni);
  const h = v.altezza;
  const pareti = (stile: Parameters<CostruttoreEdifici['pareti']['get']>[0]) => c.pareti.get(stile)!;
  const parti = c.parti;

  switch (tipo) {
    case 'palazzina':
    case 'citta-vecchia': {
      const intonaco = colore(pick(TAVOLOZZA.intonaci, r(1)));
      const negozi = v.piani >= 3 && r(2) < 0.4;
      const base = negozi ? TERRA : 0;
      if (negozi) {
        pareti('vetrine').walls(b.p, 0, TERRA, colore('#f6efe2'), { moduloU: CAMPATA, moduloV: 0, tag, piede });
        tende(c, b, r, TERRA - 0.4);
      }
      pareti('persiane').walls(b.p, base, h, intonaco, { moduloU: CAMPATA, moduloV: PIANO, tag, piede: negozi ? undefined : piede });
      balconi(parti, b, r, base, h, intonaco, tag);
      coronamento(c, b, h, colore(pick(TAVOLOZZA.terrazze, r(3))), colore(TAVOLOZZA.cornice), tag, 0.35);
      c.dettagliTetto(b, box, h + 0.05, v);
      parabole(c, b, box, h + 0.05, Math.floor(r(4) * 3));
      break;
    }
    case 'casa': {
      const intonaco = colore(pick(TAVOLOZZA.case, r(1)));
      pareti('persiane').walls(b.p, 0, h, intonaco, { moduloU: CAMPATA, moduloV: PIANO, tag, piede });
      if (v.tetto === 'falde-coppi') {
        c.tettoAFalde(box, h, 0.5, colore(pick(TAVOLOZZA.coppi, r(3))), intonaco, tag);
      } else {
        // Terrazzo: pavimento in cotto, parapetto di calce, a volte un pergolato.
        c.tetti.flat(b.p, h, colore(pick(TAVOLOZZA.terrazze, r(3))), 8, tag);
        c.tetti.walls(b.p, h, h + 1.0, colore(TAVOLOZZA.calce), { tag });
        if (r(5) < 0.35 && box.hu > 3 && box.hv > 2.5) pergolato(parti, box, h, tag);
        c.dettagliTetto(b, box, h, v);
        parabole(c, b, box, h, r(4) < 0.5 ? 1 : 0);
      }
      break;
    }
    case 'pubblico': {
      const intonaco = colore(pick(['#f0c987', '#e9a77a', '#f4dfb4'], r(1)));
      pareti('nastro').walls(b.p, 0, h, intonaco, { moduloU: CAMPATA, moduloV: PIANO, tag, piede });
      if (v.tetto === 'falde-coppi') c.tettoAFalde(box, h, 0.45, colore(pick(TAVOLOZZA.coppi, r(3))), intonaco, tag);
      else coronamento(c, b, h, colore(pick(TAVOLOZZA.terrazze, r(3))), colore(TAVOLOZZA.cornice), tag, 0.6);
      break;
    }
    case 'negozio': {
      pareti('vetrine').walls(b.p, 0, h, colore('#f8f1e4'), { moduloU: CAMPATA, moduloV: PIANO, tag, piede });
      tende(c, b, r, Math.min(h, TERRA) - 0.4);
      coronamento(c, b, h, colore(pick(TAVOLOZZA.terrazze, r(3))), colore(TAVOLOZZA.cornice), tag, 0.3);
      break;
    }
    case 'capannone': {
      const lamiera = colore(pick(TAVOLOZZA.lamiere, r(1)));
      pareti('industriale').walls(b.p, 0, h, lamiera, { moduloU: MODULO_INDUSTRIALE, moduloV: 0, tag, piede });
      // Gronda: una fascia di colore pieno sotto il tetto, legge la sagoma da lontano.
      parti.walls(allarga(b.p, 0.25), h - 0.7, h, colore(pick(['#f2efe6', '#d63a2a', '#2f6f9f', '#f0b429'], r(2))), { tag });
      const tetto = colore(pick(TAVOLOZZA.tettiLamiera, r(3)));
      if (v.tetto === 'falde-lamiera') {
        c.tettoAFalde(box, h, 0.22, tetto, lamiera, tag);
        if (v.lucernari) c.fileLucernari(b, box, h + box.hv * 0.11, true);
      } else {
        c.tetti.flat(b.p, h, tetto, 8, tag);
        if (v.lucernari) c.fileLucernari(b, box, h, false);
      }
      break;
    }
    case 'impianto': {
      const cemento = colore(pick(['#ddd5c7', '#cfc6b6', '#e6dfd2'], r(1)));
      pareti('cieco').walls(b.p, 0, h, cemento, { moduloU: CAMPATA, moduloV: PIANO, tag, piede });
      c.tetti.flat(b.p, h, cemento.clone().multiplyScalar(0.92), 8, tag);
      c.ciminiera(box.cx + 4, box.cy, h * 0.2, v.ciminiera, TAVOLOZZA.fasciaCiminiera);
      break;
    }
    case 'basso': {
      const muro = colore(pick(['#f4ecdc', '#e9dcc4', '#f1e2c7'], r(1)));
      pareti('cieco').walls(b.p, 0, h, muro, { moduloU: CAMPATA, moduloV: PIANO, tag, piede });
      c.tetti.flat(b.p, h, colore(pick(TAVOLOZZA.terrazze, r(3))), 8, tag);
      c.tetti.walls(b.p, h, h + 0.4, colore(TAVOLOZZA.calce), { tag });
      break;
    }
  }
  if (luce.contatto) ombraDiContatto(c.contatto, b.p);
  c.accendiContorni(false);
}

/** Cornicione sporgente e tetto piano con parapetto di calce. */
function coronamento(c: CostruttoreEdifici, b: GeoBuilding, h: number, terrazza: THREE.Color, cornice: THREE.Color, tag: number, sporgenza: number): void {
  const largo = allarga(b.p, sporgenza);
  c.parti.walls(largo, h - 0.5, h + 0.05, cornice, { tag });
  c.tetti.flat(largo, h + 0.05, terrazza, 8, tag);
  c.tetti.walls(largo, h + 0.05, h + 1.0, colore(TAVOLOZZA.calce), { tag });
}

/** Balconi sui lati lunghi, a ogni piano: soletta, ringhiera e, su alcuni, panni stesi. */
function balconi(g: Geo3, b: GeoBuilding, r: (s: number) => number, base: number, h: number, intonaco: THREE.Color, tag: number): void {
  const ringhiera = colore(pick(TAVOLOZZA.ringhiere, r(10)));
  const soletta = intonaco.clone().lerp(new THREE.Color('#ffffff'), 0.45);
  const piani = Math.floor((h - base) / PIANO);
  const scelti = lati(b.p)
    .filter((l) => l.len >= 7)
    .slice(0, 4);
  scelti.forEach((l, s) => {
    const largo = Math.min(l.len * 0.62, l.len - 2.5);
    const prof = 1.3;
    const o = fuori(l.a, l.b, l.len, prof / 2);
    // Contorni dei balconi: solo il bordo in alto della ringhiera (una riga per balcone), non ogni spigolo.
    const contorniBalconi = g.contorni;
    for (let k = 1; k < piani; k++) {
      const y = base + k * PIANO;
      g.contorni = null;
      g.box(o.x, o.y, largo, prof, 0.22, o.ang, y, soletta, tag);
      const rx = o.x + o.ox * (prof / 2 - 0.05);
      const ry = o.y + o.oy * (prof / 2 - 0.05);
      g.box(rx, ry, largo, 0.1, 1.0, o.ang, y + 0.22, ringhiera, tag);
      g.contorni = contorniBalconi;
      const dx = (Math.cos(o.ang) * largo) / 2;
      const dy = (Math.sin(o.ang) * largo) / 2;
      g.spigolo(rx - dx, y + 1.22, -(ry - dy), rx + dx, y + 1.22, -(ry + dy));
      // Panni stesi: tre rettangoli colorati sotto la ringhiera, su un balcone su tre.
      if (hash01(b.id, 950 + s * 13 + k) < 0.33) {
        const contorni = g.contorni;
        g.contorni = null;
        for (let p = 0; p < 3; p++) {
          const t = (p - 1) * Math.min(1.1, largo / 4);
          const cx = rx + Math.cos(o.ang) * t + o.ox * 0.12;
          const cy = ry + Math.sin(o.ang) * t + o.oy * 0.12;
          g.box(cx, cy, 0.7, 0.05, 0.8, o.ang, y + 0.05, colore(pick(TAVOLOZZA.panni, hash01(b.id, 960 + s * 7 + k * 3 + p))), tag);
        }
        g.contorni = contorni;
      }
    }
  });
}

/** Tende da sole dei negozi sui due lati più lunghi: una falda inclinata a righe di colore pieno. */
function tende(c: CostruttoreEdifici, b: GeoBuilding, r: (s: number) => number, y: number): void {
  const tinta = colore(pick(TAVOLOZZA.tende, r(20)));
  for (const l of lati(b.p).slice(0, 2)) {
    if (l.len < 5) continue;
    const ux = (l.b[0] - l.a[0]) / l.len;
    const uy = (l.b[1] - l.a[1]) / l.len;
    const ox = uy;
    const oy = -ux;
    const moduli = Math.max(1, Math.floor((l.len - 1) / 4));
    for (let m = 0; m < moduli; m++) {
      const t0 = 0.5 + (m * (l.len - 1)) / moduli + 0.3;
      const t1 = 0.5 + ((m + 1) * (l.len - 1)) / moduli - 0.3;
      const P = (t: number, d: number, yy: number) => new THREE.Vector3(l.a[0] + ux * t + ox * d, yy, -(l.a[1] + uy * t + oy * d));
      const col = m % 2 === 0 ? tinta : tinta.clone().lerp(new THREE.Color('#ffffff'), 0.25);
      c.parti.quad(P(t0, 0.05, y), P(t1, 0.05, y), P(t1, 1.7, y - 0.8), P(t0, 1.7, y - 0.8), col);
      c.parti.spigolo(P(t0, 1.7, y - 0.8).x, y - 0.8, P(t0, 1.7, y - 0.8).z, P(t1, 1.7, y - 0.8).x, y - 0.8, P(t1, 1.7, y - 0.8).z);
    }
  }
}

/** Pergolato di legno su un terrazzo. */
function pergolato(g: Geo3, box: ReturnType<typeof obb>, h: number, tag: number): void {
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
    const x = cx + Math.cos(ang) * (su * w) / 2 - Math.sin(ang) * (sv * d) / 2;
    const y = cy + Math.sin(ang) * (su * w) / 2 + Math.cos(ang) * (sv * d) / 2;
    g.box(x, y, 0.15, 0.15, 2.3, ang, h, legno, tag);
  }
  g.box(cx, cy, w + 0.3, d + 0.3, 0.12, ang, h + 2.3, colore('#7fae4f'), tag);
}

/** Parabole sui tetti piani: piatti bianchi inclinati verso sud. */
function parabole(c: CostruttoreEdifici, b: GeoBuilding, box: ReturnType<typeof obb>, h: number, quante: number): void {
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

/**
 * Ombra di contatto: una fascia di 3,5 m attorno alla sagoma, scura sul muro e
 * chiara all'esterno; si disegna moltiplicando il colore del suolo.
 */
function ombraDiContatto(g: Geo3, ring: Pt[]): void {
  const fuoriRing = allarga(ring, 3.5);
  const y = 0.345;
  const su = new THREE.Vector3(0, 1, 0);
  // Colore lineare: in uscita (sRGB) è circa 0,55, cioè il suolo scurisce del 45% contro il muro.
  const scuro = new THREE.Color(0.26, 0.26, 0.3);
  const chiaro = new THREE.Color(1, 1, 1);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const a = ring[i]!;
    const b = ring[j]!;
    const A = fuoriRing[i]!;
    const B = fuoriRing[j]!;
    g.v(a[0], y, -a[1], su, scuro);
    g.v(A[0], y, -A[1], su, chiaro);
    g.v(B[0], y, -B[1], su, chiaro);
    g.v(a[0], y, -a[1], su, scuro);
    g.v(B[0], y, -B[1], su, chiaro);
    g.v(b[0], y, -b[1], su, scuro);
  }
}
