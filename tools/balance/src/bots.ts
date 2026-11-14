/**
 * I bot di bilanciamento. Ogni bot, a ogni turno, propone un elenco ordinato di
 * azioni e, se c'è un dilemma
 * aperto, sceglie un'opzione. Tutto il caso passa da rngFor: stesso seme,
 * stessa partita.
 */
import {
  rngFor,
  type Action,
  type ActivePath,
  type DilemmaOption,
  type GameState,
  type MoralWeights,
  type ProjectDefinition,
  type Rng,
  type TurnRules,
} from '@taranto2127/sim';

export interface Bot {
  id: string;
  nome: string;
  /** Azioni proposte per il turno, in ordine di preferenza. */
  decide(state: GameState, rules: TurnRules, rng: Rng): Action[];
  /** Opzione scelta per il dilemma aperto. */
  answer(state: GameState, rules: TurnRules, rng: Rng): string;
}

export const PATHS: readonly ActivePath[] = ['green-steel', 'remediation', 'energy', 'sea-culture'];

const moralSum = (weights: MoralWeights | undefined): number =>
  Object.values(weights ?? {}).reduce((a, b) => a + (b ?? 0), 0);

/** Denaro che un'opzione di dilemma sposta subito e dopo: positivo se ne porta, negativo se costa. */
function optionMoney(option: DilemmaOption): number {
  const sets = [option.immediate, ...option.delayed.map((d) => d.effects)];
  return sets.flatMap((s) => s.deltas).filter((d) => d.target.startsWith('economy.funds.')).reduce((a, d) => a + d.amount, 0);
}

function openOptions(state: GameState, rules: TurnRules): [string, DilemmaOption][] {
  return Object.entries(rules.dilemmas[state.openDilemmaId!]!.options);
}

/** Sceglie l'opzione con il punteggio più alto; a parità, la prima in ordine di dati. */
function best(options: [string, DilemmaOption][], score: (o: DilemmaOption) => number): string {
  let chosen = options[0]!;
  for (const option of options) if (score(option[1]) > score(chosen[1])) chosen = option;
  return chosen[0];
}

const randomOption = (state: GameState, rules: TurnRules, rng: Rng): string => {
  const options = openOptions(state, rules);
  return options[rng.int(0, options.length - 1)]![0];
};

const active = (state: GameState): number =>
  state.projects.filter((p) => p.phase !== 'operating' && p.phase !== 'cancelled').length;

const totalWorksCost = (def: ProjectDefinition): number => def.phases.works.annualCost * def.phases.works.maxTurns;

const startedIds = (state: GameState): Set<string> =>
  new Set(state.projects.filter((p) => p.phase !== 'cancelled').map((p) => p.definitionId));

/** Opere di quartiere (non di riconversione) non ancora avviate, in ordine di dati. */
function nextDistrictProjects(state: GameState, rules: TurnRules): string[] {
  const lotDefs = new Set(Object.values(rules.lotConversion));
  const started = startedIds(state);
  return Object.values(rules.projects)
    .filter((d) => !lotDefs.has(d.id) && !(d.unique === true && started.has(d.id)))
    .map((d) => d.id);
}

/**
 * Comportamento di governo comune a Blu e Red: tiene aperti al massimo tre
 * cantieri di quartiere e riconverte un lotto fermo ogni cinque anni,
 * alternando le quattro strade. Così nessuna strada è preferita (regola 5).
 */
function govern(state: GameState, rules: TurnRules): Action[] {
  const actions: Action[] = [];
  if (active(state) < 3) {
    const next = nextDistrictProjects(state, rules)[0];
    if (next !== undefined) actions.push({ kind: 'start-project', definitionId: next });
  }
  if (state.turn % 5 === 0) {
    const idle = state.plantLots.find((l) => l.path === 'idle');
    if (idle !== undefined) actions.push({ kind: 'convert-lot', lotId: idle.id, path: PATHS[(state.turn / 5) % PATHS.length]! });
  }
  return actions;
}

export const allBlue: Bot = {
  id: 'blu',
  nome: 'Tutto Blu',
  decide(state, rules) {
    const actions: Action[] = [];
    for (const policy of Object.values(rules.policies)) {
      const ethical = moralSum(policy.activationMoral) + moralSum(policy.annualMoral) > 0;
      if (ethical && !state.activePolicies.includes(policy.id) && state.economy.funds[policy.fund] >= 3 * policy.annualCost) {
        actions.push({ kind: 'set-policy', policyId: policy.id, active: true });
        break;
      }
    }
    return [...actions, ...govern(state, rules)];
  },
  answer: (state, rules) => best(openOptions(state, rules), (o) => moralSum(o.moral)),
};

export const allRed: Bot = {
  id: 'red',
  nome: 'Tutto Red',
  decide(state, rules) {
    const shortcuts: Action[] = state.projects
      .filter((p) => p.phase === 'permitting' || p.phase === 'tender')
      .map((p) => ({ kind: 'shortcut-phase', projectId: p.id }));
    return [...shortcuts, ...govern(state, rules)];
  },
  answer: (state, rules) => best(openOptions(state, rules), (o) => -moralSum(o.moral)),
};

export const randomBot: Bot = {
  id: 'casuale',
  nome: 'Casuale',
  decide(state, rules, rng) {
    const pick = <T,>(xs: readonly T[]): T => xs[rng.int(0, xs.length - 1)]!;
    const definitions = Object.keys(rules.projects);
    const policies = Object.keys(rules.policies);
    const actions: Action[] = [];
    for (let i = rng.int(0, 4); i > 0; i--) {
      const candidates: Action[] = [
        { kind: 'start-project', definitionId: pick(definitions) },
        { kind: 'convert-lot', lotId: pick(state.plantLots).id, path: pick(['idle', ...PATHS]) },
        { kind: 'set-policy', policyId: pick(policies), active: rng.next() < 0.6 },
      ];
      if (state.projects.length > 0) {
        candidates.push({ kind: 'cancel-project', projectId: pick(state.projects).id });
        candidates.push({ kind: 'shortcut-phase', projectId: pick(state.projects).id });
      }
      actions.push(pick(candidates));
    }
    return actions;
  },
  answer: randomOption,
};

/** Una sola strada: ogni lotto fermo viene avviato verso quella strada, uno per turno. Nient'altro. */
export function singlePath(path: ActivePath): Bot {
  return {
    id: `strada-${path}`,
    nome: `Una sola strada: ${path}`,
    decide(state) {
      const idle = state.plantLots.find((l) => l.path === 'idle');
      return idle === undefined ? [] : [{ kind: 'convert-lot', lotId: idle.id, path }];
    },
    answer: randomOption,
  };
}

/**
 * Prudente sui conti: non spende mai fondi propri per le politiche; avvia
 * un'opera solo se i fondi propri sono sopra una riserva e il fondo dei lavori
 * copre l'intero cantiere; ai dilemmi sceglie l'opzione che costa meno.
 */
export const prudent: Bot = {
  id: 'prudente',
  nome: 'Prudente sui conti',
  decide(state, rules) {
    if (state.economy.funds.own < 20 || active(state) >= 2) return [];
    const affordable = nextDistrictProjects(state, rules)
      .map((id) => rules.projects[id]!)
      .filter((d) => state.economy.funds[d.phases.works.fund] >= totalWorksCost(d))
      .sort((a, b) => totalWorksCost(a) - totalWorksCost(b));
    return affordable.length === 0 ? [] : [{ kind: 'start-project', definitionId: affordable[0]!.id }];
  },
  answer: (state, rules) => best(openOptions(state, rules), (o) => optionMoney(o) * 1000 + moralSum(o.moral)),
};

/** Nessuna azione: risponde ai dilemmi, che lo richiedono per andare avanti, sempre con la prima opzione. */
export const idleBot: Bot = {
  id: 'nessuna',
  nome: 'Nessuna azione',
  decide: () => [],
  answer: (state, rules) => openOptions(state, rules)[0]![0],
};

export const BOTS: readonly Bot[] = [allBlue, allRed, randomBot, ...PATHS.map(singlePath), prudent, idleBot];

/** Flusso casuale del bot per un turno di una partita. */
export const botRng = (seed: number, botId: string, turn: number, purpose: string): Rng =>
  rngFor(seed, 'bilanciamento', botId, turn, purpose);
