/**
 * Texture disegnate dal codice su una tela (nessun file esterno), spazio colore
 * sRGB per quelle di colore, lineare per la mappa delle onde.
 *
 * - Facciate: un modulo di una campata (3,6 m) per un piano (3,2 m), ripetuto
 *   lungo le pareti. I chiari restano quasi bianchi: il colore dell'intonaco
 *   arriva dalla geometria e moltiplica la texture. La facciata industriale copre
 *   invece tutta l'altezza della parete: zoccolo, lamiera, finestre in alto.
 * - Suolo: piastrelle ripetibili, a colori pieni, una ogni `SCALA_SUOLO` metri.
 * - Mare: mappa delle normali con onde ripetibili, fatta scorrere nel tempo.
 *
 * Il caso è una funzione fissa (hash01): le texture sono uguali a ogni avvio.
 */
import * as THREE from 'three';
import { hash01 } from '../plastico/data.js';
import type { StileFacciata } from './tipi.js';

export const CAMPATA = 3.6;
export const PIANO = 3.2;
/** Lunghezza in metri di una ripetizione della facciata industriale lungo la parete. */
export const MODULO_INDUSTRIALE = 7.2;

const W = 128;
const H = 114; // stesse proporzioni del modulo, 3,6 × 3,2

type Ctx = CanvasRenderingContext2D;

function finestra(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = '#f4f1ea'; // cornice
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  const vetro = ctx.createLinearGradient(x, y, x + w, y + h);
  vetro.addColorStop(0, '#3e5a78');
  vetro.addColorStop(1, '#22344a');
  ctx.fillStyle = vetro;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; // riflesso del cielo
  ctx.fillRect(x + 2, y + 2, w * 0.35, h * 0.28);
  ctx.fillStyle = '#f4f1ea'; // traverso
  ctx.fillRect(x + w / 2 - 1, y, 2, h);
}

function facciata(stile: StileFacciata, ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  if (stile !== 'industriale') {
    // Marcapiano: una riga d'ombra leggera a ogni piano.
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(0, h - 4, w, 4);
  }
  switch (stile) {
    case 'balconi': {
      finestra(ctx, 40, 22, 48, 62);
      // Balcone: soletta chiara con l'ombra sotto e la ringhiera.
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(20, 92, 88, 8);
      ctx.fillStyle = '#f7f5f0';
      ctx.fillRect(18, 84, 92, 8);
      ctx.fillStyle = '#5c5f63';
      for (let x = 22; x < 108; x += 6) ctx.fillRect(x, 64, 2, 20);
      ctx.fillRect(18, 62, 92, 3);
      break;
    }
    case 'persiane': {
      finestra(ctx, 46, 24, 36, 58);
      ctx.fillStyle = '#3f7a4b'; // persiane verdi, aperte
      ctx.fillRect(26, 22, 16, 62);
      ctx.fillRect(86, 22, 16, 62);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 26; y < 82; y += 6) {
        ctx.fillRect(27, y, 14, 2);
        ctx.fillRect(87, y, 14, 2);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; // davanzale
      ctx.fillRect(40, 86, 48, 4);
      break;
    }
    case 'nastro': {
      finestra(ctx, 6, 34, 116, 40);
      ctx.fillStyle = '#f4f1ea';
      for (let x = 34; x < w; x += 30) ctx.fillRect(x, 31, 3, 46);
      break;
    }
    case 'vetrine': {
      finestra(ctx, 10, 18, 108, 72);
      ctx.fillStyle = '#c4473a'; // tenda da sole, senza scritte
      ctx.fillRect(4, 6, 120, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let x = 4; x < 124; x += 16) ctx.fillRect(x, 6, 8, 10);
      break;
    }
    case 'lamiera': {
      for (let x = 0; x < w; x += 8) {
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(x, 0, 3, h);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(x + 4, 0, 2, h);
      }
      break;
    }
    case 'cieco': {
      // Pannelli di cemento con i giunti e qualche macchia.
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, 0, 2, h);
      ctx.fillRect(w / 2, 0, 2, h);
      ctx.fillRect(0, h / 2, w, 2);
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = `rgba(60,50,40,${0.04 + hash01(i, 3) * 0.05})`;
        ctx.fillRect(hash01(i, 1) * w, hash01(i, 2) * h, 6 + hash01(i, 4) * 14, 3 + hash01(i, 5) * 10);
      }
      break;
    }
    case 'industriale': {
      // Tutta l'altezza della parete, dal basso (fondo della tela) all'alto.
      // Lamiera grecata con le nervature verticali.
      for (let x = 0; x < w; x += 6) {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(x, 0, 2, h);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x + 3, 0, 2, h);
      }
      // Nastro di finestre in alto, sotto la gronda.
      ctx.fillStyle = '#e9edf0';
      ctx.fillRect(0, h * 0.1, w, h * 0.16);
      ctx.fillStyle = '#4b6680';
      for (let x = 4; x < w; x += 16) ctx.fillRect(x, h * 0.12, 12, h * 0.12);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let x = 4; x < w; x += 16) ctx.fillRect(x + 1, h * 0.125, 4, h * 0.05);
      // Gronda scura in cima.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, w, h * 0.04);
      // Zoccolo di cemento e un portone a metà modulo.
      ctx.fillStyle = '#c9c4ba';
      ctx.fillRect(0, h * 0.88, w, h * 0.12);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, h * 0.88, w, 2);
      ctx.fillStyle = '#6d747b';
      ctx.fillRect(w * 0.58, h * 0.62, w * 0.3, h * 0.38);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (let y = h * 0.64; y < h; y += 6) ctx.fillRect(w * 0.58, y, w * 0.3, 2);
      // Colature di ruggine sotto la gronda.
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = `rgba(120,70,40,${0.08 + hash01(i, 7) * 0.1})`;
        ctx.fillRect(hash01(i, 8) * w, h * 0.04, 2 + hash01(i, 9) * 3, h * (0.1 + hash01(i, 10) * 0.35));
      }
      break;
    }
  }
}

const cacheFacciate = new Map<StileFacciata, THREE.Texture>();

/** Senza pagina (prove in Node) non c'è la tela: una texture bianca di un pixel ne prende il posto. */
function segnaposto(): THREE.Texture {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}
const senzaPagina = () => typeof document === 'undefined';

function tela(w: number, h: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d')! };
}

function ripetibile(canvas: HTMLCanvasElement, srgb = true, anisotropy = 4): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = anisotropy;
  return texture;
}

/** Texture ripetibile di uno stile di facciata (una per stile, condivisa). */
export function textureFacciata(stile: StileFacciata): THREE.Texture {
  const found = cacheFacciate.get(stile);
  if (found !== undefined) return found;
  if (senzaPagina()) return segnaposto();
  const h = stile === 'industriale' ? 256 : H;
  const { canvas, ctx } = tela(W, h);
  facciata(stile, ctx, W, h);
  const texture = ripetibile(canvas);
  cacheFacciate.set(stile, texture);
  return texture;
}

// ---------- Suolo ----------

/** Metri coperti da una ripetizione delle texture del suolo. */
export const SCALA_SUOLO = 24;

export type Suolo = 'erba' | 'cortile' | 'piazzale' | 'parcheggio' | 'sabbia' | 'roccia' | 'ghiaia' | 'terra' | 'lastricato' | 'campi' | 'sottobosco' | 'campo';
export const SUOLI: Suolo[] = ['erba', 'cortile', 'piazzale', 'parcheggio', 'sabbia', 'roccia', 'ghiaia', 'terra', 'lastricato', 'campi', 'sottobosco', 'campo'];

/** Colore di fondo di ogni suolo: è anche il colore medio della texture (tavolozza in docs/GRAFICA.md). */
export const FONDO_SUOLO: Record<Suolo, string> = {
  erba: '#9cb75e', // erba mediterranea, un po' secca, con cespugli
  cortile: '#ddd4c2', // cortili e marciapiedi delle case
  piazzale: '#c9bfae', // piazzali di cemento dello stabilimento
  parcheggio: '#6a6d72', // asfalto con gli stalli bianchi
  sabbia: '#e8d6a6', // spiaggia
  roccia: '#a19a8c', // scogli
  ghiaia: '#8d8377', // massicciata dei fasci di binari
  terra: '#b49a78', // terra battuta, aree dismesse e cantieri
  lastricato: '#e6dccb', // piazze lastricate
  campi: '#c8c46e', // campi coltivati, a file
  sottobosco: '#5f9447', // bosco e macchia
  campo: '#6fae4c', // campi sportivi
};

const cacheSuolo = new Map<Suolo, THREE.Texture>();

/** Macchie ripetibili: punti a caso (fissi) di un colore, avvolti ai bordi. */
function macchie(ctx: Ctx, size: number, quante: number, seme: number, colore: (k: number) => string, min: number, max: number): void {
  for (let i = 0; i < quante; i++) {
    const x = hash01(seme, i, 1) * size;
    const y = hash01(seme, i, 2) * size;
    const r = min + hash01(seme, i, 3) * (max - min);
    ctx.fillStyle = colore(i);
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy, r, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function suolo(tipo: Suolo, ctx: Ctx, s: number): void {
  ctx.fillStyle = FONDO_SUOLO[tipo];
  ctx.fillRect(0, 0, s, s);
  switch (tipo) {
    case 'erba': {
      macchie(ctx, s, 90, 11, (i) => (hash01(i, 4) < 0.5 ? 'rgba(180,170,90,0.35)' : 'rgba(80,120,50,0.30)'), 3, 9);
      // Cespugli scuri con un'ombra a sud-est.
      macchie(ctx, s, 7, 12, () => 'rgba(30,50,20,0.35)', 4, 6);
      macchie(ctx, s, 7, 12, () => '#4f7a37', 3.2, 5.2);
      break;
    }
    case 'cortile': {
      // Lastre chiare con i giunti e qualche macchia: cortili, marciapiedi, slarghi tra le case.
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      for (let x = 0; x < s; x += 21) ctx.fillRect(x, 0, 1, s);
      for (let y = 0; y < s; y += 21) ctx.fillRect(0, y, s, 1);
      macchie(ctx, s, 26, 15, (i) => (hash01(i, 16) < 0.5 ? 'rgba(120,110,90,0.08)' : 'rgba(255,255,255,0.18)'), 4, 12);
      break;
    }
    case 'piazzale': {
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      for (let x = 0; x < s; x += 32) ctx.fillRect(x, 0, 2, s);
      for (let y = 0; y < s; y += 32) ctx.fillRect(0, y, s, 2);
      macchie(ctx, s, 14, 21, (i) => `rgba(${hash01(i, 5) < 0.5 ? '90,70,50' : '60,60,60'},${0.08 + hash01(i, 6) * 0.1})`, 5, 16);
      break;
    }
    case 'parcheggio': {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      // Due file di stalli, una ogni metà tela.
      for (let x = 0; x < s; x += 16) {
        ctx.fillRect(x, 6, 2, 40);
        ctx.fillRect(x, s / 2 + 18, 2, 40);
      }
      ctx.fillRect(0, s / 2 - 1, s, 2);
      macchie(ctx, s, 8, 31, () => 'rgba(0,0,0,0.12)', 3, 7);
      break;
    }
    case 'sabbia': {
      ctx.strokeStyle = 'rgba(160,130,80,0.25)';
      ctx.lineWidth = 2;
      for (let y = 4; y < s; y += 12) {
        ctx.beginPath();
        for (let x = 0; x <= s; x += 4) ctx.lineTo(x, y + Math.sin((x / s) * Math.PI * 4) * 2);
        ctx.stroke();
      }
      macchie(ctx, s, 30, 41, () => 'rgba(255,255,255,0.25)', 1, 3);
      break;
    }
    case 'roccia': {
      macchie(ctx, s, 40, 51, (i) => (hash01(i, 7) < 0.5 ? 'rgba(70,64,56,0.45)' : 'rgba(200,192,178,0.5)'), 4, 12);
      break;
    }
    case 'ghiaia': {
      macchie(ctx, s, 160, 61, (i) => (hash01(i, 8) < 0.5 ? 'rgba(60,55,50,0.4)' : 'rgba(190,180,165,0.4)'), 1, 2.5);
      break;
    }
    case 'terra': {
      macchie(ctx, s, 40, 71, (i) => (hash01(i, 9) < 0.6 ? 'rgba(120,95,65,0.3)' : 'rgba(150,160,90,0.35)'), 3, 10);
      break;
    }
    case 'lastricato': {
      ctx.fillStyle = 'rgba(0,0,0,0.09)';
      for (let y = 0; y < s; y += 8) {
        ctx.fillRect(0, y, s, 1);
        const off = (y / 8) % 2 === 0 ? 0 : 6;
        for (let x = off; x < s; x += 12) ctx.fillRect(x, y, 1, 8);
      }
      break;
    }
    case 'campi': {
      for (let x = 0; x < s; x += 8) {
        ctx.fillStyle = (x / 8) % 2 === 0 ? 'rgba(120,110,40,0.22)' : 'rgba(255,255,200,0.15)';
        ctx.fillRect(x, 0, 4, s);
      }
      break;
    }
    case 'sottobosco': {
      macchie(ctx, s, 60, 81, (i) => (hash01(i, 10) < 0.5 ? 'rgba(40,70,30,0.4)' : 'rgba(120,150,70,0.35)'), 3, 8);
      break;
    }
    case 'campo': {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      for (let x = 0; x < s; x += 16) ctx.fillRect(x, 0, 8, s);
      break;
    }
  }
}

/** Texture ripetibile di un suolo (una per tipo, condivisa). */
export function textureSuolo(tipo: Suolo): THREE.Texture {
  const found = cacheSuolo.get(tipo);
  if (found !== undefined) return found;
  if (senzaPagina()) return segnaposto();
  const s = 128;
  const { canvas, ctx } = tela(s, s);
  suolo(tipo, ctx, s);
  const texture = ripetibile(canvas);
  cacheSuolo.set(tipo, texture);
  return texture;
}

// ---------- Mare ----------

let onde: THREE.DataTexture | null = null;

/**
 * Mappa delle normali delle onde: somma di onde sinusoidali con periodi interi
 * sulla tela, così la mappa si ripete senza giunture. Spazio lineare (non è colore).
 */
export function textureOnde(): THREE.DataTexture {
  if (onde !== null) return onde;
  const s = 128;
  const data = new Uint8Array(s * s * 4);
  const waves = [
    { kx: 3, ky: 1, a: 1 },
    { kx: -2, ky: 4, a: 0.7 },
    { kx: 5, ky: -3, a: 0.45 },
    { kx: 1, ky: 7, a: 0.3 },
    { kx: -8, ky: 2, a: 0.22 },
  ];
  for (let j = 0; j < s; j++) {
    for (let i = 0; i < s; i++) {
      let dx = 0;
      let dy = 0;
      for (const w of waves) {
        const phase = ((w.kx * i + w.ky * j) / s) * Math.PI * 2 + hash01(w.kx, w.ky) * 6;
        const c = Math.cos(phase) * w.a;
        dx += c * w.kx * 0.06;
        dy += c * w.ky * 0.06;
      }
      const len = Math.hypot(dx, dy, 1);
      const k = (j * s + i) * 4;
      data[k] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      data[k + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      data[k + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      data[k + 3] = 255;
    }
  }
  onde = new THREE.DataTexture(data, s, s, THREE.RGBAFormat);
  onde.wrapS = THREE.RepeatWrapping;
  onde.wrapT = THREE.RepeatWrapping;
  onde.magFilter = THREE.LinearFilter;
  onde.minFilter = THREE.LinearMipmapLinearFilter;
  onde.generateMipmaps = true;
  onde.needsUpdate = true;
  return onde;
}

/** Memoria delle texture create finora, in byte, con le mipmap (circa 4/3 della texture). */
export function memoriaTexture(): number {
  let bytes = 0;
  for (const t of [...cacheFacciate.values(), ...cacheSuolo.values()]) {
    const img = t.image as HTMLCanvasElement;
    bytes += img.width * img.height * 4 * (4 / 3);
  }
  if (onde !== null) bytes += 128 * 128 * 4 * (4 / 3);
  return Math.round(bytes);
}
