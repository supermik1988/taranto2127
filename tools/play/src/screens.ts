/** Le schermate del terminale. Ogni riga sta in 100 colonne. */
import type { CouncilAdvice } from '@taranto2127/agents';
import type { LoadedContent } from '@taranto2127/content';
import {
  DISTRICT_IDS,
  TOTAL_EPOCHS,
  TOTAL_TURNS,
  averageTrust,
  epochOfTurn,
  yearOfTurn,
  type GameState,
} from '@taranto2127/sim';
import { fmt, wrap } from './describe.js';

export const WIDTH = 100;

const pad = (text: string, width: number): string => (text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length));
const padLeft = (text: string, width: number): string => (text.length >= width ? text : ' '.repeat(width - text.length) + text);

/** Freccia rispetto all'anno prima: sale, scende o resta. */
export function arrow(before: number | undefined, now: number): string {
  if (before === undefined) return ' ';
  if (now - before > 0.05) return '↑';
  if (before - now > 0.05) return '↓';
  return '=';
}

/** Barra da Red (-100) a Blu (+100), con il centro segnato. */
export function moralBar(value: number, cells = 41): string {
  const center = Math.floor(cells / 2);
  const pos = Math.round(((value + 100) / 200) * (cells - 1));
  const chars: string[] = Array.from({ length: cells }, (_, i) => (i === center ? '|' : '-'));
  chars[pos] = 'O';
  return `Red ${chars.join('')} Blu  ${value > 0 ? '+' : ''}${fmt(value, 1)}`;
}

const employed = (s: GameState): number => Object.values(s.labor.employed).reduce((a, b) => a + b, 0);

const PHASES: Record<string, string> = {
  design: 'progettazione',
  permitting: 'autorizzazioni',
  tender: 'gara',
  works: 'lavori',
  operating: 'in esercizio',
  cancelled: 'annullato',
};

/** La schermata dell'anno. `prev` è lo stato dell'anno prima, per le frecce. */
export function yearScreen(state: GameState, prev: GameState | undefined, content: LoadedContent): string[] {
  const lines: string[] = [];
  const epoch = epochOfTurn(Math.min(state.turn, TOTAL_TURNS - 1)) + 1;
  lines.push(`═══ TARANTO ${yearOfTurn(state.turn)} ═══ epoca ${epoch} di ${TOTAL_EPOCHS} · anno ${state.turn + 1} di ${TOTAL_TURNS}`);
  const f = state.economy.funds;
  lines.push(`Fondi (M€)   propri ${fmt(f.own, 1)} · statale ${fmt(f.state, 1)} · europeo ${fmt(f['eu-earmarked'], 1)}`);
  const l = state.labor;
  lines.push(`Lavoro       occupati ${fmt(employed(state))} · cassa integrati ${fmt(l.onWageSupport)} · disoccupati ${fmt(l.unemployed)} · in formazione ${fmt(l.inTraining)}`);
  lines.push('');
  lines.push(`${pad('Quartiere', 26)}${padLeft('Aria', 8)}${padLeft('Salute', 10)}${padLeft('Fiducia', 10)}${padLeft('Tensione', 11)}`);
  for (const id of DISTRICT_IDS) {
    const d = state.districts[id];
    const p = prev?.districts[id];
    const cell = (now: number, before: number | undefined, width: number) => padLeft(`${fmt(now)} ${arrow(before, now)}`, width);
    lines.push(
      `${pad(content.texts.districts[id]?.nome ?? id, 26)}${cell(d.airQuality, p?.airQuality, 8)}${cell(d.health, p?.health, 10)}${cell(d.trust, p?.trust, 10)}${cell(d.tension, p?.tension, 11)}`,
    );
  }
  lines.push('');
  lines.push(`Coscienza    ${moralBar(state.moral.conscience)}`);
  lines.push(`Reputazione  ${moralBar(state.moral.reputation)}`);
  lines.push('');
  const open = state.projects.filter((p) => p.phase !== 'operating' && p.phase !== 'cancelled');
  if (open.length === 0) lines.push('Progetti     nessun cantiere aperto');
  open.forEach((p, i) => {
    const lot = p.lotId === undefined ? '' : ` (${content.texts.plantLots[p.lotId]?.nome ?? p.lotId})`;
    const status = p.frozenTurns > 0 ? `fermo per ${p.frozenTurns} anni` : p.worksStalled ? 'cantiere fermo' : `${p.turnsLeftInPhase} ${p.turnsLeftInPhase === 1 ? 'anno' : 'anni'} alla fine della fase`;
    const delay = p.delayTurns > 0 ? `, ritardo ${p.delayTurns} ${p.delayTurns === 1 ? 'anno' : 'anni'}` : '';
    lines.push(`${i === 0 ? 'Progetti     ' : '             '}${content.texts.projects[p.definitionId]?.nome ?? p.definitionId}${lot}: ${PHASES[p.phase]}, ${status}${delay}`);
  });
  const operating = state.projects.filter((p) => p.phase === 'operating').length;
  if (operating > 0) lines.push(`             in esercizio: ${operating}`);
  const policies = state.activePolicies.map((id) => `${content.texts.policies[id]?.nome ?? id} (dal ${yearOfTurn(state.policySince[id] ?? state.turn)})`);
  lines.push(`Politiche    ${policies.length === 0 ? 'nessuna attiva' : policies.join(' · ')}`);
  if (state.openDilemmaId !== null) {
    lines.push('');
    lines.push(`DILEMMA APERTO: ${content.texts.dilemmas[state.openDilemmaId]?.titolo ?? state.openDilemmaId} (scrivi d per rispondere)`);
  }
  return lines.flatMap((line) => wrap(line, WIDTH));
}

const VISIONS: Record<string, string> = {
  'work-industry': 'lavoro e industria',
  'health-environment': 'salute e ambiente',
  'sea-culture': 'mare e cultura',
  'public-accounts': 'conti pubblici',
  'youth-future': 'giovani e futuro',
  'districts-periphery': 'quartieri e periferie',
};

export function councilScreen(advice: CouncilAdvice[]): string[] {
  const lines = ['═══ IL CONSIGLIO ═══'];
  for (const a of advice) {
    lines.push('');
    lines.push(`${a.name}${a.urgent ? ' (preoccupato)' : ''}`);
    lines.push(`  ${a.reason}`);
    if (a.action === null) lines.push('  Nessuna azione proposta.');
  }
  lines.push('');
  lines.push(`Visioni: ${advice.map((a) => VISIONS[a.vision]).join(' · ')}`);
  return lines.flatMap((line) => wrap(line, WIDTH));
}

/** Il ritratto di Taranto nell'anno finale. */
export function portraitScreen(initial: GameState, final: GameState, content: LoadedContent): string[] {
  const standing = final.status === 'ended-2127';
  const blue = final.moral.conscience >= 0;
  const how = final.status === 'ended-bankrupt' ? 'svuotata dal dissesto' : final.status === 'ended-abandoned' ? 'svuotata: la città ha voltato le spalle' : 'in piedi';
  const lines = [
    `═══ RITRATTO DI TARANTO, ${yearOfTurn(final.turn)} ═══`,
    '',
    `Una città ${how}, governata da una coscienza ${blue ? 'Blu' : 'Red'}.`,
    standing
      ? blue
        ? 'Taranto arriva in fondo al secolo, e ci arriva a testa alta.'
        : 'Taranto arriva in fondo al secolo, ma molte cose si sono fatte di nascosto.'
      : blue
        ? 'Le scelte sono state oneste, ma la città non ha retto.'
        : 'Scorciatoie e silenzi non sono bastati a tenere in piedi la città.',
    '',
    `${pad('', 34)}${padLeft(String(yearOfTurn(initial.turn)), 14)}${padLeft(String(yearOfTurn(final.turn)), 14)}`,
  ];
  const rows: [string, (s: GameState) => number, number][] = [
    ['Occupati', employed, 0],
    ['Cassa integrati', (s) => s.labor.onWageSupport, 0],
    ['Disoccupati', (s) => s.labor.unemployed, 0],
    ['Fondi propri (M€)', (s) => s.economy.funds.own, 1],
    ['Fiducia media', averageTrust, 1],
    ['Aria ai Tamburi', (s) => s.districts.tamburi.airQuality, 0],
    ['Salute ai Tamburi', (s) => s.districts.tamburi.health, 0],
    ['Esposizione ai Tamburi', (s) => s.districts.tamburi.cumulativeExposure, 0],
    ['Terreni contaminati, area ind.', (s) => s.districts['area-industriale'].contaminatedSoil, 0],
    ['Coscienza', (s) => s.moral.conscience, 1],
    ['Reputazione', (s) => s.moral.reputation, 1],
    ['Scandali', (s) => s.moral.scandals.length, 0],
  ];
  for (const [label, read, digits] of rows) {
    lines.push(`${pad(label, 34)}${padLeft(fmt(read(initial), digits), 14)}${padLeft(fmt(read(final), digits), 14)}`);
  }
  const kept = final.promises.filter((p) => p.status === 'kept').length;
  const broken = final.promises.filter((p) => p.status === 'broken').length;
  lines.push(`${pad('Promesse mantenute / tradite', 34)}${padLeft('', 14)}${padLeft(`${kept} / ${broken}`, 14)}`);
  lines.push('');
  lines.push(`Per rigiocare lo stesso seme:  pnpm play -- --seme ${final.seed}`);
  void content;
  return lines.flatMap((line) => wrap(line, WIDTH));
}

export const HELP = [
  'Comandi:',
  '  a        chiude l\'anno',
  '  aa       avanza fino al prossimo dilemma, alla fine di una fase o a un cambio d\'epoca (max 10 anni)',
  '  c        il Consiglio',
  '  p        avvia un progetto           l   destina un lotto di ILSIDER',
  '  o        accendi o spegni una politica   s   salta una fase di un cantiere',
  '  d        rispondi al dilemma aperto  v   rivedi la schermata dell\'anno',
  '  salva [file]   salva la partita      q   esci',
];
