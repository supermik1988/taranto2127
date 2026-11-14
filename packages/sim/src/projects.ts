/** Progetti a fasi, cantieri, lotti di ILSIDER e scorciatoie. */
import { actSourceId, assertDataEffects } from './common.js';
import { payFrom } from './economy.js';
import { applyEffectSetInPlace, pushEffect, scaleBeneficial } from './effects.js';
import { ActionError, TurnError } from './errors.js';
import { recordActInPlace } from './moral.js';
import { rngFor } from './rng.js';
import { BUILD_PHASES, type BuildPhase, type ProjectDefinition, type TurnRules } from './rules.js';
import type { Action, DistrictId, GameState, PlantLot, Project, ProjectPhase } from './state.js';

export function definitionOrThrow(
  rules: TurnRules,
  definitionId: string,
  ErrorType: new (message: string) => Error,
): ProjectDefinition {
  const definition = Object.hasOwn(rules.projects, definitionId) ? rules.projects[definitionId] : undefined;
  if (definition === undefined) throw new ErrorType(`definizione di progetto inesistente: ${definitionId}`);
  return definition;
}

/**
 * Scorciatoia Red: salta la fase di autorizzazione o di gara in corso. Si
 * guadagnano gli anni che restavano in quella fase e non si paga il suo costo;
 * resta un atto nascosto sulla legalità.
 */
export function shortcutPhase(state: GameState, action: Extract<Action, { kind: 'shortcut-phase' }>, rules: TurnRules): void {
  const project = state.projects.find((p) => p.id === action.projectId);
  if (project === undefined) throw new ActionError(`progetto inesistente: ${action.projectId}`);
  if (project.phase !== 'permitting' && project.phase !== 'tender') {
    throw new ActionError(`si possono saltare solo autorizzazioni e gara, non la fase ${project.phase}`);
  }
  const definition = definitionOrThrow(rules, project.definitionId, ActionError);
  const skippedPhase = project.phase;
  project.shortcutTaken = true;
  enterPhaseFrom(state, project, definition, BUILD_PHASES.indexOf(project.phase) + 1, state.turn + 1);
  // enterPhaseFrom cambia la fase: TypeScript non lo vede dal restringimento precedente.
  if ((project.phase as ProjectPhase) === 'operating') markLotOperating(state, project, rules);
  recordActInPlace(state, rules.moral, {
    sourceId: actSourceId(state),
    weights: { legality: rules.moral.shortcutLegalityWeight },
    hidden: true,
    source: { kind: 'shortcut', projectId: project.id, skippedPhase },
  });
}

/**
 * Cambia la strada di un lotto. Annulla ogni progetto ancora attivo sul lotto
 * (anche uno già in esercizio: la sua attività cessa) e, se la nuova strada
 * non è 'idle', avvia il progetto di trasformazione previsto dai dati.
 */
export function convertLot(state: GameState, action: Extract<Action, { kind: 'convert-lot' }>, rules: TurnRules): void {
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

export function startProject(
  state: GameState,
  definition: ProjectDefinition,
  where: { lotId?: string; district?: DistrictId },
): void {
  if (definition.unique === true && state.projects.some((p) => p.definitionId === definition.id && p.phase !== 'cancelled')) {
    throw new ActionError(`${definition.id}: progetto unico, già avviato in questa partita`);
  }
  // Un errore negli effetti dei dati emerge all'avvio, non anni dopo all'entrata in esercizio.
  assertDataEffects(state, definition.id, definition.operatingEffects.once);
  assertDataEffects(state, definition.id, definition.operatingEffects.everyYear);
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
    frozenTurns: 0,
    onceEffectsApplied: false,
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
  // Un progetto rimandato indietro da uno scandalo non riceve due volte gli effetti "una volta".
  if (!project.onceEffectsApplied) {
    pushEffect(state, project.id, effectsTurn, definition.operatingEffects.once);
    project.onceEffectsApplied = true;
  }
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

export function cancelProject(state: GameState, project: Project, rules: TurnRules): void {
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

/**
 * Uno scandalo su una scorciatoia: il progetto torna all'inizio della fase
 * saltata, con la sua durata prevista, e resta fermo per `frozenYears` anni.
 * Se era in lavori, gli assunti tornano disoccupati; se era in esercizio, smette
 * di produrre effetti finché non ci torna. Il lotto collegato arretra di
 * conseguenza e, se era una bonifica, non è più considerato bonificato.
 */
export function rewindProjectInPlace(
  state: GameState,
  project: Project,
  rules: TurnRules,
  phase: 'permitting' | 'tender',
  frozenYears: number,
): void {
  if (project.phase === 'cancelled') return;
  const definition = definitionOrThrow(rules, project.definitionId, TurnError);
  if (project.phase === 'works') releaseWorks(state, project, definition);
  project.phase = phase;
  project.turnsLeftInPhase = Math.max(1, plannedTurns(state, project, definition, phase));
  project.frozenTurns = frozenYears;
  project.worksStalled = false;
  const lot = state.plantLots.find((l) => l.id === project.lotId);
  if (lot !== undefined && lot.path !== 'idle' && rules.lotConversion[lot.path] === project.definitionId) {
    const total = BUILD_PHASES.reduce((sum, p) => sum + plannedTurns(state, project, definition, p), 0);
    const share = total > 0 ? 1 - remainingTurns(state, project, definition) / total : 0;
    lot.progress = Math.min(lot.progress, Math.max(0, share));
    if (lot.path === 'remediation') lot.remediated = false;
  }
}

// ---------- Avanzamento annuale ----------

export function advanceProjects(state: GameState, rules: TurnRules, opening: number, civic = 1): void {
  for (const project of state.projects) {
    if (project.phase === 'operating') {
      const everyYear = definitionOrThrow(rules, project.definitionId, TurnError).operatingEffects.everyYear;
      applyEffectSetInPlace(state, scaleBeneficial(everyYear, civic));
    }
  }

  let capacityLeft = state.economy.spendingCapacity;
  const inProgress = state.projects
    .filter((p) => p.phase !== 'operating' && p.phase !== 'cancelled')
    .sort((a, b) => a.startedOnTurn - b.startedOnTurn); // stabile: a parità di turno, ordine di creazione
  for (const project of inProgress) {
    const definition = definitionOrThrow(rules, project.definitionId, TurnError);
    if (project.frozenTurns > 0) {
      // Fermo dopo uno scandalo: nessun costo, nessun avanzamento, un anno di ritardo.
      project.frozenTurns -= 1;
      project.delayTurns += 1;
      continue;
    }
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
    markLotOperating(state, project, rules);
  } else {
    // Un anno in più sul totale previsto; i ritardi che allungano una fase allungano anche il totale.
    lot.progress = Math.min(1, lot.progress + (1 - lot.progress) / remainingBefore);
  }
}

/** Il progetto di riconversione è in esercizio: lotto completato, e bonificato se era una bonifica. */
function markLotOperating(state: GameState, project: Project, rules: TurnRules): void {
  const lot = conversionLotOf(state, project, rules);
  if (lot === undefined) return;
  lot.progress = 1;
  if (lot.path === 'remediation') lot.remediated = true;
}

/** Il lotto trasformato da questo progetto, se è il progetto di riconversione della sua strada. */
function conversionLotOf(state: GameState, project: Project, rules: TurnRules): PlantLot | undefined {
  if (project.lotId === undefined) return undefined;
  const lot = state.plantLots.find((l) => l.id === project.lotId);
  if (lot === undefined || lot.path === 'idle' || rules.lotConversion[lot.path] !== project.definitionId) return undefined;
  return lot;
}
