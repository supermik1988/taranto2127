/**
 * Generatore casuale con seme. È l'unica fonte di caso ammessa in `sim` e
 * `agents` (CLAUDE.md, regola 3).
 *
 * Il contratto (state.ts) conserva solo il seme, non lo stato del generatore.
 * Per questo ogni estrazione usa un flusso derivato da seme + chiavi che la
 * identificano (per esempio turno, progetto e fase): il risultato non dipende
 * dall'ordine delle chiamate, e seme + storia bastano a rigiocare la partita.
 */

export interface Rng {
  /** Numero in [0, 1). */
  next(): number;
  /** Intero tra `min` e `max`, estremi compresi. */
  int(min: number, max: number): number;
}

/** Generatore mulberry32: 32 bit di stato, periodo 2^32, veloce e riproducibile. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new RangeError(`int(${min}, ${max}): servono due interi con min <= max`);
    }
    return min + Math.floor(next() * (max - min + 1));
  };
  return { next, int };
}

/** Mescola 32 bit (finalizzatore di murmur3). */
const mix32 = (h: number): number => {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
};

/** Seme derivato da un seme di partita e da una sequenza di chiavi. */
export function deriveSeed(seed: number, ...keys: readonly (string | number)[]): number {
  let h = mix32((seed >>> 0) ^ 0x9e3779b9);
  for (const key of keys) {
    const text = `${typeof key}:${key}`;
    for (let i = 0; i < text.length; i++) {
      h = mix32(h ^ text.charCodeAt(i)) + 0x9e3779b9;
      h >>>= 0;
    }
    h = mix32(h ^ 0x7f4a7c15);
  }
  return h;
}

/** Flusso casuale dedicato a un'estrazione precisa della partita. */
export function rngFor(seed: number, ...keys: readonly (string | number)[]): Rng {
  return createRng(deriveSeed(seed, ...keys));
}
