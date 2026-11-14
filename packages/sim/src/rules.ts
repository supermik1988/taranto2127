/**
 * Regole del turno: la forma dei numeri che il motore legge dai dati
 * (packages/content). Nessuna logica qui, solo tipi e l'ordine delle fasi.
 */
import type { EffectSet } from './effects.js';
import type { MoralRules, MoralWeights } from './moral.js';
import type { ConversionPath, DistrictId, FundKind, ProjectPhase, PromiseCondition, Sector } from './state.js';

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

/** Promessa che nasce da un'opzione di dilemma. */
export interface DilemmaPromise {
  text: string;
  /** Turni concessi per mantenerla, a partire dalla risposta. */
  dueInTurns: number;
  toDistrict?: DistrictId;
  toFaction?: string;
  /** Se presente, alla scadenza decide tra mantenuta e tradita. */
  condition?: PromiseCondition;
}

export interface DilemmaOption {
  /** Effetti applicati subito, alla risposta. */
  immediate: EffectSet;
  /** Effetti che arrivano dopo `delayTurns` turni. */
  delayed: { delayTurns: number; effects: EffectSet }[];
  /** Peso morale dell'opzione, per dimensione. */
  moral: MoralWeights;
  /** true se la scelta resta nascosta ai cittadini: muove solo la coscienza. */
  hidden: boolean;
  promise?: DilemmaPromise;
}

export interface DilemmaDefinition {
  id: string;
  options: Record<string, DilemmaOption>;
  /** Condizioni di comparsa sullo stato: devono valere tutte. */
  conditions: PromiseCondition[];
  /** Primo e ultimo turno in cui il dilemma può arrivare. */
  firstTurn: number;
  lastTurn: number;
  /** Peso nell'estrazione tra i dilemmi ammessi. */
  weight: number;
  /** false: dopo la prima risposta non torna più. */
  repeatable: boolean;
}

/** Formazione offerta da una politica, ogni anno in cui la politica è pagata. */
export interface TrainingSpec {
  /** Persone che passano ogni anno da disoccupate a in formazione (al massimo i disoccupati presenti). */
  peoplePerYear: number;
  /** Anni di formazione, poi tornano tra i disoccupati, formate. */
  durationYears: number;
}

export interface PolicyDefinition {
  id: string;
  /** Milioni di euro all'anno. */
  annualCost: number;
  fund: FundKind;
  /** Effetti di ogni anno in cui la politica è attiva e pagata. */
  everyYear: EffectSet;
  /** Anni minimi di attività prima di poterla spegnere. */
  minYearsActive: number;
  /** Pesi morali palesi registrati alla prima attivazione della partita, mai alle successive. */
  activationMoral?: MoralWeights;
  /** Pesi morali palesi di ogni anno in cui la politica è attiva e pagata. */
  annualMoral?: MoralWeights;
  training?: TrainingSpec;
}

/** Numeri che il ciclo del turno legge dai dati (CLAUDE.md, regola 4). */
export interface TurnRules {
  projects: Record<string, ProjectDefinition>;
  dilemmas: Record<string, DilemmaDefinition>;
  /** Probabilità che in un anno arrivi un dilemma, se ce n'è almeno uno ammesso. */
  dilemmaArrivalProbability: number;
  policies: Record<string, PolicyDefinition>;
  moral: MoralRules;
  economy: EconomyRules;
  /** Per ogni strada di riconversione, la definizione del progetto che trasforma un lotto. */
  lotConversion: Record<ActivePath, string>;
  climateScenario: ClimateScenario;
}
