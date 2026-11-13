import type { Delta, GameState } from './state.js';

export class EffectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EffectError';
  }
}

/** Radici dello stato che un effetto può toccare. Turno, seme, storia e simili no. */
const WRITABLE_ROOTS = new Set(['districts', 'labor', 'economy', 'climate', 'moral', 'council', 'plantLots']);

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

type Bounds = readonly [min: number, max: number];
const INDEX: Bounds = [0, 100];
const NON_NEGATIVE: Bounds = [0, Infinity];
const MORAL: Bounds = [-100, 100];
const FREE: Bounds = [-Infinity, Infinity];

/**
 * Intervallo ammesso per una variabile, coerente con validateState.
 * Un effetto che lo supererebbe si ferma al limite.
 */
const BOUNDS: readonly (readonly [RegExp, Bounds])[] = [
  [/^districts\.[^.]+\.population\.[^.]+$/, NON_NEGATIVE],
  [/^districts\.[^.]+\.[^.]+$/, INDEX],
  [/^labor\./, NON_NEGATIVE],
  [/^economy\.averageIncome$/, INDEX],
  [/^economy\.funds\.own$/, FREE],
  [/^economy\./, NON_NEGATIVE],
  [/^climate\.co2Emissions$/, NON_NEGATIVE],
  [/^climate\.seaLevelRiseCm$/, FREE],
  [/^climate\./, INDEX],
  [/^moral\./, MORAL],
  [/^council\.\d+\.(trustInPlayer|patience)$/, INDEX],
  [/^plantLots\.\d+\.progress$/, [0, 1]],
];

const boundsFor = (target: string): Bounds =>
  BOUNDS.find(([pattern]) => pattern.test(target))?.[1] ?? FREE;

/**
 * Applica le variazioni direttamente su `state`. Uso interno del motore, che
 * lo chiama solo su copie: all'esterno si usa `applyDeltas`.
 */
export function applyDeltasInPlace(state: GameState, deltas: readonly Delta[]): void {
  for (const { target, amount } of deltas) {
    if (!Number.isFinite(amount)) throw new EffectError(`${target}: variazione non finita (${amount})`);
    const keys = target.split('.');
    const field = keys.pop();
    if (field === undefined || !WRITABLE_ROOTS.has(keys[0] ?? field)) {
      throw new EffectError(`${target}: variabile non modificabile da un effetto`);
    }
    let node: unknown = state;
    for (const key of keys) {
      node = ownChild(node, key, target);
    }
    const current = ownChild(node, field, target);
    if (typeof current !== 'number') throw new EffectError(`${target}: non è un numero`);
    const [min, max] = boundsFor(target);
    (node as Record<string, number>)[field] = Math.min(max, Math.max(min, current + amount));
  }
}

function ownChild(node: unknown, key: string, target: string): unknown {
  if (FORBIDDEN_KEYS.has(key) || typeof node !== 'object' || node === null || !Object.hasOwn(node, key)) {
    throw new EffectError(`${target}: percorso inesistente`);
  }
  return (node as Record<string, unknown>)[key];
}

/** Restituisce un nuovo stato con le variazioni applicate. */
export function applyDeltas(state: GameState, deltas: readonly Delta[]): GameState {
  const next = structuredClone(state);
  applyDeltasInPlace(next, deltas);
  return next;
}

/** Aggiunge un effetto in scadenza al turno `dueOnTurn`. Uso interno del motore. */
export function pushEffect(state: GameState, sourceId: string, dueOnTurn: number, deltas: readonly Delta[]): void {
  // Gli effetti già applicati avevano dueOnTurn <= turno corrente, quindi
  // sorgente + scadenza + contatore resta unico per tutta la partita.
  const sameSlot = state.pendingEffects.filter((e) => e.sourceId === sourceId && e.dueOnTurn === dueOnTurn).length;
  state.pendingEffects.push({
    id: `${sourceId}@${dueOnTurn}#${sameSlot}`,
    sourceId,
    dueOnTurn,
    deltas: structuredClone([...deltas]),
  });
}

/**
 * Programma un effetto ritardato. Nessun effetto è istantaneo (CLAUDE.md,
 * regola 10): il ritardo minimo è un turno. Con ritardo N, creato al turno T,
 * l'effetto è visibile nello stato del turno T + N.
 */
export function scheduleEffect(
  state: GameState,
  effect: { sourceId: string; delayTurns: number; deltas: readonly Delta[] },
): GameState {
  if (!Number.isInteger(effect.delayTurns) || effect.delayTurns < 1) {
    throw new EffectError(`${effect.sourceId}: il ritardo deve essere un intero >= 1 (è ${effect.delayTurns})`);
  }
  const next = structuredClone(state);
  pushEffect(next, effect.sourceId, next.turn + effect.delayTurns, effect.deltas);
  return next;
}

/** Applica e rimuove gli effetti in scadenza entro `turn`, nell'ordine in cui sono stati creati. */
export function applyDueEffectsInPlace(state: GameState, turn: number): void {
  const due = state.pendingEffects.filter((e) => e.dueOnTurn <= turn);
  state.pendingEffects = state.pendingEffects.filter((e) => e.dueOnTurn > turn);
  for (const effect of due) applyDeltasInPlace(state, effect.deltas);
}
