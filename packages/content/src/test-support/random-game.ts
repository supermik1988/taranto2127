/**
 * Giocatore casuale per i test dei contenuti: tenta azioni a caso, guidato dal
 * generatore con seme del motore, risponde a caso ai dilemmi e gioca fino alla
 * fine della partita. Non fa parte del gioco.
 */
import {
  ActionError,
  TOTAL_TURNS,
  advanceTurn,
  applyAction,
  createInitialState,
  rngFor,
  type Action,
  type ConversionPath,
  type GameState,
  type InitialContent,
  type TurnRules,
} from '@taranto2127/sim';

const PATHS: readonly ConversionPath[] = ['idle', 'green-steel', 'remediation', 'energy', 'sea-culture'];

export function randomGame(
  seed: number,
  content: InitialContent,
  rules: TurnRules,
  check: (s: GameState) => void = () => {},
): GameState {
  const definitions = Object.keys(rules.projects);
  const policies = Object.keys(rules.policies);
  let state = createInitialState(seed, content);
  check(state);
  while (state.status === 'running') {
    const rng = rngFor(seed, 'bot', state.turn);
    const pick = <T,>(xs: readonly T[]): T => xs[rng.int(0, xs.length - 1)]!;
    const attempts = rng.int(0, 4);
    for (let i = 0; i < attempts; i++) {
      const candidates: Action[] = [
        { kind: 'start-project', definitionId: pick(definitions) },
        { kind: 'convert-lot', lotId: pick(state.plantLots).id, path: pick(PATHS) },
        { kind: 'set-policy', policyId: pick(policies), active: rng.next() < 0.6 },
        { kind: 'make-promise', text: 'Una promessa', dueByTurn: Math.min(TOTAL_TURNS, state.turn + rng.int(1, 10)) },
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
    const open = state.openDilemmaId;
    if (open !== null) {
      const options = Object.keys(rules.dilemmas[open]!.options);
      state = applyAction(state, { kind: 'answer-dilemma', dilemmaId: open, optionId: pick(options) }, rules);
      check(state);
    }
    state = advanceTurn(state, rules);
    check(state);
  }
  return state;
}
