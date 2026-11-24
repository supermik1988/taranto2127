/**
 * Texture delle facciate, disegnate dal codice su una tela (nessun file esterno).
 * Ogni texture è un modulo di una campata (3,6 m) per un piano (3,2 m), ripetuto
 * lungo le pareti. I chiari restano quasi bianchi: il colore dell'intonaco arriva
 * dalla geometria e moltiplica la texture. Spazio colore sRGB (texture di colore).
 */
import * as THREE from 'three';
import type { StileFacciata } from './tipi.js';

export const CAMPATA = 3.6;
export const PIANO = 3.2;

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

function draw(stile: StileFacciata, ctx: Ctx): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  // Marcapiano: una riga d'ombra leggera a ogni piano.
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.fillRect(0, H - 4, W, 4);
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
      for (let x = 34; x < W; x += 30) ctx.fillRect(x, 31, 3, 46);
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
      for (let x = 0; x < W; x += 8) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x, 0, 3, H);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x + 4, 0, 2, H);
      }
      break;
    }
    case 'cieco': {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, 0, 2, H);
      ctx.fillRect(W / 2, 0, 1, H);
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, H / 2, W, 1);
      break;
    }
  }
}

const cache = new Map<StileFacciata, THREE.CanvasTexture>();

/** Texture ripetibile di uno stile di facciata (una per stile, condivisa). */
export function textureFacciata(stile: StileFacciata, anisotropy = 4): THREE.CanvasTexture {
  const found = cache.get(stile);
  if (found !== undefined) return found;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  draw(stile, canvas.getContext('2d')!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; // texture di colore: sRGB
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = anisotropy;
  cache.set(stile, texture);
  return texture;
}

/** Tela della texture, per il foglio di confronto. */
export function telaFacciata(stile: StileFacciata): HTMLCanvasElement {
  return textureFacciata(stile).image as HTMLCanvasElement;
}
