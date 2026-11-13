import { describe, expect, it } from 'vitest';
import { fakeContent } from './__fixtures__/fake-content.js';
import { fakeRules } from './__fixtures__/fake-rules.js';
import { EffectError, applyDeltas, scheduleEffect } from './effects.js';
import { createInitialState } from './init.js';
import { advanceTurn } from './turn.js';
import { validateState } from './validate.js';

const initial = () => createInitialState(1, fakeContent());

describe('effetti ritardati', () => {
  it('un effetto con ritardo di 5 turni compare esattamente al turno previsto', () => {
    const rules = fakeRules();
    let state = scheduleEffect(initial(), {
      sourceId: 'prova',
      delayTurns: 5,
      deltas: [{ target: 'districts.borgo.trust', amount: 20 }],
    });
    const before = state.districts.borgo.trust;
    for (let t = 1; t <= 4; t++) {
      state = advanceTurn(state, rules);
      expect(state.turn).toBe(t);
      expect(state.districts.borgo.trust).toBe(before);
      expect(state.pendingEffects).toHaveLength(1);
    }
    state = advanceTurn(state, rules);
    expect(state.turn).toBe(5);
    expect(state.districts.borgo.trust).toBe(before + 20);
    expect(state.pendingEffects).toEqual([]);
  });

  it('vale anche per effetti creati a partita in corso', () => {
    const rules = fakeRules();
    let state = initial();
    for (let t = 0; t < 10; t++) state = advanceTurn(state, rules);
    state = scheduleEffect(state, { sourceId: 'prova', delayTurns: 5, deltas: [{ target: 'labor.unemployed', amount: 7 }] });
    expect(state.pendingEffects[0]!.dueOnTurn).toBe(15);
  });

  it('nessun effetto istantaneo: il ritardo minimo è un turno', () => {
    expect(() => scheduleEffect(initial(), { sourceId: 'x', delayTurns: 0, deltas: [] })).toThrow(EffectError);
    expect(() => scheduleEffect(initial(), { sourceId: 'x', delayTurns: 1.5, deltas: [] })).toThrow(EffectError);
  });

  it('effetti con la stessa sorgente e scadenza hanno identificativi distinti', () => {
    let state = initial();
    state = scheduleEffect(state, { sourceId: 'x', delayTurns: 2, deltas: [] });
    state = scheduleEffect(state, { sourceId: 'x', delayTurns: 2, deltas: [] });
    const ids = state.pendingEffects.map((e) => e.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('scheduleEffect non modifica lo stato ricevuto', () => {
    const state = initial();
    scheduleEffect(state, { sourceId: 'x', delayTurns: 1, deltas: [] });
    expect(state.pendingEffects).toEqual([]);
  });
});

describe('applicazione delle variazioni', () => {
  it('ferma gli indici ai limiti e lo stato resta valido', () => {
    const state = applyDeltas(initial(), [
      { target: 'districts.tamburi.health', amount: 500 },
      { target: 'districts.borgo.tension', amount: -500 },
      { target: 'districts.borgo.population.elder', amount: -1e9 },
      { target: 'moral.byDimension.truth', amount: -300 },
      { target: 'plantLots.0.progress', amount: 3 },
      { target: 'economy.funds.state', amount: -1e6 },
    ]);
    expect(state.districts.tamburi.health).toBe(100);
    expect(state.districts.borgo.tension).toBe(0);
    expect(state.districts.borgo.population.elder).toBe(0);
    expect(state.moral.byDimension.truth).toBe(-100);
    expect(state.plantLots[0]!.progress).toBe(1);
    expect(state.economy.funds.state).toBe(0);
    expect(validateState(state).ok).toBe(true);
  });

  it('lascia liberi fondi propri, emissioni sopra 100 e livello del mare', () => {
    const state = applyDeltas(initial(), [
      { target: 'economy.funds.own', amount: -1000 },
      { target: 'climate.co2Emissions', amount: 50 },
      { target: 'climate.seaLevelRiseCm', amount: 200 },
    ]);
    expect(state.economy.funds.own).toBe(-990);
    expect(state.climate.co2Emissions).toBe(150);
    expect(state.climate.seaLevelRiseCm).toBe(200);
  });

  it('rifiuta percorsi inesistenti, non numerici o fuori dalle variabili della città', () => {
    for (const target of [
      'districts.atlantide.health',
      'districts.borgo.id',
      'turn',
      'seed',
      'status',
      'districts.__proto__.x',
      'districts',
    ]) {
      expect(() => applyDeltas(initial(), [{ target, amount: 1 }]), target).toThrow(EffectError);
    }
    expect(() => applyDeltas(initial(), [{ target: 'labor.unemployed', amount: Number.NaN }])).toThrow(EffectError);
  });
});
