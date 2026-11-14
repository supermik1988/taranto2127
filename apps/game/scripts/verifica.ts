/**
 * Verifica visiva con un browser automatico (Edge o Chrome già installati):
 * costruisce il gioco, gioca una partita da copione fino al finale, salva le
 * schermate in docs/schermate/ a 390 e a 1280 px, controlla che in console non
 * ci siano errori, che ricaricare la pagina riprenda la stessa partita e che a
 * 360 px nessuna schermata scorra in orizzontale.
 *
 *   pnpm --filter @taranto2127/game verifica          (Edge)
 *   BROWSER=chrome pnpm --filter @taranto2127/game verifica
 */
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright-core';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = join(appDir, '..', '..', 'docs', 'schermate');
const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;
const SEED = 7;
const problems: string[] = [];

function fail(message: string): void {
  problems.push(message);
  console.error(`PROBLEMA: ${message}`);
}

async function waitForServer(url: string, ms = 30_000): Promise<void> {
  const start = performance.now();
  while (performance.now() - start < ms) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // non ancora pronto
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`il server di anteprima non risponde su ${url}`);
}

const visible = async (page: Page, id: string) => (await page.locator(`[data-testid="${id}"]`).count()) > 0;
const click = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`).first().click();
const year = (page: Page) => page.locator('[data-testid="anno"]').textContent();

async function noHorizontalScroll(page: Page, where: string): Promise<void> {
  const ok = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  if (!ok) fail(`a 360 px la schermata «${where}» scorre in orizzontale`);
}

/** Un passo del copione: chiude finestre aperte, risponde ai dilemmi, altrimenti avanza. Restituisce che cosa ha fatto. */
async function step(page: Page): Promise<'cronaca' | 'dilemma' | 'finale' | 'avanza'> {
  if (await visible(page, 'cronaca')) {
    await click(page, 'continua');
    return 'cronaca';
  }
  if (await visible(page, 'dilemma')) {
    await page.locator('[data-testid="opzione"]').first().click();
    await click(page, 'scegli');
    if (await visible(page, 'avviso')) await page.locator('[data-testid="avviso"] button').click();
    return 'dilemma';
  }
  if (await visible(page, 'finale')) return 'finale';
  await click(page, 'avanza');
  return 'avanza';
}

async function playAt(width: number, browser: Awaited<ReturnType<typeof chromium.launch>>, checkReload: boolean): Promise<void> {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, hasTouch: width < 600 });
  const page = await context.newPage();
  page.on('console', (msg) => msg.type() === 'error' && fail(`errore in console (${width} px): ${msg.text()}`));
  page.on('pageerror', (err) => fail(`errore nella pagina (${width} px): ${err.message}`));
  // Pagina intera per le schede; solo la parte visibile per le finestre sovrapposte (dilemma, Cronaca).
  const shot = (name: string, fullPage = true) => page.screenshot({ path: join(shotsDir, `${name}-${width}.png`), fullPage });

  await page.goto(`${BASE}?seme=${SEED}`);
  await page.waitForSelector('[data-testid="mappa"]');
  await shot('mappa');

  await click(page, 'quartiere-tamburi');
  await page.waitForSelector('[data-testid="scheda-quartiere"]');
  await shot('quartiere');

  // Qualche scelta all'inizio: bonifica dei parchi minerali e scuole a Paolo VI.
  await click(page, 'lotto-lotto-parchi-minerali');
  await page.locator('[data-testid="scheda-lotto"] button', { hasText: 'bonifica' }).click();
  await click(page, 'conferma-si');
  await click(page, 'scheda-cantieri');
  await click(page, 'nuovo-progetto');
  await page.locator('.offer button', { hasText: 'Vedi e avvia' }).nth(1).click();
  await click(page, 'conferma-si');

  await click(page, 'chiudi-anno');
  await page.waitForSelector('[data-testid="cronaca"]');
  await shot('cronaca', false);
  let richCronaca = false;

  let dilemmaShot = false;
  let cantieriShot = false;
  let reloaded = !checkReload;
  for (let i = 0; i < 800; i++) {
    if (!dilemmaShot && (await visible(page, 'dilemma')) && !(await visible(page, 'cronaca'))) {
      await shot('dilemma', false);
      dilemmaShot = true;
    }
    // Una prima pagina con almeno due notizie è un esempio migliore di un anno tranquillo.
    if (!richCronaca && (await visible(page, 'cronaca')) && (await page.locator('.subhead').count()) >= 1) {
      await shot('cronaca', false);
      richCronaca = true;
    }
    const done = await step(page);
    if (done === 'finale') break;
    const turn = Number(await year(page)) - 2027;
    if (!cantieriShot && turn >= 6 && !(await visible(page, 'cronaca')) && !(await visible(page, 'dilemma'))) {
      await click(page, 'scheda-cantieri');
      await shot('cantieri');
      await click(page, 'scheda-consiglio');
      await shot('consiglio');
      await click(page, 'scheda-mappa');
      cantieriShot = true;
    }
    if (!reloaded && turn >= 12 && !(await visible(page, 'cronaca')) && !(await visible(page, 'dilemma'))) {
      const before = await year(page);
      const fundsBefore = await page.locator('.funds').textContent();
      await page.reload();
      await page.waitForSelector('[data-testid="barra"]');
      if ((await year(page)) !== before || (await page.locator('.funds').textContent()) !== fundsBefore) {
        fail(`ricaricando la pagina la partita non riprende uguale (${before} → ${await year(page)})`);
      }
      reloaded = true;
    }
  }
  if (!(await visible(page, 'finale'))) fail(`a ${width} px la partita non è arrivata al finale`);
  else await shot('finale');
  if (!dilemmaShot) fail(`a ${width} px nessun dilemma è arrivato`);
  if (!cantieriShot) fail(`a ${width} px mancano le schermate di cantieri e Consiglio`);
  await context.close();
}

async function check360(browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (err) => fail(`errore nella pagina (360 px): ${err.message}`));
  await page.goto(`${BASE}?seme=${SEED + 1}`);
  await page.waitForSelector('[data-testid="mappa"]');
  await noHorizontalScroll(page, 'mappa');
  await click(page, 'quartiere-borgo');
  await noHorizontalScroll(page, 'scheda del quartiere');
  await click(page, 'lotto-lotto-cokerie');
  await noHorizontalScroll(page, 'scheda del lotto');
  await page.locator('[data-testid="scheda-lotto"] button', { hasText: 'energia' }).click();
  await noHorizontalScroll(page, 'conferma');
  await click(page, 'conferma-si');
  for (const tab of ['cantieri', 'grafici', 'consiglio', 'politiche']) {
    await click(page, `scheda-${tab}`);
    await noHorizontalScroll(page, tab);
  }
  await click(page, 'scheda-cantieri');
  await click(page, 'nuovo-progetto');
  await noHorizontalScroll(page, 'nuovo progetto');
  await click(page, 'chiudi-anno');
  await noHorizontalScroll(page, 'cronaca');
  let sawDilemma = false;
  for (let i = 0; i < 800; i++) {
    if (await visible(page, 'dilemma')) {
      await noHorizontalScroll(page, 'dilemma');
      sawDilemma = true;
    }
    if ((await step(page)) === 'finale') break;
  }
  await noHorizontalScroll(page, 'finale');
  if (!sawDilemma) fail('a 360 px nessun dilemma è arrivato');
  await context.close();
}

async function main(): Promise<void> {
  mkdirSync(shotsDir, { recursive: true });
  execSync('npx vite build', { cwd: appDir, stdio: 'inherit' });
  const server = spawn(`npx vite preview --port ${PORT} --strictPort`, { cwd: appDir, shell: true, stdio: 'ignore' });
  try {
    await waitForServer(BASE);
    const channel = process.env['BROWSER'] === 'chrome' ? 'chrome' : 'msedge';
    const browser = await chromium.launch({ channel });
    try {
      await playAt(390, browser, true);
      await playAt(1280, browser, false);
      await check360(browser);
    } finally {
      await browser.close();
    }
  } finally {
    if (process.platform === 'win32' && server.pid !== undefined) execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
    else server.kill();
  }
  if (problems.length > 0) {
    console.error(`\nVerifica fallita: ${problems.length} problemi.`);
    process.exit(1);
  }
  console.log(`\nVerifica riuscita: schermate in ${shotsDir}.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
