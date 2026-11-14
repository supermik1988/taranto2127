import { describe, expect, it } from 'vitest';
import { fakeContent } from './__fixtures__/fake-content.js';
import { activeCity, activeEconomy, fakeRules } from './__fixtures__/fake-rules.js';
import { randomGame } from './__fixtures__/random-game.js';
import { explainDistrict } from './explain.js';
import { createInitialState } from './init.js';
import type { GameState } from './state.js';
import { advanceTurn, applyAction, type TurnRules } from './turn.js';
import { DISTRICT_IDS } from './validate.js';

const rules = (): TurnRules => ({ ...fakeRules(), economy: activeEconomy(), city: activeCity(), dilemmaArrivalProbability: 0.3 });
const initial = () => createInitialState(1, fakeContent());

describe('explainDistrict', () => {
  it('è pura: non modifica lo stato e a parità di stato dà lo stesso risultato', () => {
    const state = applyAction(initial(), { kind: 'convert-lot', lotId: 'lotto-finto-a', path: 'remediation' }, rules());
    const snapshot = JSON.stringify(state);
    const a = explainDistrict(state, rules(), 'tamburi');
    const b = explainDistrict(state, rules(), 'tamburi');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('spiega le sei grandezze, e i fattori sommati danno il valore di arrivo', { timeout: 60_000 }, () => {
    let checked = 0;
    for (const seed of [1, 2, 3]) {
      randomGame(seed, rules(), (s) => {
        if (s.status !== 'running' || s.turn % 4 !== 0) return;
        for (const id of DISTRICT_IDS) {
          const explanation = explainDistrict(s, rules(), id);
          expect(explanation.map((q) => q.quantity)).toEqual(['airQuality', 'cumulativeExposure', 'health', 'services', 'tension', 'trust']);
          for (const q of explanation) {
            expect(q.factors.reduce((sum, f) => sum + f.weight, 0)).toBeCloseTo(q.target, 9);
            expect(q.target).toBeGreaterThanOrEqual(0);
            expect(q.target).toBeLessThanOrEqual(100);
            checked++;
          }
        }
      });
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('il valore di arrivo è quello che il motore usa: un anno tranquillo va esattamente come spiegato', () => {
    const r = rules();
    r.dilemmaArrivalProbability = 0;
    // Nessun cantiere e conti in attivo: nell'anno non cambia nulla oltre alla dinamica dei quartieri.
    const state: GameState = structuredClone(initial());
    state.economy.funds.own = 500;
    const next = advanceTurn(state, r);
    for (const id of DISTRICT_IDS) {
      const [air, exposure, health, services, tension, trust] = explainDistrict(state, r, id);
      const d = state.districts[id];
      const n = next.districts[id];
      expect(n.airQuality).toBeCloseTo(d.airQuality + r.city.air.approachShare * (air!.target - d.airQuality), 9);
      expect(n.cumulativeExposure).toBeCloseTo(exposure!.target, 9);
      expect(n.health).toBeCloseTo(d.health + r.city.health.approachShare * (health!.target - d.health), 9);
      expect(n.services).toBeCloseTo(services!.target, 9);
      expect(n.tension).toBeCloseTo(d.tension + r.city.tension.approachShare * (tension!.target - d.tension), 9);
      expect(n.trust).toBeCloseTo(d.trust + r.city.trust.approachShare * (trust!.target - d.trust), 9);
    }
  });

  it('l’aria elenca la pressione di ogni lotto che la tocca, con il suo stato', () => {
    const [air] = explainDistrict(initial(), rules(), 'tamburi');
    expect(air!.factors[0]).toEqual({ key: 'air-clean', weight: 80 });
    expect(air!.factors.slice(1).map((f) => [f.params?.['lotId'], f.params?.['state'], f.weight])).toEqual([
      ['lotto-finto-a', 'idle-contaminated', -30],
      ['lotto-finto-b', 'idle-contaminated', -10],
    ]);
    expect(air!.target).toBe(40);
  });
});
