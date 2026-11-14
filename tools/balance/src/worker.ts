/** Thread di lavoro: gioca un pezzo di partite e restituisce i risultati. */
import { parentPort, workerData } from 'node:worker_threads';
import { playChunk, type Chunk } from './run.js';

parentPort!.postMessage(playChunk(workerData as Chunk));
