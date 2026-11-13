import { describe, expect, it } from 'vitest';
import { createRng, deriveSeed, rngFor } from './rng.js';

const take = (seed: number, n: number): number[] => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng.next());
};

describe('generatore con seme', () => {
  it('stesso seme, stessa sequenza', () => {
    expect(take(42, 100)).toEqual(take(42, 100));
  });

  it('semi diversi, sequenze diverse', () => {
    expect(take(42, 10)).not.toEqual(take(43, 10));
  });

  it('produce numeri in [0, 1) con media vicina a 0,5', () => {
    const values = take(7, 20_000);
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.49);
    expect(mean).toBeLessThan(0.51);
  });

  it('int copre tutti gli interi tra gli estremi, compresi', () => {
    const rng = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(rng.int(2, 5));
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
    expect(rng.int(3, 3)).toBe(3);
  });

  it('int rifiuta estremi non interi o invertiti', () => {
    const rng = createRng(1);
    expect(() => rng.int(5, 2)).toThrow(RangeError);
    expect(() => rng.int(0.5, 2)).toThrow(RangeError);
  });

  it('i flussi derivati dipendono da seme e chiavi, non dall’ordine delle chiamate', () => {
    const a = rngFor(9, 'phase-duration', 'project-0-0', 'design').next();
    rngFor(9, 'altro').next();
    const b = rngFor(9, 'phase-duration', 'project-0-0', 'design').next();
    expect(a).toBe(b);
    expect(deriveSeed(9, 'x', 1)).not.toBe(deriveSeed(9, 'x', 2));
    expect(deriveSeed(9, 1)).not.toBe(deriveSeed(9, '1'));
    expect(deriveSeed(9, 'a')).not.toBe(deriveSeed(10, 'a'));
  });
});
