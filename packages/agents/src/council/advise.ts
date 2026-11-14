/**
 * Il Consiglio: ogni consigliere, secondo la sua visione e l'andamento della
 * città, propone un'azione e ne dice il motivo. Regole semplici e
 * deterministiche; pesi e testi dai dati.
 */
import {
  ActionError,
  applyAction,
  averageTrust,
  joblessShare,
  readNumber,
  type Action,
  type Councillor,
  type GameState,
  type TurnRules,
} from '@taranto2127/sim';
import type { CouncilAdvice, CouncilAlarm, CouncilLabels, CouncilRules, VisionRules } from './types.js';

/** Valore dell'indicatore di un allarme. */
export function alarmValue(state: GameState, target: string): number {
  if (target === '@jobless') return joblessShare(state);
  if (target === '@averageTrust') return averageTrust(state);
  return readNumber(state, target);
}

export function alarmOn(state: GameState, alarm: CouncilAlarm): boolean {
  const value = alarmValue(state, alarm.target);
  return alarm.comparator === '<' ? value < alarm.value : value > alarm.value;
}

/** true se il motore accetterebbe l'azione adesso. */
function allowed(state: GameState, action: Action, rules: TurnRules): boolean {
  try {
    applyAction(state, action, rules);
    return true;
  } catch (error) {
    if (error instanceof ActionError) return false;
    throw error;
  }
}

const fill = (text: string, values: Record<string, string>): string =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

interface Candidate {
  action: Action;
  label: string;
}

/** Il quartiere citato dall'allarme, se l'allarme guarda un quartiere (es. "districts.paolo-vi.services"). */
export function alarmDistrict(alarm: CouncilAlarm): string | undefined {
  const parts = alarm.target.split('.');
  return parts[0] === 'districts' ? parts[1] : undefined;
}

/** true se gli effetti dichiarati di un'azione toccano il quartiere. */
export function actionConcerns(action: Action, district: string, rules: TurnRules): boolean {
  const touches = (effects: { deltas: { target: string }[] }[]) =>
    effects.some((e) => e.deltas.some((d) => d.target.startsWith(`districts.${district}.`)));
  const project = (id: string | undefined) => {
    const def = id === undefined ? undefined : rules.projects[id];
    return def !== undefined && touches([def.operatingEffects.once, def.operatingEffects.everyYear]);
  };
  switch (action.kind) {
    case 'start-project':
      return project(action.definitionId);
    case 'convert-lot':
      return action.path !== 'idle' && project(rules.lotConversion[action.path]);
    case 'set-policy': {
      const policy = rules.policies[action.policyId];
      return policy !== undefined && touches([policy.everyYear]);
    }
    default:
      return false;
  }
}

/**
 * Di quanto un'azione migliora proprio la grandezza in allarme, secondo i suoi
 * effetti dichiarati: positivo se la sposta nella direzione giusta, 0 se non la tocca.
 */
export function alarmRelief(action: Action, alarm: CouncilAlarm, rules: TurnRules): number {
  const sum = (effects: { deltas: { target: string; amount: number }[] }[]) =>
    effects.flatMap((e) => e.deltas).filter((d) => d.target === alarm.target).reduce((a, d) => a + d.amount, 0);
  const project = (id: string | undefined) => {
    const def = id === undefined ? undefined : rules.projects[id];
    return def === undefined ? 0 : sum([def.operatingEffects.once, def.operatingEffects.everyYear]);
  };
  let amount = 0;
  if (action.kind === 'start-project') amount = project(action.definitionId);
  else if (action.kind === 'convert-lot' && action.path !== 'idle') amount = project(rules.lotConversion[action.path]);
  else if (action.kind === 'set-policy' && action.active) {
    const policy = rules.policies[action.policyId];
    amount = policy === undefined ? 0 : sum([policy.everyYear]);
  }
  // Allarme "troppo alto" (>): serve un calo; "troppo basso" (<): serve un aumento.
  return alarm.comparator === '>' ? -amount : amount;
}

/**
 * Proposte ordinate di una visione: il primo lotto fermo del suo ordine verso
 * la sua strada, poi opere, poi politiche.
 */
function candidates(state: GameState, vision: VisionRules, labels: CouncilLabels): Candidate[] {
  const out: Candidate[] = [];
  if (vision.lotPath !== undefined) {
    const idle = (vision.lotOrder ?? []).map((id) => state.plantLots.find((l) => l.id === id)).find((l) => l?.path === 'idle');
    if (idle !== undefined) {
      out.push({
        action: { kind: 'convert-lot', lotId: idle.id, path: vision.lotPath },
        label: `destinare il lotto «${labels.lots[idle.id] ?? idle.id}» verso ${labels.paths[vision.lotPath]}`,
      });
    }
  }
  for (const id of vision.projects) {
    out.push({ action: { kind: 'start-project', definitionId: id }, label: `avviare «${labels.projects[id] ?? id}»` });
  }
  for (const id of vision.policies) {
    if (state.activePolicies.includes(id)) continue;
    out.push({ action: { kind: 'set-policy', policyId: id, active: true }, label: `accendere «${labels.policies[id] ?? id}»` });
  }
  return out;
}

/** Progetti a cui tiene una visione: le sue opere e il progetto di riconversione della sua strada. */
function caresAbout(definitionId: string, vision: VisionRules, rules: TurnRules): boolean {
  return vision.projects.includes(definitionId) || (vision.lotPath !== undefined && rules.lotConversion[vision.lotPath] === definitionId);
}

function adviseOne(
  state: GameState,
  member: Councillor,
  rules: TurnRules,
  council: CouncilRules,
  labels: CouncilLabels,
): CouncilAdvice {
  const vision = council.visions[member.vision];
  const urgent = alarmOn(state, vision.alarm);
  const base = { councillorId: member.id, name: member.name, vision: member.vision, urgent };

  // Con poca pazienza: saltare la fase di un cantiere che gli sta a cuore.
  if (member.patience < council.patienceForShortcut) {
    const stuck = state.projects.find(
      (p) => (p.phase === 'permitting' || p.phase === 'tender') && caresAbout(p.definitionId, vision, rules),
    );
    if (stuck !== undefined) {
      const action: Action = { kind: 'shortcut-phase', projectId: stuck.id };
      if (allowed(state, action, rules)) {
        const reason = fill(vision.shortcutReason, {
          progetto: labels.projects[stuck.definitionId] ?? stuck.definitionId,
          fase: labels.phases[stuck.phase] ?? stuck.phase,
        });
        return { ...base, action, reason, shortcut: true };
      }
    }
  }

  // Conti in allarme: spegnere la politica più cara pagata con i fondi propri.
  if (member.vision === 'public-accounts' && urgent) {
    const costly = state.activePolicies
      .map((id) => rules.policies[id])
      .filter((p) => p !== undefined && p.fund === 'own')
      .sort((a, b) => b!.annualCost - a!.annualCost || a!.id.localeCompare(b!.id));
    for (const policy of costly) {
      const action: Action = { kind: 'set-policy', policyId: policy!.id, active: false };
      if (allowed(state, action, rules)) {
        return { ...base, action, reason: fill(council.savingReason, { politica: labels.policies[policy!.id] ?? policy!.id }), shortcut: false };
      }
    }
  }

  const all = candidates(state, vision, labels).filter((c) => allowed(state, c.action, rules));
  // Con l'allarme acceso, prima le azioni che migliorano proprio la grandezza in allarme, dalla più efficace;
  // l'ordine dei lotti e delle opere vale a parità.
  if (urgent) {
    const relief = all
      .map((c, i) => ({ c, i, r: alarmRelief(c.action, vision.alarm, rules) }))
      .filter((x) => x.r > 0)
      .sort((a, b) => b.r - a.r || a.i - b.i);
    const best = relief[0];
    if (best !== undefined) {
      return { ...base, action: best.c.action, reason: fill(vision.alarmReason, { azione: best.c.label }), shortcut: false };
    }
  }
  // Con l'allarme su un quartiere, il motivo cita quel quartiere: la proposta deve riguardarlo.
  const district = urgent ? alarmDistrict(vision.alarm) : undefined;
  const focused = district === undefined ? all : all.filter((c) => actionConcerns(c.action, district, rules));
  const chosen = focused[0];
  if (urgent && chosen !== undefined) {
    return { ...base, action: chosen.action, reason: fill(vision.alarmReason, { azione: chosen.label }), shortcut: false };
  }
  // Allarme senza proposte per quel quartiere, o nessun allarme: motivo generale, che non cita quartieri.
  const general = district === undefined ? chosen : all[0];
  if (general !== undefined) {
    const text = urgent && district === undefined ? vision.alarmReason : vision.reason;
    return { ...base, action: general.action, reason: fill(text, { azione: general.label }), shortcut: false };
  }
  return { ...base, action: null, reason: vision.noProposal, shortcut: false };
}

/**
 * I consigli dei consiglieri in carica, nell'ordine del Consiglio. Funzione
 * pura: a parità di stato, regole e testi, gli stessi consigli.
 */
export function adviseCouncil(state: GameState, rules: TurnRules, council: CouncilRules, labels: CouncilLabels): CouncilAdvice[] {
  return state.council.map((member) => adviseOne(state, member, rules, council, labels));
}
