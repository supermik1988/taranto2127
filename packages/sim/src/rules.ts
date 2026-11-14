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
  /** true: si avvia una sola volta nella partita, salvo annullamento. */
  unique?: boolean;
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
  /** Tetto di riporto del fondo statale: a fine anno la parte oltre il tetto torna allo Stato. */
  stateCarryOverCap: number;
  /** Riserva dei fondi propri: a fine anno l'avanzo oltre la riserva si spende in servizi. */
  ownSurplusReserve: number;
  /** Punti di servizi guadagnati da ogni quartiere per ogni milione di avanzo speso. */
  servicesPerSurplusMillion: number;
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
  /** Penale applicata se la scelta, nascosta, viene scoperta. */
  scandalPenalty?: EffectSet;
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
  /**
   * Solo per i ripetibili: anni minimi tra un arrivo e il successivo. In più,
   * un dilemma non torna nella stessa epoca se ce ne sono altri ammessi.
   */
  repeatAfterTurns?: number;
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

/** Stato di un lotto di ILSIDER ai fini dell'aria. */
export interface LotPressures {
  /** Fermo e non bonificato (anche durante progettazione, autorizzazioni e gara). */
  idleContaminated: number;
  /** Con un cantiere aperto. */
  works: number;
  /** Bonificato e senza altra attività. */
  remediated: number;
  /** In esercizio, per ciascuna strada. */
  operating: Record<ActivePath, number>;
}

/** Come la città reagisce ogni anno. Le quote "approachShare" vanno da 0 (fermo) a 1 (subito). */
export interface CityRules {
  air: {
    /** Aria che un quartiere avrebbe senza alcuna pressione dai lotti. */
    cleanValue: number;
    approachShare: number;
    pressures: LotPressures;
    /** Peso di ogni lotto (per id) su ogni quartiere; un quartiere assente non risente del lotto. */
    lotWeights: Record<string, Partial<Record<DistrictId, number>>>;
  };
  exposure: {
    /** Sotto questa qualità dell'aria l'esposizione cresce. */
    airThreshold: number;
    /** Aumento annuo per ogni punto di aria sotto la soglia. */
    growthPerPointBelow: number;
    /** Calo annuo con l'aria sopra la soglia. */
    decayPerYear: number;
  };
  health: { base: number; exposureWeight: number; servicesWeight: number; approachShare: number };
  services: {
    /** Calo annuo dei servizi in ogni quartiere negli anni di disavanzo dei fondi propri. */
    deficitDropPerYear: number;
    /** Risalita annua negli anni in attivo, fino al tetto. */
    recoveryPerYear: number;
    recoveryCeiling: number;
  };
  tension: { base: number; joblessWeight: number; distrustWeight: number; approachShare: number };
  trust: {
    base: number;
    /** Peso della reputazione (da -100 a +100). */
    reputationWeight: number;
    /** Peso della salute rispetto a 50. */
    healthWeight: number;
    /** Peso della quota di cassa integrati e disoccupati sulla forza lavoro (0-100). */
    joblessWeight: number;
    approachShare: number;
    promiseKeptBoost: number;
    promiseBrokenDrop: number;
  };
  scandal: {
    /** Calo immediato della fiducia di ogni quartiere per ogni atto scoperto. */
    districtTrustDrop: number;
    /** Calo immediato della fiducia di ogni consigliere per ogni atto scoperto. */
    councilTrustDrop: number;
    /** Anni di fermo di un progetto la cui scorciatoia è stata scoperta. */
    shortcutFrozenYears: number;
  };
  civic: {
    /** Fattore con fiducia media zero. */
    minFactor: number;
    /** Fattore con fiducia media pari o superiore a fullFactorTrust; può superare 1. */
    maxFactor: number;
    /** Fiducia media da cui il fattore raggiunge il suo tetto. */
    fullFactorTrust: number;
  };
  abandonment: { trustThreshold: number; years: number };
}

/** Numeri che il ciclo del turno legge dai dati (CLAUDE.md, regola 4). */
export interface TurnRules {
  city: CityRules;
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
