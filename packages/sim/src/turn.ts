import { applyDueEffectsInPlace, applyDeltasInPlace, pushEffect } from './effects.js';
import { rngFor } from './rng.js';
import {
  MAX_FREE_ACTIONS_PER_TURN,
  TOTAL_TURNS,
  epochOfTurn,
  type Action,
  type ConversionPath,
  type Delta,
  type GameState,
  type Project,
  type ProjectPhase,
} from './state.js';
import { DISTRICT_IDS } from './validate.js';

// ---------- Regole del turno (dai dati, packages/content) ----------

/** Fasi che precedono l'esercizio, nell'ordine in cui si attraversano. */
export const BUILD_PHASES = ['design', 'permitting', 'tender', 'works'] as const satisfies readonly ProjectPhase[];
export type BuildPhase = (typeof BUILD_PHASES)[number];

/** Durata di una fase in turni (anni). Una fase con durata 0 viene saltata. */
export interface PhaseDuration {
  minTurns: number;
  maxTurns: number;
}

export interface ProjectDefinition {
  id: string;
  phases: Record<BuildPhase, PhaseDuration>;
  /** Variazioni applicate quando il progetto entra in esercizio, mai prima. */
  operatingEffects: Delta[];
}

export type ActivePath = Exclude<ConversionPath, 'idle'>;

/** Variazione annua del clima in un'epoca. */
export interface ClimateAnnualChange {
  seaLevelRiseCm: number;
  summerHeat: number;
  waterStress: number;
}

export interface ClimateScenario {
  id: string;
  /** Una voce per epoca (5 in tutto). */
  annualChangeByEpoch: ClimateAnnualChange[];
}

/** Numeri che il ciclo del turno legge dai dati (CLAUDE.md, regola 4). */
export interface TurnRules {
  projects: Record<string, ProjectDefinition>;
  /** Anni necessari a trasformare un lotto di ILSIDER lungo ciascuna strada. */
  lotConversionTurns: Record<ActivePath, number>;
  climateScenario: ClimateScenario;
}

// ---------- Errori ----------

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionError';
  }
}

export class TurnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TurnError';
  }
}

// ---------- Azioni ----------

/**
 * Azioni che consumano una delle azioni libere del turno. Le risposte a
 * dilemmi e proteste no: arrivano dalla città, non dall'iniziativa del giocatore.
 */
const FREE_ACTION_KINDS: ReadonlySet<Action['kind']> = new Set([
  'convert-lot',
  'start-project',
  'cancel-project',
  'set-policy',
  'negotiate',
  'make-promise',
]);

export const isFreeAction = (action: Action): boolean => FREE_ACTION_KINDS.has(action.kind);

/** Azioni libere già usate nel turno corrente. */
export const freeActionsUsed = (state: GameState): number =>
  state.history.filter((h) => h.turn === state.turn && isFreeAction(h.action)).length;

/**
 * Applica un'azione del giocatore. Funzione pura: restituisce un nuovo stato
 * e registra l'azione nella storia. Lancia `ActionError` se l'azione non è ammessa.
 */
export function applyAction(state: GameState, action: Action, rules: TurnRules): GameState {
  if (state.status !== 'running') throw new ActionError(`partita conclusa (${state.status})`);
  if (isFreeAction(action) && freeActionsUsed(state) >= MAX_FREE_ACTIONS_PER_TURN) {
    throw new ActionError(`massimo ${MAX_FREE_ACTIONS_PER_TURN} azioni libere per turno`);
  }

  const next = structuredClone(state);
  switch (action.kind) {
    case 'start-project':
      startProject(next, action, rules);
      break;
    case 'cancel-project': {
      const project = next.projects.find((p) => p.id === action.projectId);
      if (project === undefined) throw new ActionError(`progetto inesistente: ${action.projectId}`);
      if (project.phase === 'operating' || project.phase === 'cancelled') {
        throw new ActionError(`progetto ${project.id} non annullabile in fase ${project.phase}`);
      }
      project.phase = 'cancelled';
      project.turnsLeftInPhase = 0;
      break;
    }
    case 'convert-lot': {
      const lot = next.plantLots.find((l) => l.id === action.lotId);
      if (lot === undefined) throw new ActionError(`lotto inesistente: ${action.lotId}`);
      if (lot.path === action.path) throw new ActionError(`il lotto ${lot.id} è già sulla strada ${lot.path}`);
      lot.path = action.path;
      lot.progress = 0;
      break;
    }
    case 'set-policy': {
      const active = next.activePolicies.includes(action.policyId);
      if (action.active && !active) next.activePolicies.push(action.policyId);
      if (!action.active && active) next.activePolicies = next.activePolicies.filter((p) => p !== action.policyId);
      break;
    }
    case 'make-promise': {
      if (action.text.trim() === '') throw new ActionError('una promessa deve avere un testo');
      if (!Number.isInteger(action.dueByTurn) || action.dueByTurn <= next.turn || action.dueByTurn > TOTAL_TURNS) {
        throw new ActionError(`scadenza non valida: ${action.dueByTurn}`);
      }
      assertDistrict(action.toDistrict);
      next.promises.push({
        id: `promise-${next.turn}-${next.history.length}`,
        madeOnTurn: next.turn,
        dueByTurn: action.dueByTurn,
        ...(action.toDistrict !== undefined && { toDistrict: action.toDistrict }),
        ...(action.toFaction !== undefined && { toFaction: action.toFaction }),
        text: action.text,
        status: 'open',
      });
      break;
    }
    case 'negotiate':
    case 'answer-dilemma':
    case 'answer-protest':
      // Trattative, dilemmi e proteste arrivano con i task successivi: per ora
      // l'azione resta nella storia, così la partita è già rigiocabile.
      break;
  }
  next.history.push({ turn: next.turn, action: structuredClone(action) });
  return next;
}

function assertDistrict(district: string | undefined): void {
  if (district !== undefined && !(DISTRICT_IDS as readonly string[]).includes(district)) {
    throw new ActionError(`quartiere inesistente: ${district}`);
  }
}

function startProject(state: GameState, action: Extract<Action, { kind: 'start-project' }>, rules: TurnRules): void {
  const definition = Object.hasOwn(rules.projects, action.definitionId) ? rules.projects[action.definitionId] : undefined;
  if (definition === undefined) throw new ActionError(`definizione di progetto inesistente: ${action.definitionId}`);
  if (action.lotId !== undefined && !state.plantLots.some((l) => l.id === action.lotId)) {
    throw new ActionError(`lotto inesistente: ${action.lotId}`);
  }
  assertDistrict(action.district);

  const project: Project = {
    id: `project-${state.turn}-${state.history.length}`,
    definitionId: definition.id,
    ...(action.lotId !== undefined && { lotId: action.lotId }),
    ...(action.district !== undefined && { district: action.district }),
    phase: 'design',
    startedOnTurn: state.turn,
    turnsLeftInPhase: 0,
    delayTurns: 0,
    shortcutTaken: false,
  };
  state.projects.push(project);
  // Effetti di un progetto senza fasi: dal turno dopo, mai nello stesso turno.
  enterPhaseFrom(state, project, definition, 0, state.turn + 1);
}

/**
 * Porta il progetto nella prima fase con durata > 0 a partire da `index`;
 * se non ce ne sono, in esercizio, con effetti visibili al turno `effectsTurn`.
 * La durata si estrae tra minimo e massimo con un flusso dedicato a progetto e fase.
 */
function enterPhaseFrom(
  state: GameState,
  project: Project,
  definition: ProjectDefinition,
  index: number,
  effectsTurn: number,
): void {
  for (let i = index; i < BUILD_PHASES.length; i++) {
    const phase = BUILD_PHASES[i]!;
    const { minTurns, maxTurns } = definition.phases[phase];
    const turns = rngFor(state.seed, 'phase-duration', project.id, phase).int(minTurns, maxTurns);
    if (turns > 0) {
      project.phase = phase;
      project.turnsLeftInPhase = turns;
      return;
    }
  }
  project.phase = 'operating';
  project.turnsLeftInPhase = 0;
  pushEffect(state, project.id, effectsTurn, definition.operatingEffects);
}

/**
 * Allunga la fase in corso di un progetto: ricorsi, fondi fermi, proteste,
 * uffici saturi. Funzione pura.
 */
export function delayProject(state: GameState, projectId: string, turns: number): GameState {
  if (!Number.isInteger(turns) || turns < 1) throw new ActionError(`ritardo non valido: ${turns}`);
  const next = structuredClone(state);
  const project = next.projects.find((p) => p.id === projectId);
  if (project === undefined) throw new ActionError(`progetto inesistente: ${projectId}`);
  if (project.phase === 'operating' || project.phase === 'cancelled') {
    throw new ActionError(`progetto ${projectId} non ritardabile in fase ${project.phase}`);
  }
  project.turnsLeftInPhase += turns;
  project.delayTurns += turns;
  return next;
}

// ---------- Avanzamento del turno ----------

/**
 * Chiude l'anno in corso e apre il successivo. Funzione pura. In ordine:
 * fasi dei progetti, lotti di ILSIDER, clima, effetti in scadenza; poi il
 * turno avanza e al turno TOTAL_TURNS la partita termina con 'ended-2127'.
 */
export function advanceTurn(state: GameState, rules: TurnRules): GameState {
  if (state.status !== 'running') throw new TurnError(`partita conclusa (${state.status})`);
  const next = structuredClone(state);
  const closing = next.turn;
  const opening = closing + 1;

  for (const project of next.projects) advanceProject(next, project, rules, opening);
  advanceLots(next, rules);
  advanceClimate(next, rules, closing);
  applyDueEffectsInPlace(next, opening);

  next.turn = opening;
  if (opening >= TOTAL_TURNS) next.status = 'ended-2127';
  return next;
}

function advanceProject(state: GameState, project: Project, rules: TurnRules, opening: number): void {
  if (project.phase === 'operating' || project.phase === 'cancelled') return;
  const definition = Object.hasOwn(rules.projects, project.definitionId) ? rules.projects[project.definitionId] : undefined;
  if (definition === undefined) throw new TurnError(`definizione mancante per ${project.id}: ${project.definitionId}`);
  project.turnsLeftInPhase -= 1;
  if (project.turnsLeftInPhase > 0) return;
  enterPhaseFrom(state, project, definition, BUILD_PHASES.indexOf(project.phase) + 1, opening);
}

function advanceLots(state: GameState, rules: TurnRules): void {
  for (const lot of state.plantLots) {
    if (lot.path === 'idle' || lot.progress >= 1) continue;
    const turns = rules.lotConversionTurns[lot.path];
    if (!Number.isInteger(turns) || turns < 1) throw new TurnError(`durata non valida per la strada ${lot.path}: ${turns}`);
    // Conta gli anni interi già fatti: niente errori di arrotondamento su 1/3 e simili.
    const yearsDone = Math.round(lot.progress * turns) + 1;
    lot.progress = Math.min(1, yearsDone / turns);
    if (lot.progress === 1 && lot.path === 'remediation') lot.remediated = true;
  }
}

function advanceClimate(state: GameState, rules: TurnRules, closing: number): void {
  const change = rules.climateScenario.annualChangeByEpoch[epochOfTurn(closing)];
  if (change === undefined) throw new TurnError(`scenario climatico senza dati per l'epoca ${epochOfTurn(closing)}`);
  applyDeltasInPlace(state, [
    { target: 'climate.seaLevelRiseCm', amount: change.seaLevelRiseCm },
    { target: 'climate.summerHeat', amount: change.summerHeat },
    { target: 'climate.waterStress', amount: change.waterStress },
  ]);
}

// ---------- Rigiocare ----------

/**
 * Rigioca una partita da uno stato iniziale e dalla sua storia fino al turno
 * `untilTurn`. Con lo stesso seme e la stessa storia lo stato è identico.
 */
export function replay(
  initial: GameState,
  history: GameState['history'],
  rules: TurnRules,
  untilTurn: number,
): GameState {
  let state = initial;
  for (const { turn, action } of history) {
    if (turn < state.turn) throw new TurnError(`storia fuori ordine al turno ${turn}`);
    while (state.turn < turn) state = advanceTurn(state, rules);
    state = applyAction(state, action, rules);
  }
  while (state.turn < untilTurn && state.status === 'running') state = advanceTurn(state, rules);
  return state;
}
