/** Opzioni del comando pnpm balance. */
import { defaultThreads } from './run.js';

export interface CliOptions {
  games: number;
  seed: number;
  botIds: string[];
  threads: number;
  output?: string;
  /** File JSON di una variante da provare in memoria. */
  variant?: string;
}

export function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = { games: 100, seed: 1, botIds: [], threads: defaultThreads() };
  const args = argv.filter((a) => a !== '--');
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;
    const value = args[i + 1];
    const needNumber = (): number => {
      const n = Number(value);
      if (value === undefined || !Number.isInteger(n) || n < 1) throw new Error(`${flag} vuole un intero positivo`);
      i++;
      return n;
    };
    if (flag === '--partite') options.games = needNumber();
    else if (flag === '--seme') options.seed = needNumber();
    else if (flag === '--thread') options.threads = needNumber();
    else if (flag === '--bot' && value !== undefined) {
      options.botIds.push(value);
      i++;
    } else if (flag === '--uscita' && value !== undefined) {
      options.output = value;
      i++;
    } else if (flag === '--variante' && value !== undefined) {
      options.variant = value;
      i++;
    } else throw new Error(`opzione sconosciuta: ${flag}`);
  }
  return options;
}
