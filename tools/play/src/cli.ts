/**
 * pnpm play -- [--seme N] [--carica file]
 *
 * Una partita dal terminale. Solo Node: funziona anche nel terminale di Windows.
 */
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { loadContent } from '@taranto2127/content';
import { loadGame } from './save.js';
import { PlaySession } from './session.js';

function parseArgs(argv: readonly string[]): { seed?: number; load?: string } {
  const args = argv.filter((a) => a !== '--');
  const out: { seed?: number; load?: string } = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    const value = args[i + 1];
    if (flag === '--seme' && value !== undefined && /^\d+$/.test(value)) {
      out.seed = Number(value);
      i++;
    } else if (flag === '--carica' && value !== undefined) {
      out.load = value;
      i++;
    } else throw new Error(`opzione sconosciuta: ${flag ?? ''} (usa --seme N oppure --carica file)`);
  }
  return out;
}

function main(): void {
  // Il terminale classico di Windows usa una codifica che storpia accenti e frecce: si passa a UTF-8.
  if (process.platform === 'win32' && process.stdout.isTTY) {
    try {
      execSync('chcp 65001', { stdio: 'ignore' });
    } catch {
      // Se non riesce, si gioca comunque.
    }
  }
  const options = parseArgs(process.argv.slice(2));
  const content = loadContent();
  // Senza --seme, un seme nuovo a ogni partita: è l'interfaccia, non il motore, a sceglierlo.
  const seed = options.seed ?? (Date.now() % 1_000_000);
  const session =
    options.load !== undefined ? new PlaySession({ content, state: loadGame(options.load, content) }) : new PlaySession({ content, seed });
  process.stdout.write(`${session.start()}\n\n> `);
  const rl = createInterface({ input: process.stdin, terminal: false });
  rl.on('line', (line) => {
    process.stdout.write(`${session.handle(line)}\n`);
    if (session.quit) rl.close();
    else process.stdout.write('\n> ');
  });
  rl.on('close', () => process.stdout.write('\n'));
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
