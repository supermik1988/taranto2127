import { describe, expect, it } from 'vitest';
import { fakeContent } from './__fixtures__/fake-content.js';
import { activeEconomy, fakeRules, fakeRulesWithEconomy } from './__fixtures__/fake-rules.js';
import { randomGame } from './__fixtures__/random-game.js';
import { createInitialState } from './init.js';
import { TOTAL_TURNS, type GameState } from './state.js';
import { TurnError, advanceTurn, applyAction, type EconomyRules, type TurnRules } from './turn.js';
import { validateState } from './validate.js';

const neutral = fakeRules();
const initial = (seed = 1) => createInitialState(seed, fakeContent());
const advance = (state: GameState, turns: number, rules: TurnRules = neutral): GameState => {
  for (let i = 0; i < turns; i++) state = advanceTurn(state, rules);
  return state;
};
const withEconomyRules = (change: Partial<EconomyRules>): TurnRules => ({
  ...neutral,
  economy: { ...activeEconomy(), ...change },
});
const patch = (state: GameState, change: (s: GameState) => void): GameState => {
  const next = structuredClone(state);
  change(next);
  return next;
};
const laborForce = (s: GameState): number =>
  Object.values(s.labor.employed).reduce((a, b) => a + b, 0) + s.labor.onWageSupport + s.labor.unemployed + s.labor.inTraining;

describe('lavoro come bilancio chiuso', () => {
  it('un cantiere assume prima dai cassa integrati, poi dai disoccupati', () => {
    let state = applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, neutral);
    state = patch(state, (s) => {
      s.labor.onWageSupport = 20;
      s.labor.unemployed = 100;
    });
    state = advance(state, 4); // entra nei lavori: 30 posti nei servizi
    expect(state.projects[0]).toMatchObject({ phase: 'works', localHires: 30 });
    expect(state.labor).toMatchObject({ onWageSupport: 0, unemployed: 90 });
  });

  it('un cantiere con 30 posti e 10 persone disponibili ne assume 10 e avanza comunque', () => {
    let state = applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, neutral);
    state = patch(state, (s) => {
      s.labor.onWageSupport = 4;
      s.labor.unemployed = 6;
    });
    const services = state.labor.employed.services;
    state = advance(state, 4);
    expect(state.projects[0]).toMatchObject({ phase: 'works', localHires: 10 });
    expect(state.labor.employed.services).toBe(services + 10);
    expect(state.labor).toMatchObject({ onWageSupport: 0, unemployed: 0 });
    state = advance(state, 4);
    expect(state.projects[0]!.phase).toBe('operating');
    expect(state.projects[0]!.delayTurns).toBe(0);
  });

  it('a fine lavori gli assunti locali tornano disoccupati', () => {
    let state = applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, neutral);
    const before = state.labor;
    state = advance(state, 8);
    expect(state.projects[0]).toMatchObject({ phase: 'operating', localHires: 0 });
    expect(state.labor.employed.services).toBe(before.employed.services);
    expect(state.labor.onWageSupport).toBe(before.onWageSupport - 30);
    expect(state.labor.unemployed).toBe(before.unemployed + 30);
    expect(laborForce(state)).toBe(laborForce(initial()));
  });

  it('un cantiere fermo sposta i suoi assunti in cassa e li riprende alla ripartenza', () => {
    let state = applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, neutral);
    state = advance(state, 4);
    const working = state.labor;
    expect(state.projects[0]).toMatchObject({ phase: 'works', turnsLeftInPhase: 4, localHires: 30 });

    const funds = state.economy.funds.state;
    state = patch(state, (s) => (s.economy.funds.state = 0));
    state = advance(state, 2);
    expect(state.projects[0]).toMatchObject({ phase: 'works', turnsLeftInPhase: 4, worksStalled: true, delayTurns: 2 });
    expect(state.labor.employed.services).toBe(working.employed.services - 30);
    expect(state.labor.onWageSupport).toBe(working.onWageSupport + 30);

    state = patch(state, (s) => (s.economy.funds.state = funds));
    state = advance(state, 1);
    expect(state.projects[0]).toMatchObject({ phase: 'works', turnsLeftInPhase: 3, worksStalled: false, localHires: 30 });
    expect(state.labor).toEqual(working);
  });

  it('annullare un cantiere fermo manda in disoccupazione i suoi assunti in cassa', () => {
    let state = applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, neutral);
    state = advance(state, 4);
    state = advance(patch(state, (s) => (s.economy.funds.state = 0)), 1);
    const stalled = state.labor;
    state = applyAction(state, { kind: 'cancel-project', projectId: state.projects[0]!.id }, neutral);
    expect(state.labor.onWageSupport).toBe(stalled.onWageSupport - 30);
    expect(state.labor.unemployed).toBe(stalled.unemployed + 30);
  });

  it('la forza lavoro totale resta costante in 100 turni di gioco casuale', { timeout: 60_000 }, () => {
    for (const seed of [11, 12, 13, 14, 15]) {
      const force = laborForce(initial(seed));
      let turns = 0;
      const final = randomGame(seed, fakeRulesWithEconomy(), (s) => {
        expect(laborForce(s)).toBe(force);
        expect(validateState(s).errors).toEqual([]);
        turns = s.turn;
      });
      expect(final.status).toBe('ended-2127');
      expect(turns).toBe(TOTAL_TURNS);
    }
  });
});

describe('entrate', () => {
  it('meno occupati locali producono meno entrate proprie l’anno dopo', () => {
    const rules = fakeRulesWithEconomy();
    const full = initial();
    const fewer = patch(full, (s) => {
      s.labor.employed.steel -= 100;
      s.labor.unemployed += 100;
    });
    const gain = (s: GameState): number => advanceTurn(s, rules).economy.funds.own - s.economy.funds.own;
    expect(gain(fewer)).toBeLessThan(gain(full));
    // 100 occupati in meno × 0,02 milioni × reddito medio 50/100.
    expect(gain(full) - gain(fewer)).toBeCloseTo(1, 9);
  });

  it('le entrate proprie crescono con il reddito medio', () => {
    const rules = fakeRulesWithEconomy();
    const richer = patch(initial(), (s) => (s.economy.averageIncome = 100));
    const gain = (s: GameState): number => advanceTurn(s, rules).economy.funds.own - s.economy.funds.own;
    expect(gain(richer)).toBeGreaterThan(gain(initial()));
  });

  it('i trasferimenti statali arrivano ogni anno', () => {
    const rules = withEconomyRules({ wageSupportCostPerPerson: 0 });
    const state = advance(initial(), 3, rules);
    expect(state.economy.funds.state).toBe(initial().economy.funds.state + 30);
  });

  it('una rata europea non spesa scade nell’anno previsto', () => {
    const rules = withEconomyRules({ euTranches: [{ id: 'r', amount: 20, arrivesInYear: 2028, expiresInYear: 2030 }] });
    const base = initial().economy.funds['eu-earmarked'];
    const eu = (turns: number): number => advance(initial(), turns, rules).economy.funds['eu-earmarked'];
    expect(eu(1)).toBe(base); // fine 2027: non ancora arrivata
    expect(eu(2)).toBe(base + 20); // fine 2028: arrivata
    expect(eu(3)).toBe(base + 20); // fine 2029
    expect(eu(4)).toBe(base); // fine 2030: scaduta
    expect(advance(initial(), 4, rules).economy.euTranches).toEqual([]);
  });

  it('la spesa europea consuma prima le rate in scadenza; scade solo la parte non spesa', () => {
    const rules = withEconomyRules({ euTranches: [{ id: 'r', amount: 20, arrivesInYear: 2028, expiresInYear: 2030 }] });
    // Bonifica di un lotto: 2 anni di lavori a 2 milioni l'anno dal fondo europeo, nel 2029 e nel 2030.
    let state = applyAction(initial(), { kind: 'convert-lot', lotId: 'lotto-finto-a', path: 'remediation' }, rules);
    const base = state.economy.funds['eu-earmarked'];
    state = advance(state, 3, rules);
    expect(state.economy.euTranches).toEqual([{ id: 'r', remaining: 18, expiresOnTurn: 3 }]);
    state = advance(state, 1, rules);
    expect(state.economy.funds['eu-earmarked']).toBe(base + 20 - 4 - 16);
  });
});

describe('spese obbligate', () => {
  it('la cassa integrazione si paga dal fondo statale; la parte scoperta diventa disoccupata', () => {
    const rules = withEconomyRules({ wageSupportCostPerPerson: 1, stateTransferPerYear: 10 });
    const state0 = patch(initial(), (s) => (s.economy.funds.state = 30));
    const state = advanceTurn(state0, rules);
    // 30 + 10 di trasferimenti = 40: coperti 40 cassa integrati su 100.
    expect(state.labor.onWageSupport).toBe(40);
    expect(state.labor.unemployed).toBe(state0.labor.unemployed + 60);
    expect(state.economy.funds.state).toBe(0);
    expect(laborForce(state)).toBe(laborForce(state0));
  });

  it('i servizi si pagano dai fondi propri, anche in disavanzo', () => {
    const rules = withEconomyRules({ ownRevenuePerWorker: 0, servicesCostPerYear: 5 });
    const state = advanceTurn(patch(initial(), (s) => (s.economy.funds.own = 1)), rules);
    expect(state.economy.funds.own).toBe(-4);
    expect(state.economy.deficitYears).toBe(1);
    expect(validateState(state).errors).toEqual([]);
  });
});

describe('dissesto', () => {
  const rules = withEconomyRules({ ownRevenuePerWorker: 0, servicesCostPerYear: 1, bankruptcyAfterDeficitYears: 3 });

  it('il disavanzo prolungato chiude la partita con ended-bankrupt', () => {
    let state = patch(initial(), (s) => (s.economy.funds.own = -10));
    for (let year = 1; year <= 2; year++) {
      state = advanceTurn(state, rules);
      expect(state).toMatchObject({ status: 'running', economy: { deficitYears: year } });
    }
    state = advanceTurn(state, rules);
    expect(state.status).toBe('ended-bankrupt');
    expect(() => advanceTurn(state, rules)).toThrow(TurnError);
  });

  it('un anno in attivo azzera il conteggio', () => {
    let state = patch(initial(), (s) => (s.economy.funds.own = -1.5));
    state = advance(state, 2, rules);
    expect(state.economy.deficitYears).toBe(2);
    state = advanceTurn(patch(state, (s) => (s.economy.funds.own = 100)), rules);
    expect(state).toMatchObject({ status: 'running', economy: { deficitYears: 0 } });
  });
});

// Test pesanti: margine ampio perché girano in parallelo con gli altri.
describe('determinismo', { timeout: 60_000 }, () => {
  it('stessa partita identica a parità di seme e storia, con l’economia attiva', () => {
    const rules = fakeRulesWithEconomy();
    expect(JSON.stringify(randomGame(42, rules))).toBe(JSON.stringify(randomGame(42, rules)));
  });
});
