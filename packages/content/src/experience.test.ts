/** T10: i ventiquattro dilemmi e la guida al gioco. */
import { STOP_KINDS, TURNS_PER_EPOCH, type LedgerKey } from '@taranto2127/sim';
import { describe, expect, it } from 'vitest';
import { loadContent } from './load.js';

const { rules, texts, guide } = loadContent();
const THEMES = ['aria e salute', 'lavoro', 'appalti', 'fondi', 'quartieri', 'mare', 'clima', 'giovani'];

describe('i ventiquattro dilemmi', () => {
  const dilemmas = Object.values(rules.dilemmas);

  it('sono ventiquattro, almeno tre per tema', () => {
    expect(dilemmas).toHaveLength(24);
    for (const theme of THEMES) {
      expect(Object.values(texts.dilemmas).filter((d) => d.tema === theme).length, theme).toBeGreaterThanOrEqual(3);
    }
  });

  it('ogni epoca ne introduce almeno tre e ne ha almeno sei possibili', () => {
    for (let epoch = 0; epoch < 5; epoch++) {
      const start = epoch * TURNS_PER_EPOCH;
      const end = start + TURNS_PER_EPOCH - 1;
      const introduced = dilemmas.filter((d) => d.firstTurn >= start && d.firstTurn <= end);
      const possible = dilemmas.filter((d) => d.firstTurn <= end && d.lastTurn >= start);
      expect(introduced.length, `epoca ${epoch + 1}`).toBeGreaterThanOrEqual(3);
      expect(possible.length, `epoca ${epoch + 1}`).toBeGreaterThanOrEqual(6);
    }
  });

  it('quasi tutti dipendono dallo stato della città', () => {
    expect(dilemmas.filter((d) => d.conditions.length > 0).length).toBeGreaterThanOrEqual(20);
  });

  it('ogni ripetibile dichiara dopo quanti anni può tornare', () => {
    for (const d of dilemmas) {
      if (d.repeatable) expect(d.repeatAfterTurns, d.id).toBeGreaterThanOrEqual(1);
      else expect(d.repeatAfterTurns, d.id).toBeUndefined();
    }
  });

  it('ogni scelta nascosta ha la sua penale se viene scoperta', () => {
    for (const d of dilemmas) {
      for (const [id, o] of Object.entries(d.options)) if (o.hidden) expect(o.scandalPenalty, `${d.id}/${id}`).toBeDefined();
    }
  });

  it('testi completi: titolo, testo, etichetta e conseguenze di ogni opzione', () => {
    for (const [id, t] of Object.entries(texts.dilemmas)) {
      expect(t.titolo.length, id).toBeGreaterThan(5);
      expect(t.testo.length, id).toBeGreaterThan(60);
      for (const o of Object.values(t.options)) {
        expect(o.etichetta.length, id).toBeGreaterThan(5);
        expect(o.conseguenze.length, id).toBeGreaterThan(20);
      }
    }
  });

  it('nessun testo rivela in anticipo che una scelta è nascosta', () => {
    for (const [id, t] of Object.entries(texts.dilemmas)) {
      for (const o of Object.values(t.options)) expect(`${o.etichetta} ${o.conseguenze}`.toLowerCase(), id).not.toContain('nascost');
    }
  });
});

describe('guida al gioco', () => {
  it('la visita ha otto passi, nell’ordine chiesto', () => {
    expect(guide.tour.map((s) => s.id)).toEqual(['obiettivo', 'mappa', 'quartiere', 'lotti', 'consiglio', 'tempo', 'bilancio', 'morale']);
  });

  it('il glossario spiega i termini tecnici dell’interfaccia', () => {
    for (const id of ['coscienza', 'reputazione', 'capacita-uffici', 'fase', 'scorciatoia', 'disavanzo', 'dissesto', 'cassa-integrazione', 'esposizione', 'rata-europea', 'epoca', 'lotto', 'strada']) {
      expect(guide.glossary[id], id).toBeDefined();
    }
  });

  it('ogni voce del bilancio e ogni motivo di fermata ha il suo testo', () => {
    const keys: LedgerKey[] = ['policy', 'policies', 'project', 'projects', 'eu-expired', 'effects', 'scandals', 'state-returned', 'surplus'];
    for (const key of keys) expect(guide.budget.voci[key], key).toBeDefined();
    for (const fund of ['own', 'state', 'eu-earmarked']) {
      expect(guide.budget.voci[`revenue/${fund}`], fund).toBeDefined();
    }
    expect(guide.budget.voci['mandatory/own']).toBeDefined();
    expect(guide.budget.voci['mandatory/state']).toBeDefined();
    for (const kind of STOP_KINDS) expect(guide.stops[kind], kind).toBeDefined();
  });

  it('i nomi delle tre casse sono quelli chiesti', () => {
    expect(guide.budget.fondi.own.nome).toBe('Cassa della città');
    expect(guide.budget.fondi.state.nome).toBe('Fondi dello Stato');
    expect(guide.budget.fondi['eu-earmarked'].nome).toBe('Fondi europei');
  });

  it('nessun nome reale di azienda e nessuna morte a punteggio nella guida', () => {
    const all = JSON.stringify(guide).toLowerCase();
    for (const word of ['ilva', 'arcelor', 'mittal', 'italsider', 'morti', 'decessi', 'vittime', 'mortalità']) expect(all, word).not.toContain(word);
  });
});
