import { describe, expect, it } from 'vitest';
import { fakeContent } from './__fixtures__/fake-content.js';
import { fakeRules, fakeRulesWithEconomy, withOpenDilemma } from './__fixtures__/fake-rules.js';
import { randomGame } from './__fixtures__/random-game.js';
import { createInitialState } from './init.js';
import { TOTAL_TURNS, type GameState } from './state.js';
import {
  ActionError,
  TurnError,
  advanceTurn,
  applyAction,
  eligibleDilemmas,
  type DilemmaDefinition,
  type TurnRules,
} from './turn.js';
import { validateState } from './validate.js';

const initial = (seed = 1) => createInitialState(seed, fakeContent());
const laborForce = (s: GameState): number =>
  Object.values(s.labor.employed).reduce((a, b) => a + b, 0) + s.labor.onWageSupport + s.labor.unemployed + s.labor.inTraining;

/** Regole con dilemmi in arrivo: `extra` aggiunge o sostituisce dilemmi. */
function arrivalRules(probability: number, extra: Record<string, Partial<DilemmaDefinition>> = {}): TurnRules {
  const rules = fakeRules();
  rules.dilemmaArrivalProbability = probability;
  const template = rules.dilemmas['dilemma-finto']!;
  for (const [id, change] of Object.entries(extra)) rules.dilemmas[id] = { ...template, id, ...change };
  return rules;
}

/** Gioca `turns` turni rispondendo sempre con l'opzione palese; restituisce i dilemmi arrivati, per turno. */
function playAnswering(state: GameState, rules: TurnRules, turns: number): { state: GameState; arrivals: (string | null)[] } {
  const arrivals: (string | null)[] = [];
  for (let i = 0; i < turns && state.status === 'running'; i++) {
    const open = state.openDilemmaId;
    if (open !== null) state = applyAction(state, { kind: 'answer-dilemma', dilemmaId: open, optionId: 'palese' }, rules);
    state = advanceTurn(state, rules);
    arrivals.push(state.openDilemmaId);
  }
  return { state, arrivals };
}

describe('arrivo dei dilemmi', () => {
  it('con probabilità annua 1 arriva un dilemma a ogni turno in cui ce n’è uno ammesso', () => {
    const rules = arrivalRules(1);
    const { arrivals } = playAnswering(initial(), rules, 30);
    expect(arrivals).toEqual(Array(30).fill('dilemma-finto'));
  });

  it('con probabilità annua 0 non ne arriva nessuno', () => {
    const { arrivals } = playAnswering(initial(), arrivalRules(0), 30);
    expect(arrivals.every((a) => a === null)).toBe(true);
  });

  it('una condizione falsa lo esclude; vera lo ammette', () => {
    const condition = { target: 'districts.tamburi.airQuality', comparator: '>=' as const, value: 90 };
    const rules = arrivalRules(1, { 'dilemma-finto': { conditions: [condition] } });
    expect(initial().districts.tamburi.airQuality).toBeLessThan(90);
    expect(eligibleDilemmas(initial(), rules, 1)).toEqual([]);
    expect(advanceTurn(initial(), rules).openDilemmaId).toBeNull();

    const clean = structuredClone(initial());
    clean.districts.tamburi.airQuality = 95;
    expect(advanceTurn(clean, rules).openDilemmaId).toBe('dilemma-finto');
  });

  it('servono tutte le condizioni', () => {
    const rules = arrivalRules(1, {
      'dilemma-finto': {
        conditions: [
          { target: 'districts.borgo.trust', comparator: '>=', value: 0 },
          { target: 'labor.unemployed', comparator: '>', value: 1_000_000 },
        ],
      },
    });
    expect(advanceTurn(initial(), rules).openDilemmaId).toBeNull();
  });

  it('rispetta primo e ultimo turno ammesso', () => {
    const rules = arrivalRules(1, { 'dilemma-finto': { firstTurn: 3, lastTurn: 5 } });
    const { arrivals } = playAnswering(initial(), rules, 8);
    // arrivals[i] è il dilemma aperto all'apertura del turno i + 1.
    expect(arrivals).toEqual([null, null, 'dilemma-finto', 'dilemma-finto', 'dilemma-finto', null, null, null]);
  });

  it('un dilemma non ripetibile non torna in 100 turni', () => {
    const rules = arrivalRules(1, { 'dilemma-finto': { repeatable: false } });
    const { state, arrivals } = playAnswering(initial(), rules, TOTAL_TURNS);
    expect(arrivals.filter((a) => a === 'dilemma-finto')).toHaveLength(1);
    expect(state.status).toBe('ended-2127');
  });

  it('l’estrazione segue i pesi: peso 0 non arriva mai', () => {
    const rules = arrivalRules(1, { 'dilemma-finto': { weight: 0 }, 'dilemma-pesante': { weight: 5 } });
    const { arrivals } = playAnswering(initial(), rules, 20);
    expect(new Set(arrivals)).toEqual(new Set(['dilemma-pesante']));
  });

  it('se l’unico dilemma ammesso ha peso 0, non arriva nulla', () => {
    const rules = arrivalRules(1, { 'dilemma-finto': { weight: 0 } });
    expect(playAnswering(initial(), rules, 10).arrivals.every((a) => a === null)).toBe(true);
  });

  it('con più dilemmi ammessi la scelta dipende dal seme ma è riproducibile', () => {
    const rules = arrivalRules(1, { 'dilemma-b': { weight: 1 }, 'dilemma-c': { weight: 1 } });
    const run = (seed: number) => playAnswering(initial(seed), rules, 40).arrivals;
    expect(run(5)).toEqual(run(5));
    expect(new Set(run(5)).size).toBe(3);
  });
});

describe('dilemma aperto', () => {
  it('con un dilemma aperto advanceTurn dà errore', () => {
    const state = withOpenDilemma(initial());
    expect(() => advanceTurn(state, fakeRules())).toThrow(TurnError);
  });

  it('answer-dilemma vale solo per il dilemma aperto e lo chiude', () => {
    const rules = arrivalRules(0, { 'dilemma-altro': {} });
    const answer = (s: GameState, dilemmaId: string): GameState =>
      applyAction(s, { kind: 'answer-dilemma', dilemmaId, optionId: 'palese' }, rules);
    expect(() => answer(initial(), 'dilemma-finto')).toThrow(ActionError); // nessuno aperto
    const open = withOpenDilemma(initial());
    expect(() => answer(open, 'dilemma-altro')).toThrow(ActionError); // non è quello aperto
    const closed = answer(open, 'dilemma-finto');
    expect(closed.openDilemmaId).toBeNull();
    expect(() => advanceTurn(closed, rules)).not.toThrow();
  });

  it('al massimo un dilemma aperto alla volta', () => {
    const rules = arrivalRules(1, { 'dilemma-b': {} });
    const state = advanceTurn(initial(), rules);
    expect(state.openDilemmaId).not.toBeNull();
    expect(() => advanceTurn(state, rules)).toThrow(TurnError);
  });
});

describe('politiche', () => {
  const rules = fakeRules();
  const setPolicy = (s: GameState, policyId: string, active: boolean): GameState =>
    applyAction(s, { kind: 'set-policy', policyId, active }, rules);
  const advance = (s: GameState, turns: number): GameState => {
    for (let i = 0; i < turns; i++) s = advanceTurn(s, rules);
    return s;
  };

  it('una politica attiva al turno T produce il primo effetto al turno T+1', () => {
    let state = advance(initial(), 3);
    const green = state.districts.tamburi.greenCover;
    state = setPolicy(state, 'politica-verde', true);
    expect(state.turn).toBe(3);
    expect(state.districts.tamburi.greenCover).toBe(green);
    state = advance(state, 1);
    expect(state.turn).toBe(4);
    expect(state.districts.tamburi.greenCover).toBe(green + 1);
    state = advance(state, 2);
    expect(state.districts.tamburi.greenCover).toBe(green + 3);
  });

  it('il costo annuo si scala dal suo fondo', () => {
    let state = setPolicy(initial(), 'politica-verde', true);
    const funds = state.economy.funds.state;
    state = advance(state, 3);
    expect(state.economy.funds.state).toBe(funds - 6);
  });

  it('senza fondi resta attiva ma senza effetti, e riparte quando i fondi tornano', () => {
    let state = setPolicy(initial(), 'politica-verde', true);
    state = structuredClone(state);
    state.economy.funds.state = 1; // costa 2
    const green = state.districts.tamburi.greenCover;
    state = advance(state, 3);
    expect(state.activePolicies).toContain('politica-verde');
    expect(state.districts.tamburi.greenCover).toBe(green);
    expect(state.economy.funds.state).toBe(1);
    state = structuredClone(state);
    state.economy.funds.state = 100;
    state = advance(state, 1);
    expect(state.districts.tamburi.greenCover).toBe(green + 1);
  });

  it('non si spegne prima degli anni minimi', () => {
    let state = setPolicy(initial(), 'politica-verde', true); // 3 anni minimi, attiva dal turno 0
    expect(state.policySince).toEqual({ 'politica-verde': 0 });
    for (let t = 1; t <= 2; t++) {
      state = advance(state, 1);
      expect(() => setPolicy(state, 'politica-verde', false), `turno ${t}`).toThrow(ActionError);
    }
    state = advance(state, 1);
    state = setPolicy(state, 'politica-verde', false);
    expect(state.activePolicies).toEqual([]);
    expect(state.policySince).toEqual({});
  });

  it('spenta, non produce più effetti', () => {
    let state = setPolicy(initial(), 'politica-verde', true);
    state = advance(state, 3);
    state = setPolicy(state, 'politica-verde', false);
    const green = state.districts.tamburi.greenCover;
    state = advance(state, 3);
    expect(state.districts.tamburi.greenCover).toBe(green);
  });

  it('all’attivazione registra i pesi morali palesi', () => {
    const state = setPolicy(initial(), 'politica-verde', true);
    expect(state.moral.byDimension.listening).toBe(2);
    expect(state.moral.reputation).toBeCloseTo(state.moral.conscience, 12);
    expect(state.moral.hiddenActs).toEqual([]);
  });

  it('rifiuta una politica che non esiste nei dati', () => {
    expect(() => setPolicy(initial(), 'politica-inventata', true)).toThrow(ActionError);
  });
});

describe('pesi morali delle politiche', () => {
  const rules = fakeRules();
  const setPolicy = (s: GameState, policyId: string, active: boolean): GameState =>
    applyAction(s, { kind: 'set-policy', policyId, active }, rules);
  const advance = (s: GameState, turns: number): GameState => {
    for (let i = 0; i < turns; i++) s = advanceTurn(s, rules);
    return s;
  };

  it('i pesi di attivazione si registrano una sola volta per politica in tutta la partita', () => {
    let state = setPolicy(initial(), 'politica-verde', true);
    expect(state.moral.byDimension.listening).toBe(2);
    state = advance(state, 3);
    state = setPolicy(state, 'politica-verde', false);
    state = setPolicy(state, 'politica-verde', true);
    state = advance(state, 3);
    state = setPolicy(state, 'politica-verde', false);
    state = setPolicy(state, 'politica-verde', true);
    expect(state.moral.byDimension.listening).toBe(2);
  });

  it('il peso morale annuo si applica, palese, negli anni in cui la politica è attiva e pagata', () => {
    let state = setPolicy(initial(), 'politica-verde', true);
    expect(state.moral.byDimension.care).toBe(0); // non all'attivazione
    state = advance(state, 3);
    expect(state.moral.byDimension.care).toBe(3);
    expect(state.moral.reputation).toBeCloseTo(state.moral.conscience, 12);
    state = structuredClone(state);
    state.economy.funds.state = 0; // non pagata: nessun peso
    state = advance(state, 2);
    expect(state.moral.byDimension.care).toBe(3);
  });

  it('spenta, il peso morale annuo non si applica più', () => {
    let state = advance(setPolicy(initial(), 'politica-verde', true), 3);
    state = setPolicy(state, 'politica-verde', false);
    state = advance(state, 4);
    expect(state.moral.byDimension.care).toBe(3);
  });
});

describe('formazione', () => {
  const rules = fakeRules();
  const advance = (s: GameState, turns: number): GameState => {
    for (let i = 0; i < turns; i++) s = advanceTurn(s, rules);
    return s;
  };

  it('sposta disoccupati in formazione e, dopo gli anni previsti, li restituisce formati', () => {
    const start = applyAction(initial(), { kind: 'set-policy', policyId: 'formazione', active: true }, rules);
    const unemployed = start.labor.unemployed;
    const seen = [1, 2, 3, 4].map((t) => {
      const s = advance(start, t);
      return [s.labor.inTraining, s.labor.unemployed, s.labor.trained];
    });
    // 10 l'anno, 2 anni di corso: la prima coorte esce a fine del terzo anno, quando ne entra un'altra.
    expect(seen).toEqual([
      [10, unemployed - 10, 0],
      [20, unemployed - 20, 0],
      [20, unemployed - 20, 10],
      [20, unemployed - 20, 20],
    ]);
    for (const t of [1, 2, 3, 4]) expect(laborForce(advance(start, t))).toBe(laborForce(initial()));
  });

  it('le persone formate non superano mai i disoccupati', () => {
    let state = applyAction(initial(), { kind: 'set-policy', policyId: 'formazione', active: true }, rules);
    state = advance(state, 4);
    expect(state.labor.trained).toBe(20);
    // Un cantiere assume dai disoccupati: anche i formati possono essere assunti.
    state = structuredClone(state);
    state.labor.unemployed = 5;
    state = applyAction(state, { kind: 'set-policy', policyId: 'p', active: true }, rules);
    expect(state.labor.trained).toBe(5);
  });

  it('una coorte finisce la formazione anche se la politica viene spenta', () => {
    let state = applyAction(initial(), { kind: 'set-policy', policyId: 'formazione', active: true }, rules);
    state = advance(state, 1);
    state = applyAction(state, { kind: 'set-policy', policyId: 'formazione', active: false }, rules);
    state = advance(state, 2);
    expect(state.labor).toMatchObject({ inTraining: 0, trained: 10 });
  });
});

describe('partita completa', { timeout: 60_000 }, () => {
  /** Economia attiva, dilemmi che arrivano un anno su due, politiche a caso. */
  const rules = (): TurnRules => ({ ...fakeRulesWithEconomy(), dilemmaArrivalProbability: 0.5 });

  it('stato sempre valido e forza lavoro costante in 100 turni di gioco casuale su 5 semi', () => {
    let dilemmas = 0;
    let trained = 0;
    for (const seed of [31, 32, 33, 34, 35]) {
      const force = laborForce(initial(seed));
      const final = randomGame(seed, rules(), (s) => {
        expect(validateState(s).errors).toEqual([]);
        expect(laborForce(s)).toBe(force);
        expect(s.labor.trained).toBeLessThanOrEqual(s.labor.unemployed);
        trained = Math.max(trained, s.labor.trained);
      });
      expect(final.status).toBe('ended-2127');
      expect(final.turn).toBe(TOTAL_TURNS);
      dilemmas += final.history.filter((h) => h.action.kind === 'answer-dilemma').length;
    }
    expect(dilemmas).toBeGreaterThan(100); // circa uno ogni due anni per partita
    expect(trained).toBeGreaterThan(0);
  });

  it('stessa partita identica a parità di seme e storia, e replay dalla storia', async () => {
    const { replay } = await import('./turn.js');
    const a = randomGame(77, rules());
    expect(JSON.stringify(randomGame(77, rules()))).toBe(JSON.stringify(a));
    expect(JSON.stringify(replay(initial(77), a.history, rules(), a.turn))).toBe(JSON.stringify(a));
  });
});

