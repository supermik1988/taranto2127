/** T10: in 1.000 partite casuali nessun dilemma torna prima del suo intervallo. */
import { describe, expect, it } from 'vitest';
import { checkDilemmaInterval } from './test-support/dilemma-interval.js';

describe('intervallo dei dilemmi in 1.000 partite casuali', { timeout: 120_000 }, () => {
  const seen = checkDilemmaInterval(1, 1000);
  // Il giocatore casuale arriva di rado all'ultima epoca: basta che quasi tutti i dilemmi arrivino almeno una volta.
  it('quasi tutti i dilemmi arrivano almeno una volta', () => expect(seen.size).toBeGreaterThanOrEqual(22));
});
