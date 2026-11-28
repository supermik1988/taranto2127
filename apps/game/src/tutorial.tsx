/**
 * Partita guidata (T16): i primi cinque anni con una guida che mostra un comando alla
 * volta. Testi e passi vengono da packages/content (tutorial.json).
 *
 * - Ogni passo evidenzia un comando (il primo dell'elenco `evidenzia` che è sullo schermo
 *   e non è coperto da altro), scurisce il resto e va avanti solo quando il giocatore ha
 *   fatto l'azione (`attesa`), mai a tempo.
 * - Il tutorial legge lo stato e l'interfaccia, non fa azioni al posto del giocatore.
 * - Il fumetto non copre mai il comando evidenziato; il fuoco da tastiera va sul comando;
 *   il testo è letto dai lettori di schermo; niente animazioni.
 * - «Esci dal tutorial» in ogni passo; si riprende da «?» dal punto in cui si era.
 */
import type { GameState } from '@taranto2127/sim';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { content } from './engine.js';
import { useTipAperto } from './guide.js';

export const tutorial = content.tutorial;
type Passo = (typeof tutorial.passi)[number];

const SCELTA_KEY = 'taranto2127:scelta-partita';
const PROGRESSO_KEY = 'taranto2127:tutorial';

/** Dove è arrivata la partita guidata: passo, se è in corso, se è finita. */
export interface Progresso {
  passo: number;
  attivo: boolean;
  finito: boolean;
}

function leggi(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function scrivi(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // archivio non disponibile: vale per questa visita
  }
}

/** La scelta fatta all'avvio («guidata» o «libera»), se c'è. */
export const sceltaFatta = (): string | null => leggi(SCELTA_KEY);
export const salvaScelta = (s: 'guidata' | 'libera'): void => scrivi(SCELTA_KEY, s);

export function leggiProgresso(): Progresso | null {
  const raw = leggi(PROGRESSO_KEY);
  if (raw === null) return null;
  try {
    const p = JSON.parse(raw) as Partial<Progresso>;
    if (typeof p.passo !== 'number' || p.passo < 0 || p.passo >= tutorial.passi.length) return null;
    return { passo: p.passo, attivo: p.attivo === true, finito: p.finito === true };
  } catch {
    return null;
  }
}

export const salvaProgresso = (p: Progresso): void => scrivi(PROGRESSO_KEY, JSON.stringify(p));

/** Ciò che il tutorial guarda per sapere se l'azione di un passo è stata fatta. */
export interface Contesto {
  state: GameState;
  panel: string | null;
  layer: string | null;
  selected: { kind: 'district' | 'lot'; id: string } | null;
  paperOpen: boolean;
  /** Il termine di cui è aperta la spiegazione, o null (lo aggiunge il tutorial stesso). */
  tip?: string | null;
  /** I termini di cui, durante questo passo, si è aperta la spiegazione. */
  tipVisti?: ReadonlySet<string>;
}

/** Il comando con questo data-testid, se c'è nella pagina. */
const trova = (testid: string): HTMLElement | null =>
  typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-testid="${testid}"]`);

/** L'azione del passo è stata fatta? */
export function fatto(passo: Passo, c: Contesto): boolean {
  const a = passo.attesa;
  switch (a.tipo) {
    case 'pannello':
      return c.panel === a.pannello;
    case 'strato':
      return c.layer !== null;
    case 'finestra-chiusa':
      return c.panel === null && c.selected === null;
    case 'lotto-aperto':
      return c.selected?.kind === 'lot';
    case 'cantiere-avviato':
      return c.state.plantLots.some((l) => l.path !== 'idle');
    case 'anno':
      return c.state.turn >= a.anno;
    case 'cronaca':
      return c.paperOpen;
    case 'dilemma-aperto':
      return c.state.openDilemmaId !== null || c.state.history.some((h) => h.action.kind === 'answer-dilemma');
    case 'dilemma-risposto':
      return c.state.history.some((h) => h.action.kind === 'answer-dilemma');
    case 'spiegazione-letta':
      // Aperta e poi chiusa con «Ok»: così ai passi dopo la spiegazione non resta sullo schermo.
      return (c.tipVisti?.has(a.termine) ?? false) && (c.tip ?? null) === null;
    case 'fine':
      return false;
  }
}

/**
 * Il primo comando dell'elenco che è sullo schermo e non è coperto da altro. Il fumetto non
 * conta: durante il controllo non riceve il tocco, così la scelta non dipende da dove sta
 * (altrimenti il fumetto, spostandosi, farebbe cambiare il bersaglio, e il bersaglio il fumetto).
 */
export function bersaglio(passo: Passo, fumetto: HTMLElement | null): { el: HTMLElement; testid: string } | null {
  const prima = fumetto?.style.pointerEvents ?? '';
  if (fumetto !== null) fumetto.style.pointerEvents = 'none';
  try {
    return cerca(passo);
  } finally {
    if (fumetto !== null) fumetto.style.pointerEvents = prima;
  }
}

function cerca(passo: Passo): { el: HTMLElement; testid: string } | null {
  for (const testid of passo.evidenzia) {
    const el = trova(testid);
    if (el === null) continue;
    let r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    // Fuori dallo schermo (per esempio in fondo a una finestra che scorre): lo si porta in vista, poi si decide.
    if (r.top < 0 || r.bottom > window.innerHeight) {
      el.scrollIntoView({ block: 'nearest' });
      r = el.getBoundingClientRect();
    }
    const x = Math.min(window.innerWidth - 1, Math.max(0, r.left + r.width / 2));
    const y = Math.min(window.innerHeight - 1, Math.max(0, r.top + r.height / 2));
    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) continue;
    const sopra = document.elementFromPoint(x, y);
    if (sopra !== null && (el.contains(sopra) || sopra.contains(el))) return { el, testid };
  }
  return null;
}

/** La scelta all'avvio: partita guidata o libera. */
export function SceltaPartita({ onScegli }: { onScegli: (s: 'guidata' | 'libera') => void }) {
  const primo = useRef<HTMLButtonElement>(null);
  useEffect(() => primo.current?.focus(), []);
  const s = tutorial.scelta;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="scelta-titolo" data-testid="scelta-partita">
      <div className="sheet scelta">
        <h2 id="scelta-titolo">{s.titolo}</h2>
        <p>{s.testo}</p>
        <div className="buttons column">
          <button ref={primo} type="button" className="primary" onClick={() => onScegli('guidata')} data-testid="scelta-guidata">
            {s.guidata}
          </button>
          <button type="button" onClick={() => onScegli('libera')} data-testid="scelta-libera">
            {s.libera}
          </button>
        </div>
      </div>
    </div>
  );
}

const MARGINE = 10;
/** Pulsanti di chiusura: se il passo deve evidenziare uno di questi al posto del suo comando, lo dice. */
const CHIUSURE = new Set(['finestra-chiudi', 'spiegazione-chiudi', 'continua']);

/** Un passo della partita guidata: evidenza sul comando, fumetto con il testo, uscita. */
export function Tutorial({ indice, contesto, onAvanti, onEsci, onFine }: { indice: number; contesto: Contesto; onAvanti: (da: number) => void; onEsci: () => void; onFine: () => void }) {
  const passo = tutorial.passi[indice]!;
  const ultimo = indice === tutorial.passi.length - 1;
  const fumetto = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number; testid: string } | null>(null);
  const [pos, setPos] = useState<{ top: number; maxHeight: number } | null>(null);
  /** Posto per il fumetto dentro una finestra (il dilemma): lì il fumetto scorre con il contenuto e non copre nulla. */
  const [spazio, setSpazio] = useState<HTMLElement | null>(null);
  const tip = useTipAperto();
  // Le spiegazioni aperte durante questo passo (si ricomincia a ogni passo).
  const visti = useRef<{ indice: number; termini: Set<string> }>({ indice, termini: new Set() });
  if (visti.current.indice !== indice) visti.current = { indice, termini: new Set() };
  if (tip !== null) visti.current.termini.add(tip);
  const contestoRef = useRef<Contesto>(contesto);
  contestoRef.current = { ...contesto, tip, tipVisti: visti.current.termini };
  const fuoco = useRef<HTMLElement | null>(null);

  // Il passo va avanti quando l'azione è fatta: si controlla a ogni cambio e, per ciò che sta solo nella pagina, ogni 300 ms.
  // L'avanzamento porta con sé il passo da cui parte: un controllo rimasto indietro non fa saltare il passo dopo.
  const controlla = useCallback(() => {
    if (fatto(passo, contestoRef.current)) onAvanti(indice);
  }, [passo, indice, onAvanti]);
  useEffect(controlla, [contesto, tip, controlla]);

  // Dove sta il comando evidenziato, e dove mettere il fumetto perché non lo copra.
  const misura = useCallback(() => {
    const b = bersaglio(passo, fumetto.current);
    if (b === null) {
      setRect(null);
      setPos(null);
      return;
    }
    // Se il comando sta in una finestra con un posto per il fumetto, il fumetto va lì.
    const posto = b.el.closest('[data-testid="dilemma"]')?.querySelector<HTMLElement>('[data-testid="spazio-tutorial"]') ?? null;
    setSpazio(posto);
    const r = b.el.getBoundingClientRect();
    setRect((prima) => (prima !== null && prima.testid === b.testid && Math.abs(prima.x - r.left) < 0.5 && Math.abs(prima.y - r.top) < 0.5 && Math.abs(prima.w - r.width) < 0.5 && Math.abs(prima.h - r.height) < 0.5 ? prima : { x: r.left, y: r.top, w: r.width, h: r.height, testid: b.testid }));
    const sopra = r.top - MARGINE * 2;
    const sotto = window.innerHeight - r.bottom - MARGINE * 2;
    const pieno = fumetto.current?.scrollHeight ?? 120;
    // Sotto il comando se il fumetto ci sta per intero (di solito lì c'è spazio libero), poi sopra, poi dalla parte più larga.
    const giu = pieno <= sotto || (pieno > sopra && sotto >= sopra);
    const alto = Math.min(pieno, giu ? sotto : sopra);
    const top = giu ? r.bottom + MARGINE : Math.max(MARGINE, r.top - MARGINE - alto);
    const massimo = giu ? sotto : sopra;
    setPos((prima) => (prima !== null && Math.abs(prima.top - top) < 0.5 && Math.abs(prima.maxHeight - massimo) < 0.5 ? prima : { top, maxHeight: massimo }));
    // Il fuoco da tastiera va sul comando, una volta per comando.
    if (fuoco.current !== b.el) {
      fuoco.current = b.el;
      b.el.scrollIntoView({ block: 'nearest' });
      b.el.focus({ preventScroll: true });
    }
  }, [passo]);
  // Misura subito a ogni passo nuovo; poi la segue il controllo periodico (mai una misura dopo ogni disegno).
  useLayoutEffect(() => misura(), [misura]);
  useEffect(() => {
    const id = window.setInterval(() => {
      controlla();
      misura();
    }, 300);
    window.addEventListener('resize', misura);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', misura);
    };
  }, [controlla, misura]);

  const contenuto = (
    <>
      <div className="tutorial-testa">
        <p className="kicker">
          Partita guidata · passo {indice + 1} di {tutorial.passi.length}
        </p>
        <button type="button" className="tutorial-esci" onClick={onEsci} data-testid="tutorial-esci">
          Esci dal tutorial
        </button>
      </div>
      {rect !== null && CHIUSURE.has(rect.testid) && passo.evidenzia[0] !== rect.testid && (
        <p className="tutorial-testo tutorial-prima" data-testid="tutorial-prima-chiudi">
          {tutorial.primaChiudi}
        </p>
      )}
      <p className="tutorial-testo">{passo.testo}</p>
      {passo.attesa.tipo === 'spiegazione-letta' && rect?.testid === 'spiegazione-chiudi' && (
        <p className="tutorial-testo" data-testid="tutorial-poi">
          {passo.attesa.poi}
        </p>
      )}
      {ultimo && (
        <div className="buttons">
          <button type="button" className="primary" onClick={onFine} data-testid="tutorial-fine">
            Fine
          </button>
        </div>
      )}
    </>
  );
  const attributi = {
    ref: fumetto,
    role: 'dialog',
    'aria-modal': false,
    'aria-label': 'Partita guidata',
    'aria-live': 'polite' as const,
    'data-testid': 'tutorial',
    'data-passo': passo.id,
    'data-bersaglio': rect?.testid ?? '',
  };

  return (
    <>
      {rect !== null && (
        <div
          className={spazio !== null ? 'tutorial-evidenza senza-ombra' : 'tutorial-evidenza'}
          data-testid="tutorial-evidenza"
          aria-hidden="true"
          style={{ left: rect.x - 4, top: rect.y - 4, width: rect.w + 8, height: rect.h + 8 }}
        />
      )}
      {spazio !== null
        ? createPortal(
            <div {...attributi} className="tutorial-fumetto tutorial-in-finestra">
              {contenuto}
            </div>,
            spazio,
          )
        : (
          <div {...attributi} className="tutorial-fumetto" style={pos === null ? { bottom: MARGINE } : { top: pos.top, maxHeight: pos.maxHeight }}>
            {contenuto}
          </div>
        )}
    </>
  );
}
