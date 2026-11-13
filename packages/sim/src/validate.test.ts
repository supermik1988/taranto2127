import { describe, expect, it } from 'vitest';
import { fakeContent } from './__fixtures__/fake-content.js';
import { createInitialState } from './init.js';
import type { GameState } from './state.js';
import { validateState } from './validate.js';

/** Stato iniziale valido, poi modificato da `mutate` per violare una regola. */
const broken = (mutate: (s: GameState) => void): string[] => {
  const state = createInitialState(1, fakeContent());
  mutate(state);
  const result = validateState(state);
  expect(result.ok).toBe(false);
  return result.errors;
};

describe('validateState: indici tra 0 e 100', () => {
  const districtIndices = [
    'airQuality',
    'contaminatedSoil',
    'cumulativeExposure',
    'health',
    'services',
    'greenCover',
    'floodRisk',
    'trust',
    'tension',
    'belonging',
  ] as const;

  for (const field of districtIndices) {
    it(`fallisce se ${field} di un quartiere esce da 0-100`, () => {
      expect(broken((s) => (s.districts['paolo-vi'][field] = -1))).toEqual([
        expect.stringContaining(`districts.paolo-vi.${field} = -1`),
      ]);
      expect(broken((s) => (s.districts['paolo-vi'][field] = 101))).toEqual([
        expect.stringContaining(`districts.paolo-vi.${field} = 101`),
      ]);
    });
  }

  it('accetta gli estremi 0 e 100', () => {
    const state = createInitialState(1, fakeContent());
    state.districts.borgo.health = 0;
    state.districts.borgo.trust = 100;
    expect(validateState(state).ok).toBe(true);
  });

  it('fallisce se un indice non è un numero (NaN)', () => {
    expect(broken((s) => (s.districts.borgo.tension = Number.NaN))).toHaveLength(1);
  });

  it('fallisce se il reddito medio esce da 0-100', () => {
    expect(broken((s) => (s.economy.averageIncome = 101))).toEqual([
      expect.stringContaining('economy.averageIncome'),
    ]);
  });

  for (const field of ['co2Emissions', 'summerHeat', 'waterStress'] as const) {
    it(`fallisce se climate.${field} esce da 0-100`, () => {
      expect(broken((s) => (s.climate[field] = -5))).toEqual([
        expect.stringContaining(`climate.${field}`),
      ]);
    });
  }

  it("non tratta l'innalzamento del mare (centimetri) come indice", () => {
    const state = createInitialState(1, fakeContent());
    state.climate.seaLevelRiseCm = 150;
    expect(validateState(state).ok).toBe(true);
  });

  it('fallisce se fiducia o pazienza di un consigliere escono da 0-100', () => {
    expect(broken((s) => (s.council[1]!.trustInPlayer = 120))).toEqual([
      expect.stringContaining('council[1].trustInPlayer'),
    ]);
    expect(broken((s) => (s.council[0]!.patience = -1))).toEqual([
      expect.stringContaining('council[0].patience'),
    ]);
  });
});

describe('validateState: popolazioni non negative', () => {
  for (const band of ['young', 'adult', 'elder'] as const) {
    it(`fallisce se la fascia ${band} è negativa`, () => {
      expect(broken((s) => (s.districts.tamburi.population[band] = -1))).toEqual([
        expect.stringContaining(`districts.tamburi.population.${band} = -1`),
      ]);
    });
  }

  it('accetta un quartiere senza residenti', () => {
    const state = createInitialState(1, fakeContent());
    expect(state.districts['area-industriale'].population).toEqual({ young: 0, adult: 0, elder: 0 });
    expect(validateState(state).ok).toBe(true);
  });
});

describe('validateState: coscienza tra -100 e +100', () => {
  it('fallisce sotto -100', () => {
    expect(broken((s) => (s.moral.conscience = -101))).toEqual([
      expect.stringContaining('moral.conscience = -101'),
    ]);
  });

  it('fallisce sopra +100', () => {
    expect(broken((s) => (s.moral.conscience = 100.5))).toEqual([
      expect.stringContaining('moral.conscience = 100.5'),
    ]);
  });

  it('accetta gli estremi -100 e +100', () => {
    const state = createInitialState(1, fakeContent());
    state.moral.conscience = -100;
    state.moral.reputation = 100;
    expect(validateState(state).ok).toBe(true);
  });

  it('applica lo stesso intervallo alla reputazione', () => {
    expect(broken((s) => (s.moral.reputation = -150))).toEqual([
      expect.stringContaining('moral.reputation = -150'),
    ]);
  });
});

describe('validateState: completezza', () => {
  it('fallisce se manca un quartiere', () => {
    expect(
      broken((s) => {
        delete (s.districts as Partial<GameState['districts']>).borgo;
      }),
    ).toEqual([expect.stringContaining('districts.borgo: quartiere mancante')]);
  });

  it('elenca tutte le violazioni, non solo la prima', () => {
    const errors = broken((s) => {
      s.districts.tamburi.health = 200;
      s.districts.borgo.population.elder = -3;
      s.moral.conscience = 300;
    });
    expect(errors).toHaveLength(3);
  });
});
