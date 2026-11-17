import { loadContent } from '@taranto2127/content';
import { describe, expect, it } from 'vitest';
import { BOTS, idleBot, PATHS, singlePath } from './bots.js';
import { parseArgs } from './args.js';
import { formatReport, median } from './report.js';
import { runBalance } from './run.js';
import { playGame } from './simulate.js';

/** Capitoli e colonne che il rapporto deve sempre avere (anche in balance.lungo.ts). */
const HEADINGS = [
  '## 1. Esiti',
  '## 2. Valori mediani a fine partita',
  '## 3. Bot con lo stesso esito in più del 90% delle partite',
  '## 4. Variabili che crescono o calano senza limite',
  '## 5. Leve mai usate o sempre convenienti',
];
const COLUMNS = ['Al 2127', 'In dissesto', 'Città che si volta', 'Anno mediano del dissesto', 'Fondi propri', 'Occupati locali', 'Cassa integrati',
  'Disoccupati', 'Coscienza', 'Reputazione', 'Fiducia media', 'Scandali', 'Aria Tamburi', 'Fiducia Tamburi', 'Esposizione Tamburi', 'Salute Tamburi', 'Terreni area ind.'];

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

describe('rapporto', { timeout: 60_000 }, () => {
  // Versioni brevi, con pochi bot e una partita; quelle con tutti i bot stanno in balance.lungo.ts (pnpm test:lungo).
  it('contiene i cinque gruppi di informazioni', async () => {
    const text = formatReport(await runBalance({ games: 1, seed: 1, threads: 1, botIds: ['nessuna', 'red'] }));
    for (const heading of HEADINGS) expect(text).toContain(heading);
    for (const column of COLUMNS) expect(text).toContain(column);
  });

  it('è identico a parità di seme, e diverso con un altro seme', async () => {
    const run = (seed: number) => runBalance({ games: 1, seed, threads: 1, botIds: ['casuale'] }).then((r) => formatReport(r));
    const a = await run(5);
    expect(await run(5)).toBe(a);
    expect(await run(6)).not.toBe(a);
  });

  it('una variante cambia i valori in memoria senza toccare i contenuti', async () => {
    const { CONTENT_FILES } = await import('@taranto2127/content');
    const { applyPatches } = await import('./variant.js');
    const before = JSON.stringify(CONTENT_FILES);
    const patched = applyPatches(CONTENT_FILES, [
      { file: 'parametri', path: 'economy.servicesCostPerYear', value: 30 },
      { file: 'partenza', path: 'council.cons-lavoro.patience', value: 70 },
    ]);
    expect((patched.parametri as { economy: { servicesCostPerYear: { valore: number } } }).economy.servicesCostPerYear.valore).toBe(30);
    expect(loadContent(patched).initialContent.council.find((c) => c.id === 'cons-lavoro')!.patience).toBe(70);
    expect(JSON.stringify(CONTENT_FILES)).toBe(before);
    expect(() => applyPatches(CONTENT_FILES, [{ file: 'parametri', path: 'economy.inesistente.x', value: 1 }])).toThrow();
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

  // Versioni brevi nello stesso processo: la stessa strada del comando (opzioni, partite, rapporto).
  // Le prove che lanciano il comando vero stanno in balance.lungo.ts (pnpm test:lungo).
  it('pnpm balance gira su poche partite e stampa il rapporto', async () => {
    const options = parseArgs(['--', '--partite', '2', '--bot', 'nessuna']);
    const text = formatReport(await runBalance({ games: options.games, seed: options.seed, botIds: options.botIds, threads: options.threads }));
    expect(text).toContain('# Rapporto di bilanciamento');
    expect(text).toContain('2 partite per bot');
  });

  it('con più thread il rapporto è identico a quello in un solo thread', async () => {
    const one = formatReport(await runBalance({ games: 2, seed: 3, threads: 1, botIds: ['nessuna'] }));
    const many = formatReport(await runBalance({ games: 2, seed: 3, threads: 2, botIds: ['nessuna'] }));
    expect(many).toBe(one);
  });
});
