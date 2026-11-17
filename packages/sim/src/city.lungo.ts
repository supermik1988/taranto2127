/**
 * Prove lunghe della città che reagisce (`pnpm test:lungo`). In `city.test.ts`
 * restano le versioni brevi, sugli stessi controlli con meno casi.
 */
import { describe, expect, it } from 'vitest';
import { fakeContent } from './__fixtures__/fake-content.js';
import { activeCity, activeEconomy, fakeRules } from './__fixtures__/fake-rules.js';
import { randomGame } from './__fixtures__/random-game.js';
import { payMandatorySpending } from './economy.js';
import { createInitialState } from './init.js';
import { rngFor } from './rng.js';
import type { GameState } from './state.js';
import type { TurnRules } from './turn.js';
import { validateState } from './validate.js';

const initial = (seed = 1) => createInitialState(seed, fakeContent());
const patch = (state: GameState, change: (s: GameState) => void): GameState => {
  const next = structuredClone(state);
  change(next);
  return next;
};

describe('correzioni sui fondi, su molti casi', () => {
  it('su 5.000 combinazioni di fondo e costo nessun fondo scende sotto zero', () => {
    const rng = rngFor(7, 'prova-arrotondamenti');
    for (let i = 0; i < 5000; i++) {
      const state = patch(initial(), (s) => {
        s.economy.funds.state = Math.round(rng.next() * 100000) / 1000;
        s.labor.onWageSupport = rng.int(0, 20000);
      });
      payMandatorySpending(state, { ...activeEconomy(), wageSupportCostPerPerson: rng.int(1, 20000) / 1_000_000 });
      expect(state.economy.funds.state).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('partite complete con la città che reagisce, su più semi', { timeout: 120_000 }, () => {
  const rules = (): TurnRules => ({ ...fakeRules(), economy: activeEconomy(), city: activeCity(), dilemmaArrivalProbability: 0.4 });
  const laborForce = (s: GameState) =>
    Object.values(s.labor.employed).reduce((a, b) => a + b, 0) + s.labor.onWageSupport + s.labor.unemployed + s.labor.inTraining;

  it('stato sempre valido e forza lavoro costante in 100 turni di gioco casuale su 5 semi', () => {
    const endings = new Set<string>();
    for (const seed of [41, 42, 43, 44, 45]) {
      const force = laborForce(initial(seed));
      const final = randomGame(seed, rules(), (s) => {
        expect(validateState(s).errors).toEqual([]);
        expect(laborForce(s)).toBe(force);
      });
      expect(final.status).not.toBe('running');
      endings.add(final.status);
    }
    expect(endings.size).toBeGreaterThan(0);
  });
});
