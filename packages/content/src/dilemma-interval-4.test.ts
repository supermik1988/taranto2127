/** T10: in 1.000 partite casuali nessun dilemma torna prima dell'intervallo (blocco 4 di 4). */
import { describe, expect, it } from 'vitest';
import { checkDilemmaInterval } from './test-support/dilemma-interval.js';

describe('intervallo dei dilemmi, partite casuali', { timeout: 300_000 }, () => {
  const seen = checkDilemmaInterval(751, 250);
  // Il giocatore casuale arriva di rado all'ultima epoca: basta che quasi tutti i dilemmi arrivino almeno una volta.
  it('quasi tutti i dilemmi arrivano almeno una volta', () => expect(seen.size).toBeGreaterThanOrEqual(20));
});
