/** T10: in 1.000 partite casuali nessun dilemma torna prima dell'intervallo (blocco 2 di 4). */
import { describe } from 'vitest';
import { checkDilemmaInterval } from './test-support/dilemma-interval.js';

describe('intervallo dei dilemmi, partite casuali', { timeout: 300_000 }, () => {
  checkDilemmaInterval(251, 250);
});
