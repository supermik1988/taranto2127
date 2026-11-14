import { defineConfig } from 'vitest/config';

// Test dell'interfaccia senza browser: i componenti si rendono in testo con react-dom/server.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
});
