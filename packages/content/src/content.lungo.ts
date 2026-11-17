/**
 * Prova lunga dei contenuti (`pnpm test:lungo`): partite casuali con i contenuti
 * veri su 20 semi. In `content.test.ts` resta la versione breve, su due semi
 * scelti perché uno arriva al 2127 e uno finisce in dissesto.
 */
import { createInitialState, validateState, type GameState } from '@taranto2127/sim';
import { describe, expect, it } from 'vitest';
import { loadContent } from './load.js';
import { randomGame } from './test-support/random-game.js';

const { initialContent, rules } = loadContent();
const initial = (seed = 1): GameState => createInitialState(seed, initialContent);
const laborForce = (s: GameState): number =>
  Object.values(s.labor.employed).reduce((a, b) => a + b, 0) + s.labor.onWageSupport + s.labor.unemployed + s.labor.inTraining;

describe('partite casuali con i contenuti veri, su 20 semi', { timeout: 300_000 }, () => {
  const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
  const finals = new Map<number, GameState>();

  it('100 turni di gioco casuale su 20 semi restano validi, con forza lavoro costante', async () => {
    for (const seed of seeds) {
      await new Promise((resolve) => setImmediate(resolve));
      const force = laborForce(initial(seed));
      const final = randomGame(seed, initialContent, rules, (s) => {
        expect(validateState(s).errors).toEqual([]);
        expect(laborForce(s)).toBe(force);
      });
      expect(['ended-2127', 'ended-bankrupt']).toContain(final.status);
      finals.set(seed, final);
    }
  });

  it('almeno una partita arriva al 2127 e almeno una finisce in dissesto', () => {
    const statuses = seeds.map((seed) => finals.get(seed)?.status ?? randomGame(seed, initialContent, rules).status);
    expect(statuses).toContain('ended-2127');
    expect(statuses).toContain('ended-bankrupt');
  });
});
