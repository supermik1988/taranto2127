import { describe, expect, it } from 'vitest';
import { TOTAL_EPOCHS, TOTAL_TURNS, epochOfTurn, yearOfTurn } from './index.js';

describe('contratto dello stato: tempo', () => {
  it('copre cento anni in cinque epoche', () => {
    expect(TOTAL_TURNS).toBe(100);
    expect(TOTAL_EPOCHS).toBe(5);
  });

  it('il turno 0 è il 2027 e il turno 100 è il 2127', () => {
    expect(yearOfTurn(0)).toBe(2027);
    expect(yearOfTurn(TOTAL_TURNS)).toBe(2127);
  });

  it("l'ultimo turno giocato cade nell'ultima epoca", () => {
    expect(epochOfTurn(0)).toBe(0);
    expect(epochOfTurn(TOTAL_TURNS - 1)).toBe(TOTAL_EPOCHS - 1);
  });
});

describe('API del pacchetto', () => {
  it('esporta stato iniziale e validazione', async () => {
    const api = await import('./index.js');
    expect(typeof api.createInitialState).toBe('function');
    expect(typeof api.validateState).toBe('function');
    expect(api.DISTRICT_IDS).toHaveLength(6);
  });
});
