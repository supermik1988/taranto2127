/**
 * T12, fase B: livelli di dettaglio. Il gioco misura il tempo di ogni immagine e
 * scende di livello da solo quando il 95° percentile supera il budget; al livello
 * basso, sotto le 20 immagini al secondo, torna la mappa schematica.
 */
import { describe, expect, it } from 'vitest';
import { BUDGET_MS, FINESTRA, IMPOSTAZIONI, LIVELLI, RISCALDAMENTO, Regolatore, percentile95, type Evento } from './livelli.js';

/** Fa girare il regolatore per n immagini lunghe `ms` ciascuna; restituisce gli eventi. */
function gira(r: Regolatore, ms: number, n: number): Exclude<Evento, null>[] {
  const out: Exclude<Evento, null>[] = [];
  for (let i = 0; i < n; i++) {
    const e = r.registra(ms);
    if (e !== null) out.push(e);
  }
  return out;
}

describe('livelli di dettaglio', () => {
  it('tre livelli, dal più ricco al più leggero', () => {
    expect(LIVELLI).toEqual(['alto', 'medio', 'basso']);
    expect(IMPOSTAZIONI.alto.pixel).toBeGreaterThan(IMPOSTAZIONI.medio.pixel);
    expect(IMPOSTAZIONI.medio.pixel).toBeGreaterThan(IMPOSTAZIONI.basso.pixel);
    expect(IMPOSTAZIONI.alto.ombre && IMPOSTAZIONI.medio.ombre && !IMPOSTAZIONI.basso.ombre).toBe(true);
    expect(IMPOSTAZIONI.alto.pixel).toBeLessThanOrEqual(1.5); // densità di pixel limitata
  });

  it('con immagini nel budget resta al livello alto', () => {
    const r = new Regolatore();
    expect(gira(r, 16.7, 2000)).toEqual([]);
    expect(r.livello).toBe('alto');
    expect(r.ultima?.p95).toBeCloseTo(16.7, 6);
  });

  it('quando il 95° percentile supera il budget scende da solo, un livello alla volta', () => {
    const r = new Regolatore();
    // Nove immagini su dieci veloci, una lenta: il 95° percentile è quella lenta.
    const eventi: Exclude<Evento, null>[] = [];
    for (let i = 0; i < RISCALDAMENTO + FINESTRA; i++) {
      const e = r.registra(i % 10 === 0 ? BUDGET_MS + 10 : 12);
      if (e !== null) eventi.push(e);
    }
    expect(eventi).toEqual([{ tipo: 'livello', livello: 'medio', motivo: expect.stringContaining('95° percentile') }]);
    expect(r.livello).toBe('medio');
    // Lento anche al medio: scende al basso.
    expect(gira(r, BUDGET_MS + 5, RISCALDAMENTO + FINESTRA)).toEqual([{ tipo: 'livello', livello: 'basso', motivo: expect.any(String) }]);
    expect(r.livello).toBe('basso');
  });

  it('al livello basso, sotto le 20 immagini al secondo, chiede la mappa schematica', () => {
    const r = new Regolatore('basso');
    expect(gira(r, 40, RISCALDAMENTO + FINESTRA)).toEqual([]); // 25 immagini al secondo: lento ma ancora sopra la soglia
    const eventi = gira(r, 60, FINESTRA);
    expect(eventi).toEqual([{ tipo: 'riserva', motivo: expect.stringContaining('17 immagini al secondo') }]);
  });

  it('un dispositivo molto lento arriva alla mappa schematica partendo dall\'alto', () => {
    const r = new Regolatore();
    const eventi = gira(r, 80, 3 * (RISCALDAMENTO + FINESTRA));
    expect(eventi.map((e) => (e.tipo === 'livello' ? e.livello : 'riserva'))).toEqual(['medio', 'basso', 'riserva']);
  });

  it('scelto a mano, il livello non cambia da solo; le pause lunghe non contano', () => {
    const r = new Regolatore('medio');
    expect(gira(r, BUDGET_MS + 20, 3 * FINESTRA)).toEqual([]);
    expect(r.livello).toBe('medio');
    r.scegli('auto');
    expect(r.livello).toBe('alto');
    expect(gira(r, 5000, 500)).toEqual([]); // scheda nascosta
    expect(percentile95([5, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20])).toBe(20);
  });
});
