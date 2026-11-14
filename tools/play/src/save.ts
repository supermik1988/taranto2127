/** Salvataggio: una partita è seme più storia; si ricarica con replay. */
import { readFileSync, writeFileSync } from 'node:fs';
import type { LoadedContent } from '@taranto2127/content';
import { createInitialState, replay, type GameState } from '@taranto2127/sim';

export interface SavedGame {
  formato: 'taranto2127-partita';
  versione: 1;
  seme: number;
  calibrazione: string;
  turno: number;
  storia: GameState['history'];
}

export function toSaved(state: GameState): SavedGame {
  return {
    formato: 'taranto2127-partita',
    versione: 1,
    seme: state.seed,
    calibrazione: state.calibrationVersion,
    turno: state.turn,
    storia: structuredClone(state.history),
  };
}

export function saveGame(path: string, state: GameState): void {
  writeFileSync(path, `${JSON.stringify(toSaved(state), null, 2)}\n`, 'utf8');
}

/** Ricostruisce lo stato da un salvataggio, rigiocando la storia dal seme. */
export function restore(saved: SavedGame, content: LoadedContent): GameState {
  if (saved.formato !== 'taranto2127-partita') throw new Error('non è un salvataggio di TARANTO2127');
  return replay(createInitialState(saved.seme, content.initialContent), saved.storia, content.rules, saved.turno);
}

export function loadGame(path: string, content: LoadedContent): GameState {
  return restore(JSON.parse(readFileSync(path, 'utf8')) as SavedGame, content);
}
