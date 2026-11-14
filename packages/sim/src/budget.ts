/**
 * Bilancio dell'anno, per l'interfaccia: che cosa succede ai fondi chiudendo
 * l'anno in corso, voce per voce. Funzioni pure: lavorano su una copia e la
 * buttano. Usano lo stesso codice del turno, quindi la previsione coincide con
 * ciò che farà advanceTurn se nel frattempo non si fa nulla.
 */
import { newLedger, type LedgerEntry, type StalledProject } from './ledger.js';
import type { TurnRules } from './rules.js';
import { yearOfTurn, type FundKind, type GameState } from './state.js';
import { closeYearInPlace } from './turn.js';

export interface YearBudget {
  /** Anno che si chiude. */
  year: number;
  /** Fondi prima della chiusura. */
  start: Record<FundKind, number>;
  /** Fondi dopo la chiusura. */
  end: Record<FundKind, number>;
  /** Movimenti voce per voce, nell'ordine del turno. */
  entries: LedgerEntry[];
  /** Cantieri che non avanzano, con il motivo. */
  stalled: StalledProject[];
  /** Capacità di spesa degli uffici nell'anno e quanta ne usano i cantieri (milioni). */
  capacity: { total: number; used: number; free: number };
  /** Anni di disavanzo consecutivi dopo la chiusura. */
  deficitYears: number;
  /**
   * Anni di disavanzo che mancano al dissesto dopo questa chiusura, se la cassa
   * resta in rosso; null se la cassa chiude in attivo. 0: dissesto con questa chiusura.
   */
  yearsToBankruptcy: number | null;
}

/**
 * Previsione della chiusura dell'anno in corso. Un dilemma aperto si ignora:
 * la previsione mostra l'anno come andrebbe dopo la risposta, prima dei suoi effetti.
 */
export function forecastYear(state: GameState, rules: TurnRules): YearBudget {
  const next = structuredClone(state);
  next.openDilemmaId = null;
  const start = { ...next.economy.funds };
  const ledger = newLedger();
  const total = next.economy.spendingCapacity;
  if (next.status === 'running') closeYearInPlace(next, rules, ledger);
  const deficitYears = next.economy.deficitYears;
  return {
    year: yearOfTurn(state.turn),
    start,
    end: { ...next.economy.funds },
    entries: ledger.entries,
    stalled: ledger.stalled,
    capacity: { total, used: ledger.capacityUsed, free: Math.max(0, total - ledger.capacityUsed) },
    deficitYears,
    yearsToBankruptcy:
      next.economy.funds.own < 0 ? Math.max(0, rules.economy.bankruptcyAfterDeficitYears - deficitYears) : null,
  };
}

/** Capacità degli uffici: quanta spesa i cantieri già aperti useranno quest'anno e quanta ne resta. */
export function officeCapacity(state: GameState, rules: TurnRules): YearBudget['capacity'] {
  return forecastYear(state, rules).capacity;
}
