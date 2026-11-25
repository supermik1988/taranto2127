/**
 * Prove dell'aspetto illustrato (T12c, fase B): una sola città, con i contorni che
 * si alleggeriscono con la distanza senza scatti, i balconi in rilievo a parte, la
 * fascia chiara sotto costa rivolta in alto e lo stesso aspetto a ogni avvio.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CONTORNO_PIENO, PPM_CONTORNI_A, PPM_CONTORNI_DA, TAVOLOZZA, opacitaContorni } from './aspetto.js';
import { costruisciCitta, type Citta } from './citta.js';
import { geo, pointInPolygon } from '../plastico/data.js';
import { COLORI } from './suolo.js';

const cerca = (c: Citta, nome: string): THREE.Object3D[] => {
  const out: THREE.Object3D[] = [];
  c.gruppo.traverse((o) => {
    if (o.name === nome) out.push(o);
  });
  return out;
};

const citta = costruisciCitta();

describe('contorni che si alleggeriscono con la distanza', () => {
  it('da lontano spariscono, da vicino sono pieni, in mezzo salgono senza scatti', () => {
    expect(opacitaContorni(0.3)).toBe(0);
    expect(opacitaContorni(PPM_CONTORNI_DA)).toBe(0);
    expect(opacitaContorni(PPM_CONTORNI_A)).toBeCloseTo(CONTORNO_PIENO);
    expect(opacitaContorni(8)).toBeCloseTo(CONTORNO_PIENO);
    let prima = 0;
    for (let ppm = 0.3; ppm <= 8; ppm += 0.01) {
      const o = opacitaContorni(ppm);
      expect(o).toBeGreaterThanOrEqual(prima - 1e-12);
      // Nessun gradino: tra due ingrandimenti vicini l'opacità cambia di poco.
      expect(Math.abs(o - prima)).toBeLessThan(0.01);
      prima = o;
    }
  });

  it('la città ha i contorni degli edifici, dei balconi e dello stabilimento', () => {
    for (const nome of ['contorni', 'contorni-balconi', 'contorni-impianti']) {
      const l = cerca(citta, nome)[0] as THREE.LineSegments | undefined;
      expect(l, nome).toBeDefined();
      expect(l!.geometry.getAttribute('position').count, nome).toBeGreaterThan(1000);
    }
  });
});

describe('una sola città', () => {
  it('niente più varianti: nessuna ombra di contatto, la tavolozza nuova in uso', () => {
    expect(cerca(citta, 'ombre-contatto')).toHaveLength(0);
    expect(COLORI.mare).toBe('#1f66b0');
    expect(COLORI.bassoFondale).toBe('#46b3cf');
  });

  it('i balconi in rilievo stanno in una geometria a parte, leggera', () => {
    const b = cerca(citta, 'balconi')[0] as THREE.Mesh;
    expect(b).toBeDefined();
    const triangoli = b.geometry.getAttribute('position').count / 3;
    expect(triangoli).toBeGreaterThan(20_000);
    expect(triangoli).toBeLessThan(150_000);
    // Le palazzine hanno la facciata con i balconi dipinti (livello medio e da lontano).
    expect(cerca(citta, 'pareti-balconi')).toHaveLength(1);
  });

  it('stesso edificio, stesso aspetto a ogni avvio', () => {
    const ancora = costruisciCitta();
    for (const nome of ['balconi', 'tetti']) {
      const a = (cerca(citta, nome)[0] as THREE.Mesh).geometry;
      const b = (cerca(ancora, nome)[0] as THREE.Mesh).geometry;
      const pa = a.getAttribute('position').array;
      const pb = b.getAttribute('position').array;
      const ca = a.getAttribute('color').array;
      const cb = b.getAttribute('color').array;
      expect(pb.length, nome).toBe(pa.length);
      let diversi = 0;
      for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i] || ca[i] !== cb[i]) diversi += 1;
      expect(diversi, nome).toBe(0);
    }
  });

  it("il mare e la fascia sotto costa guardano tutti verso l'alto", () => {
    for (const nome of ['mare', 'basso-fondale']) {
      const m = cerca(citta, nome)[0] as THREE.Mesh;
      const pos = m.geometry.getAttribute('position');
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const c = new THREE.Vector3();
      let giu = 0;
      for (let i = 0; i < pos.count; i += 3) {
        a.fromBufferAttribute(pos, i);
        b.fromBufferAttribute(pos, i + 1);
        c.fromBufferAttribute(pos, i + 2);
        if (b.clone().sub(a).cross(c.clone().sub(a)).y < -1e-6) giu += 1;
      }
      expect(pos.count, nome).toBeGreaterThan(300);
      expect(giu, nome).toBe(0);
    }
  });

  it('la fascia sotto costa va verso il mare, non sulla terra', () => {
    const f = cerca(citta, 'basso-fondale')[0] as THREE.Mesh;
    const pos = f.geometry.getAttribute('position');
    const col = f.geometry.getAttribute('color');
    const chiaro = new THREE.Color(COLORI.bassoFondale);
    const acqua = (x: number, y: number) => geo.acqua.some((w) => pointInPolygon([x, y], w));
    let n = 0;
    let versoMare = 0;
    let versoTerra = 0;
    // Un triangolo su dieci: il primo vertice sta a riva; quello del colore del mare sta a 40 m.
    // Il punto lontano deve cadere in acqua molto più spesso del suo speculare verso terra
    // (nei canali stretti la fascia sconfina, e lì il suolo la copre).
    for (let i = 0; i < pos.count; i += 30) {
      const rx = pos.getX(i);
      const ry = -pos.getZ(i);
      for (let k = i + 1; k < i + 3 && k < pos.count; k++) {
        if (Math.abs(col.getX(k) - chiaro.r) < 1e-3) continue;
        // A 10 m dalla riva (un quarto della fascia): i canali stretti contano poco.
        const ox = rx + (pos.getX(k) - rx) * 0.25;
        const oy = ry + (-pos.getZ(k) - ry) * 0.25;
        n += 1;
        if (acqua(ox, oy)) versoMare += 1;
        if (acqua(2 * rx - ox, 2 * ry - oy)) versoTerra += 1;
        break;
      }
    }
    expect(n).toBeGreaterThan(100);
    expect(versoMare / n).toBeGreaterThan(0.5);
    expect(versoMare).toBeGreaterThan(versoTerra * 2.5);
  });

  it('la fascia sotto costa non scrive lo stencil: dove sconfina sulla terra, il suolo la copre', () => {
    const f = cerca(citta, 'basso-fondale')[0] as THREE.Mesh;
    expect((f.material as THREE.Material).stencilWrite).toBe(false);
  });

  it('i colori della tavolozza sono validi e distinti', () => {
    const tutti = [...TAVOLOZZA.intonaci, ...TAVOLOZZA.coppi, ...TAVOLOZZA.lamiere];
    for (const c of tutti) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(tutti).size).toBe(tutti.length);
  });
});
