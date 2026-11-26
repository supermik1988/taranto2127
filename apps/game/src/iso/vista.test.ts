/**
 * T12, fase B: la vista della città isometrica. Camera ortografica con angolo fisso,
 * quattro orientamenti, movimenti morbidi che dipendono dal tempo trascorso, vista
 * limitata alla zona tenendo conto dell'ingrandimento.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Pt } from '../plastico/data.js';
import { AZIMUT_BASE, ELEVAZIONE, MARGINE_PX, PPM_MAX, PPM_MIN, Vista, fattore, type Area, type Limiti } from './vista.js';

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

  // T12e: la vista si limita sull'area libera dai comandi, non sulla tela intera.
  /** Schermi e comandi tipici: telefono stretto e verticale, telefono lungo, schermo largo. */
  const SCHERMI: { nome: string; w: number; h: number; area: Area }[] = [
    { nome: '360 px', w: 360, h: 780, area: { left: 60, top: 150, right: 250, bottom: 690 } },
    { nome: '390 px', w: 390, h: 844, area: { left: 60, top: 150, right: 280, bottom: 750 } },
    { nome: '1080×2340 (412×892)', w: 412, h: 892, area: { left: 60, top: 150, right: 300, bottom: 798 } },
    { nome: '1280 px', w: 1280, h: 900, area: { left: 60, top: 140, right: 1140, bottom: 820 } },
    { nome: 'tutta la tela', w: 1280, h: 900, area: { left: 0, top: 0, right: 1280, bottom: 900 } },
  ];
  const VERTICI: Pt[] = [
    [LIM.minX, LIM.minY],
    [LIM.maxX, LIM.minY],
    [LIM.maxX, LIM.maxY],
    [LIM.minX, LIM.maxY],
  ];
  const dentro = (s: { x: number; y: number }, a: Area, tol = 1e-6) => s.x >= a.left - tol && s.x <= a.right + tol && s.y >= a.top - tol && s.y <= a.bottom + tol;

  it('alla distanza massima la zona intera entra nell\'area libera, a ogni larghezza e in ogni orientamento', () => {
    for (const sc of SCHERMI) {
      for (let o = 0; o < 4; o++) {
        const v = new Vista([1234, -567], 1, LIM);
        v.dimensioni(sc.w, sc.h);
        v.impostaAreaLibera(sc.area);
        for (let k = 0; k < o; k++) v.ruota(1);
        assesta(v);
        v.ingrandisci(1e-6, sc.w / 2, sc.h / 2, true);
        assesta(v);
        expect(v.ora.ppm, sc.nome).toBeCloseTo(v.ppmMinimo(), 9);
        expect(v.ppmMinimo(), sc.nome).toBeLessThanOrEqual(PPM_MIN);
        for (const p of VERTICI) expect(dentro(v.aSchermo(p), sc.area), `${sc.nome} o${o} vertice ${p.join(',')}`).toBe(true);
      }
    }
  });

  it("spingendo la vista verso un bordo, il vertice di quel lato entra nell'area libera e la vista non va oltre", () => {
    for (const sc of SCHERMI) {
      for (let o = 0; o < 4; o++) {
        for (const ppm of [0.3, 1, 4]) {
          // Trascinare la città verso destra porta in vista il suo lato sinistro, e così via.
          for (const [dx, dy, lato] of [
            [1e6, 0, 'sinistro'],
            [-1e6, 0, 'destro'],
            [0, 1e6, 'alto'],
            [0, -1e6, 'basso'],
          ] as const) {
            const v = new Vista([0, 0], ppm, LIM);
            v.dimensioni(sc.w, sc.h);
            v.impostaAreaLibera(sc.area);
            for (let k = 0; k < o; k++) v.ruota(1);
            assesta(v);
            // Il vertice di quel lato (il più esterno sullo schermo), portato davanti a sé, poi la spinta verso il lato.
            const s0 = VERTICI.map((p) => ({ p, s: v.aSchermo(p) }));
            const scelto = s0.reduce((x, y) => {
              if (lato === 'sinistro') return y.s.x < x.s.x ? y : x;
              if (lato === 'destro') return y.s.x > x.s.x ? y : x;
              if (lato === 'alto') return y.s.y < x.s.y ? y : x;
              return y.s.y > x.s.y ? y : x;
            }).p;
            v.porta(scelto, (sc.area.left + sc.area.right) / 2, (sc.area.top + sc.area.bottom) / 2);
            v.trascina(dx, dy);
            const estremo = v.aSchermo(scelto);
            expect(dentro(estremo, sc.area, 1e-6), `${sc.nome} o${o} ppm ${ppm} lato ${lato}: ${JSON.stringify(estremo)}`).toBe(true);
            // Trascinando ancora, non cambia nulla: la vista si è fermata.
            const prima = [...v.ora.centro];
            v.trascina(dx, dy);
            expect(v.ora.centro[0]).toBeCloseTo(prima[0]!, 6);
            expect(v.ora.centro[1]).toBeCloseTo(prima[1]!, 6);
          }
        }
      }
    }
  });

  it('la vista si ferma quando un estremo della zona arriva al bordo dell\'area libera', () => {
    const sc = SCHERMI[1]!;
    const v = new Vista([0, 0], 1, LIM);
    v.dimensioni(sc.w, sc.h);
    v.impostaAreaLibera(sc.area);
    assesta(v);
    // Trascinando molto verso destra (la città va a destra), l'estremo sinistro della zona si ferma sul bordo sinistro libero.
    v.trascina(1e6, 0);
    const xs = VERTICI.map((p) => v.aSchermo(p).x);
    // Il bordo efficace è l'area libera meno il margine in pixel (MARGINE_PX).
    expect(Math.min(...xs)).toBeCloseTo(sc.area.left + MARGINE_PX, 6);
    // E verso il basso: l'estremo più lontano si ferma sul bordo alto libero.
    v.trascina(0, 1e6);
    const ys = VERTICI.map((p) => v.aSchermo(p).y);
    expect(Math.min(...ys)).toBeCloseTo(sc.area.top + MARGINE_PX, 6);
  });

  it('un\'area libera assurda non blocca la vista: almeno un quinto della tela per lato', () => {
    const v = new Vista([0, 0], 1, LIM);
    v.dimensioni(390, 844);
    v.impostaAreaLibera({ left: 300, top: 800, right: 10, bottom: 5 });
    const a = v.libera;
    expect(a.right - a.left).toBeGreaterThanOrEqual(390 * 0.2 - 1e-9);
    expect(a.bottom - a.top).toBeGreaterThanOrEqual(844 * 0.2 - 1e-9);
    expect(Number.isFinite(v.ppmMinimo())).toBe(true);
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
    // T12e: la distanza massima è quella a cui la zona intera entra nella tela (al più PPM_MIN).
    expect(v.ora.ppm).toBe(v.ppmMinimo());
    expect(v.ppmMinimo()).toBeLessThanOrEqual(PPM_MIN);
    // Schermo e terra si corrispondono.
    const p = v.aTerra(123, 456);
    const s = v.aSchermo(p);
    expect(s.x).toBeCloseTo(123, 6);
    expect(s.y).toBeCloseTo(456, 6);
    expect(ELEVAZIONE).toBeCloseTo(Math.PI / 6, 12);
  });
});
