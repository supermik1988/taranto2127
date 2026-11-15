/**
 * Verifica visiva con un browser automatico (Edge o Chrome già installati):
 * costruisce il gioco, gioca una partita da copione fino al finale con i
 * comandi del tempo, salva le schermate in docs/schermate/ a 390 e a 1280 px e
 * controlla che:
 * - in console non ci siano errori;
 * - la visita guidata si completi (390 px) e si salti (1280 px), e a ogni passo
 *   evidenzi un elemento che c'è davvero;
 * - sul plastico un tocco su un quartiere o su un lotto apra la sua finestra, e
 *   un tocco fuori la chiuda;
 * - lo strato dell'aria mostri sul plastico i valori dei quartieri;
 * - ogni aspetto dei lotti compaia durante la partita (una schermata per aspetto);
 * - la partita parta in pausa e il tempo si fermi da solo, dicendo perché;
 * - salvataggi, file e link riportino la stessa partita;
 * - con la mappa schematica forzata la partita vada da capo a fondo senza
 *   scaricare il codice 3D;
 * - a 360 px nessuna schermata scorra in orizzontale.
 * Misura anche le immagini al secondo del plastico: a 390 px con il processore
 * rallentato 4 volte (come un telefono di fascia media) e a 1280 px.
 *
 *   pnpm --filter @taranto2127/game verifica          (Edge)
 *   pnpm --filter @taranto2127/game verifica -- --rapida   (solo tocco e strato sul plastico)
 *   BROWSER=chrome pnpm --filter @taranto2127/game verifica
 */
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright-core';

// VERIFICA_APP permette di misurare un'altra copia del gioco (per esempio una versione precedente, per confronto).
const appDir = process.env['VERIFICA_APP'] ?? join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = join(appDir, '..', '..', 'docs', 'schermate');
const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;
const SEED = 7;
const problems: string[] = [];
/** Contrasto dello strato dell'aria sui Tamburi a 390 px in 556dc09, misurato con layerContrast; la soglia è più del doppio. */
const OLD_LAYER_CONTRAST = 18.77;
const LAYER_CONTRAST_THRESHOLD = 40;
const stopsSeen = new Set<string>();
const measures: string[] = [];
let multiStops = 0;

type Shot = (name: string, full?: boolean) => Promise<unknown>;
type Look = 'fermo' | 'lavori' | 'acciaio' | 'bosco' | 'energia' | 'mare';
const LOOKS: Look[] = ['fermo', 'lavori', 'acciaio', 'bosco', 'energia', 'mare'];

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
  // Gli elementi a posizione fissa (barre, pulsanti, finestre) non allargano la pagina: si controlla che restino dentro lo schermo.
  const outside = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const roots = document.querySelectorAll('.hud-top, .rail, .timebar, .map-window, .overlay .sheet, .tour, .tip');
    for (const root of roots) {
      for (const el of [root, ...root.querySelectorAll('*')]) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.right > width + 1 || r.left < -1)) return `${el.tagName.toLowerCase()}.${(el as HTMLElement).className}`;
      }
    }
    return null;
  });
  if (outside !== null) fail(`a 360 px nella schermata «${where}» un elemento esce dallo schermo: ${outside}`);
}

/** Chiude ciò che copre la partita: giornale, spiegazioni, finestre sulla mappa. */
async function tidy(page: Page): Promise<void> {
  if (await visible(page, 'cronaca')) await click(page, 'continua');
  if (await visible(page, 'spiegazione')) await click(page, 'spiegazione-chiudi');
  if (await visible(page, 'finestra-fuori')) await click(page, 'finestra-chiudi');
}

async function answerDilemma(page: Page): Promise<void> {
  await page.locator(sel('opzione')).first().click();
  await click(page, 'scegli');
  // Chiuso il dilemma, restano gli altri motivi della fermata: con più di uno, «e altri N» apre l'elenco.
  if (await visible(page, 'fermata-altri')) {
    await click(page, 'fermata-altri');
    if (!(await visible(page, 'fermata-elenco'))) fail("toccando «e altri N» non compare l'elenco dei motivi");
    multiStops += 1;
  }
}

/** Apre una finestra dal pulsante sul lato e controlla che si apra. */
async function openPanel(page: Page, panel: string): Promise<void> {
  // Sul telefono la finestra aperta copre i pulsanti: prima la si chiude.
  if (await visible(page, 'finestra-chiudi')) await click(page, 'finestra-chiudi');
  await click(page, `scheda-${panel}`);
  if (!(await visible(page, `finestra-${panel}`))) fail(`il pulsante «${panel}» non apre la sua finestra`);
}

/** Chiude la finestra con un tocco fuori: nell'angolo in alto a sinistra, che la finestra non copre mai. */
async function closeOutside(page: Page): Promise<void> {
  await page.mouse.click(6, 6);
  if (await visible(page, 'finestra-fuori')) fail('un tocco fuori dalla finestra non la chiude');
}

/** La visita guidata: completata passo per passo, oppure saltata. A ogni passo un elemento è evidenziato. */
async function tour(page: Page, width: number, mode: 'completa' | 'salta', shot?: Shot): Promise<void> {
  await page.waitForSelector(sel('visita'));
  if (shot !== undefined) await shot('visita', false);
  if (mode === 'salta') {
    await click(page, 'visita-salta');
  } else {
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(150);
      const highlighted = await page.locator('.tour-target').count();
      if (highlighted !== 1) fail(`a ${width} px il passo ${i + 1} della visita non evidenzia nessun elemento`);
      if (i < 7) await click(page, 'visita-avanti');
    }
    if (!(await visible(page, 'visita-fine'))) fail(`a ${width} px la visita guidata non arriva all'ottavo passo`);
    await click(page, 'visita-fine');
  }
  if (await visible(page, 'visita')) fail(`a ${width} px la visita guidata non si chiude (${mode})`);
}

/** Fa scorrere il tempo fino alla prossima fermata: un dilemma, il finale, o una fermata con la sua riga. */
async function runUntilStop(page: Page): Promise<'dilemma' | 'finale' | 'fermata'> {
  await tidy(page);
  if (await visible(page, 'finale')) return 'finale';
  if (await visible(page, 'dilemma')) return 'dilemma';
  await click(page, 'avvia');
  await page.waitForSelector(`${sel('avvia')}, ${sel('dilemma')}, ${sel('finale')}`, { timeout: 180_000 });
  if (await visible(page, 'finale')) return 'finale';
  if (await visible(page, 'fermata')) {
    if ((await visible(page, 'fermata-altri')) && !(await visible(page, 'dilemma'))) {
      await click(page, 'fermata-altri');
      if (!(await visible(page, 'fermata-elenco'))) fail("toccando «e altri N» non compare l'elenco dei motivi");
      multiStops += 1;
    }
    const line = (await page.locator(sel('fermata')).textContent()) ?? '';
    if (/\.\s*e (altri|un altro)/.test(line)) fail(`riga della fermata con un punto prima di «e altri»: ${line}`);
    stopsSeen.add(line.replace(/«[^»]*»/g, '«…»').replace(/\d+/g, 'N'));
  }
  return (await visible(page, 'dilemma')) ? 'dilemma' : 'fermata';
}

async function checkSaves(page: Page, width: number, shot: Shot): Promise<void> {
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

// ---------- Plastico ----------

async function waitForModel(page: Page): Promise<void> {
  await page.waitForSelector(sel('mappa-3d'), { timeout: 30_000 });
  await page.waitForFunction(() => window.taranto2127Plastico !== undefined, undefined, { timeout: 30_000 });
  await page.waitForTimeout(800);
}

/**
 * Tocca sul plastico il centro di un lotto o di un quartiere, come farebbe un dito.
 * Prima del tocco l'oggetto sta dove la finestra lo coprirà (in basso sul telefono,
 * a destra sullo schermo largo): così si vede se la camera lo riporta in vista.
 */
async function tapOnModel(page: Page, id: string): Promise<void> {
  // Una finestra aperta ha il suo sfondo sopra la mappa: un tocco lì la chiuderebbe soltanto.
  if (await visible(page, 'finestra-chiudi')) await click(page, 'finestra-chiudi');
  await page.evaluate((target) => window.taranto2127Plastico!.focus(target, 2600), id);
  await page.waitForTimeout(400);
  await page.evaluate((target) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const area = w < 900 ? { left: w * 0.1, top: h * 0.74, right: w * 0.6, bottom: h * 0.84 } : { left: w * 0.6, top: h * 0.45, right: w * 0.85, bottom: h * 0.6 };
    window.taranto2127Plastico!.frameIn(target, area);
  }, id);
  await page.waitForTimeout(500);
  const point = await page.evaluate((target) => window.taranto2127Plastico!.screenPosition(target), id);
  const canvas = await page.locator(sel('mappa-3d')).boundingBox();
  if (point === null || canvas === null) {
    fail(`sul plastico non trovo ${id}`);
    return;
  }
  await page.mouse.click(canvas.x + point.x, canvas.y + point.y);
}

/**
 * Il lotto o il quartiere aperto in una finestra è evidenziato e sta nella parte
 * di schermo libera: sotto la barra in alto, sopra la finestra che sale dal basso
 * (telefono) o a sinistra di quella laterale (schermo largo).
 */
async function checkSelectionFraming(page: Page, id: string, width: number): Promise<void> {
  await page.waitForTimeout(900);
  const selected = await page.evaluate(() => window.taranto2127Plastico?.selected() ?? null);
  if (selected !== id) fail(`a ${width} px aprendo ${id} sul plastico è evidenziato ${String(selected)}`);
  const point = await page.evaluate((target) => window.taranto2127Plastico!.screenPosition(target), id);
  const canvas = await page.locator(sel('mappa-3d')).boundingBox();
  const win = await page.locator('.map-window').boundingBox();
  const hud = await page.locator('.hud-top').boundingBox();
  if (point === null || canvas === null || win === null || hud === null) {
    fail(`a ${width} px non riesco a controllare dove sta ${id}`);
    return;
  }
  const x = canvas.x + point.x;
  const y = canvas.y + point.y;
  const top = hud.y + hud.height;
  const sheet = win.x <= 1;
  const ok = sheet ? y > top && y < win.y : x < win.x && y > top;
  if (!ok) fail(`a ${width} px ${id} aperto in una finestra resta coperto (${Math.round(x)}, ${Math.round(y)}; finestra da ${Math.round(sheet ? win.y : win.x)})`);
}

/** Lo strato dell'aria colora i quartieri del plastico con il loro valore. */
async function checkAirLayer(page: Page, width: number, shot: Shot): Promise<void> {
  await openPanel(page, 'strati');
  await click(page, 'strato-airQuality');
  for (const id of ['tamburi', 'area-industriale', 'citta-vecchia', 'borgo']) {
    const expected = (await page.locator(sel(`valore-strato-${id}`)).textContent())?.trim();
    const label = (await page.locator(sel(`etichetta-strato-${id}`)).textContent()) ?? '';
    if (expected === undefined || !label.endsWith(` ${expected}`)) fail(`a ${width} px lo strato dell'aria mostra «${label}» per ${id}, atteso ${expected}`);
  }
  await closeOutside(page);
  await page.evaluate(() => window.taranto2127Plastico!.focus('tamburi', 5200));
  await page.waitForTimeout(900);
  await shot('strato-aria', false);
  await openPanel(page, 'strati');
  await click(page, 'strato-spento');
  await closeOutside(page);
}

/** Fotografa da vicino un lotto per ogni aspetto nuovo comparso nella partita. */
async function shootNewLooks(page: Page, width: number, shot: Shot, done: Set<Look>): Promise<void> {
  const looks = await page.evaluate(() => window.taranto2127Plastico?.looks() ?? {});
  for (const [lot, look] of Object.entries(looks) as [string, Look][]) {
    if (done.has(look)) continue;
    done.add(look);
    await page.evaluate((id) => window.taranto2127Plastico!.focus(id, 1900), lot);
    await page.waitForTimeout(1200);
    await shot(`lotto-${look}`, false);
    // L'elenco testuale dice la stessa cosa del plastico.
    await openPanel(page, 'elenco');
    const text = (await page.locator(sel(`elenco-aspetto-${lot}`)).textContent()) ?? '';
    if (!text.includes(look === 'fermo' ? 'fermo' : look === 'lavori' ? 'cantiere' : look === 'bosco' ? 'bosco' : look === 'energia' ? 'energia' : look === 'mare' ? 'mare' : 'acciaio')) {
      fail(`a ${width} px l'elenco non descrive l'aspetto «${look}» del ${lot}: ${text}`);
    }
    await closeOutside(page);
  }
}

async function playAt(width: number, browser: Browser, mode: 'completa' | 'salta'): Promise<void> {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, hasTouch: width < 600, acceptDownloads: true });
  const page = await context.newPage();
  page.on('console', (msg) => msg.type() === 'error' && fail(`errore in console (${width} px): ${msg.text()}`));
  page.on('pageerror', (err) => fail(`errore nella pagina (${width} px): ${err.message}`));
  // Nelle catture a pagina intera la barra del tempo, che è fissa, finirebbe a metà: la si mette in fondo.
  const pinBar = (pinned: boolean) =>
    page.evaluate((p) => {
      const bar = document.querySelector<HTMLElement>('.timebar');
      if (bar !== null) bar.style.position = p ? 'static' : '';
    }, pinned);
  const shot: Shot = async (name, fullPage = true) => {
    if (fullPage) await pinBar(true);
    await page.screenshot({ path: join(shotsDir, `${name}-${width}.png`), fullPage });
    if (fullPage) await pinBar(false);
  };

  await page.goto(`${BASE}?seme=${SEED}`);
  await waitForModel(page);
  await tour(page, width, mode, shot);
  if (await visible(page, 'avviso')) await page.locator(`${sel('avviso')} button`).click();

  // La partita parte in pausa.
  if (!(await visible(page, 'avvia'))) fail(`a ${width} px la partita non parte in pausa`);
  await page.waitForTimeout(1200);
  if ((await year(page)) !== '2027') fail(`a ${width} px il tempo scorre prima di averlo avviato`);
  if (!(await visible(page, 'attribuzione'))) fail(`a ${width} px manca l'attribuzione di OpenStreetMap sulla mappa`);
  await shot('mappa', false);

  // Toccare un quartiere sul plastico apre la sua finestra; un tocco fuori la chiude.
  await tapOnModel(page, 'tamburi');
  if (!(await visible(page, 'finestra-quartiere'))) fail(`a ${width} px toccare i Tamburi sul plastico non apre la loro finestra`);
  else {
    await checkSelectionFraming(page, 'tamburi', width);
    await shot('quartiere', false);
  }
  await closeOutside(page);
  await click(page, 'termine-coscienza');
  await page.waitForSelector(sel('spiegazione'));
  await shot('spiegazione', false);
  await click(page, 'spiegazione-chiudi');

  // Toccare un lotto apre la sua finestra. Quattro lotti verso quattro strade, per vedere tutti gli aspetti.
  const plan: [string, string][] = [
    ['lotto-parchi-minerali', 'bonifica'],
    ['lotto-cokerie', 'energia'],
    ['lotto-altoforni', 'acciaio'],
    ['lotto-banchine', 'mare'],
  ];
  for (const [lot, path] of plan) {
    await tapOnModel(page, lot);
    if (!(await visible(page, 'finestra-lotto'))) {
      fail(`a ${width} px toccare il ${lot} sul plastico non apre la sua finestra`);
      await openPanel(page, 'elenco');
      await click(page, `elenco-lotto-${lot}`);
    }
    await checkSelectionFraming(page, lot, width);
    if (lot === 'lotto-parchi-minerali') await shot('lotto-finestra', false);
    await page.locator(`${sel('finestra-lotto')} button`, { hasText: path }).first().click();
    await click(page, 'conferma-si');
  }
  // Quattro riconversioni nello stesso anno: più delle tre azioni che il T10 ha tolto come limite.
  await tidy(page);
  if (await visible(page, 'avviso')) fail(`a ${width} px un'azione è stata rifiutata: ${await page.locator(sel('avviso')).textContent()}`);

  // Un anno avanti, in pausa: compare la Cronaca in breve, e il giornale al tocco.
  await click(page, 'un-anno');
  if ((await year(page)) !== '2028') fail(`a ${width} px «un anno avanti» non porta al 2028`);
  if (await visible(page, 'dilemma')) await answerDilemma(page);
  await click(page, 'leggi-cronaca');
  await page.waitForSelector(sel('cronaca'));
  await shot('cronaca', false);
  await click(page, 'continua');
  await checkAirLayer(page, width, shot);

  await click(page, 'velocita-3');
  const looksShot = new Set<Look>();
  await shootNewLooks(page, width, shot, looksShot);
  let dilemmaShot = false;
  let midShots = false;
  let saves = width !== 390;
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
    await shootNewLooks(page, width, shot, looksShot);
    const turn = Number(await year(page)) - 2027;
    if (!midShots && turn >= 8) {
      await shot('tempo-fermo', false);
      for (const panel of ['cantieri', 'bilancio', 'grafici', 'consiglio', 'elenco']) {
        await openPanel(page, panel);
        await shot(panel, false);
        await closeOutside(page);
      }
      await click(page, 'aiuto');
      await shot('aiuto', false);
      await click(page, 'aiuto-come-si-gioca');
      await shot('come-si-gioca', false);
      await click(page, 'aiuto-chiudi');
      midShots = true;
    }
    if (!saves && turn >= 12) {
      await checkSaves(page, width, shot);
      await waitForModel(page);
      saves = true;
    }
  }
  if (!(await visible(page, 'finale'))) fail(`a ${width} px la partita non è arrivata al finale`);
  else await shot('finale');
  for (const look of LOOKS) if (!looksShot.has(look)) fail(`a ${width} px l'aspetto «${look}» dei lotti non è comparso durante la partita`);
  if (!dilemmaShot) fail(`a ${width} px nessun dilemma è arrivato`);
  if (!midShots) fail(`a ${width} px mancano le schermate di metà partita`);
  if (!saves) fail(`a ${width} px salvataggi non verificati`);
  await context.close();
}

/** Immagini al secondo del plastico, dopo il riscaldamento, con il processore rallentato (o no). */
async function measure(browser: Browser, width: number, cpuSlowdown: number): Promise<void> {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: width < 600 ? 2 : 1, hasTouch: width < 600 });
  await context.addInitScript(() => localStorage.setItem('taranto2127:visita-fatta', 'si'));
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuSlowdown });
  await page.goto(`${BASE}?seme=${SEED}`);
  await waitForModel(page);
  // Si muove la camera mentre si misura, come chi esplora il plastico.
  await page.waitForTimeout(3000);
  const samples: number[] = [];
  for (let i = 0; i < 4; i++) {
    await page.evaluate((k) => window.taranto2127Plastico!.focus(['tamburi', 'lotto-altoforni', 'lotto-banchine', 'citta-vecchia'][k]!, 3000), i);
    await page.waitForTimeout(2200);
    samples.push(await page.evaluate(() => window.taranto2127Plastico!.fps()));
  }
  const still3d = await visible(page, "mappa-3d");
  const min = Math.min(...samples);
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  measures.push(`${width} px, processore rallentato ${cpuSlowdown}×, densità ${width < 600 ? 2 : 1}: media ${avg.toFixed(1)}, minima ${min.toFixed(1)} immagini al secondo${still3d ? "" : " (passato alla mappa schematica)"}`);
  if (width < 600 && min < 30) fail(`a ${width} px con il processore rallentato ${cpuSlowdown}× il plastico scende a ${min.toFixed(1)} immagini al secondo`);
  await context.close();
}

/** Con la mappa schematica forzata la partita va da capo a fondo, e il codice 3D non si scarica. */
async function playSchematic(browser: Browser): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await context.addInitScript(() => localStorage.setItem('taranto2127:visita-fatta', 'si'));
  const page = await context.newPage();
  const loaded: string[] = [];
  page.on('request', (r) => loaded.push(r.url()));
  page.on('console', (msg) => msg.type() === 'error' && fail(`errore in console (mappa schematica): ${msg.text()}`));
  page.on('pageerror', (err) => fail(`errore nella pagina (mappa schematica): ${err.message}`));
  await page.goto(`${BASE}?seme=${SEED + 2}&mappa=schematica`);
  await page.waitForSelector(sel('mappa'));
  if (await visible(page, 'mappa-3d')) fail('con ?mappa=schematica compare il plastico');
  await click(page, 'quartiere-tamburi');
  if (!(await visible(page, 'finestra-quartiere'))) fail('sulla mappa schematica toccare un quartiere non apre la finestra');
  await closeOutside(page);
  await click(page, 'lotto-lotto-cokerie');
  await page.locator(`${sel('finestra-lotto')} button`, { hasText: 'energia' }).first().click();
  await click(page, 'conferma-si');
  await tidy(page);
  await page.screenshot({ path: join(shotsDir, 'mappa-schematica-390.png') });
  await click(page, 'velocita-3');
  for (let i = 0; i < 400; i++) {
    const found = await runUntilStop(page);
    if (found === 'finale') break;
    if (found === 'dilemma') await answerDilemma(page);
  }
  if (!(await visible(page, 'finale'))) fail('con la mappa schematica la partita non arriva al finale');
  if (loaded.some((url) => /Plastico-.*\.js/.test(url))) fail('con la mappa schematica il browser ha scaricato il codice del plastico');
  await context.close();
}

async function check360(browser: Browser): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (err) => fail(`errore nella pagina (360 px): ${err.message}`));
  await page.goto(`${BASE}?seme=${SEED + 1}`);
  await waitForModel(page);
  await page.waitForSelector(sel('visita'));
  await noHorizontalScroll(page, 'visita guidata');
  await click(page, 'visita-salta');
  await noHorizontalScroll(page, 'mappa');
  await tapOnModel(page, 'borgo');
  await noHorizontalScroll(page, 'finestra del quartiere');
  await click(page, 'finestra-chiudi');
  await click(page, 'termine-reputazione');
  await noHorizontalScroll(page, 'spiegazione di un termine');
  await click(page, 'spiegazione-chiudi');
  await tapOnModel(page, 'lotto-cokerie');
  await noHorizontalScroll(page, 'finestra del lotto');
  if (await visible(page, 'finestra-lotto')) {
    await page.locator(`${sel('finestra-lotto')} button`, { hasText: 'energia' }).first().click();
    await noHorizontalScroll(page, 'conferma');
    await click(page, 'conferma-si');
  }
  for (const panel of ['consiglio', 'cantieri', 'bilancio', 'grafici', 'politiche', 'strati', 'elenco']) {
    await openPanel(page, panel);
    await noHorizontalScroll(page, panel);
    await click(page, 'finestra-chiudi');
  }
  await click(page, 'menu');
  await noHorizontalScroll(page, 'menu della partita');
  await click(page, 'menu-chiudi');
  await click(page, 'aiuto');
  await click(page, 'aiuto-come-si-gioca');
  await noHorizontalScroll(page, 'come si gioca');
  await click(page, 'aiuto-chiudi');
  await click(page, 'un-anno');
  if (await visible(page, 'dilemma')) await answerDilemma(page);
  await click(page, 'leggi-cronaca');
  await noHorizontalScroll(page, 'cronaca');
  await click(page, 'continua');
  await click(page, 'velocita-3');
  let sawDilemma = false;
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
  }
  await noHorizontalScroll(page, 'finale');
  if (!sawDilemma) fail('a 360 px nessun dilemma è arrivato');
  await context.close();
}

/**
 * Contrasto dello strato dell'aria sui Tamburi a 390 px: differenza media di
 * colore (0-255, media dei tre canali) tra strato spento e acceso, sugli stessi
 * pixel con la stessa camera, senza le etichette.
 */
async function layerContrast(browser: Browser): Promise<number> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await context.addInitScript(() => localStorage.setItem('taranto2127:visita-fatta', 'si'));
  const page = await context.newPage();
  await page.goto(`${BASE}?seme=${SEED}`);
  await waitForModel(page);
  if (await visible(page, 'avviso')) await page.locator(`${sel('avviso')} button`).click();
  await page.addStyleTag({ content: '.plastico-labels { display: none !important; }' });
  await page.evaluate(() => window.taranto2127Plastico!.focus('tamburi', 2600));
  await page.waitForTimeout(1500);
  const point = (await page.evaluate(() => window.taranto2127Plastico!.screenPosition('tamburi')))!;
  const clip = { x: Math.max(0, point.x - 80), y: Math.max(0, point.y - 50), width: 160, height: 100 };
  const off = (await page.screenshot({ clip })).toString('base64');
  await click(page, 'scheda-strati');
  await click(page, 'strato-airQuality');
  await page.mouse.click(6, 6);
  await page.waitForTimeout(800);
  const on = (await page.screenshot({ clip })).toString('base64');
  // Funzioni anonime: il compilatore aggiunge aiuti alle funzioni con nome, che nel browser non esistono.
  const diff = await page.evaluate(async (images) => {
    const [pa, pb] = await Promise.all(
      images.map(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, img.width, img.height).data;
      }),
    );
    let sum = 0;
    for (let i = 0; i < pa!.length; i += 4) sum += (Math.abs(pa![i]! - pb![i]!) + Math.abs(pa![i + 1]! - pb![i + 1]!) + Math.abs(pa![i + 2]! - pb![i + 2]!)) / 3;
    return sum / (pa!.length / 4);
  }, [off, on]);
  await context.close();
  return diff;
}

/** Controlli rapidi del plastico (`--rapida`): tocco su quartiere e lotto, strato dell'aria. Servono alle prove inverse. */
async function quickModelChecks(browser: Browser): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => localStorage.setItem('taranto2127:visita-fatta', 'si'));
  const page = await context.newPage();
  page.on('console', (msg) => msg.type() === 'error' && fail(`errore in console: ${msg.text()}`));
  page.on('pageerror', (err) => fail(`errore nella pagina: ${err.message}`));
  await page.goto(`${BASE}?seme=${SEED}`);
  await waitForModel(page);
  if (await visible(page, 'avviso')) await page.locator(`${sel('avviso')} button`).click();
  await tapOnModel(page, 'tamburi');
  if (!(await visible(page, 'finestra-quartiere'))) fail('toccare i Tamburi sul plastico non apre la loro finestra');
  await tapOnModel(page, 'lotto-banchine');
  if (!(await visible(page, 'finestra-lotto'))) fail('toccare un lotto sul plastico non apre la sua finestra');
  await click(page, 'finestra-chiudi');
  await checkAirLayer(page, 1280, async () => undefined);
  await context.close();
  const narrow = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
  await narrow.addInitScript(() => localStorage.setItem('taranto2127:visita-fatta', 'si'));
  const small = await narrow.newPage();
  await small.goto(`${BASE}?seme=${SEED}`);
  await waitForModel(small);
  await noHorizontalScroll(small, 'mappa');
  await openPanel(small, 'strati');
  await noHorizontalScroll(small, 'strati');
  await click(small, 'finestra-chiudi');
  await tapOnModel(small, 'lotto-cokerie');
  if (!(await visible(small, 'finestra-lotto'))) fail('a 360 px toccare un lotto non apre la sua finestra');
  else await checkSelectionFraming(small, 'lotto-cokerie', 360);
  await narrow.close();
  await checkLayerContrast(browser);
}

async function checkLayerContrast(browser: Browser): Promise<void> {
  const contrast = await layerContrast(browser);
  measures.push(`contrasto dello strato dell'aria sui Tamburi a 390 px: ${contrast.toFixed(2)} (soglia ${LAYER_CONTRAST_THRESHOLD}; in 556dc09 ${OLD_LAYER_CONTRAST})`);
  if (contrast < LAYER_CONTRAST_THRESHOLD || contrast < 2 * OLD_LAYER_CONTRAST) {
    fail(`lo strato dell'aria a 390 px cambia i Tamburi di ${contrast.toFixed(2)}: sotto la soglia di ${LAYER_CONTRAST_THRESHOLD} o sotto il doppio di ${OLD_LAYER_CONTRAST}`);
  }
}

async function main(): Promise<void> {
  const quick = process.argv.includes('--rapida');
  const onlyContrast = process.argv.includes('--misura-strato');
  mkdirSync(shotsDir, { recursive: true });
  execSync('npx vite build', { cwd: appDir, stdio: 'inherit' });
  const server = spawn(`npx vite preview --port ${PORT} --strictPort`, { cwd: appDir, shell: true, stdio: 'ignore' });
  try {
    await waitForServer(BASE);
    const channel = process.env['BROWSER'] === 'chrome' ? 'chrome' : 'msedge';
    const browser = await chromium.launch({ channel });
    try {
      if (process.argv.includes('--prestazioni')) {
        for (let i = 0; i < 4; i++) await measure(browser, 390, 4);
        for (const line of measures) console.log(line);
        await browser.close();
        return;
      }
      if (onlyContrast) {
        console.log(`Contrasto dello strato dell'aria sui Tamburi a 390 px: ${(await layerContrast(browser)).toFixed(2)}`);
        await browser.close();
        return;
      }
      if (quick) {
        await quickModelChecks(browser);
      } else {
        await measure(browser, 390, 4);
        await measure(browser, 1280, 1);
        await checkLayerContrast(browser);
        await playAt(390, browser, 'completa');
        await playAt(1280, browser, 'salta');
        await playSchematic(browser);
        await check360(browser);
      }
    } finally {
      await browser.close();
    }
  } finally {
    if (process.platform === 'win32' && server.pid !== undefined) execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
    else server.kill();
  }
  console.log('\nMisure del plastico:');
  for (const line of measures) console.log(`  ${line}`);
  if (!quick && multiStops === 0) fail('nessuna fermata con più motivi: «e altri N» non verificato');
  console.log(`\nFermate con più motivi aperte al tocco: ${multiStops}.`);
  console.log(`\nFermate del tempo viste (${stopsSeen.size} tipi di riga):`);
  for (const line of [...stopsSeen].sort()) console.log(`  ${line}`);
  if (quick) for (const line of measures) console.log(line);
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
