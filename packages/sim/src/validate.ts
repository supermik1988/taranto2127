import {
  TOTAL_TURNS,
  type ClimateState,
  type DistrictId,
  type DistrictState,
  type FundKind,
  type GameState,
} from './state.js';

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

/**
 * Campi "indice" del clima con tetto a 100. co2Emissions è aperto verso l'alto
 * (solo >= 0) e seaLevelRiseCm è in centimetri: entrambi restano fuori.
 */
const CLIMATE_INDICES = ['summerHeat', 'waterStress'] as const satisfies readonly (keyof ClimateState)[];

/** Fondi che non possono andare sotto zero. 'own' sì: è il disavanzo del Comune. */
const NON_NEGATIVE_FUNDS = ['state', 'eu-earmarked', 'private'] as const satisfies readonly FundKind[];

const INDEX_MIN = 0;
const INDEX_MAX = 100;
const MORAL_MIN = -100;
const MORAL_MAX = 100;

/**
 * Controlla gli invarianti dello stato: indici tra 0 e 100, quantità non
 * negative, contatori morali tra -100 e +100, turno e avanzamento dei lotti
 * nei loro intervalli. Non lancia eccezioni: restituisce l'elenco completo
 * delle violazioni.
 */
export function validateState(state: GameState): ValidationResult {
  const errors: string[] = [];

  const inRange = (path: string, value: number, min: number, max: number): void => {
    // La forma negata cattura anche NaN.
    if (!(value >= min && value <= max)) {
      errors.push(`${path} = ${value}: deve stare tra ${min} e ${max}`);
    }
  };
  const nonNegative = (path: string, value: number): void => {
    if (!(value >= 0)) errors.push(`${path} = ${value}: non può essere negativo`);
  };

  inRange('turn', state.turn, 0, TOTAL_TURNS);

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
      nonNegative(`districts.${id}.population.${band}`, count);
    }
  }

  for (const [sector, count] of Object.entries(state.labor.employed)) {
    nonNegative(`labor.employed.${sector}`, count);
  }
  nonNegative('labor.onWageSupport', state.labor.onWageSupport);
  nonNegative('labor.unemployed', state.labor.unemployed);
  nonNegative('labor.inTraining', state.labor.inTraining);

  inRange('economy.averageIncome', state.economy.averageIncome, INDEX_MIN, INDEX_MAX);
  nonNegative('economy.supplierFirms', state.economy.supplierFirms);
  nonNegative('economy.spendingCapacity', state.economy.spendingCapacity);
  for (const kind of NON_NEGATIVE_FUNDS) {
    nonNegative(`economy.funds.${kind}`, state.economy.funds[kind]);
  }

  nonNegative('climate.co2Emissions', state.climate.co2Emissions);
  for (const field of CLIMATE_INDICES) {
    inRange(`climate.${field}`, state.climate[field], INDEX_MIN, INDEX_MAX);
  }

  state.plantLots.forEach((lot, i) => {
    inRange(`plantLots[${i}].progress`, lot.progress, 0, 1);
  });

  state.council.forEach((c, i) => {
    inRange(`council[${i}].trustInPlayer`, c.trustInPlayer, INDEX_MIN, INDEX_MAX);
    inRange(`council[${i}].patience`, c.patience, INDEX_MIN, INDEX_MAX);
  });

  inRange('moral.conscience', state.moral.conscience, MORAL_MIN, MORAL_MAX);
  inRange('moral.reputation', state.moral.reputation, MORAL_MIN, MORAL_MAX);
  for (const [dimension, value] of Object.entries(state.moral.byDimension)) {
    inRange(`moral.byDimension.${dimension}`, value, MORAL_MIN, MORAL_MAX);
  }

  return { ok: errors.length === 0, errors };
}
