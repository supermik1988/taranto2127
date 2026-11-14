/**
 * La città reagisce: dinamica annuale dei quartieri, senso civico, conseguenze
 * degli scandali e delle promesse, città che si volta. Tutti i coefficienti
 * vengono da `rules.city` (CLAUDE.md, regola 4).
 */
import { applyDeltasInPlace, applyEffectSetInPlace } from './effects.js';
import { INDEX, clampToBounds } from './limits.js';
import { rewindProjectInPlace } from './projects.js';
import type { ActivePath, CityRules, TurnRules } from './rules.js';
import type { DistrictId, GameState, HiddenAct, PlantLot, Promise as CityPromise } from './state.js';
import { DISTRICT_IDS } from './validate.js';

const clampIndex = (value: number): number => clampToBounds(value, INDEX);

/** Fiducia media della città, pesata sui residenti di ogni quartiere. */
export function averageTrust(state: GameState): number {
  let weighted = 0;
  let people = 0;
  for (const id of DISTRICT_IDS) {
    const d = state.districts[id];
    const residents = d.population.young + d.population.adult + d.population.elder;
    weighted += d.trust * residents;
    people += residents;
  }
  return people > 0 ? weighted / people : 0;
}

/**
 * Senso civico: fattore tra il minimo e il tetto dei dati, che cresce con la
 * fiducia media. Il tetto può superare 1: una città con molta fiducia rende
 * più della media.
 */
export function civicFactor(state: GameState, city: CityRules): number {
  const { minFactor, maxFactor, fullFactorTrust } = city.civic;
  const share = fullFactorTrust > 0 ? Math.min(1, Math.max(0, averageTrust(state) / fullFactorTrust)) : 1;
  return minFactor + (maxFactor - minFactor) * share;
}

// ---------- Aria e quartieri ----------

/** Pressione di un lotto sull'aria, secondo il suo stato. */
export function lotPressure(state: GameState, lot: PlantLot, rules: TurnRules): number {
  const pressures = rules.city.air.pressures;
  const inWorks = state.projects.some((p) => p.lotId === lot.id && p.phase === 'works');
  if (inWorks) return pressures.works;
  if (lot.path !== 'idle' && lot.progress >= 1) {
    return lot.path === 'remediation' ? pressures.remediated : pressures.operating[lot.path as ActivePath];
  }
  return lot.remediated ? pressures.remediated : pressures.idleContaminated;
}

const laborForce = (s: GameState): number =>
  Object.values(s.labor.employed).reduce((a, b) => a + b, 0) + s.labor.onWageSupport + s.labor.unemployed + s.labor.inTraining;

/** Quota di cassa integrati e disoccupati sulla forza lavoro, da 0 a 100. */
export function joblessShare(state: GameState): number {
  const force = laborForce(state);
  return force > 0 ? ((state.labor.onWageSupport + state.labor.unemployed) / force) * 100 : 0;
}

/**
 * Un anno di vita dei quartieri, in quest'ordine: aria, esposizione, salute,
 * servizi, tensione, fiducia. Ogni grandezza si avvicina al suo valore di
 * equilibrio di una quota annua, così i cambiamenti arrivano con lentezza.
 */
export function advanceDistrictsInPlace(state: GameState, rules: TurnRules): void {
  const city = rules.city;
  const pressureOn: Record<DistrictId, number> = Object.fromEntries(DISTRICT_IDS.map((id) => [id, 0])) as Record<DistrictId, number>;
  for (const lot of state.plantLots) {
    const weights = city.air.lotWeights[lot.id] ?? {};
    const pressure = lotPressure(state, lot, rules);
    for (const [id, weight] of Object.entries(weights) as [DistrictId, number][]) pressureOn[id] += pressure * weight;
  }
  const jobless = joblessShare(state);
  const inDeficit = state.economy.funds.own < 0;

  for (const id of DISTRICT_IDS) {
    const d = state.districts[id];
    const airTarget = clampIndex(city.air.cleanValue - pressureOn[id]);
    d.airQuality = clampIndex(d.airQuality + city.air.approachShare * (airTarget - d.airQuality));

    const { airThreshold, growthPerPointBelow, decayPerYear } = city.exposure;
    d.cumulativeExposure = clampIndex(
      d.airQuality < airThreshold
        ? d.cumulativeExposure + growthPerPointBelow * (airThreshold - d.airQuality)
        : d.cumulativeExposure - decayPerYear,
    );

    const h = city.health;
    const healthTarget = clampIndex(h.base - h.exposureWeight * d.cumulativeExposure + h.servicesWeight * d.services);
    d.health = clampIndex(d.health + h.approachShare * (healthTarget - d.health));

    const s = city.services;
    if (inDeficit) d.services = clampIndex(d.services - s.deficitDropPerYear);
    else if (d.services < s.recoveryCeiling) d.services = Math.min(s.recoveryCeiling, d.services + s.recoveryPerYear);

    const t = city.tension;
    const tensionTarget = clampIndex(t.base + t.joblessWeight * jobless + t.distrustWeight * (100 - d.trust));
    d.tension = clampIndex(d.tension + t.approachShare * (tensionTarget - d.tension));

    const tr = city.trust;
    const trustTarget = clampIndex(
      tr.base + tr.reputationWeight * state.moral.reputation + tr.healthWeight * (d.health - 50) - tr.joblessWeight * jobless,
    );
    d.trust = clampIndex(d.trust + tr.approachShare * (trustTarget - d.trust));
  }
}

// ---------- Promesse e scandali ----------

/** Una promessa mantenuta alza subito la fiducia del quartiere a cui era rivolta, una tradita la abbassa. */
export function promiseTrustInPlace(state: GameState, rules: TurnRules, settled: readonly CityPromise[]): void {
  for (const promise of settled) {
    if (promise.toDistrict === undefined) continue;
    const d = state.districts[promise.toDistrict];
    const change = promise.status === 'kept' ? rules.city.trust.promiseKeptBoost : -rules.city.trust.promiseBrokenDrop;
    d.trust = clampIndex(d.trust + change);
  }
}

/** La scelta da cui viene un atto: l'id dell'atto senza la dimensione finale. */
const choiceOf = (actId: string): string => actId.slice(0, actId.lastIndexOf(':'));

/**
 * Conseguenze di una scelta scoperta, una volta sola anche se la scelta aveva
 * più dimensioni nascoste o se le sue dimensioni vengono scoperte in anni
 * diversi: fiducia giù in tutti i quartieri e nel Consiglio; una scorciatoia
 * rimanda il progetto all'inizio della fase saltata e lo ferma; un'opzione di
 * dilemma applica la sua penale, se i dati ne hanno una.
 */
export function applyScandalConsequencesInPlace(state: GameState, rules: TurnRules, discovered: readonly HiddenAct[]): void {
  const { districtTrustDrop, councilTrustDrop, shortcutFrozenYears } = rules.city.scandal;
  const now = new Set(discovered.map((act) => act.id));
  const alreadyExposed = new Set(state.moral.scandals.filter((s) => !now.has(s.actId)).map((s) => choiceOf(s.actId)));
  const handled = new Set<string>();
  for (const act of discovered) {
    const choice = choiceOf(act.id);
    if (alreadyExposed.has(choice) || handled.has(choice)) continue;
    handled.add(choice);
    applyDeltasInPlace(state, [
      ...DISTRICT_IDS.map((id) => ({ target: `districts.${id}.trust`, amount: -districtTrustDrop })),
      ...state.council.map((c) => ({ target: `council.${c.id}.trustInPlayer`, amount: -councilTrustDrop })),
    ]);
    const source = act.source;
    if (source?.kind === 'shortcut') {
      const project = state.projects.find((p) => p.id === source.projectId);
      if (project !== undefined) rewindProjectInPlace(state, project, rules, source.skippedPhase, shortcutFrozenYears);
    }
    if (source?.kind === 'dilemma') {
      const penalty = rules.dilemmas[source.dilemmaId]?.options[source.optionId]?.scandalPenalty;
      if (penalty !== undefined) applyEffectSetInPlace(state, penalty);
    }
  }
}

/** Conta gli anni di fiducia media sotto soglia; true se la città si è voltata. */
export function updateAbandonmentInPlace(state: GameState, rules: TurnRules): boolean {
  const { trustThreshold, years } = rules.city.abandonment;
  state.lowTrustYears = averageTrust(state) < trustThreshold ? state.lowTrustYears + 1 : 0;
  return state.lowTrustYears >= years;
}
