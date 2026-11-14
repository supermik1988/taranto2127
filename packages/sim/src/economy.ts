/** Entrate, spese obbligate, pagamenti dai fondi e rate europee. */
import type { EconomyRules } from './rules.js';
import { yearOfTurn, type FundKind, type GameState } from './state.js';

const totalEmployed = (state: GameState): number =>
  Object.values(state.labor.employed).reduce((sum, n) => sum + n, 0);

export function collectRevenue(state: GameState, economy: EconomyRules, closing: number): void {
  const { funds } = state.economy;
  funds.own += economy.ownRevenuePerWorker * totalEmployed(state) * (state.economy.averageIncome / 100);
  funds.state += economy.stateTransferPerYear;
  const year = yearOfTurn(closing);
  for (const tranche of economy.euTranches) {
    if (tranche.arrivesInYear !== year) continue;
    funds['eu-earmarked'] += tranche.amount;
    state.economy.euTranches.push({
      id: tranche.id,
      remaining: tranche.amount,
      expiresOnTurn: closing + (tranche.expiresInYear - tranche.arrivesInYear),
    });
  }
}

/**
 * Cassa integrazione dal fondo statale: se non basta, chi resta scoperto
 * diventa disoccupato. Servizi dai fondi propri, anche in disavanzo.
 */
export function payMandatorySpending(state: GameState, economy: EconomyRules): void {
  const { funds } = state.economy;
  const { labor } = state;
  const costPerPerson = economy.wageSupportCostPerPerson;
  if (costPerPerson > 0) {
    const covered = Math.min(labor.onWageSupport, Math.floor(funds.state / costPerPerson));
    const uncovered = labor.onWageSupport - covered;
    funds.state -= covered * costPerPerson;
    labor.onWageSupport = covered;
    labor.unemployed += uncovered;
  }
  funds.own -= economy.servicesCostPerYear;
}

/** Paga da un fondo; per il fondo europeo consuma prima le rate che scadono prima. */
export function payFrom(state: GameState, fund: FundKind, amount: number): void {
  state.economy.funds[fund] -= amount;
  if (fund !== 'eu-earmarked') return;
  let left = amount;
  const tranches = [...state.economy.euTranches].sort((a, b) => a.expiresOnTurn - b.expiresOnTurn);
  for (const tranche of tranches) {
    if (left <= 0) break;
    const used = Math.min(tranche.remaining, left);
    tranche.remaining -= used;
    left -= used;
  }
}

/** A fine anno la parte non spesa delle rate in scadenza viene tolta dal fondo europeo. */
export function expireEuTranches(state: GameState, closing: number): void {
  const { economy } = state;
  for (const tranche of economy.euTranches.filter((t) => t.expiresOnTurn <= closing)) {
    economy.funds['eu-earmarked'] -= Math.min(tranche.remaining, economy.funds['eu-earmarked']);
  }
  economy.euTranches = economy.euTranches.filter((t) => t.expiresOnTurn > closing && t.remaining > 0);
}
