/**
 * Prova lunga di dilemmi e politiche (`pnpm test:lungo`). In
 * `dilemmas-policies.test.ts` resta la versione breve, su un solo seme.
 */
import { describe, expect, it } from 'vitest';
import { fakeContent } from './__fixtures__/fake-content.js';
import { fakeRulesWithEconomy } from './__fixtures__/fake-rules.js';
import { randomGame } from './__fixtures__/random-game.js';
import { createInitialState } from './init.js';
import { TOTAL_TURNS, type GameState } from './state.js';
import type { TurnRules } from './turn.js';
import { validateState } from './validate.js';

const initial = (seed = 1) => createInitialState(seed, fakeContent());
const laborForce = (s: GameState): number =>
  Object.values(s.labor.employed).reduce((a, b) => a + b, 0) + s.labor.onWageSupport + s.labor.unemployed + s.labor.inTraining;

describe('partita completa, su più semi', { timeout: 120_000 }, () => {
  /** Economia attiva, dilemmi che arrivano un anno su due, politiche a caso. */
  const rules = (): TurnRules => ({ ...fakeRulesWithEconomy(), dilemmaArrivalProbability: 0.5 });

  it('stato sempre valido e forza lavoro costante in 100 turni di gioco casuale su 5 semi', async () => {
    let dilemmas = 0;
    let trained = 0;
    for (const seed of [31, 32, 33, 34, 35]) {
      await new Promise((resolve) => setImmediate(resolve));
      const force = laborForce(initial(seed));
      const final = randomGame(seed, rules(), (s) => {
        expect(validateState(s).errors).toEqual([]);
        expect(laborForce(s)).toBe(force);
        expect(s.labor.trained).toBeLessThanOrEqual(s.labor.unemployed);
        trained = Math.max(trained, s.labor.trained);
      });
      expect(final.status).toBe('ended-2127');
      expect(final.turn).toBe(TOTAL_TURNS);
      dilemmas += final.history.filter((h) => h.action.kind === 'answer-dilemma').length;
    }
    expect(dilemmas).toBeGreaterThan(100); // circa uno ogni due anni per partita
    expect(trained).toBeGreaterThan(0);
  });
});
