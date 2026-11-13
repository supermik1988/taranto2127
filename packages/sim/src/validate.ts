import { boundsFor, withinBounds } from './limits.js';
import type { DistrictId, GameState } from './state.js';

/** Tutti i quartieri del contratto, in ordine fisso. */
export const DISTRICT_IDS = Object.keys({
  tamburi: true,
  'paolo-vi': true,
  'citta-vecchia': true,
  borgo: true,
  'talsano-lama-san-vito': true,
  'area-industriale': true,
} satisfies Record<DistrictId, true>) as readonly DistrictId[];

export interface ValidationResult {
  ok: boolean;
  /** Un messaggio per ogni violazione, con il percorso della variabile. */
  errors: string[];
}

/** Parti dello stato i cui numeri vengono confrontati con la tabella dei limiti. */
const CHECKED_ROOTS = [
  'turn',
  'districts',
  'labor',
  'economy',
  'climate',
  'moral',
  'council',
  'plantLots',
] as const satisfies readonly (keyof GameState)[];

/**
 * Controlla gli invarianti dello stato: ogni numero dentro l'intervallo di
 * limits.ts (indici 0-100, quantità non negative, contatori morali tra -100 e
 * +100, turno, avanzamento dei lotti) e nessun quartiere mancante. Non lancia
 * eccezioni: restituisce l'elenco completo delle violazioni.
 */
export function validateState(state: GameState): ValidationResult {
  const errors: string[] = [];

  for (const id of DISTRICT_IDS) {
    if (state.districts[id] === undefined) errors.push(`districts.${id}: quartiere mancante`);
  }

  const visit = (path: string, value: unknown): void => {
    if (typeof value === 'number') {
      const bounds = boundsFor(path);
      if (!withinBounds(value, bounds)) {
        const [min, max] = bounds;
        errors.push(
          min === 0 && max === Infinity
            ? `${path} = ${value}: non può essere negativo`
            : `${path} = ${value}: deve stare tra ${min} e ${max}`,
        );
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, child] of Object.entries(value)) visit(`${path}.${key}`, child);
    }
  };
  for (const root of CHECKED_ROOTS) visit(root, state[root]);

  return { ok: errors.length === 0, errors };
}
