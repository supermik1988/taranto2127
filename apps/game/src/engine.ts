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
  stopReasons,
  type Action,
  type DistrictId,
  type GameState,
  type StopReason,
} from '@taranto2127/sim';

export const content = loadContent();

export const QUANTITIES = ['airQuality', 'cumulativeExposure', 'health', 'services', 'tension', 'trust'] as const;
export type Quantity = (typeof QUANTITIES)[number];

/** Fotografia di un anno, per i grafici. */
export interface Snapshot {
  turn: number;
  districts: Record<DistrictId, Record<Quantity, number>>;
  /** Residenti per quartiere, per la media cittadina pesata. */
  residents: Record<DistrictId, number>;
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
  /** Versione del gioco che ha fatto il salvataggio (T12d; assente nei salvataggi più vecchi). */
  versioneGioco?: string;
  /** Impronta dei dati di gioco (regole e contenuti) con cui è stato fatto (T12d). */
  versioneDati?: string;
}

// ---------- Versioni e partite che non si possono riaprire (T12d) ----------

declare const __VERSIONE_GIOCO__: string | undefined;
/** Versione del gioco: la imposta la compilazione (vite.config.ts); nelle prove vale «sviluppo». */
export const VERSIONE_GIOCO: string = typeof __VERSIONE_GIOCO__ === 'string' ? __VERSIONE_GIOCO__ : 'sviluppo';

/** Impronta (FNV-1a, 32 bit) di un testo. */
function impronta(testo: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < testo.length; i++) {
    h ^= testo.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Impronta dei dati di gioco: regole e contenuti iniziali. Se cambia, le stesse mosse
 * con lo stesso seme non danno più la stessa partita (o non si possono più rigiocare).
 */
export const VERSIONE_DATI: string = impronta(JSON.stringify({ regole: content.rules, iniziale: content.initialContent }));

/** L'avviso per una partita salvata che non si può riaprire (scheda T12d). */
export const AVVISO_PARTITA_VECCHIA = 'Questa partita è stata salvata con una versione precedente del gioco e non si può riaprire';

/** Una partita salvata (nel browser, in un link, in un posto o in un file) che non si può riaprire. */
export class PartitaNonApribile extends Error {
  constructor(motivo: string) {
    super(`partita non apribile: ${motivo}`);
    this.name = 'PartitaNonApribile';
  }
}

/**
 * Riapre una partita salvata. Se è stata fatta con dati di gioco diversi da quelli di
 * oggi, non la si rigioca nemmeno; se rigiocarla fallisce (per esempio una risposta a un
 * dilemma che oggi non è aperto), lancia PartitaNonApribile.
 */
export function apriPartita(saved: SavedGame): Game {
  if (saved.versioneDati !== undefined && saved.versioneDati !== VERSIONE_DATI) {
    throw new PartitaNonApribile(`fatta con i dati ${saved.versioneDati}, oggi ${VERSIONE_DATI}`);
  }
  try {
    return restoreGame(saved);
  } catch (e) {
    throw new PartitaNonApribile(e instanceof Error ? e.message : String(e));
  }
}

export function snapshot(s: GameState): Snapshot {
  return {
    turn: s.turn,
    districts: Object.fromEntries(
      DISTRICT_IDS.map((id) => [id, Object.fromEntries(QUANTITIES.map((q) => [q, s.districts[id][q]]))]),
    ) as Snapshot['districts'],
    residents: Object.fromEntries(
      DISTRICT_IDS.map((id) => [id, s.districts[id].population.young + s.districts[id].population.adult + s.districts[id].population.elder]),
    ) as Snapshot['residents'],
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
  return { formato: 'taranto2127-partita', versione: 1, seme: state.seed, turno: state.turn, storia: state.history, versioneGioco: VERSIONE_GIOCO, versioneDati: VERSIONE_DATI };
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
  /** Perché il tempo deve fermarsi dopo questo anno; vuoto se può continuare. */
  stops: StopReason[];
}

export function closeYear(game: Game): YearResult {
  const before = game.state;
  const after = advanceTurn(before, content.rules);
  return {
    game: { state: after, prev: before, timeline: [...game.timeline, snapshot(after)] },
    headlines: chronicle(before, after, content),
    year: 2027 + before.turn,
    stops: stopReasons(before, after),
  };
}

/** Media cittadina di una grandezza in un anno, pesata sui residenti. */
export function cityAverage(snap: Snapshot, quantity: Quantity): number {
  let sum = 0;
  let people = 0;
  for (const id of DISTRICT_IDS) {
    sum += snap.districts[id][quantity] * snap.residents[id];
    people += snap.residents[id];
  }
  return people > 0 ? sum / people : 0;
}

// ---------- Salvataggio nel browser, posti, file e link ----------

const STORAGE_KEY = 'taranto2127:partita';
const SAVED_AT_KEY = 'taranto2127:partita:ora';
const SLOT_KEY = (slot: number) => `taranto2127:posto:${slot}`;
const TOUR_KEY = 'taranto2127:visita-fatta';
/** La partita che non si è potuta riaprire, conservata da parte finché il giocatore non la cancella. */
const OLD_KEY = 'taranto2127:partita:vecchia';
export const SLOTS = [1, 2, 3] as const;

/** L'archivio del browser, se c'è: in un test o in una finestra privata può mancare o rifiutare. */
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const browserStore = (): Store | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

function read(key: string, store: Store | undefined): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string, store: Store | undefined): boolean {
  try {
    if (store === undefined) return false;
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Salvataggio automatico. Restituisce l'ora del salvataggio, o null se il browser non lo permette. */
export function saveLocal(state: GameState, now = new Date(), store = browserStore()): Date | null {
  if (!write(STORAGE_KEY, JSON.stringify(toSaved(state)), store)) return null;
  write(SAVED_AT_KEY, now.toISOString(), store);
  return now;
}

export function loadLocal(store = browserStore()): SavedGame | null {
  return parseSaved(read(STORAGE_KEY, store));
}

/** Ora dell'ultimo salvataggio automatico, se c'è. */
export function lastLocalSave(store = browserStore()): Date | null {
  const raw = read(SAVED_AT_KEY, store);
  return raw === null ? null : new Date(raw);
}

export function clearLocal(store = browserStore()): void {
  try {
    store?.removeItem(STORAGE_KEY);
    store?.removeItem(SAVED_AT_KEY);
  } catch {
    // niente da fare
  }
}

/** Conserva da parte una partita che non si è potuta riaprire. */
export function conservaPartitaVecchia(saved: SavedGame, store = browserStore()): boolean {
  return write(OLD_KEY, JSON.stringify(saved), store);
}

/** La partita conservata da parte, se c'è. */
export function partitaVecchia(store = browserStore()): SavedGame | null {
  return parseSaved(read(OLD_KEY, store));
}

export function cancellaPartitaVecchia(store = browserStore()): void {
  try {
    store?.removeItem(OLD_KEY);
  } catch {
    // niente da fare
  }
}

/** Un posto di salvataggio manuale: la partita e quando è stata salvata. */
export interface SlotInfo {
  slot: number;
  saved: SavedGame;
  at: string;
}

export function saveSlot(slot: number, state: GameState, now = new Date(), store = browserStore()): boolean {
  return write(SLOT_KEY(slot), JSON.stringify({ partita: toSaved(state), ora: now.toISOString() }), store);
}

export function readSlot(slot: number, store = browserStore()): SlotInfo | null {
  const raw = read(SLOT_KEY(slot), store);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as { partita: unknown; ora: string };
    const saved = parseSaved(JSON.stringify(parsed.partita));
    return saved === null ? null : { slot, saved, at: parsed.ora };
  } catch {
    return null;
  }
}

export function tourDone(store = browserStore()): boolean {
  return read(TOUR_KEY, store) === 'si';
}

export function markTourDone(store = browserStore()): void {
  write(TOUR_KEY, 'si', store);
}

/** Testo del file esportato: lo stesso formato del salvataggio, leggibile. */
export function exportText(state: GameState): string {
  return `${JSON.stringify(toSaved(state), null, 2)}\n`;
}

export const exportFileName = (state: GameState): string => `taranto2127-seme-${state.seed}-anno-${2027 + state.turn}.json`;

/** Legge un salvataggio da testo (file, archivio del browser). null se non è una partita di TARANTO2127. */
export function parseSaved(text: string | null): SavedGame | null {
  if (text === null) return null;
  try {
    const saved = JSON.parse(text) as Partial<SavedGame>;
    const ok =
      saved.formato === 'taranto2127-partita' &&
      saved.versione === 1 &&
      Number.isInteger(saved.seme) &&
      Number.isInteger(saved.turno) &&
      Array.isArray(saved.storia);
    return ok ? (saved as SavedGame) : null;
  } catch {
    return null;
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
    return parseSaved(decodeURIComponent(match[1]!));
  } catch {
    return null;
  }
}

/** Seme per una partita nuova. Il caso dell'interfaccia non entra mai nel motore: il motore riceve solo il seme. */
export const freshSeed = (): number => Date.now() % 1_000_000;

/** Esito dell'avvio: la partita, l'avviso da mostrare e se c'è una partita vecchia conservata da parte. */
export interface Avvio {
  game: Game;
  avviso: string | null;
  vecchia: boolean;
}

/**
 * Avvio a prova di dati vecchi (T12d, la causa della pagina bianca): se la partita del
 * link o quella salvata nel browser non si può riaprire, non si apre; si conserva da
 * parte, si avvisa il giocatore e parte una partita nuova. Mai un'eccezione verso React.
 */
export function avvioSicuro(location: { hash: string; search: string }, store = browserStore()): Avvio {
  const seedParam = new URLSearchParams(location.search).get('seme');
  const semeNuovo = () => (seedParam !== null && /^\d+$/.test(seedParam) ? Number(seedParam) : freshSeed());
  const nonApribile = (saved: SavedGame | null): Avvio => {
    if (saved !== null) conservaPartitaVecchia(saved, store);
    return { game: newGame(semeNuovo()), avviso: AVVISO_PARTITA_VECCHIA, vecchia: saved !== null };
  };
  try {
    const fromHash = savedFromHash(location.hash);
    if (fromHash !== null) {
      try {
        return { game: apriPartita(fromHash), avviso: null, vecchia: false };
      } catch {
        return nonApribile(fromHash);
      }
    }
    const local = loadLocal(store);
    if (local !== null && (seedParam === null || Number(seedParam) === local.seme)) {
      try {
        return { game: apriPartita(local), avviso: null, vecchia: false };
      } catch {
        // Il salvataggio automatico lo sovrascriverebbe: prima lo si mette da parte.
        const esito = nonApribile(local);
        clearLocal(store);
        return esito;
      }
    }
    return { game: newGame(semeNuovo()), avviso: null, vecchia: partitaVecchia(store) !== null };
  } catch {
    return nonApribile(null);
  }
}

/** La partita da aprire: dal link, poi dal browser, poi dal seme dell'indirizzo, altrimenti una nuova. */
export function startingGame(location: { hash: string; search: string }): Game {
  const fromHash = savedFromHash(location.hash);
  if (fromHash !== null) return restoreGame(fromHash);
  const seedParam = new URLSearchParams(location.search).get('seme');
  const local = loadLocal();
  if (local !== null && (seedParam === null || Number(seedParam) === local.seme)) return restoreGame(local);
  const seed = seedParam !== null && /^\d+$/.test(seedParam) ? Number(seedParam) : freshSeed();
  return newGame(seed);
}
