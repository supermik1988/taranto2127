/**
 * Riduce i dati grezzi di OpenStreetMap (scaricati con geo-scarica.ts) nel file
 * del plastico: packages/content/geo/plastico.json. Coordinate in metri rispetto
 * al centro della zona (x verso est, y verso nord), interi; sagome semplificate;
 * edifici minuscoli scartati; nessun nome proprio (regola 6: niente aziende reali).
 *
 *   npx tsx scripts/geo-riduci.ts <file-grezzo.json>
 *
 * Dati © OpenStreetMap contributors, licenza ODbL 1.0 (vedi docs/FONTI.md).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BBOX } from './geo-zona.js';

type LatLon = { lat: number; lon: number };
type Pt = [number, number];
interface Element {
  type: 'way' | 'relation' | 'node';
  id: number;
  tags?: Record<string, string>;
  geometry?: LatLon[];
  members?: { type: string; role: string; geometry?: LatLon[] }[];
}

const [south, west, north, east] = BBOX;
const lat0 = (south + north) / 2;
const lon0 = (west + east) / 2;
const MX = 111_320 * Math.cos((lat0 * Math.PI) / 180);
const MY = 110_540;
const project = ({ lat, lon }: LatLon): Pt => [(lon - lon0) * MX, (lat - lat0) * MY];
const HALF_W = ((east - west) * MX) / 2;
const HALF_H = ((north - south) * MY) / 2;

// ---------- Geometria ----------

/** Ritaglio di un poligono sul rettangolo della zona (Sutherland-Hodgman). */
function clipPolygon(points: Pt[]): Pt[] {
  const edges: [(p: Pt) => boolean, (a: Pt, b: Pt) => Pt][] = [
    [(p) => p[0] >= -HALF_W, (a, b) => cross(a, b, 0, -HALF_W)],
    [(p) => p[0] <= HALF_W, (a, b) => cross(a, b, 0, HALF_W)],
    [(p) => p[1] >= -HALF_H, (a, b) => cross(a, b, 1, -HALF_H)],
    [(p) => p[1] <= HALF_H, (a, b) => cross(a, b, 1, HALF_H)],
  ];
  let out = points;
  for (const [inside, intersect] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i]!;
      const prev = input[(i + input.length - 1) % input.length]!;
      if (inside(cur)) {
        if (!inside(prev)) out.push(intersect(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(intersect(prev, cur));
    }
    if (out.length === 0) return [];
  }
  return out;
}

function cross(a: Pt, b: Pt, axis: 0 | 1, value: number): Pt {
  const t = (value - a[axis]) / (b[axis] - a[axis]);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Ritaglio di una linea sul rettangolo: tiene i tratti dentro (Liang-Barsky per segmento). */
function clipLine(points: Pt[]): Pt[][] {
  const parts: Pt[][] = [];
  let current: Pt[] = [];
  for (let i = 1; i < points.length; i++) {
    const seg = clipSegment(points[i - 1]!, points[i]!);
    if (seg === null) {
      if (current.length > 1) parts.push(current);
      current = [];
      continue;
    }
    const [a, b] = seg;
    const last = current.at(-1);
    if (last === undefined || last[0] !== a[0] || last[1] !== a[1]) {
      if (current.length > 1) parts.push(current);
      current = [a];
    }
    current.push(b);
  }
  if (current.length > 1) parts.push(current);
  return parts;
}

function clipSegment(a: Pt, b: Pt): [Pt, Pt] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const checks: [number, number][] = [
    [-dx, a[0] + HALF_W],
    [dx, HALF_W - a[0]],
    [-dy, a[1] + HALF_H],
    [dy, HALF_H - a[1]],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return null;
  }
  return [
    [a[0] + dx * t0, a[1] + dy * t0],
    [a[0] + dx * t1, a[1] + dy * t1],
  ];
}

/** Semplificazione di Douglas-Peucker. */
function simplify(points: Pt[], tolerance: number): Pt[] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let index = -1;
    let max = tolerance;
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance(points[i]!, points[first]!, points[last]!);
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (index >= 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

const area = (ring: Pt[]): number => {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
};

/** Anello pulito: senza ripetizione finale, semplificato, in senso antiorario, a interi. */
function ring(points: Pt[], tolerance: number, minArea: number): Pt[] | null {
  let pts = points.slice();
  const first = pts[0];
  const last = pts.at(-1);
  if (first !== undefined && last !== undefined && first[0] === last[0] && first[1] === last[1]) pts.pop();
  pts = clipPolygon(pts);
  if (pts.length < 3) return null;
  pts = simplify([...pts, pts[0]!], tolerance).slice(0, -1);
  if (pts.length < 3) return null;
  const a = area(pts);
  if (Math.abs(a) < minArea) return null;
  if (a < 0) pts.reverse();
  const rounded = pts.map(([x, y]) => [Math.round(x), Math.round(y)] as Pt);
  return rounded.filter((p, i) => i === 0 || p[0] !== rounded[i - 1]![0] || p[1] !== rounded[i - 1]![1]);
}

/** Unisce le vie di un multipoligono in anelli chiusi, collegandole per gli estremi. */
function assembleRings(ways: Pt[][]): Pt[][] {
  const pending = ways.map((w) => w.slice());
  const rings: Pt[][] = [];
  const same = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;
  while (pending.length > 0) {
    let current = pending.shift()!;
    let grown = true;
    while (!same(current[0]!, current.at(-1)!) && grown) {
      grown = false;
      for (let i = 0; i < pending.length; i++) {
        const w = pending[i]!;
        if (same(current.at(-1)!, w[0]!)) current = [...current, ...w.slice(1)];
        else if (same(current.at(-1)!, w.at(-1)!)) current = [...current, ...w.slice(0, -1).reverse()];
        else if (same(current[0]!, w.at(-1)!)) current = [...w, ...current.slice(1)];
        else if (same(current[0]!, w[0]!)) current = [...w.slice().reverse(), ...current.slice(1)];
        else continue;
        pending.splice(i, 1);
        grown = true;
        break;
      }
    }
    if (current.length >= 4) rings.push(current);
  }
  return rings;
}

const line = (points: Pt[], tolerance: number): Pt[][] =>
  clipLine(points)
    .map((part) => simplify(part, tolerance).map(([x, y]) => [Math.round(x), Math.round(y)] as Pt))
    .filter((part) => part.length > 1);

// ---------- Classificazione ----------

const ROAD_CLASS: Record<string, number> = {
  motorway: 1,
  trunk: 1,
  motorway_link: 2,
  trunk_link: 2,
  primary: 2,
  primary_link: 2,
  secondary: 3,
  tertiary: 3,
  unclassified: 4,
  residential: 4,
};

/** Tipo di edificio ridotto a poche famiglie, per altezza e colore. */
function buildingKind(tags: Record<string, string>): string {
  const b = tags['building'] ?? 'yes';
  if (['industrial', 'warehouse', 'factory', 'hangar', 'manufacture', 'storage_tank', 'silo'].includes(b)) return 'industria';
  if (['apartments', 'residential', 'house', 'detached', 'terrace', 'semidetached_house'].includes(b)) return 'casa';
  if (['school', 'church', 'hospital', 'public', 'civic', 'government', 'university', 'kindergarten', 'chapel'].includes(b)) return 'pubblico';
  if (['commercial', 'retail', 'office', 'supermarket'].includes(b)) return 'negozi';
  if (['roof', 'shed', 'garage', 'garages', 'hut', 'carport', 'service', 'kiosk'].includes(b)) return 'basso';
  return 'altro';
}

/** Altezza dai dati, se presente: metri o piani. */
function buildingHeight(tags: Record<string, string>): number | undefined {
  const h = Number.parseFloat(tags['height'] ?? '');
  if (Number.isFinite(h) && h > 0) return Math.round(h);
  const levels = Number.parseFloat(tags['building:levels'] ?? '');
  if (Number.isFinite(levels) && levels > 0) return Math.round(levels * 3.2);
  return undefined;
}

function greenKind(tags: Record<string, string>): string | null {
  if (tags['leisure'] === 'park' || tags['leisure'] === 'garden') return 'parco';
  if (tags['leisure'] === 'pitch') return 'campo';
  if (tags['landuse'] === 'forest' || tags['natural'] === 'wood') return 'bosco';
  if (tags['natural'] === 'scrub') return 'macchia';
  if (['grass', 'meadow'].includes(tags['landuse'] ?? '')) return 'prato';
  if (['farmland', 'orchard'].includes(tags['landuse'] ?? '')) return 'campi';
  if (tags['landuse'] === 'cemetery') return 'cimitero';
  return null;
}

// ---------- Lotti e quartieri ----------

/** Posizioni stimate dei lotti e contorni dei quartieri: stanno nei dati, con stima e motivazione. */
type Annotated = { valore: [number, number][]; stima: true; motivazione: string };
const LOTS_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'packages', 'content', 'geo', 'lotti.json');
const places = JSON.parse(readFileSync(LOTS_FILE, 'utf8')) as { lotti: Record<string, Annotated>; quartieri: Record<string, Annotated> };
const toMeters = (record: Record<string, Annotated>) =>
  Object.fromEntries(Object.entries(record).map(([id, a]) => [id, a.valore.map(([lat, lon]) => project({ lat, lon }).map(Math.round) as Pt)]));

// ---------- Riduzione ----------

function main(): void {
  const input = process.argv[2];
  if (input === undefined) throw new Error('indica il file grezzo scaricato con geo-scarica.ts');
  const raw = JSON.parse(readFileSync(input, 'utf8')) as { elements: Element[] };
  const buildings: { id: number; p: Pt[]; k: string; h?: number }[] = [];
  const roads: { l: Pt[]; c: number }[] = [];
  const rails: Pt[][] = [];
  const water: Pt[][] = [];
  const greens: { p: Pt[]; k: string }[] = [];
  const piers: Pt[][] = [];
  const industry: Pt[][] = [];
  let plant: Pt[][] = [];

  const outerRings = (e: Element): Pt[][] =>
    assembleRings((e.members ?? []).filter((m) => m.role === 'outer' && m.geometry !== undefined).map((m) => m.geometry!.map(project)));

  for (const e of raw.elements) {
    const tags = e.tags ?? {};
    const geom = e.geometry?.map(project);
    if (tags['building'] !== undefined && geom !== undefined) {
      const r = ring(geom, 0.8, 12);
      if (r !== null) {
        const h = buildingHeight(tags);
        buildings.push({ id: e.id, p: r, k: buildingKind(tags), ...(h !== undefined && { h }) });
      }
    } else if (tags['highway'] !== undefined && geom !== undefined) {
      const c = ROAD_CLASS[tags['highway']];
      if (c !== undefined) for (const l of line(geom, 2.5)) roads.push({ l, c });
    } else if (tags['railway'] === 'rail' && geom !== undefined) {
      rails.push(...line(geom, 4));
    } else if (tags['natural'] === 'water' || tags['natural'] === 'bay') {
      // Il golfo esce di molto dalla zona: si ritaglia sul riquadro, come il Mar Grande.
      // Dal T11b serve: il fronte a mare dello stabilimento, a ovest, dà sul golfo.
      const rings = e.type === 'relation' ? outerRings(e) : geom !== undefined ? [geom] : [];
      for (const g of rings) {
        const r = ring(g, 3, 150);
        if (r !== null) water.push(r);
      }
    } else if (tags['man_made'] === 'pier' || tags['man_made'] === 'breakwater') {
      if (geom === undefined) continue;
      const closed = geom.length > 3 && geom[0]![0] === geom.at(-1)![0] && geom[0]![1] === geom.at(-1)![1];
      if (closed) {
        const r = ring(geom, 1.5, 30);
        if (r !== null) piers.push(r);
      } else {
        // Molo disegnato come linea: diventa una striscia larga 12 metri.
        for (const l of line(geom, 2)) piers.push(strip(l, 6));
      }
    } else if (tags['landuse'] === 'industrial') {
      const rings = e.type === 'relation' ? outerRings(e) : geom !== undefined ? [geom] : [];
      // Lo stabilimento è la sua area principale più le aree portuali dello stesso gestore (i pontili sul mare, T11b).
      // Il nome serve solo a riconoscerle: nel file del plastico non entra (regola 6).
      const owner = `${tags['name'] ?? ''} ${tags['operator'] ?? ''}`.toLowerCase();
      const isPlant = (e.type === 'relation' && e.id === 11843712) || /acciaierie d'italia|arcelormittal|\bilva\b/.test(owner);
      for (const g of rings) {
        const r = ring(g, 4, 500);
        if (r === null) continue;
        if (isPlant) plant.push(r);
        else industry.push(r);
      }
    } else {
      const k = greenKind(tags);
      if (k !== null && geom !== undefined) {
        const r = ring(geom, 2, 60);
        if (r !== null) greens.push({ p: r, k });
      }
    }
  }
  plant = plant.sort((a, b) => area(b) - area(a));

  const lots = toMeters(places.lotti);
  const districts = toMeters(places.quartieri);

  const out = {
    descrizione:
      'Plastico della zona dei Tamburi, dello stabilimento ILSIDER e del primo seno del Mar Piccolo. Coordinate in metri dal centro della zona, x verso est e y verso nord. Ridotto da OpenStreetMap con apps/game/scripts/geo-riduci.ts: sagome semplificate, edifici sotto i 12 m² scartati, nessun nome. Ogni edificio porta il suo identificativo OpenStreetMap (id), da cui il gioco ricava altezza e colori. Lotti di ILSIDER e contorni dei quartieri vengono da lotti.json, stime dichiarate.',
    attribuzione: '© OpenStreetMap contributors. Dati disponibili con licenza Open Database License (ODbL) 1.0: https://www.openstreetmap.org/copyright',
    licenza: 'ODbL-1.0',
    scaricatoIl: process.env['GEO_DATA'] ?? new Date().toISOString().slice(0, 10),
    riquadro: { sud: south, ovest: west, nord: north, est: east },
    dimensioni: { larghezza: Math.round(HALF_W * 2), altezza: Math.round(HALF_H * 2) },
    acqua: water,
    stabilimento: plant,
    industria: industry,
    verde: greens,
    moli: piers,
    strade: roads,
    ferrovie: rails,
    edifici: buildings,
    lotti: lots,
    quartieri: districts,
  };
  const target = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'packages', 'content', 'geo', 'plastico.json');
  const text = JSON.stringify(out);
  writeFileSync(target, `${text}\n`);
  console.log(
    `${target}: ${(text.length / 1e6).toFixed(2)} MB · edifici ${buildings.length} · strade ${roads.length} · acqua ${water.length} · verde ${greens.length} · moli ${piers.length} · stabilimento ${plant.length} anelli`,
  );
}

/** Striscia larga 2·half attorno a una linea, come poligono. */
function strip(points: Pt[], half: number): Pt[] {
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)]!;
    const b = points[Math.min(points.length - 1, i + 1)]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = (-(b[1] - a[1]) / len) * half;
    const ny = ((b[0] - a[0]) / len) * half;
    const p = points[i]!;
    left.push([Math.round(p[0] + nx), Math.round(p[1] + ny)]);
    right.push([Math.round(p[0] - nx), Math.round(p[1] - ny)]);
  }
  return [...left, ...right.reverse()];
}

main();
