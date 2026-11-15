/**
 * Aspetto dei lotti sul plastico e valori dello strato, letti dallo stato del
 * motore (regola 1). Non dipende dai dati geografici: lo usano anche l'elenco
 * testuale e la mappa schematica, senza caricare il plastico.
 */
import type { DistrictId, GameState } from '@taranto2127/sim';
import { indicatorColor, type MapIndicator } from '../map.js';

/** I sei aspetti di un lotto sul plastico. */
export type LotLook = 'fermo' | 'lavori' | 'acciaio' | 'bosco' | 'energia' | 'mare';
export const LOT_LOOKS: LotLook[] = ['fermo', 'lavori', 'acciaio', 'bosco', 'energia', 'mare'];

export const LOT_LOOK_NAMES: Record<LotLook, string> = {
  fermo: 'fermo: impianti spenti e ruggine',
  lavori: 'cantiere aperto: gru e recinzioni',
  acciaio: 'acciaio con forni nuovi: capannoni nuovi, un camino con poco fumo',
  bosco: 'bonifica conclusa: bosco giovane',
  energia: 'energia: pale e pannelli',
  mare: 'mare e cultura: banchine aperte ed edifici pubblici',
};

/**
 * Aspetto di un lotto: lavori se un suo progetto è nella fase dei lavori;
 * l'aspetto della strada quando il progetto è in esercizio; bosco giovane se è
 * stato bonificato e poi lasciato fermo; altrimenti fermo (anche durante
 * progettazione, autorizzazioni e gara: sul terreno non si vede ancora nulla).
 */
export function lotLook(state: GameState, lotId: string): LotLook {
  const lot = state.plantLots.find((l) => l.id === lotId);
  if (lot === undefined) return 'fermo';
  if (state.projects.some((p) => p.lotId === lotId && p.phase === 'works')) return 'lavori';
  if (lot.path !== 'idle' && lot.progress >= 1) {
    return ({ 'green-steel': 'acciaio', remediation: 'bosco', energy: 'energia', 'sea-culture': 'mare' } as const)[lot.path];
  }
  if (lot.remediated) return 'bosco';
  return 'fermo';
}

// ---------- Strati ----------

export interface LayerValue {
  value: number;
  color: string;
}

/** Valore e colore di ogni quartiere per l'indicatore scelto: lo stesso colore della mappa schematica. */
export function layerValues(state: GameState, indicator: MapIndicator): Record<DistrictId, LayerValue> {
  return Object.fromEntries(
    Object.entries(state.districts).map(([id, d]) => [id, { value: d[indicator], color: indicatorColor(d[indicator], indicator) }]),
  ) as Record<DistrictId, LayerValue>;
}
