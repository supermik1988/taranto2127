/**
 * L'applicazione. Lo stato di gioco (`game`) cambia solo attraverso
 * applyAction e advanceTurn (in engine.ts); tutto il resto è stato
 * dell'interfaccia: scheda aperta, indicatore della mappa, finestre.
 */
import {
  ActionError,
  MAX_FREE_ACTIONS_PER_TURN,
  TOTAL_EPOCHS,
  epochOfTurn,
  freeActionsUsed,
  yearOfTurn,
  type Action,
  type DistrictId,
  type GameState,
} from '@taranto2127/sim';
import { useEffect, useMemo, useState } from 'react';
import {
  ConfirmSheet,
  CouncilView,
  CronacaPaper,
  DilemmaCard,
  DistrictCard,
  LotCard,
  PoliciesView,
  Portrait,
  ProjectsView,
} from './cards.js';
import { ChartsView } from './charts.js';
import { act, advanceToEvent, clearLocal, closeYear, content, gameLink, newGame, saveLocal, startingGame, type Game } from './engine.js';
import { INDICATOR_LABELS, MapLegend, TarantoMap, type MapIndicator } from './map.js';

type Tab = 'mappa' | 'cantieri' | 'grafici' | 'consiglio' | 'politiche';
const TABS: [Tab, string][] = [
  ['mappa', 'Mappa'],
  ['cantieri', 'Cantieri'],
  ['grafici', 'Grafici'],
  ['consiglio', 'Consiglio'],
  ['politiche', 'Politiche'],
];

function MoralBar({ label, value }: { label: string; value: number }) {
  const pos = ((value + 100) / 200) * 100;
  return (
    <div className="moral" aria-label={`${label}: ${value.toFixed(1)} da -100 (Red) a +100 (Blu)`}>
      <span className="moral-label">{label}</span>
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

function TopBar({ state, onClose, onAdvance }: { state: GameState; onClose: () => void; onAdvance: () => void }) {
  const f = state.economy.funds;
  const left = MAX_FREE_ACTIONS_PER_TURN - freeActionsUsed(state);
  const running = state.status === 'running';
  const m = (v: number) => Math.round(v).toLocaleString('it-IT');
  return (
    <header className="topbar" data-testid="barra">
      <div className="when">
        <strong data-testid="anno">{yearOfTurn(state.turn)}</strong>
        <span> · epoca {epochOfTurn(Math.min(state.turn, 99)) + 1} di {TOTAL_EPOCHS}</span>
      </div>
      <div className="funds">Fondi: propri {m(f.own)} · Stato {m(f.state)} · UE {m(f['eu-earmarked'])} M€</div>
      <MoralBar label="Coscienza" value={state.moral.conscience} />
      <MoralBar label="Reputazione" value={state.moral.reputation} />
      {running && (
        <div className="controls">
          <span className="free" data-testid="azioni-libere">Azioni libere: {Math.max(0, left)} di {MAX_FREE_ACTIONS_PER_TURN}</span>
          <button type="button" className="primary" onClick={onClose} data-testid="chiudi-anno">Chiudi l'anno</button>
          <button type="button" onClick={onAdvance} data-testid="avanza">Avanza fino al prossimo evento</button>
        </div>
      )}
    </header>
  );
}

interface Pending {
  action: Action;
  title: string;
  lines: string[];
}

export function App() {
  const [game, setGame] = useState<Game>(() => startingGame(window.location));
  const initial = useMemo(() => newGame(game.state.seed).state, [game.state.seed]);
  const [tab, setTab] = useState<Tab>('mappa');
  const [indicator, setIndicator] = useState<MapIndicator>('airQuality');
  const [selected, setSelected] = useState<{ kind: 'district' | 'lot'; id: string } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [cronaca, setCronaca] = useState<{ year: number; headlines: string[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Salvataggio automatico: a ogni cambiamento dello stato di gioco, come seme più storia.
  useEffect(() => saveLocal(game.state), [game.state]);
  // Il link con la partita è servito: lo si toglie dall'indirizzo, la partita resta nel browser.
  useEffect(() => {
    if (window.location.hash.startsWith('#partita=')) history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  const state = game.state;
  const request = (action: Action, title: string, lines: string[]) => setPending({ action, title, lines });

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
    setNotice(hidden ? 'Questa era una scelta nascosta: nessuno lo sa, per ora.' : null);
  };

  const close = (fast: boolean) => {
    if (state.openDilemmaId !== null) return;
    const result = fast ? advanceToEvent(game) : closeYear(game);
    setGame(result.game);
    setCronaca({ year: result.year, headlines: result.headlines });
    setNotice(null);
  };

  const restart = () => {
    clearLocal();
    window.location.href = window.location.pathname;
  };

  const ended = state.status !== 'running';
  const showDilemma = !ended && state.openDilemmaId !== null && cronaca === null && pending === null;

  return (
    <div className="app">
      <TopBar state={state} onClose={() => close(false)} onAdvance={() => close(true)} />
      {notice !== null && (
        <p className="notice" role="status" data-testid="avviso">
          {notice} <button type="button" onClick={() => setNotice(null)}>Ok</button>
        </p>
      )}
      {ended ? (
        <main>
          <Portrait initial={initial} state={state} link={gameLink(state, window.location.href)} onNew={restart} />
        </main>
      ) : (
        <>
          <nav className="tabs" aria-label="Sezioni">
            {TABS.map(([t, label]) => (
              <button key={t} type="button" className={t === tab ? 'tab on' : 'tab'} aria-current={t === tab} onClick={() => setTab(t)} data-testid={`scheda-${t}`}>
                {label}
              </button>
            ))}
          </nav>
          <main className={tab === 'mappa' ? 'layout-map' : ''}>
            {tab === 'mappa' && (
              <>
                <section className="panel map-panel">
                  <div className="chips" role="group" aria-label="Indicatore della mappa">
                    {(Object.keys(INDICATOR_LABELS) as MapIndicator[]).map((ind) => (
                      <button key={ind} type="button" className={ind === indicator ? 'chip on' : 'chip'} aria-pressed={ind === indicator} onClick={() => setIndicator(ind)}>
                        {INDICATOR_LABELS[ind]}
                      </button>
                    ))}
                  </div>
                  <TarantoMap state={state} indicator={indicator} selected={selected?.id ?? null} onSelect={(kind, id) => setSelected({ kind, id })} />
                  <MapLegend indicator={indicator} />
                </section>
                <aside className="side">
                  {selected === null && <p className="panel note">Tocca un quartiere o un lotto per aprire la sua scheda.</p>}
                  {selected?.kind === 'district' && (
                    <DistrictCard state={state} prev={game.prev} id={selected.id as DistrictId} onClose={() => setSelected(null)} />
                  )}
                  {selected?.kind === 'lot' && <LotCard state={state} lotId={selected.id} onRequest={request} onClose={() => setSelected(null)} />}
                </aside>
              </>
            )}
            {tab === 'cantieri' && <ProjectsView state={state} prev={game.prev} onRequest={request} />}
            {tab === 'grafici' && <ChartsView timeline={game.timeline} />}
            {tab === 'consiglio' && <CouncilView state={state} onRequest={request} />}
            {tab === 'politiche' && <PoliciesView state={state} onRequest={request} />}
          </main>
        </>
      )}
      {pending !== null && (
        <ConfirmSheet title={pending.title} lines={pending.lines} onConfirm={() => perform(pending.action)} onCancel={() => setPending(null)} />
      )}
      {cronaca !== null && <CronacaPaper year={cronaca.year} headlines={cronaca.headlines} onClose={() => setCronaca(null)} />}
      {showDilemma && <DilemmaCard key={state.openDilemmaId!} state={state} onAnswer={answer} />}
      <footer className="footer">
        Seme {state.seed} · TARANTO2127 è un gioco: luoghi reali, persone e aziende inventate.
      </footer>
    </div>
  );
}
