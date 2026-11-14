/**
 * Motivi per cui il tempo si ferma da solo: confronto puro tra lo stato prima
 * e dopo la chiusura di un anno. L'interfaccia mette in pausa e scrive perché.
 */
import { TOTAL_TURNS, epochOfTurn, type GameState, type ProjectPhase } from './state.js';

export type StopReason =
  | { kind: 'dilemma'; dilemmaId: string }
  | { kind: 'phase-end'; projectId: string; definitionId: string; from: ProjectPhase; to: ProjectPhase }
  | { kind: 'scandal'; count: number }
  | { kind: 'promise-due'; promiseId: string; status: 'open' | 'kept' | 'broken' }
  | { kind: 'epoch'; epoch: number }
  | { kind: 'deficit' }
  | { kind: 'game-over'; status: Exclude<GameState['status'], 'running'> };

export type StopKind = StopReason['kind'];

/** Tutti i motivi di fermata, nell'ordine in cui si mostrano. */
export const STOP_KINDS: readonly StopKind[] = ['game-over', 'dilemma', 'scandal', 'deficit', 'promise-due', 'epoch', 'phase-end'];

/**
 * Motivi di fermata tra `before` (prima di advanceTurn) e `after`. Vuoto se
 * l'anno è stato tranquillo e il tempo può continuare.
 */
export function stopReasons(before: GameState, after: GameState): StopReason[] {
  const reasons: StopReason[] = [];
  if (after.status !== 'running') reasons.push({ kind: 'game-over', status: after.status });
  if (after.openDilemmaId !== null) reasons.push({ kind: 'dilemma', dilemmaId: after.openDilemmaId });
  const scandals = after.moral.scandals.length - before.moral.scandals.length;
  if (scandals > 0) reasons.push({ kind: 'scandal', count: scandals });
  if (before.economy.funds.own >= 0 && after.economy.funds.own < 0) reasons.push({ kind: 'deficit' });
  for (const promise of after.promises) {
    const was = before.promises.find((p) => p.id === promise.id);
    if (was === undefined || was.status !== 'open') continue;
    const settled = promise.status !== 'open';
    const due = promise.dueByTurn > before.turn && promise.dueByTurn <= after.turn;
    if (settled || due) reasons.push({ kind: 'promise-due', promiseId: promise.id, status: promise.status });
  }
  const lastTurn = TOTAL_TURNS - 1;
  if (after.status === 'running' && epochOfTurn(Math.min(after.turn, lastTurn)) !== epochOfTurn(Math.min(before.turn, lastTurn))) {
    reasons.push({ kind: 'epoch', epoch: epochOfTurn(after.turn) });
  }
  for (const project of after.projects) {
    const was = before.projects.find((p) => p.id === project.id);
    if (was === undefined || was.phase === project.phase || project.phase === 'cancelled') continue;
    reasons.push({ kind: 'phase-end', projectId: project.id, definitionId: project.definitionId, from: was.phase, to: project.phase });
  }
  return reasons;
}
