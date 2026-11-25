/**
 * Lo stabilimento dettagliato come le case (correzione 2 della fase A): oltre ai
 * capannoni con facciata industriale e lucernari (edifici.ts), serbatoi, ciminiere,
 * nastri trasportatori e torri presi da OpenStreetMap, e rastrelliere di
 * tubazioni lungo le vie di servizio interne (stima: OpenStreetMap non le ha).
 * Tutto unito in poche geometrie; fuori dai lotti, che hanno il loro aspetto.
 */
import * as THREE from 'three';
import { geo, hash01, pick, pointInPolygon, type Pt } from '../plastico/data.js';
import type { CostruttoreEdifici } from './edifici.js';
import { TAVOLOZZA } from './aspetto.js';
import { Geo3, colore, contorniDa, meshDa } from './geo3.js';
import { Griglia, OCCUPATO, datiSuolo } from './griglia.js';
import type { Camino } from './vita.js';

const dentroLotto = (p: Pt) => Object.values(geo.lotti).some((q) => pointInPolygon(p, q));
const nelloStabilimento = (p: Pt) => geo.stabilimento.some((r) => pointInPolygon(p, r)) || geo.industria.some((r) => pointInPolygon(p, r));

export interface NumeriImpianti {
  serbatoi: number;
  ciminiere: number;
  nastri: number;
  tubazioni: number;
}

/** Lotto più vicino a un punto (dal centro): da lui dipende il fumo di una ciminiera fuori dai lotti (stima). */
function lottoVicino(p: Pt): string {
  let best = '';
  let dist = Infinity;
  for (const [id, q] of Object.entries(geo.lotti)) {
    const c = q.reduce((a, b) => [a[0] + b[0] / q.length, a[1] + b[1] / q.length] as Pt, [0, 0] as Pt);
    const d = Math.hypot(c[0] - p[0], c[1] - p[1]);
    if (d < dist) {
      dist = d;
      best = id;
    }
  }
  return best;
}

export function costruisciImpianti(
  edifici: CostruttoreEdifici,
  griglia: Griglia,
): { oggetti: THREE.Object3D[]; numeri: NumeriImpianti; camini: Camino[] } {
  const g = new Geo3();
  // Contorni come per le case (T12c): serbatoi, ciminiere, torri, nastri.
  const linee: number[] = [];
  const contorni = () => {
    g.contorni = linee;
    edifici.accendiContorni(true);
  };
  const numeri: NumeriImpianti = { serbatoi: 0, ciminiere: 0, nastri: 0, tubazioni: 0 };
  const camini: Camino[] = [];

  // Serbatoi e silos: cilindri con il tetto a cupola bassa, bianchi, grigi o arrugginiti.
  for (const { p, r } of datiSuolo.serbatoi) {
    if (dentroLotto(p) || (griglia.get(p[0], p[1]) & OCCUPATO.acqua) !== 0) continue;
    contorni();
    const seed = Math.round(p[0] * 7 + p[1] * 13);
    const raggio = Math.min(30, Math.max(3, r));
    const alto = Math.min(28, raggio * (0.9 + hash01(seed, 701) * 0.6));
    const tinta = colore(pick(TAVOLOZZA.serbatoi, hash01(seed, 702)));
    g.cylinder(p[0], p[1], raggio, raggio, alto, 0, raggio > 10 ? 20 : 12, tinta, tinta.clone().multiplyScalar(0.92));
    g.cylinder(p[0], p[1], raggio, raggio * 0.35, raggio * 0.18, alto, raggio > 10 ? 20 : 12, tinta.clone().multiplyScalar(0.95));
    // Una fascia scura e una scala.
    g.cylinder(p[0], p[1], raggio * 1.01, raggio * 1.01, 0.8, alto * 0.62, raggio > 10 ? 20 : 12, colore(hash01(seed, 703) < 0.5 ? TAVOLOZZA.fasciaCiminiera : '#2f6f9f'));
    numeri.serbatoi += 1;
  }

  // Ciminiere dei dati: altezza vera se c'è, altrimenti 60-110 m.
  for (const { p, h } of datiSuolo.ciminiere) {
    if (dentroLotto(p)) continue;
    contorni();
    const seed = Math.round(p[0] * 3 + p[1] * 5);
    const alta = h ?? 60 + hash01(seed, 711) * 50;
    edifici.ciminiera(p[0], p[1], 0, alta, hash01(seed, 712) < 0.6 ? TAVOLOZZA.fasciaCiminiera : '#7a7470');
    camini.push({ x: p[0], y: p[1], quota: alta, lotto: lottoVicino(p) });
    numeri.ciminiere += 1;
  }
  for (const { p, h } of datiSuolo.torri) {
    if (dentroLotto(p)) continue;
    contorni();
    g.box(p[0], p[1], 6, 6, h ?? 40, 0, 0, colore('#d9cbb4'));
  }

  // Nastri trasportatori: gallerie su cavalletti, a 12 m da terra.
  const nastro = colore(TAVOLOZZA.nastro);
  const cavalletto = colore(TAVOLOZZA.cavalletto);
  for (const line of datiSuolo.nastri) {
    numeri.nastri += 1;
    contorni();
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1]!;
      const b = line[i]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 1) continue;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      g.box((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, len + 1, 3.2, 2.6, ang, 11, nastro);
      for (let t = 0; t <= len; t += 22) {
        const x = a[0] + ((b[0] - a[0]) * t) / len;
        const y = a[1] + ((b[1] - a[1]) * t) / len;
        g.box(x, y, 1.2, 4, 11, ang, 0, cavalletto);
      }
    }
  }

  // Rastrelliere di tubazioni lungo una via di servizio su tre, dentro lo stabilimento.
  const tubi = TAVOLOZZA.tubi.map((c) => colore(c));
  const portale = colore('#6f7275');
  for (const line of datiSuolo.servizio) {
    const mezzo = line[Math.floor(line.length / 2)]!;
    if (!nelloStabilimento(mezzo) || dentroLotto(mezzo)) continue;
    if (hash01(Math.round(mezzo[0]), Math.round(mezzo[1]), 721) > 0.34) continue;
    numeri.tubazioni += 1;
    contorni();
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1]!;
      const b = line[i]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 10) continue;
      const nx = -(b[1] - a[1]) / len;
      const ny = (b[0] - a[0]) / len;
      const off = 6;
      const A = (p: Pt, k: number, y: number) => new THREE.Vector3(p[0] + nx * (off + k), y, -(p[1] + ny * (off + k)));
      // Tre tubi paralleli a 6 m d'altezza.
      tubi.forEach((c, k) => g.beam(A(a, k * 0.9 - 0.9, 6.4), A(b, k * 0.9 - 0.9, 6.4), 0.7, c));
      // Portali ogni 12 m.
      for (let t = 0; t <= len; t += 12) {
        const p: Pt = [a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len];
        if ((griglia.get(p[0] + nx * off, p[1] + ny * off) & OCCUPATO.edificio) !== 0) continue;
        g.beam(A(p, -1.8, 0), A(p, -1.8, 6.9), 0.35, portale);
        g.beam(A(p, 1.8, 0), A(p, 1.8, 6.9), 0.35, portale);
        g.beam(A(p, -1.8, 5.9), A(p, 1.8, 5.9), 0.3, portale);
      }
    }
  }

  g.contorni = linee;
  edifici.accendiContorni(false);
  const oggetti: THREE.Object3D[] = g.empty ? [] : [meshDa(g, new THREE.MeshLambertMaterial({ vertexColors: true }), { nome: 'impianti', proietta: true })];
  const l = contorniDa(g, '#2b2530', 'contorni-impianti');
  if (l !== null) oggetti.push(l);
  return { oggetti, numeri, camini };
}
