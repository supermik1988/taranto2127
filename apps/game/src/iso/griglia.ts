/**
 * Dati della copertura del suolo (suolo.json, T12) e griglia di occupazione della
 * zona: per ogni cella di 2 m dice se c'è già qualcosa (edificio, strada, acqua),
 * così alberi, cespugli e auto non finiscono sopra le case o in mare. I poligoni
 * si riempiono riga per riga (scansione), non punto per punto.
 */
import suoloJson from '../../../../packages/content/geo/suolo.json';
import { geo, type Pt } from '../plastico/data.js';

export interface DatiSuolo {
  attribuzione: string;
  aree: Record<'parcheggi' | 'residenziale' | 'commerciale' | 'ferroviario' | 'incolto' | 'porto' | 'servizi' | 'spiaggia' | 'scogli' | 'prato' | 'piazze' | 'sport' | 'cave', Pt[][]>;
  servizio: Pt[][];
  costa: Pt[][];
  raccordi: Pt[][];
  nastri: Pt[][];
  tubazioni: Pt[][];
  serbatoi: { p: Pt; r: number }[];
  ciminiere: { p: Pt; h?: number }[];
  torri: { p: Pt; h?: number }[];
  gru: Pt[];
}

export const datiSuolo = suoloJson as unknown as DatiSuolo;

/** Metà larghezza e metà altezza della zona, in metri. */
export const MEZZA_X = geo.dimensioni.larghezza / 2;
export const MEZZA_Y = geo.dimensioni.altezza / 2;

export const OCCUPATO = {
  edificio: 1,
  strada: 2,
  acqua: 4,
  lotto: 8,
  binari: 16,
} as const;

export class Griglia {
  readonly lato: number;
  readonly nx: number;
  readonly ny: number;
  readonly celle: Uint8Array;

  constructor(lato = 2) {
    this.lato = lato;
    this.nx = Math.ceil((MEZZA_X * 2) / lato);
    this.ny = Math.ceil((MEZZA_Y * 2) / lato);
    this.celle = new Uint8Array(this.nx * this.ny);
  }

  private i(x: number): number {
    return Math.floor((x + MEZZA_X) / this.lato);
  }

  private j(y: number): number {
    return Math.floor((y + MEZZA_Y) / this.lato);
  }

  /** Bit della cella che contiene il punto (0 fuori dalla zona). */
  get(x: number, y: number): number {
    const i = this.i(x);
    const j = this.j(y);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return 0;
    return this.celle[j * this.nx + i]!;
  }

  /** Il punto e un intorno di `margine` metri sono liberi dai bit dati. */
  libero(x: number, y: number, bit: number, margine = 0): boolean {
    if ((this.get(x, y) & bit) !== 0) return false;
    if (margine === 0) return true;
    return [
      [margine, 0],
      [-margine, 0],
      [0, margine],
      [0, -margine],
    ].every(([dx, dy]) => (this.get(x + dx!, y + dy!) & bit) === 0);
  }

  /** Riempie un poligono con un bit, riga per riga. */
  poligono(ring: Pt[], bit: number): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of ring) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const j0 = Math.max(0, this.j(minY));
    const j1 = Math.min(this.ny - 1, this.j(maxY));
    const xs: number[] = [];
    for (let j = j0; j <= j1; j++) {
      const y = -MEZZA_Y + (j + 0.5) * this.lato;
      xs.length = 0;
      for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
        const [xa, ya] = ring[a]!;
        const [xb, yb] = ring[b]!;
        if (ya > y !== yb > y) xs.push(xa + ((y - ya) * (xb - xa)) / (yb - ya));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.round((xs[k]! + MEZZA_X) / this.lato));
        const i1 = Math.min(this.nx - 1, Math.round((xs[k + 1]! + MEZZA_X) / this.lato) - 1);
        for (let i = i0; i <= i1; i++) this.celle[j * this.nx + i]! |= bit;
      }
    }
  }

  /** Segna una linea larga `larghezza` metri. */
  linea(line: Pt[], larghezza: number, bit: number): void {
    const passo = this.lato / 2;
    const r = larghezza / 2;
    for (let k = 1; k < line.length; k++) {
      const [x1, y1] = line[k - 1]!;
      const [x2, y2] = line[k]!;
      const len = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.ceil(len / passo));
      for (let s = 0; s <= steps; s++) {
        const x = x1 + ((x2 - x1) * s) / steps;
        const y = y1 + ((y2 - y1) * s) / steps;
        for (let dx = -r; dx <= r; dx += passo) {
          for (let dy = -r; dy <= r; dy += passo) {
            if (dx * dx + dy * dy > r * r) continue;
            const i = this.i(x + dx);
            const j = this.j(y + dy);
            if (i >= 0 && j >= 0 && i < this.nx && j < this.ny) this.celle[j * this.nx + i]! |= bit;
          }
        }
      }
    }
  }

  /** Quota delle celle con il bit dato, dentro un riquadro (per i test). */
  quota(bit: number): number {
    let n = 0;
    for (const c of this.celle) if ((c & bit) !== 0) n += 1;
    return n / this.celle.length;
  }
}
