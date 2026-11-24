/**
 * Funzioni comuni agli script dei dati geografici: proiezione in metri dal centro
 * della zona, ritaglio sul riquadro, semplificazione, anelli puliti, strisce.
 */
import { BBOX } from './geo-zona.js';

export type LatLon = { lat: number; lon: number };
export type Pt = [number, number];
export interface Element {
  type: 'way' | 'relation' | 'node';
  id: number;
  tags?: Record<string, string>;
  geometry?: LatLon[];
  members?: { type: string; role: string; geometry?: LatLon[] }[];
}

export const [south, west, north, east] = BBOX;
export const lat0 = (south + north) / 2;
export const lon0 = (west + east) / 2;
const MX = 111_320 * Math.cos((lat0 * Math.PI) / 180);
const MY = 110_540;
export const project = ({ lat, lon }: LatLon): Pt => [(lon - lon0) * MX, (lat - lat0) * MY];
export const HALF_W = ((east - west) * MX) / 2;
export const HALF_H = ((north - south) * MY) / 2;

// ---------- Geometria ----------

/** Ritaglio di un poligono sul rettangolo della zona (Sutherland-Hodgman). */
export function clipPolygon(points: Pt[]): Pt[] {
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
export function clipLine(points: Pt[]): Pt[][] {
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
export function simplify(points: Pt[], tolerance: number): Pt[] {
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

export const area = (ring: Pt[]): number => {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
};

/** Anello pulito: senza ripetizione finale, semplificato, in senso antiorario, a interi. */
export function ring(points: Pt[], tolerance: number, minArea: number): Pt[] | null {
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
export function assembleRings(ways: Pt[][]): Pt[][] {
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

export const line = (points: Pt[], tolerance: number): Pt[][] =>
  clipLine(points)
    .map((part) => simplify(part, tolerance).map(([x, y]) => [Math.round(x), Math.round(y)] as Pt))
    .filter((part) => part.length > 1);

/** Striscia larga 2·half attorno a una linea, come poligono. */
export function strip(points: Pt[], half: number): Pt[] {
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

