/** Controlli condivisi dalle azioni del giocatore. */
import { EffectError, assertApplicable, type EffectSet } from './effects.js';
import { ActionError } from './errors.js';
import type { GameState } from './state.js';
import { DISTRICT_IDS } from './validate.js';

export function assertDistrict(district: string | undefined): void {
  if (district !== undefined && !(DISTRICT_IDS as readonly string[]).includes(district)) {
    throw new ActionError(`quartiere inesistente: ${district}`);
  }
}

/** Identificativo dell'atto morale nato dall'azione che si sta applicando: unico nella partita. */
export const actSourceId = (state: GameState): string => `act-${state.turn}-${state.history.length}`;

/**
 * Controlla che gli effetti dei dati siano applicabili, così un errore emerge
 * subito. effects.ts rifiuta anche ogni bersaglio moral.* (CLAUDE.md, regola 5).
 */
export function assertDataEffects(state: GameState, sourceId: string, effects: EffectSet): void {
  try {
    assertApplicable(state, effects);
  } catch (error) {
    if (error instanceof EffectError) throw new ActionError(`${sourceId}: ${error.message}`);
    throw error;
  }
}
