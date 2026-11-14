/** Dalle partite al rapporto: mediane, segnalazioni, leve. */
import { DISTRICT_IDS, type DistrictId, type TurnRules } from '@taranto2127/sim';
import type { Bot } from './bots.js';
import {
  CHECKPOINTS,
  TRACKED,
  leverOfOption,
  leverOfPath,
  leverOfPolicy,
  leverOfProject,
  type GameFailure,
  type GameResult,
  type TrackedName,
} from './simulate.js';

export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export interface BotSummary {
  botId: string;
  nome: string;
  games: number;
  share2127: number;
  shareBankrupt: number;
  /** Partite chiuse perché la città si è voltata (fiducia sotto soglia troppo a lungo). */
  shareAbandoned: number;
  medianBankruptYear: number | null;
  medians: {
    fundsOwn: number;
    fundsState: number;
    fundsEu: number;
    fundsPrivate: number;
    localEmployed: number;
    onWageSupport: number;
    unemployed: number;
    conscience: number;
    reputation: number;
    averageTrust: number;
    scandals: number;
    airQuality: Record<DistrictId, number>;
    trust: Record<DistrictId, number>;
    exposure: Record<DistrictId, number>;
    health: Record<DistrictId, number>;
    industrialSoil: number;
  };
  /** Esito ripetuto in più del 90% delle partite, se c'è. */
  sameOutcome: { status: string; share: number } | null;
}

export interface TrendAlert {
  botId: string;
  variable: TrackedName;
  direction: 'cresce' | 'cala';
  values: number[];
}

export interface LeverStat {
  lever: string;
  /** Quota di partite in cui la leva è stata usata, per bot. */
  useByBot: Record<string, number>;
}

export interface ConvenienceAlert {
  lever: string;
  used: { games: number; share2127: number; fundsOwn: number; localEmployed: number; reputation: number };
  notUsed: { games: number; share2127: number; fundsOwn: number; localEmployed: number; reputation: number };
}

export interface Report {
  seed: number;
  gamesPerBot: number;
  bots: BotSummary[];
  trends: TrendAlert[];
  levers: LeverStat[];
  neverUsed: string[];
  alwaysConvenient: ConvenienceAlert[];
  /** Partite interrotte da uno stato non valido del motore: dovrebbero essere zero. */
  failures: GameFailure[];
}

/** Tutte le leve dei contenuti: progetti, politiche, opzioni di dilemma, strade dei lotti. */
export function allLevers(rules: TurnRules): string[] {
  return [
    ...Object.keys(rules.projects).map(leverOfProject),
    ...Object.keys(rules.policies).map(leverOfPolicy),
    ...Object.values(rules.dilemmas).flatMap((d) => Object.keys(d.options).map((o) => leverOfOption(d.id, o))),
    ...Object.keys(rules.lotConversion).map(leverOfPath),
  ];
}

function summarize(bot: Bot, results: GameResult[]): BotSummary {
  const n = Math.max(1, results.length);
  const share = (status: string) => results.filter((r) => r.status === status).length / n;
  const bankrupt = results.filter((r) => r.status === 'ended-bankrupt');
  const perDistrict = (read: (r: GameResult) => Record<DistrictId, number>) =>
    Object.fromEntries(DISTRICT_IDS.map((id) => [id, median(results.map((r) => read(r)[id]))])) as Record<DistrictId, number>;
  const statuses = ['ended-2127', 'ended-bankrupt', 'ended-abandoned'];
  const top = statuses.map((status) => ({ status, share: share(status) })).sort((a, b) => b.share - a.share)[0]!;
  return {
    botId: bot.id,
    nome: bot.nome,
    games: n,
    share2127: share('ended-2127'),
    shareBankrupt: share('ended-bankrupt'),
    shareAbandoned: share('ended-abandoned'),
    medianBankruptYear: bankrupt.length === 0 ? null : median(bankrupt.map((r) => r.endYear)),
    medians: {
      fundsOwn: median(results.map((r) => r.funds.own)),
      fundsState: median(results.map((r) => r.funds.state)),
      fundsEu: median(results.map((r) => r.funds['eu-earmarked'])),
      fundsPrivate: median(results.map((r) => r.funds.private)),
      localEmployed: median(results.map((r) => r.localEmployed)),
      onWageSupport: median(results.map((r) => r.onWageSupport)),
      unemployed: median(results.map((r) => r.unemployed)),
      conscience: median(results.map((r) => r.conscience)),
      reputation: median(results.map((r) => r.reputation)),
      averageTrust: median(results.map((r) => r.averageTrust)),
      scandals: median(results.map((r) => r.scandals)),
      airQuality: perDistrict((r) => r.airQuality),
      trust: perDistrict((r) => r.trust),
      exposure: perDistrict((r) => r.exposure),
      health: perDistrict((r) => r.health),
      industrialSoil: median(results.map((r) => r.industrialSoil)),
    },
    sameOutcome: top.share > 0.9 ? top : null,
  };
}

/**
 * Una variabile "cresce o cala senza limite" se, tra le partite ancora in
 * corso, la sua mediana va sempre nella stessa direzione ai turni 25, 50, 75 e
 * 100, non rallenta nell'ultimo quarto (almeno tre quarti del passo del primo)
 * e cambia di almeno un quarto rispetto al primo controllo.
 */
function trends(bot: Bot, results: GameResult[]): TrendAlert[] {
  const alerts: TrendAlert[] = [];
  for (const variable of Object.keys(TRACKED) as TrackedName[]) {
    const values = CHECKPOINTS.map((t) => {
      const reached = results.filter((r) => r.checkpoints[t] !== undefined);
      // Servono abbastanza partite ancora in corso perché la mediana dica qualcosa.
      return reached.length >= Math.max(5, results.length * 0.2) ? median(reached.map((r) => r.checkpoints[t]![variable])) : Number.NaN;
    });
    if (values.some(Number.isNaN)) continue;
    const [a, b, c, d] = values as [number, number, number, number];
    const significant = Math.abs(d - a) >= Math.max(1, Math.abs(a) * 0.25);
    if (a < b && b < c && c < d && d - c >= 0.75 * (b - a) && significant) alerts.push({ botId: bot.id, variable, direction: 'cresce', values });
    if (a > b && b > c && c > d && c - d >= 0.75 * (a - b) && significant) alerts.push({ botId: bot.id, variable, direction: 'cala', values });
  }
  return alerts;
}

function groupStats(results: GameResult[]) {
  return {
    games: results.length,
    share2127: results.filter((r) => r.status === 'ended-2127').length / Math.max(1, results.length),
    fundsOwn: median(results.map((r) => r.funds.own)),
    localEmployed: median(results.map((r) => r.localEmployed)),
    reputation: median(results.map((r) => r.reputation)),
  };
}

/** Anni iniziali in cui si guarda l'uso di una leva: quasi tutte le partite sono ancora in corso. */
export const EARLY_TURNS = 10;

/**
 * Una leva è "sempre conveniente" se, nelle partite del bot casuale (che la usa
 * o no per caso), chi l'ha usata nei primi EARLY_TURNS anni sta meglio su
 * tutti e quattro gli esiti: più partite al 2127 (almeno 5 punti), più fondi
 * propri, più occupati locali, più reputazione. Guardare solo i primi anni
 * evita che le partite più lunghe sembrino migliori solo perché hanno fatto in
 * tempo a usare più leve. Per un'opzione di dilemma il confronto è con le
 * partite in cui lo stesso dilemma è arrivato e si è scelta un'altra opzione.
 * Servono almeno il 10% di partite in ciascun gruppo.
 */
function convenience(levers: string[], randomResults: GameResult[]): ConvenienceAlert[] {
  const alerts: ConvenienceAlert[] = [];
  const minimum = Math.max(5, randomResults.length * 0.1);
  const early = (r: GameResult, lever: string) => (r.leverFirstTurn[lever] ?? Infinity) < EARLY_TURNS;
  for (const lever of levers) {
    const dilemma = lever.startsWith('dilemma:') ? lever.slice('dilemma:'.length).split('/')[0]! : undefined;
    const sameDilemma = (r: GameResult) =>
      Object.keys(r.leverFirstTurn).some((l) => l.startsWith(`dilemma:${dilemma}/`) && l !== lever && early(r, l));
    const used = randomResults.filter((r) => early(r, lever));
    const notUsed = randomResults.filter((r) => !early(r, lever) && (dilemma === undefined || sameDilemma(r)));
    if (used.length < minimum || notUsed.length < minimum) continue;
    const u = groupStats(used);
    const v = groupStats(notUsed);
    if (u.share2127 >= v.share2127 + 0.05 && u.fundsOwn > v.fundsOwn && u.localEmployed > v.localEmployed && u.reputation > v.reputation) {
      alerts.push({ lever, used: u, notUsed: v });
    }
  }
  return alerts;
}

export function buildReport(
  seed: number,
  gamesPerBot: number,
  bots: readonly Bot[],
  resultsByBot: Record<string, GameResult[]>,
  rules: TurnRules,
  failures: GameFailure[] = [],
): Report {
  const levers = allLevers(rules);
  const stats: LeverStat[] = levers.map((lever) => ({
    lever,
    useByBot: Object.fromEntries(
      bots.map((bot) => {
        const results = resultsByBot[bot.id]!;
        return [bot.id, results.filter((r) => r.levers.includes(lever)).length / Math.max(1, results.length)];
      }),
    ),
  }));
  return {
    seed,
    gamesPerBot,
    bots: bots.map((bot) => summarize(bot, resultsByBot[bot.id]!)),
    trends: bots.flatMap((bot) => trends(bot, resultsByBot[bot.id]!)),
    levers: stats,
    neverUsed: stats.filter((s) => Object.values(s.useByBot).every((x) => x === 0)).map((s) => s.lever),
    alwaysConvenient: resultsByBot['casuale'] === undefined ? [] : convenience(levers, resultsByBot['casuale']),
    failures,
  };
}

// ---------------------------------------------------------------- testo

const pct = (x: number) => `${Math.round(x * 100)}%`;
const num = (x: number, digits = 0) => (Number.isNaN(x) ? '—' : x.toLocaleString('it-IT', { maximumFractionDigits: digits, minimumFractionDigits: digits }));
const SHORT: Record<DistrictId, string> = {
  tamburi: 'Tamburi',
  'paolo-vi': 'Paolo VI',
  'citta-vecchia': 'Città Vecchia',
  borgo: 'Borgo',
  'talsano-lama-san-vito': 'Talsano',
  'area-industriale': 'Area ind.',
};

/** Il rapporto in Markdown. Con `color` le segnalazioni sono anche in rosso (solo terminale). */
export function formatReport(report: Report, options: { color?: boolean } = {}): string {
  const alert = (text: string) => (options.color ? `\u001b[31m**ATTENZIONE** ${text}\u001b[0m` : `**ATTENZIONE** ${text}`);
  const lines: string[] = [];
  const out = (line = '') => lines.push(line);
  const names = Object.fromEntries(report.bots.map((b) => [b.botId, b.nome]));

  out(`# Rapporto di bilanciamento`);
  out();
  out(`${report.gamesPerBot} partite per bot, semi da ${report.seed} a ${report.seed + report.gamesPerBot - 1}, contenuti veri.`);
  out();

  if (report.failures.length > 0) {
    out(`## Errori del motore`);
    out();
    out(alert(`${report.failures.length} partite interrotte da uno stato non valido; sono escluse da tutte le statistiche.`));
    out();
    const byBot = new Map<string, number>();
    for (const f of report.failures) byBot.set(f.botId, (byBot.get(f.botId) ?? 0) + 1);
    for (const [botId, count] of byBot) out(`- ${names[botId] ?? botId}: ${count}`);
    out();
    out(`Primi casi:`);
    out();
    for (const f of report.failures.slice(0, 5)) out(`- ${f.message}`);
    out();
  }

  out(`## 1. Esiti`);
  out();
  out(`Quote calcolate sulle partite giocate fino in fondo.`);
  out();
  out(`| Bot | Partite | Al 2127 | In dissesto | Città che si volta | Anno mediano del dissesto |`);
  out(`| --- | ---: | ---: | ---: | ---: | ---: |`);
  for (const b of report.bots) {
    out(`| ${b.nome} | ${b.games} | ${pct(b.share2127)} | ${pct(b.shareBankrupt)} | ${pct(b.shareAbandoned)} | ${b.medianBankruptYear ?? '—'} |`);
  }
  out();

  out(`## 2. Valori mediani a fine partita`);
  out();
  out(`Fondi in milioni di euro; lavoro in persone; coscienza e reputazione da -100 a +100.`);
  out();
  out(`| Bot | Fondi propri | Fondo statale | Fondo europeo | Fondi privati | Occupati locali | Cassa integrati | Disoccupati | Coscienza | Reputazione | Fiducia media | Scandali |`);
  out(`| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`);
  for (const b of report.bots) {
    const m = b.medians;
    out(
      `| ${b.nome} | ${num(m.fundsOwn, 1)} | ${num(m.fundsState, 1)} | ${num(m.fundsEu, 1)} | ${num(m.fundsPrivate, 1)} | ${num(m.localEmployed)} | ${num(m.onWageSupport)} | ${num(m.unemployed)} | ${num(m.conscience, 1)} | ${num(m.reputation, 1)} | ${num(m.averageTrust, 1)} | ${num(m.scandals, 1)} |`,
    );
  }
  out();
  out(`Qualità dell'aria (100 = aria pulita) e fiducia, per quartiere:`);
  out();
  out(`| Bot | ${DISTRICT_IDS.map((id) => `Aria ${SHORT[id]}`).join(' | ')} | ${DISTRICT_IDS.map((id) => `Fiducia ${SHORT[id]}`).join(' | ')} |`);
  out(`| --- |${' ---: |'.repeat(DISTRICT_IDS.length * 2)}`);
  for (const b of report.bots) {
    const air = DISTRICT_IDS.map((id) => num(b.medians.airQuality[id], 1)).join(' | ');
    const trust = DISTRICT_IDS.map((id) => num(b.medians.trust[id], 1)).join(' | ');
    out(`| ${b.nome} | ${air} | ${trust} |`);
  }
  out();
  out(`Esposizione accumulata (100 = massima) e salute, per quartiere, e terreni contaminati dell'area industriale:`);
  out();
  out(`| Bot | ${DISTRICT_IDS.map((id) => `Esposizione ${SHORT[id]}`).join(' | ')} | ${DISTRICT_IDS.map((id) => `Salute ${SHORT[id]}`).join(' | ')} | Terreni area ind. |`);
  out(`| --- |${' ---: |'.repeat(DISTRICT_IDS.length * 2 + 1)}`);
  for (const b of report.bots) {
    const exposure = DISTRICT_IDS.map((id) => num(b.medians.exposure[id], 1)).join(' | ');
    const health = DISTRICT_IDS.map((id) => num(b.medians.health[id], 1)).join(' | ');
    out(`| ${b.nome} | ${exposure} | ${health} | ${num(b.medians.industrialSoil, 1)} |`);
  }
  out();

  out(`## 3. Bot con lo stesso esito in più del 90% delle partite`);
  out();
  const same = report.bots.filter((b) => b.sameOutcome !== null);
  if (same.length === 0) out(`Nessuno.`);
  for (const b of same) {
    const labels: Record<string, string> = {
      'ended-2127': 'arriva al 2127',
      'ended-bankrupt': 'finisce in dissesto',
      'ended-abandoned': 'finisce con la città che si volta',
    };
    const label = labels[b.sameOutcome!.status] ?? b.sameOutcome!.status;
    out(`- ${alert(`${b.nome}: ${label} nel ${pct(b.sameOutcome!.share)} delle partite.`)}`);
  }
  out();

  out(`## 4. Variabili che crescono o calano senza limite`);
  out();
  out(`Mediane ai turni ${CHECKPOINTS.join(', ')} (anni ${CHECKPOINTS.map((t) => 2027 + t).join(', ')}), tra le partite ancora in corso.`);
  out();
  if (report.trends.length === 0) out(`Nessuna.`);
  for (const t of report.trends) {
    out(`- ${alert(`${names[t.botId]}: ${t.variable} ${t.direction} senza rallentare (${t.values.map((v) => num(v, 1)).join(' → ')}).`)}`);
  }
  out();

  out(`## 5. Leve mai usate o sempre convenienti`);
  out();
  if (report.neverUsed.length === 0) out(`Nessuna leva è rimasta inutilizzata da tutti i bot.`);
  for (const lever of report.neverUsed) out(`- ${alert(`${lever}: mai usata da nessun bot.`)}`);
  out();
  if (report.alwaysConvenient.length === 0) out(`Nessuna leva risulta sempre conveniente nelle partite del bot casuale.`);
  if (report.alwaysConvenient.length > 0) {
    out(`Confronto nelle partite del bot casuale tra chi ha usato la leva nei primi ${EARLY_TURNS} anni e chi no (per i dilemmi: chi ha scelto un'altra opzione dello stesso dilemma).`);
    out();
  }
  for (const c of report.alwaysConvenient) {
    out(
      `- ${alert(`${c.lever}: sempre conveniente per il bot casuale. Con la leva (${c.used.games} partite): ${pct(c.used.share2127)} al 2127, fondi propri ${num(c.used.fundsOwn, 1)}, occupati ${num(c.used.localEmployed)}, reputazione ${num(c.used.reputation, 1)}. Senza (${c.notUsed.games}): ${pct(c.notUsed.share2127)}, ${num(c.notUsed.fundsOwn, 1)}, ${num(c.notUsed.localEmployed)}, ${num(c.notUsed.reputation, 1)}.`)}`,
    );
  }
  out();
  out(`Quota di partite in cui ogni leva è stata usata, per bot:`);
  out();
  out(`| Leva | ${report.bots.map((b) => b.botId).join(' | ')} |`);
  out(`| --- |${' ---: |'.repeat(report.bots.length)}`);
  for (const s of report.levers) out(`| ${s.lever} | ${report.bots.map((b) => pct(s.useByBot[b.botId] ?? 0)).join(' | ')} |`);
  out();
  return lines.join('\n');
}
