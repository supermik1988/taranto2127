/**
 * pnpm balance -- --partite N [--seme S] [--bot id]... [--thread T] [--uscita file.md]
 *
 * Gioca N partite per bot con i contenuti veri e stampa il rapporto. Il tempo
 * impiegato va sull'errore standard, così il rapporto resta identico a parità di seme.
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from './args.js';
import { runBalance } from './run.js';
import { readVariant } from './variant.js';
import { formatReport } from './report.js';

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const started = performance.now();
  const report = await runBalance({
    games: options.games,
    seed: options.seed,
    botIds: options.botIds,
    threads: options.threads,
    ...(options.variant !== undefined && { patches: readVariant(options.variant) }),
  });
  const text = formatReport(report);
  if (options.output !== undefined) writeFileSync(options.output, `${text}\n`, 'utf8');
  process.stdout.write(`${process.stdout.isTTY ? formatReport(report, { color: true }) : text}\n`);
  process.stderr.write(`${options.games} partite per bot in ${((performance.now() - started) / 1000).toFixed(1)} s con ${options.threads} thread\n`);
  if (report.failures.length > 0) {
    process.stderr.write(`${report.failures.length} partite interrotte da uno stato non valido del motore\n`);
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
