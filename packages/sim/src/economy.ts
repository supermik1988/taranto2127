/** Entrate, spese obbligate, pagamenti dai fondi e rate europee. */
import { TurnError } from './errors.js';
import { INDEX, clampToBounds } from './limits.js';
import type { EconomyRules } from './rules.js';
import { yearOfTurn, type FundKind, type GameState } from './state.js';
import { DISTRICT_IDS } from './validate.js';

const totalEmployed = (state: GameState): number =>
  Object.values(state.labor.employed).reduce((sum, n) => sum + n, 0);

/** Tolleranza per i residui della virgola mobile nei pagamenti (milioni). */
const ROUNDING_TOLERANCE = 1e-6;

/**
 * Toglie `amount` da un fondo. Solo i fondi propri possono andare in
 * disavanzo: per gli altri un residuo negativo dovuto alla virgola mobile si
 * azzera, mentre uno scoperto vero è un errore del motore.
 */
export function debit(state: GameState, fund: FundKind, amount: number): void {
  const { funds } = state.economy;
  funds[fund] -= amount;
  if (fund !== 'own' && funds[fund] < 0) {
    if (funds[fund] > -ROUNDING_TOLERANCE) funds[fund] = 0;
    else throw new TurnError(`fondo ${fund} scoperto di ${-funds[fund]} milioni`);
  }
}

/** Entrate dell'anno. Le entrate proprie sono moltiplicate per il senso civico. */
export function collectRevenue(state: GameState, economy: EconomyRules, closing: number, civic = 1): void {
  const { funds } = state.economy;
  funds.own += economy.ownRevenuePerWorker * totalEmployed(state) * (state.economy.averageIncome / 100) * civic;
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
    debit(state, 'state', covered * costPerPerson);
    labor.onWageSupport = covered;
    labor.unemployed += uncovered;
  }
  funds.own -= economy.servicesCostPerYear;
}

/** Paga da un fondo; per il fondo europeo consuma prima le rate che scadono prima. */
export function payFrom(state: GameState, fund: FundKind, amount: number): void {
  debit(state, fund, amount);
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

/** A fine anno la parte del fondo statale oltre il tetto di riporto torna allo Stato. */
export function capStateFund(state: GameState, economy: EconomyRules): void {
  state.economy.funds.state = Math.min(state.economy.funds.state, economy.stateCarryOverCap);
}

/**
 * A fine anno l'avanzo dei fondi propri oltre la riserva si spende in servizi:
 * ogni quartiere guadagna punti in proporzione ai milioni spesi.
 */
export function spendOwnSurplus(state: GameState, economy: EconomyRules): void {
  const surplus = state.economy.funds.own - economy.ownSurplusReserve;
  if (!(surplus > 0)) return;
  state.economy.funds.own = economy.ownSurplusReserve;
  const gain = surplus * economy.servicesPerSurplusMillion;
  for (const id of DISTRICT_IDS) {
    const district = state.districts[id];
    district.services = clampToBounds(district.services + gain, INDEX);
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
