import { execSync } from 'node:child_process';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { BERSAGLIO } from './src/bersaglio.js';

// Percorsi relativi: il gioco funziona sia in locale sia su GitHub Pages sotto /taranto2127/.
/** Versione del gioco registrata nei salvataggi (T12d): il commit da cui si compila, e il giorno. */
function versioneGioco(): string {
  try {
    return execSync('git log -1 --format=%h-%cs', { encoding: 'utf8' }).trim();
  } catch {
    return 'sconosciuta';
  }
}

export default defineConfig({
  define: { __VERSIONE_GIOCO__: JSON.stringify(versioneGioco()) },
  base: './',
  plugins: [react()],
  // Bersaglio dichiarato (T12d): Chrome e Chrome per Android 87, Samsung Internet 14, Edge 88,
  // Firefox 78, Safari e Safari per iOS 15. La sintassi più recente viene tradotta; le funzioni
  // recenti usate dal motore hanno un sostituto in src/compat.ts (elenco in docs/GRAFICA.md).
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000, target: BERSAGLIO },
});
