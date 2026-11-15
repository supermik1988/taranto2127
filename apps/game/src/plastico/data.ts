/**
 * Dati geografici del plastico e regole che non disegnano nulla: appartenenza
 * degli edifici a lotti e quartieri, altezze e colori ripetibili ricavati
 * dall'identificativo OpenStreetMap della sagoma. Puro e deterministico. Si
 * carica solo insieme al plastico (il file dei dati pesa centinaia di kB).
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

/** Esagerazione verticale del plastico: gli edifici veri, su 8 km, sembrerebbero piatti. */
export const VERTICAL = 2.4;

/** Altezza in metri (prima dell'esagerazione): dai dati se c'è, altrimenti plausibile per tipo, ripetibile. */
export function buildingHeight(b: GeoBuilding): number {
  if (b.h !== undefined) return b.h;
  const r = hash01(b.id, 7);
  const area = Math.abs(polygonArea(b.p));
  switch (b.k) {
    case 'casa':
      // Ai Tamburi palazzine di quattro-sette piani; le case piccole più basse.
      return area < 120 ? 5 + r * 4 : 12 + r * 10;
    case 'industria':
      return 9 + r * 14;
    case 'pubblico':
      return 10 + r * 6;
    case 'negozi':
      return 6 + r * 6;
    case 'basso':
      return 3 + r * 2;
    default:
      return area < 100 ? 4 + r * 3 : 7 + r * 8;
  }
}

export function polygonArea(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]!;
    const [x2, y2] = poly[(i + 1) % poly.length]!;
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

/** Tavolozza del plastico: colori pieni e caldi, da modellino. Documentata in docs/GRAFICA.md. */
export const PALETTE = {
  terra: '#e8dcc0',
  mare: '#6fb1cf',
  stabilimento: '#c8b79f',
  industria: '#d5c8b2',
  verde: { parco: '#8cc46a', campo: '#a6d27a', bosco: '#5e9b4c', macchia: '#7fa860', prato: '#9ccb74', campi: '#c9d27e', cimitero: '#93b884' },
  strade: ['', '#f2c14e', '#f6d27a', '#fbf4e4', '#f7efdf'],
  ferrovie: '#8b8072',
  moli: '#c9c2b4',
  pareti: {
    casa: ['#f2e4c9', '#ecd3b0', '#f5ede1', '#e7caa7', '#ddd3c2', '#f0d9c0'],
    industria: ['#bcb6ac', '#a9a49c', '#cbc4b8'],
    pubblico: ['#f3d8a4', '#efc994'],
    negozi: ['#e9e2d5', '#e3d8c6'],
    basso: ['#d9d1c2'],
    altro: ['#e4dccd', '#d8cfbf'],
    ruggine: ['#8f7b69', '#7d6f65', '#9c8774', '#86705e'],
  },
  tetti: {
    casa: ['#c8694b', '#b65c43', '#d8d3ca', '#a9a299', '#cf7a55'],
    industria: ['#8f9ba4', '#9e9186', '#b0aba2'],
    pubblico: ['#c46a4f'],
    negozi: ['#b9b3a9'],
    basso: ['#a39a8e'],
    altro: ['#bdb4a7', '#c66f50'],
    ruggine: ['#8a4b2c', '#9c5a35', '#6f5a49', '#7d4630'],
  },
} as const;

export const pick = <T,>(list: readonly T[], r: number): T => list[Math.min(list.length - 1, Math.floor(r * list.length))]!;

/** Colori di parete e tetto di un edificio, ripetibili. */
export function buildingColors(b: GeoBuilding, rust: boolean): { wall: string; roof: string } {
  const kind = rust ? 'ruggine' : ((b.k in PALETTE.pareti ? b.k : 'altro') as keyof typeof PALETTE.pareti);
  return { wall: pick(PALETTE.pareti[kind], hash01(b.id, 1)), roof: pick(PALETTE.tetti[kind], hash01(b.id, 2)) };
}

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

