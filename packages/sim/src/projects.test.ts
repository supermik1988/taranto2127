import { describe, expect, it } from 'vitest';
import { fakeContent } from './__fixtures__/fake-content.js';
import { fakeRules } from './__fixtures__/fake-rules.js';
import { applyDeltas } from './effects.js';
import { createInitialState } from './init.js';
import { rngFor } from './rng.js';
import { TOTAL_TURNS, type Action, type ConversionPath, type GameState } from './state.js';
import { ActionError, advanceTurn, applyAction, type TurnRules } from './turn.js';
import { validateState } from './validate.js';

const rules = fakeRules();
const initial = (seed = 1) => createInitialState(seed, fakeContent());
const advance = (state: GameState, turns: number): GameState => {
  for (let i = 0; i < turns; i++) state = advanceTurn(state, rules);
  return state;
};
const start = (state: GameState, definitionId: string): GameState =>
  applyAction(state, { kind: 'start-project', definitionId }, rules);
const convert = (state: GameState, path: ConversionPath, lotId = 'lotto-finto-a'): GameState =>
  applyAction(state, { kind: 'convert-lot', lotId, path }, rules);
const withEconomy = (
  state: GameState,
  change: { funds?: Partial<GameState['economy']['funds']>; spendingCapacity?: number },
): GameState => ({
  ...state,
  economy: {
    ...state.economy,
    ...(change.spendingCapacity !== undefined && { spendingCapacity: change.spendingCapacity }),
    funds: { ...state.economy.funds, ...change.funds },
  },
});

describe('costi dei progetti', () => {
  it('ogni anno di avanzamento scala il costo della fase dal suo fondo', () => {
    let state = start(initial(), 'progetto-finto-8-anni');
    const before = state.economy.funds;
    state = advance(state, 4); // progettazione, 2 anni di autorizzazione, gara: 1 milione l'anno, fondi statali
    expect(state.economy.funds.state).toBe(before.state - 4);
    state = advance(state, 4); // 4 anni di lavori a 5 milioni
    expect(state.economy.funds.state).toBe(before.state - 24);
    expect(state.economy.funds.own).toBe(before.own);
    state = advance(state, 3); // in esercizio: nessun altro costo
    expect(state.economy.funds.state).toBe(before.state - 24);
  });

  it('un progetto senza fondi resta fermo, accumula ritardo e riparte quando i fondi tornano', () => {
    let state = withEconomy(start(initial(), 'progetto-finto-8-anni'), { funds: { state: 0 } });
    for (let i = 1; i <= 3; i++) {
      state = advanceTurn(state, rules);
      expect(state.projects[0]).toMatchObject({ phase: 'design', turnsLeftInPhase: 1, delayTurns: i });
    }
    state = applyDeltas(state, [{ target: 'economy.funds.state', amount: 100 }]);
    state = advanceTurn(state, rules);
    expect(state.projects[0]).toMatchObject({ phase: 'permitting', delayTurns: 3 });
    state = advance(state, 7);
    expect(state.projects[0]!.phase).toBe('operating');
    expect(state.turn).toBe(8 + 3);
  });

  it('i fondi non scendono mai sotto zero per pagare un progetto', () => {
    let state = withEconomy(start(initial(), 'progetto-finto-8-anni'), { funds: { state: 1.5 } });
    state = advance(state, 3);
    expect(state.economy.funds.state).toBe(0.5);
    expect(state.projects[0]).toMatchObject({ phase: 'permitting', delayTurns: 2 });
  });

  it('con capacità di spesa per un solo progetto, due progetti avanzano uno alla volta in ordine di avvio', () => {
    let state = withEconomy(initial(), { spendingCapacity: 2 });
    state = start(state, 'progetto-finto-costo-fisso');
    state = start(state, 'progetto-finto-costo-fisso');
    const phases: string[] = [];
    for (let i = 0; i < 8; i++) {
      state = advanceTurn(state, rules);
      phases.push(`${state.projects[0]!.phase}/${state.projects[1]!.phase}`);
    }
    expect(phases).toEqual([
      'permitting/design',
      'tender/design',
      'works/design',
      'operating/design',
      'operating/permitting',
      'operating/tender',
      'operating/works',
      'operating/operating',
    ]);
    expect(state.projects.map((p) => p.delayTurns)).toEqual([0, 4]);
  });

  it('la capacità di spesa vale per turno e non si consuma da un anno all’altro', () => {
    let state = withEconomy(start(initial(), 'progetto-finto-costo-fisso'), { spendingCapacity: 2 });
    state = advance(state, 4);
    expect(state.projects[0]).toMatchObject({ phase: 'operating', delayTurns: 0 });
    expect(state.economy.spendingCapacity).toBe(2);
  });

  it('a parità di turno di avvio, la capacità va al progetto creato prima', () => {
    let state = withEconomy(initial(), { spendingCapacity: 2 });
    state = start(state, 'progetto-finto-costo-fisso');
    state = advance(state, 1);
    state = start(state, 'progetto-finto-costo-fisso');
    state = start(state, 'progetto-finto-costo-fisso');
    state = advance(state, 3); // il primo finisce
    state = advance(state, 1);
    expect(state.projects.map((p) => p.phase)).toEqual(['operating', 'permitting', 'design']);
  });

  it('un progetto gratuito avanza anche senza fondi né capacità', () => {
    let state = start(initial(), 'progetto-finto-senza-gara');
    state = withEconomy(state, { spendingCapacity: 0, funds: { own: 0, state: 0, 'eu-earmarked': 0, private: 0 } });
    state = advance(state, 3);
    expect(state.projects[0]).toMatchObject({ phase: 'operating', delayTurns: 0 });
  });
});

describe('lavoro di cantiere', () => {
  it('gli occupati di cantiere compaiono solo durante works', () => {
    let state = start(initial(), 'progetto-finto-8-anni');
    const base = state.labor.employed.services;
    const seen: number[] = [];
    for (let i = 0; i < 10; i++) {
      state = advanceTurn(state, rules);
      seen.push(state.labor.employed.services - base);
      expect(state.labor.employed.services - base).toBe(state.projects[0]!.phase === 'works' ? 30 : 0);
    }
    // Progettazione, 2 di autorizzazione, gara, 4 di lavori, poi esercizio.
    expect(seen).toEqual([0, 0, 0, 30, 30, 30, 30, 0, 0, 0]);
  });

  it('annullare un progetto durante i lavori toglie gli occupati di cantiere', () => {
    let state = start(initial(), 'progetto-finto-8-anni');
    const base = state.labor.employed.services;
    state = advance(state, 5);
    expect(state.labor.employed.services).toBe(base + 30);
    state = applyAction(state, { kind: 'cancel-project', projectId: state.projects[0]!.id }, rules);
    expect(state.labor.employed.services).toBe(base);
  });

  it('un cantiere fermo per mancanza di fondi resta in works con i suoi occupati', () => {
    let state = start(initial(), 'progetto-finto-8-anni');
    const base = state.labor.employed.services;
    state = advance(state, 4);
    state = withEconomy(state, { funds: { state: 0 } });
    state = advance(state, 3);
    expect(state.projects[0]).toMatchObject({ phase: 'works', delayTurns: 3 });
    expect(state.labor.employed.services).toBe(base + 30);
  });
});

describe('effetti di esercizio', () => {
  it('un effetto ricorrente si applica ogni anno e mai prima dell’esercizio', () => {
    let state = start(initial(), 'progetto-finto-8-anni');
    const trust = state.districts.tamburi.trust;
    const green = state.districts.tamburi.greenCover;
    for (let t = 1; t <= 8; t++) {
      state = advanceTurn(state, rules);
      expect(state.districts.tamburi.trust, `turno ${t}`).toBe(trust);
    }
    expect(state.projects[0]!.phase).toBe('operating');
    expect(state.districts.tamburi.greenCover).toBe(green + 10); // una volta sola, all'entrata in esercizio
    for (let year = 1; year <= 5; year++) {
      state = advanceTurn(state, rules);
      expect(state.districts.tamburi.trust).toBe(trust + year);
      expect(state.districts.tamburi.greenCover).toBe(green + 10);
    }
  });

  it('un progetto annullato prima dell’esercizio non produce effetti', () => {
    let state = start(initial(), 'progetto-finto-8-anni');
    const before = state.districts.tamburi;
    state = advance(state, 2);
    state = applyAction(state, { kind: 'cancel-project', projectId: state.projects[0]!.id }, rules);
    state = advance(state, 20);
    expect(state.districts.tamburi.trust).toBe(before.trust);
    expect(state.districts.tamburi.greenCover).toBe(before.greenCover);
  });
});

describe('lotti come progetti', () => {
  it('convert-lot avvia il progetto della strada scelta, legato al lotto', () => {
    const state = convert(initial(), 'remediation');
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0]).toMatchObject({ definitionId: 'lotto-bonifica', lotId: 'lotto-finto-a', phase: 'design' });
    expect(state.plantLots[0]).toMatchObject({ path: 'remediation', progress: 0, remediated: false });
  });

  it('progress è la quota di anni trascorsi sul totale previsto; remediated arriva con l’esercizio', () => {
    let state = convert(initial(), 'remediation');
    const seen: [number, boolean][] = [];
    for (let i = 0; i < 5; i++) {
      state = advanceTurn(state, rules);
      seen.push([state.plantLots[0]!.progress, state.plantLots[0]!.remediated]);
    }
    // Progettazione 1, autorizzazione 1, gara saltata, lavori 2: 4 anni.
    expect(seen).toEqual([
      [0.25, false],
      [0.5, false],
      [0.75, false],
      [1, true],
      [1, true],
    ]);
  });

  it('un anno senza fondi non fa avanzare il lotto', () => {
    let state = advance(convert(initial(), 'energy'), 1);
    const progress = state.plantLots[0]!.progress;
    state = advance(withEconomy(state, { funds: { state: 0 } }), 2);
    expect(state.plantLots[0]!.progress).toBe(progress);
    expect(state.projects[0]!.delayTurns).toBe(2);
  });

  it('una strada che non è bonifica arriva a 1 senza segnare il lotto come bonificato', () => {
    const state = advance(convert(initial(), 'green-steel'), 3);
    expect(state.plantLots[0]).toMatchObject({ progress: 1, remediated: false });
    expect(state.projects[0]!.phase).toBe('operating');
  });

  it('cambiare strada annulla il progetto in corso sul lotto e ne avvia uno nuovo', () => {
    let state = advance(convert(initial(), 'remediation'), 3); // nei lavori: 50 occupati di bonifica
    const base = fakeContent().labor.employed.remediation;
    expect(state.labor.employed.remediation).toBe(base + 50);
    state = convert(state, 'energy');
    expect(state.projects.map((p) => [p.definitionId, p.phase])).toEqual([
      ['lotto-bonifica', 'cancelled'],
      ['lotto-energia', 'design'],
    ]);
    expect(state.plantLots[0]).toMatchObject({ path: 'energy', progress: 0, remediated: false });
    expect(state.labor.employed.remediation).toBe(base);
  });

  it('riportare un lotto a idle ferma il progetto senza avviarne altri', () => {
    const state = convert(convert(initial(), 'energy'), 'idle');
    expect(state.projects.map((p) => p.phase)).toEqual(['cancelled']);
    expect(state.plantLots[0]).toMatchObject({ path: 'idle', progress: 0 });
  });

  it('una bonifica completata resta tale anche se il lotto cambia strada', () => {
    let state = advance(convert(initial(), 'remediation'), 4);
    state = convert(state, 'sea-culture');
    expect(state.plantLots[0]).toMatchObject({ path: 'sea-culture', progress: 0, remediated: true });
  });

  it('rifiuta una strada senza definizione nei dati', () => {
    const broken: TurnRules = { ...rules, lotConversion: { ...rules.lotConversion, energy: 'nessuna' } };
    expect(() =>
      applyAction(initial(), { kind: 'convert-lot', lotId: 'lotto-finto-a', path: 'energy' }, broken),
    ).toThrow(ActionError);
  });
});

describe('gioco casuale', () => {
  const PATHS: readonly ConversionPath[] = ['idle', 'green-steel', 'remediation', 'energy', 'sea-culture'];
  const DEFINITIONS = Object.keys(rules.projects);

  /** Un giocatore che tenta azioni a caso, guidato dal generatore con seme. */
  function randomGame(seed: number, check: (s: GameState) => void): GameState {
    let state = initial(seed);
    while (state.status === 'running') {
      const rng = rngFor(seed, 'bot', state.turn);
      const pick = <T,>(xs: readonly T[]): T => xs[rng.int(0, xs.length - 1)]!;
      const attempts = rng.int(0, 5);
      for (let i = 0; i < attempts; i++) {
        const candidates: Action[] = [
          { kind: 'start-project', definitionId: pick(DEFINITIONS) },
          { kind: 'convert-lot', lotId: pick(state.plantLots).id, path: pick(PATHS) },
          { kind: 'set-policy', policyId: `p${rng.int(0, 3)}`, active: rng.next() < 0.5 },
          { kind: 'answer-dilemma', dilemmaId: 'd', optionId: 'a' },
          { kind: 'make-promise', text: 'promessa', dueByTurn: Math.min(TOTAL_TURNS, state.turn + rng.int(1, 10)) },
        ];
        if (state.projects.length > 0) candidates.push({ kind: 'cancel-project', projectId: pick(state.projects).id });
        try {
          state = applyAction(state, pick(candidates), rules);
        } catch (error) {
          if (!(error instanceof ActionError)) throw error;
        }
        check(state);
      }
      state = advanceTurn(state, rules);
      check(state);
    }
    return state;
  }

  it('100 turni di gioco casuale lasciano lo stato sempre valido', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      let projects = 0;
      const final = randomGame(seed, (s) => {
        expect(validateState(s).errors).toEqual([]);
        projects = s.projects.length;
      });
      expect(final.status).toBe('ended-2127');
      expect(final.turn).toBe(TOTAL_TURNS);
      expect(projects).toBeGreaterThan(10); // il bot ha davvero giocato
    }
  });

  it('la partita resta identica a parità di seme e storia', () => {
    const noop = (): void => {};
    expect(JSON.stringify(randomGame(77, noop))).toBe(JSON.stringify(randomGame(77, noop)));
  });
});
