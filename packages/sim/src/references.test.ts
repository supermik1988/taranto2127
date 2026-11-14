import { describe, expect, it } from 'vitest';
import { fakeContent } from './__fixtures__/fake-content.js';
import { fakeRules } from './__fixtures__/fake-rules.js';
import { EffectError, applyDeltas, scheduleEffect } from './effects.js';
import { createInitialState } from './init.js';
import { MoralError, readNumber } from './moral.js';
import { ActionError, advanceTurn, applyAction, type TurnRules } from './turn.js';
import { validateState } from './validate.js';

const initial = () => createInitialState(1, fakeContent());

describe('consiglieri per identificativo', () => {
  it('un effetto può indicare un consigliere con il suo id', () => {
    const state = applyDeltas(initial(), [{ target: 'council.consigliere-finto-2.trustInPlayer', amount: 10 }]);
    expect(state.council.map((c) => c.trustInPlayer)).toEqual([50, 60]);
  });

  it('l’effetto su un consigliere si ferma ai limiti e lo stato resta valido', () => {
    const state = applyDeltas(initial(), [{ target: 'council.consigliere-finto-1.patience', amount: 500 }]);
    expect(state.council[0]!.patience).toBe(100);
    expect(validateState(state).errors).toEqual([]);
  });

  it('il riferimento per posizione non è più ammesso negli effetti', () => {
    expect(() => applyDeltas(initial(), [{ target: 'council.0.trustInPlayer', amount: 1 }])).toThrow(/id, non con la posizione/);
    expect(() => scheduleEffect(initial(), { sourceId: 'x', delayTurns: 1, deltas: [{ target: 'council.1.patience', amount: 1 }] })).toThrow(
      EffectError,
    );
  });

  it('un id inesistente viene rifiutato', () => {
    expect(() => applyDeltas(initial(), [{ target: 'council.nessuno.trustInPlayer', amount: 1 }])).toThrow(EffectError);
  });

  it('le condizioni leggono un consigliere per id, mai per posizione', () => {
    expect(readNumber(initial(), 'council.consigliere-finto-1.trustInPlayer')).toBe(50);
    expect(() => readNumber(initial(), 'council.0.trustInPlayer')).toThrow(MoralError);
  });

  it('un dilemma i cui effetti indicano un consigliere per id si applica', () => {
    const rules: TurnRules = structuredClone(fakeRules());
    rules.dilemmas['dilemma-finto']!.options['palese']!.immediate = {
      deltas: [{ target: 'council.consigliere-finto-2.trustInPlayer', amount: -5 }],
    };
    const state = applyAction({ ...initial(), openDilemmaId: 'dilemma-finto' }, { kind: 'answer-dilemma', dilemmaId: 'dilemma-finto', optionId: 'palese' }, rules);
    expect(state.council[1]!.trustInPlayer).toBe(45);
  });
});

describe('progetti unici', () => {
  const rules: TurnRules = structuredClone(fakeRules());
  rules.projects['progetto-finto-8-anni']!.unique = true;
  const start = (state: ReturnType<typeof initial>, definitionId = 'progetto-finto-8-anni') =>
    applyAction(state, { kind: 'start-project', definitionId }, rules);

  it('un progetto unico si avvia una sola volta', () => {
    const state = start(initial());
    expect(() => start(state)).toThrow(ActionError);
  });

  it('resta unico anche dopo l’entrata in esercizio', () => {
    let state = start(initial());
    for (let i = 0; i < 8; i++) state = advanceTurn(state, rules);
    expect(state.projects[0]!.phase).toBe('operating');
    expect(() => start(state)).toThrow(ActionError);
  });

  it('se annullato, si può avviare di nuovo', () => {
    let state = start(initial());
    state = applyAction(state, { kind: 'cancel-project', projectId: state.projects[0]!.id }, rules);
    state = start(state);
    expect(state.projects.map((p) => p.phase)).toEqual(['cancelled', 'design']);
  });

  it('un progetto non unico si avvia più volte', () => {
    let state = start(initial(), 'progetto-finto-variabile');
    state = start(state, 'progetto-finto-variabile');
    expect(state.projects).toHaveLength(2);
  });
});
