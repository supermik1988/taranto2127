import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adviseCouncil } from '@taranto2127/agents';
import { loadContent } from '@taranto2127/content';
import { createInitialState, type GameState } from '@taranto2127/sim';
import { describe, expect, it } from 'vitest';
import { loadGame } from './save.js';
import { WIDTH } from './screens.js';
import { PlaySession } from './session.js';

const content = loadContent();
const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
const columns = (text: string): number => Math.max(...text.split('\n').map((line) => [...line].length));

/** Gioca una partita intera con un copione: qualche azione all'inizio, poi avanti, rispondendo ai dilemmi. */
function scriptedGame(seed: number): { session: PlaySession; outputs: string[] } {
  const session = new PlaySession({ content, seed });
  const outputs = [session.start()];
  const cmd = (line: string) => outputs.push(session.handle(line));
  for (const line of ['p', '2', 's', 'l', '1', '3', 's', 'o', '2', 's', 'c', '?']) cmd(line);
  let guard = 0;
  while (session.state.status === 'running' && guard++ < 500) {
    if (session.state.openDilemmaId !== null) ['d', '1', 's'].forEach(cmd);
    else cmd('aa');
  }
  cmd('v');
  return { session, outputs };
}

describe('partita dal terminale', { timeout: 120_000 }, () => {
  const game = scriptedGame(11);

  it('una partita pilotata da un copione di comandi arriva alla fine e produce il ritratto', () => {
    expect(game.session.state.status).not.toBe('running');
    const last = game.outputs.at(-1)!;
    expect(last).toContain('RITRATTO DI TARANTO');
    expect(last).toMatch(/Una città (in piedi|svuotata)/);
    expect(last).toMatch(/coscienza (Blu|Red)/);
    expect(last).toContain('pnpm play -- --seme 11');
    expect(last).toContain('Occupati');
  });

  it('tutte le schermate stanno in 100 colonne', () => {
    for (const out of game.outputs) expect(columns(out)).toBeLessThanOrEqual(WIDTH);
  });

  it('la schermata dell’anno ha anno, epoca, fondi, lavoro, quartieri con frecce, barre morali, progetti e politiche', () => {
    const screen = game.outputs.find((o) => o.includes('Cronaca del 2030'))!;
    expect(screen).toMatch(/TARANTO 20\d\d ═══ epoca \d di 5/);
    for (const part of ['Fondi (M€)', 'Lavoro', 'cassa integrati', 'disoccupati', 'Tamburi',
      'Paolo VI', 'Città Vecchia', 'Borgo', 'Talsano', 'Area industriale', 'Coscienza', 'Reputazione', 'Red', 'Blu', 'Progetti',
      'Politiche']) {
      expect(screen, part).toContain(part);
    }
    expect(screen).toMatch(/[↑↓=]/);
  });

  it('la Cronaca dà da uno a tre titoli per anno', () => {
    for (const out of game.outputs) {
      for (const block of out.split('── Cronaca del ').slice(1)) {
        const titles = block.split('\n').slice(1).filter((l) => l.startsWith('  ') && l.trim() !== '');
        const before = titles.findIndex((l) => !l.startsWith('  '));
        expect(before === -1 ? titles.length : before).toBeGreaterThanOrEqual(1);
      }
    }
    const all = game.outputs.join('\n');
    expect(all).toMatch(/Aprono i lavori|Entra in funzione|cala la fiducia|Un anno senza grandi notizie/);
  });

  it('salvare e ricaricare dà lo stesso stato', () => {
    const session = new PlaySession({ content, seed: 21 });
    for (const line of ['p', '1', 's', 'a', 'o', '3', 's', 'aa']) session.handle(line);
    if (session.state.openDilemmaId !== null) ['d', '2', 's'].forEach((l) => session.handle(l));
    const path = join(mkdtempSync(join(tmpdir(), 'taranto2127-')), 'partita.json');
    expect(session.handle(`salva ${path}`)).toContain(path);
    expect(JSON.stringify(loadGame(path, content))).toBe(JSON.stringify(session.state));
  });

  it('a chiude un anno; aa si ferma a un dilemma, a una fase che finisce o a un cambio d’epoca, al massimo dopo 10 anni', () => {
    const session = new PlaySession({ content, seed: 3 });
    session.handle('a');
    expect(session.state.turn).toBe(1);
    const before = session.state.turn;
    if (session.state.openDilemmaId === null) session.handle('aa');
    expect(session.state.turn - before).toBeLessThanOrEqual(10);
    expect(session.state.turn - before).toBeGreaterThanOrEqual(0);
  });

  it('con un dilemma aperto non si chiude l’anno', () => {
    const state: GameState = { ...createInitialState(1, content.initialContent), openDilemmaId: 'presidio-ai-cancelli' };
    const session = new PlaySession({ content, state });
    expect(session.handle('a')).toContain('dilemma aperto');
    expect(session.state.turn).toBe(0);
  });
});

describe('il Consiglio nel terminale', () => {
  it('c mostra i sei consigli, identici a parità di stato', () => {
    const a = new PlaySession({ content, seed: 4 }).handle('c');
    const b = new PlaySession({ content, seed: 4 }).handle('c');
    expect(a).toBe(b);
    for (const member of content.initialContent.council) expect(a).toContain(member.name);
    expect(columns(a)).toBeLessThanOrEqual(WIDTH);
    const advice = adviseCouncil(createInitialState(4, content.initialContent), content.rules, content.council, content.councilLabels);
    for (const x of advice) expect(a).toContain(x.reason.slice(0, 40));
  });
});

describe('le scelte nascoste non si rivelano prima', () => {
  const opened = (dilemmaId: string): PlaySession =>
    new PlaySession({ content, state: { ...createInitialState(2, content.initialContent), openDilemmaId: dilemmaId } });

  for (const [dilemmaId, dilemma] of Object.entries(content.rules.dilemmas)) {
    it(`dilemma ${dilemmaId}: nessuna marca prima della scelta, la marca dopo solo se era nascosta`, () => {
      expect(opened(dilemmaId).handle('d').toLowerCase()).not.toContain('nascost');
      Object.values(dilemma.options).forEach((option, i) => {
        const session = opened(dilemmaId);
        session.handle('d');
        const confirm = session.handle(String(i + 1));
        expect(confirm.toLowerCase()).not.toContain('nascost');
        const after = session.handle('s');
        expect(after.toLowerCase().includes('nascost')).toBe(option.hidden);
      });
    });
  }

  it('saltare una fase: nessuna marca prima, la marca dopo', () => {
    const session = new PlaySession({ content, seed: 5 });
    session.handle('p');
    session.handle('2');
    session.handle('s');
    while (!session.state.projects.some((p) => p.phase === 'permitting' || p.phase === 'tender')) session.handle('a');
    expect(session.handle('s').toLowerCase()).not.toContain('nascost');
    expect(session.handle('1').toLowerCase()).not.toContain('nascost');
    expect(session.handle('s').toLowerCase()).toContain('nascost');
  });
});

describe('il comando', { timeout: 60_000 }, () => {
  const run = (args: string[], input: string): string =>
    execFileSync(process.execPath, ['--import', 'tsx', cli, ...args], { input, encoding: 'utf8' });

  it('pnpm play legge i comandi da tastiera o da un file e risponde', () => {
    const out = run(['--seme', '4'], 'c\nq\n');
    expect(out).toContain('TARANTO 2027');
    expect(out).toContain('IL CONSIGLIO');
    expect(out).toContain('Arrivederci');
  });

  it('--carica riprende una partita salvata', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'taranto2127-')), 'p.json');
    run(['--seme', '8'], `a\na\nsalva ${path}\nq\n`);
    const out = run(['--carica', path], 'q\n');
    expect(out).toContain('Seme 8');
  });
});
