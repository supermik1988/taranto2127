/**
 * Il collegamento tra interfaccia e motore. Lo stato di gioco cambia solo con
 * applyAction e advanceTurn (regola 1); qui si tengono anche la linea del
 * tempo per i grafici e il salvataggio come seme più storia.
 */
import { loadContent } from '@taranto2127/content';
import { chronicle } from '@taranto2127/play/chronicle';
import {
  DISTRICT_IDS,
  advanceTurn,
  applyAction,
  createInitialState,
  epochOfTurn,
  type Action,
  type DistrictId,
  type GameState,
} from '@taranto2127/sim';

export const content = loadContent();

export const QUANTITIES = ['airQuality', 'cumulativeExposure', 'health', 'services', 'tension', 'trust'] as const;
export type Quantity = (typeof QUANTITIES)[number];

/** Fotografia di un anno, per i grafici. */
export interface Snapshot {
  turn: number;
  districts: Record<DistrictId, Record<Quantity, number>>;
  employed: number;
  onWageSupport: number;
  unemployed: number;
  own: number;
  state: number;
  eu: number;
}

export interface Game {
  state: GameState;
  /** Stato dell'anno prima, per le frecce e per capire chi si è fermato. */
  prev: GameState | undefined;
  timeline: Snapshot[];
}

export interface SavedGame {
  formato: 'taranto2127-partita';
  versione: 1;
  seme: number;
  turno: number;
  storia: GameState['history'];
}

export function snapshot(s: GameState): Snapshot {
  return {
    turn: s.turn,
    districts: Object.fromEntries(
      DISTRICT_IDS.map((id) => [id, Object.fromEntries(QUANTITIES.map((q) => [q, s.districts[id][q]]))]),
    ) as Snapshot['districts'],
    employed: Object.values(s.labor.employed).reduce((a, b) => a + b, 0),
    onWageSupport: s.labor.onWageSupport,
    unemployed: s.labor.unemployed,
    own: s.economy.funds.own,
    state: s.economy.funds.state,
    eu: s.economy.funds['eu-earmarked'],
  };
}

export function newGame(seed: number): Game {
  const state = createInitialState(seed, content.initialContent);
  return { state, prev: undefined, timeline: [snapshot(state)] };
}

/** Ricostruisce una partita da seme e storia, anno per anno, con la sua linea del tempo. */
export function restoreGame(saved: SavedGame): Game {
  let game = newGame(saved.seme);
  for (const { turn, action } of saved.storia) {
    while (game.state.turn < turn) game = closeYear(game).game;
    game = act(game, action);
  }
  while (game.state.turn < saved.turno && game.state.status === 'running') game = closeYear(game).game;
  return game;
}

export function toSaved(state: GameState): SavedGame {
  return { formato: 'taranto2127-partita', versione: 1, seme: state.seed, turno: state.turn, storia: state.history };
}

export function act(game: Game, action: Action): Game {
  return { ...game, state: applyAction(game.state, action, content.rules) };
}

export interface YearResult {
  game: Game;
  /** Titoli della Cronaca dell'ultimo anno chiuso. */
  headlines: string[];
  /** Anno chiuso a cui si riferiscono i titoli. */
  year: number;
}

export function closeYear(game: Game): YearResult {
  const before = game.state;
  const after = advanceTurn(before, content.rules);
  return {
    game: { state: after, prev: before, timeline: [...game.timeline, snapshot(after)] },
    headlines: chronicle(before, after, content),
    year: 2027 + before.turn,
  };
}

/** Avanza fino al prossimo dilemma, a una fase che finisce o a un cambio d'epoca, al massimo 10 anni. */
export function advanceToEvent(game: Game): YearResult {
  let result = closeYear(game);
  for (let i = 1; i < 10 && result.game.state.status === 'running'; i++) {
    const before = result.game.prev!;
    const after = result.game.state;
    const phaseChanged = after.projects.some((p) => before.projects.find((q) => q.id === p.id)?.phase !== p.phase);
    const epochChanged = epochOfTurn(Math.min(after.turn, 99)) !== epochOfTurn(before.turn);
    if (after.openDilemmaId !== null || phaseChanged || epochChanged) break;
    result = closeYear(result.game);
  }
  return result;
}

// ---------- Salvataggio nel browser e link ----------

const STORAGE_KEY = 'taranto2127:partita';

export function saveLocal(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSaved(state)));
  } catch {
    // Archivio del browser non disponibile: si gioca lo stesso.
  }
}

export function loadLocal(): SavedGame | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : (JSON.parse(raw) as SavedGame);
  } catch {
    return null;
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // niente da fare
  }
}

/** Link che riapre la stessa partita: seme e storia nel frammento dell'indirizzo. */
export function gameLink(state: GameState, base: string): string {
  return `${base.split('#')[0]!.split('?')[0]}#partita=${encodeURIComponent(JSON.stringify(toSaved(state)))}`;
}

export function savedFromHash(hash: string): SavedGame | null {
  const match = /#partita=(.+)$/.exec(hash);
  if (match === null) return null;
  try {
    const saved = JSON.parse(decodeURIComponent(match[1]!)) as SavedGame;
    return saved.formato === 'taranto2127-partita' ? saved : null;
  } catch {
    return null;
  }
}

/** La partita da aprire: dal link, poi dal browser, poi dal seme dell'indirizzo, altrimenti una nuova. */
export function startingGame(location: { hash: string; search: string }): Game {
  const fromHash = savedFromHash(location.hash);
  if (fromHash !== null) return restoreGame(fromHash);
  const seedParam = new URLSearchParams(location.search).get('seme');
  const local = loadLocal();
  if (local !== null && (seedParam === null || Number(seedParam) === local.seme)) return restoreGame(local);
  const seed = seedParam !== null && /^\d+$/.test(seedParam) ? Number(seedParam) : Date.now() % 1_000_000;
  return newGame(seed);
}
