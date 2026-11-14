/**
 * Il perché: per un quartiere, verso quale valore vanno aria, esposizione,
 * salute, servizi, tensione e fiducia, e quali fattori li spingono. Funzione
 * pura, che rifà i conti di city.ts nello stesso ordine (aria, esposizione,
 * salute, servizi, tensione, fiducia) senza toccare lo stato: l'esposizione usa
 * l'aria dell'anno prossimo, la salute l'esposizione dell'anno prossimo, la
 * fiducia la salute dell'anno prossimo, come fa il motore.
 */
import { joblessShare, lotPressure } from './city.js';
import { INDEX, clampToBounds } from './limits.js';
import type { TurnRules } from './rules.js';
import type { DistrictId, GameState } from './state.js';

export type ExplainedQuantity = 'airQuality' | 'cumulativeExposure' | 'health' | 'services' | 'tension' | 'trust';

/** Un fattore: che cosa spinge, e di quanto (in punti dell'indice). I pesi sommati danno il valore di arrivo. */
export interface ExplanationFactor {
  /** Chiave del testo che lo racconta, in packages/content. */
  key: string;
  weight: number;
  /** Valori da inserire nel testo (nomi di lotti, stati, grandezze di partenza). */
  params?: Record<string, string | number>;
}

export interface QuantityExplanation {
  quantity: ExplainedQuantity;
  current: number;
  /**
   * Valore verso cui la grandezza va. Per aria, salute, tensione e fiducia è
   * l'equilibrio a cui si avvicina ogni anno; per esposizione e servizi, che
   * crescono o calano di una quantità fissa, è il valore dell'anno prossimo.
   */
  target: number;
  /** 'equilibrio' o 'anno-prossimo'. */
  kind: 'equilibrium' | 'next-year';
  factors: ExplanationFactor[];
}

/** Aggiunge, se serve, il fattore che riporta la somma dentro i limiti dell'indice. */
function withLimit(factors: ExplanationFactor[]): { target: number; factors: ExplanationFactor[] } {
  const raw = factors.reduce((sum, f) => sum + f.weight, 0);
  const target = clampToBounds(raw, INDEX);
  return target === raw ? { target, factors } : { target, factors: [...factors, { key: 'limit', weight: target - raw }] };
}

function lotState(state: GameState, lotId: string): string {
  const lot = state.plantLots.find((l) => l.id === lotId)!;
  if (state.projects.some((p) => p.lotId === lot.id && p.phase === 'works')) return 'works';
  if (lot.path !== 'idle' && lot.progress >= 1) return lot.path === 'remediation' ? 'remediated' : `operating-${lot.path}`;
  return lot.remediated ? 'remediated' : 'idle-contaminated';
}

export function explainDistrict(state: GameState, rules: TurnRules, id: DistrictId): QuantityExplanation[] {
  const city = rules.city;
  const d = state.districts[id];
  const jobless = joblessShare(state);
  const out: QuantityExplanation[] = [];

  // Aria: valore pulito meno la pressione dei lotti vicini.
  const airFactors: ExplanationFactor[] = [{ key: 'air-clean', weight: city.air.cleanValue }];
  for (const lot of state.plantLots) {
    const weight = city.air.lotWeights[lot.id]?.[id] ?? 0;
    const pressure = lotPressure(state, lot, rules) * weight;
    if (pressure !== 0) airFactors.push({ key: 'air-lot', weight: -pressure, params: { lotId: lot.id, state: lotState(state, lot.id) } });
  }
  const air = { quantity: 'airQuality' as const, current: d.airQuality, kind: 'equilibrium' as const, ...withLimit(airFactors) };
  out.push(air);
  const airNext = clampToBounds(d.airQuality + city.air.approachShare * (air.target - d.airQuality), INDEX);

  // Esposizione: sale con l'aria sotto soglia, cala lentamente sopra.
  const { airThreshold, growthPerPointBelow, decayPerYear } = city.exposure;
  const exposureChange =
    airNext < airThreshold
      ? { key: 'exposure-grows', weight: growthPerPointBelow * (airThreshold - airNext), params: { threshold: airThreshold } }
      : { key: 'exposure-decays', weight: -decayPerYear, params: { threshold: airThreshold } };
  const exposure = {
    quantity: 'cumulativeExposure' as const,
    current: d.cumulativeExposure,
    kind: 'next-year' as const,
    ...withLimit([{ key: 'current', weight: d.cumulativeExposure }, exposureChange]),
  };
  out.push(exposure);

  // Salute: una base, meno l'esposizione accumulata, più i servizi.
  const h = city.health;
  const health = {
    quantity: 'health' as const,
    current: d.health,
    kind: 'equilibrium' as const,
    ...withLimit([
      { key: 'health-base', weight: h.base },
      { key: 'health-exposure', weight: -h.exposureWeight * exposure.target },
      { key: 'health-services', weight: h.servicesWeight * d.services },
    ]),
  };
  out.push(health);
  const healthNext = clampToBounds(d.health + h.approachShare * (health.target - d.health), INDEX);

  // Servizi: calano negli anni di disavanzo, risalgono lentamente in attivo; l'avanzo oltre la riserva li alza.
  const s = city.services;
  const serviceFactors: ExplanationFactor[] = [{ key: 'current', weight: d.services }];
  if (state.economy.funds.own < 0) serviceFactors.push({ key: 'services-deficit', weight: -s.deficitDropPerYear });
  else if (d.services < s.recoveryCeiling) {
    serviceFactors.push({ key: 'services-recovery', weight: Math.min(s.recoveryPerYear, s.recoveryCeiling - d.services) });
  }
  const surplus = state.economy.funds.own - rules.economy.ownSurplusReserve;
  if (surplus > 0) serviceFactors.push({ key: 'services-surplus', weight: surplus * rules.economy.servicesPerSurplusMillion });
  out.push({ quantity: 'services', current: d.services, kind: 'next-year', ...withLimit(serviceFactors) });

  // Tensione: una base, più chi è senza lavoro, più la sfiducia.
  const t = city.tension;
  out.push({
    quantity: 'tension',
    current: d.tension,
    kind: 'equilibrium',
    ...withLimit([
      { key: 'tension-base', weight: t.base },
      { key: 'tension-jobless', weight: t.joblessWeight * jobless, params: { share: Math.round(jobless) } },
      { key: 'tension-distrust', weight: t.distrustWeight * (100 - d.trust) },
    ]),
  });

  // Fiducia: una base, più la reputazione, più la salute rispetto a 50, meno chi è senza lavoro.
  const tr = city.trust;
  out.push({
    quantity: 'trust',
    current: d.trust,
    kind: 'equilibrium',
    ...withLimit([
      { key: 'trust-base', weight: tr.base },
      { key: 'trust-reputation', weight: tr.reputationWeight * state.moral.reputation },
      { key: 'trust-health', weight: tr.healthWeight * (healthNext - 50) },
      { key: 'trust-jobless', weight: -tr.joblessWeight * jobless, params: { share: Math.round(jobless) } },
    ]),
  });
  return out;
}
