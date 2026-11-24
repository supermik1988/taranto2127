/**
 * Prove del campione dell'aspetto nuovo (T12c, fase A): le due varianti si
 * costruiscono con gli edifici nuovi solo nel campione, la tavolozza si applica e
 * si ritira, i contorni ci sono solo nella variante illustrata, le ombre di
 * contatto solo nella predisegnata, lo stesso edificio ha lo stesso aspetto a
 * ogni avvio, il mare (con la fascia sotto costa) guarda verso l'alto.
 */
import * as THREE from 'three';
import { afterAll, describe, expect, it } from 'vitest';
import { CAMPIONE, COLORI_NUOVI, LUCI, aspettoDa, nelCampione } from './aspetto.js';
import { applicaTavolozza, costruisciCitta, type Citta } from './citta.js';
import { COLORI } from './suolo.js';

const cerca = (c: Citta, nome: string): THREE.Object3D[] => {
  const out: THREE.Object3D[] = [];
  c.gruppo.traverse((o) => {
    if (o.name === nome) out.push(o);
  });
  return out;
};

const illustrata = costruisciCitta('illustrata');
const predisegnata = costruisciCitta('predisegnata');
const attuale = costruisciCitta('attuale');

afterAll(() => {
  applicaTavolozza('attuale');
});

describe('aspetto dalla pagina', () => {
  it("si sceglie con ?aspetto=, altrimenti resta quello di T12", () => {
    expect(aspettoDa('')).toBe('attuale');
    expect(aspettoDa('?seme=3')).toBe('attuale');
    expect(aspettoDa('?aspetto=1')).toBe('illustrata');
    expect(aspettoDa('?seme=3&aspetto=predisegnata')).toBe('predisegnata');
    expect(aspettoDa('?aspetto=boh')).toBe('attuale');
  });
});

describe('campione nelle due varianti', () => {
  it('gli edifici nuovi ci sono nel campione e solo lì; com\'è oggi non ne ha', () => {
    expect(illustrata.nuovi).toBeGreaterThan(300);
    expect(predisegnata.nuovi).toBe(illustrata.nuovi);
    expect(attuale.nuovi).toBe(0);
    // Le parti nuove (balconi, cornicioni, tende) stanno dentro il riquadro del campione, più la misura degli edifici grandi che lo toccano.
    const parti = cerca(illustrata, 'parti')[0] as THREE.Mesh;
    const box = new THREE.Box3().setFromBufferAttribute(parti.geometry.getAttribute('position') as THREE.BufferAttribute);
    expect(box.min.x).toBeGreaterThan(CAMPIONE.minX - 250);
    expect(box.max.x).toBeLessThan(CAMPIONE.maxX + 250);
    expect(-box.max.z).toBeGreaterThan(CAMPIONE.minY - 250);
    expect(-box.min.z).toBeLessThan(CAMPIONE.maxY + 250);
    expect(cerca(attuale, 'parti')).toHaveLength(0);
    expect(nelCampione(1700, -150)).toBe(true);
    expect(nelCampione(3500, -2400)).toBe(false);
  });

  it('variante 1: contorni scuri sugli spigoli, nessuna ombra di contatto', () => {
    expect(LUCI.illustrata.fasce.length).toBeGreaterThanOrEqual(2);
    expect(LUCI.illustrata.fasce.length).toBeLessThanOrEqual(4);
    const contorni = cerca(illustrata, 'contorni')[0] as THREE.LineSegments | undefined;
    expect(contorni).toBeDefined();
    expect(contorni!.geometry.getAttribute('position').count).toBeGreaterThan(20_000);
    expect(cerca(illustrata, 'contorni-impianti')).toHaveLength(1);
    expect(cerca(illustrata, 'ombre-contatto')).toHaveLength(0);
  });

  it('variante 2: ombre di contatto, nessun contorno', () => {
    expect(cerca(predisegnata, 'ombre-contatto')).toHaveLength(1);
    expect(cerca(predisegnata, 'contorni')).toHaveLength(0);
    expect(cerca(predisegnata, 'contorni-impianti')).toHaveLength(0);
    expect(LUCI.predisegnata.ombreMorbide).toBe(true);
  });

  it('com\'è oggi resta com\'era: niente contorni, niente ombre di contatto, niente parabole', () => {
    for (const nome of ['contorni', 'contorni-impianti', 'ombre-contatto', 'parabole', 'parti']) expect(cerca(attuale, nome)).toHaveLength(0);
  });

  it('nel campione ci sono almeno sei tipi di edificio', () => {
    // I conteggi includono tutta la zona; i tipi del campione si contano a parte nel catalogo.
    const tipi = Object.entries(illustrata.conteggio).filter(([, n]) => n > 0);
    expect(tipi.length).toBeGreaterThanOrEqual(6);
  });

  it('stesso edificio, stesso aspetto a ogni avvio', () => {
    // Due costruzioni separate (le varianti cambiano luce e contorni, non le parti): stesse posizioni e stessi colori.
    const a = (cerca(illustrata, 'parti')[0] as THREE.Mesh).geometry;
    const b = (cerca(predisegnata, 'parti')[0] as THREE.Mesh).geometry;
    const diversi = (x: ArrayLike<number>, y: ArrayLike<number>) => {
      if (x.length !== y.length) return -1;
      let n = 0;
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) n += 1;
      return n;
    };
    expect(a.getAttribute('position').count).toBeGreaterThan(100_000);
    expect(diversi(a.getAttribute('position').array, b.getAttribute('position').array)).toBe(0);
    expect(diversi(a.getAttribute('color').array, b.getAttribute('color').array)).toBe(0);
  });

  it('la tavolozza nuova si applica e si ritira', () => {
    applicaTavolozza('predisegnata');
    expect(COLORI.mare).toBe(COLORI_NUOVI.mare);
    expect(COLORI.bassoFondale).toBe(COLORI_NUOVI.bassoFondale);
    applicaTavolozza('attuale');
    expect(COLORI.mare).toBe('#2f83c4');
    expect(COLORI.bassoFondale).toBe('');
  });

  it("il mare, con la fascia chiara sotto costa, guarda tutto verso l'alto", () => {
    const mare = cerca(illustrata, 'mare')[0] as THREE.Mesh;
    const pos = mare.geometry.getAttribute('position');
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    let giu = 0;
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, i + 1);
      c.fromBufferAttribute(pos, i + 2);
      const n = b.clone().sub(a).cross(c.clone().sub(a));
      if (n.y < -1e-6) giu += 1;
    }
    expect(giu).toBe(0);
    // La fascia aggiunge triangoli rispetto al mare di T12.
    const mareOggi = cerca(attuale, 'mare')[0] as THREE.Mesh;
    expect(pos.count).toBeGreaterThan(mareOggi.geometry.getAttribute('position').count);
  });
});
