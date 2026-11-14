import { describe, expect, it } from 'vitest';
import { fakeContent } from './__fixtures__/fake-content.js';
import { fakeRules, fakeRulesWithEconomy, withOpenDilemma } from './__fixtures__/fake-rules.js';
import { randomGame } from './__fixtures__/random-game.js';
import { applyDeltas, scheduleEffect } from './effects.js';
import { createInitialState } from './init.js';
import { conscienceFrom, scandalProbability } from './moral.js';
import { TOTAL_TURNS, type Action, type ConversionPath, type GameState } from './state.js';
import { ActionError, advanceTurn, applyAction, type TurnRules } from './turn.js';
import { validateState } from './validate.js';

const rules = fakeRules();
const initial = (seed = 1) => createInitialState(seed, fakeContent());
const act = (state: GameState, action: Action, r: TurnRules = rules): GameState => applyAction(state, action, r);
/** Apre il dilemma di prova e risponde con l'opzione indicata. */
const answer = (state: GameState, optionId: string, r: TurnRules = rules): GameState =>
  act(withOpenDilemma(state), { kind: 'answer-dilemma', dilemmaId: 'dilemma-finto', optionId }, r);
const advance = (state: GameState, turns: number, r: TurnRules = rules): GameState => {
  for (let i = 0; i < turns; i++) state = advanceTurn(state, r);
  return state;
};

describe('regola 5: le strade di riconversione non hanno peso morale', () => {
  const paths: ConversionPath[] = ['green-steel', 'remediation', 'energy', 'sea-culture', 'idle'];

  for (const path of paths) {
    it(`convert-lot verso ${path} non muove il contatore, né subito né negli anni`, () => {
      const start = path === 'idle' ? act(initial(), { kind: 'convert-lot', lotId: 'lotto-finto-a', path: 'energy' }) : initial();
      const moral = start.moral;
      let state = act(start, { kind: 'convert-lot', lotId: 'lotto-finto-a', path });
      expect(state.moral).toEqual(moral);
      state = advance(state, 30);
      expect(state.moral).toEqual(moral);
    });
  }

  for (const definitionId of Object.keys(rules.projects)) {
    it(`start-project ${definitionId} non muove il contatore, né subito né in esercizio`, () => {
      const moral = initial().moral;
      let state = act(initial(), { kind: 'start-project', definitionId });
      expect(state.moral).toEqual(moral);
      state = advance(state, 30);
      expect(state.projects[0]!.phase).toBe('operating');
      expect(state.moral).toEqual(moral);
    });
  }

  it('un progetto i cui effetti toccano il contatore morale viene rifiutato', () => {
    const broken: TurnRules = structuredClone(rules);
    broken.projects['progetto-finto-8-anni']!.operatingEffects.everyYear = {
      deltas: [{ target: 'moral.byDimension.care', amount: 1 }],
    };
    expect(() => act(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, broken)).toThrow(/regola 5/);
  });

  it('nessun effetto può toccare il contatore, compresi applyDeltas e scheduleEffect', () => {
    for (const target of ['moral.conscience', 'moral.reputation', 'moral.byDimension.care']) {
      expect(() => applyDeltas(initial(), [{ target, amount: 1 }]), target).toThrow(/regola 5/);
      expect(() => scheduleEffect(initial(), { sourceId: 'x', delayTurns: 2, deltas: [{ target, amount: 1 }] }), target).toThrow(/regola 5/);
    }
  });

  it('anche un dilemma non può toccare il contatore con un effetto: solo con i pesi', () => {
    const broken: TurnRules = structuredClone(rules);
    broken.dilemmas['dilemma-finto']!.options['palese']!.immediate = { deltas: [{ target: 'moral.reputation', amount: 50 }] };
    expect(() => answer(initial(), 'palese', broken)).toThrow(/regola 5/);
  });
});

describe('dilemmi', () => {
  it('un’opzione applica effetti immediati e ritardati', () => {
    const before = initial().districts.tamburi;
    let state = answer(initial(), 'palese');
    expect(state.districts.tamburi.trust).toBe(before.trust + 2);
    expect(state.districts.tamburi.health).toBe(before.health);
    state = advance(state, 2);
    expect(state.districts.tamburi.health).toBe(before.health);
    state = advance(state, 1);
    expect(state.districts.tamburi.health).toBe(before.health + 1);
  });

  it('opzione o dilemma inesistenti: errore', () => {
    expect(() => answer(initial(), 'nessuna')).toThrow(ActionError);
    expect(() => act(initial(), { kind: 'answer-dilemma', dilemmaId: 'nessuno', optionId: 'palese' })).toThrow(ActionError);
  });

  it('la risposta resta nella storia e non consuma azioni libere', () => {
    let state = initial();
    for (let i = 0; i < 5; i++) state = answer(state, 'palese');
    expect(state.history).toHaveLength(5);
  });
});

describe('coscienza e reputazione', () => {
  it('la coscienza è la media pesata delle cinque dimensioni', () => {
    const byDimension = { truth: 10, word: 0, care: -20, legality: 30, listening: 0 };
    expect(conscienceFrom(byDimension, { truth: 1, word: 1, care: 1, legality: 1, listening: 1 })).toBe(4);
    expect(conscienceFrom(byDimension, { truth: 2, word: 0, care: 1, legality: 1, listening: 0 })).toBe(7.5);
  });

  it('un atto palese muove dimensioni, coscienza e reputazione della stessa quantità', () => {
    const state = answer(initial(), 'palese');
    expect(state.moral.byDimension).toMatchObject({ truth: 5, listening: 3 });
    expect(state.moral.conscience).toBeCloseTo(8 / 5, 12);
    expect(state.moral.reputation).toBeCloseTo(8 / 5, 12);
    expect(state.moral.hiddenActs).toEqual([]);
  });

  it('un atto nascosto lascia ferma la reputazione e finisce in hiddenActs', () => {
    const state = answer(initial(), 'nascosta');
    expect(state.moral.conscience).toBeCloseTo(-7 / 5, 12);
    expect(state.moral.reputation).toBe(0);
    expect(state.moral.hiddenActs.map((a) => [a.dimension, a.weight])).toEqual([
      ['truth', -4],
      ['legality', -3],
    ]);
  });

  it('i pesi delle dimensioni vengono dai dati', () => {
    const weighted: TurnRules = structuredClone(rules);
    weighted.moral.dimensionWeights = { truth: 3, word: 1, care: 1, legality: 0, listening: 0 };
    const state = answer(initial(), 'palese', weighted);
    expect(state.moral.conscience).toBe(3); // (5 × 3) / 5
  });
});

describe('scandalo', () => {
  it('la probabilità cresce con lo scarto tra reputazione e coscienza', () => {
    const state = structuredClone(initial());
    const at = (reputation: number, conscience: number): number => {
      state.moral.reputation = reputation;
      state.moral.conscience = conscience;
      return scandalProbability(state, rules.moral);
    };
    expect(at(0, 0)).toBe(0.02);
    expect(at(10, 0)).toBeCloseTo(0.04, 12);
    expect(at(50, -50)).toBeCloseTo(0.22, 12);
    expect(at(100, -100)).toBeCloseTo(0.42, 12);
    expect(at(-20, 0)).toBe(0.02); // reputazione peggiore della coscienza: nessun aumento
  });

  it('con dieci atti nascosti lo scandalo arriva entro 20 turni in almeno il 95% di 1.000 semi', { timeout: 60_000 }, () => {
    let withScandal = 0;
    for (let seed = 0; seed < 1000; seed++) {
      let state = initial(seed);
      for (let i = 0; i < 10; i++) state = answer(state, 'nascosta-legalita');
      expect(state.moral.hiddenActs).toHaveLength(10);
      for (let t = 0; t < 20; t++) {
        state = advanceTurn(state, rules);
        if (state.moral.hiddenActs.length < 10) {
          withScandal++;
          break;
        }
      }
    }
    expect(withScandal).toBeGreaterThanOrEqual(950);
  });

  it('dopo uno scandalo la reputazione è sotto la coscienza, e l’atto esce da hiddenActs', () => {
    let state = answer(initial(7), 'palese');
    state = answer(state, 'nascosta-legalita');
    expect(state.moral.reputation).toBeGreaterThan(state.moral.conscience);
    let turns = 0;
    while (state.moral.hiddenActs.length > 0 && turns++ < 500) state = advanceTurn(state, rules);
    expect(state.moral.hiddenActs).toEqual([]);
    expect(state.moral.reputation).toBeLessThan(state.moral.conscience);
    expect(state.moral.reputation).toBeCloseTo(state.moral.conscience - 10, 12);
  });

  it('ogni atto scoperto entra nel registro degli scandali con turno e dimensione', () => {
    let state = answer(initial(3), 'nascosta'); // due atti: verità e legalità
    expect(state.moral.scandals).toEqual([]);
    const seen: number[] = [];
    let turns = 0;
    while (state.moral.hiddenActs.length > 0 && turns++ < 500) {
      const closing = state.turn;
      state = advanceTurn(state, rules);
      if (state.moral.scandals.length > seen.length) seen.push(...state.moral.scandals.slice(seen.length).map(() => closing));
    }
    expect(state.moral.scandals.map((s) => s.dimension).sort()).toEqual(['legality', 'truth']);
    expect(state.moral.scandals.map((s) => s.turn)).toEqual(seen);
    expect(state.moral.scandals.every((s) => s.actId.endsWith(`:${s.dimension}`))).toBe(true);
  });

  it('senza atti nascosti non c’è scandalo', () => {
    const state = advance(answer(initial(), 'palese'), 50);
    expect(state.moral.reputation).toBeCloseTo(state.moral.conscience, 12);
  });
});

describe('scorciatoia', () => {
  const start = (): GameState => act(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' });
  // Per misurare gli anni guadagnati la scorciatoia non deve essere scoperta: dal T07 uno scandalo rimanda indietro il progetto.
  const quiet: TurnRules = structuredClone(rules);
  quiet.moral.scandal.baseProbability = 0;
  quiet.moral.scandal.probabilityPerGapPoint = 0;
  const turnsToOperating = (state: GameState): number => {
    let turns = 0;
    while (state.projects[0]!.phase !== 'operating') {
      state = advanceTurn(state, quiet);
      turns++;
    }
    return turns + 1; // contando il primo turno già giocato prima della scorciatoia
  };

  it('saltare le autorizzazioni fa guadagnare esattamente i 2 anni di quella fase', () => {
    let state = advance(start(), 1);
    expect(state.projects[0]).toMatchObject({ phase: 'permitting', turnsLeftInPhase: 2 });
    state = act(state, { kind: 'shortcut-phase', projectId: state.projects[0]!.id });
    expect(state.projects[0]).toMatchObject({ phase: 'tender', shortcutTaken: true });
    expect(turnsToOperating(state)).toBe(8 - 2);
  });

  it('saltare la gara fa guadagnare esattamente l’anno di quella fase', () => {
    let state = advance(start(), 3);
    expect(state.projects[0]).toMatchObject({ phase: 'tender', turnsLeftInPhase: 1 });
    state = act(state, { kind: 'shortcut-phase', projectId: state.projects[0]!.id });
    expect(state.projects[0]!.phase).toBe('works');
    let turns = 3;
    while (state.projects[0]!.phase !== 'operating') {
      state = advanceTurn(state, quiet);
      turns++;
    }
    expect(turns).toBe(8 - 1);
  });

  it('registra un atto nascosto sulla legalità e lascia ferma la reputazione', () => {
    let state = advance(start(), 1);
    state = act(state, { kind: 'shortcut-phase', projectId: state.projects[0]!.id });
    expect(state.moral.hiddenActs).toEqual([
      {
        id: expect.any(String),
        turn: 1,
        dimension: 'legality',
        weight: -5,
        source: { kind: 'shortcut', projectId: state.projects[0]!.id, skippedPhase: 'permitting' },
      },
    ]);
    expect(state.moral.byDimension.legality).toBe(-5);
    expect(state.moral.conscience).toBe(-1);
    expect(state.moral.reputation).toBe(0);
  });

  it('non si possono saltare progettazione, lavori o esercizio', () => {
    let state = start();
    expect(() => act(state, { kind: 'shortcut-phase', projectId: state.projects[0]!.id })).toThrow(ActionError);
    state = advance(state, 4);
    expect(state.projects[0]!.phase).toBe('works');
    expect(() => act(state, { kind: 'shortcut-phase', projectId: state.projects[0]!.id })).toThrow(ActionError);
    expect(() => act(state, { kind: 'shortcut-phase', projectId: 'nessuno' })).toThrow(ActionError);
  });

  it('si somma ad altre azioni nello stesso anno, senza limite di numero (T10)', () => {
    let state = advance(start(), 1);
    state = act(state, { kind: 'set-policy', policyId: 'p1', active: true });
    state = act(state, { kind: 'set-policy', policyId: 'p2', active: true });
    state = act(state, { kind: 'shortcut-phase', projectId: state.projects[0]!.id });
    expect(() => act(state, { kind: 'set-policy', policyId: 'p3', active: true })).not.toThrow();
  });
});

describe('promesse', () => {
  it('una promessa con condizione vera diventa kept nel turno di scadenza e premia la parola', () => {
    let state = answer(initial(), 'promessa'); // scade al turno 3: verde ai Tamburi >= 60
    expect(state.promises[0]).toMatchObject({ dueByTurn: 3, status: 'open' });
    state = structuredClone(state);
    state.districts.tamburi.greenCover = 70;
    state = advance(state, 2);
    expect(state.promises[0]!.status).toBe('open');
    const before = state.moral;
    state = advance(state, 1);
    expect(state.turn).toBe(3);
    expect(state.promises[0]!.status).toBe('kept');
    expect(state.moral.byDimension.word).toBe(before.byDimension.word + 5);
    expect(state.moral.reputation - before.reputation).toBeCloseTo(state.moral.conscience - before.conscience, 12);
  });

  it('una promessa con condizione falsa diventa broken nel turno di scadenza e pesa sulla parola', () => {
    let state = advance(answer(initial(), 'promessa'), 2);
    expect(state.promises[0]!.status).toBe('open');
    state = advance(state, 1);
    expect(state.promises[0]!.status).toBe('broken');
    expect(state.moral.byDimension.word).toBe(-10);
    expect(state.moral.reputation).toBeCloseTo(state.moral.conscience, 12); // palese
  });

  it('le promesse a testo libero restano open anche dopo la scadenza', () => {
    let state = answer(initial(), 'promessa-libera');
    state = act(state, { kind: 'make-promise', text: 'Una piazza nuova', dueByTurn: 2 });
    state = advance(state, 5);
    expect(state.promises.map((p) => p.status)).toEqual(['open', 'open']);
    expect(state.moral.byDimension.word).toBe(0);
  });

  it('una condizione su una variabile inesistente viene rifiutata alla risposta', () => {
    const broken: TurnRules = structuredClone(rules);
    broken.dilemmas['dilemma-finto']!.options['promessa']!.promise!.condition!.target = 'districts.atlantide.health';
    expect(() => answer(initial(), 'promessa', broken)).toThrow(ActionError);
  });
});

// Test pesanti: margine ampio perché girano in parallelo con gli altri.
describe('partita completa', { timeout: 60_000 }, () => {
  it('stessa partita identica a parità di seme e storia', () => {
    const r = fakeRulesWithEconomy();
    expect(JSON.stringify(randomGame(123, r))).toBe(JSON.stringify(randomGame(123, r)));
  });

  it('stato sempre valido in 100 turni di gioco casuale, con scorciatoie, dilemmi e scandali', () => {
    let hidden = 0;
    let shortcuts = 0;
    for (const seed of [21, 22, 23, 24, 25]) {
      const final = randomGame(seed, fakeRulesWithEconomy(), (s) => {
        expect(validateState(s).errors).toEqual([]);
        hidden = Math.max(hidden, s.moral.hiddenActs.length);
      });
      expect(final.status).toBe('ended-2127');
      expect(final.turn).toBe(TOTAL_TURNS);
      shortcuts += final.projects.filter((p) => p.shortcutTaken).length;
    }
    expect(hidden).toBeGreaterThan(0); // il bot ha davvero agito di nascosto
    expect(shortcuts).toBeGreaterThan(0);
  });
});
