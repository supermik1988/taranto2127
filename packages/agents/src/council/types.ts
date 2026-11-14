import type { Action, ActivePath, ProjectPhase, Vision } from '@taranto2127/sim';

/**
 * Indicatore che accende l'allarme di un consigliere: un percorso dello stato
 * (es. "districts.tamburi.airQuality") oppure una misura calcolata:
 * "@jobless" (quota di cassa integrati e disoccupati, 0-100) o "@averageTrust".
 */
export interface CouncilAlarm {
  target: string;
  comparator: '<' | '>';
  value: number;
}

/** Che cosa sostiene una visione e con quali parole. */
export interface VisionRules {
  /** Opere sostenute, in ordine di preferenza. */
  projects: string[];
  /** Politiche sostenute, in ordine di preferenza. */
  policies: string[];
  /** Strada preferita per i lotti fermi, se la visione ne ha una. */
  lotPath?: ActivePath;
  alarm: CouncilAlarm;
  /** Testi con {azione}: motivo normale e motivo con l'allarme acceso. */
  reason: string;
  alarmReason: string;
  /** Testo con {progetto} e {fase}: proposta di saltare una fase. */
  shortcutReason: string;
  /** Testo quando non ha nulla da proporre. */
  noProposal: string;
}

export interface CouncilRules {
  /** Sotto questa pazienza un consigliere può proporre una scorciatoia. */
  patienceForShortcut: number;
  /** Per la visione dei conti: con l'allarme acceso propone di spegnere la politica più cara. */
  visions: Record<Vision, VisionRules>;
  /** Testo con {politica}: proposta di spegnere una politica per risparmiare. */
  savingReason: string;
}

/** Nomi leggibili per i testi dei consigli. */
export interface CouncilLabels {
  projects: Record<string, string>;
  policies: Record<string, string>;
  lots: Record<string, string>;
  paths: Record<ActivePath, string>;
  phases: Partial<Record<ProjectPhase, string>>;
}

export interface CouncilAdvice {
  councillorId: string;
  name: string;
  vision: Vision;
  /** Azione proposta, già verificata come ammessa dal motore; null se non propone nulla. */
  action: Action | null;
  /** Il motivo, in italiano. */
  reason: string;
  /** true se l'allarme della sua visione è acceso. */
  urgent: boolean;
  /** true se propone di saltare una fase. */
  shortcut: boolean;
}
