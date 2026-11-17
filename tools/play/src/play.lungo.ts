/**
 * Prove lunghe della partita dal terminale (`pnpm test:lungo`): il comando vero,
 * lanciato in un processo a parte. In `play.test.ts` restano le versioni brevi,
 * con la sessione nello stesso processo.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));

describe('il comando vero', { timeout: 120_000 }, () => {
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
