import { describe, expect, it } from 'vitest';
import { fakeContent } from './__fixtures__/fake-content.js';
import { fakeRules } from './__fixtures__/fake-rules.js';
import { EffectError, applyDeltas, applyLaborMoves, scheduleEffect } from './effects.js';
import { createInitialState } from './init.js';
import type { GameState, LaborCategory } from './state.js';
import { ActionError, advanceTurn, applyAction, type TurnRules } from './turn.js';

const rules = fakeRules();
const initial = () => createInitialState(1, fakeContent());
const laborForce = (s: GameState): number =>
  Object.values(s.labor.employed).reduce((a, b) => a + b, 0) + s.labor.onWageSupport + s.labor.unemployed + s.labor.inTraining;

describe('il lavoro negli effetti', () => {
  it('vieta le variazioni dirette su labor.*', () => {
    for (const target of ['labor.unemployed', 'labor.onWageSupport', 'labor.inTraining', 'labor.employed.steel']) {
      expect(() => applyDeltas(initial(), [{ target, amount: 1 }]), target).toThrow(/spostamento/);
    }
  });

  it('uno spostamento muove persone tra categorie senza cambiare la forza lavoro', () => {
    const state = applyLaborMoves(initial(), [
      { from: 'unemployed', to: 'inTraining', count: 40 },
      { from: 'onWageSupport', to: 'energy', count: 25 },
    ]);
    expect(state.labor.unemployed).toBe(60);
    expect(state.labor.inTraining).toBe(40);
    expect(state.labor.onWageSupport).toBe(75);
    expect(state.labor.employed.energy).toBe(25);
    expect(laborForce(state)).toBe(laborForce(initial()));
  });

  it('si sposta al massimo chi c’è nella categoria di partenza', () => {
    const state = applyLaborMoves(initial(), [{ from: 'unemployed', to: 'steel', count: 1000 }]);
    expect(state.labor.unemployed).toBe(0);
    expect(state.labor.employed.steel).toBe(fakeContent().labor.employed.steel + 100);
    expect(laborForce(state)).toBe(laborForce(initial()));
  });

  it('rifiuta categorie inesistenti e numeri non interi o negativi', () => {
    expect(() => applyLaborMoves(initial(), [{ from: 'pensionati' as LaborCategory, to: 'unemployed', count: 1 }])).toThrow(EffectError);
    expect(() => applyLaborMoves(initial(), [{ from: 'unemployed', to: 'steel', count: 1.5 }])).toThrow(EffectError);
    expect(() => applyLaborMoves(initial(), [{ from: 'unemployed', to: 'steel', count: -3 }])).toThrow(EffectError);
  });

  it('uno spostamento ritardato si applica al turno previsto', () => {
    let state = scheduleEffect(initial(), {
      sourceId: 'formazione',
      delayTurns: 2,
      deltas: [],
      laborMoves: [{ from: 'unemployed', to: 'inTraining', count: 10 }],
    });
    state = advanceTurn(state, rules);
    expect(state.labor.inTraining).toBe(0);
    state = advanceTurn(state, rules);
    expect(state.labor.inTraining).toBe(10);
  });

  it('scheduleEffect rifiuta subito un effetto non applicabile', () => {
    expect(() => scheduleEffect(initial(), { sourceId: 'x', delayTurns: 3, deltas: [{ target: 'labor.unemployed', amount: 1 }] })).toThrow(
      EffectError,
    );
  });

  it('gli effetti di esercizio possono spostare lavoro, ogni anno', () => {
    const withMoves: TurnRules = structuredClone(rules);
    withMoves.projects['progetto-finto-senza-gara']!.operatingEffects.everyYear = {
      deltas: [],
      laborMoves: [{ from: 'unemployed', to: 'public', count: 5 }],
    };
    let state = applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-senza-gara' }, withMoves);
    for (let i = 0; i < 5; i++) state = advanceTurn(state, withMoves);
    // In esercizio dal turno 3: spostamenti negli anni 4 e 5.
    expect(state.labor.employed.public).toBe(fakeContent().labor.employed.public + 10);
    expect(laborForce(state)).toBe(laborForce(initial()));
  });

  it('un progetto con effetti non validi nei dati si rifiuta all’avvio', () => {
    const broken: TurnRules = structuredClone(rules);
    broken.projects['progetto-finto-8-anni']!.operatingEffects.once = { deltas: [{ target: 'labor.unemployed', amount: -10 }] };
    expect(() => applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, broken)).toThrow(ActionError);
  });
});

describe('lavoratori di fuori città', () => {
  it('outsideHires conta i posti coperti da fuori e torna a zero a fine lavori', () => {
    let state = applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, rules);
    state = structuredClone(state);
    state.labor.onWageSupport = 4;
    state.labor.unemployed = 6;
    for (let i = 0; i < 4; i++) state = advanceTurn(state, rules);
    expect(state.projects[0]).toMatchObject({ phase: 'works', localHires: 10, outsideHires: 20 });
    for (let i = 0; i < 4; i++) state = advanceTurn(state, rules);
    expect(state.projects[0]).toMatchObject({ phase: 'operating', localHires: 0, outsideHires: 0 });
  });

  it('con abbastanza persone in città nessun posto va fuori', () => {
    let state = applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, rules);
    for (let i = 0; i < 4; i++) state = advanceTurn(state, rules);
    expect(state.projects[0]).toMatchObject({ localHires: 30, outsideHires: 0 });
  });
});
