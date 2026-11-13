import type { ClimateState, DistrictId, DistrictState, GameState } from './state.js';

/** Tutti i quartieri del contratto, in ordine fisso. */
export const DISTRICT_IDS = Object.keys({
  tamburi: true,
  'paolo-vi': true,
  'citta-vecchia': true,
  borgo: true,
  'talsano-lama-san-vito': true,
  'area-industriale': true,
} satisfies Record<DistrictId, true>) as readonly DistrictId[];

export interface ValidationResult {
  ok: boolean;
  /** Un messaggio per ogni violazione, con il percorso della variabile. */
  errors: string[];
}

/** Campi "indice" (0-100) di un quartiere, secondo state.ts. */
const DISTRICT_INDICES = [
  'airQuality',
  'contaminatedSoil',
  'cumulativeExposure',
  'health',
  'services',
  'greenCover',
  'floodRisk',
  'trust',
  'tension',
  'belonging',
] as const satisfies readonly (keyof DistrictState)[];

/** Campi "indice" del clima. seaLevelRiseCm è in centimetri e resta fuori. */
const CLIMATE_INDICES = [
  'co2Emissions',
  'summerHeat',
  'waterStress',
] as const satisfies readonly (keyof ClimateState)[];

const INDEX_MIN = 0;
const INDEX_MAX = 100;
const MORAL_MIN = -100;
const MORAL_MAX = 100;

/**
 * Controlla gli invarianti dello stato: indici tra 0 e 100, popolazioni non
 * negative, coscienza e reputazione tra -100 e +100. Non lancia eccezioni:
 * restituisce l'elenco completo delle violazioni.
 */
export function validateState(state: GameState): ValidationResult {
  const errors: string[] = [];

  const inRange = (path: string, value: number, min: number, max: number): void => {
    // La forma negata cattura anche NaN.
    if (!(value >= min && value <= max)) {
      errors.push(`${path} = ${value}: deve stare tra ${min} e ${max}`);
    }
  };

  for (const id of DISTRICT_IDS) {
    const district = state.districts[id];
    if (district === undefined) {
      errors.push(`districts.${id}: quartiere mancante`);
      continue;
    }
    for (const field of DISTRICT_INDICES) {
      inRange(`districts.${id}.${field}`, district[field], INDEX_MIN, INDEX_MAX);
    }
    for (const [band, count] of Object.entries(district.population)) {
      if (!(count >= 0)) {
        errors.push(`districts.${id}.population.${band} = ${count}: non può essere negativa`);
      }
    }
  }

  inRange('economy.averageIncome', state.economy.averageIncome, INDEX_MIN, INDEX_MAX);
  for (const field of CLIMATE_INDICES) {
    inRange(`climate.${field}`, state.climate[field], INDEX_MIN, INDEX_MAX);
  }
  state.council.forEach((c, i) => {
    inRange(`council[${i}].trustInPlayer`, c.trustInPlayer, INDEX_MIN, INDEX_MAX);
    inRange(`council[${i}].patience`, c.patience, INDEX_MIN, INDEX_MAX);
  });

  inRange('moral.conscience', state.moral.conscience, MORAL_MIN, MORAL_MAX);
  inRange('moral.reputation', state.moral.reputation, MORAL_MIN, MORAL_MAX);

  return { ok: errors.length === 0, errors };
}
