/**
 * Verifica visiva con un browser automatico (Edge o Chrome già installati):
 * costruisce il gioco, gioca una partita da copione fino al finale con i
 * comandi del tempo (avvia, pausa, velocità, un anno avanti), salva le
 * schermate in docs/schermate/ a 390 e a 1280 px e controlla che:
 * - in console non ci siano errori;
 * - la visita guidata si completi (390 px) e si salti (1280 px);
 * - la partita parta in pausa e il tempo si fermi da solo, dicendo perché;
 * - salvare in un posto, cominciare una partita nuova e caricare il posto
 *   riporti la stessa partita, anche dopo aver ricaricato la pagina;
 * - esportare e importare su file riporti la stessa partita;
 * - a 360 px nessuna schermata scorra in orizzontale.
 *
 *   pnpm --filter @taranto2127/game verifica          (Edge)
 *   BROWSER=chrome pnpm --filter @taranto2127/game verifica
 */
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright-core';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = join(appDir, '..', '..', 'docs', 'schermate');
const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;
const SEED = 7;
const problems: string[] = [];
const stopsSeen = new Set<string>();

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

const sel = (id: string) => `[data-testid="${id}"]`;
const visible = async (page: Page, id: string) => (await page.locator(sel(id)).count()) > 0;
const click = (page: Page, id: string) => page.locator(sel(id)).first().click();
const year = (page: Page) => page.locator(sel('anno')).textContent();
/** Impronta della partita visibile: anno, casse, coscienza e reputazione. */
const fingerprint = async (page: Page) => `${await year(page)} | ${await page.locator(sel('fondi')).textContent()} | ${await page.locator('.morals').textContent()}`;

async function noHorizontalScroll(page: Page, where: string): Promise<void> {
  const ok = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  if (!ok) fail(`a 360 px la schermata «${where}» scorre in orizzontale`);
}

/** Chiude ciò che copre la partita: avvisi e giornale. */
async function tidy(page: Page): Promise<void> {
  if (await visible(page, 'cronaca')) await click(page, 'continua');
  if (await visible(page, 'spiegazione')) await click(page, 'spiegazione-chiudi');
}

async function answerDilemma(page: Page): Promise<void> {
  await page.locator(sel('opzione')).first().click();
  await click(page, 'scegli');
}

/** La visita guidata: completata passo per passo, oppure saltata. */
async function tour(page: Page, width: number, mode: 'completa' | 'salta', shot?: (name: string, full?: boolean) => Promise<unknown>): Promise<void> {
  await page.waitForSelector(sel('visita'));
  if (shot !== undefined) await shot('visita', false);
  if (mode === 'salta') {
    await click(page, 'visita-salta');
  } else {
    for (let i = 0; i < 7; i++) await click(page, 'visita-avanti');
    if (!(await visible(page, 'visita-fine'))) fail(`a ${width} px la visita guidata non arriva all'ottavo passo`);
    await click(page, 'visita-fine');
  }
  if (await visible(page, 'visita')) fail(`a ${width} px la visita guidata non si chiude (${mode})`);
}

/**
 * Fa scorrere il tempo fino alla prossima fermata. Restituisce che cosa ha
 * trovato: un dilemma, il finale, o una fermata con la sua riga.
 */
async function runUntilStop(page: Page): Promise<'dilemma' | 'finale' | 'fermata'> {
  await tidy(page);
  if (await visible(page, 'finale')) return 'finale';
  if (await visible(page, 'dilemma')) return 'dilemma';
  await click(page, 'avvia');
  await page.waitForSelector(`${sel('avvia')}, ${sel('dilemma')}, ${sel('finale')}`, { timeout: 180_000 });
  if (await visible(page, 'finale')) return 'finale';
  if (await visible(page, 'fermata')) {
    const line = (await page.locator(sel('fermata')).textContent()) ?? '';
    stopsSeen.add(line.replace(/«[^»]*»/g, '«…»').replace(/\d+/g, 'N'));
  }
  return (await visible(page, 'dilemma')) ? 'dilemma' : 'fermata';
}

async function checkSaves(page: Page, width: number, shot: (name: string, full?: boolean) => Promise<unknown>): Promise<void> {
  const original = await fingerprint(page);
  // Salvare nel posto 1, cominciare una partita nuova, caricare il posto 1.
  await click(page, 'menu');
  await click(page, 'salva-1');
  await shot('menu', false);
  await click(page, 'nuova-partita');
  await click(page, 'nuova-conferma');
  if ((await year(page)) !== '2027') fail(`a ${width} px la nuova partita non riparte dal 2027`);
  await page.reload();
  await page.waitForSelector(sel('barra'));
  if ((await year(page)) !== '2027') fail(`a ${width} px dopo aver ricaricato la pagina la nuova partita non è quella in corso`);
  await click(page, 'menu');
  await click(page, 'carica-1');
  if ((await fingerprint(page)) !== original) fail(`a ${width} px il posto di salvataggio non riporta la stessa partita`);
  await page.reload();
  await page.waitForSelector(sel('barra'));
  if ((await fingerprint(page)) !== original) fail(`a ${width} px dopo aver ricaricato la pagina la partita caricata non è ripresa uguale`);

  // Esportare su file, cominciare una partita nuova, importare il file.
  await click(page, 'menu');
  const download = page.waitForEvent('download');
  await click(page, 'esporta');
  const file = join(mkdtempSync(join(tmpdir(), 'taranto2127-')), 'partita.json');
  await (await download).saveAs(file);
  await click(page, 'nuova-partita');
  await click(page, 'nuova-conferma');
  await click(page, 'menu');
  await page.locator(sel('importa-file')).setInputFiles(file);
  await page.waitForSelector(sel('menu-partita'), { state: 'detached' });
  if ((await fingerprint(page)) !== original) fail(`a ${width} px esportare e importare non riporta la stessa partita`);
  if (await visible(page, 'avviso')) await page.locator(`${sel('avviso')} button`).click();
}

async function playAt(width: number, browser: Browser, mode: 'completa' | 'salta', checks: boolean): Promise<void> {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, hasTouch: width < 600, acceptDownloads: true });
  const page = await context.newPage();
  page.on('console', (msg) => msg.type() === 'error' && fail(`errore in console (${width} px): ${msg.text()}`));
  page.on('pageerror', (err) => fail(`errore nella pagina (${width} px): ${err.message}`));
  // Pagina intera per le schede; solo la parte visibile per le finestre sovrapposte.
  // Nelle catture a pagina intera la barra del tempo, che è fissa, finirebbe a metà: la si mette in fondo.
  const pinBar = (pinned: boolean) =>
    page.evaluate((p) => {
      const bar = document.querySelector<HTMLElement>('.timebar');
      if (bar !== null) bar.style.position = p ? 'static' : '';
    }, pinned);
  const shot = async (name: string, fullPage = true) => {
    if (fullPage) await pinBar(true);
    await page.screenshot({ path: join(shotsDir, `${name}-${width}.png`), fullPage });
    if (fullPage) await pinBar(false);
  };

  await page.goto(`${BASE}?seme=${SEED}`);
  await page.waitForSelector(sel('mappa'));
  await tour(page, width, mode, shot);

  // La partita parte in pausa.
  if (!(await visible(page, 'avvia'))) fail(`a ${width} px la partita non parte in pausa`);
  await page.waitForTimeout(1500);
  if ((await year(page)) !== '2027') fail(`a ${width} px il tempo scorre prima di averlo avviato`);
  await shot('mappa');

  await click(page, 'quartiere-tamburi');
  await page.waitForSelector(sel('scheda-quartiere'));
  await shot('quartiere');
  await click(page, 'termine-coscienza');
  await page.waitForSelector(sel('spiegazione'));
  await shot('spiegazione', false);
  await click(page, 'spiegazione-chiudi');

  // Più di tre azioni nello stesso anno: bonifica dei parchi minerali, due opere e una politica.
  await click(page, 'lotto-lotto-parchi-minerali');
  await page.locator(`${sel('scheda-lotto')} button`, { hasText: 'bonifica' }).click();
  await click(page, 'conferma-si');
  await click(page, 'scheda-cantieri');
  await click(page, 'nuovo-progetto');
  await page.locator('.offer button', { hasText: 'Vedi e avvia' }).nth(1).click();
  await click(page, 'conferma-si');
  // L'elenco resta aperto: si sceglie subito un'altra opera.
  await page.locator('.offer button', { hasText: 'Vedi e avvia' }).first().click();
  await click(page, 'conferma-si');
  await click(page, 'scheda-politiche');
  await page.locator(`${sel('politiche')} button`, { hasText: 'Accendi' }).first().click();
  await click(page, 'conferma-si');
  if (await visible(page, 'avviso')) fail(`a ${width} px un'azione è stata rifiutata: ${await page.locator(sel('avviso')).textContent()}`);
  await click(page, 'scheda-mappa');

  // Un anno avanti, in pausa: compare la Cronaca in breve, e il giornale al tocco.
  await click(page, 'un-anno');
  if ((await year(page)) !== '2028') fail(`a ${width} px «un anno avanti» non porta al 2028`);
  if (await visible(page, 'dilemma')) await answerDilemma(page);
  await click(page, 'leggi-cronaca');
  await page.waitForSelector(sel('cronaca'));
  await shot('cronaca', false);
  await click(page, 'continua');

  await click(page, 'velocita-3');
  let dilemmaShot = false;
  let midShots = false;
  let saves = !checks;
  for (let i = 0; i < 400; i++) {
    const found = await runUntilStop(page);
    if (found === 'finale') break;
    if (found === 'dilemma') {
      if (!dilemmaShot) {
        await shot('dilemma', false);
        dilemmaShot = true;
      }
      await answerDilemma(page);
      continue;
    }
    const turn = Number(await year(page)) - 2027;
    if (!midShots && turn >= 8) {
      await shot('tempo-fermo', false);
      for (const tab of ['cantieri', 'bilancio', 'grafici', 'consiglio']) {
        await click(page, `scheda-${tab}`);
        await shot(tab);
      }
      await click(page, 'aiuto');
      await shot('aiuto', false);
      await click(page, 'aiuto-come-si-gioca');
      await shot('come-si-gioca', false);
      await click(page, 'aiuto-chiudi');
      await click(page, 'scheda-mappa');
      midShots = true;
    }
    if (!saves && turn >= 12) {
      await checkSaves(page, width, shot);
      saves = true;
    }
  }
  if (!(await visible(page, 'finale'))) fail(`a ${width} px la partita non è arrivata al finale`);
  else await shot('finale');
  if (!dilemmaShot) fail(`a ${width} px nessun dilemma è arrivato`);
  if (!midShots) fail(`a ${width} px mancano le schermate di metà partita`);
  if (!saves) fail(`a ${width} px salvataggi non verificati`);
  await context.close();
}

async function check360(browser: Browser): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (err) => fail(`errore nella pagina (360 px): ${err.message}`));
  await page.goto(`${BASE}?seme=${SEED + 1}`);
  await page.waitForSelector(sel('visita'));
  await noHorizontalScroll(page, 'visita guidata');
  await click(page, 'visita-salta');
  await noHorizontalScroll(page, 'mappa');
  await click(page, 'quartiere-borgo');
  await noHorizontalScroll(page, 'scheda del quartiere');
  await click(page, 'termine-reputazione');
  await noHorizontalScroll(page, 'spiegazione di un termine');
  await click(page, 'spiegazione-chiudi');
  await click(page, 'lotto-lotto-cokerie');
  await noHorizontalScroll(page, 'scheda del lotto');
  await page.locator(`${sel('scheda-lotto')} button`, { hasText: 'energia' }).click();
  await noHorizontalScroll(page, 'conferma');
  await click(page, 'conferma-si');
  for (const tab of ['cantieri', 'bilancio', 'grafici', 'consiglio', 'politiche']) {
    await click(page, `scheda-${tab}`);
    await noHorizontalScroll(page, tab);
  }
  await click(page, 'scheda-cantieri');
  await click(page, 'nuovo-progetto');
  await noHorizontalScroll(page, 'nuovo progetto');
  await click(page, 'menu');
  await noHorizontalScroll(page, 'menu della partita');
  await click(page, 'menu-chiudi');
  await click(page, 'aiuto');
  await click(page, 'aiuto-come-si-gioca');
  await noHorizontalScroll(page, 'come si gioca');
  await click(page, 'aiuto-chiudi');
  await click(page, 'un-anno');
  await click(page, 'leggi-cronaca');
  await noHorizontalScroll(page, 'cronaca');
  await click(page, 'continua');
  await click(page, 'velocita-3');
  let sawDilemma = false;
  let sawCharts = false;
  for (let i = 0; i < 400; i++) {
    const found = await runUntilStop(page);
    if (found === 'finale') break;
    if (found === 'dilemma') {
      await noHorizontalScroll(page, 'dilemma');
      sawDilemma = true;
      await answerDilemma(page);
      continue;
    }
    await noHorizontalScroll(page, 'tempo fermo');
    if (!sawCharts && Number(await year(page)) >= 2035) {
      for (const tab of ['grafici', 'bilancio']) {
        await click(page, `scheda-${tab}`);
        await noHorizontalScroll(page, `${tab} con anni di dati`);
      }
      await click(page, 'scheda-mappa');
      sawCharts = true;
    }
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
      await playAt(390, browser, 'completa', true);
      await playAt(1280, browser, 'salta', true);
      await check360(browser);
    } finally {
      await browser.close();
    }
  } finally {
    if (process.platform === 'win32' && server.pid !== undefined) execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
    else server.kill();
  }
  console.log(`\nFermate del tempo viste (${stopsSeen.size} tipi di riga):`);
  for (const line of [...stopsSeen].sort()) console.log(`  ${line}`);
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
