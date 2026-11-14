import { boundsFor, clampToBounds } from './limits.js';
import { PathError, resolveContainer } from './paths.js';
import type { Delta, GameState, LaborCategory, LaborMove, Sector } from './state.js';

export class EffectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EffectError';
  }
}

/**
 * Un insieme di effetti dai dati: variazioni di variabili e spostamenti di
 * lavoro. Il lavoro non si tocca con variazioni dirette, solo con spostamenti.
 */
export interface EffectSet {
  deltas: Delta[];
  laborMoves?: LaborMove[];
}

/**
 * Radici dello stato che una variazione può toccare. Turno, seme, storia e
 * simili no. Il lavoro neppure: si muove solo con spostamenti tra categorie,
 * così la forza lavoro resta un bilancio chiuso. Il contatore morale neppure:
 * si muove solo con i pesi delle cinque dimensioni (CLAUDE.md, regola 5).
 */
const WRITABLE_ROOTS = new Set(['districts', 'economy', 'climate', 'council', 'plantLots']);


const SECTORS = Object.keys({
  steel: true,
  remediation: true,
  energy: true,
  sea: true,
  'culture-tourism': true,
  services: true,
  public: true,
} satisfies Record<Sector, true>) as readonly Sector[];

const NON_SECTOR_CATEGORIES = ['onWageSupport', 'unemployed', 'inTraining'] as const satisfies readonly LaborCategory[];

const isSector = (category: string): category is Sector => (SECTORS as readonly string[]).includes(category);
const isLaborCategory = (category: string): category is LaborCategory =>
  isSector(category) || (NON_SECTOR_CATEGORIES as readonly string[]).includes(category);

/**
 * Applica le variazioni direttamente su `state`. Uso interno del motore, che
 * lo chiama solo su copie: all'esterno si usa `applyDeltas`.
 */
export function applyDeltasInPlace(state: GameState, deltas: readonly Delta[]): void {
  for (const { target, amount } of deltas) {
    if (!Number.isFinite(amount)) throw new EffectError(`${target}: variazione non finita (${amount})`);
    const keys = target.split('.');
    const field = keys.pop();
    const root = keys[0] ?? field;
    if (root === 'labor') {
      throw new EffectError(`${target}: il lavoro si cambia solo con uno spostamento tra categorie`);
    }
    if (root === 'moral') {
      throw new EffectError(`${target}: un effetto non può toccare il contatore morale (CLAUDE.md, regola 5)`);
    }
    if (field === undefined || root === undefined || !WRITABLE_ROOTS.has(root)) {
      throw new EffectError(`${target}: variabile non modificabile da un effetto`);
    }
    let resolved: ReturnType<typeof resolveContainer>;
    try {
      resolved = resolveContainer(state, target);
    } catch (error) {
      if (error instanceof PathError) throw new EffectError(error.message);
      throw error;
    }
    const current = resolved.container[resolved.field];
    if (typeof current !== 'number') throw new EffectError(`${target}: non è un numero`);
    resolved.container[resolved.field] = clampToBounds(current + amount, boundsFor(target));
  }
}

function readCategory(state: GameState, category: LaborCategory): number {
  return isSector(category) ? state.labor.employed[category] : state.labor[category];
}

function writeCategory(state: GameState, category: LaborCategory, value: number): void {
  if (isSector(category)) state.labor.employed[category] = value;
  else state.labor[category] = value;
}

/**
 * Sposta persone tra categorie della forza lavoro, al massimo quante ce ne
 * sono nella categoria di partenza. Uso interno del motore.
 */
export function applyLaborMovesInPlace(state: GameState, moves: readonly LaborMove[]): void {
  for (const { from, to, count } of moves) {
    if (!isLaborCategory(from) || !isLaborCategory(to)) {
      throw new EffectError(`spostamento di lavoro con categoria inesistente: ${from} → ${to}`);
    }
    if (!Number.isInteger(count) || count < 0) {
      throw new EffectError(`spostamento di lavoro ${from} → ${to}: il numero deve essere un intero >= 0 (è ${count})`);
    }
    const moved = Math.min(count, readCategory(state, from));
    writeCategory(state, from, readCategory(state, from) - moved);
    writeCategory(state, to, readCategory(state, to) + moved);
  }
}

/** Applica variazioni e spostamenti di lavoro di un insieme di effetti. Uso interno del motore. */
export function applyEffectSetInPlace(state: GameState, effects: EffectSet): void {
  applyDeltasInPlace(state, effects.deltas);
  applyLaborMovesInPlace(state, effects.laborMoves ?? []);
}

/**
 * Controlla che un insieme di effetti dai dati sia applicabile allo stato,
 * provandolo su una copia. Così un errore nei dati emerge subito, non anni dopo.
 */
export function assertApplicable(state: GameState, effects: EffectSet): void {
  applyEffectSetInPlace(structuredClone(state), effects);
}

/** Restituisce un nuovo stato con le variazioni applicate. */
export function applyDeltas(state: GameState, deltas: readonly Delta[]): GameState {
  const next = structuredClone(state);
  applyDeltasInPlace(next, deltas);
  return next;
}

/** Restituisce un nuovo stato con gli spostamenti di lavoro applicati. */
export function applyLaborMoves(state: GameState, moves: readonly LaborMove[]): GameState {
  const next = structuredClone(state);
  applyLaborMovesInPlace(next, moves);
  return next;
}

/** Aggiunge un effetto in scadenza al turno `dueOnTurn`. Uso interno del motore. */
export function pushEffect(state: GameState, sourceId: string, dueOnTurn: number, effects: EffectSet): void {
  // Gli effetti già applicati avevano dueOnTurn <= turno corrente, quindi
  // sorgente + scadenza + contatore resta unico per tutta la partita.
  const sameSlot = state.pendingEffects.filter((e) => e.sourceId === sourceId && e.dueOnTurn === dueOnTurn).length;
  state.pendingEffects.push({
    id: `${sourceId}@${dueOnTurn}#${sameSlot}`,
    sourceId,
    dueOnTurn,
    deltas: structuredClone(effects.deltas),
    laborMoves: structuredClone(effects.laborMoves ?? []),
  });
}

/**
 * Programma un effetto ritardato. Nessun effetto è istantaneo (CLAUDE.md,
 * regola 10): il ritardo minimo è un turno. Con ritardo N, creato al turno T,
 * l'effetto è visibile nello stato del turno T + N.
 */
export function scheduleEffect(
  state: GameState,
  effect: { sourceId: string; delayTurns: number; deltas: readonly Delta[]; laborMoves?: readonly LaborMove[] },
): GameState {
  if (!Number.isInteger(effect.delayTurns) || effect.delayTurns < 1) {
    throw new EffectError(`${effect.sourceId}: il ritardo deve essere un intero >= 1 (è ${effect.delayTurns})`);
  }
  const effects: EffectSet = { deltas: [...effect.deltas], laborMoves: [...(effect.laborMoves ?? [])] };
  assertApplicable(state, effects);
  const next = structuredClone(state);
  pushEffect(next, effect.sourceId, next.turn + effect.delayTurns, effects);
  return next;
}

/** Applica e rimuove gli effetti in scadenza entro `turn`, nell'ordine in cui sono stati creati. */
export function applyDueEffectsInPlace(state: GameState, turn: number): void {
  const due = state.pendingEffects.filter((e) => e.dueOnTurn <= turn);
  state.pendingEffects = state.pendingEffects.filter((e) => e.dueOnTurn > turn);
  for (const effect of due) applyEffectSetInPlace(state, effect);
}

/** Variabili per cui un valore più basso è un miglioramento. */
const LOWER_IS_BETTER = new Set([
  'contaminatedSoil',
  'cumulativeExposure',
  'floodRisk',
  'tension',
  'co2Emissions',
  'summerHeat',
  'waterStress',
  'seaLevelRiseCm',
]);
const WORKLESS = new Set(['onWageSupport', 'unemployed']);

/**
 * Moltiplica per `factor` gli effetti positivi di un insieme: le variazioni che
 * migliorano la città e gli spostamenti che portano persone dalla cassa o dalla
 * disoccupazione al lavoro o alla formazione. Gli effetti negativi restano interi.
 */
export function scaleBeneficial(effects: EffectSet, factor: number): EffectSet {
  if (factor === 1) return effects;
  const field = (target: string) => target.slice(target.lastIndexOf('.') + 1);
  return {
    deltas: effects.deltas.map((d) => {
      const beneficial = LOWER_IS_BETTER.has(field(d.target)) ? d.amount < 0 : d.amount > 0;
      return beneficial ? { target: d.target, amount: d.amount * factor } : d;
    }),
    laborMoves: (effects.laborMoves ?? []).map((m) =>
      WORKLESS.has(m.from) && !WORKLESS.has(m.to) ? { ...m, count: Math.floor(m.count * factor) } : m,
    ),
  };
}
