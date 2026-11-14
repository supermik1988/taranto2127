/**
 * Giocatore casuale per i test: tenta azioni a caso, guidato dal generatore
 * con seme, e gioca fino alla fine della partita.
 */
import { createInitialState } from '../init.js';
import { rngFor } from '../rng.js';
import { TOTAL_TURNS, type Action, type ConversionPath, type GameState } from '../state.js';
import { ActionError, advanceTurn, applyAction, type TurnRules } from '../turn.js';
import { fakeContent } from './fake-content.js';

const PATHS: readonly ConversionPath[] = ['idle', 'green-steel', 'remediation', 'energy', 'sea-culture'];

export function randomGame(seed: number, rules: TurnRules, check: (s: GameState) => void = () => {}): GameState {
  const definitions = Object.keys(rules.projects);
  const dilemmaOptions = Object.keys(rules.dilemmas['dilemma-finto']?.options ?? {});
  let state = createInitialState(seed, fakeContent());
  check(state);
  while (state.status === 'running') {
    const rng = rngFor(seed, 'bot', state.turn);
    const pick = <T,>(xs: readonly T[]): T => xs[rng.int(0, xs.length - 1)]!;
    const attempts = rng.int(0, 5);
    for (let i = 0; i < attempts; i++) {
      const candidates: Action[] = [
        { kind: 'start-project', definitionId: pick(definitions) },
        { kind: 'convert-lot', lotId: pick(state.plantLots).id, path: pick(PATHS) },
        { kind: 'set-policy', policyId: `p${rng.int(0, 3)}`, active: rng.next() < 0.5 },
        { kind: 'answer-dilemma', dilemmaId: 'dilemma-finto', optionId: pick(dilemmaOptions) },
        { kind: 'make-promise', text: 'promessa', dueByTurn: Math.min(TOTAL_TURNS, state.turn + rng.int(1, 10)) },
      ];
      if (state.projects.length > 0) {
        candidates.push({ kind: 'cancel-project', projectId: pick(state.projects).id });
        candidates.push({ kind: 'shortcut-phase', projectId: pick(state.projects).id });
      }
      try {
        state = applyAction(state, pick(candidates), rules);
      } catch (error) {
        if (!(error instanceof ActionError)) throw error;
      }
      check(state);
    }
    state = advanceTurn(state, rules);
    check(state);
  }
  return state;
}
