import {
  applyDeltasInPlace,
  applyDueEffectsInPlace,
  applyEffectSetInPlace,
  assertApplicable,
  EffectError,
  pushEffect,
  type EffectSet,
} from './effects.js';
import { rngFor } from './rng.js';
import {
  MAX_FREE_ACTIONS_PER_TURN,
  TOTAL_TURNS,
  epochOfTurn,
  yearOfTurn,
  type Action,
  type ConversionPath,
  type DistrictId,
  type FundKind,
  type GameState,
  type PlantLot,
  type Project,
  type ProjectPhase,
  type Sector,
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

/** Una fase nei dati: durata e costo di ogni anno passato in quella fase. */
export interface PhaseSpec extends PhaseDuration {
  /** Milioni di euro per ogni anno di avanzamento. */
  annualCost: number;
  /** Fondo da cui si paga. */
  fund: FundKind;
}

export interface ProjectDefinition {
  id: string;
  phases: Record<BuildPhase, PhaseSpec>;
  /**
   * Posti di cantiere nella fase 'works'. Si coprono prima con i cassa
   * integrati, poi con i disoccupati; il resto arriva da fuori città.
   */
  worksJobs: { sector: Sector; count: number };
  /** Effetti di esercizio: mai prima dell'entrata in esercizio. */
  operatingEffects: {
    /** Una volta sola, nel turno in cui il progetto entra in esercizio. */
    once: EffectSet;
    /** Ogni anno successivo, finché il progetto resta in esercizio. */
    everyYear: EffectSet;
  };
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

/** Rata di fondi europei nei dati. */
export interface EuTrancheSpec {
  id: string;
  /** Milioni. */
  amount: number;
  /** Anno in cui la rata arriva nel fondo vincolato. */
  arrivesInYear: number;
  /** Ultimo anno utile per spenderla: a fine anno la parte non spesa va persa. */
  expiresInYear: number;
}

/** Entrate e spese obbligate di ogni anno. Importi in milioni di euro. */
export interface EconomyRules {
  /** Entrate proprie per occupato locale all'anno, con reddito medio 100 (scala in proporzione). */
  ownRevenuePerWorker: number;
  /** Trasferimenti statali annui. */
  stateTransferPerYear: number;
  euTranches: EuTrancheSpec[];
  /** Costo annuo di un cassa integrato, a carico del fondo statale. */
  wageSupportCostPerPerson: number;
  /** Costo annuo dei servizi, a carico dei fondi propri: può portarli in disavanzo. */
  servicesCostPerYear: number;
  /** Anni consecutivi di disavanzo dei fondi propri che portano al dissesto. */
  bankruptcyAfterDeficitYears: number;
}

/** Numeri che il ciclo del turno legge dai dati (CLAUDE.md, regola 4). */
export interface TurnRules {
  projects: Record<string, ProjectDefinition>;
  economy: EconomyRules;
  /** Per ogni strada di riconversione, la definizione del progetto che trasforma un lotto. */
  lotConversion: Record<ActivePath, string>;
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
    case 'start-project': {
      if (action.lotId !== undefined && !next.plantLots.some((l) => l.id === action.lotId)) {
        throw new ActionError(`lotto inesistente: ${action.lotId}`);
      }
      assertDistrict(action.district);
      startProject(next, definitionOrThrow(rules, action.definitionId, ActionError), action);
      break;
    }
    case 'cancel-project': {
      const project = next.projects.find((p) => p.id === action.projectId);
      if (project === undefined) throw new ActionError(`progetto inesistente: ${action.projectId}`);
      if (project.phase === 'operating' || project.phase === 'cancelled') {
        throw new ActionError(`progetto ${project.id} non annullabile in fase ${project.phase}`);
      }
      cancelProject(next, project, rules);
      break;
    }
    case 'convert-lot':
      convertLot(next, action, rules);
      break;
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

function definitionOrThrow(
  rules: TurnRules,
  definitionId: string,
  ErrorType: new (message: string) => Error,
): ProjectDefinition {
  const definition = Object.hasOwn(rules.projects, definitionId) ? rules.projects[definitionId] : undefined;
  if (definition === undefined) throw new ErrorType(`definizione di progetto inesistente: ${definitionId}`);
  return definition;
}

/**
 * Cambia la strada di un lotto. Annulla ogni progetto ancora attivo sul lotto
 * (anche uno già in esercizio: la sua attività cessa) e, se la nuova strada
 * non è 'idle', avvia il progetto di trasformazione previsto dai dati.
 */
function convertLot(state: GameState, action: Extract<Action, { kind: 'convert-lot' }>, rules: TurnRules): void {
  const lot = state.plantLots.find((l) => l.id === action.lotId);
  if (lot === undefined) throw new ActionError(`lotto inesistente: ${action.lotId}`);
  if (lot.path === action.path) throw new ActionError(`il lotto ${lot.id} è già sulla strada ${lot.path}`);
  const definition =
    action.path === 'idle' ? undefined : definitionOrThrow(rules, rules.lotConversion[action.path], ActionError);

  for (const project of state.projects) {
    if (project.lotId === lot.id && project.phase !== 'cancelled') cancelProject(state, project, rules);
  }
  lot.path = action.path;
  lot.progress = 0;
  if (definition !== undefined) startProject(state, definition, { lotId: lot.id });
}

function startProject(
  state: GameState,
  definition: ProjectDefinition,
  where: { lotId?: string; district?: DistrictId },
): void {
  // Un errore negli effetti dei dati emerge all'avvio, non anni dopo all'entrata in esercizio.
  for (const effects of [definition.operatingEffects.once, definition.operatingEffects.everyYear]) {
    try {
      assertApplicable(state, effects);
    } catch (error) {
      if (error instanceof EffectError) throw new ActionError(`${definition.id}: ${error.message}`);
      throw error;
    }
  }
  const project: Project = {
    id: `project-${state.turn}-${state.history.length}`,
    definitionId: definition.id,
    ...(where.lotId !== undefined && { lotId: where.lotId }),
    ...(where.district !== undefined && { district: where.district }),
    phase: 'design',
    startedOnTurn: state.turn,
    turnsLeftInPhase: 0,
    delayTurns: 0,
    shortcutTaken: false,
    localHires: 0,
    worksStalled: false,
    outsideHires: 0,
  };
  state.projects.push(project);
  // Se tutte le fasi durano 0, gli effetti arrivano dal turno dopo, mai nello stesso.
  enterPhaseFrom(state, project, definition, 0, state.turn + 1);
}

/** Durata prevista di una fase: estratta con un flusso dedicato a progetto e fase, quindi stabile. */
function plannedTurns(state: GameState, project: Project, definition: ProjectDefinition, phase: BuildPhase): number {
  const { minTurns, maxTurns } = definition.phases[phase];
  return rngFor(state.seed, 'phase-duration', project.id, phase).int(minTurns, maxTurns);
}

/** Anni di lavoro che mancano all'esercizio: fase in corso più le fasi successive previste. */
function remainingTurns(state: GameState, project: Project, definition: ProjectDefinition): number {
  if (project.phase === 'operating') return 0;
  const index = BUILD_PHASES.indexOf(project.phase as BuildPhase);
  let turns = project.turnsLeftInPhase;
  for (const phase of BUILD_PHASES.slice(index + 1)) turns += plannedTurns(state, project, definition, phase);
  return turns;
}

/**
 * Porta il progetto nella prima fase con durata > 0 a partire da `index`;
 * se non ce ne sono, in esercizio, con gli effetti "una volta" visibili al
 * turno `effectsTurn`. Entrando in 'works' aggiunge gli occupati di cantiere.
 */
function enterPhaseFrom(
  state: GameState,
  project: Project,
  definition: ProjectDefinition,
  index: number,
  effectsTurn: number,
): void {
  for (const phase of BUILD_PHASES.slice(index)) {
    const turns = plannedTurns(state, project, definition, phase);
    if (turns > 0) {
      project.phase = phase;
      project.turnsLeftInPhase = turns;
      if (phase === 'works') startWorks(state, project, definition);
      return;
    }
  }
  project.phase = 'operating';
  project.turnsLeftInPhase = 0;
  pushEffect(state, project.id, effectsTurn, definition.operatingEffects.once);
}

// ---------- Lavoro di cantiere (bilancio chiuso) ----------

/** Assume fino a `need` persone: prima dalla cassa integrazione, poi dai disoccupati. */
function hireLocal(state: GameState, need: number): number {
  const fromWageSupport = Math.min(state.labor.onWageSupport, need);
  state.labor.onWageSupport -= fromWageSupport;
  const fromUnemployed = Math.min(state.labor.unemployed, need - fromWageSupport);
  state.labor.unemployed -= fromUnemployed;
  return fromWageSupport + fromUnemployed;
}

/** Apre il cantiere: i posti non coperti in città vanno a lavoratori di fuori, che non contano. */
function startWorks(state: GameState, project: Project, definition: ProjectDefinition): void {
  const { sector, count } = definition.worksJobs;
  project.localHires = hireLocal(state, count);
  project.outsideHires = count - project.localHires;
  project.worksStalled = false;
  state.labor.employed[sector] += project.localHires;
}

/** Cantiere fermo: gli assunti locali passano in cassa integrazione. */
function stallWorks(state: GameState, project: Project, definition: ProjectDefinition): void {
  if (project.worksStalled) return;
  const { sector } = definition.worksJobs;
  const moved = Math.min(state.labor.employed[sector], project.localHires);
  state.labor.employed[sector] -= moved;
  state.labor.onWageSupport += moved;
  project.localHires = moved;
  project.worksStalled = true;
}

/** Il cantiere riparte: riassume i suoi, prima dalla cassa, poi dai disoccupati. */
function resumeWorks(state: GameState, project: Project, definition: ProjectDefinition): void {
  if (!project.worksStalled) return;
  const { sector } = definition.worksJobs;
  project.localHires = hireLocal(state, project.localHires);
  project.worksStalled = false;
  state.labor.employed[sector] += project.localHires;
}

/** Fine lavori o annullamento: gli assunti locali tornano disoccupati. */
function releaseWorks(state: GameState, project: Project, definition: ProjectDefinition): void {
  const { sector } = definition.worksJobs;
  if (project.worksStalled) {
    const moved = Math.min(state.labor.onWageSupport, project.localHires);
    state.labor.onWageSupport -= moved;
    state.labor.unemployed += moved;
  } else {
    const moved = Math.min(state.labor.employed[sector], project.localHires);
    state.labor.employed[sector] -= moved;
    state.labor.unemployed += moved;
  }
  project.localHires = 0;
  project.outsideHires = 0;
  project.worksStalled = false;
}

function cancelProject(state: GameState, project: Project, rules: TurnRules): void {
  if (project.phase === 'works') releaseWorks(state, project, definitionOrThrow(rules, project.definitionId, TurnError));
  project.phase = 'cancelled';
  project.turnsLeftInPhase = 0;
}

/**
 * Allunga la fase in corso di un progetto: ricorsi, proteste, uffici saturi.
 * Funzione pura, interna al motore: non è esportata dal pacchetto.
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
 * 1. entrate: proprie, trasferimenti statali, rate europee in arrivo;
 * 2. spese obbligate: cassa integrazione (fondo statale) e servizi (fondi propri);
 * 3. progetti: effetti ricorrenti di quelli in esercizio, poi quelli in
 *    costruzione in ordine di avvio, entro fondi e capacità di spesa; infine
 *    scadono le rate europee non spese;
 * 4. clima secondo lo scenario dell'epoca;
 * 5. effetti in scadenza.
 * Poi il turno avanza. Dopo troppi anni di disavanzo la partita termina con
 * 'ended-bankrupt'; al turno TOTAL_TURNS con 'ended-2127'.
 */
export function advanceTurn(state: GameState, rules: TurnRules): GameState {
  if (state.status !== 'running') throw new TurnError(`partita conclusa (${state.status})`);
  const next = structuredClone(state);
  const closing = next.turn;
  const opening = closing + 1;

  collectRevenue(next, rules.economy, closing);
  payMandatorySpending(next, rules.economy);
  advanceProjects(next, rules, opening);
  expireEuTranches(next, closing);
  advanceClimate(next, rules, closing);
  applyDueEffectsInPlace(next, opening);

  next.economy.deficitYears = next.economy.funds.own < 0 ? next.economy.deficitYears + 1 : 0;
  next.turn = opening;
  if (next.economy.deficitYears >= rules.economy.bankruptcyAfterDeficitYears) next.status = 'ended-bankrupt';
  else if (opening >= TOTAL_TURNS) next.status = 'ended-2127';
  return next;
}

// ---------- Entrate e spese obbligate ----------

const totalEmployed = (state: GameState): number =>
  Object.values(state.labor.employed).reduce((sum, n) => sum + n, 0);

function collectRevenue(state: GameState, economy: EconomyRules, closing: number): void {
  const { funds } = state.economy;
  funds.own += economy.ownRevenuePerWorker * totalEmployed(state) * (state.economy.averageIncome / 100);
  funds.state += economy.stateTransferPerYear;
  const year = yearOfTurn(closing);
  for (const tranche of economy.euTranches) {
    if (tranche.arrivesInYear !== year) continue;
    funds['eu-earmarked'] += tranche.amount;
    state.economy.euTranches.push({
      id: tranche.id,
      remaining: tranche.amount,
      expiresOnTurn: closing + (tranche.expiresInYear - tranche.arrivesInYear),
    });
  }
}

/**
 * Cassa integrazione dal fondo statale: se non basta, chi resta scoperto
 * diventa disoccupato. Servizi dai fondi propri, anche in disavanzo.
 */
function payMandatorySpending(state: GameState, economy: EconomyRules): void {
  const { funds } = state.economy;
  const { labor } = state;
  const costPerPerson = economy.wageSupportCostPerPerson;
  if (costPerPerson > 0) {
    const covered = Math.min(labor.onWageSupport, Math.floor(funds.state / costPerPerson));
    const uncovered = labor.onWageSupport - covered;
    funds.state -= covered * costPerPerson;
    labor.onWageSupport = covered;
    labor.unemployed += uncovered;
  }
  funds.own -= economy.servicesCostPerYear;
}

/** Paga da un fondo; per il fondo europeo consuma prima le rate che scadono prima. */
function payFrom(state: GameState, fund: FundKind, amount: number): void {
  state.economy.funds[fund] -= amount;
  if (fund !== 'eu-earmarked') return;
  let left = amount;
  const tranches = [...state.economy.euTranches].sort((a, b) => a.expiresOnTurn - b.expiresOnTurn);
  for (const tranche of tranches) {
    if (left <= 0) break;
    const used = Math.min(tranche.remaining, left);
    tranche.remaining -= used;
    left -= used;
  }
}

/** A fine anno la parte non spesa delle rate in scadenza viene tolta dal fondo europeo. */
function expireEuTranches(state: GameState, closing: number): void {
  const { economy } = state;
  for (const tranche of economy.euTranches.filter((t) => t.expiresOnTurn <= closing)) {
    economy.funds['eu-earmarked'] -= Math.min(tranche.remaining, economy.funds['eu-earmarked']);
  }
  economy.euTranches = economy.euTranches.filter((t) => t.expiresOnTurn > closing && t.remaining > 0);
}

// ---------- Progetti ----------

function advanceProjects(state: GameState, rules: TurnRules, opening: number): void {
  for (const project of state.projects) {
    if (project.phase === 'operating') {
      applyEffectSetInPlace(state, definitionOrThrow(rules, project.definitionId, TurnError).operatingEffects.everyYear);
    }
  }

  let capacityLeft = state.economy.spendingCapacity;
  const inProgress = state.projects
    .filter((p) => p.phase !== 'operating' && p.phase !== 'cancelled')
    .sort((a, b) => a.startedOnTurn - b.startedOnTurn); // stabile: a parità di turno, ordine di creazione
  for (const project of inProgress) {
    const definition = definitionOrThrow(rules, project.definitionId, TurnError);
    const { annualCost, fund } = definition.phases[project.phase as BuildPhase];
    if (!Number.isFinite(annualCost) || annualCost < 0) {
      throw new TurnError(`costo non valido per ${definition.id}.${project.phase}: ${annualCost}`);
    }
    if (state.economy.funds[fund] < annualCost || capacityLeft < annualCost) {
      project.delayTurns += 1;
      if (project.phase === 'works') stallWorks(state, project, definition);
      continue;
    }
    payFrom(state, fund, annualCost);
    capacityLeft -= annualCost;
    if (project.phase === 'works') resumeWorks(state, project, definition);
    workOneYear(state, project, definition, rules, opening);
  }
}

/** Un anno di lavoro pagato: la fase avanza, e con essa il lotto collegato. */
function workOneYear(
  state: GameState,
  project: Project,
  definition: ProjectDefinition,
  rules: TurnRules,
  opening: number,
): void {
  const remainingBefore = remainingTurns(state, project, definition);
  project.turnsLeftInPhase -= 1;
  if (project.turnsLeftInPhase <= 0) {
    const leaving = project.phase as BuildPhase;
    enterPhaseFrom(state, project, definition, BUILD_PHASES.indexOf(leaving) + 1, opening);
    if (leaving === 'works') releaseWorks(state, project, definition);
  }

  const lot = conversionLotOf(state, project, rules);
  if (lot === undefined) return;
  if (project.phase === 'operating') {
    lot.progress = 1;
    if (lot.path === 'remediation') lot.remediated = true;
  } else {
    // Un anno in più sul totale previsto; i ritardi che allungano una fase allungano anche il totale.
    lot.progress = Math.min(1, lot.progress + (1 - lot.progress) / remainingBefore);
  }
}

/** Il lotto trasformato da questo progetto, se è il progetto di riconversione della sua strada. */
function conversionLotOf(state: GameState, project: Project, rules: TurnRules): PlantLot | undefined {
  if (project.lotId === undefined) return undefined;
  const lot = state.plantLots.find((l) => l.id === project.lotId);
  if (lot === undefined || lot.path === 'idle' || rules.lotConversion[lot.path] !== project.definitionId) return undefined;
  return lot;
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
