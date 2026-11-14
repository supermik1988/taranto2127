import { describe, expect, it } from 'vitest';
import { fakeContent } from './__fixtures__/fake-content.js';
import { fakeRules } from './__fixtures__/fake-rules.js';
import { createInitialState } from './init.js';
import { MAX_FREE_ACTIONS_PER_TURN, TOTAL_TURNS, type Action, type GameState } from './state.js';
import { ActionError, TurnError, advanceTurn, applyAction, delayProject, replay, type TurnRules } from './turn.js';
import { validateState } from './validate.js';

const rules = fakeRules();
const initial = (seed = 1) => createInitialState(seed, fakeContent());
const advance = (state: GameState, turns: number, r: TurnRules = rules): GameState => {
  for (let i = 0; i < turns; i++) state = advanceTurn(state, r);
  return state;
};

/** Una partita di prova: azioni sparse nei primi anni, poi fino al 2127. */
function scriptedGame(seed: number): GameState {
  const script: Record<number, Action[]> = {
    0: [
      { kind: 'start-project', definitionId: 'progetto-finto-variabile', district: 'borgo' },
      { kind: 'convert-lot', lotId: 'lotto-finto-a', path: 'remediation' },
      { kind: 'make-promise', text: 'Un parco ai Tamburi', dueByTurn: 10, toDistrict: 'tamburi' },
    ],
    2: [
      { kind: 'start-project', definitionId: 'progetto-finto-variabile', lotId: 'lotto-finto-b' },
      { kind: 'set-policy', policyId: 'politica-finta', active: true },
      { kind: 'answer-dilemma', dilemmaId: 'dilemma-finto', optionId: 'palese' },
    ],
    5: [{ kind: 'start-project', definitionId: 'progetto-finto-8-anni', district: 'tamburi' }],
  };
  let state = initial(seed);
  while (state.status === 'running') {
    for (const action of script[state.turn] ?? []) state = applyAction(state, action, rules);
    state = advanceTurn(state, rules);
  }
  return state;
}

describe('determinismo', () => {
  it('stesso seme e stessa storia producono uno stato identico byte per byte', () => {
    expect(JSON.stringify(scriptedGame(2027))).toBe(JSON.stringify(scriptedGame(2027)));
  });

  it('il seme conta: semi diversi danno durate diverse ai progetti variabili', () => {
    const durations = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
        const state = applyAction(initial(seed), { kind: 'start-project', definitionId: 'progetto-finto-variabile' }, rules);
        return replayUntilOperating(state);
      }),
    );
    expect(durations.size).toBeGreaterThan(1);
  });

  it('seme e storia bastano a rigiocare la partita identica', () => {
    const final = scriptedGame(99);
    const replayed = replay(initial(99), final.history, rules, final.turn);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(final));
  });

  it('applyAction e advanceTurn non modificano lo stato ricevuto', () => {
    const state = initial();
    const snapshot = JSON.stringify(state);
    const after = applyAction(state, { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, rules);
    advanceTurn(after, rules);
    advanceTurn(state, rules);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

function replayUntilOperating(state: GameState): number {
  let turns = 0;
  while (state.projects[0]!.phase !== 'operating') {
    state = advanceTurn(state, rules);
    turns++;
  }
  return turns;
}

describe('fasi dei progetti', () => {
  it('fasi di 1, 2, 1 e 4 anni: in esercizio esattamente 8 turni dopo l’avvio, senza effetti prima', () => {
    let state = advance(initial(), 3);
    state = applyAction(state, { kind: 'start-project', definitionId: 'progetto-finto-8-anni', district: 'tamburi' }, rules);
    const startedOn = state.turn;
    const greenBefore = state.districts.tamburi.greenCover;
    const expectedPhases = ['permitting', 'permitting', 'tender', 'works', 'works', 'works', 'works', 'operating'];
    expect(state.projects[0]!.phase).toBe('design');

    for (let i = 1; i <= 8; i++) {
      state = advanceTurn(state, rules);
      expect(state.projects[0]!.phase, `turno ${startedOn + i}`).toBe(expectedPhases[i - 1]);
      if (i < 8) expect(state.districts.tamburi.greenCover).toBe(greenBefore);
    }
    expect(state.turn).toBe(startedOn + 8);
    expect(state.districts.tamburi.greenCover).toBe(greenBefore + 10);

    // Gli effetti di esercizio si applicano una volta sola.
    state = advance(state, 5);
    expect(state.districts.tamburi.greenCover).toBe(greenBefore + 10);
  });

  it('un progetto passa di fase solo quando turnsLeftInPhase arriva a zero', () => {
    let state = applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, rules);
    state = advance(state, 1); // inizia l'autorizzazione: 2 anni
    expect(state.projects[0]).toMatchObject({ phase: 'permitting', turnsLeftInPhase: 2 });
    state = advance(state, 1);
    expect(state.projects[0]).toMatchObject({ phase: 'permitting', turnsLeftInPhase: 1 });
    state = advance(state, 1);
    expect(state.projects[0]).toMatchObject({ phase: 'tender', turnsLeftInPhase: 1 });
  });

  it('i ritardi allungano la fase e restano registrati', () => {
    let state = applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, rules);
    state = advance(state, 2);
    state = delayProject(state, state.projects[0]!.id, 2);
    expect(state.projects[0]).toMatchObject({ phase: 'permitting', turnsLeftInPhase: 3, delayTurns: 2 });
    state = advance(state, 7);
    expect(state.projects[0]!.phase).toBe('works');
    state = advance(state, 1);
    expect(state.projects[0]!.phase).toBe('operating');
    expect(state.turn).toBe(10);
  });

  it('una fase con durata 0 viene saltata', () => {
    let state = applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-senza-gara' }, rules);
    state = advance(state, 2);
    expect(state.projects[0]!.phase).toBe('works');
    state = advance(state, 1);
    expect(state.projects[0]!.phase).toBe('operating');
  });

  it('le durate estratte stanno tra minimo e massimo dei dati', () => {
    const def = rules.projects['progetto-finto-variabile']!;
    const min = def.phases.design.minTurns + def.phases.permitting.minTurns + def.phases.tender.minTurns + def.phases.works.minTurns;
    const max = def.phases.design.maxTurns + def.phases.permitting.maxTurns + def.phases.tender.maxTurns + def.phases.works.maxTurns;
    for (let seed = 0; seed < 50; seed++) {
      const state = applyAction(initial(seed), { kind: 'start-project', definitionId: 'progetto-finto-variabile' }, rules);
      const turns = replayUntilOperating(state);
      expect(turns).toBeGreaterThanOrEqual(min);
      expect(turns).toBeLessThanOrEqual(max);
    }
  });

  it('un progetto annullato si ferma e non produce effetti', () => {
    let state = applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, rules);
    const green = state.districts.tamburi.greenCover;
    state = advance(state, 3);
    state = applyAction(state, { kind: 'cancel-project', projectId: state.projects[0]!.id }, rules);
    state = advance(state, 10);
    expect(state.projects[0]!.phase).toBe('cancelled');
    expect(state.districts.tamburi.greenCover).toBe(green);
    expect(() => delayProject(state, state.projects[0]!.id, 1)).toThrow(ActionError);
  });
});

describe('lotti di ILSIDER e clima', () => {
  it('un lotto avanza di un anno per turno e la bonifica completata lo segna bonificato', () => {
    let state = applyAction(initial(), { kind: 'convert-lot', lotId: 'lotto-finto-a', path: 'remediation' }, rules);
    const progress: number[] = [];
    for (let i = 0; i < 5; i++) {
      state = advanceTurn(state, rules);
      progress.push(state.plantLots[0]!.progress);
    }
    expect(progress).toEqual([0.25, 0.5, 0.75, 1, 1]);
    expect(state.plantLots[0]!.remediated).toBe(true);
    expect(state.plantLots[1]).toMatchObject({ path: 'idle', progress: 0 });
  });

  it('arriva esattamente a 1 anche con durate che non dividono 1 in parti esatte', () => {
    let state = applyAction(initial(), { kind: 'convert-lot', lotId: 'lotto-finto-a', path: 'green-steel' }, rules);
    state = advance(state, 3);
    expect(state.plantLots[0]!.progress).toBe(1);
    expect(state.plantLots[0]!.remediated).toBe(false);
  });

  it('il clima segue lo scenario, epoca per epoca', () => {
    const state = advance(initial(), 25);
    // 20 anni della prima epoca a 0,5 cm e 5 della seconda a 0,6 cm.
    expect(state.climate.seaLevelRiseCm).toBeCloseTo(20 * 0.5 + 5 * 0.6, 9);
    expect(state.climate.summerHeat).toBeCloseTo(50 + 25 * 0.2, 9);
  });
});

describe('azioni', () => {
  it(`massimo ${MAX_FREE_ACTIONS_PER_TURN} azioni libere per turno`, () => {
    let state = initial();
    for (let i = 0; i < MAX_FREE_ACTIONS_PER_TURN; i++) {
      state = applyAction(state, { kind: 'set-policy', policyId: `p${i}`, active: true }, rules);
    }
    expect(() => applyAction(state, { kind: 'set-policy', policyId: 'troppe', active: true }, rules)).toThrow(ActionError);
    // Le risposte ai dilemmi non consumano azioni libere.
    state = applyAction(state, { kind: 'answer-dilemma', dilemmaId: 'dilemma-finto', optionId: 'palese' }, rules);
    // Il turno dopo il conteggio riparte.
    state = advanceTurn(state, rules);
    expect(() => applyAction(state, { kind: 'set-policy', policyId: 'ok', active: true }, rules)).not.toThrow();
  });

  it('ogni azione finisce nella storia con il suo turno', () => {
    let state = advance(initial(), 4);
    state = applyAction(state, { kind: 'negotiate', factionId: 'f', offerId: 'o' }, rules);
    expect(state.history).toEqual([{ turn: 4, action: { kind: 'negotiate', factionId: 'f', offerId: 'o' } }]);
  });

  it('una promessa resta aperta con la sua scadenza', () => {
    const state = applyAction(initial(), { kind: 'make-promise', text: 'Scuole nuove', dueByTurn: 6, toDistrict: 'paolo-vi' }, rules);
    expect(state.promises).toEqual([
      { id: 'promise-0-0', madeOnTurn: 0, dueByTurn: 6, toDistrict: 'paolo-vi', text: 'Scuole nuove', status: 'open' },
    ]);
  });

  it('le politiche si attivano e si disattivano senza doppioni', () => {
    let state = applyAction(initial(), { kind: 'set-policy', policyId: 'p', active: true }, rules);
    state = applyAction(state, { kind: 'set-policy', policyId: 'p', active: true }, rules);
    expect(state.activePolicies).toEqual(['p']);
    state = applyAction(state, { kind: 'set-policy', policyId: 'p', active: false }, rules);
    expect(state.activePolicies).toEqual([]);
  });

  it('rifiuta azioni su oggetti inesistenti o non valide', () => {
    const s = initial();
    const bad: Action[] = [
      { kind: 'start-project', definitionId: 'nessuno' },
      { kind: 'start-project', definitionId: 'progetto-finto-8-anni', lotId: 'nessuno' },
      { kind: 'start-project', definitionId: 'progetto-finto-8-anni', district: 'atlantide' as never },
      { kind: 'cancel-project', projectId: 'nessuno' },
      { kind: 'convert-lot', lotId: 'nessuno', path: 'energy' },
      { kind: 'convert-lot', lotId: 'lotto-finto-a', path: 'idle' },
      { kind: 'make-promise', text: ' ', dueByTurn: 5 },
      { kind: 'make-promise', text: 'ieri', dueByTurn: 0 },
      { kind: 'make-promise', text: 'oltre', dueByTurn: TOTAL_TURNS + 1 },
    ];
    for (const action of bad) expect(() => applyAction(s, action, rules), JSON.stringify(action)).toThrow(ActionError);
  });
});

describe('fine della partita', () => {
  it('100 turni senza azioni terminano con ended-2127', () => {
    let state = initial();
    for (let i = 0; i < TOTAL_TURNS; i++) {
      expect(state.status).toBe('running');
      state = advanceTurn(state, rules);
      expect(validateState(state).errors).toEqual([]);
    }
    expect(state.turn).toBe(TOTAL_TURNS);
    expect(state.status).toBe('ended-2127');
  });

  it('una partita conclusa non accetta altri turni né azioni', () => {
    const state = advance(initial(), TOTAL_TURNS);
    expect(() => advanceTurn(state, rules)).toThrow(TurnError);
    expect(() => applyAction(state, { kind: 'set-policy', policyId: 'p', active: true }, rules)).toThrow(ActionError);
  });

  it('la partita di prova completa resta valida e finisce nel 2127', () => {
    const final = scriptedGame(5);
    expect(final.status).toBe('ended-2127');
    expect(validateState(final).errors).toEqual([]);
    expect(final.projects.every((p) => p.phase === 'operating')).toBe(true);
  });
});
