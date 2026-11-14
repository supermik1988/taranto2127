/**
 * REGOLE FINTE, SOLO PER I TEST.
 *
 * Durate, costi, occupati e scenario climatico qui sotto sono inventati per
 * esercitare il motore e non vengono da alcuna fonte. I valori veri, con
 * fonte, arrivano con la scheda T05 in packages/content.
 */
import type { FundKind, GameState } from '../state.js';
import type { EconomyRules, PhaseSpec, ProjectDefinition, TurnRules } from '../turn.js';

const phase = (minTurns: number, maxTurns = minTurns, annualCost = 1, fund: FundKind = 'state'): PhaseSpec => ({
  minTurns,
  maxTurns,
  annualCost,
  fund,
});

const lotProject = (id: string, works: number): ProjectDefinition => ({
  id,
  phases: { design: phase(1), permitting: phase(1), tender: phase(0), works: phase(works, works, 2, 'eu-earmarked') },
  worksJobs: { sector: 'remediation', count: 50 },
  operatingEffects: { once: { deltas: [] }, everyYear: { deltas: [] } },
});

export const fakeRules = (): TurnRules => ({
  projects: {
    // Fasi di 1, 2, 1 e 4 anni: entra in esercizio 8 turni dopo l'avvio.
    'progetto-finto-8-anni': {
      id: 'progetto-finto-8-anni',
      phases: { design: phase(1), permitting: phase(2), tender: phase(1), works: phase(4, 4, 5) },
      worksJobs: { sector: 'services', count: 30 },
      operatingEffects: {
        once: { deltas: [{ target: 'districts.tamburi.greenCover', amount: 10 }] },
        everyYear: { deltas: [{ target: 'districts.tamburi.trust', amount: 1 }] },
      },
    },
    // Durate variabili: il generatore con seme sceglie tra minimo e massimo.
    'progetto-finto-variabile': {
      id: 'progetto-finto-variabile',
      phases: { design: phase(1, 3), permitting: phase(1, 4), tender: phase(0, 2), works: phase(2, 6, 3) },
      worksJobs: { sector: 'energy', count: 20 },
      operatingEffects: { once: { deltas: [{ target: 'districts.borgo.services', amount: 5 }] }, everyYear: { deltas: [] } },
    },
    // Senza gara: la fase con durata 0 viene saltata. Gratuito, senza cantiere.
    'progetto-finto-senza-gara': {
      id: 'progetto-finto-senza-gara',
      phases: { design: phase(1, 1, 0), permitting: phase(1, 1, 0), tender: phase(0, 0, 0), works: phase(1, 1, 0) },
      worksJobs: { sector: 'public', count: 0 },
      operatingEffects: { once: { deltas: [{ target: 'economy.averageIncome', amount: 1 }] }, everyYear: { deltas: [] } },
    },
    // Costo fisso: 2 milioni l'anno in ogni fase da un anno.
    'progetto-finto-costo-fisso': {
      id: 'progetto-finto-costo-fisso',
      phases: { design: phase(1, 1, 2), permitting: phase(1, 1, 2), tender: phase(1, 1, 2), works: phase(1, 1, 2) },
      worksJobs: { sector: 'public', count: 5 },
      operatingEffects: { once: { deltas: [] }, everyYear: { deltas: [] } },
    },
    // Riconversione dei lotti: 2 anni di preparazione più i lavori.
    'lotto-acciaio-verde': lotProject('lotto-acciaio-verde', 1),
    'lotto-bonifica': lotProject('lotto-bonifica', 2),
    'lotto-energia': lotProject('lotto-energia', 1),
    'lotto-mare-cultura': lotProject('lotto-mare-cultura', 3),
  },
  dilemmas: {
    'dilemma-finto': {
      id: 'dilemma-finto',
      conditions: [],
      firstTurn: 0,
      lastTurn: 100,
      weight: 1,
      repeatable: true,
      options: {
        // Palese: muove coscienza e reputazione.
        palese: {
          immediate: { deltas: [{ target: 'districts.tamburi.trust', amount: 2 }] },
          delayed: [{ delayTurns: 3, effects: { deltas: [{ target: 'districts.tamburi.health', amount: 1 }] } }],
          moral: { truth: 5, listening: 3 },
          hidden: false,
        },
        // Nascosta: muove solo la coscienza, due atti nascosti.
        nascosta: {
          immediate: { deltas: [{ target: 'economy.funds.own', amount: 5 }] },
          delayed: [],
          moral: { truth: -4, legality: -3 },
          hidden: true,
        },
        // Un solo atto nascosto sulla legalità.
        'nascosta-legalita': {
          immediate: { deltas: [] },
          delayed: [],
          moral: { legality: -3 },
          hidden: true,
        },
        // Promessa con condizione verificabile.
        promessa: {
          immediate: { deltas: [] },
          delayed: [],
          moral: { listening: 2 },
          hidden: false,
          promise: {
            text: 'Più verde ai Tamburi entro tre anni',
            dueInTurns: 3,
            toDistrict: 'tamburi',
            condition: { target: 'districts.tamburi.greenCover', comparator: '>=', value: 60 },
          },
        },
        // Promessa a testo libero: resta aperta.
        'promessa-libera': {
          immediate: { deltas: [] },
          delayed: [],
          moral: {},
          hidden: false,
          promise: { text: 'Ascolteremo i comitati', dueInTurns: 2 },
        },
      },
    },
  },
  // Di serie nessun dilemma arriva da solo: i test che lo vogliono alzano la probabilità.
  dilemmaArrivalProbability: 0,
  policies: {
    // Politica con costo, effetti annui, anni minimi e peso morale all'attivazione.
    'politica-verde': {
      id: 'politica-verde',
      annualCost: 2,
      fund: 'state',
      everyYear: { deltas: [{ target: 'districts.tamburi.greenCover', amount: 1 }] },
      minYearsActive: 3,
      activationMoral: { listening: 2 },
      annualMoral: { care: 1 },
    },
    // Formazione: 10 persone l'anno, 2 anni di corso.
    formazione: {
      id: 'formazione',
      annualCost: 1,
      fund: 'own',
      everyYear: { deltas: [] },
      minYearsActive: 0,
      training: { peoplePerYear: 10, durationYears: 2 },
    },
    // Politiche gratuite e senza effetti, per i test sulle azioni libere.
    ...Object.fromEntries(
      ['politica-finta', 'p', 'p0', 'p1', 'p2', 'p3', 'ok', 'troppe'].map((id) => [
        id,
        { id, annualCost: 0, fund: 'own' as const, everyYear: { deltas: [] }, minYearsActive: 0 },
      ]),
    ),
  },
  moral: {
    dimensionWeights: { truth: 1, word: 1, care: 1, legality: 1, listening: 1 },
    scandal: { baseProbability: 0.02, probabilityPerGapPoint: 0.002, maxProbability: 0.5, reputationDropBelowConscience: 10 },
    shortcutLegalityWeight: -5,
    promiseKeptWordWeight: 5,
    promiseBrokenWordWeight: -10,
  },
  // Economia neutra: nessuna entrata né spesa obbligata, così i test sui
  // progetti contano i fondi in modo esatto. Per l'economia vedi activeEconomy.
  economy: {
    ownRevenuePerWorker: 0,
    stateTransferPerYear: 0,
    euTranches: [],
    wageSupportCostPerPerson: 0,
    servicesCostPerYear: 0,
    bankruptcyAfterDeficitYears: 5,
  },
  lotConversion: {
    'green-steel': 'lotto-acciaio-verde',
    remediation: 'lotto-bonifica',
    energy: 'lotto-energia',
    'sea-culture': 'lotto-mare-cultura',
  },
  climateScenario: {
    id: 'scenario-finto',
    annualChangeByEpoch: [
      { seaLevelRiseCm: 0.5, summerHeat: 0.2, waterStress: 0.1 },
      { seaLevelRiseCm: 0.6, summerHeat: 0.2, waterStress: 0.1 },
      { seaLevelRiseCm: 0.7, summerHeat: 0.3, waterStress: 0.2 },
      { seaLevelRiseCm: 0.8, summerHeat: 0.3, waterStress: 0.2 },
      { seaLevelRiseCm: 0.9, summerHeat: 0.4, waterStress: 0.3 },
    ],
  },
});

/** Economia finta con entrate e spese: anche questi numeri sono inventati. */
export const activeEconomy = (): EconomyRules => ({
  ownRevenuePerWorker: 0.02,
  stateTransferPerYear: 10,
  euTranches: [
    { id: 'rata-finta-1', amount: 20, arrivesInYear: 2028, expiresInYear: 2030 },
    { id: 'rata-finta-2', amount: 30, arrivesInYear: 2035, expiresInYear: 2040 },
  ],
  wageSupportCostPerPerson: 0.01,
  servicesCostPerYear: 2,
  bankruptcyAfterDeficitYears: 3,
});

export const fakeRulesWithEconomy = (): TurnRules => ({ ...fakeRules(), economy: activeEconomy() });

/** Apre a mano un dilemma, come farebbe il motore all'apertura del turno. Solo per i test. */
export const withOpenDilemma = (state: GameState, dilemmaId = 'dilemma-finto'): GameState => ({ ...state, openDilemmaId: dilemmaId });
