/**
 * Controllo dell'intervallo dei dilemmi su un blocco di partite casuali, in
 * test da 25 partite: cosÃ¬ il processo di test non resta occupato a lungo
 * senza rispondere.
 */
import { expect, it } from 'vitest';
import { loadContent } from '../load.js';
import { randomGame } from './random-game.js';

const { initialContent, rules } = loadContent();
const CHUNK = 25;

/** Dilemmi arrivati nel blocco: il file di test controlla che quasi tutti arrivino almeno una volta. */
export function checkDilemmaInterval(firstSeed: number, games: number): Set<string> {
  const seen = new Set<string>();
  for (let from = firstSeed; from < firstSeed + games; from += CHUNK) {
    const to = Math.min(firstSeed + games, from + CHUNK) - 1;
    it(`semi da ${from} a ${to}: nessun dilemma torna prima dell'intervallo`, async () => {
      const early: string[] = [];
      let arrivals = 0;
      for (let seed = from; seed <= to; seed++) {
        // Una pausa tra una partita e l'altra: il processo di test resta in contatto con Vitest.
        await new Promise((resolve) => setImmediate(resolve));
        const last = new Map<string, number>();
        for (const { turn, action } of randomGame(seed, initialContent, rules).history) {
          if (action.kind !== 'answer-dilemma') continue;
          arrivals += 1;
          seen.add(action.dilemmaId);
          const before = last.get(action.dilemmaId);
          const d = rules.dilemmas[action.dilemmaId]!;
          if (before !== undefined && (!d.repeatable || turn - before < d.repeatAfterTurns!)) {
            early.push(`seme ${seed}: ${action.dilemmaId} al turno ${turn}, l'ultima volta al ${before}`);
          }
          last.set(action.dilemmaId, turn);
        }
      }
      expect(early).toEqual([]);
      expect(arrivals).toBeGreaterThan(to - from + 1);
    });
  }
  return seen;
}
