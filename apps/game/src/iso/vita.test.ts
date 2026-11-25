/**
 * La vita della città (T12c, fase B): ciò che racconta lo stato della città si legge
 * dal motore. Il fumo cambia con lo stato del lotto in una partita da copione; un
 * lotto fermo non fuma; con dt = 0 (riduci animazioni) nulla si muove; al livello
 * basso resta solo il fumo.
 */
import type { GameState } from '@taranto2127/sim';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { act, closeYear, content, newGame } from '../engine.js';
import { lotLook } from '../plastico/looks.js';
import { Vita, vitaDaStato } from './vita.js';

/** Partita da copione: l'altoforno torna all'acciaio, il resto come in plastico.test.ts. */
function partita(): GameState[] {
  let game = newGame(7);
  game = act(game, { kind: 'convert-lot', lotId: 'lotto-altoforni', path: 'green-steel' });
  game = act(game, { kind: 'convert-lot', lotId: 'lotto-banchine', path: 'sea-culture' });
  const states = [game.state];
  while (game.state.status === 'running' && game.state.turn < 40) {
    const open = game.state.openDilemmaId;
    if (open !== null) game = act(game, { kind: 'answer-dilemma', dilemmaId: open, optionId: Object.keys(content.rules.dilemmas[open]!.options)[0]! });
    game = closeYear(game).game;
    states.push(game.state);
  }
  return states;
}

describe('vita letta dal motore', { timeout: 30_000 }, () => {
  const states = partita();

  it('il fumo cambia con lo stato del lotto: niente finché è fermo o in cantiere, poi quanto produce', () => {
    const fumo = states.map((s) => vitaDaStato(s).fumo['lotto-altoforni']!);
    const look = states.map((s) => lotLook(s, 'lotto-altoforni'));
    expect(fumo[0]).toBe(0);
    expect(look).toContain('acciaio');
    states.forEach((s, i) => {
      if (look[i] === 'acciaio') expect(fumo[i]).toBeGreaterThan(0);
      else expect(fumo[i]).toBe(0);
    });
    expect(Math.max(...fumo)).toBeLessThanOrEqual(1);
  });

  it('un lotto mai toccato non fuma mai', () => {
    for (const s of states) expect(vitaDaStato(s).fumo['lotto-laminatoi']).toBe(0);
  });

  it('il traffico segue la popolazione del motore', () => {
    const s = states[0]!;
    const meta = { ...s, districts: Object.fromEntries(Object.entries(s.districts).map(([id, d]) => [id, { ...d, population: { young: d.population.young / 2, adult: d.population.adult / 2, elder: d.population.elder / 2 } }])) } as GameState;
    expect(vitaDaStato(meta).traffico).toBeCloseTo(vitaDaStato(s).traffico / 2, 1);
  });

  it('traffico e barche vengono dalla popolazione e dalle attività del mare', () => {
    const v0 = vitaDaStato(states[0]!);
    expect(v0.traffico).toBeCloseTo(1, 1);
    expect(v0.barche).toBeGreaterThan(0.2);
    const ultimo = vitaDaStato(states.at(-1)!);
    // Con il lotto «mare e cultura» aperto le barche crescono.
    if (lotLook(states.at(-1)!, 'lotto-banchine') === 'mare') expect(ultimo.barche).toBeGreaterThan(v0.barche);
    for (const s of states) {
      const v = vitaDaStato(s);
      expect(v.traffico).toBeGreaterThanOrEqual(0.3);
      expect(v.traffico).toBeLessThanOrEqual(1.5);
    }
  });
});

describe('vita nella scena', () => {
  const posizioni = (v: Vita) => {
    const out: number[] = [];
    v.gruppo.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) out.push(...Array.from(o.instanceMatrix.array.slice(0, o.count * 16)));
    });
    return out;
  };

  it('fuma solo il camino di un lotto che produce', () => {
    const v = new Vita();
    v.impostaCamini([{ x: 0, y: 0, quota: 100, lotto: 'a' }, { x: 100, y: 0, quota: 100, lotto: 'b' }]);
    v.impostaVista('alto', 2);
    v.impostaStato({ fumo: { a: 0, b: 0 }, traffico: 1, barche: 1, persone: 1 });
    v.aggiorna(1, 0.016);
    const fumo = v.gruppo.getObjectByName('fumo') as THREE.InstancedMesh;
    expect(fumo.count).toBe(0);
    v.impostaStato({ fumo: { a: 1, b: 0 }, traffico: 1, barche: 1, persone: 1 });
    v.aggiorna(1, 0.016);
    expect(fumo.count).toBeGreaterThan(0);
  });

  it('con dt = 0 (riduci animazioni) nulla si muove', () => {
    const v = new Vita();
    v.impostaVista('alto', 2);
    v.impostaStato({ fumo: {}, traffico: 1, barche: 1, persone: 1 });
    v.aggiorna(0, 0);
    const prima = posizioni(v);
    for (let i = 0; i < 30; i++) v.aggiorna(0, 0);
    expect(posizioni(v)).toEqual(prima);
    expect(v.accesi()).toBeGreaterThan(100);
    // E con il tempo che passa, si muove.
    v.aggiorna(0.5, 0.5);
    expect(posizioni(v)).not.toEqual(prima);
  });

  it('al livello basso resta solo il fumo', () => {
    const v = new Vita();
    v.impostaCamini([{ x: 0, y: 0, quota: 100, lotto: 'a' }]);
    v.impostaStato({ fumo: { a: 1 }, traffico: 1.5, barche: 1.6, persone: 1.5 });
    v.impostaVista('basso', 3);
    v.aggiorna(1, 0.016);
    const fumo = v.gruppo.getObjectByName('fumo') as THREE.InstancedMesh;
    expect(v.accesi()).toBe(fumo.count);
    expect(fumo.count).toBeGreaterThan(0);
  });

  it('il traffico segue il motore', () => {
    const v = new Vita();
    v.impostaVista('alto', 2);
    v.impostaStato({ fumo: {}, traffico: 0.5, barche: 1, persone: 1 });
    v.aggiorna(0, 0);
    const auto = v.gruppo.getObjectByName('auto-in-movimento') as THREE.InstancedMesh;
    const poche = auto.count;
    v.impostaStato({ fumo: {}, traffico: 1.5, barche: 1, persone: 1 });
    v.aggiorna(0, 0);
    expect(auto.count).toBeGreaterThan(poche * 2);
  });
});
