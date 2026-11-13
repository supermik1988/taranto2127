import type {
  ClimateState,
  Councillor,
  DistrictId,
  DistrictState,
  EconomyState,
  GameState,
  LaborState,
  MoralDimension,
  PlantLot,
} from './state.js';
import { DISTRICT_IDS, validateState } from './validate.js';

export { DISTRICT_IDS };

export const MORAL_DIMENSIONS = Object.keys({
  truth: true,
  word: true,
  care: true,
  legality: true,
  listening: true,
} satisfies Record<MoralDimension, true>) as readonly MoralDimension[];

/** Valori di partenza di un quartiere al 2027: lo stato senza l'identificativo. */
export type DistrictStart = Omit<DistrictState, 'id'>;

/**
 * Contenuti che `createInitialState` riceve dai file di dati (packages/content).
 * I numeri arrivano tutti da qui: il motore non ne inventa (CLAUDE.md, regola 4).
 */
export interface InitialContent {
  /** Versione dei dati e dei pesi, registrata nella partita. */
  calibrationVersion: string;
  districts: Record<DistrictId, DistrictStart>;
  labor: LaborState;
  /** Disavanzo e rate europee partono da zero: li gestisce il motore. */
  economy: Omit<EconomyState, 'deficitYears' | 'euTranches'>;
  climate: ClimateState;
  plantLots: PlantLot[];
  /** Consiglio della prima epoca. */
  council: Omit<Councillor, 'electedInEpoch'>[];
}

export class InvalidInitialStateError extends Error {
  constructor(readonly errors: readonly string[]) {
    super(`Stato iniziale non valido:\n- ${errors.join('\n- ')}`);
    this.name = 'InvalidInitialStateError';
  }
}

/**
 * Costruisce lo stato del turno 0 (2027). Funzione pura: non modifica
 * `content` e lo stato restituito non condivide oggetti con esso.
 * Lancia `InvalidInitialStateError` se i dati producono uno stato non valido.
 */
export function createInitialState(seed: number, content: InitialContent): GameState {
  const data = structuredClone(content);

  const districts = {} as Record<DistrictId, DistrictState>;
  for (const id of DISTRICT_IDS) {
    const start = data.districts[id];
    // Un quartiere mancante nei dati viene segnalato da validateState.
    if (start !== undefined) districts[id] = { id, ...start };
  }

  const byDimension = {} as Record<MoralDimension, number>;
  for (const dimension of MORAL_DIMENSIONS) byDimension[dimension] = 0;

  const state: GameState = {
    seed,
    calibrationVersion: data.calibrationVersion,
    turn: 0,
    districts,
    labor: data.labor,
    economy: { ...data.economy, deficitYears: 0, euTranches: [] },
    climate: data.climate,
    plantLots: data.plantLots,
    projects: [],
    activePolicies: [],
    moral: { conscience: 0, reputation: 0, byDimension, hiddenActs: [] },
    promises: [],
    council: data.council.map((c) => ({ ...c, electedInEpoch: 0 })),
    pendingEffects: [],
    decisionProvider: 'rules',
    recordedDecisions: [],
    researchConsent: false,
    history: [],
    status: 'running',
  };

  const result = validateState(state);
  if (!result.ok) throw new InvalidInitialStateError(result.errors);
  return state;
}
