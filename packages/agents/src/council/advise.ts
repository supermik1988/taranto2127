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

/** Proposte ordinate di una visione: un lotto fermo verso la sua strada, poi opere, poi politiche. */
function candidates(state: GameState, vision: VisionRules, labels: CouncilLabels): Candidate[] {
  const out: Candidate[] = [];
  if (vision.lotPath !== undefined) {
    const idle = state.plantLots.find((l) => l.path === 'idle');
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

  for (const candidate of candidates(state, vision, labels)) {
    if (allowed(state, candidate.action, rules)) {
      const reason = fill(urgent ? vision.alarmReason : vision.reason, { azione: candidate.label });
      return { ...base, action: candidate.action, reason, shortcut: false };
    }
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
