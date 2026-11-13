import { expect, it } from 'vitest';
import { PACKAGE_NAME } from './index.js';

it('il pacchetto si carica', () => {
  expect(PACKAGE_NAME).toBe('@taranto2127/balance');
});
