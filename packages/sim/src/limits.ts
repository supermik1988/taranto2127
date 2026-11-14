import { TOTAL_TURNS } from './state.js';

/**
 * Intervalli ammessi per le variabili numeriche dello stato. È l'unica tabella
 * dei limiti: validateState la usa per controllare, gli effetti per fermarsi
 * al limite invece di superarlo.
 */
export type Bounds = readonly [min: number, max: number];

export const INDEX: Bounds = [0, 100];
export const NON_NEGATIVE: Bounds = [0, Infinity];
export const MORAL: Bounds = [-100, 100];
export const SHARE: Bounds = [0, 1];
export const FREE: Bounds = [-Infinity, Infinity];

/** Percorso (es. "districts.tamburi.health") → intervallo. Vince la prima regola che corrisponde. */
const RULES: readonly (readonly [RegExp, Bounds])[] = [
  [/^turn$/, [0, TOTAL_TURNS]],
  [/^districts\.[^.]+\.population\.[^.]+$/, NON_NEGATIVE],
  [/^districts\.[^.]+\.[^.]+$/, INDEX],
  [/^labor\./, NON_NEGATIVE],
  [/^economy\.averageIncome$/, INDEX],
  // I fondi propri possono andare in disavanzo.
  [/^economy\.funds\.own$/, FREE],
  [/^economy\./, NON_NEGATIVE],
  // Indice aperto verso l'alto: 100 = livello del 2026.
  [/^climate\.co2Emissions$/, NON_NEGATIVE],
  // Centimetri, non indice.
  [/^climate\.seaLevelRiseCm$/, FREE],
  [/^climate\./, INDEX],
  [/^moral\.(conscience|reputation)$/, MORAL],
  [/^moral\.byDimension\.[^.]+$/, MORAL],
  // Nello stato il Consiglio si visita per posizione; negli effetti si indica per id.
  [/^council\.[^.]+\.(trustInPlayer|patience)$/, INDEX],
  [/^plantLots\.\d+\.progress$/, SHARE],
];

export function boundsFor(path: string): Bounds {
  for (const [pattern, bounds] of RULES) if (pattern.test(path)) return bounds;
  return FREE;
}

/** true se `value` è un numero dentro l'intervallo. NaN non lo è mai. */
export const withinBounds = (value: number, [min, max]: Bounds): boolean => value >= min && value <= max;

export const clampToBounds = (value: number, [min, max]: Bounds): number => Math.min(max, Math.max(min, value));
