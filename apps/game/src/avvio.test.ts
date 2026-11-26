/**
 * Mai più pagina bianca (T12d): l'avvio a prova di dati vecchi, la versione nei
 * salvataggi e i sostituti delle funzioni recenti.
 *
 * La causa trovata dall'architetto: una partita salvata con una versione precedente
 * contiene la risposta a un dilemma che oggi, con lo stesso seme, non è aperto; rigiocarla
 * lanciava «nessun dilemma aperto» dentro React e la pagina restava bianca.
 */
import { describe, expect, it } from 'vitest';
import { RECENTI, SOSTITUITE } from './bersaglio.js';
import { copiaProfonda, installaSostituti } from './compat.js';
import {
  AVVISO_PARTITA_VECCHIA,
  PartitaNonApribile,
  VERSIONE_DATI,
  apriPartita,
  avvioSicuro,
  closeYear,
  newGame,
  partitaVecchia,
  toSaved,
  type SavedGame,
} from './engine.js';

/** La partita della scheda T12d: una risposta a un dilemma che oggi non è aperto. */
const VECCHIA: SavedGame = {
  formato: 'taranto2127-partita',
  versione: 1,
  seme: 42,
  turno: 1,
  storia: [{ turn: 0, action: { kind: 'answer-dilemma', dilemmaId: 'dilemma-di-una-versione-vecchia', optionId: 'a' } }] as SavedGame['storia'],
};

/** Un archivio del browser finto, in memoria. */
function archivio(iniziale: Record<string, string> = {}) {
  const dati = new Map(Object.entries(iniziale));
  return {
    dati,
    getItem: (k: string) => dati.get(k) ?? null,
    setItem: (k: string, v: string) => void dati.set(k, v),
    removeItem: (k: string) => void dati.delete(k),
  };
}

describe('avvio a prova di dati vecchi', () => {
  it('la partita della scheda non si riapre: errore riconosciuto, non un\'eccezione qualsiasi', () => {
    expect(() => apriPartita(VECCHIA)).toThrow(PartitaNonApribile);
  });

  it('nel browser: parte una partita nuova con l\'avviso, la vecchia è conservata da parte', () => {
    const a = archivio({ 'taranto2127:partita': JSON.stringify(VECCHIA) });
    const esito = avvioSicuro({ hash: '', search: '' }, a);
    expect(esito.avviso).toBe(AVVISO_PARTITA_VECCHIA);
    expect(esito.vecchia).toBe(true);
    expect(esito.game.state.turn).toBe(0);
    expect(esito.game.state.history).toHaveLength(0);
    // Tolta dal salvataggio automatico (che la sovrascriverebbe), conservata da parte.
    expect(a.dati.has('taranto2127:partita')).toBe(false);
    expect(partitaVecchia(a)).toEqual(VECCHIA);
  });

  it('nel link: stessa cosa', () => {
    const a = archivio();
    const esito = avvioSicuro({ hash: `#partita=${encodeURIComponent(JSON.stringify(VECCHIA))}`, search: '' }, a);
    expect(esito.avviso).toBe(AVVISO_PARTITA_VECCHIA);
    expect(esito.game.state.turn).toBe(0);
    expect(partitaVecchia(a)).toEqual(VECCHIA);
  });

  it('con un seme nell\'indirizzo, la partita nuova usa quel seme', () => {
    const a = archivio({ 'taranto2127:partita': JSON.stringify(VECCHIA) });
    expect(avvioSicuro({ hash: '', search: '?seme=42' }, a).game.state.seed).toBe(42);
  });

  it('una partita buona si riapre, senza avviso', () => {
    let game = newGame(7);
    game = closeYear(game).game;
    game = closeYear(game).game;
    const a = archivio({ 'taranto2127:partita': JSON.stringify(toSaved(game.state)) });
    const esito = avvioSicuro({ hash: '', search: '' }, a);
    expect(esito.avviso).toBeNull();
    expect(esito.game.state.turn).toBe(2);
    expect(esito.game.state.seed).toBe(7);
  });

  it('il salvataggio registra le versioni del gioco e dei dati', () => {
    const s = toSaved(newGame(3).state);
    expect(s.versioneDati).toBe(VERSIONE_DATI);
    expect(s.versioneDati).toMatch(/^[0-9a-f]{8}$/);
    expect(typeof s.versioneGioco).toBe('string');
  });

  it('con dati di gioco diversi la partita non si rigioca nemmeno: incompatibilità riconosciuta prima', () => {
    const buona = toSaved(closeYear(newGame(5)).game.state);
    expect(() => apriPartita(buona)).not.toThrow();
    expect(() => apriPartita({ ...buona, versioneDati: '00000000' })).toThrow(/dati 00000000/);
  });
});

describe('sostituti delle funzioni recenti', () => {
  it('su un browser senza structuredClone, Object.hasOwn e .at() si installano e funzionano', () => {
    const finto = {} as typeof globalThis;
    const protoAt = Object.getOwnPropertyDescriptor(Array.prototype, 'at')!;
    const strAt = Object.getOwnPropertyDescriptor(String.prototype, 'at')!;
    const hasOwn = Object.getOwnPropertyDescriptor(Object, 'hasOwn')!;
    try {
      delete (Array.prototype as { at?: unknown }).at;
      delete (String.prototype as { at?: unknown }).at;
      delete (Object as { hasOwn?: unknown }).hasOwn;
      const installati = installaSostituti(finto);
      expect(installati).toEqual(expect.arrayContaining(['structuredClone', 'Object.hasOwn', 'Array.prototype.at', 'String.prototype.at']));
      expect([1, 2, 3].at(-1)).toBe(3);
      expect([1, 2, 3].at(5)).toBeUndefined();
      expect('abc'.at(-2)).toBe('b');
      expect(Object.hasOwn({ a: 1 }, 'a')).toBe(true);
      expect(Object.hasOwn({ a: 1 }, 'toString')).toBe(false);
      const clona = (finto as unknown as { structuredClone: <T>(v: T) => T }).structuredClone;
      const o = { a: [1, { b: new Date(5) }], m: new Map([['k', new Set([1])]]) };
      const c = clona(o);
      expect(c).toEqual(o);
      expect(c.a).not.toBe(o.a);
    } finally {
      Object.defineProperty(Array.prototype, 'at', protoAt);
      Object.defineProperty(String.prototype, 'at', strAt);
      Object.defineProperty(Object, 'hasOwn', hasOwn);
    }
  });

  it('la copia profonda dà lo stesso risultato di structuredClone sullo stato del gioco', () => {
    const s = closeYear(newGame(11)).game.state;
    expect(copiaProfonda(s)).toEqual(structuredClone(s));
  });

  it('le funzioni sostituite sono tra quelle recenti controllate nella pagina compilata', () => {
    const nomi = RECENTI.map((r) => r.nome);
    for (const n of SOSTITUITE) expect(nomi).toContain(n);
  });
});
