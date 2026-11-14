/**
 * TARANTO2127 — contratto tra motore, cittadini e interfaccia.
 * Si modifica solo con l'approvazione dell'architetto (vedi CLAUDE.md, regola 11).
 * Tutti i valori "indice" vanno da 0 a 100, salvo dove indicato.
 */

// ---------- Tempo ----------

export const START_YEAR = 2027;
export const YEARS_PER_TURN = 1;
export const TOTAL_TURNS = 100;
export const TURNS_PER_EPOCH = 20;
export const TOTAL_EPOCHS = TOTAL_TURNS / TURNS_PER_EPOCH; // 5

/** Anno in cui inizia un turno (turno 0 = 2027). */
export const yearOfTurn = (turn: number): number => START_YEAR + turn * YEARS_PER_TURN;
/** Epoca di un turno, da 0 a 4. */
export const epochOfTurn = (turn: number): number => Math.floor(turn / TURNS_PER_EPOCH);

// ---------- Geografia ----------

export type DistrictId =
  | 'tamburi'
  | 'paolo-vi'
  | 'citta-vecchia'
  | 'borgo'
  | 'talsano-lama-san-vito'
  | 'area-industriale';

export interface DistrictState {
  id: DistrictId;
  /** Residenti per fascia d'età. */
  population: { young: number; adult: number; elder: number };
  airQuality: number; // indice, 100 = aria pulita
  contaminatedSoil: number; // indice, 100 = tutto contaminato
  /** Esposizione accumulata negli anni: scende lentamente, guida la salute. */
  cumulativeExposure: number; // indice
  health: number; // indice
  services: number; // indice: scuole, cure, trasporti
  greenCover: number; // indice
  floodRisk: number; // indice: cresce con il livello del mare
  trust: number; // indice
  tension: number; // indice
  belonging: number; // indice: senso di appartenenza
}

// ---------- Lavoro ed economia ----------

export type Sector =
  | 'steel'
  | 'remediation'
  | 'energy'
  | 'sea'
  | 'culture-tourism'
  | 'services'
  | 'public';

export interface LaborState {
  employed: Record<Sector, number>;
  onWageSupport: number; // cassa integrazione
  unemployed: number;
  inTraining: number;
  /**
   * Disoccupati che hanno finito una formazione. Sono già contati in
   * `unemployed` (non si sommano alla forza lavoro) e non ne superano mai il numero.
   */
  trained: number;
}

/** Persone entrate in formazione nello stesso anno con la stessa politica. */
export interface TrainingCohort {
  policyId: string;
  count: number;
  /** A fine di questo turno la coorte finisce la formazione e torna tra i disoccupati, formata. */
  completesOnTurn: number;
}

export type FundKind = 'own' | 'state' | 'eu-earmarked' | 'private';

export interface EconomyState {
  /** Milioni di euro disponibili per tipo di fondo. */
  funds: Record<FundKind, number>;
  averageIncome: number; // indice
  supplierFirms: number; // imprese dell'indotto attive
  /** Quanta spesa la macchina amministrativa riesce a realizzare per turno (milioni). */
  spendingCapacity: number;
  /** Anni consecutivi chiusi con i fondi propri in disavanzo: oltre la soglia dei dati, dissesto. */
  deficitYears: number;
  /** Rate europee arrivate e non ancora scadute, con la parte non spesa. */
  euTranches: EuTranche[];
}

/** Rata di fondi europei vincolati: ciò che non si spende entro la scadenza va perso. */
export interface EuTranche {
  id: string;
  /** Milioni ancora da spendere. */
  remaining: number;
  /** Ultimo turno utile: a fine turno la parte non spesa viene tolta dal fondo. */
  expiresOnTurn: number;
}

export interface ClimateState {
  co2Emissions: number; // indice aperto verso l'alto: 100 = livello del 2026, minimo 0
  seaLevelRiseCm: number; // rispetto al 2027
  summerHeat: number; // indice
  waterStress: number; // indice
}

// ---------- ILSIDER ----------

export type ConversionPath = 'idle' | 'green-steel' | 'remediation' | 'energy' | 'sea-culture';

export interface PlantLot {
  id: string;
  path: ConversionPath;
  /** Avanzamento della trasformazione in corso, da 0 a 1. */
  progress: number;
  remediated: boolean;
}

// ---------- Cantieri e iter ----------

/**
 * Ogni costruzione, bonifica o riforma è un progetto che attraversa fasi con
 * durate realistiche, definite nei dati (packages/content) e verificate su fonti.
 * Nessun progetto produce effetti prima della fase 'operating'.
 */
export type ProjectPhase =
  | 'design' // progettazione
  | 'permitting' // autorizzazioni e valutazioni ambientali
  | 'tender' // gara e affidamento
  | 'works' // lavori
  | 'operating' // in funzione
  | 'cancelled';

export interface Project {
  id: string;
  /** Riferimento alla definizione nei dati: durate, costi, effetti. */
  definitionId: string;
  lotId?: string;
  district?: DistrictId;
  phase: ProjectPhase;
  startedOnTurn: number;
  /** Turni (anni) ancora necessari per chiudere la fase in corso. */
  turnsLeftInPhase: number;
  /** Anni di ritardo accumulati: ricorsi, fondi fermi, proteste, uffici saturi. */
  delayTurns: number;
  /** true se una fase è stata saltata o accorciata con una scorciatoia Red. */
  shortcutTaken: boolean;
  /** Persone della città assunte dal cantiere (fase 'works'); i posti coperti da fuori non contano. */
  localHires: number;
  /** true se il cantiere è fermo per mancanza di fondi o capacità: gli assunti locali sono in cassa. */
  worksStalled: boolean;
  /** Posti del cantiere coperti da lavoratori di fuori città: non entrano nella forza lavoro locale. */
  outsideHires: number;
  /** Anni in cui il progetto resta fermo, per esempio dopo uno scandalo su una scorciatoia. */
  frozenTurns: number;
  /** true quando gli effetti "una volta" dell'esercizio sono già stati programmati: non si ripetono. */
  onceEffectsApplied: boolean;
}

// ---------- Morale ----------

export type MoralDimension = 'truth' | 'word' | 'care' | 'legality' | 'listening';

export interface MoralState {
  /** Contatore reale, da -100 (Red) a +100 (Blu). */
  conscience: number;
  /** Ciò che i cittadini credono, da -100 a +100. */
  reputation: number;
  /** Ogni dimensione da -100 a +100. */
  byDimension: Record<MoralDimension, number>;
  /** Atti Red non ancora scoperti: alimentano il rischio di scandalo. */
  hiddenActs: HiddenAct[];
  /** Registro degli scandali: ogni atto nascosto scoperto, con l'anno della scoperta. */
  scandals: Scandal[];
}

/** Un atto nascosto venuto alla luce. */
export interface Scandal {
  /** Turno (anno) in cui l'atto è stato scoperto. */
  turn: number;
  /** Identificativo dell'atto scoperto (era in hiddenActs). */
  actId: string;
  dimension: MoralDimension;
  /** Da dove veniva l'atto, se noto. */
  source?: ActSource;
}

/** Origine di un atto nascosto: decide le conseguenze quando viene scoperto. */
export type ActSource =
  | { kind: 'shortcut'; projectId: string; skippedPhase: 'permitting' | 'tender' }
  | { kind: 'dilemma'; dilemmaId: string; optionId: string };

export interface HiddenAct {
  id: string;
  turn: number;
  dimension: MoralDimension;
  weight: number;
  source?: ActSource;
}

/** Promessa fatta dal giocatore, ricordata dai cittadini e dai loro figli. */
export interface Promise {
  id: string;
  madeOnTurn: number;
  dueByTurn: number;
  toDistrict?: DistrictId;
  toFaction?: string;
  text: string;
  status: 'open' | 'kept' | 'broken';
  /**
   * Condizione verificabile, solo per le promesse nate da un dilemma. Alla
   * scadenza decide tra 'kept' e 'broken'. Senza condizione la promessa resta
   * 'open' e la valuteranno le voci.
   */
  condition?: PromiseCondition;
}

/** Confronto tra una variabile dello stato e un valore, es. "districts.tamburi.airQuality >= 60". */
export interface PromiseCondition {
  /** Percorso della variabile, come nei Delta. */
  target: string;
  comparator: '>=' | '>' | '<=' | '<' | '==';
  value: number;
}

// ---------- Consiglio ----------

export type Vision =
  | 'work-industry'
  | 'health-environment'
  | 'sea-culture'
  | 'public-accounts'
  | 'youth-future'
  | 'districts-periphery';

export interface Councillor {
  id: string;
  name: string;
  vision: Vision;
  /** Fiducia verso il giocatore, indice. */
  trustInPlayer: number;
  /** Pazienza: sotto soglia, propone anche scorciatoie Red. Indice. */
  patience: number;
  electedInEpoch: number;
}

// ---------- Effetti ritardati ----------

export interface Delta {
  /** Percorso della variabile, es. "districts.tamburi.airQuality". */
  target: string;
  amount: number;
}

/** Categoria della forza lavoro: un settore di occupazione o una delle altre condizioni. */
export type LaborCategory = Sector | 'onWageSupport' | 'unemployed' | 'inTraining';

/**
 * Spostamento di persone tra due categorie della forza lavoro. È l'unico modo
 * in cui un effetto tocca il lavoro: la forza lavoro totale non cambia, e si
 * sposta al massimo chi c'è nella categoria di partenza.
 */
export interface LaborMove {
  from: LaborCategory;
  to: LaborCategory;
  count: number;
}

export interface PendingEffect {
  id: string;
  sourceId: string; // azione o dilemma che lo ha generato
  dueOnTurn: number;
  deltas: Delta[];
  laborMoves: LaborMove[];
}

// ---------- Azioni del giocatore ----------

export type Action =
  | { kind: 'convert-lot'; lotId: string; path: ConversionPath }
  | { kind: 'start-project'; definitionId: string; lotId?: string; district?: DistrictId }
  | { kind: 'cancel-project'; projectId: string }
  | { kind: 'set-policy'; policyId: string; active: boolean }
  | { kind: 'negotiate'; factionId: string; offerId: string }
  | { kind: 'make-promise'; text: string; dueByTurn: number; toDistrict?: DistrictId; toFaction?: string }
  | { kind: 'answer-dilemma'; dilemmaId: string; optionId: string }
  | { kind: 'answer-protest'; protestId: string; response: 'meet' | 'ignore' | 'promise' | 'clear' }
  /** Scorciatoia Red: salta la fase di autorizzazione o di gara di un progetto. */
  | { kind: 'shortcut-phase'; projectId: string };

// Nessun limite al numero di azioni per anno (T10): i limiti sono fondi e
// capacità di spesa degli uffici.

// ---------- Cervello dei cittadini ----------

/** Chi prende le decisioni dei cittadini in questa partita. Di serie: 'rules'. */
export type DecisionProviderKind = 'rules' | 'decision-model' | 'language-model';

/**
 * Decisione presa da un provider non deterministico. Va registrata per poter
 * rigiocare la partita identica e per l'analisi di ricerca.
 */
export interface RecordedDecision {
  turn: number;
  /** Gruppo di cittadini o consigliere che ha deciso. */
  subjectId: string;
  question: string;
  /** Probabilità restituita per ogni opzione ammessa. */
  distribution: Record<string, number>;
  chosen: string;
}

// ---------- Stato complessivo ----------

export interface GameState {
  seed: number;
  /** Versione dei dati e dei pesi con cui la partita è stata giocata. */
  calibrationVersion: string;
  turn: number; // da 0 a TOTAL_TURNS
  districts: Record<DistrictId, DistrictState>;
  labor: LaborState;
  economy: EconomyState;
  climate: ClimateState;
  plantLots: PlantLot[];
  projects: Project[];
  activePolicies: string[];
  /** Turno di attivazione di ogni politica attiva. */
  policySince: Record<string, number>;
  /** Coorti ancora in formazione. */
  trainingCohorts: TrainingCohort[];
  /** Dilemma arrivato e in attesa di risposta: finché c'è, il turno non avanza. */
  openDilemmaId: string | null;
  /** Anni consecutivi con la fiducia media della città sotto la soglia di abbandono. */
  lowTrustYears: number;
  moral: MoralState;
  promises: Promise[];
  council: Councillor[];
  pendingEffects: PendingEffect[];
  decisionProvider: DecisionProviderKind;
  recordedDecisions: RecordedDecision[];
  /** true solo se il giocatore ha accettato di donare la partita alla ricerca. */
  researchConsent: boolean;
  /** Tutte le azioni dall'inizio: seme + storia bastano a rigiocare la partita. */
  history: { turn: number; action: Action }[];
  status: 'running' | 'ended-2127' | 'ended-bankrupt' | 'ended-abandoned';
}
