/**
 * Partita guidata (T16): con il seme fisso gli eventi annunciati arrivano davvero; ogni
 * passo indica comandi che esistono nell'interfaccia; ogni azione attesa si riconosce
 * dallo stato o dall'interfaccia.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { act, closeYear, content, newGame } from './engine.js';
import { INDICATOR_LABELS } from './map.js';
import { fatto, tutorial, type Contesto } from './tutorial.js';

const STRADE = ['green-steel', 'remediation', 'energy', 'sea-culture'] as const;

describe('seme della partita guidata', { timeout: 60_000 }, () => {
  it('con qualunque lotto e strada: il cantiere cambia fase entro la fine del primo anno, il primo dilemma arriva alla fine del secondo (mai prima), la Cronaca ha titoli ogni anno', () => {
    const lotti = newGame(tutorial.seme).state.plantLots.map((l) => l.id);
    expect(lotti.length).toBe(6);
    for (const lotto of lotti) {
      for (const strada of STRADE) {
        let g = newGame(tutorial.seme);
        g = act(g, { kind: 'convert-lot', lotId: lotto, path: strada });
        const fase0 = g.state.projects.find((p) => p.lotId === lotto)!.phase;
        let dilemma = -1;
        let fase = -1;
        for (let anno = 1; anno <= 5; anno++) {
          const r = closeYear(g);
          g = r.game;
          expect(r.headlines.length, `${lotto} ${strada} anno ${anno}: Cronaca`).toBeGreaterThan(0);
          if (g.state.openDilemmaId !== null) {
            if (dilemma < 0) dilemma = g.state.turn;
            const id = g.state.openDilemmaId;
            g = act(g, { kind: 'answer-dilemma', dilemmaId: id, optionId: Object.keys(content.rules.dilemmas[id]!.options)[0]! });
          }
          if (fase < 0 && g.state.projects.find((p) => p.lotId === lotto)!.phase !== fase0) fase = g.state.turn;
        }
        const msg = `${lotto} ${strada}`;
        expect(fase, `${msg}: cambio di fase`).toBe(1);
        expect(dilemma, `${msg}: primo dilemma`).toBe(2);
      }
    }
  });

  it('il passo sulle fasi viene dopo il dilemma: a quel punto il cantiere ha già cominciato una fase nuova', () => {
    const ids = tutorial.passi.map((p) => p.id);
    expect(ids.indexOf('cantieri')).toBeGreaterThan(ids.indexOf('dilemma'));
    expect(ids.indexOf('dilemma-attesa')).toBeGreaterThan(ids.indexOf('anno'));
  });
});

/** Tutti i data-testid dell'interfaccia: letterali e prefissi dei modelli (`lotto-${id}`). */
function testidDelGioco(): { letterali: Set<string>; prefissi: string[] } {
  const letterali = new Set<string>();
  const prefissi: string[] = [];
  const visita = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) visita(p);
      else if (/\.tsx?$/.test(nome) && !/\.test\./.test(nome)) {
        const testo = readFileSync(p, 'utf8');
        for (const m of testo.matchAll(/data-testid="([^"]+)"/g)) letterali.add(m[1]!);
        for (const m of testo.matchAll(/data-testid=\{`([^`$]*)\$\{/g)) prefissi.push(m[1]!);
        for (const m of testo.matchAll(/testId=\{?[`"]([^`"$]+)[`"]/g)) letterali.add(m[1]!);
        for (const m of testo.matchAll(/testId=\{`([^`$]*)\$\{/g)) prefissi.push(m[1]!);
      }
    }
  };
  visita(fileURLToPath(new URL('.', import.meta.url)));
  return { letterali, prefissi };
}

describe('passi della partita guidata', () => {
  it('ogni comando da evidenziare esiste nell\'interfaccia (data-testid stabili, da mantenere in T13)', () => {
    const { letterali, prefissi } = testidDelGioco();
    // I modelli (`scheda-${p}`…) si espandono solo con i valori che esistono davvero: un refuso non passa.
    const app = readFileSync(fileURLToPath(new URL('./App.tsx', import.meta.url)), 'utf8');
    const pannelli = [...(/type Panel = ([^;]+);/.exec(app)?.[1] ?? '').matchAll(/'([a-z-]+)'/g)].map((m) => m[1]!);
    const lotti = newGame(tutorial.seme).state.plantLots.map((l) => l.id);
    const valori: Record<string, string[]> = {
      'scheda-': pannelli,
      'strato-': Object.keys(INDICATOR_LABELS),
      'elenco-lotto-': lotti,
      'lotto-': lotti,
      'strada-': [...STRADE, 'idle'],
      'termine-': Object.keys(content.guide.glossary),
    };
    expect(pannelli.length).toBe(7);
    const ammessi = new Set(letterali);
    for (const [prefisso, vv] of Object.entries(valori)) {
      expect(prefissi, prefisso).toContain(prefisso);
      for (const v of vv) ammessi.add(`${prefisso}${v}`);
    }
    for (const passo of tutorial.passi) {
      for (const id of passo.evidenzia) expect(ammessi.has(id), `${passo.id}: ${id}`).toBe(true);
      if (passo.attesa.tipo === 'vede') expect(letterali.has(passo.attesa.testid), passo.id).toBe(true);
    }
  });

  it('ogni azione attesa si riconosce, e nessuna è già fatta all\'inizio della partita guidata', () => {
    const state = newGame(tutorial.seme).state;
    const inizio: Contesto = { state, panel: null, layer: null, selected: null, paperOpen: false };
    for (const passo of tutorial.passi) {
      if (passo.attesa.tipo === 'finestra-chiusa') continue; // all'inizio non c'è nessuna finestra da chiudere: il passo segue un'apertura
      expect(fatto(passo, inizio), passo.id).toBe(false);
    }
    const p = (id: string) => tutorial.passi.find((x) => x.id === id)!;
    expect(fatto(p('strati'), { ...inizio, panel: 'strati' })).toBe(true);
    expect(fatto(p('strato'), { ...inizio, layer: 'airQuality' })).toBe(true);
    expect(fatto(p('lotto'), { ...inizio, selected: { kind: 'lot', id: 'lotto-cokerie' } })).toBe(true);
    expect(fatto(p('lotto'), { ...inizio, selected: { kind: 'district', id: 'tamburi' } })).toBe(false);
    const avviato = act(newGame(tutorial.seme), { kind: 'convert-lot', lotId: 'lotto-cokerie', path: 'energy' }).state;
    expect(fatto(p('cantiere'), { ...inizio, state: avviato })).toBe(true);
    expect(fatto(p('cronaca'), { ...inizio, paperOpen: true })).toBe(true);
    expect(fatto(p('fine'), { ...inizio, panel: 'strati', paperOpen: true })).toBe(false);
  });

  it('l\'ultimo passo finisce solo con «Fine», e la partita guidata copre i primi cinque anni', () => {
    expect(tutorial.passi.at(-1)!.attesa.tipo).toBe('fine');
    const anni = tutorial.passi.flatMap((p) => (p.attesa.tipo === 'anno' ? [p.attesa.anno] : []));
    expect(Math.max(...anni)).toBe(5);
  });
});
