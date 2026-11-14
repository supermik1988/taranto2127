/**
 * Registro dei movimenti di un anno: serve al pannello del bilancio. Il motore
 * lo compila solo se glielo si passa; senza registro il turno è identico.
 */
import type { FundKind, GameState } from './state.js';

/** Voce del bilancio: da dove vengono o dove vanno i soldi. */
export type LedgerKey =
  | 'revenue' // entrate dell'anno: tributi locali, trasferimento statale, rate europee in arrivo
  | 'mandatory' // spese obbligate: cassa integrazione e servizi ordinari
  | 'policy' // una politica attiva
  | 'policies' // altri movimenti delle politiche (effetti sui fondi)
  | 'project' // un cantiere in costruzione
  | 'projects' // opere in esercizio: entrate e costi ricorrenti
  | 'eu-expired' // rate europee scadute e perse
  | 'effects' // conseguenze ritardate di scelte passate
  | 'scandals' // conseguenze degli scandali
  | 'state-returned' // fondi statali oltre il tetto di riporto, restituiti
  | 'surplus'; // avanzo della cassa speso in servizi

export interface LedgerEntry {
  key: LedgerKey;
  fund: FundKind;
  /** Milioni: positivo se entra, negativo se esce. */
  amount: number;
  /** Progetto o politica a cui si riferisce la voce, se c'è. */
  ref?: string;
}

/** Cantiere che nell'anno non avanza, e perché. */
export interface StalledProject {
  projectId: string;
  reason: 'funds' | 'capacity' | 'frozen';
}

export interface YearLedger {
  entries: LedgerEntry[];
  stalled: StalledProject[];
  /** Milioni di capacità di spesa usati dai cantieri. */
  capacityUsed: number;
}

export const newLedger = (): YearLedger => ({ entries: [], stalled: [], capacityUsed: 0 });

const FUNDS: readonly FundKind[] = ['own', 'state', 'eu-earmarked', 'private'];
/** Sotto questa soglia (milioni) una differenza è un residuo della virgola mobile. */
const NEGLIGIBLE = 1e-9;

/**
 * Esegue un passo del turno. Con un registro, ogni variazione dei fondi non già
 * annotata voce per voce dentro il passo viene registrata con la chiave del passo.
 */
export function trackStep(state: GameState, ledger: YearLedger | undefined, key: LedgerKey, run: () => void): void {
  if (ledger === undefined) {
    run();
    return;
  }
  const before = { ...state.economy.funds };
  const firstItem = ledger.entries.length;
  run();
  const items = ledger.entries.slice(firstItem);
  for (const fund of FUNDS) {
    const itemized = items.filter((e) => e.fund === fund).reduce((sum, e) => sum + e.amount, 0);
    const rest = state.economy.funds[fund] - before[fund] - itemized;
    if (Math.abs(rest) > NEGLIGIBLE) ledger.entries.push({ key, fund, amount: rest });
  }
}
