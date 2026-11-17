/**
 * Prove lunghe del bilanciamento (`pnpm test:lungo`): rapporti con tutti i bot e
 * il comando vero, lanciato in un processo a parte, anche su più thread. In
 * `balance.test.ts` restano le versioni brevi, nello stesso processo.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatReport } from './report.js';
import { runBalance } from './run.js';

const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
const runCli = (...args: string[]): string =>
  execFileSync(process.execPath, ['--import', 'tsx', cli, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const HEADINGS = [
  '## 1. Esiti',
  '## 2. Valori mediani a fine partita',
  '## 3. Bot con lo stesso esito in più del 90% delle partite',
  '## 4. Variabili che crescono o calano senza limite',
  '## 5. Leve mai usate o sempre convenienti',
];
const COLUMNS = ['Al 2127', 'In dissesto', 'Città che si volta', 'Anno mediano del dissesto', 'Fondi propri', 'Occupati locali', 'Cassa integrati',
  'Disoccupati', 'Coscienza', 'Reputazione', 'Fiducia media', 'Scandali', 'Aria Tamburi', 'Fiducia Tamburi', 'Esposizione Tamburi', 'Salute Tamburi', 'Terreni area ind.'];

// Partite intere di tutti i bot: margine ampio, ora che molte arrivano al 2127.
describe('rapporto con tutti i bot', { timeout: 180_000 }, () => {
  it('contiene i cinque gruppi di informazioni', async () => {
    const text = formatReport(await runBalance({ games: 2, seed: 1, threads: 1 }));
    for (const heading of HEADINGS) expect(text).toContain(heading);
    for (const column of COLUMNS) expect(text).toContain(column);
  });

  it('è identico a parità di seme, e diverso con un altro seme', async () => {
    const a = formatReport(await runBalance({ games: 2, seed: 5, threads: 1 }));
    const b = formatReport(await runBalance({ games: 2, seed: 5, threads: 1 }));
    const c = formatReport(await runBalance({ games: 2, seed: 6, threads: 1 }));
    expect(b).toBe(a);
    expect(c).not.toBe(a);
  });
});

describe('il comando vero', { timeout: 180_000 }, () => {
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
