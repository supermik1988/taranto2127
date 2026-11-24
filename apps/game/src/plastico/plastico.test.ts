/** T11: la zona senza scheda grafica — geografia, lotti, aspetti, strato, scelta della mappa. Le prove della città isometrica (T12) stanno in iso/. */
import { DISTRICT_IDS, type GameState } from '@taranto2127/sim';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { act, closeYear, content, newGame } from '../engine.js';
import { chooseMapMode } from '../layout.js';
import { indicatorColor } from '../map.js';
import { centroid, districtAt, geo, lotOf, pointInPolygon, polygonArea, type Pt } from './data.js';
import { LOT_LOOKS, layerValues, lotLook } from './looks.js';

const lotti = JSON.parse(readFileSync(new URL('../../../../packages/content/geo/lotti.json', import.meta.url), 'utf8')) as {
  lotti: Record<string, { valore: number[][]; stima?: boolean; motivazione?: string }>;
  quartieri: Record<string, { valore: number[][]; stima?: boolean; motivazione?: string }>;
};

describe('la zona si riconosce', () => {
  const plant = geo.stabilimento[0]!;
  const tamburi = centroid(geo.quartieri['tamburi']!);
  const plantCenter = centroid(plant);
  const water = geo.acqua.slice().sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));

  it('lo stabilimento sta a nord-ovest dei Tamburi', () => {
    expect(plantCenter[0]).toBeLessThan(tamburi[0]);
    expect(plantCenter[1]).toBeGreaterThan(tamburi[1]);
    // Grande come uno stabilimento siderurgico vero: più di 8 km² anche ritagliato dal riquadro.
    expect(Math.abs(polygonArea(plant)) / 1e6).toBeGreaterThan(8);
  });

  it('il Mar Piccolo bagna i Tamburi a est, il Mar Grande sta a sud', () => {
    const [first, second] = water;
    const east = [first!, second!].find((ring) => centroid(ring)[0] > tamburi[0])!;
    const south = [first!, second!].find((ring) => centroid(ring)[1] < tamburi[1])!;
    expect(east).toBeDefined();
    expect(south).toBeDefined();
    // Un punto poco a est dei Tamburi è acqua.
    expect(geo.acqua.some((ring) => pointInPolygon([tamburi[0] + 900, tamburi[1] - 200], ring))).toBe(true);
  });

  it('strade principali, edifici e attribuzione OpenStreetMap ci sono', () => {
    expect(geo.strade.filter((s) => s.c <= 2).length).toBeGreaterThan(50);
    expect(geo.edifici.length).toBeGreaterThan(3000);
    expect(geo.attribuzione).toContain('OpenStreetMap');
    expect(geo.edifici.every((b) => Number.isInteger(b.id))).toBe(true);
  });

  it('nessun nome di azienda reale nel file del plastico (regola 6)', () => {
    const text = readFileSync(new URL('../../../../packages/content/geo/plastico.json', import.meta.url), 'utf8').toLowerCase();
    for (const name of ['acciaierie', 'arcelor', 'mittal', 'ilva', 'eni', 'vestas', 'cemitaly']) expect(text, name).not.toMatch(new RegExp(`\\b${name}\\b`));
  });
});

describe('i lotti di ILSIDER', () => {
  it('sono sei, quelli della partita, nella posizione dei dati con stima e motivazione', () => {
    const ids = newGame(1).state.plantLots.map((l) => l.id).sort();
    expect(Object.keys(geo.lotti).sort()).toEqual(ids);
    expect(Object.keys(lotti.lotti).sort()).toEqual(ids);
    for (const [id, entry] of [...Object.entries(lotti.lotti), ...Object.entries(lotti.quartieri)]) {
      expect(entry.stima, id).toBe(true);
      expect(entry.motivazione?.length ?? 0, id).toBeGreaterThan(20);
    }
  });

  it('ogni lotto sta dentro lo stabilimento (area principale o pontili dello stesso gestore)', () => {
    const inPlant = (p: Pt) => geo.stabilimento.some((ring) => pointInPolygon(p, ring));
    // Il centro di ogni lotto; i vertici si controllano per le Banchine, nel test sul mare aperto.
    for (const [id, quad] of Object.entries(geo.lotti)) expect(inPlant(centroid(quad)), id).toBe(true);
  });

  it('i parchi minerali sono il lotto più vicino ai Tamburi', () => {
    const t = centroid(geo.quartieri['tamburi']!);
    const distance = (q: Pt[]) => Math.hypot(centroid(q)[0] - t[0], centroid(q)[1] - t[1]);
    const nearest = Object.entries(geo.lotti).sort(([, a], [, b]) => distance(a) - distance(b))[0]![0];
    expect(nearest).toBe('lotto-parchi-minerali');
  });

  it('un edificio vero dentro un lotto appartiene a quel lotto', () => {
    const inLots = geo.edifici.filter((b) => lotOf(b) !== undefined);
    expect(inLots.length).toBeGreaterThan(50);
  });
});

// Gioca quarant'anni da copione: sotto carico può superare i 5 secondi di serie.
describe('aspetto dei lotti secondo lo stato del motore', { timeout: 30_000 }, () => {
  function play(): GameState[] {
    let game = newGame(7);
    game = act(game, { kind: 'convert-lot', lotId: 'lotto-parchi-minerali', path: 'remediation' });
    game = act(game, { kind: 'convert-lot', lotId: 'lotto-cokerie', path: 'energy' });
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

  it('in una partita da copione compaiono tutti e sei gli aspetti, e cambiano nel tempo', () => {
    const states = play();
    const seen = new Set(states.flatMap((s) => s.plantLots.map((l) => lotLook(s, l.id))));
    expect([...seen].sort()).toEqual([...LOT_LOOKS].sort());
    const parks = states.map((s) => lotLook(s, 'lotto-parchi-minerali'));
    expect(parks[0]).toBe('fermo');
    expect(parks).toContain('lavori');
    expect(parks.at(-1)).toBe('bosco');
    expect(parks.indexOf('lavori')).toBeLessThan(parks.indexOf('bosco'));
  });

  it('un lotto mai toccato resta fermo', () => {
    for (const s of play()) expect(lotLook(s, 'lotto-laminatoi')).toBe('fermo');
  });
});

describe('strato', () => {
  it('ogni quartiere ha il suo valore e il colore della legenda', () => {
    const state = newGame(3).state;
    for (const indicator of ['airQuality', 'health', 'trust', 'tension'] as const) {
      const values = layerValues(state, indicator);
      for (const id of DISTRICT_IDS) {
        expect(values[id].value).toBe(state.districts[id][indicator]);
        expect(values[id].color).toBe(indicatorColor(state.districts[id][indicator], indicator));
      }
    }
  });

  it('i quartieri del plastico contengono i loro edifici', () => {
    const counts: Record<string, number> = {};
    for (const b of geo.edifici) {
      const d = districtAt(centroid(b.p));
      if (d !== undefined) counts[d] = (counts[d] ?? 0) + 1;
    }
    expect(counts['tamburi']).toBeGreaterThan(300);
    expect(counts['citta-vecchia']).toBeGreaterThan(30);
    expect(counts['area-industriale']).toBeGreaterThan(100);
  });
});

describe('quale mappa', () => {
  it('l’indirizzo vince, poi la scelta salvata, poi il 3D se il browser lo regge', () => {
    expect(chooseMapMode('?mappa=schematica', null, true)).toBe('schematica');
    expect(chooseMapMode('?seme=3&mappa=plastico', 'schematica', true)).toBe('plastico');
    expect(chooseMapMode('', 'schematica', true)).toBe('schematica');
    expect(chooseMapMode('', null, true)).toBe('plastico');
    expect(chooseMapMode('', null, false)).toBe('schematica');
  });
});
