import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Percorsi relativi: il gioco funziona sia in locale sia su GitHub Pages sotto /taranto2127/.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
