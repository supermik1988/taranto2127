/** Una partita completa di un bot, e i numeri che servono al rapporto. */
import {
  ActionError,
  DISTRICT_IDS,
  averageTrust,
  advanceTurn,
  applyAction,
  createInitialState,
  validateState,
  yearOfTurn,
  type DistrictId,
  type GameState,
  type InitialContent,
  type TurnRules,
} from '@taranto2127/sim';
import { botRng, type Bot } from './bots.js';

/** Variabili osservate nel tempo, per scoprire chi cresce o cala senza limite. */
export const TRACKED = {
  'fondi propri': (s: GameState) => s.economy.funds.own,
  'fondo statale': (s: GameState) => s.economy.funds.state,
  'fondo europeo': (s: GameState) => s.economy.funds['eu-earmarked'],
  'capacità di spesa': (s: GameState) => s.economy.spendingCapacity,
  'imprese dell\'indotto': (s: GameState) => s.economy.supplierFirms,
  'reddito medio': (s: GameState) => s.economy.averageIncome,
  'occupati locali': (s: GameState) => Object.values(s.labor.employed).reduce((a, b) => a + b, 0),
  'cassa integrati': (s: GameState) => s.labor.onWageSupport,
  disoccupati: (s: GameState) => s.labor.unemployed,
  'persone formate': (s: GameState) => s.labor.trained,
  emissioni: (s: GameState) => s.climate.co2Emissions,
  coscienza: (s: GameState) => s.moral.conscience,
  reputazione: (s: GameState) => s.moral.reputation,
} as const;
export type TrackedName = keyof typeof TRACKED;

/** Turni in cui si fotografano le variabili osservate. */
export const CHECKPOINTS = [25, 50, 75, 100] as const;

export interface GameResult {
  seed: number;
  status: GameState['status'];
  endTurn: number;
  /** Anno in cui la partita è finita. */
  endYear: number;
  funds: GameState['economy']['funds'];
  localEmployed: number;
  onWageSupport: number;
  unemployed: number;
  conscience: number;
  reputation: number;
  /** Fiducia media della città, pesata sui residenti. */
  averageTrust: number;
  airQuality: Record<DistrictId, number>;
  trust: Record<DistrictId, number>;
  exposure: Record<DistrictId, number>;
  health: Record<DistrictId, number>;
  /** Terreni contaminati dell'area industriale (0-100). */
  industrialSoil: number;
  scandals: number;
  /** Valori delle variabili osservate ai turni di controllo raggiunti. */
  checkpoints: Partial<Record<(typeof CHECKPOINTS)[number], Record<TrackedName, number>>>;
  /** Leve usate davvero (azioni accettate dal motore). */
  levers: string[];
  /** Primo turno in cui ogni leva è stata usata. */
  leverFirstTurn: Record<string, number>;
}

export const leverOfProject = (id: string) => `progetto:${id}`;
export const leverOfPolicy = (id: string) => `politica:${id}`;
export const leverOfOption = (dilemma: string, option: string) => `dilemma:${dilemma}/${option}`;
export const leverOfPath = (path: string) => `strada:${path}`;

const snapshot = (s: GameState): Record<TrackedName, number> =>
  Object.fromEntries(Object.entries(TRACKED).map(([name, read]) => [name, read(s)])) as Record<TrackedName, number>;

export class InvalidStateError extends Error {}

/** Partita interrotta perché il motore ha prodotto uno stato non valido. */
export interface GameFailure {
  botId: string;
  seed: number;
  message: string;
}

/** Gioca una partita fino alla fine. Lancia se lo stato diventa non valido. */
export function playGame(bot: Bot, seed: number, content: InitialContent, rules: TurnRules): GameResult {
  let state = createInitialState(seed, content);
  const checkpoints: GameResult['checkpoints'] = {};
  while (state.status === 'running') {
    for (const action of bot.decide(state, rules, botRng(seed, bot.id, state.turn, 'azioni'))) {
      try {
        state = applyAction(state, action, rules);
      } catch (error) {
        if (!(error instanceof ActionError)) throw error;
      }
    }
    if (state.openDilemmaId !== null) {
      const optionId = bot.answer(state, rules, botRng(seed, bot.id, state.turn, 'dilemma'));
      state = applyAction(state, { kind: 'answer-dilemma', dilemmaId: state.openDilemmaId, optionId }, rules);
    }
    state = advanceTurn(state, rules);
    const errors = validateState(state).errors;
    if (errors.length > 0) throw new InvalidStateError(`${bot.id}, seme ${seed}, turno ${state.turn}: ${errors.join('; ')}`);
    const checkpoint = CHECKPOINTS.find((t) => t === state.turn);
    if (checkpoint !== undefined) checkpoints[checkpoint] = snapshot(state);
  }

  const firstTurn: Record<string, number> = {};
  const use = (lever: string, turn: number) => {
    if (!(lever in firstTurn) || turn < firstTurn[lever]!) firstTurn[lever] = turn;
  };
  for (const { turn, action } of state.history) {
    if (action.kind === 'start-project') use(leverOfProject(action.definitionId), turn);
    if (action.kind === 'set-policy' && action.active) use(leverOfPolicy(action.policyId), turn);
    if (action.kind === 'answer-dilemma') use(leverOfOption(action.dilemmaId, action.optionId), turn);
    if (action.kind === 'convert-lot' && action.path !== 'idle') use(leverOfPath(action.path), turn);
  }
  // I progetti di riconversione partono con convert-lot: contano come usati anche loro.
  for (const project of state.projects) use(leverOfProject(project.definitionId), project.startedOnTurn);

  const perDistrict = (read: (id: DistrictId) => number) =>
    Object.fromEntries(DISTRICT_IDS.map((id) => [id, read(id)])) as Record<DistrictId, number>;
  return {
    seed,
    status: state.status,
    endTurn: state.turn,
    endYear: yearOfTurn(state.turn),
    funds: { ...state.economy.funds },
    localEmployed: TRACKED['occupati locali'](state),
    onWageSupport: state.labor.onWageSupport,
    unemployed: state.labor.unemployed,
    conscience: state.moral.conscience,
    reputation: state.moral.reputation,
    averageTrust: averageTrust(state),
    airQuality: perDistrict((id) => state.districts[id].airQuality),
    trust: perDistrict((id) => state.districts[id].trust),
    exposure: perDistrict((id) => state.districts[id].cumulativeExposure),
    health: perDistrict((id) => state.districts[id].health),
    industrialSoil: state.districts['area-industriale'].contaminatedSoil,
    scandals: state.moral.scandals.length,
    checkpoints,
    levers: Object.keys(firstTurn).sort(),
    leverFirstTurn: Object.fromEntries(Object.entries(firstTurn).sort(([a], [b]) => a.localeCompare(b))),
  };
}
