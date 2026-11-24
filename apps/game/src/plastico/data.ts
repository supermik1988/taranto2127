/**
 * Dati geografici della città e regole che non disegnano nulla: appartenenza
 * degli edifici a lotti e quartieri, geometria dei poligoni, caso ripetibile
 * ricavato dall'identificativo OpenStreetMap della sagoma. Puro e deterministico.
 * Si carica solo insieme alla città 3D (il file dei dati pesa centinaia di kB).
 * Altezze e colori degli edifici stanno in iso/tipi.ts (T12).
 */
import type { DistrictId } from '@taranto2127/sim';
import geoJson from '../../../../packages/content/geo/plastico.json';

export type Pt = [number, number];
export interface GeoBuilding {
  /** Identificativo OpenStreetMap della sagoma. */
  id: number;
  p: Pt[];
  k: string;
  h?: number;
}
export interface Geo {
  attribuzione: string;
  dimensioni: { larghezza: number; altezza: number };
  acqua: Pt[][];
  stabilimento: Pt[][];
  industria: Pt[][];
  verde: { p: Pt[]; k: string }[];
  moli: Pt[][];
  strade: { l: Pt[]; c: number }[];
  ferrovie: Pt[][];
  edifici: GeoBuilding[];
  lotti: Record<string, Pt[]>;
  quartieri: Record<string, Pt[]>;
}

export const geo = geoJson as unknown as Geo;

/** Quartieri presenti sul plastico; gli altri si raggiungono dall'elenco. */
export const DISTRICTS_ON_MODEL: DistrictId[] = ['tamburi', 'area-industriale', 'citta-vecchia', 'borgo'];

/** Contorno di un quartiere sul plastico: l'area industriale è lo stabilimento. */
export function districtOutline(id: DistrictId): Pt[] | undefined {
  if (id === 'area-industriale') return geo.stabilimento[0];
  return geo.quartieri[id];
}

// ---------- Geometria ----------

export function pointInPolygon([x, y]: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function centroid(poly: Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p[0];
    y += p[1];
  }
  return [x / poly.length, y / poly.length];
}

// ---------- Caso ripetibile ----------

/** Numero da 0 a 1 ricavato da interi con una funzione fissa: stesso edificio, stesso valore, a ogni avvio. */
export function hash01(...values: number[]): number {
  let h = 2166136261;
  for (const v of values) {
    h ^= Math.round(v) & 0xffffffff;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  }
  return ((h >>> 0) % 100_000) / 100_000;
}

export const hashString = (s: string): number => hash01(...[...s].map((c) => c.charCodeAt(0)));

// ---------- Edifici ----------

export function polygonArea(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]!;
    const [x2, y2] = poly[(i + 1) % poly.length]!;
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

export const pick = <T,>(list: readonly T[], r: number): T => list[Math.min(list.length - 1, Math.floor(r * list.length))]!;

/** A quale lotto appartiene un edificio, se cade dentro uno. */
export function lotOf(b: GeoBuilding): string | undefined {
  const c = centroid(b.p);
  return Object.keys(geo.lotti).find((id) => pointInPolygon(c, geo.lotti[id]!));
}

/** A quale quartiere del plastico appartiene un punto, se a uno. */
export function districtAt(point: Pt): DistrictId | undefined {
  return DISTRICTS_ON_MODEL.find((id) => {
    const outline = districtOutline(id);
    return outline !== undefined && pointInPolygon(point, outline);
  });
}

