import { describe, expect, it } from 'vitest';
import { fakeContent } from './__fixtures__/fake-content.js';
import { activeCity, activeEconomy, fakeRules, withOpenDilemma } from './__fixtures__/fake-rules.js';
import { randomGame } from './__fixtures__/random-game.js';
import { averageTrust, civicFactor } from './city.js';
import { debit, payMandatorySpending } from './economy.js';
import { scaleBeneficial } from './effects.js';
import { TurnError } from './errors.js';
import { createInitialState } from './init.js';
import { rngFor } from './rng.js';
import { DISTRICT_IDS } from './validate.js';
import type { GameState } from './state.js';
import { advanceTurn, applyAction, replay, type TurnRules } from './turn.js';
import { validateState } from './validate.js';

const initial = (seed = 1) => createInitialState(seed, fakeContent());
const cityRules = (): TurnRules => ({ ...fakeRules(), city: activeCity() });
const patch = (state: GameState, change: (s: GameState) => void): GameState => {
  const next = structuredClone(state);
  change(next);
  return next;
};
const advance = (state: GameState, turns: number, rules: TurnRules): GameState => {
  for (let i = 0; i < turns && state.status === 'running'; i++) state = advanceTurn(state, rules);
  return state;
};

describe('A. correzioni sui fondi', () => {
  it('la cassa integrazione non porta il fondo statale sotto zero per arrotondamento', () => {
    // 111,6 - floor(111,6 / 0,006) × 0,006 vale -1,4e-14 in virgola mobile: è il difetto trovato dai bot.
    for (const [funds, cost] of [[111.6, 0.006], [127.74, 0.012]] as const) {
      expect(funds - Math.floor(funds / cost) * cost).toBeLessThan(0);
      const state = patch(initial(), (s) => {
        s.economy.funds.state = funds;
        s.labor.onWageSupport = 20000;
      });
      payMandatorySpending(state, { ...activeEconomy(), wageSupportCostPerPerson: cost });
      expect(state.economy.funds.state).toBe(0);
      expect(state.labor.onWageSupport + state.labor.unemployed).toBe(20000 + 100);
    }
  });

  it('su migliaia di combinazioni di fondo e costo nessun fondo scende sotto zero', () => {
    const rng = rngFor(7, 'prova-arrotondamenti');
    for (let i = 0; i < 5000; i++) {
      const state = patch(initial(), (s) => {
        s.economy.funds.state = Math.round(rng.next() * 100000) / 1000;
        s.labor.onWageSupport = rng.int(0, 20000);
      });
      payMandatorySpending(state, { ...activeEconomy(), wageSupportCostPerPerson: rng.int(1, 20000) / 1_000_000 });
      expect(state.economy.funds.state).toBeGreaterThanOrEqual(0);
    }
  });

  it('uno scoperto vero, non dovuto ad arrotondamento, è un errore del motore', () => {
    const state = patch(initial(), (s) => (s.economy.funds.state = 1));
    expect(() => debit(state, 'state', 5)).toThrow(TurnError);
    debit(state, 'own', 5000); // i fondi propri possono andare in disavanzo
  });

  it('l’avanzo dei fondi propri oltre la riserva si spende in servizi, in proporzione alla spesa', () => {
    const rules = { ...fakeRules(), economy: { ...fakeRules().economy, ownSurplusReserve: 100, servicesPerSurplusMillion: 0.05 } };
    const rich = advanceTurn(patch(initial(), (s) => (s.economy.funds.own = 300)), rules);
    expect(rich.economy.funds.own).toBe(100);
    for (const id of DISTRICT_IDS) expect(rich.districts[id].services).toBeCloseTo(initial().districts[id].services + 10, 9);
    const richer = advanceTurn(patch(initial(), (s) => (s.economy.funds.own = 500)), rules);
    expect(richer.districts.borgo.services).toBeCloseTo(initial().districts.borgo.services + 20, 9);
    const modest = advanceTurn(patch(initial(), (s) => (s.economy.funds.own = 80)), rules);
    expect(modest.economy.funds.own).toBe(80);
    expect(modest.districts.borgo.services).toBe(initial().districts.borgo.services);
  });

  it('il fondo statale non supera il tetto di riporto', () => {
    const rules = { ...fakeRules(), economy: { ...fakeRules().economy, stateTransferPerYear: 80, stateCarryOverCap: 250 } };
    let state = initial();
    for (let i = 0; i < 20; i++) {
      state = advanceTurn(state, rules);
      expect(state.economy.funds.state).toBeLessThanOrEqual(250);
    }
    expect(state.economy.funds.state).toBe(250);
  });
});

describe('B. dinamica dei quartieri', () => {
  it('con tutti i lotti fermi l’aria dei Tamburi migliora fino a un tetto, e dopo la bonifica lo supera', () => {
    const rules = cityRules();
    // Pressione con lotti fermi: (3 + 1) × 10 = 40, quindi tetto 80 - 40 = 40.
    let state = initial();
    const air: number[] = [];
    for (let i = 0; i < 40; i++) {
      state = advanceTurn(state, rules);
      air.push(state.districts.tamburi.airQuality);
    }
    expect(air[0]!).toBeGreaterThan(initial().districts.tamburi.airQuality);
    expect(air.every((a, i) => i === 0 || a >= air[i - 1]!)).toBe(true);
    expect(Math.max(...air)).toBeLessThanOrEqual(40);
    expect(air.at(-1)!).toBeCloseTo(40, 1);

    // Bonifica del lotto più vicino ai Tamburi (peso 3): il tetto sale a 80 - 10 = 70.
    state = applyAction(state, { kind: 'convert-lot', lotId: 'lotto-finto-a', path: 'remediation' }, rules);
    state = advance(state, 30, rules);
    expect(state.plantLots[0]!.remediated).toBe(true);
    expect(state.districts.tamburi.airQuality).toBeGreaterThan(60);
  });

  it('un lotto bonificato e poi riportato a fermo non pesa più sull’aria', () => {
    const rules = cityRules();
    let state = applyAction(initial(), { kind: 'convert-lot', lotId: 'lotto-finto-a', path: 'remediation' }, rules);
    state = advance(state, 5, rules);
    expect(state.plantLots[0]!.remediated).toBe(true);
    state = applyAction(state, { kind: 'convert-lot', lotId: 'lotto-finto-a', path: 'idle' }, rules);
    state = advance(state, 40, rules);
    // Resta solo il lotto b, fermo: tetto 80 - 1 × 10 = 70, non 40.
    expect(state.districts.tamburi.airQuality).toBeGreaterThan(60);
  });

  it('l’esposizione comincia a calare dopo l’aria, e la salute a migliorare dopo l’esposizione', () => {
    const rules = cityRules();
    let state = initial();
    // Bonifica di entrambi i lotti: l'aria dei Tamburi può salire fino a 80.
    state = applyAction(state, { kind: 'convert-lot', lotId: 'lotto-finto-a', path: 'remediation' }, rules);
    state = applyAction(state, { kind: 'convert-lot', lotId: 'lotto-finto-b', path: 'remediation' }, rules);
    // Salute di partenza in equilibrio, perché la prova misuri solo il ritardo.
    state = patch(state, (s) => {
      const d = s.districts.tamburi;
      d.health = 70 - 0.4 * d.cumulativeExposure + 0.1 * d.services;
    });
    const series: { air: number; exposure: number; health: number }[] = [];
    let prev = state.districts.tamburi;
    for (let i = 0; i < 60; i++) {
      state = advanceTurn(state, rules);
      const d = state.districts.tamburi;
      series.push({ air: d.airQuality - prev.airQuality, exposure: d.cumulativeExposure - prev.cumulativeExposure, health: d.health - prev.health });
      prev = d;
    }
    const firstAirUp = series.findIndex((x) => x.air > 0);
    const firstExposureDown = series.findIndex((x) => x.exposure < 0);
    const firstHealthUp = series.findIndex((x) => x.health > 0);
    expect(firstAirUp).toBeGreaterThanOrEqual(0);
    expect(firstExposureDown).toBeGreaterThan(firstAirUp);
    expect(firstHealthUp).toBeGreaterThan(firstExposureDown);
  });

  it('i servizi calano negli anni di disavanzo e risalgono lentamente negli anni in attivo, fino al tetto', () => {
    const rules = cityRules();
    let state = patch(initial(), (s) => (s.economy.funds.own = -1));
    state = advanceTurn(state, rules);
    expect(state.districts.borgo.services).toBe(48);
    state = patch(state, (s) => (s.economy.funds.own = 100));
    state = advance(state, 4, rules);
    expect(state.districts.borgo.services).toBe(50);
    state = advance(state, 40, rules);
    expect(state.districts.borgo.services).toBe(60);
  });

  it('la tensione sale con cassa integrati e disoccupati', () => {
    const rules = cityRules();
    const calm = advance(patch(initial(), (s) => { s.labor.unemployed = 0; s.labor.onWageSupport = 0; }), 10, rules);
    const angry = advance(patch(initial(), (s) => { s.labor.unemployed = 5000; s.labor.onWageSupport = 5000; }), 10, rules);
    expect(angry.districts.borgo.tension).toBeGreaterThan(calm.districts.borgo.tension);
  });

  it('la fiducia segue la reputazione', () => {
    const rules = cityRules();
    const good = advance(patch(initial(), (s) => (s.moral.reputation = 60)), 10, rules);
    const bad = advance(patch(initial(), (s) => (s.moral.reputation = -60)), 10, rules);
    expect(good.districts.borgo.trust).toBeGreaterThan(bad.districts.borgo.trust);
  });

  it('una promessa mantenuta alza subito la fiducia del quartiere, una tradita la abbassa', () => {
    const rules = { ...fakeRules(), city: { ...fakeRules().city, trust: { ...fakeRules().city.trust, promiseKeptBoost: 5, promiseBrokenDrop: 8 } } };
    const promised = applyAction(withOpenDilemma(initial()), { kind: 'answer-dilemma', dilemmaId: 'dilemma-finto', optionId: 'promessa' }, rules);
    const kept = advance(patch(promised, (s) => (s.districts.tamburi.greenCover = 80)), 3, rules);
    const broken = advance(promised, 3, rules);
    expect(kept.districts.tamburi.trust).toBe(55);
    expect(broken.districts.tamburi.trust).toBe(42);
    expect(broken.districts.borgo.trust).toBe(50);
  });
});

describe('C. conseguenze della morale', () => {
  /** Regole in cui ogni atto nascosto viene scoperto l'anno stesso. */
  const exposed = (): TurnRules => {
    const rules = fakeRules();
    rules.moral.scandal = { ...rules.moral.scandal, baseProbability: 1, maxProbability: 1 };
    rules.city.scandal = { districtTrustDrop: 4, councilTrustDrop: 6, shortcutFrozenYears: 2 };
    return rules;
  };

  it('uno scandalo su una scorciatoia rimanda indietro il progetto e lo ferma', () => {
    const rules = exposed();
    let state = applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, rules);
    state = advanceTurn(state, rules); // autorizzazioni, 2 anni
    state = applyAction(state, { kind: 'shortcut-phase', projectId: state.projects[0]!.id }, rules);
    expect(state.projects[0]!.phase).toBe('tender');
    state = advanceTurn(state, rules); // scoperta
    expect(state.moral.scandals).toHaveLength(1);
    expect(state.projects[0]).toMatchObject({ phase: 'permitting', turnsLeftInPhase: 2, frozenTurns: 2 });
    const delay = state.projects[0]!.delayTurns;
    state = advance(state, 2, rules);
    expect(state.projects[0]).toMatchObject({ phase: 'permitting', turnsLeftInPhase: 2, frozenTurns: 0, delayTurns: delay + 2 });
    // Senza scorciatoia e senza scandalo sarebbe entrato in esercizio al turno 8.
    while (state.projects[0]!.phase !== 'operating') state = advanceTurn(state, rules);
    expect(state.turn).toBeGreaterThan(8);
  });

  it('un progetto rimandato indietro dall’esercizio non riceve due volte gli effetti "una volta"', () => {
    const rules = exposed();
    rules.moral.scandal.baseProbability = 0;
    rules.moral.scandal.maxProbability = 0;
    let state = applyAction(initial(), { kind: 'start-project', definitionId: 'progetto-finto-8-anni' }, rules);
    state = advanceTurn(state, rules);
    state = applyAction(state, { kind: 'shortcut-phase', projectId: state.projects[0]!.id }, rules);
    while (state.projects[0]!.phase !== 'operating') state = advanceTurn(state, rules);
    const green = state.districts.tamburi.greenCover;
    // Ora la scorciatoia viene scoperta: il progetto torna alle autorizzazioni e poi di nuovo in esercizio.
    const later = exposed();
    while (state.moral.scandals.length === 0) state = advanceTurn(state, later);
    expect(state.projects[0]!.phase).toBe('permitting');
    while (state.projects[0]!.phase !== 'operating') state = advanceTurn(state, later);
    state = advanceTurn(state, later);
    expect(state.districts.tamburi.greenCover).toBe(green);
  });

  it('uno scandalo abbassa subito la fiducia di tutti i quartieri e dei consiglieri', () => {
    const rules = exposed();
    let state = applyAction(withOpenDilemma(initial()), { kind: 'answer-dilemma', dilemmaId: 'dilemma-finto', optionId: 'nascosta-legalita' }, rules);
    state = advanceTurn(state, rules);
    for (const id of DISTRICT_IDS) expect(state.districts[id].trust).toBe(46);
    expect(state.council.map((c) => c.trustInPlayer)).toEqual([44, 44]);
  });

  it('un’opzione di dilemma scoperta applica la sua penale', () => {
    const rules = exposed();
    rules.dilemmas['dilemma-finto']!.options['nascosta']!.scandalPenalty = { deltas: [{ target: 'economy.funds.own', amount: -30 }] };
    let state = applyAction(withOpenDilemma(initial()), { kind: 'answer-dilemma', dilemmaId: 'dilemma-finto', optionId: 'nascosta' }, rules);
    const own = state.economy.funds.own;
    state = advanceTurn(state, rules);
    // Due atti nascosti (verità e legalità) della stessa scelta: penale e calo di fiducia una volta sola.
    expect(state.moral.scandals).toHaveLength(2);
    expect(state.economy.funds.own).toBe(own - 30);
    expect(state.districts.borgo.trust).toBe(46);
  });

  it('una scelta già scoperta in un anno precedente non paga di nuovo quando ne emerge un’altra dimensione', () => {
    const rules = exposed();
    rules.dilemmas['dilemma-finto']!.options['nascosta']!.scandalPenalty = { deltas: [{ target: 'economy.funds.own', amount: -30 }] };
    let state = applyAction(withOpenDilemma(initial()), { kind: 'answer-dilemma', dilemmaId: 'dilemma-finto', optionId: 'nascosta' }, rules);
    const [truth, legality] = state.moral.hiddenActs;
    // Prima esce solo la dimensione verità.
    state = patch(state, (s) => {
      s.moral.hiddenActs = [legality!];
      s.moral.scandals = [{ turn: 0, actId: truth!.id, dimension: truth!.dimension }];
    });
    const own = state.economy.funds.own;
    const trust = state.districts.borgo.trust;
    state = advanceTurn(state, rules);
    expect(state.moral.scandals).toHaveLength(2);
    expect(state.economy.funds.own).toBe(own);
    expect(state.districts.borgo.trust).toBe(trust);
  });

  it('meno fiducia produce meno entrate proprie l’anno dopo', () => {
    const rules: TurnRules = { ...fakeRules(), economy: activeEconomy(), city: { ...fakeRules().city, civic: { minFactor: 0.5, maxFactor: 1, fullFactorTrust: 60 } } };
    const trusting = patch(initial(), (s) => DISTRICT_IDS.forEach((id) => (s.districts[id].trust = 60)));
    const distrustful = patch(initial(), (s) => DISTRICT_IDS.forEach((id) => (s.districts[id].trust = 15)));
    expect(civicFactor(trusting, rules.city)).toBe(1);
    expect(civicFactor(distrustful, rules.city)).toBeCloseTo(0.625, 12);
    const gain = (s: GameState) => advanceTurn(s, rules).economy.funds.own - s.economy.funds.own;
    expect(gain(distrustful)).toBeLessThan(gain(trusting));
  });

  it('con un tetto sopra 1 una città con molta fiducia rende più della media', () => {
    const city = { ...fakeRules().city, civic: { minFactor: 0.6, maxFactor: 1.2, fullFactorTrust: 60 } };
    const high = patch(initial(), (s) => DISTRICT_IDS.forEach((id) => (s.districts[id].trust = 80)));
    const half = patch(initial(), (s) => DISTRICT_IDS.forEach((id) => (s.districts[id].trust = 30)));
    expect(civicFactor(high, city)).toBeCloseTo(1.2, 12);
    expect(civicFactor(half, city)).toBeCloseTo(0.9, 12);
    const rules: TurnRules = { ...fakeRules(), economy: activeEconomy(), city };
    const gain = (s: GameState) => advanceTurn(s, rules).economy.funds.own - s.economy.funds.own;
    const plain: TurnRules = { ...rules, city: { ...city, civic: { minFactor: 1, maxFactor: 1, fullFactorTrust: 60 } } };
    const plainGain = (s: GameState) => advanceTurn(s, plain).economy.funds.own - s.economy.funds.own;
    expect(gain(high)).toBeGreaterThan(plainGain(high));
  });

  it('il senso civico riduce solo gli effetti positivi', () => {
    const scaled = scaleBeneficial(
      {
        deltas: [
          { target: 'districts.borgo.trust', amount: 4 },
          { target: 'districts.borgo.tension', amount: -2 },
          { target: 'districts.borgo.tension', amount: 3 },
          { target: 'economy.funds.own', amount: -1 },
        ],
        laborMoves: [
          { from: 'unemployed', to: 'services', count: 100 },
          { from: 'services', to: 'unemployed', count: 50 },
        ],
      },
      0.5,
    );
    expect(scaled.deltas.map((d) => d.amount)).toEqual([2, -1, 3, -1]);
    expect(scaled.laborMoves!.map((m) => m.count)).toEqual([50, 50]);
  });

  it('la fiducia media è pesata sui residenti', () => {
    const state = patch(initial(), (s) => {
      DISTRICT_IDS.forEach((id) => (s.districts[id].trust = 50));
      s.districts['area-industriale'].trust = 0; // senza residenti nei dati di prova
    });
    expect(averageTrust(state)).toBe(50);
  });

  it('la fiducia sotto soglia per gli anni previsti chiude la partita con ended-abandoned', () => {
    const rules: TurnRules = { ...fakeRules(), city: { ...fakeRules().city, abandonment: { trustThreshold: 20, years: 3 } } };
    let state = patch(initial(), (s) => DISTRICT_IDS.forEach((id) => (s.districts[id].trust = 10)));
    state = advance(state, 2, rules);
    expect(state).toMatchObject({ status: 'running', lowTrustYears: 2 });
    const recovered = advanceTurn(patch(state, (s) => DISTRICT_IDS.forEach((id) => (s.districts[id].trust = 40))), rules);
    expect(recovered).toMatchObject({ status: 'running', lowTrustYears: 0 });
    state = advanceTurn(state, rules);
    expect(state.status).toBe('ended-abandoned');
  });
});

describe('partite complete con la città che reagisce', { timeout: 120_000 }, () => {
  const rules = (): TurnRules => ({ ...fakeRules(), economy: activeEconomy(), city: activeCity(), dilemmaArrivalProbability: 0.4 });
  const laborForce = (s: GameState) =>
    Object.values(s.labor.employed).reduce((a, b) => a + b, 0) + s.labor.onWageSupport + s.labor.unemployed + s.labor.inTraining;

  it('stato sempre valido e forza lavoro costante in 100 turni di gioco casuale su 5 semi', () => {
    const endings = new Set<string>();
    for (const seed of [41, 42, 43, 44, 45]) {
      const force = laborForce(initial(seed));
      const final = randomGame(seed, rules(), (s) => {
        expect(validateState(s).errors).toEqual([]);
        expect(laborForce(s)).toBe(force);
      });
      expect(final.status).not.toBe('running');
      endings.add(final.status);
    }
    expect(endings.size).toBeGreaterThan(0);
  });

  it('stessa partita identica a parità di seme e storia, e replay dalla storia', () => {
    const a = randomGame(9, rules());
    expect(JSON.stringify(randomGame(9, rules()))).toBe(JSON.stringify(a));
    expect(JSON.stringify(replay(initial(9), a.history, rules(), a.turn))).toBe(JSON.stringify(a));
  });
});
