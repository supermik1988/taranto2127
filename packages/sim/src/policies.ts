/** Politiche attive, il loro costo annuo e la formazione. */
import { actSourceId, assertDataEffects } from './common.js';
import { payFrom } from './economy.js';
import { applyEffectSetInPlace, scaleBeneficial } from './effects.js';
import { ActionError, TurnError } from './errors.js';
import { recordActInPlace } from './moral.js';
import type { PolicyDefinition, TurnRules } from './rules.js';
import type { Action, GameState } from './state.js';

/** Le persone formate sono disoccupati: non possono essere più dei disoccupati presenti. */
export function syncTrained(state: GameState): void {
  state.labor.trained = Math.min(state.labor.trained, state.labor.unemployed);
}

function policyOrThrow(rules: TurnRules, policyId: string, ErrorType: new (message: string) => Error): PolicyDefinition {
  const policy = Object.hasOwn(rules.policies, policyId) ? rules.policies[policyId] : undefined;
  if (policy === undefined) throw new ErrorType(`politica inesistente: ${policyId}`);
  return policy;
}

/** true se la politica è già stata accesa almeno una volta in questa partita. */
const activatedBefore = (state: GameState, policyId: string): boolean =>
  state.history.some((h) => h.action.kind === 'set-policy' && h.action.policyId === policyId && h.action.active);

/**
 * Accende o spegne una politica. Accesa vale dal turno dopo (regola 10); i
 * suoi pesi morali di attivazione si registrano solo la prima volta in tutta
 * la partita, così accendere e spegnere non fa guadagnare punti. Non si spegne
 * prima degli anni minimi.
 */
export function setPolicy(state: GameState, action: Extract<Action, { kind: 'set-policy' }>, rules: TurnRules): void {
  const policy = policyOrThrow(rules, action.policyId, ActionError);
  const active = state.activePolicies.includes(policy.id);
  if (action.active && !active) {
    assertDataEffects(state, policy.id, policy.everyYear);
    const firstActivation = !activatedBefore(state, policy.id);
    state.activePolicies.push(policy.id);
    state.policySince[policy.id] = state.turn;
    if (policy.activationMoral !== undefined && firstActivation) {
      recordActInPlace(state, rules.moral, { sourceId: actSourceId(state), weights: policy.activationMoral, hidden: false });
    }
  }
  if (!action.active && active) {
    const since = state.policySince[policy.id] ?? state.turn;
    if (state.turn - since < policy.minYearsActive) {
      throw new ActionError(`${policy.id}: non si spegne prima di ${policy.minYearsActive} anni (attiva dal turno ${since})`);
    }
    state.activePolicies = state.activePolicies.filter((p) => p !== policy.id);
    delete state.policySince[policy.id];
  }
}

/**
 * Le coorti in scadenza finiscono la formazione; poi ogni politica attiva, in
 * ordine di attivazione, paga l'anno se il suo fondo basta e produce i suoi
 * effetti e il suo peso morale annuo. Senza fondi resta attiva ma per
 * quell'anno non produce nulla.
 */
export function advancePolicies(state: GameState, rules: TurnRules, closing: number, civic = 1): void {
  const { labor } = state;
  for (const cohort of state.trainingCohorts.filter((c) => c.completesOnTurn <= closing)) {
    const moved = Math.min(cohort.count, labor.inTraining);
    labor.inTraining -= moved;
    labor.unemployed += moved;
    labor.trained += moved;
  }
  state.trainingCohorts = state.trainingCohorts.filter((c) => c.completesOnTurn > closing);

  for (const policyId of state.activePolicies) {
    const policy = policyOrThrow(rules, policyId, TurnError);
    if (!Number.isFinite(policy.annualCost) || policy.annualCost < 0) {
      throw new TurnError(`costo non valido per la politica ${policy.id}: ${policy.annualCost}`);
    }
    if (state.economy.funds[policy.fund] < policy.annualCost) continue;
    payFrom(state, policy.fund, policy.annualCost);
    applyEffectSetInPlace(state, scaleBeneficial(policy.everyYear, civic));
    if (policy.annualMoral !== undefined) {
      recordActInPlace(state, rules.moral, { sourceId: `policy:${policy.id}:${closing}`, weights: policy.annualMoral, hidden: false });
    }
    if (policy.training !== undefined) {
      const { peoplePerYear, durationYears } = policy.training;
      if (!Number.isInteger(peoplePerYear) || peoplePerYear < 0 || !Number.isInteger(durationYears) || durationYears < 1) {
        throw new TurnError(`formazione non valida per la politica ${policy.id}`);
      }
      const enrolled = Math.min(peoplePerYear, labor.unemployed);
      if (enrolled > 0) {
        // Chi entra in formazione esce prima dai disoccupati non ancora formati.
        const untrained = labor.unemployed - labor.trained;
        labor.trained -= Math.max(0, enrolled - untrained);
        labor.unemployed -= enrolled;
        labor.inTraining += enrolled;
        state.trainingCohorts.push({ policyId: policy.id, count: enrolled, completesOnTurn: closing + durationYears });
      }
    }
  }
}
