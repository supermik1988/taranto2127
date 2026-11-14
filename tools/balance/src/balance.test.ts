import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadContent } from '@taranto2127/content';
import { describe, expect, it } from 'vitest';
import { BOTS, idleBot, PATHS, singlePath } from './bots.js';
import { parseArgs } from './args.js';
import { formatReport, median } from './report.js';
import { runBalance } from './run.js';
import { playGame } from './simulate.js';

const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
const runCli = (...args: string[]): string =>
  execFileSync(process.execPath, ['--import', 'tsx', cli, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

describe('bot', () => {
  it('sei bot, con la strada unica parametrica sulle quattro strade', () => {
    const ids = BOTS.map((b) => b.id);
    expect(ids).toEqual([
      'blu',
      'red',
      'casuale',
      'strada-green-steel',
      'strada-remediation',
      'strada-energy',
      'strada-sea-culture',
      'prudente',
      'nessuna',
    ]);
    expect(PATHS.map((p) => singlePath(p).id)).toEqual(ids.slice(3, 7));
  });

  it('il bot senza azioni non fa nulla oltre a rispondere ai dilemmi', () => {
    const { initialContent, rules } = loadContent();
    const game = playGame(idleBot, 3, initialContent, rules);
    expect(game.levers.every((l) => l.startsWith('dilemma:'))).toBe(true);
  });
});

describe('rapporto', () => {
  it('contiene i cinque gruppi di informazioni', async () => {
    const text = formatReport(await runBalance({ games: 2, seed: 1, threads: 1 }));
    for (const heading of [
      '## 1. Esiti',
      '## 2. Valori mediani a fine partita',
      '## 3. Bot con lo stesso esito in più del 90% delle partite',
      '## 4. Variabili che crescono o calano senza limite',
      '## 5. Leve mai usate o sempre convenienti',
    ]) {
      expect(text).toContain(heading);
    }
    for (const column of ['Al 2127', 'In dissesto', 'Anno mediano del dissesto', 'Fondi propri', 'Occupati locali', 'Cassa integrati',
      'Disoccupati', 'Coscienza', 'Reputazione', 'Scandali', 'Aria Tamburi', 'Fiducia Tamburi']) {
      expect(text).toContain(column);
    }
  });

  it('è identico a parità di seme, e diverso con un altro seme', async () => {
    const a = formatReport(await runBalance({ games: 2, seed: 5, threads: 1 }));
    const b = formatReport(await runBalance({ games: 2, seed: 5, threads: 1 }));
    const c = formatReport(await runBalance({ games: 2, seed: 6, threads: 1 }));
    expect(b).toBe(a);
    expect(c).not.toBe(a);
  });

  it('la mediana è quella attesa', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(Number.isNaN(median([]))).toBe(true);
  });
});

describe('comando', { timeout: 60_000 }, () => {
  it('legge le opzioni, anche dopo il separatore di pnpm', () => {
    expect(parseArgs(['--', '--partite', '7', '--seme', '3', '--bot', 'red', '--thread', '2'])).toMatchObject({
      games: 7,
      seed: 3,
      botIds: ['red'],
      threads: 2,
    });
    expect(() => parseArgs(['--partite', 'zero'])).toThrow();
    expect(() => parseArgs(['--sconosciuta'])).toThrow();
  });

  it('pnpm balance gira su poche partite e stampa il rapporto', () => {
    const out = runCli('--partite', '2', '--thread', '1');
    expect(out).toContain('# Rapporto di bilanciamento');
    expect(out).toContain('2 partite per bot');
  });

  it('con più thread il rapporto è identico a quello in un solo thread', () => {
    const one = runCli('--partite', '3', '--thread', '1', '--bot', 'casuale', '--bot', 'red');
    const many = runCli('--partite', '3', '--thread', '3', '--bot', 'casuale', '--bot', 'red');
    expect(many).toBe(one);
  });
});
