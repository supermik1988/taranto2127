/** Dilemmi: arrivo all'apertura del turno e risposta del giocatore. */
import { actSourceId, assertDataEffects, assertDistrict } from './common.js';
import { applyEffectSetInPlace, pushEffect } from './effects.js';
import { ActionError } from './errors.js';
import { MoralError, conditionHolds, readNumber, recordActInPlace } from './moral.js';
import { rngFor } from './rng.js';
import type { DilemmaDefinition, TurnRules } from './rules.js';
import { TOTAL_TURNS, type Action, type GameState } from './state.js';

export function answerDilemma(state: GameState, action: Extract<Action, { kind: 'answer-dilemma' }>, rules: TurnRules): void {
  if (state.openDilemmaId !== action.dilemmaId) {
    throw new ActionError(
      state.openDilemmaId === null
        ? `nessun dilemma aperto: non si può rispondere a ${action.dilemmaId}`
        : `il dilemma aperto è ${state.openDilemmaId}, non ${action.dilemmaId}`,
    );
  }
  const dilemma = Object.hasOwn(rules.dilemmas, action.dilemmaId) ? rules.dilemmas[action.dilemmaId] : undefined;
  if (dilemma === undefined) throw new ActionError(`dilemma inesistente: ${action.dilemmaId}`);
  const option = Object.hasOwn(dilemma.options, action.optionId) ? dilemma.options[action.optionId] : undefined;
  if (option === undefined) throw new ActionError(`opzione inesistente: ${action.dilemmaId}/${action.optionId}`);

  const sourceId = `${dilemma.id}/${action.optionId}`;
  assertDataEffects(state, sourceId, option.immediate);
  for (const { delayTurns, effects } of option.delayed) {
    if (!Number.isInteger(delayTurns) || delayTurns < 1) throw new ActionError(`${sourceId}: ritardo non valido (${delayTurns})`);
    assertDataEffects(state, sourceId, effects);
  }
  const promise = option.promise;
  if (promise !== undefined) {
    if (!Number.isInteger(promise.dueInTurns) || promise.dueInTurns < 1) {
      throw new ActionError(`${sourceId}: scadenza della promessa non valida (${promise.dueInTurns})`);
    }
    assertDistrict(promise.toDistrict);
    if (promise.condition !== undefined) {
      try {
        readNumber(state, promise.condition.target);
      } catch (error) {
        if (error instanceof MoralError) throw new ActionError(`${sourceId}: ${error.message}`);
        throw error;
      }
    }
  }

  state.openDilemmaId = null;
  applyEffectSetInPlace(state, option.immediate);
  for (const { delayTurns, effects } of option.delayed) pushEffect(state, sourceId, state.turn + delayTurns, effects);
  recordActInPlace(state, rules.moral, { sourceId: actSourceId(state), weights: option.moral, hidden: option.hidden });
  if (promise !== undefined) {
    state.promises.push({
      id: `promise-${state.turn}-${state.history.length}`,
      madeOnTurn: state.turn,
      dueByTurn: Math.min(TOTAL_TURNS, state.turn + promise.dueInTurns),
      ...(promise.toDistrict !== undefined && { toDistrict: promise.toDistrict }),
      ...(promise.toFaction !== undefined && { toFaction: promise.toFaction }),
      text: promise.text,
      status: 'open',
      ...(promise.condition !== undefined && { condition: structuredClone(promise.condition) }),
    });
  }
}

/** Dilemmi che possono arrivare al turno `turn`: finestra, condizioni, ripetibilità. */
export function eligibleDilemmas(state: GameState, rules: TurnRules, turn: number): DilemmaDefinition[] {
  const answered = new Set(
    state.history.flatMap((h) => (h.action.kind === 'answer-dilemma' ? [h.action.dilemmaId] : [])),
  );
  return Object.keys(rules.dilemmas)
    .sort()
    .map((id) => rules.dilemmas[id]!)
    .filter(
      (d) =>
        d.weight > 0 &&
        d.firstTurn <= turn &&
        turn <= d.lastTurn &&
        (d.repeatable || !answered.has(d.id)) &&
        d.conditions.every((c) => conditionHolds(state, c)),
    );
}

/** All'apertura del turno: con la probabilità annua dei dati arriva un dilemma, estratto per peso. */
export function maybeOpenDilemma(state: GameState, rules: TurnRules, opening: number): void {
  if (state.openDilemmaId !== null) return;
  const eligible = eligibleDilemmas(state, rules, opening);
  if (eligible.length === 0) return;
  const rng = rngFor(state.seed, 'dilemma-arrival', opening);
  if (!(rng.next() < rules.dilemmaArrivalProbability)) return;
  const total = eligible.reduce((sum, d) => sum + d.weight, 0);
  let draw = rng.next() * total;
  let chosen = eligible[eligible.length - 1]!;
  for (const dilemma of eligible) {
    draw -= dilemma.weight;
    if (draw < 0) {
      chosen = dilemma;
      break;
    }
  }
  state.openDilemmaId = chosen.id;
}
