/** T10: tempo, salvataggi, grafici, bilancio e guida nell'interfaccia. */
import { DISTRICT_IDS, type StopReason } from '@taranto2127/sim';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { describeStops } from './App.js';
import { BudgetView } from './budget.js';
import { DistrictCard } from './cards.js';
import { ChartsView, MIN_CHART_YEARS, Sparkline, verticalScale } from './charts.js';
import {
  act,
  closeYear,
  content,
  exportText,
  loadLocal,
  newGame,
  parseSaved,
  readSlot,
  restoreGame,
  saveLocal,
  saveSlot,
  toSaved,
  type Game,
} from './engine.js';
import { HowToPlay, TipProvider, Tour } from './guide.js';
import { GameMenu } from './menu.js';

const noop = () => {};

/** Qualche anno di gioco con azioni, per avere cantieri e storia. */
function played(): Game {
  let game = newGame(9);
  game = act(game, { kind: 'start-project', definitionId: 'scuole-paolo-vi' });
  game = act(game, { kind: 'convert-lot', lotId: 'lotto-parchi-minerali', path: 'remediation' });
  for (let i = 0; i < 8 && game.state.status === 'running'; i++) {
    if (game.state.openDilemmaId !== null) {
      const optionId = Object.keys(content.rules.dilemmas[game.state.openDilemmaId]!.options)[0]!;
      game = act(game, { kind: 'answer-dilemma', dilemmaId: game.state.openDilemmaId, optionId });
    }
    game = closeYear(game).game;
  }
  return game;
}

/** Archivio finto al posto di quello del browser. */
function fakeStore() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('salvataggi', () => {
  it('salvare in un posto, cominciare una partita nuova e ricaricare dà lo stato identico', () => {
    const store = fakeStore();
    const game = played();
    expect(saveSlot(2, game.state, new Date('2026-11-15T10:00:00Z'), store)).toBe(true);
    // Partita nuova: il salvataggio automatico sovrascrive la partita in corso, non il posto.
    const fresh = newGame(12345);
    saveLocal(fresh.state, new Date(), store);
    expect(loadLocal(store)!.seme).toBe(12345);
    const slot = readSlot(2, store)!;
    expect(slot.at).toBe('2026-11-15T10:00:00.000Z');
    expect(JSON.stringify(restoreGame(slot.saved).state)).toBe(JSON.stringify(game.state));
    expect(readSlot(1, store)).toBeNull();
  });

  it('esportare e importare dà lo stesso stato', () => {
    const game = played();
    const saved = parseSaved(exportText(game.state));
    expect(saved).not.toBeNull();
    expect(JSON.stringify(restoreGame(saved!).state)).toBe(JSON.stringify(game.state));
  });

  it('un file che non è una partita viene rifiutato', () => {
    expect(parseSaved('{"formato":"altro"}')).toBeNull();
    expect(parseSaved('non è JSON')).toBeNull();
    expect(parseSaved(JSON.stringify({ ...toSaved(newGame(1).state), storia: 'no' }))).toBeNull();
  });

  it('il menu mostra salvataggio automatico, tre posti, file, link e nuova partita', () => {
    const html = renderToString(
      <GameMenu state={played().state} lastSaved={new Date('2026-11-15T10:00:00Z')} onLoad={noop} onNew={noop} onClose={noop} />,
    );
    for (const id of ['salvataggio-automatico', 'posto-1', 'posto-2', 'posto-3', 'esporta', 'importa', 'copia-link', 'link-menu', 'nuova-partita']) {
      expect(html).toContain(`data-testid="${id}"`);
    }
    expect(html).toContain('Ultimo salvataggio alle');
  });
});

describe('il tempo', () => {
  const state = played().state;
  const project = state.projects[0]!;
  const reasons: StopReason[] = [
    { kind: 'dilemma', dilemmaId: Object.keys(content.rules.dilemmas)[0]! },
    { kind: 'phase-end', projectId: project.id, definitionId: project.definitionId, from: 'design', to: 'permitting' },
    { kind: 'phase-end', projectId: project.id, definitionId: project.definitionId, from: 'works', to: 'operating' },
    { kind: 'scandal', count: 1 },
    { kind: 'promise-due', promiseId: 'x', status: 'broken' },
    { kind: 'epoch', epoch: 1 },
    { kind: 'deficit' },
    { kind: 'game-over', status: 'ended-2127' },
  ];

  it('una riga dice perché il tempo si è fermato, per ogni motivo', () => {
    for (const reason of reasons) {
      const line = describeStops([reason], state);
      expect(line.startsWith('Tempo fermo:'), reason.kind).toBe(true);
      expect(line, reason.kind).not.toMatch(/\{\w+\}/);
      expect(line.length, reason.kind).toBeGreaterThan(20);
    }
    const first = reasons[0]!;
    if (first.kind === 'dilemma') expect(describeStops([first], state)).toContain(content.texts.dilemmas[first.dilemmaId]!.titolo);
    expect(describeStops([reasons[5]!], state)).toContain("l'epoca 2 di 5");
  });
});

describe('grafici su telefono', () => {
  it('con meno di cinque anni di dati, un messaggio al posto del grafico', () => {
    let game = newGame(3);
    for (let i = 0; i < MIN_CHART_YEARS - 2; i++) {
      const open = game.state.openDilemmaId;
      if (open !== null) game = act(game, { kind: 'answer-dilemma', dilemmaId: open, optionId: Object.keys(content.rules.dilemmas[open]!.options)[0]! });
      game = closeYear(game).game;
    }
    const html = renderToString(<ChartsView timeline={game.timeline} />);
    expect(html).toContain('data-testid="grafico-attesa"');
    expect(html).not.toContain('<polyline');
  });

  it('un quartiere in evidenza, la media della città, nomi solo nella legenda con la variazione dal 2027', () => {
    const html = renderToString(<ChartsView timeline={played().timeline} />);
    expect(html).toContain('Media della città');
    expect(html).toMatch(/dal 2027\)/);
    expect(html).toMatch(/[+−±]\d/);
    // Nessuna scritta dentro il grafico oltre agli assi.
    const svg = html.slice(html.indexOf('data-testid="grafico"'), html.indexOf('</svg>'));
    for (const id of DISTRICT_IDS) expect(svg).not.toContain(content.texts.districts[id]!.nome);
  });

  it('la scala verticale si adatta ai valori, con margine', () => {
    const { min, max } = verticalScale([40, 44, 47], true);
    expect(min).toBeLessThan(40);
    expect(max).toBeGreaterThan(47);
    expect(max - min).toBeLessThan(40);
    const wide = verticalScale([0, 100], true);
    expect(wide.min).toBe(0);
    expect(wide.max).toBe(100);
  });

  it('la scheda del quartiere ha un mini andamento', () => {
    const game = played();
    const html = renderToString(<DistrictCard state={game.state} prev={game.prev} id="tamburi" timeline={game.timeline} onClose={noop} />);
    expect(html).toContain('data-testid="mini-andamento"');
    expect(renderToString(<Sparkline values={[1, 2, 3]} label="x" />)).toContain('dal 2027');
  });
});

describe('bilancio e guida', () => {
  it("il bilancio ha le tre casse con i nomi chiesti, la previsione, l'ultimo anno e la nota sulle stime", () => {
    const game = played();
    const html = renderToString(
      <TipProvider>
        <BudgetView state={game.state} prev={game.prev} />
      </TipProvider>,
    );
    for (const name of ['Cassa della città', 'Fondi dello Stato', 'Fondi europei']) expect(html).toContain(name);
    for (const id of ['previsione', 'ultimo-anno', 'nota-stime', 'rate-europee', 'capacita-bilancio']) expect(html).toContain(`data-testid="${id}"`);
    expect(html).toContain('Servizi ordinari');
    expect(html).not.toMatch(/\{\w+\}/);
  });

  it('con la cassa in rosso, il bilancio dice quanti anni mancano al dissesto', () => {
    const red = structuredClone(played().state);
    red.economy.funds.own = -40;
    const html = renderToString(
      <TipProvider>
        <BudgetView state={red} prev={undefined} />
      </TipProvider>,
    );
    expect(html).toContain('data-testid="avviso-disavanzo"');
    expect(html).toMatch(/dissesto/);
  });

  it('la visita guidata parte dal primo degli otto passi; come si gioca elenca tutte le sezioni', () => {
    const tour = renderToString(<Tour onEnd={noop} />);
    expect(tour).toMatch(/1(<!-- -->)? di (<!-- -->)?8/);
    expect(tour).toContain('data-testid="visita-salta"');
    const howto = renderToString(<HowToPlay />);
    for (const section of content.guide.howTo) expect(howto).toContain(section.titolo.replace(/'/g, '&#x27;'));
  });
});
