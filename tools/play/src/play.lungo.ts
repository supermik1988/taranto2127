/**
 * Prove lunghe della partita dal terminale (`pnpm test:lungo`): il comando vero,
 * lanciato in un processo a parte. In `play.test.ts` restano le versioni brevi,
 * con la sessione nello stesso processo.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));

/** Il comando vero, in modo asincrono, con i comandi scritti sulla sua tastiera: il processo di prova non resta bloccato. */
function run(args: string[], input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', cli, ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (out += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (err += chunk));
    child.once('error', reject);
    child.once('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`pnpm play è uscito con codice ${code}: ${err}`))));
    child.stdin.end(input);
  });
}

describe('il comando vero', { timeout: 180_000 }, () => {
  it('pnpm play legge i comandi da tastiera o da un file e risponde', async () => {
    const out = await run(['--seme', '4'], 'c\nq\n');
    expect(out).toContain('TARANTO 2027');
    expect(out).toContain('IL CONSIGLIO');
    expect(out).toContain('Arrivederci');
  });

  it('--carica riprende una partita salvata', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'taranto2127-')), 'p.json');
    await run(['--seme', '8'], `a\na\nsalva ${path}\nq\n`);
    const out = await run(['--carica', path], 'q\n');
    expect(out).toContain('Seme 8');
  });
});
