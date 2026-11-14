import { describe, expect, it } from 'vitest';
import { fakeContent } from './__fixtures__/fake-content.js';
import { DISTRICT_IDS, InvalidInitialStateError, createInitialState } from './init.js';
import { validateState } from './validate.js';

describe('createInitialState', () => {
  it('lo stato iniziale passa la validazione', () => {
    const result = validateState(createInitialState(42, fakeContent()));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('parte dal turno 0 con i valori stabiliti dall’architetto', () => {
    const state = createInitialState(42, fakeContent());
    expect(state.seed).toBe(42);
    expect(state.turn).toBe(0);
    expect(state.decisionProvider).toBe('rules');
    expect(state.researchConsent).toBe(false);
    expect(state.projects).toEqual([]);
    expect(state.promises).toEqual([]);
    expect(state.moral.conscience).toBe(0);
    expect(state.moral.reputation).toBe(0);
    expect(state.status).toBe('running');
  });

  it('parte senza storia, effetti, atti nascosti né decisioni registrate', () => {
    const state = createInitialState(42, fakeContent());
    expect(state.history).toEqual([]);
    expect(state.pendingEffects).toEqual([]);
    expect(state.activePolicies).toEqual([]);
    expect(state.recordedDecisions).toEqual([]);
    expect(state.moral.hiddenActs).toEqual([]);
    expect(Object.values(state.moral.byDimension)).toEqual([0, 0, 0, 0, 0]);
  });

  it('prende i numeri dai contenuti', () => {
    const content = fakeContent();
    const state = createInitialState(7, content);
    expect(state.calibrationVersion).toBe('finto-0');
    expect(Object.keys(state.districts)).toEqual([...DISTRICT_IDS]);
    expect(state.districts.tamburi).toEqual({ id: 'tamburi', ...content.districts.tamburi });
    expect(state.labor).toEqual({ ...content.labor, trained: 0 });
    expect(state.economy).toEqual({ ...content.economy, deficitYears: 0, euTranches: [] });
    expect(state.climate).toEqual(content.climate);
    expect(state.plantLots).toEqual(content.plantLots);
    expect(state.council.map((c) => c.electedInEpoch)).toEqual([0, 0]);
  });

  it('è deterministica: stesso seme e stessi dati danno lo stesso stato', () => {
    const a = createInitialState(123, fakeContent());
    const b = createInitialState(123, fakeContent());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('non modifica i contenuti e non condivide oggetti con essi', () => {
    const content = fakeContent();
    const snapshot = JSON.stringify(content);
    const state = createInitialState(1, content);
    state.districts.tamburi.health = 0;
    state.plantLots[0]!.progress = 1;
    state.council[0]!.trustInPlayer = 0;
    expect(JSON.stringify(content)).toBe(snapshot);
  });

  it('rifiuta contenuti che producono uno stato non valido', () => {
    const content = fakeContent();
    content.districts.borgo.health = 150;
    expect(() => createInitialState(1, content)).toThrow(InvalidInitialStateError);
    expect(() => createInitialState(1, content)).toThrow(/districts\.borgo\.health/);
  });
});
