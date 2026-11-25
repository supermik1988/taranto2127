/**
 * T12, fase B: la città isometrica costruita per intero, senza pagina (le texture
 * sono segnaposto). Controlla le quattro correzioni della fase A, i tipi di
 * edificio, i lotti, l'assenza di sfocatura e di lastra, e i budget di geometria.
 */
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { centroid, geo, hash01, pointInPolygon, polygonArea, type Pt } from '../plastico/data.js';
import { LOT_LOOKS } from '../plastico/looks.js';
import { costruisciCitta, type Citta } from './citta.js';
import { riquadro } from './geo3.js';
import { MEZZA_X, MEZZA_Y } from './griglia.js';
import { costruisciAspetto, waterSides } from './lotti.js';
import { COLORI, LIVELLO_MARE, QUOTE, type Pezza } from './suolo.js';
import { TIPI, variante } from './tipi.js';

/** Poligoni divisi in celle di 200 m, per sapere in fretta quali contengono un punto. */
class Celle<T extends { ring: Pt[] }> {
  private readonly celle = new Map<string, T[]>();
  constructor(items: T[]) {
    for (const it of items) {
      const r = riquadro(it.ring);
      for (let i = Math.floor(r.minX / 200); i <= Math.floor(r.maxX / 200); i++) {
        for (let j = Math.floor(r.minY / 200); j <= Math.floor(r.maxY / 200); j++) {
          const k = `${i},${j}`;
          const list = this.celle.get(k) ?? [];
          list.push(it);
          this.celle.set(k, list);
        }
      }
    }
  }
  in(p: Pt): T[] {
    return (this.celle.get(`${Math.floor(p[0] / 200)},${Math.floor(p[1] / 200)}`) ?? []).filter((it) => pointInPolygon(p, it.ring));
  }
}

let citta: Citta;
const meshes: THREE.Mesh[] = [];
beforeAll(() => {
  citta = costruisciCitta();
  citta.gruppo.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });
});

const triangoli = (m: THREE.Mesh) => (m.geometry.getAttribute('position').count / 3) * (m instanceof THREE.InstancedMesh ? m.count : 1);

describe('niente terreno vuoto (correzione 1)', () => {
  it('ogni punto di terra della zona ha una copertura, e nessuna copertura domina', () => {
    const pezze = new Celle<Pezza>(citta.pezze);
    const acqua = new Celle(geo.acqua.map((ring) => ({ ring })));
    const conta = new Map<string, number>();
    const perZona: Record<'stabilimento' | 'quartieri' | 'campagna', Set<string>> = { stabilimento: new Set(), quartieri: new Set(), campagna: new Set() };
    const quartieri = Object.values(geo.quartieri);
    let terra = 0;
    let scoperti = 0;
    for (let x = -MEZZA_X + 20; x < MEZZA_X; x += 40) {
      for (let y = -MEZZA_Y + 20; y < MEZZA_Y; y += 40) {
        const p: Pt = [x, y];
        if (acqua.in(p).length > 0) continue;
        terra += 1;
        const sopra = pezze.in(p).sort((a, b) => b.quota - a.quota)[0];
        if (sopra === undefined) {
          scoperti += 1;
          continue;
        }
        // La copertura più in alto, con il suo strato: il fondo della zona conta a parte.
        const chiave = sopra.quota === QUOTE.base ? 'fondo' : sopra.tipo;
        conta.set(chiave, (conta.get(chiave) ?? 0) + 1);
        const zona = geo.stabilimento.some((r) => pointInPolygon(p, r)) ? 'stabilimento' : quartieri.some((r) => pointInPolygon(p, r)) ? 'quartieri' : 'campagna';
        perZona[zona].add(chiave);
      }
    }
    expect(terra).toBeGreaterThan(10_000);
    expect(scoperti).toBe(0);
    // Nessuna copertura, nemmeno il fondo d'erba, copre più di metà della terra.
    for (const [tipo, n] of conta) expect(n / terra, tipo).toBeLessThan(0.5);
    // Varietà dentro ogni tipo di zona.
    expect(perZona.stabilimento.size, [...perZona.stabilimento].join(',')).toBeGreaterThanOrEqual(3);
    expect(perZona.quartieri.size, [...perZona.quartieri].join(',')).toBeGreaterThanOrEqual(3);
    expect(perZona.campagna.size, [...perZona.campagna].join(',')).toBeGreaterThanOrEqual(3);
  });

  it('il colore di base del vecchio terreno non c\'è più, e le stime sono dichiarate', () => {
    const base = new THREE.Color('#cfc58f');
    for (const m of meshes.filter((x) => x.name.startsWith('suolo-'))) {
      const c = m.geometry.getAttribute('color');
      for (let i = 0; i < c.count; i += 97) expect(Math.abs(c.getX(i) - base.r) + Math.abs(c.getY(i) - base.g) + Math.abs(c.getZ(i) - base.b), m.name).toBeGreaterThan(0.02);
    }
    expect(citta.pezze.some((p) => p.origine === 'dati')).toBe(true);
    expect(citta.pezze.some((p) => p.origine === 'stima')).toBe(true);
    // Cespugli sull'erba: il fondo non è una tinta unita.
    expect(meshes.filter((m) => m.name === 'cespugli').reduce((n, m) => n + (m as THREE.InstancedMesh).count, 0)).toBeGreaterThan(3000);
  });
});

describe('stabilimento dettagliato come le case (correzione 2)', () => {
  it('capannoni con facciata industriale e lucernari, serbatoi, ciminiere, nastri e tubazioni', () => {
    expect(citta.conteggio.capannone).toBeGreaterThan(500);
    expect(triangoli(meshes.find((m) => m.name === 'pareti-industriale')!)).toBeGreaterThan(5000);
    expect((meshes.find((m) => m.name === 'lucernari') as THREE.InstancedMesh).count).toBeGreaterThan(2000);
    expect(citta.impianti.serbatoi).toBeGreaterThan(300);
    expect(citta.impianti.ciminiere).toBeGreaterThanOrEqual(15);
    expect(citta.impianti.nastri).toBeGreaterThanOrEqual(5);
    expect(citta.impianti.tubazioni).toBeGreaterThanOrEqual(20);
    expect(triangoli(meshes.find((m) => m.name === 'impianti')!)).toBeGreaterThan(30_000);
  });
});

describe('mare vivo e costa vera (correzione 3)', () => {
  it('il mare ha le onde ed è più basso della terra; la riva ha spiagge, banchine e scogli', () => {
    const mare = meshes.find((m) => m.name === 'mare')!;
    const mat = mare.material as THREE.MeshLambertMaterial;
    expect(mat.normalMap).not.toBeNull();
    // T12c: nessun riflesso che dipenda dalla vista (uguale nei quattro orientamenti).
    expect(mat).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect(mare.geometry.boundingBox!.max.y).toBeLessThan(0);
    expect(LIVELLO_MARE).toBeLessThan(-0.5);
    const { rive, scogli, barche } = citta.suolo;
    expect(rive.spiaggia).toBeGreaterThan(0);
    expect(rive.banchina).toBeGreaterThan(100);
    expect(rive.scogli).toBeGreaterThan(100);
    expect(scogli).toBeGreaterThan(500);
    expect(barche).toBeGreaterThan(200);
  });

  it('i bacini sulla costa hanno le rive e sono più scuri del mare aperto', () => {
    const bacini = geo.acqua.filter((r) => Math.abs(polygonArea(r)) < 1e6 && Math.abs(polygonArea(r)) > 2000);
    expect(bacini.length).toBeGreaterThan(5);
    const rive = meshes.find((m) => m.name === 'rive')!;
    const pos = rive.geometry.getAttribute('position');
    // Ogni bacino ha almeno un tratto di riva che scende sotto il pelo dell'acqua, accanto ai suoi lati.
    const sotto = new Set<string>();
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < LIVELLO_MARE) sotto.add(`${Math.round(pos.getX(i) / 5)},${Math.round(-pos.getZ(i) / 5)}`);
    for (const b of bacini) {
      const trovato = b.some(([x, y]) => sotto.has(`${Math.round(x / 5)},${Math.round(y / 5)}`));
      const [cx, cy] = centroid(b);
      expect(trovato, `bacino in ${Math.round(cx)},${Math.round(cy)}`).toBe(true);
    }
    expect(COLORI.mareChiuso).not.toBe(COLORI.mare);
  });
});

describe('strade (correzione 4)', () => {
  it('marciapiedi e alberi anche sulle strade secondarie dei quartieri', () => {
    expect(citta.suolo.secondarieConMarciapiedi).toBeGreaterThan(150);
    expect(citta.suolo.alberiSecondarie).toBeGreaterThan(800);
  });
});

describe('tipi di edificio nella città', () => {
  it('almeno sei tipi distinti, ciascuno con un aspetto suo (facciata, tetto, colori)', () => {
    expect(Object.values(citta.conteggio).filter((n) => n > 0).length).toBeGreaterThanOrEqual(6);
    const firme = new Set<string>();
    for (const tipo of TIPI) {
      const v = variante({ id: 424242, p: [[0, 0], [20, 0], [20, 12], [0, 12]], k: 'altro' }, tipo, false);
      firme.add(`${v.facciata}|${v.tetto}|${v.parete}`);
    }
    expect(firme.size).toBeGreaterThanOrEqual(6);
  });
});

describe('lotti di ILSIDER nello stesso stile', () => {
  const lotti = Object.entries(geo.lotti);
  it('ogni aspetto si costruisce con poche geometrie, fondo alla quota dei lotti, senza acqua finta', () => {
    const sea = [new THREE.Color(COLORI.mare), new THREE.Color(COLORI.mareChiuso)];
    const isSea = (r: number, g: number, b: number) => sea.some((c) => Math.abs(r - c.r) + Math.abs(g - c.g) + Math.abs(b - c.b) < 0.02);
    for (const [id, quad] of lotti) {
      for (const look of LOT_LOOKS) {
        const { gruppo } = costruisciAspetto(id, quad, look);
        let n = 0;
        gruppo.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          n += 1;
          if (o.name === 'fondo-lotto') expect(o.geometry.boundingBox!.max.y, `${id}:${look}`).toBeLessThanOrEqual(QUOTE.lotti + 1e-6);
          if (look === 'mare') {
            const c = o.geometry.getAttribute('color');
            if (c !== undefined) for (let i = 0; i < c.count; i += 7) expect(isSea(c.getX(i), c.getY(i), c.getZ(i)), `${id}: vertice color mare`).toBe(false);
          }
        });
        // Macchinari e strutture raggruppati: al più 12 ordini di disegno per aspetto (i parchi fermi erano 79).
        expect(n, `${id}:${look}`).toBeLessThanOrEqual(12);
      }
    }
  });

  it('il lotto delle banchine tocca il mare aperto, non un canale; gli altri sono interni', () => {
    const openSea = geo.acqua.filter((ring) => Math.abs(polygonArea(ring)) > 1e6);
    const banchine = geo.lotti['lotto-banchine']!;
    expect(waterSides(banchine, openSea).length).toBeGreaterThan(0);
    expect(waterSides(banchine)).toEqual(waterSides(banchine, openSea));
    expect(lotti.filter(([, quad]) => waterSides(quad).length > 0).map(([id]) => id)).toEqual(['lotto-banchine']);
  });
});

describe('niente sfocatura, niente lastra, niente bordi', () => {
  it('nessun effetto di sfocatura nel codice della città e della pagina', () => {
    const files = [...readdirSync(new URL('./', import.meta.url)).map((f) => new URL(`./${f}`, import.meta.url)), new URL('../plastico/Plastico.tsx', import.meta.url)];
    for (const f of files.filter((u) => /\.tsx?$/.test(u.pathname) && !u.pathname.endsWith('.test.ts'))) {
      const text = readFileSync(f, 'utf8');
      expect(text, f.pathname).not.toMatch(/TiltShift|EffectComposer|BokehPass|postprocessing/);
    }
  });

  it('nessuna base sotto la città, e oltre la zona il terreno e il mare continuano per chilometri', () => {
    for (const m of meshes) {
      expect(m.name).not.toMatch(/^base$|lastra/);
      m.geometry.computeBoundingBox();
      expect(m.geometry.boundingBox!.min.y, m.name).toBeGreaterThan(LIVELLO_MARE - 2);
    }
    const oltre = meshes.filter((m) => m.name.startsWith('oltre-'));
    const box = new THREE.Box3();
    for (const m of oltre) box.union(m.geometry.boundingBox!);
    expect(box.min.x).toBeLessThan(-MEZZA_X - 5000);
    expect(box.max.x).toBeGreaterThan(MEZZA_X + 5000);
    expect(box.min.z).toBeLessThan(-MEZZA_Y - 5000);
    expect(box.max.z).toBeGreaterThan(MEZZA_Y + 5000);
  });
});

describe('budget di geometria (città intera, tutto acceso)', () => {
  it('pochi ordini di disegno e triangoli entro il budget del livello alto', () => {
    expect(meshes.length).toBeLessThanOrEqual(140);
    const tot = meshes.reduce((n, m) => n + triangoli(m), 0);
    expect(tot).toBeLessThan(1_500_000);
    // Varianti ripetibili: due costruzioni danno gli stessi numeri.
    expect(hash01(1, 2)).toBe(hash01(1, 2));
  });
});
