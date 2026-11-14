import { DISTRICT_IDS, type GameState } from '@taranto2127/sim';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CouncilView, DilemmaCard, DistrictCard, Portrait, ProjectsView } from './cards.js';
import { ChartsView } from './charts.js';
import { act, closeYear, content, gameLink, newGame, restoreGame, savedFromHash, toSaved, type Game } from './engine.js';
import { TarantoMap } from './map.js';

const noop = () => {};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').toLowerCase();

/** Qualche anno di gioco con azioni, per avere cantieri e storia. */
function played(): Game {
  let game = newGame(9);
  game = act(game, { kind: 'start-project', definitionId: 'scuole-paolo-vi' });
  game = act(game, { kind: 'convert-lot', lotId: 'lotto-parchi-minerali', path: 'remediation' });
  for (let i = 0; i < 6 && game.state.status === 'running'; i++) {
    if (game.state.openDilemmaId !== null) {
      const optionId = Object.keys(content.rules.dilemmas[game.state.openDilemmaId]!.options)[0]!;
      game = act(game, { kind: 'answer-dilemma', dilemmaId: game.state.openDilemmaId, optionId });
    }
    game = closeYear(game).game;
  }
  return game;
}

describe('partita nel browser', () => {
  it('seme e storia ricostruiscono la stessa partita, con la sua linea del tempo', () => {
    const game = played();
    const restored = restoreGame(toSaved(game.state));
    expect(JSON.stringify(restored.state)).toBe(JSON.stringify(game.state));
    expect(restored.timeline).toHaveLength(game.state.turn + 1);
    expect(JSON.stringify(restored.timeline)).toBe(JSON.stringify(game.timeline));
  });

  it('il link riapre la stessa partita', () => {
    const game = played();
    const saved = savedFromHash(new URL(gameLink(game.state, 'https://esempio.invalid/taranto2127/?seme=1')).hash);
    expect(saved).not.toBeNull();
    expect(JSON.stringify(restoreGame(saved!).state)).toBe(JSON.stringify(game.state));
  });
});

describe('le scelte nascoste non si rivelano prima', () => {
  for (const id of Object.keys(content.rules.dilemmas)) {
    it(`la carta del dilemma ${id} non segnala le opzioni nascoste`, () => {
      const state: GameState = { ...newGame(1).state, openDilemmaId: id };
      const html = renderToString(<DilemmaCard state={state} onAnswer={noop} />);
      expect(text(html)).not.toContain('nascost');
      expect(html).toContain(content.texts.dilemmas[id]!.titolo.replace(/'/g, '&#x27;'));
    });
  }

  it('il pulsante per saltare una fase non dice che è una scelta nascosta', () => {
    let game = act(newGame(2), { kind: 'start-project', definitionId: 'scuole-paolo-vi' });
    while (!game.state.projects.some((p) => p.phase === 'permitting' || p.phase === 'tender')) game = closeYear(game).game;
    const html = renderToString(<ProjectsView state={game.state} prev={game.prev} onRequest={noop} />);
    expect(html).toContain('Salta questa fase');
    expect(text(html)).not.toContain('nascost');
  });
});

describe('schermate', () => {
  const game = played();

  it('la scheda di ogni quartiere spiega le sue grandezze in frasi, senza segnaposti rimasti', () => {
    for (const id of DISTRICT_IDS) {
      const html = renderToString(<DistrictCard state={game.state} prev={game.prev} id={id} onClose={noop} />);
      for (const q of Object.values(content.explanations.quantities)) expect(html).toContain(q);
      expect(html).not.toMatch(/\{[a-z]+\}/);
      expect(html).not.toMatch(/\b(air-lot|air-clean|trust-base|health-base)\b/);
    }
  });

  it('la scheda del quartiere mostra i sei valori in riga e i fattori di un solo indicatore, quello scelto sulla mappa', () => {
    for (const initial of ['airQuality', 'health', 'trust', 'tension'] as const) {
      const html = renderToString(<DistrictCard state={game.state} prev={game.prev} id="tamburi" initial={initial} onClose={noop} />);
      expect(html.match(/data-testid="fattori"/g)).toHaveLength(1);
      expect(html.match(/role="tab"/g)).toHaveLength(6);
      expect(html).toMatch(new RegExp(`aria-selected="true"[^>]*>(<[^>]+>)*${content.explanations.quantities[initial]}`));
    }
  });

  it('ogni lotto sulla mappa mostra il suo nome abbreviato', () => {
    const html = renderToString(<TarantoMap state={game.state} indicator="airQuality" selected={null} onSelect={noop} />);
    for (const name of ['Parchi', 'Cokerie', 'Altoforni', 'Acciaieria', 'Laminatoi', 'Banchine']) expect(html).toContain(`>${name}<`);
  });

  it('la mappa mostra ogni quartiere e ogni lotto con il suo numero o la sua sigla', () => {
    const html = renderToString(<TarantoMap state={game.state} indicator="airQuality" selected={null} onSelect={noop} />);
    for (const id of DISTRICT_IDS) {
      expect(html).toContain(`data-testid="quartiere-${id}"`);
      expect(html).toContain(`>${Math.round(game.state.districts[id].airQuality)}<`);
    }
    for (const lot of game.state.plantLots) expect(html).toContain(`data-testid="lotto-${lot.id}"`);
    expect(html).toContain('>BO<');
  });

  it('cantieri, grafici, Consiglio e finale si costruiscono', () => {
    expect(renderToString(<ProjectsView state={game.state} prev={game.prev} onRequest={noop} />)).toContain('Scuole nuove a Paolo VI');
    const charts = renderToString(<ChartsView timeline={game.timeline} />);
    expect(charts).toContain('Andamento');
    expect(charts).toContain('<polyline');
    const council = renderToString(<CouncilView state={game.state} onRequest={noop} />);
    for (const c of content.initialContent.council) expect(council).toContain(c.name.replace(/'/g, '&#x27;'));
    const ended = { ...game.state, status: 'ended-2127' as const };
    const portrait = renderToString(<Portrait initial={newGame(9).state} state={ended} link="#partita=x" onNew={noop} />);
    expect(portrait).toContain('Ritratto di Taranto');
    expect(portrait).toContain('Riapri questa partita');
  });
});
