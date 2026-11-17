import { defineConfig } from 'vitest/config';

// Prove lunghe (`pnpm test:lungo`): fuori da `pnpm test`, che deve restare sotto il minuto.
// Le esegue la procedura di GitHub a ogni invio su main.
export default defineConfig({
  test: {
    include: ['packages/**/src/**/*.lungo.ts', 'tools/**/src/**/*.lungo.ts'],
    testTimeout: 120_000,
  },
});
