/**
 * Prove lunghe del contatore morale (`pnpm test:lungo`). In `moral.test.ts`
 * resta la versione breve, sugli stessi controlli con meno semi.
 */
import { describe, expect, it } from 'vitest';
import { fakeContent } from './__fixtures__/fake-content.js';
import { fakeRules, withOpenDilemma } from './__fixtures__/fake-rules.js';
import { createInitialState } from './init.js';
import { advanceTurn, applyAction } from './turn.js';
import type { GameState } from './state.js';

const rules = fakeRules();
const initial = (seed = 1) => createInitialState(seed, fakeContent());
const answer = (state: GameState, optionId: string): GameState =>
  applyAction(withOpenDilemma(state), { kind: 'answer-dilemma', dilemmaId: 'dilemma-finto', optionId }, rules);

describe('scandalo, su molti semi', () => {
  it('con dieci atti nascosti lo scandalo arriva entro 20 turni in almeno il 95% di 1.000 semi', { timeout: 300_000 }, async () => {
    let withScandal = 0;
    // Una pausa ogni tanto: sotto carico Vitest deve poter parlare con il processo di prova.
    for (let seed = 0; seed < 1000; seed++) {
      if (seed % 50 === 0) await new Promise((resolve) => setImmediate(resolve));
      let state = initial(seed);
      for (let i = 0; i < 10; i++) state = answer(state, 'nascosta-legalita');
      expect(state.moral.hiddenActs).toHaveLength(10);
      for (let t = 0; t < 20; t++) {
        state = advanceTurn(state, rules);
        if (state.moral.hiddenActs.length < 10) {
          withScandal++;
          break;
        }
      }
    }
    expect(withScandal).toBeGreaterThanOrEqual(950);
  });
});
