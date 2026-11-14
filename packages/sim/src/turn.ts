/**
 * Ciclo del turno: azioni del giocatore e avanzamento annuale. Le parti
 * specifiche stanno nei moduli projects, economy, policies e dilemmas.
 */
import { assertDistrict } from './common.js';
import { answerDilemma, maybeOpenDilemma } from './dilemmas.js';
import {
  advanceDistrictsInPlace,
  applyScandalConsequencesInPlace,
  civicFactor,
  promiseTrustInPlace,
  updateAbandonmentInPlace,
} from './city.js';
import { capStateFund, collectRevenue, expireEuTranches, payMandatorySpending, spendOwnSurplus } from './economy.js';
import { applyDeltasInPlace, applyDueEffectsInPlace } from './effects.js';
import { ActionError, TurnError } from './errors.js';
import { checkScandalsInPlace, settlePromisesInPlace } from './moral.js';
import { advancePolicies, setPolicy, syncTrained } from './policies.js';
import { advanceProjects, cancelProject, convertLot, definitionOrThrow, shortcutPhase, startProject } from './projects.js';
import type { TurnRules } from './rules.js';
import { MAX_FREE_ACTIONS_PER_TURN, TOTAL_TURNS, epochOfTurn, type Action, type GameState } from './state.js';

export * from './rules.js';
export { ActionError, TurnError } from './errors.js';
export { delayProject } from './projects.js';
export { eligibleDilemmas } from './dilemmas.js';

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
  'shortcut-phase',
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
    case 'set-policy':
      setPolicy(next, action, rules);
      break;
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
    case 'answer-dilemma':
      answerDilemma(next, action, rules);
      break;
    case 'shortcut-phase':
      shortcutPhase(next, action, rules);
      break;
    case 'negotiate':
    case 'answer-protest':
      // Trattative e proteste arrivano con i task successivi: per ora
      // l'azione resta nella storia, così la partita è già rigiocabile.
      break;
  }
  next.history.push({ turn: next.turn, action: structuredClone(action) });
  syncTrained(next);
  return next;
}

// ---------- Avanzamento del turno ----------

/**
 * Chiude l'anno in corso e apre il successivo. Funzione pura. Rifiuta di
 * avanzare se c'è un dilemma aperto. In ordine:
 * 1. entrate: proprie, trasferimenti statali, rate europee in arrivo;
 * 2. spese obbligate: cassa integrazione (fondo statale) e servizi (fondi propri);
 * 2b. politiche attive: fine delle formazioni in scadenza, poi chi trova fondi
 *    paga e produce i suoi effetti dell'anno;
 * 3. progetti: effetti ricorrenti di quelli in esercizio, poi quelli in
 *    costruzione in ordine di avvio, entro fondi e capacità di spesa; infine
 *    scadono le rate europee non spese;
 * 4. clima secondo lo scenario dell'epoca;
 * 5. effetti in scadenza;
 * 6. quartieri: aria, esposizione, salute, servizi, tensione, fiducia;
 * 7. morale: promesse con condizione in scadenza (e fiducia del quartiere a cui
 *    erano rivolte), poi scoperta degli atti nascosti e loro conseguenze;
 * 8. il fondo statale oltre il tetto di riporto torna allo Stato; l'avanzo dei
 *    fondi propri oltre la riserva si spende in servizi.
 * Entrate proprie ed effetti positivi ricorrenti sono moltiplicati per il senso
 * civico, calcolato sulla fiducia a inizio anno. Poi il turno avanza. Dopo
 * troppi anni di disavanzo la partita termina con 'ended-bankrupt'; dopo troppi
 * anni di fiducia sotto soglia con 'ended-abandoned'; al turno TOTAL_TURNS con
 * 'ended-2127'. Se la partita continua, all'apertura del nuovo turno può
 * arrivare un dilemma.
 */
export function advanceTurn(state: GameState, rules: TurnRules): GameState {
  if (state.status !== 'running') throw new TurnError(`partita conclusa (${state.status})`);
  if (state.openDilemmaId !== null) throw new TurnError(`il dilemma ${state.openDilemmaId} attende una risposta`);
  const next = structuredClone(state);
  const closing = next.turn;
  const opening = closing + 1;

  const civic = civicFactor(next, rules.city);
  collectRevenue(next, rules.economy, closing, civic);
  payMandatorySpending(next, rules.economy);
  advancePolicies(next, rules, closing, civic);
  advanceProjects(next, rules, opening, civic);
  expireEuTranches(next, closing);
  advanceClimate(next, rules, closing);
  applyDueEffectsInPlace(next, opening);
  advanceDistrictsInPlace(next, rules);
  promiseTrustInPlace(next, rules, settlePromisesInPlace(next, rules.moral, opening));
  applyScandalConsequencesInPlace(next, rules, checkScandalsInPlace(next, rules.moral, closing));
  capStateFund(next, rules.economy);
  spendOwnSurplus(next, rules.economy);

  next.economy.deficitYears = next.economy.funds.own < 0 ? next.economy.deficitYears + 1 : 0;
  const abandoned = updateAbandonmentInPlace(next, rules);
  next.turn = opening;
  if (next.economy.deficitYears >= rules.economy.bankruptcyAfterDeficitYears) next.status = 'ended-bankrupt';
  else if (abandoned) next.status = 'ended-abandoned';
  else if (opening >= TOTAL_TURNS) next.status = 'ended-2127';
  if (next.status === 'running') maybeOpenDilemma(next, rules, opening);
  syncTrained(next);
  return next;
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
