/** T10: motivi di fermata del tempo, bilancio dell'anno, intervallo dei dilemmi. */
import { describe, expect, it } from 'vitest';
import { fakeContent } from './__fixtures__/fake-content.js';
import { fakeRules, fakeRulesWithEconomy } from './__fixtures__/fake-rules.js';
import { forecastYear, officeCapacity } from './budget.js';
import { STOP_KINDS, stopReasons, type StopKind } from './events.js';
import { createInitialState } from './init.js';
import { TURNS_PER_EPOCH, type GameState } from './state.js';
import { advanceTurn, applyAction, eligibleDilemmas, type DilemmaDefinition, type TurnRules } from './turn.js';

const initial = (seed = 1) => createInitialState(seed, fakeContent());
const kinds = (before: GameState, after: GameState): StopKind[] => stopReasons(before, after).map((r) => r.kind);

describe('il tempo si ferma da solo', () => {
  const rules = fakeRules();

  it('un anno tranquillo non ferma il tempo', () => {
    const before = initial();
    expect(stopReasons(before, advanceTurn(before, rules))).toEqual([]);
  });

  it('quando arriva un dilemma', () => {
    const before = initial();
    const after = { ...advanceTurn(before, rules), openDilemmaId: 'dilemma-finto' };
    expect(stopReasons(before, after)).toContainEqual({ kind: 'dilemma', dilemmaId: 'dilemma-finto' });
  });

  it('quando finisce una fase di un progetto', () => {
    const before = applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, rules);
    const after = advanceTurn(before, rules);
    expect(stopReasons(before, after)).toContainEqual(expect.objectContaining({ kind: 'phase-end', from: 'design', to: 'permitting' }));
    // L'anno dopo la fase di autorizzazione (2 anni) non è ancora finita.
    expect(kinds(after, advanceTurn(after, rules))).not.toContain('phase-end');
  });

  it('quando scoppia uno scandalo', () => {
    const before = initial();
    const after = structuredClone(advanceTurn(before, rules));
    after.moral.scandals.push({ turn: 0, actId: 'atto', dimension: 'legality' });
    expect(stopReasons(before, after)).toContainEqual({ kind: 'scandal', count: 1 });
  });

  it('quando scade una promessa, con o senza condizione', () => {
    let state = applyAction(initial(), { kind: 'make-promise', text: 'Scuole nuove', dueByTurn: 2 }, rules);
    state = advanceTurn(state, rules);
    const before = state;
    const after = advanceTurn(state, rules);
    expect(stopReasons(before, after)).toContainEqual(expect.objectContaining({ kind: 'promise-due', status: 'open' }));
    // Una promessa con condizione, alla scadenza, diventa mantenuta o tradita.
    const settled = structuredClone(after);
    settled.promises[0]!.status = 'broken';
    expect(stopReasons(state, settled)).toContainEqual(expect.objectContaining({ kind: 'promise-due', status: 'broken' }));
  });

  it('quando cambia l’epoca', () => {
    let state = initial();
    while (state.turn < TURNS_PER_EPOCH - 1) state = advanceTurn(state, rules);
    const after = advanceTurn(state, rules);
    expect(stopReasons(state, after)).toContainEqual({ kind: 'epoch', epoch: 1 });
  });

  it('quando i conti vanno in disavanzo, solo l’anno in cui ci entrano', () => {
    const economy = fakeRulesWithEconomy();
    const before = structuredClone(initial());
    before.economy.funds.own = 1;
    economy.economy.servicesCostPerYear = 50;
    economy.economy.ownRevenuePerWorker = 0;
    const after = advanceTurn(before, economy);
    expect(after.economy.funds.own).toBeLessThan(0);
    expect(kinds(before, after)).toContain('deficit');
    expect(kinds(after, advanceTurn(after, economy))).not.toContain('deficit');
  });

  it('quando finisce la partita', () => {
    const before = structuredClone(initial());
    before.turn = 99;
    const after = advanceTurn(before, rules);
    expect(after.status).toBe('ended-2127');
    expect(stopReasons(before, after)).toContainEqual({ kind: 'game-over', status: 'ended-2127' });
    expect(kinds(before, after)).not.toContain('epoch');
  });

  it('ogni motivo dell’elenco ha un test qui sopra', () => {
    expect([...STOP_KINDS].sort()).toEqual(['deficit', 'dilemma', 'epoch', 'game-over', 'phase-end', 'promise-due', 'scandal']);
  });
});

describe('bilancio dell’anno', () => {
  const rules = fakeRulesWithEconomy();

  it('la previsione coincide con la chiusura vera, voce per voce', () => {
    let state = applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, rules);
    state = applyAction(state, { kind: 'set-policy', policyId: 'politica-verde', active: true }, rules);
    for (let i = 0; i < 6; i++) {
      const forecast = forecastYear(state, rules);
      const next = advanceTurn(state, rules);
      expect(forecast.end).toEqual(next.economy.funds);
      for (const fund of ['own', 'state', 'eu-earmarked', 'private'] as const) {
        const sum = forecast.entries.filter((e) => e.fund === fund).reduce((a, e) => a + e.amount, 0);
        expect(forecast.start[fund] + sum).toBeCloseTo(next.economy.funds[fund], 9);
      }
      state = next;
    }
  });

  it('cantieri e politiche compaiono come voci separate', () => {
    let state = applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, rules);
    state = applyAction(state, { kind: 'set-policy', policyId: 'politica-verde', active: true }, rules);
    const { entries } = forecastYear(state, rules);
    expect(entries).toContainEqual(expect.objectContaining({ key: 'project', amount: -1, ref: state.projects[0]!.id }));
    expect(entries).toContainEqual({ key: 'policy', fund: 'state', amount: -2, ref: 'politica-verde' });
    expect(entries.some((e) => e.key === 'revenue')).toBe(true);
  });

  it('la previsione non cambia lo stato', () => {
    const state = initial();
    const copy = JSON.stringify(state);
    forecastYear(state, rules);
    expect(JSON.stringify(state)).toBe(copy);
  });

  it('la capacità degli uffici scende con i cantieri aperti', () => {
    const state = initial();
    const free = officeCapacity(state, rules);
    expect(free.used).toBe(0);
    expect(free.free).toBe(state.economy.spendingCapacity);
    const busy = officeCapacity(applyAction(state, { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, rules), rules);
    expect(busy.used).toBe(1);
    expect(busy.free).toBe(state.economy.spendingCapacity - 1);
  });

  it('con la cassa in rosso dice quanti anni mancano al dissesto', () => {
    const red = structuredClone(rules);
    red.economy.servicesCostPerYear = 1000;
    const state = structuredClone(initial());
    state.economy.funds.own = 0;
    const first = forecastYear(state, red);
    expect(first.yearsToBankruptcy).toBe(red.economy.bankruptcyAfterDeficitYears - 1);
    expect(forecastYear(advanceTurn(state, red), red).yearsToBankruptcy).toBe(red.economy.bankruptcyAfterDeficitYears - 2);
    expect(forecastYear(state, rules).yearsToBankruptcy).toBeNull();
  });
});

describe('intervallo dei dilemmi ripetibili', () => {
  function rulesWith(extra: Record<string, Partial<DilemmaDefinition>>): TurnRules {
    const rules = fakeRules();
    const template = rules.dilemmas['dilemma-finto']!;
    rules.dilemmas = {};
    for (const [id, change] of Object.entries(extra)) rules.dilemmas[id] = { ...template, id, ...change };
    rules.dilemmaArrivalProbability = 1;
    return rules;
  }

  function arrivals(rules: TurnRules, turns: number): { turn: number; id: string }[] {
    let state = initial();
    const seen: { turn: number; id: string }[] = [];
    for (let i = 0; i < turns && state.status === 'running'; i++) {
      if (state.openDilemmaId !== null) {
        seen.push({ turn: state.turn, id: state.openDilemmaId });
        state = applyAction(state, { kind: 'answer-dilemma', dilemmaId: state.openDilemmaId, optionId: 'palese' }, rules);
      }
      state = advanceTurn(state, rules);
    }
    return seen;
  }

  it('un ripetibile non torna prima degli anni dei dati, anche se è l’unico', () => {
    const seen = arrivals(rulesWith({ solo: { repeatAfterTurns: 7 } }), 60);
    expect(seen.length).toBeGreaterThan(3);
    for (let i = 1; i < seen.length; i++) expect(seen[i]!.turn - seen[i - 1]!.turn).toBeGreaterThanOrEqual(7);
  });

  it('nella stessa epoca non torna se ce ne sono altri ammessi', () => {
    const rules = rulesWith({ a: { repeatAfterTurns: 1 }, b: { repeatAfterTurns: 1 }, c: { repeatAfterTurns: 1, repeatable: false } });
    for (const epoch of [0, 1, 2]) {
      const inEpoch = arrivals(rules, 100).filter((s) => Math.floor(s.turn / TURNS_PER_EPOCH) === epoch).map((s) => s.id);
      // I primi arrivi dell'epoca sono tutti diversi, finché ce ne sono di nuovi.
      expect(new Set(inEpoch.slice(0, 2)).size).toBe(2);
    }
  });

  it('quando gli altri sono esauriti, un ripetibile può tornare nella stessa epoca dopo l’intervallo', () => {
    const rules = rulesWith({ a: { repeatAfterTurns: 3 } });
    const state = structuredClone(initial());
    state.turn = 5;
    state.history.push({ turn: 1, action: { kind: 'answer-dilemma', dilemmaId: 'a', optionId: 'palese' } });
    expect(eligibleDilemmas(state, rules, 5).map((d) => d.id)).toEqual(['a']);
    expect(eligibleDilemmas(state, rules, 3).map((d) => d.id)).toEqual([]);
  });
});
