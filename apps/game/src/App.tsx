/**
 * L'applicazione. Lo stato di gioco (`game`) cambia solo attraverso
 * applyAction e advanceTurn (in engine.ts); tutto il resto è stato
 * dell'interfaccia: tempo che scorre, scheda aperta, finestre, visita guidata.
 */
import {
  ActionError,
  TOTAL_EPOCHS,
  applyAction,
  epochOfTurn,
  forecastYear,
  officeCapacity,
  yearOfTurn,
  type Action,
  type DistrictId,
  type GameState,
  type StopReason,
} from '@taranto2127/sim';
import { fmt } from '@taranto2127/play/describe';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { guastoDiProva, segnaAvvio } from './errori.js';
import { BudgetView, fundName } from './budget.js';
import {
  ConfirmSheet,
  CouncilView,
  CronacaPaper,
  CronacaStrip,
  DilemmaCard,
  DistrictCard,
  LotCard,
  PoliciesView,
  Portrait,
  ProjectsView,
} from './cards.js';
import { ChartsView } from './charts.js';
import {
  act,
  closeYear,
  content,
  freshSeed,
  gameLink,
  lastLocalSave,
  markTourDone,
  newGame,
  AVVISO_PARTITA_VECCHIA,
  PartitaNonApribile,
  apriPartita,
  cancellaPartitaVecchia,
  saveLocal,
  avvioSicuro,
  tourDone,
  type Game,
  type SavedGame,
} from './engine.js';
import { HelpSheet, Term, TipProvider, Tour, fill } from './guide.js';
import { SceltaPartita, Tutorial, leggiProgresso, salvaProgresso, salvaScelta, sceltaFatta, tutorial, type Progresso } from './tutorial.js';
import type { Livello, Scelta } from './iso/livelli.js';
import { LayersPanel, MapList, MapStage, MapWindow, chooseMapMode, readStoredDetail, readStoredMode, storeDetail, storeMode, webglAvailable, type MapMode } from './layout.js';
import type { MapIndicator } from './map.js';
import { GameMenu } from './menu.js';

/** I pannelli che si aprono dai pulsanti sul lato della mappa. */
type Panel = 'consiglio' | 'cantieri' | 'bilancio' | 'grafici' | 'politiche' | 'strati' | 'elenco';
const PANELS: [Panel, string][] = [
  ['consiglio', 'Consiglio'],
  ['cantieri', 'Cantieri'],
  ['bilancio', 'Bilancio'],
  ['grafici', 'Grafici'],
  ['politiche', 'Politiche'],
  ['strati', 'Strati'],
  ['elenco', 'Elenco'],
];
const PHASE_NAMES: Record<string, string> = {
  design: 'progettazione',
  permitting: 'autorizzazioni',
  tender: 'gara',
  works: 'lavori',
  operating: 'esercizio',
  cancelled: 'annullato',
};
const time = content.guide.time;
const stopsText = content.guide.stops;

/**
 * I motivi per cui il tempo si è fermato, una frase ciascuno, dal più
 * importante (l'ordine è quello di stopReasons nel motore).
 */
export function stopLines(reasons: StopReason[], state: GameState): string[] {
  const parts = reasons.map((r) => {
    switch (r.kind) {
      case 'dilemma':
        return fill(stopsText['dilemma']!, { titolo: content.texts.dilemmas[r.dilemmaId]?.titolo ?? r.dilemmaId });
      case 'phase-end': {
        const project = state.projects.find((p) => p.id === r.projectId);
        const lot = project?.lotId === undefined ? '' : ` (${content.texts.plantLots[project.lotId]?.nome ?? ''})`;
        const name = `${content.texts.projects[r.definitionId]?.nome ?? r.definitionId}${lot}`;
        return r.to === 'operating'
          ? fill(stopsText['operating']!, { progetto: name })
          : fill(stopsText['phase-end']!, { progetto: name, da: PHASE_NAMES[r.from] ?? r.from, a: PHASE_NAMES[r.to] ?? r.to });
      }
      case 'promise-due': {
        const promise = state.promises.find((p) => p.id === r.promiseId);
        return fill(stopsText['promise-due']!, { testo: promise?.text ?? '', esito: stopsText.esiti[r.status] });
      }
      case 'epoch':
        return fill(stopsText['epoch']!, { epoca: r.epoch + 1, totale: TOTAL_EPOCHS });
      default:
        return stopsText[r.kind]!;
    }
  });
  return parts.map((part) => part.charAt(0).toLocaleUpperCase('it-IT') + part.slice(1));
}

/** Tutti i motivi in una riga sola. */
export function describeStops(reasons: StopReason[], state: GameState): string {
  return `${stopsText['prefisso']} ${stopLines(reasons, state).join(' ')}`;
}

/** La riga della fermata: il motivo principale e «e altri N»; al tocco, l'elenco completo. */
export function StopLine({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  const [first, ...others] = lines;
  return (
    <div className="stop" role="status" data-testid="fermata">
      <span>
        {stopsText['prefisso']} {others.length > 0 && !open ? first?.replace(/\.$/, '') : first}
        {others.length > 0 && !open && (
          <>
            {' '}
            <button type="button" className="term" onClick={() => setOpen(true)} data-testid="fermata-altri">
              e {others.length === 1 ? 'un altro motivo' : `altri ${others.length}`}
            </button>
            .
          </>
        )}
      </span>
      {open && (
        <ul className="stop-list" data-testid="fermata-elenco">
          {others.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      )}
    </div>
  );
}

function MoralBar({ label, term, value }: { label: string; term: string; value: number }) {
  const pos = ((value + 100) / 200) * 100;
  return (
    <div className="moral" aria-label={`${label}: ${value.toFixed(1)} da -100 (Red) a +100 (Blu)`}>
      <span className="moral-label">
        <Term id={term}>{label}</Term>
      </span>
      <span className="red">Red</span>
      <span className="track">
        <span className="center" />
        <span className="marker" style={{ left: `${pos}%` }} />
      </span>
      <span className="blue">Blu</span>
      <span className="moral-value">{value > 0 ? '+' : ''}{value.toLocaleString('it-IT', { maximumFractionDigits: 1 })}</span>
    </div>
  );
}

function TopBar({ state, onHelp, onMenu, onBudget }: { state: GameState; onHelp: () => void; onMenu: () => void; onBudget: () => void }) {
  const f = state.economy.funds;
  const capacity = useMemo(() => officeCapacity(state, content.rules), [state]);
  const m = (v: number) => Math.round(v).toLocaleString('it-IT');
  return (
    <header className="topbar" data-testid="barra" data-tour="barra">
      <div className="top-row">
        <div className="when">
          <strong data-testid="anno">{yearOfTurn(state.turn)}</strong>
          <span>
            {' '}· <Term id="epoca">epoca</Term> {epochOfTurn(Math.min(state.turn, 99)) + 1} di {TOTAL_EPOCHS}
          </span>
        </div>
        <div className="top-buttons">
          <button type="button" className="round" onClick={onHelp} aria-label="Aiuto e visita guidata" data-testid="aiuto">?</button>
          <button type="button" onClick={onMenu} data-testid="menu">Partita</button>
        </div>
      </div>
      <button type="button" className="funds" onClick={onBudget} data-testid="fondi" aria-label="Apri il bilancio">
        <span className={f.own < 0 ? 'negative' : ''}>{fundName('own')} {m(f.own)}</span>
        <span>Stato {m(f.state)}</span>
        <span>Europa {m(f['eu-earmarked'])} M€</span>
      </button>
      <div className="capacity" data-testid="capacita">
        <Term id="capacita-uffici">Capacità degli uffici</Term>: {fmt(capacity.free, 1)} di {fmt(capacity.total, 1)} M€ libera quest'anno
      </div>
      <div className="morals" data-tour="morale">
        <MoralBar label="Coscienza" term="coscienza" value={state.moral.conscience} />
        <MoralBar label="Reputazione" term="reputazione" value={state.moral.reputation} />
      </div>
    </header>
  );
}

/** Comandi del tempo, in basso, a portata di pollice. */
function TimeBar({
  running,
  speed,
  canAdvance,
  stop,
  onToggle,
  onSpeed,
  onStep,
}: {
  running: boolean;
  speed: number;
  canAdvance: boolean;
  stop: string[] | null;
  onToggle: () => void;
  onSpeed: (speed: number) => void;
  onStep: () => void;
}) {
  return (
    <div className="timebar" data-testid="tempo" data-tour="tempo">
      {stop !== null && (
        <StopLine key={stop.join('|')} lines={stop} />
      )}
      <div className="time-controls">
        <button type="button" className="primary play" onClick={onToggle} disabled={!canAdvance && !running} aria-pressed={running} data-testid={running ? 'pausa' : 'avvia'}>
          {running ? `❚❚ ${time.pausa}` : `▶ ${time.avvia}`}
        </button>
        <div className="speeds" role="group" aria-label="Velocità del tempo">
          {time.velocita.map((label, i) => (
            <button key={label} type="button" className={i === speed ? 'speed on' : 'speed'} aria-pressed={i === speed} aria-label={label} title={label} onClick={() => onSpeed(i)} data-testid={`velocita-${i + 1}`}>
              {i + 1}×
            </button>
          ))}
        </div>
        {!running && (
          <button type="button" className="step" onClick={onStep} disabled={!canAdvance} data-testid="un-anno">
            {time.unAnno}
          </button>
        )}
      </div>
    </div>
  );
}

interface Pending {
  action: Action;
  title: string;
  lines: string[];
}

export function App() {
  // Avvio a prova di dati vecchi (T12d): un salvataggio che non si apre più si ignora con un avviso.
  const [avvio] = useState(() => {
    if (guastoDiProva() === 'avvio') throw new Error('guasto di prova all’avvio');
    return avvioSicuro(window.location);
  });
  const [game, setGame] = useState<Game>(avvio.game);
  // Il gioco è partito: la sentinella di index.html non deve più intervenire.
  useLayoutEffect(() => segnaAvvio(), []);
  const initial = useMemo(() => newGame(game.state.seed).state, [game.state.seed]);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [layer, setLayer] = useState<MapIndicator | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>(() => chooseMapMode(window.location.search, readStoredMode(), webglAvailable()));
  const [detail, setDetail] = useState<Scelta>(() => readStoredDetail());
  const [detailNow, setDetailNow] = useState<Livello | null>(null);
  const [selected, setSelected] = useState<{ kind: 'district' | 'lot'; id: string } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [cronaca, setCronaca] = useState<{ year: number; headlines: string[] } | null>(null);
  const [paperOpen, setPaperOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(avvio.avviso === null ? null : `${avvio.avviso}.`);
  /** C'è una partita vecchia conservata da parte: l'avviso offre di cancellarla (T12d). */
  const [vecchia, setVecchia] = useState(avvio.avviso !== null && avvio.vecchia);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  /** Motivi dell'ultima fermata, con il loro tipo: rispondendo al dilemma restano gli altri. */
  const [stop, setStop] = useState<{ kind: StopReason['kind']; line: string }[] | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(() => lastLocalSave());
  // T16: la visita guidata non si apre più da sola; chi arriva per la prima volta sceglie tra partita guidata e libera.
  const [tour, setTour] = useState(false);
  const [scelta, setScelta] = useState(
    () => sceltaFatta() === null && !tourDone() && avvio.avviso === null && avvio.game.state.turn === 0 && avvio.game.state.history.length === 0 && !window.location.hash.startsWith('#partita='),
  );
  const [guida, setGuida] = useState<Progresso | null>(() => {
    const p = leggiProgresso();
    return p !== null && p.attivo && !p.finito ? p : null;
  });
  const [help, setHelp] = useState(false);
  const [menu, setMenu] = useState(false);

  // Altezza della barra in alto: pulsanti, finestre e mappa schematica stanno sotto di essa.
  const hudRef = useRef<HTMLDivElement>(null);
  const [hudHeight, setHudHeight] = useState(150);
  useEffect(() => {
    const el = hudRef.current;
    if (el === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setHudHeight(Math.ceil(el.getBoundingClientRect().height)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const state = game.state;
  const ended = state.status !== 'running';
  const dilemmaOpen = !ended && state.openDilemmaId !== null;

  // Salvataggio automatico: a ogni cambiamento dello stato di gioco, come seme più storia.
  useEffect(() => {
    const at = saveLocal(game.state);
    if (at !== null) setLastSaved(at);
  }, [game.state]);
  // Il link con la partita è servito: lo si toglie dall'indirizzo, la partita resta nel browser.
  useEffect(() => {
    if (window.location.hash.startsWith('#partita=')) history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  /** Chiude un anno; se succede qualcosa che merita attenzione, il tempo si ferma e dice perché. */
  const advanceOne = useCallback(
    (current: Game): boolean => {
      if (current.state.status !== 'running' || current.state.openDilemmaId !== null) return false;
      const result = closeYear(current);
      setGame(result.game);
      setCronaca({ year: result.year, headlines: result.headlines });
      setNotice(null);
      if (result.stops.length > 0) {
        const lines = stopLines(result.stops, result.game.state);
        setStop(result.stops.map((r, i) => ({ kind: r.kind, line: lines[i]! })));
        return false;
      }
      setStop(null);
      return true;
    },
    [],
  );

  // Il tempo che scorre: un anno ogni tanti secondi, secondo la velocità. Si trattiene mentre una finestra è aperta.
  const holding = pending !== null || paperOpen || help || menu || tour;
  useEffect(() => {
    if (!running || holding) return;
    if (ended || dilemmaOpen) {
      setRunning(false);
      return;
    }
    const timer = setTimeout(() => {
      if (!advanceOne(game)) setRunning(false);
    }, (time.secondiPerAnno[speed] ?? 1) * 1000);
    return () => clearTimeout(timer);
  }, [running, holding, speed, game, ended, dilemmaOpen, advanceOne]);

  const request = (action: Action, title: string, lines: string[]) => {
    // Prima della conferma: se il nuovo cantiere troverà gli uffici saturi, lo si dice.
    const extra: string[] = [];
    if (action.kind === 'start-project' || action.kind === 'convert-lot') {
      try {
        const before = forecastYear(state, content.rules);
        const after = forecastYear(applyAction(state, action, content.rules), content.rules);
        extra.push(`Capacità degli uffici libera quest'anno: ${fmt(before.capacity.free, 1)} M€.`);
        if (after.stalled.some((s) => s.reason === 'capacity' && !before.stalled.some((b) => b.projectId === s.projectId))) {
          extra.push('Gli uffici sono saturi: un cantiere resterà fermo quest\'anno e accumulerà ritardo.');
        }
      } catch {
        // Azione non ammessa: lo dirà il motore alla conferma.
      }
    }
    setPending({ action, title, lines: [...lines, ...extra] });
  };

  const perform = (action: Action) => {
    try {
      setGame(act(game, action));
      setPending(null);
      if (action.kind === 'shortcut-phase') setNotice('Questa era una scelta nascosta: i cittadini non lo sanno. Per ora.');
      else setNotice(null);
    } catch (error) {
      setPending(null);
      setNotice(error instanceof ActionError ? `Non si può: ${error.message}` : String(error));
    }
  };

  const answer = (optionId: string) => {
    const id = state.openDilemmaId!;
    const hidden = content.rules.dilemmas[id]!.options[optionId]!.hidden;
    setGame(act(game, { kind: 'answer-dilemma', dilemmaId: id, optionId }));
    setStop((current) => {
      const rest = current?.filter((s) => s.kind !== 'dilemma') ?? [];
      return rest.length > 0 ? rest : null;
    });
    setNotice(hidden ? 'Questa era una scelta nascosta: nessuno lo sa, per ora.' : null);
  };

  const resetUi = () => {
    setRunning(false);
    setStop(null);
    setCronaca(null);
    setSelected(null);
    setPending(null);
    setPanel(null);
  };

  const load = (saved: SavedGame, message: string) => {
    let aperta: Game;
    try {
      aperta = apriPartita(saved);
    } catch (e) {
      // Partita di una versione precedente (posto o file): non si apre, la partita in corso resta.
      if (!(e instanceof PartitaNonApribile)) throw e;
      setMenu(false);
      setNotice(`${AVVISO_PARTITA_VECCHIA}. La partita in corso resta aperta.`);
      return;
    }
    setGame(aperta);
    resetUi();
    setMenu(false);
    setNotice(message);
  };

  const startNew = () => {
    setGame(newGame(freshSeed()));
    resetUi();
    setMenu(false);
    setNotice('Nuova partita: il tempo è in pausa. Avvialo quando vuoi.');
  };

  // ---------- Partita guidata (T16) ----------
  const scegliPartita = (s: 'guidata' | 'libera') => {
    salvaScelta(s);
    markTourDone();
    setScelta(false);
    if (s === 'guidata') {
      // Il seme della partita guidata: gli eventi che il tutorial annuncia arrivano davvero (tutorial.json).
      setGame(newGame(tutorial.seme));
      resetUi();
      setRunning(false);
      setNotice(null);
      const p: Progresso = { passo: 0, attivo: true, finito: false };
      salvaProgresso(p);
      setGuida(p);
    } else {
      setNotice('Il tempo è in pausa: avvialo quando vuoi. La visita e la partita guidata sono nel pulsante «?».');
    }
  };
  const avantiGuida = useCallback((da: number) => {
    setGuida((g) => {
      // Si avanza solo dal passo che lo chiede: due controlli dello stesso passo non ne fanno saltare uno.
      if (g === null || g.passo !== da || g.passo >= tutorial.passi.length - 1) return g;
      const p: Progresso = { passo: g.passo + 1, attivo: true, finito: false };
      salvaProgresso(p);
      return p;
    });
  }, []);
  const esciGuida = () => {
    if (guida !== null) salvaProgresso({ ...guida, attivo: false });
    setGuida(null);
    setNotice('Partita guidata sospesa: la riprendi quando vuoi dal pulsante «?».');
  };
  const fineGuida = () => {
    salvaProgresso({ passo: tutorial.passi.length - 1, attivo: false, finito: true });
    setGuida(null);
    setNotice('Partita guidata finita. La partita continua: il tempo è in pausa.');
  };
  const progresso = leggiProgresso();
  const riprendibile = guida === null && progresso !== null && !progresso.finito;

  const endTour = (completed: boolean) => {
    markTourDone();
    setTour(false);
    setPanel(null);
    setNotice(completed ? 'Buona partita. Il tempo è in pausa: avvialo quando vuoi.' : 'Visita saltata. La riapri quando vuoi dal pulsante «?».');
  };

  // Durante la visita le finestre si chiudono: si vedono la mappa e i pulsanti indicati.
  const onTourStep = useCallback(() => {
    setPanel(null);
    setSelected(null);
  }, []);

  const openPanel = (p: Panel) => {
    setSelected(null);
    setPanel(panel === p ? null : p);
  };
  const select = (kind: 'district' | 'lot', id: string) => {
    setPanel(null);
    setSelected({ kind, id });
  };
  const changeMode = (mode: MapMode) => {
    storeMode(mode);
    setMapMode(mode);
    if (mode === 'schematica' && layer === null) setLayer('airQuality');
  };
  const fallback = useCallback((reason: string) => {
    setMapMode('schematica');
    setLayer((current) => current ?? 'airQuality');
    setNotice(`Mappa schematica: ${reason}.`);
  }, []);
  const closeWindow = () => {
    setPanel(null);
    setSelected(null);
  };
  const panelTitle = PANELS.find(([p]) => p === panel)?.[1] ?? '';

  const showDilemma = dilemmaOpen && pending === null && !tour;

  return (
    <TipProvider>
      <div className={ended ? 'app game ended-game' : 'app game'} style={{ '--hud-h': `${hudHeight}px` } as CSSProperties}>
        {!ended && (
          <MapStage
            mode={mapMode}
            state={state}
            layer={mapMode === 'schematica' ? (layer ?? 'airQuality') : layer}
            selected={selected?.id ?? null}
            detail={detail}
            onSelect={select}
            onFallback={fallback}
            onDetail={setDetailNow}
          />
        )}
        <div className="hud-top" ref={hudRef}>
          <TopBar state={state} onHelp={() => setHelp(true)} onMenu={() => setMenu(true)} onBudget={() => openPanel('bilancio')} />
          {notice !== null && (
            <p className="notice" role="status" data-testid="avviso">
              {notice}{' '}
              {vecchia && notice.startsWith(AVVISO_PARTITA_VECCHIA) && (
                <button
                  type="button"
                  data-testid="cancella-partita-vecchia"
                  onClick={() => {
                    cancellaPartitaVecchia();
                    setVecchia(false);
                    setNotice('Partita vecchia cancellata.');
                  }}
                >
                  Cancella la partita vecchia
                </button>
              )}{' '}
              <button type="button" onClick={() => setNotice(null)}>Ok</button>
            </p>
          )}
          {cronaca !== null && !ended && <CronacaStrip year={cronaca.year} headlines={cronaca.headlines} onOpen={() => setPaperOpen(true)} />}
        </div>
        {ended ? (
          <main className="ended">
            <Portrait initial={initial} state={state} link={gameLink(state, window.location.href)} onNew={startNew} />
            <footer className="footer">Seme {state.seed} · TARANTO2127 è un gioco: luoghi reali, persone e aziende inventate.</footer>
          </main>
        ) : (
          <>
            <nav className="rail" aria-label="Pannelli">
              {PANELS.map(([p, label]) => (
                <button
                  key={p}
                  type="button"
                  className={p === panel ? 'rail-button on' : 'rail-button'}
                  aria-pressed={p === panel}
                  onClick={() => openPanel(p)}
                  data-testid={`scheda-${p}`}
                  data-tour={`scheda-${p}`}
                >
                  {label}
                </button>
              ))}
            </nav>
            {panel !== null && (
              <MapWindow title={panelTitle} onClose={closeWindow} testId={`finestra-${panel}`}>
                {panel === 'cantieri' && <ProjectsView state={state} prev={game.prev} onRequest={request} />}
                {panel === 'bilancio' && <BudgetView state={state} prev={game.prev} />}
                {panel === 'grafici' && <ChartsView timeline={game.timeline} />}
                {panel === 'consiglio' && <CouncilView state={state} onRequest={request} />}
                {panel === 'politiche' && <PoliciesView state={state} onRequest={request} />}
                {panel === 'strati' && <LayersPanel
                    state={state}
                    layer={layer}
                    mode={mapMode}
                    detail={detail}
                    detailNow={detailNow}
                    onLayer={setLayer}
                    onMode={changeMode}
                    onDetail={(d) => {
                      setDetail(d);
                      storeDetail(d);
                    }}
                  />}
                {panel === 'elenco' && <MapList state={state} onSelect={select} />}
              </MapWindow>
            )}
            {selected !== null && (
              <MapWindow
                title={selected.kind === 'district' ? (content.texts.districts[selected.id]?.nome ?? '') : `Lotto: ${content.texts.plantLots[selected.id]?.nome ?? ''}`}
                onClose={closeWindow}
                testId={selected.kind === 'district' ? 'finestra-quartiere' : 'finestra-lotto'}
              >
                {selected.kind === 'district' ? (
                  <DistrictCard
                    key={selected.id}
                    state={state}
                    prev={game.prev}
                    id={selected.id as DistrictId}
                    initial={layer ?? 'airQuality'}
                    timeline={game.timeline}
                    onClose={closeWindow}
                  />
                ) : (
                  <LotCard state={state} lotId={selected.id} onRequest={request} onClose={closeWindow} />
                )}
              </MapWindow>
            )}
          </>
        )}
        {!ended && (
          <TimeBar
            running={running}
            speed={speed}
            canAdvance={!dilemmaOpen}
            stop={stop === null ? null : stop.map((s) => s.line)}
            onToggle={() => {
              if (!running) setStop(null);
              setRunning(!running);
            }}
            onSpeed={setSpeed}
            onStep={() => advanceOne(game)}
          />
        )}
        {pending !== null && (
          <ConfirmSheet title={pending.title} lines={pending.lines} onConfirm={() => perform(pending.action)} onCancel={() => setPending(null)} />
        )}
        {paperOpen && cronaca !== null && <CronacaPaper year={cronaca.year} headlines={cronaca.headlines} onClose={() => setPaperOpen(false)} />}
        {showDilemma && <DilemmaCard key={state.openDilemmaId!} state={state} onAnswer={answer} />}
        {help && (
          <HelpSheet
            onTour={() => {
              setHelp(false);
              setRunning(false);
              setTour(true);
            }}
            onClose={() => setHelp(false)}
            {...(riprendibile
              ? {
                  onTutorial: () => {
                    const p: Progresso = { ...progresso, attivo: true };
                    salvaProgresso(p);
                    setHelp(false);
                    setRunning(false);
                    setGuida(p);
                  },
                }
              : {})}
          />
        )}
        {menu && <GameMenu state={state} lastSaved={lastSaved} onLoad={load} onNew={startNew} onClose={() => setMenu(false)} />}
        {tour && <Tour onEnd={endTour} onStep={onTourStep} />}
        {scelta && <SceltaPartita onScegli={scegliPartita} />}
        {guida !== null && !scelta && !tour && (
          <Tutorial
            indice={guida.passo}
            contesto={{ state, panel, layer: mapMode === 'schematica' ? (layer ?? 'airQuality') : layer, selected, paperOpen }}
            onAvanti={avantiGuida}
            onEsci={esciGuida}
            onFine={fineGuida}
          />
        )}
      </div>
    </TipProvider>
  );
}
