// @ts-check
import tseslint from 'typescript-eslint';

/**
 * Regola 3 di CLAUDE.md: determinismo. In `sim` e `agents` sono vietati
 * Math.random() e Date.now(): si usa il generatore con seme di `sim/rng`.
 */
export const DETERMINISM_MESSAGE =
  'Vietato in sim e agents (CLAUDE.md, regola 3): usa il generatore con seme in sim/rng.';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', 'docs/schermate/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['packages/sim/**/*.{ts,tsx,js,mjs,cjs}', 'packages/agents/**/*.{ts,tsx,js,mjs,cjs}'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: DETERMINISM_MESSAGE },
        { object: 'Date', property: 'now', message: DETERMINISM_MESSAGE },
      ],
    },
  },
);
