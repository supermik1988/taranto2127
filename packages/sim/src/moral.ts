/**
 * Contatore morale. Misura come si governa, mai quale futuro si sceglie
 * (CLAUDE.md, regola 5): si muove solo attraverso le cinque dimensioni
 * (verità, parola, cura, legalità, ascolto), mai per una leva di riconversione.
 */
import { MORAL_DIMENSIONS } from './init.js';
import { MORAL, clampToBounds } from './limits.js';
import { rngFor } from './rng.js';
import type { GameState, MoralDimension, PromiseCondition } from './state.js';

export class MoralError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoralError';
  }
}

/** Peso morale di un atto per dimensione: positivo verso il Blu, negativo verso il Red. */
export type MoralWeights = Partial<Record<MoralDimension, number>>;

export interface ScandalRules {
  /** Probabilità di scoperta di ogni atto nascosto, per turno, a scarto zero. */
  baseProbability: number;
  /** Quanto cresce la probabilità per ogni punto di reputazione sopra la coscienza. */
  probabilityPerGapPoint: number;
  maxProbability: number;
  /** Dopo uno scandalo la reputazione scende almeno a coscienza meno questa quantità. */
  reputationDropBelowConscience: number;
}

/** Numeri del contatore morale (CLAUDE.md, regola 4). */
export interface MoralRules {
  /** Pesi delle dimensioni nella media che dà la coscienza. */
  dimensionWeights: Record<MoralDimension, number>;
  scandal: ScandalRules;
  /** Peso sulla legalità di una fase saltata (atto nascosto, di solito negativo). */
  shortcutLegalityWeight: number;
  /** Peso sulla parola di una promessa mantenuta. */
  promiseKeptWordWeight: number;
  /** Peso sulla parola di una promessa tradita. */
  promiseBrokenWordWeight: number;
}

/** Coscienza: media pesata delle cinque dimensioni. */
export function conscienceFrom(byDimension: Record<MoralDimension, number>, weights: Record<MoralDimension, number>): number {
  let sum = 0;
  let total = 0;
  for (const dimension of MORAL_DIMENSIONS) {
    sum += byDimension[dimension] * weights[dimension];
    total += weights[dimension];
  }
  if (!(total > 0)) throw new MoralError('la somma dei pesi delle dimensioni deve essere positiva');
  return clampToBounds(sum / total, MORAL);
}

/**
 * Registra un atto. Palese: muove dimensioni, coscienza e, della stessa
 * quantità, la reputazione. Nascosto: muove dimensioni e coscienza, lascia
 * ferma la reputazione, e ogni peso negativo diventa un atto nascosto che può
 * venire scoperto. Uso interno del motore.
 */
export function recordActInPlace(
  state: GameState,
  rules: MoralRules,
  act: { sourceId: string; weights: MoralWeights; hidden: boolean },
): void {
  const { moral } = state;
  const before = moral.conscience;
  for (const dimension of MORAL_DIMENSIONS) {
    const weight = act.weights[dimension] ?? 0;
    if (!Number.isFinite(weight)) throw new MoralError(`${act.sourceId}: peso non valido su ${dimension}`);
    if (weight === 0) continue;
    moral.byDimension[dimension] = clampToBounds(moral.byDimension[dimension] + weight, MORAL);
    if (act.hidden && weight < 0) {
      moral.hiddenActs.push({ id: `${act.sourceId}:${dimension}`, turn: state.turn, dimension, weight });
    }
  }
  moral.conscience = conscienceFrom(moral.byDimension, rules.dimensionWeights);
  if (!act.hidden) moral.reputation = clampToBounds(moral.reputation + (moral.conscience - before), MORAL);
}

/** Probabilità di scoperta di ciascun atto nascosto in questo turno. */
export function scandalProbability(state: GameState, rules: MoralRules): number {
  const { baseProbability, probabilityPerGapPoint, maxProbability } = rules.scandal;
  const gap = Math.max(0, state.moral.reputation - state.moral.conscience);
  return Math.min(maxProbability, baseProbability + probabilityPerGapPoint * gap);
}

/**
 * Per ogni atto nascosto estrae se viene scoperto, con un flusso dedicato a
 * turno e atto. Gli atti scoperti escono da hiddenActs e la reputazione scende
 * sotto la coscienza. Restituisce gli atti scoperti. Uso interno del motore.
 */
export function checkScandalsInPlace(state: GameState, rules: MoralRules, turn: number): string[] {
  const { moral } = state;
  if (moral.hiddenActs.length === 0) return [];
  const probability = scandalProbability(state, rules);
  const discovered = moral.hiddenActs
    .filter((act) => rngFor(state.seed, 'scandal', turn, act.id).next() < probability)
    .map((act) => act.id);
  if (discovered.length === 0) return [];
  moral.hiddenActs = moral.hiddenActs.filter((act) => !discovered.includes(act.id));
  const ceiling = moral.conscience - rules.scandal.reputationDropBelowConscience;
  moral.reputation = clampToBounds(Math.min(moral.reputation, ceiling), MORAL);
  return discovered;
}

/** Legge una variabile numerica dello stato dal suo percorso (es. "districts.tamburi.health"). */
export function readNumber(state: GameState, path: string): number {
  let node: unknown = state;
  for (const key of path.split('.')) {
    if (key === '__proto__' || typeof node !== 'object' || node === null || !Object.hasOwn(node, key)) {
      throw new MoralError(`${path}: percorso inesistente`);
    }
    node = (node as Record<string, unknown>)[key];
  }
  if (typeof node !== 'number') throw new MoralError(`${path}: non è un numero`);
  return node;
}

export function conditionHolds(state: GameState, condition: PromiseCondition): boolean {
  const value = readNumber(state, condition.target);
  switch (condition.comparator) {
    case '>=':
      return value >= condition.value;
    case '>':
      return value > condition.value;
    case '<=':
      return value <= condition.value;
    case '<':
      return value < condition.value;
    case '==':
      return value === condition.value;
  }
}

/**
 * Le promesse con condizione in scadenza entro `turn` diventano 'kept' o
 * 'broken' e muovono la parola, in modo palese. Quelle senza condizione restano
 * 'open'. Uso interno del motore.
 */
export function settlePromisesInPlace(state: GameState, rules: MoralRules, turn: number): void {
  for (const promise of state.promises) {
    if (promise.status !== 'open' || promise.condition === undefined || promise.dueByTurn > turn) continue;
    const kept = conditionHolds(state, promise.condition);
    promise.status = kept ? 'kept' : 'broken';
    recordActInPlace(state, rules, {
      sourceId: `promise:${promise.id}`,
      weights: { word: kept ? rules.promiseKeptWordWeight : rules.promiseBrokenWordWeight },
      hidden: false,
    });
  }
}
