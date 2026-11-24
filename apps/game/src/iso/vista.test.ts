/**
 * T12, fase B: la vista della città isometrica. Camera ortografica con angolo fisso,
 * quattro orientamenti, movimenti morbidi che dipendono dal tempo trascorso, vista
 * limitata alla zona tenendo conto dell'ingrandimento.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AZIMUT_BASE, ELEVAZIONE, PPM_MAX, PPM_MIN, Vista, fattore, impronta, assiATerra, type Limiti } from './vista.js';

const LIM: Limiti = { minX: -5000, maxX: 5000, minY: -3200, maxY: 3200 };
const gradi = (r: number) => (r * 180) / Math.PI;

/** Angolo della camera dopo averla messa nello stato mostrato: elevazione e azimut in gradi. */
function angolo(v: Vista): { elevazione: number; azimut: number; ortografica: boolean } {
  const camera = new THREE.OrthographicCamera();
  v.applica(camera);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  return { elevazione: gradi(Math.asin(-dir.y)), azimut: (gradi(Math.atan2(-dir.x, -dir.z)) + 360) % 360, ortografica: camera.isOrthographicCamera };
}

function assesta(v: Vista): void {
  for (let i = 0; i < 400; i++) v.aggiorna(1 / 60);
}

describe('vista della città isometrica', () => {
  it('la camera è ortografica e il suo angolo non cambia spostando o ingrandendo', () => {
    const v = new Vista([0, 0], 1, LIM);
    v.dimensioni(1280, 900);
    const prima = angolo(v);
    expect(prima.ortografica).toBe(true);
    expect(prima.elevazione).toBeCloseTo(30, 6);
    expect(prima.azimut).toBeCloseTo(45, 6);
    v.trascina(300, -200);
    v.ingrandisci(3, 100, 700, true);
    v.ingrandisci(1.6);
    assesta(v);
    v.trascina(-50, 80);
    const dopo = angolo(v);
    expect(dopo.elevazione).toBeCloseTo(prima.elevazione, 6);
    expect(dopo.azimut).toBeCloseTo(prima.azimut, 6);
  });

  it('la rotazione dà solo quattro orientamenti, a 90° l\'uno dall\'altro', () => {
    const v = new Vista([0, 0], 1, LIM);
    v.dimensioni(390, 844);
    const visti = new Set<number>();
    const passi: (1 | -1)[] = [1, 1, -1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1];
    for (const verso of passi) {
      v.ruota(verso);
      assesta(v);
      const { azimut, elevazione } = angolo(v);
      expect(elevazione).toBeCloseTo(30, 6);
      visti.add(Math.round(azimut) % 360);
      expect(v.orientamento).toBeGreaterThanOrEqual(0);
      expect(v.orientamento).toBeLessThan(4);
    }
    expect([...visti].sort((a, b) => a - b)).toEqual([45, 135, 225, 315]);
  });

  it('i movimenti morbidi dipendono dal tempo trascorso, non dal numero di immagini', () => {
    // Un secondo a 30 immagini e un secondo a 120 immagini portano allo stesso punto.
    const a = new Vista([0, 0], 1, LIM);
    const b = new Vista([0, 0], 1, LIM);
    for (const v of [a, b]) {
      v.dimensioni(1280, 900);
      v.ruota(1);
      v.ingrandisci(2.5);
    }
    for (let i = 0; i < 30; i++) a.aggiorna(1 / 30);
    for (let i = 0; i < 120; i++) b.aggiorna(1 / 120);
    expect(a.ora.azimut).toBeCloseTo(b.ora.azimut, 9);
    expect(a.ora.ppm).toBeCloseTo(b.ora.ppm, 9);
    // E un passo da dt equivale a due passi da dt/2.
    expect(1 - (1 - fattore(0.05)) * (1 - fattore(0.05))).toBeCloseTo(fattore(0.1), 12);
    // A metà strada la rotazione non è ancora arrivata: il passaggio è morbido.
    const c = new Vista([0, 0], 1, LIM);
    c.dimensioni(1280, 900);
    c.ruota(1);
    c.aggiorna(1 / 60);
    expect(c.ora.azimut).toBeGreaterThan(AZIMUT_BASE);
    expect(c.ora.azimut).toBeLessThan(AZIMUT_BASE + Math.PI / 2 - 0.1);
  });

  it('si limita la vista, non solo il centro: l\'impronta a terra resta nella zona a ogni ingrandimento e orientamento', () => {
    for (const [w, h] of [
      [390, 844],
      [1280, 900],
    ] as const) {
      for (let o = 0; o < 4; o++) {
        for (const ppm of [PPM_MIN, 0.6, 1, 2, 4, PPM_MAX]) {
          const v = new Vista([0, 0], ppm, LIM);
          v.dimensioni(w, h);
          for (let k = 0; k < o; k++) v.ruota(1);
          assesta(v);
          // Si prova a portare la vista fuori in ogni direzione.
          for (const [dx, dy] of [
            [1e5, 0],
            [-1e5, 0],
            [0, 1e5],
            [0, -1e5],
            [1e5, 1e5],
          ]) {
            v.trascina(dx!, dy!);
            const { destra, avanti } = assiATerra(v.ora.azimut);
            const { lungoDestra, inAvanti } = impronta(v.ora.ppm, w, h);
            const ex = Math.abs(destra[0]) * lungoDestra + Math.abs(avanti[0]) * inAvanti;
            const ey = Math.abs(destra[1]) * lungoDestra + Math.abs(avanti[1]) * inAvanti;
            const grandeX = 2 * ex > LIM.maxX - LIM.minX;
            const grandeY = 2 * ey > LIM.maxY - LIM.minY;
            // Vista più grande della zona su un asse: su quell'asse il centro resta al centro della zona.
            if (grandeX) expect(v.ora.centro[0]).toBeCloseTo((LIM.minX + LIM.maxX) / 2, 6);
            if (grandeY) expect(v.ora.centro[1]).toBeCloseTo((LIM.minY + LIM.maxY) / 2, 6);
            for (const [sx, sy] of [
              [0, 0],
              [w, 0],
              [0, h],
              [w, h],
            ]) {
              const p = v.aTerra(sx!, sy!);
              const msg = `${w}px o${o} ppm ${ppm}`;
              if (!grandeX) {
                expect(p[0], msg).toBeGreaterThanOrEqual(LIM.minX - 1e-6);
                expect(p[0], msg).toBeLessThanOrEqual(LIM.maxX + 1e-6);
              }
              if (!grandeY) {
                expect(p[1], msg).toBeGreaterThanOrEqual(LIM.minY - 1e-6);
                expect(p[1], msg).toBeLessThanOrEqual(LIM.maxY + 1e-6);
              }
            }
          }
        }
      }
    }
  });

  it('ingrandire tiene fermo il punto toccato, e l\'ingrandimento resta nei limiti', () => {
    const v = new Vista([200, -100], 1, LIM);
    v.dimensioni(1280, 900);
    const prima = v.aTerra(300, 200);
    v.ingrandisci(2, 300, 200, true);
    const dopo = v.aTerra(300, 200);
    expect(dopo[0]).toBeCloseTo(prima[0], 6);
    expect(dopo[1]).toBeCloseTo(prima[1], 6);
    v.ingrandisci(1000, 640, 450, true);
    expect(v.ora.ppm).toBe(PPM_MAX);
    v.ingrandisci(1e-6, 640, 450, true);
    expect(v.ora.ppm).toBe(PPM_MIN);
    // Schermo e terra si corrispondono.
    const p = v.aTerra(123, 456);
    const s = v.aSchermo(p);
    expect(s.x).toBeCloseTo(123, 6);
    expect(s.y).toBeCloseTo(456, 6);
    expect(ELEVAZIONE).toBeCloseTo(Math.PI / 6, 12);
  });
});
