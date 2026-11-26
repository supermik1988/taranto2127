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
 * T12: misura i tempi delle immagini della città isometrica in tre giri (media e
 * 95° percentile in ms) a 390 px con il processore rallentato 4 volte (telefono di
 * fascia media simulato) e a 1280 px; controlla che il gioco scenda di livello da
 * solo, che i quattro angoli dello schermo non mostrino mai lo sfondo e che la
 * camera resti ortografica a 30°; annota i budget per livello e fa le schermate
 * della città (vista d'insieme in due orientamenti, correzioni, livello basso).
 *
 *   pnpm --filter @taranto2127/game verifica          (Edge)
 *   pnpm --filter @taranto2127/game verifica -- --rapida   (solo tocco e strato sulla città)
 *   pnpm --filter @taranto2127/game verifica -- --prestazioni   (solo tempi, livelli e budget)
 *   pnpm --filter @taranto2127/game verifica -- --citta   (solo angoli dello schermo e schermate della città)
 *   pnpm --filter @taranto2127/game verifica -- --angoli | --scende   (una sola prova, per le prove inverse)
 *   BROWSER=chrome pnpm --filter @taranto2127/game verifica
 */
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright-core';
import { transformWithEsbuild } from 'vite';
import { BERSAGLIO, RECENTI, SOSTITUITE } from '../src/bersaglio.js';
import { TAVOLOZZA } from '../src/iso/aspetto.js';

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
  // La città si costruisce in qualche secondo; con il processore rallentato anche dieci volte tanto.
  // Con il processore rallentato 10× la costruzione blocca la pagina a lungo: 240 s (T12c; erano 120, al limite già in T12).
  await page.waitForSelector(sel('mappa-3d'), { timeout: 240_000 });
  await page.waitForFunction(() => window.taranto2127Plastico !== undefined, undefined, { timeout: 240_000 });
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

// ---------- Città isometrica (T12) ----------

/** Budget di un'immagine e margine chiesto al livello medio sul telefono simulato. */
const BUDGET_MS = 33;
const MARGINE_MEDIO = 0.2;
/** Metà della zona in metri (packages/content/geo/plastico.json, dimensioni). */
const MEZZA = { x: 4740, y: 2984 };
type Livello = 'alto' | 'medio' | 'basso';

/** Annota una misura e la stampa subito (le esecuzioni lunghe non la perdono se qualcosa si ferma dopo). */
function misura(line: string): void {
  measures.push(line);
  console.log(`MISURA: ${line}`);
}

async function apriCitta(browser: Browser, width: number, opts: { cpu?: number; livello?: Livello | 'auto'; riduci?: boolean } = {}): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: width < 600 ? 2 : 1, hasTouch: width < 600, reducedMotion: opts.riduci === true ? 'reduce' : 'no-preference' });
  await context.addInitScript((livello) => {
    localStorage.setItem('taranto2127:visita-fatta', 'si');
    if (livello !== undefined) localStorage.setItem('taranto2127:dettaglio', livello);
  }, opts.livello);
  const page = await context.newPage();
  page.on('console', (msg) => msg.type() === 'error' && fail(`errore in console (città ${width} px): ${msg.text()}`));
  page.on('pageerror', (err) => fail(`errore nella pagina (città ${width} px): ${err.message}`));
  if (opts.cpu !== undefined && opts.cpu > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.cpu });
  }
  await page.goto(`${BASE}?seme=${SEED}`, { timeout: 240_000 });
  await waitForModel(page);
  if (await visible(page, 'avviso')) await page.locator(`${sel('avviso')} button`).click();
  return { page, close: () => context.close() };
}

const p95 = (t: number[]) => [...t].sort((a, b) => a - b)[Math.min(t.length - 1, Math.floor(t.length * 0.95))] ?? 0;
const media = (t: number[]) => t.reduce((a, b) => a + b, 0) / Math.max(1, t.length);

/**
 * Tempi delle immagini (ms) sulla stessa scena: la vista d'avvio, poi quattro punti
 * della zona, muovendo la camera come chi esplora. Restituisce media e 95° percentile.
 */
async function giro(page: Page): Promise<{ media: number; p95: number; livello: string }> {
  // Si lascia assestare il livello (in automatico può scendere), poi si misura.
  await page.waitForTimeout(6000);
  const tempi: number[] = [];
  for (const [id, distanza] of [
    ['tamburi', 3000],
    ['lotto-altoforni', 3000],
    ['lotto-banchine', 3000],
    ['citta-vecchia', 3000],
  ] as const) {
    await page.evaluate(([t, d]) => window.taranto2127Plastico!.focus(t, d), [id, distanza] as const);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.taranto2127Plastico!.azzeraTempi());
    await page.waitForTimeout(2500);
    tempi.push(...(await page.evaluate(() => window.taranto2127Plastico!.tempi())));
  }
  const livello = await page.evaluate(() => window.taranto2127Plastico!.livello());
  return { media: media(tempi), p95: p95(tempi), livello };
}

/** Prestazioni in tre giri, in millisecondi, sui casi della scheda T12. */
async function prestazioniCitta(browser: Browser): Promise<void> {
  const casi: { nome: string; width: number; cpu: number; livello: Livello | 'auto'; soglia: number }[] = [
    { nome: '390 px, processore rallentato 4×, densità 2, livello scelto da solo', width: 390, cpu: 4, livello: 'auto', soglia: BUDGET_MS },
    { nome: '390 px, processore rallentato 4×, densità 2, livello medio', width: 390, cpu: 4, livello: 'medio', soglia: BUDGET_MS * (1 - MARGINE_MEDIO) },
    { nome: '1280 px, densità 1, livello alto', width: 1280, cpu: 1, livello: 'alto', soglia: BUDGET_MS },
  ];
  // CASO=testo: solo i casi che lo contengono (per misure mirate durante lo sviluppo).
  for (const caso of casi.filter((c) => process.env['CASO'] === undefined || c.nome.includes(process.env['CASO']))) {
    for (let run = 1; run <= 3; run++) {
      const { page, close } = await apriCitta(browser, caso.width, { cpu: caso.cpu, livello: caso.livello });
      const r = await giro(page);
      misura(`${caso.nome}, giro ${run}: media ${r.media.toFixed(1)} ms, 95° percentile ${r.p95.toFixed(1)} ms (livello ${r.livello}; soglia ${caso.soglia.toFixed(1)} ms)`);
      if (r.p95 >= caso.soglia) fail(`${caso.nome}, giro ${run}: 95° percentile ${r.p95.toFixed(1)} ms, sopra ${caso.soglia.toFixed(1)} ms`);
      await close();
    }
  }
}

/** Con il processore molto rallentato, in automatico, il gioco scende di livello da solo. */
async function scendeDaSolo(browser: Browser, cpu = 10): Promise<void> {
  const { page, close } = await apriCitta(browser, 390, { cpu, livello: 'auto' });
  let cambi: string[] = [];
  for (let i = 0; i < 40 && cambi.length === 0; i++) {
    await page.waitForTimeout(1000);
    cambi = await page.evaluate(() => window.taranto2127Plastico?.cambi.slice() ?? ['riserva: mappa schematica']);
  }
  misura(`processore rallentato ${cpu}×, 390 px: ${cambi.length === 0 ? 'nessun cambio di livello' : cambi.join(' → ')}`);
  if (cambi.length === 0) fail(`con il processore rallentato ${cpu}× il gioco non scende di livello da solo`);
  await close();
}

/** A ogni ingrandimento e in ogni orientamento, anche spingendo la vista ai bordi, i quattro angoli mostrano terreno o mare. */
async function angoliSempreCitta(browser: Browser, width: number): Promise<void> {
  const { page, close } = await apriCitta(browser, width, { livello: 'basso' });
  let prove = 0;
  for (let o = 0; o < 4; o++) {
    // 1e-4: la distanza massima (T12e), alla quale la vista copre decine di chilometri.
    for (const ppm of [1e-4, 0.3, 0.6, 1, 2, 4, 8]) {
      for (const [x, y] of [
        [0, 0],
        [-MEZZA.x * 2, -MEZZA.y * 2],
        [MEZZA.x * 2, MEZZA.y * 2],
        [-MEZZA.x * 2, MEZZA.y * 2],
        [MEZZA.x * 2, -MEZZA.y * 2],
      ] as const) {
        const r = await page.evaluate(
          ([oo, pp, xx, yy]) => {
            const p = window.taranto2127Plastico!;
            p.imposta(pp, oo);
            p.guarda(xx, yy, pp);
            return { angoli: p.angoli(), camera: p.camera() };
          },
          [o, ppm, x, y] as const,
        );
        prove += 1;
        if (r.angoli.some((a) => !a)) fail(`a ${width} px, orientamento ${o}, ${ppm} pixel per metro, vista spinta verso (${x}, ${y}): un angolo dello schermo mostra lo sfondo (${JSON.stringify(r.angoli)})`);
        if (!r.camera.ortografica || Math.abs(r.camera.elevazione - 30) > 1e-6 || Math.abs(((r.camera.azimut - 45 - o * 90) % 360 + 360) % 360) > 1e-6) {
          fail(`a ${width} px la camera non è ortografica a 30° con l'orientamento ${o}: ${JSON.stringify(r.camera)}`);
        }
      }
    }
  }
  misura(`angoli dello schermo a ${width} px: ${prove} viste controllate (4 orientamenti × 7 ingrandimenti, dalla distanza massima, × 5 posizioni)`);
  await close();
}

/** Ordini di disegno, triangoli e memoria delle texture per livello, sulla vista d'avvio e da vicino. */
async function budgetCitta(browser: Browser): Promise<void> {
  for (const livello of ['alto', 'medio', 'basso'] as const) {
    const { page, close } = await apriCitta(browser, 1280, { livello });
    for (const [nome, ppm] of [
      ['vista d\'avvio', 1.1],
      ['da vicino', 4],
    ] as const) {
      const info = await page.evaluate(
        ([pp]) => {
          const p = window.taranto2127Plastico!;
          p.focus('tamburi', 3000 / pp);
          return p.info();
        },
        [ppm] as const,
      );
      misura(`budget, livello ${livello}, ${nome} (${ppm} px/m): ${info.ordini} ordini di disegno, ${Math.round(info.triangoli / 1000)} mila triangoli, texture ${(info.memoriaTexture / 1e6).toFixed(2)} MB`);
    }
    await close();
  }
}

/** Schermate della città: vista d'insieme in due orientamenti, le quattro correzioni, il livello basso. */
async function schermateCitta(browser: Browser, width: number): Promise<void> {
  const shots: { nome: string; livello?: Livello; ppm: number; o?: number; xy?: [number, number]; id?: string }[] = [
    { nome: 'citta-insieme-orientamento-1', ppm: 0.45, o: 0, id: 'tamburi' },
    { nome: 'citta-insieme-orientamento-3', ppm: 0.45, o: 2, id: 'tamburi' },
    { nome: 'correzione-suolo', ppm: 1.6, xy: [-250, -900] },
    { nome: 'correzione-stabilimento', ppm: 2.2, xy: [-1150, -500] },
    { nome: 'correzione-mare', ppm: 3, xy: [1700, -1750], o: 0 },
    { nome: 'correzione-strade', ppm: 4, id: 'tamburi' },
    { nome: 'citta-livello-basso', ppm: 1.6, livello: 'basso', id: 'tamburi' },
  ];
  for (const s of shots) {
    const { page, close } = await apriCitta(browser, width, { livello: s.livello ?? 'alto' });
    await page.evaluate(
      ([id, ppm, o, xy]) => {
        const p = window.taranto2127Plastico!;
        if (id !== null) p.focus(id, 3000 / ppm);
        p.imposta(ppm, o);
        if (xy !== null) p.guarda(xy[0], xy[1], ppm);
      },
      [s.id ?? null, s.ppm, s.o ?? 0, s.xy ?? null] as const,
    );
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(shotsDir, `${s.nome}-${width}.png`) });
    await close();
  }
}

// ---------- Prima e dopo (T12c, fase B) ----------

/** Vista d'insieme dei Tamburi a più ingrandimenti: luminosità media del riquadro centrale della tela. */
const VISTE_LUMINOSITA = [0.45, 0.9, 1.6] as const;
async function luminositaTamburi(page: Page, width: number): Promise<number[]> {
  const h = width < 600 ? 844 : 900;
  const out: number[] = [];
  for (const ppm of VISTE_LUMINOSITA) {
    out.push(
      await page.evaluate(
        ([pp, w, hh]) => {
          const p = window.taranto2127Plastico!;
          p.imposta(pp, 0);
          p.guarda(1800, -250, pp);
          return p.luminosita(w * 0.3, hh * 0.35, w * 0.7, hh * 0.65);
        },
        [ppm, width, h] as const,
      ),
    );
  }
  return out;
}

/** Inquadrature di T12 (schermateCitta), ripetute nei quattro orientamenti. */
const INQUADRATURE_T12: { nome: string; ppm: number; xy?: [number, number]; id?: string }[] = [
  { nome: 'insieme', ppm: 0.45, id: 'tamburi' },
  { nome: 'suolo', ppm: 1.6, xy: [-250, -900] },
  { nome: 'stabilimento', ppm: 2.2, xy: [-1150, -500] },
  { nome: 'mare', ppm: 3, xy: [1700, -1750] },
  { nome: 'strade', ppm: 4, id: 'tamburi' },
];
const LOOKS_LOTTI = ['fermo', 'lavori', 'acciaio', 'bosco', 'energia', 'mare'] as const;

/** Schermate «prima» o «dopo»: inquadrature di T12 nei quattro orientamenti e i sei aspetti dei lotti. */
async function serieSchermate(browser: Browser, width: number, prefisso: 'dopo'): Promise<void> {
  const { page, close } = await apriCitta(browser, width, { livello: 'alto' });
  for (const s of INQUADRATURE_T12) {
    for (let o = 0; o < 4; o++) {
      await page.evaluate(
        ([id, ppm, oo, xy]) => {
          const p = window.taranto2127Plastico!;
          if (id !== null) p.focus(id, 3000 / ppm);
          p.imposta(ppm, oo);
          if (xy !== null) p.guarda(xy[0], xy[1], ppm);
        },
        [s.id ?? null, s.ppm, o, s.xy ?? null] as const,
      );
      await page.waitForTimeout(900);
      await page.screenshot({ path: join(shotsDir, `${prefisso}-${s.nome}-o${o + 1}-${width}.png`) });
    }
  }
  for (const look of LOOKS_LOTTI) {
    await page.evaluate((l) => {
      const p = window.taranto2127Plastico!;
      const looks = Object.fromEntries(Object.keys(p.looks()).map((id) => [id, l]));
      p.preview(looks as never);
      p.imposta(1.6, 0);
      p.focus('lotto-cokerie', 3000 / 1.6);
    }, look);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(shotsDir, `${prefisso}-lotto-${look}-${width}.png`) });
  }
  await close();
}

// ---------- Aspetto illustrato (T12c, fase B) ----------

/**
 * Luminosità media del riquadro centrale sui Tamburi nella variante 2 «pre-disegnata»
 * (senza contorni), misurata il 25 novembre 2026 prima di togliere la variante, a
 * 0,45 / 0,9 / 1,6 pixel per metro. I contorni non devono scurire la vista di oltre il 10%.
 */
const RIF_LUMINOSITA: Record<number, readonly number[]> = { 390: [145.6, 148.0, 136.4], 1280: [144.2, 145.4, 139.9] };
const MARGINE_LUMINOSITA = 0.1;
/** Margine della prova a pixel dei colori: per canale, su 255 (circa il 5%). */
const MARGINE_COLORE = 14;
/** Il mare nei quattro orientamenti: luminosità entro il 5% tra il più chiaro e il più scuro. */
const MARGINE_MARE = 0.05;

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Contorni che si alleggeriscono: luminosità dei Tamburi a tre distanze contro la variante 2. */
async function contorniLeggeri(browser: Browser, width: number): Promise<void> {
  const { page, close } = await apriCitta(browser, width, { livello: 'alto' });
  const valori = await luminositaTamburi(page, width);
  const rif = RIF_LUMINOSITA[width]!;
  misura(`luminosità dei Tamburi a ${width} px, a ${VISTE_LUMINOSITA.join(' / ')} px/m: ${valori.map((v) => v.toFixed(1)).join(' / ')} (variante 2: ${rif.join(' / ')}; minimo −10%)`);
  valori.forEach((v, i) => {
    if (v < rif[i]! * (1 - MARGINE_LUMINOSITA)) fail(`a ${width} px e ${VISTE_LUMINOSITA[i]} px/m i Tamburi sono troppo scuri: ${v.toFixed(1)} contro ${rif[i]} della variante 2 (oltre il 10% in meno)`);
  });
  await close();
}

/** I colori della tavolozza arrivano sullo schermo come sono scritti (rettangoli al sole, materiale della città). */
async function coloriAlloSchermo(browser: Browser, width: number): Promise<void> {
  const { page, close } = await apriCitta(browser, width, { livello: 'alto' });
  const colori = [...TAVOLOZZA.intonaci, TAVOLOZZA.coppi[0], TAVOLOZZA.lamiere[0], TAVOLOZZA.tende[1], TAVOLOZZA.calce, TAVOLOZZA.fasciaCiminiera];
  // Due file, perché ogni rettangolo sia largo abbastanza anche a 390 px.
  const righe: { atteso: string; letto: [number, number, number] }[] = [];
  for (const parte of [colori.slice(0, 7), colori.slice(7)]) {
    righe.push(
      ...(await page.evaluate((c) => {
        const p = window.taranto2127Plastico!;
        p.imposta(2, 0);
        p.guarda(0, 1400, 2);
        return p.campioneColori(c);
      }, parte)),
    );
  }
  let peggiore = 0;
  for (const r of righe) {
    const a = rgb(r.atteso);
    const d = Math.max(...a.map((v, i) => Math.abs(v - r.letto[i]!)));
    peggiore = Math.max(peggiore, d);
    if (d > MARGINE_COLORE) fail(`a ${width} px il colore ${r.atteso} arriva sullo schermo come rgb(${r.letto.join(', ')}): scarto ${d} oltre ${MARGINE_COLORE}`);
  }
  misura(`colori della tavolozza allo schermo a ${width} px: ${righe.length} colori, scarto massimo ${peggiore} su 255 per canale (margine ${MARGINE_COLORE})`);
  await close();
}

/** Il mare è uguale nei quattro orientamenti (nessun riflesso che dipenda dalla vista). */
async function mareUguale(browser: Browser): Promise<void> {
  const { page, close } = await apriCitta(browser, 1280, { livello: 'alto' });
  const valori: number[] = [];
  for (let o = 0; o < 4; o++) {
    valori.push(
      await page.evaluate((oo) => {
        const p = window.taranto2127Plastico!;
        p.imposta(1.5, oo);
        p.guarda(-3600, -1600, 1.5);
        return p.luminosita(400, 300, 880, 600);
      }, o),
    );
  }
  const scarto = (Math.max(...valori) - Math.min(...valori)) / Math.max(...valori);
  misura(`mare nei quattro orientamenti: luminosità ${valori.map((v) => v.toFixed(1)).join(' / ')}, scarto ${(scarto * 100).toFixed(1)}% (margine 5%)`);
  if (scarto > MARGINE_MARE) fail(`il mare cambia con l'orientamento: luminosità ${valori.map((v) => v.toFixed(1)).join(' / ')}`);
  await close();
}

/** Con «riduci animazioni» nulla si muove; senza, le auto si muovono (la prova ha i denti). */
async function riduciAnimazioni(browser: Browser): Promise<void> {
  for (const riduci of [true, false]) {
    const { page, close } = await apriCitta(browser, 1280, { livello: 'alto', riduci });
    await page.evaluate(() => {
      const p = window.taranto2127Plastico!;
      p.imposta(3, 0);
      p.guarda(1700, -150, 3);
    });
    await page.waitForTimeout(1500);
    const a = await page.locator('canvas').first().screenshot();
    await page.waitForTimeout(1500);
    const b = await page.locator('canvas').first().screenshot();
    const m = await page.evaluate(() => window.taranto2127Plastico!.movimento());
    const uguali = a.equals(b);
    misura(`riduci animazioni ${riduci ? 'acceso' : 'spento'}: ${m.accesi} oggetti della vita accesi, due immagini a 1,5 s ${uguali ? 'uguali' : 'diverse'}`);
    if (riduci && (!uguali || !m.fermi)) fail('con «riduci animazioni» la città si muove ancora');
    if (!riduci && (uguali || m.accesi === 0)) fail('senza «riduci animazioni» la città è ferma: la vita non si muove');
    await close();
  }
}

/** Foglio delle varianti: dieci tipi di edificio, tre varianti ciascuno. */
async function foglioVarianti(browser: Browser, width: number): Promise<void> {
  const { page, close } = await apriCitta(browser, width, { livello: 'alto' });
  const viste: [string, number, number, number][] =
    width < 600
      ? [['foglio-varianti-1', -3700, -1540, 2.4], ['foglio-varianti-2', -3500, -1660, 2.4]]
      : [['foglio-varianti', -3600, -1600, 1.25], ['foglio-varianti-vicino-1', -3780, -1560, 3.2], ['foglio-varianti-vicino-2', -3420, -1660, 3.2]];
  for (const [nome, x, y, ppm] of viste) {
    await page.evaluate(
      ([xx, yy, pp]) => {
        const p = window.taranto2127Plastico!;
        p.mostraCatalogo();
        p.imposta(pp, 0);
        p.guarda(xx, yy, pp);
      },
      [x, y, ppm] as const,
    );
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(shotsDir, `${nome}-${width}.png`) });
  }
  await close();
}

async function controlliT12c(browser: Browser): Promise<void> {
  await contorniLeggeri(browser, 390);
  await contorniLeggeri(browser, 1280);
  await coloriAlloSchermo(browser, 390);
  await coloriAlloSchermo(browser, 1280);
  await mareUguale(browser);
  await riduciAnimazioni(browser);
  await foglioVarianti(browser, 1280);
  await foglioVarianti(browser, 390);
}

/** Diagnosi: il giro al livello medio a 390 px con CPU 4×, spegnendo un gruppo di oggetti alla volta. */
async function diagnosiMedio(browser: Browser): Promise<void> {
  const novita = ['contorni', 'auto-in-movimento', 'treni', 'barche-in-movimento', 'fumo', 'persone', 'gabbiani', 'parti', 'balconi', 'parabole', 'basso-fondale', 'pareti-centro', 'pareti-chiesa'];
  const gruppi: [string, string[]][] = [
    ['tutto acceso (1)', []],
    ['senza le novità di T12c (1)', novita],
    ['tutto acceso (2)', []],
    ['senza le novità di T12c (2)', novita],
  ];

  for (const [nome, prefissi] of gruppi) {
    const { page, close } = await apriCitta(browser, 390, { cpu: 4, livello: 'medio' });
    await page.evaluate((p) => window.taranto2127Plastico!.nascondi(p), prefissi);
    const r = await giro(page);
    misura(`diagnosi medio, ${nome}: media ${r.media.toFixed(1)} ms, 95° percentile ${r.p95.toFixed(1)} ms`);
    await close();
  }
}

// ---------- Mai più pagina bianca (T12d) ----------

/** La partita della scheda T12d: una risposta a un dilemma che oggi non è aperto. */
const PARTITA_VECCHIA = JSON.stringify({
  formato: 'taranto2127-partita',
  versione: 1,
  seme: 42,
  turno: 1,
  storia: [{ turn: 0, action: { kind: 'answer-dilemma', dilemmaId: 'dilemma-di-una-versione-vecchia', optionId: 'a' } }],
});
const AVVISO_VECCHIA = 'Questa partita è stata salvata con una versione precedente del gioco e non si può riaprire';

/**
 * Apre il gioco a 390 px con delle chiavi nell'archivio, un frammento nell'indirizzo e,
 * se richiesto, un browser «vecchio» (senza structuredClone, Object.hasOwn e .at()).
 * Le chiavi si scrivono una volta sola (una pagina vuota dello stesso indirizzo, poi il gioco):
 * così una ricarica, per esempio dopo «Riparti da zero», non le rimette.
 */
async function apriConArchivio(
  browser: Browser,
  chiavi: Record<string, string>,
  opts: { hash?: string; vecchio?: boolean; mappa?: 'schematica'; width?: number } = {},
): Promise<{ page: Page; errori: string[]; close: () => Promise<void> }> {
  const width = opts.width ?? 390;
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: width < 600 ? 2 : 1, hasTouch: width < 600 });
  if (opts.vecchio === true) {
    await context.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      delete w['structuredClone'];
      delete (Object as unknown as Record<string, unknown>)['hasOwn'];
      delete (Array.prototype as unknown as Record<string, unknown>)['at'];
      delete (String.prototype as unknown as Record<string, unknown>)['at'];
      delete (Object.getPrototypeOf(Int8Array.prototype) as Record<string, unknown>)['at'];
    });
  }
  const page = await context.newPage();
  const errori: string[] = [];
  page.on('pageerror', (err) => errori.push(err.message));
  // Prima una pagina vuota dello stesso indirizzo (servita dalla prova), per scrivere l'archivio senza avviare il gioco.
  await page.route(`${BASE}pagina-vuota`, (r) => r.fulfill({ body: '<!doctype html><title>vuota</title>', contentType: 'text/html' }));
  await page.goto(`${BASE}pagina-vuota`);
  await page.evaluate((k) => {
    localStorage.clear();
    localStorage.setItem('taranto2127:visita-fatta', 'si');
    for (const [c, v] of Object.entries(k)) localStorage.setItem(c, v);
  }, chiavi);
  // Senza seme nell'indirizzo: con un seme diverso il gioco ignorerebbe la partita salvata.
  const query = opts.mappa === 'schematica' ? '?mappa=schematica' : '';
  await page.goto(`${BASE}${query}${opts.hash ?? ''}`, { timeout: 240_000 });
  return { page, errori, close: () => context.close() };
}

/** Il gioco è partito: c'è l'anno nella barra in alto, nessun messaggio di guasto. */
async function partito(page: Page, dove: string): Promise<string> {
  await page.waitForSelector(sel('anno'), { timeout: 60_000 });
  if (await visible(page, 'messaggio-guasto')) fail(`${dove}: c'è il messaggio di guasto invece del gioco`);
  return (await page.locator(sel('anno')).textContent()) ?? '';
}

async function controlliT12d(browser: Browser): Promise<void> {
  // (0) La causa vera: la partita della scheda nell'archivio, nel link, in un posto.
  {
    const { page, close } = await apriConArchivio(browser, { 'taranto2127:partita': PARTITA_VECCHIA });
    const anno = await partito(page, 'partita vecchia nell\'archivio');
    const avviso = (await page.locator(sel('avviso')).textContent()) ?? '';
    const conservata = await page.evaluate(() => localStorage.getItem('taranto2127:partita:vecchia'));
    if (!avviso.includes(AVVISO_VECCHIA)) fail(`partita vecchia nell'archivio: manca l'avviso (c'è «${avviso}»)`);
    if (anno !== '2027') fail(`partita vecchia nell'archivio: non è una partita nuova (anno ${anno})`);
    if (conservata === null) fail('partita vecchia nell\'archivio: non è stata conservata da parte');
    // Il giocatore la cancella quando vuole.
    await page.locator(sel('cancella-partita-vecchia')).click();
    const dopo = await page.evaluate(() => localStorage.getItem('taranto2127:partita:vecchia'));
    if (dopo !== null) fail('«Cancella la partita vecchia» non la cancella');
    misura(`partita vecchia nell'archivio: il gioco parte (anno ${anno}) con l'avviso; la vecchia conservata e poi cancellata con il pulsante`);
    await close();
  }
  {
    const { page, close } = await apriConArchivio(browser, {}, { hash: `#partita=${encodeURIComponent(PARTITA_VECCHIA)}` });
    const anno = await partito(page, 'partita vecchia nel link');
    const avviso = (await page.locator(sel('avviso')).textContent()) ?? '';
    if (!avviso.includes(AVVISO_VECCHIA) || anno !== '2027') fail(`partita vecchia nel link: anno ${anno}, avviso «${avviso}»`);
    misura(`partita vecchia nel link: il gioco parte (anno ${anno}) con l'avviso`);
    await close();
  }
  {
    const { page, close } = await apriConArchivio(browser, { 'taranto2127:posto:1': JSON.stringify({ partita: JSON.parse(PARTITA_VECCHIA), ora: '2026-11-20T10:00:00.000Z' }) });
    await partito(page, 'partita vecchia in un posto');
    await page.locator(sel('menu')).click();
    await page.locator(sel('carica-1')).click();
    const avviso = (await page.locator(sel('avviso')).textContent()) ?? '';
    const anno = (await page.locator(sel('anno')).textContent()) ?? '';
    if (!avviso.includes(AVVISO_VECCHIA) || anno !== '2027' || (await visible(page, 'messaggio-guasto'))) fail(`partita vecchia in un posto: anno ${anno}, avviso «${avviso}»`);
    misura(`partita vecchia nel posto 1: «Carica» dà l'avviso, la partita in corso resta (anno ${anno})`);
    await close();
  }
  // Browser vecchio (senza le funzioni recenti): il gioco parte lo stesso, in 3D e con la mappa schematica.
  for (const mappa of [undefined, 'schematica'] as const) {
    const { page, errori, close } = await apriConArchivio(browser, {}, { vecchio: true, ...(mappa !== undefined ? { mappa } : {}) });
    const anno = await partito(page, `browser senza funzioni recenti${mappa !== undefined ? ', mappa schematica' : ''}`);
    await page.waitForSelector(mappa === 'schematica' ? sel('mappa') : sel('mappa-3d'), { timeout: 240_000 });
    if (errori.length > 0) fail(`browser senza funzioni recenti: errori nella pagina: ${errori.join(' · ')}`);
    misura(`browser senza structuredClone, Object.hasOwn e .at()${mappa !== undefined ? ', mappa schematica' : ', città 3D'}: il gioco parte (anno ${anno}), nessun errore`);
    await close();
  }
  // (a) Errore all'avvio dentro React: il messaggio, subito. Errore prima di React: la sentinella, entro 10 s.
  for (const guasto of ['avvio', 'modulo']) {
    const { page, close } = await apriConArchivio(browser, { 'taranto2127:prova-guasto': guasto });
    await page.waitForSelector(sel('messaggio-guasto'), { timeout: guasto === 'modulo' ? 20_000 : 30_000 }).catch(() => undefined);
    const testo = (await page.locator(sel('messaggio-guasto')).first().textContent().catch(() => null)) ?? '';
    if (!testo.includes('non è riuscito a partire') || !testo.includes('Riprova') || !testo.includes('Riparti da zero') || !testo.includes('Browser:')) fail(`errore di prova «${guasto}»: nessun messaggio leggibile (pagina bianca?) — «${testo.slice(0, 80)}»`);
    else misura(`errore di prova «${guasto}»: messaggio di guasto con l'errore, il browser e i due pulsanti`);
    if (guasto === 'avvio') {
      // (c) «Riparti da zero» svuota i dati del gioco e il gioco riparte.
      await page.locator(sel('guasto-riparti')).first().click();
      await page.waitForSelector(sel('anno'), { timeout: 120_000 }).catch(() => undefined);
      const chiavi = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('taranto2127:') && k !== 'taranto2127:partita' && k !== 'taranto2127:partita:ora'));
      const riparte = await visible(page, 'anno');
      if (!riparte || chiavi.includes('taranto2127:prova-guasto')) fail(`«Riparti da zero»: il gioco non riparte o i dati restano (${chiavi.join(', ')})`);
      else misura(`«Riparti da zero»: dati del gioco cancellati, il gioco riparte (chiavi rimaste del gioco nuovo: ${chiavi.length === 0 ? 'nessuna' : chiavi.join(', ')})`);
    }
    await close();
  }
  // (b) Errore nella città 3D (nel ciclo delle immagini e nel disegno): compare la mappa schematica.
  for (const guasto of ['citta', 'citta-disegno']) {
    const { page, close } = await apriConArchivio(browser, { 'taranto2127:prova-guasto': guasto });
    await partito(page, `errore di prova «${guasto}»`);
    await page.waitForSelector(sel('mappa'), { timeout: 240_000 }).catch(() => undefined);
    const schematica = await visible(page, 'mappa');
    const avviso = (await page.locator(sel('avviso')).textContent().catch(() => null)) ?? '';
    if (!schematica) fail(`errore di prova «${guasto}»: la mappa schematica non compare`);
    else misura(`errore di prova «${guasto}»: il gioco continua sulla mappa schematica («${avviso.trim().slice(0, 90)}»)`);
    await close();
  }
}

/** (d) La pagina compilata non contiene sintassi né funzioni fuori dal bersaglio dichiarato. */
async function controlloBersaglio(): Promise<void> {
  const cartella = join(appDir, 'dist', 'assets');
  const file = readdirSync(cartella).filter((f) => f.endsWith('.js'));
  const trovate = new Map<string, string[]>();
  for (const f of file) {
    const codice = readFileSync(join(cartella, f), 'utf8');
    // Sintassi: tradotto per il bersaglio, il codice deve restare identico a quello tradotto senza limiti.
    const conBersaglio = await transformWithEsbuild(codice, f, { target: BERSAGLIO, minify: false, format: 'esm' });
    const senzaLimiti = await transformWithEsbuild(codice, f, { target: 'esnext', minify: false, format: 'esm' });
    if (conBersaglio.code !== senzaLimiti.code) {
      const a = conBersaglio.code.split('\n');
      const b = senzaLimiti.code.split('\n');
      const riga = a.findIndex((r, i) => r !== b[i]);
      fail(`${f}: sintassi oltre il bersaglio ${BERSAGLIO.join(', ')} (prima differenza alla riga ${riga + 1}: «${(b[riga] ?? '').trim().slice(0, 100)}»)`);
    }
    for (const r of RECENTI) if (r.cerca.test(codice)) trovate.set(r.nome, [...(trovate.get(r.nome) ?? []), f]);
  }
  for (const [nome, dove] of trovate) {
    if (!SOSTITUITE.includes(nome)) fail(`funzione recente senza sostituto nella pagina compilata: ${nome} (${dove.join(', ')})`);
  }
  // Il sostituto si carica prima del motore: il modulo d'ingresso comincia installandolo.
  misura(`pagina compilata: ${file.length} file JavaScript, sintassi dentro il bersaglio ${BERSAGLIO.join(', ')}; funzioni recenti trovate: ${[...trovate.keys()].join(', ') || 'nessuna'} (tutte con sostituto: ${[...trovate.keys()].every((n) => SOSTITUITE.includes(n)) ? 'sì' : 'no'})`);
}

// ---------- Tutta la mappa sul telefono (T12e) ----------

/** Schermi della prova: telefoni verticali, telefono lungo 1080×2340 (412×892 a densità 2,625), schermo largo. */
const SCHERMI_T12E: { nome: string; width: number; height: number; dpr: number; touch: boolean }[] = [
  { nome: '360', width: 360, height: 780, dpr: 2, touch: true },
  { nome: '390', width: 390, height: 844, dpr: 2, touch: true },
  { nome: '1080x2340', width: 412, height: 892, dpr: 2.625, touch: true },
  { nome: '1280', width: 1280, height: 900, dpr: 1, touch: false },
];
/** Le schermate di questa prova vanno nel repository del ramo anche quando si prova un'altra copia (VERIFICA_APP). */
const schermateRamo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs', 'schermate');

async function apriSchermo(browser: Browser, s: (typeof SCHERMI_T12E)[number]): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.dpr, hasTouch: s.touch });
  await context.addInitScript(() => {
    localStorage.setItem('taranto2127:visita-fatta', 'si');
    localStorage.setItem('taranto2127:dettaglio', 'alto');
  });
  const page = await context.newPage();
  page.on('pageerror', (err) => fail(`errore nella pagina (${s.nome}): ${err.message}`));
  await page.goto(`${BASE}?seme=${SEED}`, { timeout: 240_000 });
  await waitForModel(page);
  return { page, close: () => context.close() };
}

/** Schermate alla distanza massima nei quattro orientamenti (anche per la copia di prima, con le sonde di allora). */
async function schermateDistanzaMassima(browser: Browser, prefisso: 'prima' | 'dopo'): Promise<void> {
  for (const s of SCHERMI_T12E) {
    const { page, close } = await apriSchermo(browser, s);
    for (let o = 0; o < 4; o++) {
      await page.evaluate((oo) => {
        const p = window.taranto2127Plastico!;
        p.imposta(1e-4, oo);
        p.guarda(0, 0, 1e-4);
      }, o);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: join(schermateRamo, `t12e-${prefisso}-distanza-massima-o${o + 1}-${s.nome}.png`) });
    }
    await close();
  }
}

/**
 * Rettangoli dei comandi sopra la mappa e della tela, misurati dal DOM nella pagina:
 * la prova non si fida dell'area libera calcolata dal gioco.
 */
async function comandiSullaMappa(page: Page): Promise<{ tela: { x: number; y: number; w: number; h: number }; comandi: { x0: number; y0: number; x1: number; y1: number }[] }> {
  return page.evaluate(() => {
    const t = document.querySelector('[data-testid="mappa-3d"]')!.getBoundingClientRect();
    const comandi = [...document.querySelectorAll<HTMLElement>('.hud-top, .timebar, .rail, .map-controls')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ x0: r.left - t.left, y0: r.top - t.top, x1: r.right - t.left, y1: r.bottom - t.top }));
    return { tela: { x: t.left, y: t.top, w: t.width, h: t.height }, comandi };
  });
}

/** Un punto della tela (pixel della tela) è visibile: dentro la tela e sotto nessun comando. */
function visibileSullaMappa(v: { x: number; y: number }, m: Awaited<ReturnType<typeof comandiSullaMappa>>, tol = 1): boolean {
  if (v.x < -tol || v.y < -tol || v.x > m.tela.w + tol || v.y > m.tela.h + tol) return false;
  return !m.comandi.some((c) => v.x > c.x0 + tol && v.x < c.x1 - tol && v.y > c.y0 + tol && v.y < c.y1 - tol);
}

async function controlliT12e(browser: Browser): Promise<void> {
  const tol = 1;
  for (const s of SCHERMI_T12E) {
    const { page, close } = await apriSchermo(browser, s);
    const dom = await comandiSullaMappa(page);
    let spinte = 0;
    for (let o = 0; o < 4; o++) {
      // Alla distanza massima i quattro vertici della zona cadono dentro l'area libera.
      const r = await page.evaluate((oo) => {
        const p = window.taranto2127Plastico!;
        p.imposta(1e-4, oo);
        p.guarda(0, 0, 1e-4);
        return p.areaLibera();
      }, o);
      const fuori = r.vertici.filter((v) => v.x < r.area.left - tol || v.x > r.area.right + tol || v.y < r.area.top - tol || v.y > r.area.bottom + tol);
      if (fuori.length > 0) fail(`${s.nome}, orientamento ${o + 1}, distanza massima: ${fuori.length} vertici della zona fuori dall'area libera ${JSON.stringify(r.area)}: ${JSON.stringify(fuori)}`);
      // Controllo indipendente dal gioco: nessun vertice sotto un comando misurato nel DOM, nessuno fuori dalla tela.
      const nascosti = r.vertici.filter((v) => !visibileSullaMappa(v, dom));
      if (nascosti.length > 0) fail(`${s.nome}, orientamento ${o + 1}, distanza massima: ${nascosti.length} vertici della zona sotto un comando o fuori dalla tela: ${JSON.stringify(nascosti)}`);
      if (o === 0) misura(`${s.nome}: area libera ${Math.round(r.area.left)}-${Math.round(r.area.right)} × ${Math.round(r.area.top)}-${Math.round(r.area.bottom)} px su ${s.width}×${s.height}; distanza massima ${r.ppmMinimo.toFixed(3)} px/m (era 0,3)`);
      // Spingendo verso ciascun bordo, il vertice di quel lato si porta nell'area libera.
      for (const ppm of [0.3, 1, 3]) {
        for (const [dx, dy, lato] of [
          [1e6, 0, 'sinistro'],
          [-1e6, 0, 'destro'],
          [0, 1e6, 'alto'],
          [0, -1e6, 'basso'],
        ] as const) {
          const esito = await page.evaluate(
            ([oo, pp, ddx, ddy, ll]) => {
              const p = window.taranto2127Plastico!;
              p.imposta(pp, oo);
              const prima = p.areaLibera();
              // Il vertice più esterno dalla parte del lato.
              const scelto = prima.vertici.map((v, i) => ({ v, i })).reduce((a, b) => {
                if (ll === 'sinistro') return b.v.x < a.v.x ? b : a;
                if (ll === 'destro') return b.v.x > a.v.x ? b : a;
                if (ll === 'alto') return b.v.y < a.v.y ? b : a;
                return b.v.y > a.v.y ? b : a;
              }).i;
              const vertici: [number, number][] = [
                [-4740, -2984],
                [4740, -2984],
                [4740, 2984],
                [-4740, 2984],
              ];
              p.spingi(vertici[scelto]!, ddx, ddy);
              const dopo = p.areaLibera();
              return { area: dopo.area, v: dopo.vertici[scelto]! };
            },
            [o, ppm, dx, dy, lato] as const,
          );
          spinte += 1;
          const { area, v } = esito;
          if (!visibileSullaMappa(v, dom)) fail(`${s.nome}, orientamento ${o + 1}, ${ppm} px/m, spinta verso il lato ${lato}: il vertice resta sotto un comando o fuori dalla tela (${Math.round(v.x)}, ${Math.round(v.y)})`);
          else if (v.x < area.left - tol || v.x > area.right + tol || v.y < area.top - tol || v.y > area.bottom + tol) {
            fail(`${s.nome}, orientamento ${o + 1}, ${ppm} px/m, spinta verso il lato ${lato}: il vertice resta fuori dall'area libera (${Math.round(v.x)}, ${Math.round(v.y)})`);
          }
        }
      }
    }
    misura(`${s.nome}: alla distanza massima i quattro vertici nell'area libera nei quattro orientamenti; ${spinte} spinte verso i bordi, ogni vertice portato nell'area libera`);
    // L'area libera si ricalcola quando una finestra si apre e si chiude.
    const chiusa = (await page.evaluate(() => window.taranto2127Plastico!.areaLibera())).area;
    await openPanel(page, 'elenco');
    await page.waitForTimeout(700);
    const aperta = (await page.evaluate(() => window.taranto2127Plastico!.areaLibera())).area;
    await closeOutside(page);
    await page.waitForTimeout(700);
    const dinuovo = (await page.evaluate(() => window.taranto2127Plastico!.areaLibera())).area;
    const ristretta = aperta.bottom < chiusa.bottom - 20 || aperta.right < chiusa.right - 20;
    const tornata = Math.abs(dinuovo.bottom - chiusa.bottom) < 2 && Math.abs(dinuovo.right - chiusa.right) < 2;
    if (!ristretta || !tornata) fail(`${s.nome}: l'area libera non segue la finestra «Elenco» (chiusa ${JSON.stringify(chiusa)}, aperta ${JSON.stringify(aperta)}, di nuovo chiusa ${JSON.stringify(dinuovo)})`);
    else misura(`${s.nome}: con la finestra «Elenco» aperta l'area libera si restringe (${Math.round(chiusa.right)}×${Math.round(chiusa.bottom)} → ${Math.round(aperta.right)}×${Math.round(aperta.bottom)}) e torna com'era alla chiusura`);
    await close();
  }
  await schermateDistanzaMassima(browser, 'dopo');
}

async function main(): Promise<void> {
  const quick = process.argv.includes('--rapida');
  const onlyContrast = process.argv.includes('--misura-strato');
  const onlyPerf = process.argv.includes('--prestazioni');
  const onlyCity = process.argv.includes('--citta');
  // Solo per le prove inverse: una prova del browser alla volta, senza schermate.
  const onlyCorners = process.argv.includes('--angoli');
  const onlyDescent = process.argv.includes('--scende');
  // T12c: schermate «dopo» e controlli dell'aspetto illustrato.
  const after = process.argv.includes('--dopo');
  const t12c = process.argv.includes('--t12c');
  const t12d = process.argv.includes('--t12d');
  const t12e = process.argv.includes('--t12e');
  // Solo le schermate «prima» alla distanza massima, sulla copia indicata da VERIFICA_APP (per esempio main).
  const t12ePrima = process.argv.includes('--t12e-prima');
  const partial = quick || onlyContrast || onlyPerf || onlyCity || onlyCorners || onlyDescent || after || t12c || t12d || t12e || t12ePrima || process.argv.includes('--diagnosi');
  mkdirSync(shotsDir, { recursive: true });
  execSync('npx vite build', { cwd: appDir, stdio: 'inherit' });
  const server = spawn(`npx vite preview --port ${PORT} --strictPort`, { cwd: appDir, shell: true, stdio: 'ignore' });
  try {
    await waitForServer(BASE);
    const channel = process.env['BROWSER'] === 'chrome' ? 'chrome' : 'msedge';
    const browser = await chromium.launch({ channel });
    try {
      if (t12ePrima) {
        await schermateDistanzaMassima(browser, 'prima');
      } else if (t12e) {
        await controlliT12e(browser);
        await angoliSempreCitta(browser, 390);
      } else if (t12d) {
        await controlloBersaglio();
        await controlliT12d(browser);
      } else if (process.argv.includes('--diagnosi')) {
        await diagnosiMedio(browser);
      } else if (t12c) {
        await controlliT12c(browser);
      } else if (after) {
        await serieSchermate(browser, 1280, 'dopo');
        if (!process.argv.includes('--solo-1280')) await serieSchermate(browser, 390, 'dopo');
      } else if (onlyContrast) {
        console.log(`Contrasto dello strato dell'aria sui Tamburi a 390 px: ${(await layerContrast(browser)).toFixed(2)}`);
      } else if (onlyCorners) {
        await angoliSempreCitta(browser, 390);
      } else if (onlyDescent) {
        await scendeDaSolo(browser);
      } else if (onlyPerf) {
        await prestazioniCitta(browser);
        await scendeDaSolo(browser);
        await budgetCitta(browser);
      } else if (onlyCity) {
        await angoliSempreCitta(browser, 390);
        await angoliSempreCitta(browser, 1280);
        await schermateCitta(browser, 390);
        await schermateCitta(browser, 1280);
      } else if (quick) {
        await quickModelChecks(browser);
      } else {
        await prestazioniCitta(browser);
        await scendeDaSolo(browser);
        await budgetCitta(browser);
        await angoliSempreCitta(browser, 390);
        await angoliSempreCitta(browser, 1280);
        await schermateCitta(browser, 390);
        await schermateCitta(browser, 1280);
        await serieSchermate(browser, 1280, 'dopo');
        await serieSchermate(browser, 390, 'dopo');
        await controlliT12c(browser);
        await controlloBersaglio();
        await controlliT12d(browser);
        await controlliT12e(browser);
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
  if (!partial && multiStops === 0) fail('nessuna fermata con più motivi: «e altri N» non verificato');
  console.log(`\nFermate con più motivi aperte al tocco: ${multiStops}.`);
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
