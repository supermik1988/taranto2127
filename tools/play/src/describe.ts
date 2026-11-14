/** Parole per numeri, effetti, progetti, politiche e opzioni: ciò che il giocatore legge prima di scegliere. */
import type { LoadedContent } from '@taranto2127/content';
import {
  BUILD_PHASES,
  type Delta,
  type DilemmaOption,
  type EffectSet,
  type FundKind,
  type LaborMove,
  type PolicyDefinition,
  type ProjectDefinition,
} from '@taranto2127/sim';

/** Numero all'italiana, con la virgola. */
export const fmt = (value: number, digits = 0): string =>
  value.toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const signed = (value: number, digits = 1): string => `${value > 0 ? '+' : ''}${fmt(value, digits)}`;

export const FUND_NAMES: Record<FundKind, string> = {
  own: 'fondi propri',
  state: 'fondo statale',
  'eu-earmarked': 'fondo europeo',
  private: 'fondi privati',
};

const FIELD_NAMES: Record<string, string> = {
  airQuality: 'aria',
  contaminatedSoil: 'terreni contaminati',
  cumulativeExposure: 'esposizione',
  health: 'salute',
  services: 'servizi',
  greenCover: 'verde',
  floodRisk: 'rischio allagamenti',
  trust: 'fiducia',
  tension: 'tensione',
  belonging: 'appartenenza',
  averageIncome: 'reddito medio',
  supplierFirms: "imprese dell'indotto",
  spendingCapacity: 'capacità di spesa',
  co2Emissions: 'emissioni',
  summerHeat: 'caldo estivo',
  waterStress: 'stress idrico',
  seaLevelRiseCm: 'livello del mare',
  trustInPlayer: 'fiducia del consigliere',
  patience: 'pazienza del consigliere',
};

const LABOR_NAMES: Record<string, string> = {
  steel: 'nella siderurgia',
  remediation: 'nelle bonifiche',
  energy: "nell'energia",
  sea: 'nel mare e nel porto',
  'culture-tourism': 'nel turismo e nella cultura',
  services: 'nei servizi',
  public: 'nel pubblico',
  onWageSupport: 'in cassa integrazione',
  unemployed: 'tra i disoccupati',
  inTraining: 'in formazione',
};

export function describeDelta(delta: Delta, content: LoadedContent): string {
  const parts = delta.target.split('.');
  if (parts[0] === 'economy' && parts[1] === 'funds') {
    return `${FUND_NAMES[parts[2] as FundKind] ?? parts[2]} ${signed(delta.amount)} M€`;
  }
  const field = FIELD_NAMES[parts.at(-1)!] ?? parts.at(-1)!;
  if (parts[0] === 'districts') return `${field} ${content.texts.districts[parts[1]!]?.nome ?? parts[1]} ${signed(delta.amount)}`;
  if (parts[0] === 'council') {
    const member = content.initialContent.council.find((c) => c.id === parts[1]);
    return `${field} (${member?.name ?? parts[1]}) ${signed(delta.amount)}`;
  }
  return `${field} ${signed(delta.amount)}`;
}

export function describeMove(move: LaborMove): string {
  return `${fmt(move.count)} persone ${LABOR_NAMES[move.from] ?? move.from} → ${LABOR_NAMES[move.to] ?? move.to}`;
}

export function describeEffects(effects: EffectSet, content: LoadedContent): string {
  const parts = [...effects.deltas.map((d) => describeDelta(d, content)), ...(effects.laborMoves ?? []).map(describeMove)];
  return parts.length === 0 ? 'nessuno' : parts.join('; ');
}

/** Durata e costo previsti di un progetto, dalle fasi dei dati. */
export function projectForecast(def: ProjectDefinition): { minYears: number; maxYears: number; minCost: number; maxCost: number; funds: string } {
  let minYears = 0;
  let maxYears = 0;
  let minCost = 0;
  let maxCost = 0;
  const funds = new Set<string>();
  for (const phase of BUILD_PHASES) {
    const spec = def.phases[phase];
    minYears += spec.minTurns;
    maxYears += spec.maxTurns;
    minCost += spec.minTurns * spec.annualCost;
    maxCost += spec.maxTurns * spec.annualCost;
    if (spec.annualCost > 0 && spec.maxTurns > 0) funds.add(FUND_NAMES[spec.fund]);
  }
  return { minYears, maxYears, minCost, maxCost, funds: [...funds].join(', ') };
}

const PHASE_NAMES: Record<string, string> = { design: 'progettazione', permitting: 'autorizzazioni', tender: 'gara', works: 'lavori' };

export function describeProject(def: ProjectDefinition, content: LoadedContent): string[] {
  const text = content.texts.projects[def.id];
  const f = projectForecast(def);
  const phases = BUILD_PHASES.map((p) => {
    const s = def.phases[p];
    return `${PHASE_NAMES[p]} ${s.minTurns === s.maxTurns ? s.minTurns : `${s.minTurns}-${s.maxTurns}`}`;
  }).join(', ');
  return [
    `${text?.nome ?? def.id}${def.unique === true ? ' (si avvia una sola volta)' : ''}`,
    `  ${text?.descrizione ?? ''}`,
    `  Durata prevista: ${f.minYears}-${f.maxYears} anni (${phases})`,
    `  Costo previsto: ${fmt(f.minCost, 1)}-${fmt(f.maxCost, 1)} M€ (${f.funds || 'nessuna spesa'})`,
    `  Cantiere: ${fmt(def.worksJobs.count)} posti ${LABOR_NAMES[def.worksJobs.sector] ?? ''}`,
    `  All'entrata in esercizio: ${describeEffects(def.operatingEffects.once, content)}`,
    `  Ogni anno in esercizio: ${describeEffects(def.operatingEffects.everyYear, content)}`,
  ];
}

export function describePolicy(def: PolicyDefinition, content: LoadedContent): string[] {
  const text = content.texts.policies[def.id];
  const lines = [
    text?.nome ?? def.id,
    `  ${text?.descrizione ?? ''}`,
    `  Costo: ${fmt(def.annualCost, 1)} M€ l'anno dai ${FUND_NAMES[def.fund]}; si spegne dopo almeno ${def.minYearsActive} anni`,
    `  Ogni anno, se pagata: ${describeEffects(def.everyYear, content)}`,
  ];
  if (def.training !== undefined) {
    lines.push(`  Formazione: ${fmt(def.training.peoplePerYear)} persone l'anno, corsi di ${def.training.durationYears} anni`);
  }
  return lines;
}

/** Un'opzione di dilemma come la vede il giocatore: testo ed effetti dichiarati. Mai se è nascosta, mai i pesi morali. */
export function describeOption(option: DilemmaOption, label: string, consequences: string, content: LoadedContent): string[] {
  const lines = [label, `     ${consequences}`, `     Effetti subito: ${describeEffects(option.immediate, content)}`];
  for (const later of option.delayed) lines.push(`     Tra ${later.delayTurns} anni: ${describeEffects(later.effects, content)}`);
  if (option.promise !== undefined) lines.push(`     Promessa entro ${option.promise.dueInTurns} anni: ${option.promise.text}`);
  return lines;
}

/** Spezza una riga lunga in righe di al massimo `width` caratteri, con un rientro per le righe successive. */
export function wrap(line: string, width = 100): string[] {
  if (line.length <= width) return [line];
  const indent = /^\s*/.exec(line)![0];
  const continuation = `${indent}    `;
  const out: string[] = [];
  let current = indent;
  for (const word of line.slice(indent.length).split(' ')) {
    const empty = current.trim() === '';
    const next = empty ? current + word : `${current} ${word}`;
    if (next.length > width && !empty) {
      out.push(current);
      current = continuation + word;
    } else current = next;
  }
  if (current.trim() !== '') out.push(current);
  return out;
}
