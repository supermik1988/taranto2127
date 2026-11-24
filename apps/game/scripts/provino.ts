/**
 * Schermate del provino della città isometrica (T12, fase A) in docs/schermate/:
 * isolato dei Tamburi, costa del Mar Piccolo, parchi minerali fermi e a bosco,
 * a 390 e a 1280 px; foglio di confronto dei tipi di edificio solo a 1280 px. Controlla anche che non ci
 * siano errori in console e annota ordini di disegno e triangoli di ogni vista.
 *
 *   pnpm --filter @taranto2127/game provino          (Edge)
 */
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = join(appDir, '..', '..', 'docs', 'schermate');
const PORT = 4180;
const BASE = `http://localhost:${PORT}/provino.html`;
const VISTE: [string, string][] = [
  ['isolato', 'vista=isolato'],
  ['costa', 'vista=costa'],
  ['parchi-fermo', 'vista=parchi&stato=fermo'],
  ['parchi-bosco', 'vista=parchi&stato=bosco'],
  ['tipi', 'vista=tipi'],
];

async function waitForServer(url: string, ms = 60_000): Promise<void> {
  const start = performance.now();
  while (performance.now() - start < ms) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // non ancora pronto
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`il server di sviluppo non risponde su ${url}`);
}

async function main(): Promise<void> {
  mkdirSync(shotsDir, { recursive: true });
  const server = spawn(`npx vite --port ${PORT} --strictPort`, { cwd: appDir, shell: true, stdio: 'ignore' });
  const problems: string[] = [];
  try {
    await waitForServer(BASE);
    const browser = await chromium.launch({ channel: process.env['BROWSER'] === 'chrome' ? 'chrome' : 'msedge' });
    try {
      for (const width of [1280, 390]) {
        const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: width < 600 ? 2 : 1 });
        for (const [name, query] of VISTE) {
          if (name === 'tipi' && width < 600) continue; // il foglio di confronto è uno solo, largo
          const page = await context.newPage();
          page.on('console', (m) => m.type() === 'error' && problems.push(`${name} ${width}: ${m.text()}`));
          page.on('pageerror', (e) => problems.push(`${name} ${width}: ${e.message}`));
          await page.goto(`${BASE}?${query}`);
          await page.waitForFunction(() => (window as unknown as { provinoPronto?: boolean }).provinoPronto === true, undefined, { timeout: 120_000 });
          await page.waitForTimeout(400);
          await page.screenshot({ path: join(shotsDir, `provino-${name}-${width}.png`) });
          const info = await page.evaluate(() => {
            const w = window as unknown as { provinoInfo: unknown; provinoConteggio?: unknown; provinoAlberi?: unknown };
            return { provinoInfo: w.provinoInfo, provinoConteggio: w.provinoConteggio ?? null, provinoAlberi: w.provinoAlberi ?? null };
          });
          console.log(`${name} ${width}px: ${JSON.stringify({ disegno: info.provinoInfo, edifici: info.provinoConteggio, alberi: info.provinoAlberi })}`);
          await page.close();
        }
        await context.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    if (process.platform === 'win32' && server.pid !== undefined) execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
    else server.kill();
  }
  if (problems.length > 0) {
    for (const p of problems) console.error(`PROBLEMA: ${p}`);
    process.exit(1);
  }
  console.log(`Provino: schermate in ${shotsDir}.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
