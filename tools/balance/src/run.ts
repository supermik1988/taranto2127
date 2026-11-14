/** Gioca le partite di tutti i bot, nello stesso processo o su più thread. */
import { cpus } from 'node:os';
import { Worker } from 'node:worker_threads';
import { loadContent } from '@taranto2127/content';
import { BOTS, type Bot } from './bots.js';
import { buildReport, type Report } from './report.js';
import { InvalidStateError, playGame, type GameFailure, type GameResult } from './simulate.js';

export interface RunOptions {
  games: number;
  seed: number;
  /** Identificativi dei bot da far giocare; tutti se assente. */
  botIds?: string[];
  /** Thread di lavoro; 1 = tutto nello stesso processo. */
  threads?: number;
}

/** Un pezzo di lavoro: un bot, un intervallo di semi. */
export interface Chunk {
  botId: string;
  seeds: number[];
}

export function selectBots(botIds?: string[]): Bot[] {
  if (botIds === undefined || botIds.length === 0) return [...BOTS];
  const unknown = botIds.filter((id) => !BOTS.some((b) => b.id === id));
  if (unknown.length > 0) throw new Error(`bot inesistente: ${unknown.join(', ')} (disponibili: ${BOTS.map((b) => b.id).join(', ')})`);
  return BOTS.filter((b) => botIds.includes(b.id));
}

export interface ChunkOutcome {
  results: GameResult[];
  failures: GameFailure[];
}

/**
 * Gioca un pezzo di partite. Una partita in cui il motore produce uno stato non
 * valido non ferma le altre: finisce tra i fallimenti, che il rapporto elenca.
 */
export function playChunk(chunk: Chunk): ChunkOutcome {
  const { initialContent, rules } = loadContent();
  const bot = BOTS.find((b) => b.id === chunk.botId)!;
  const outcome: ChunkOutcome = { results: [], failures: [] };
  for (const seed of chunk.seeds) {
    try {
      outcome.results.push(playGame(bot, seed, initialContent, rules));
    } catch (error) {
      if (!(error instanceof InvalidStateError)) throw error;
      outcome.failures.push({ botId: bot.id, seed, message: error.message });
    }
  }
  return outcome;
}

function runInWorker(chunk: Chunk): Promise<ChunkOutcome> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { workerData: chunk, execArgv: ['--import', 'tsx'] });
    worker.once('message', (outcome: ChunkOutcome) => resolve(outcome));
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`thread terminato con codice ${code}`));
    });
  });
}

/** Gioca tutte le partite e costruisce il rapporto. L'ordine dei risultati non dipende dai thread. */
export async function runBalance(options: RunOptions): Promise<Report> {
  const bots = selectBots(options.botIds);
  const seeds = Array.from({ length: options.games }, (_, i) => options.seed + i);
  const threads = Math.max(1, options.threads ?? 1);
  const chunkSize = Math.max(1, Math.ceil(options.games / Math.max(1, Math.ceil(threads / bots.length))));
  const chunks: Chunk[] = bots.flatMap((bot) => {
    const out: Chunk[] = [];
    for (let i = 0; i < seeds.length; i += chunkSize) out.push({ botId: bot.id, seeds: seeds.slice(i, i + chunkSize) });
    return out;
  });

  const done: ChunkOutcome[] = new Array(chunks.length);
  if (threads === 1) {
    chunks.forEach((chunk, i) => (done[i] = playChunk(chunk)));
  } else {
    let next = 0;
    const lane = async (): Promise<void> => {
      while (next < chunks.length) {
        const i = next++;
        done[i] = await runInWorker(chunks[i]!);
      }
    };
    await Promise.all(Array.from({ length: Math.min(threads, chunks.length) }, lane));
  }

  const resultsByBot: Record<string, GameResult[]> = Object.fromEntries(bots.map((b) => [b.id, []]));
  chunks.forEach((chunk, i) => resultsByBot[chunk.botId]!.push(...done[i]!.results));
  for (const results of Object.values(resultsByBot)) results.sort((a, b) => a.seed - b.seed);
  const failures = done.flatMap((d) => d.failures).sort((a, b) => a.botId.localeCompare(b.botId) || a.seed - b.seed);
  return buildReport(options.seed, options.games, bots, resultsByBot, loadContent().rules, failures);
}

export const defaultThreads = (): number => Math.max(1, cpus().length - 1);
