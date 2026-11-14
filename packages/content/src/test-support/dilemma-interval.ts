/**
 * Controllo dell'intervallo dei dilemmi su un blocco di partite casuali. Le
 * 1.000 partite chieste dal T10 sono divise in quattro file di test, così
 * Vitest le gioca in parallelo.
 */
import { expect, it } from 'vitest';
import { loadContent } from '../load.js';
import { randomGame } from './random-game.js';

const { initialContent, rules } = loadContent();

/** Dilemmi arrivati in ogni blocco: il quarto file controlla che quasi tutti arrivino almeno una volta. */
export function checkDilemmaInterval(firstSeed: number, games: number): Set<string> {
  const seen = new Set<string>();
  it(`semi da ${firstSeed} a ${firstSeed + games - 1}: nessun dilemma torna prima dell'intervallo`, () => {
    const early: string[] = [];
    let arrivals = 0;
    for (let seed = firstSeed; seed < firstSeed + games; seed++) {
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
    expect(arrivals).toBeGreaterThan(games);
  });
  return seen;
}
