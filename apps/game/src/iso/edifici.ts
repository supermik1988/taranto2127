/**
 * Edifici e alberi della città isometrica. Le pareti di tutti gli edifici con lo
 * stesso stile di facciata sono una sola geometria; tetti e ciminiere sono una
 * geometria ciascuno; cisterne, antenne, lucernari e alberi sono ripetuti con
 * InstancedMesh. Varianti solo dall'identificativo della sagoma (hash01).
 */
import * as THREE from 'three';
import { centroid, hash01, pick, pointInPolygon, type GeoBuilding } from '../plastico/data.js';
import { Geo3, colore, meshDa, obb } from './geo3.js';
import { CAMPATA, MODULO_INDUSTRIALE, PIANO, textureFacciata } from './texture.js';
import { STILI, variante, type StileFacciata, type TipoEdificio, type Variante } from './tipi.js';

/** Categorie di oggetti che i livelli di dettaglio accendono e spengono. */
export type Dettaglio = 'cisterne' | 'antenne' | 'lucernari' | 'auto' | 'cespugli' | 'barche';

export class CostruttoreEdifici {
  readonly pareti = new Map<StileFacciata, Geo3>(STILI.map((s) => [s, new Geo3()]));
  readonly tetti = new Geo3();
  readonly ciminiere = new Geo3();
  readonly cisterne: THREE.Matrix4[] = [];
  readonly antenne: THREE.Matrix4[] = [];
  readonly lucernari: THREE.Matrix4[] = [];
  readonly conteggio: Record<TipoEdificio, number> = { palazzina: 0, casa: 0, 'citta-vecchia': 0, pubblico: 0, negozio: 0, capannone: 0, impianto: 0, basso: 0 };

  /** Aggiunge un edificio; `tag` è il quartiere (per lo strato), `ruggine` scurisce i colori (impianti spenti). */
  aggiungi(b: GeoBuilding, tipo: TipoEdificio, tag = 0, ruggine = false): Variante {
    const box = obb(b.p);
    const v = variante(b, tipo, box.fill > 0.82 && box.hv > 2.5);
    this.conteggio[tipo] += 1;
    // Impianti spenti: lamiere e tetti arrugginiti, colori ripetibili dall'identificativo.
    const parete = colore(ruggine ? pick(['#8f6a52', '#7d6656', '#9c6f4f', '#86705e'], hash01(b.id, 21)) : v.parete);
    const copertura = colore(ruggine ? pick(['#7d4630', '#6f5a49', '#8a4b2c'], hash01(b.id, 22)) : v.copertura);
    const h = v.altezza;
    const industriale = v.facciata === 'industriale';
    this.pareti.get(v.facciata)!.walls(b.p, 0, h, parete, { moduloU: industriale ? MODULO_INDUSTRIALE : CAMPATA, moduloV: industriale ? 0 : PIANO, tag });
    if (v.tetto === 'falde-coppi' || v.tetto === 'falde-lamiera') {
      this.tettoAFalde(box, h, v.tetto === 'falde-coppi' ? 0.5 : 0.22, copertura, parete, tag);
      if (v.lucernari) this.fileLucernari(b, box, h + box.hv * 0.11, true);
    } else {
      this.tetti.flat(b.p, h, copertura, 8, tag);
      // Parapetto: le terrazze hanno il muretto bianco tipico dei tetti piani del sud.
      const alto = v.tetto === 'terrazza' ? 1.0 : 0.4;
      this.tetti.walls(b.p, h, h + alto, v.tetto === 'terrazza' ? colore('#f3efe6') : parete.clone().multiplyScalar(0.92), { tag });
      this.dettagliTetto(b, box, h, v);
      if (v.lucernari) this.fileLucernari(b, box, h, false);
    }
    if (v.ciminiera > 0) this.ciminiera(box.cx + 4, box.cy, h * 0.2, v.ciminiera, hash01(b.id, 70) < 0.5 ? '#c0392b' : '#7a7470');
    return v;
  }

  private tettoAFalde(box: ReturnType<typeof obb>, h: number, pendenza: number, tetto: THREE.Color, parete: THREE.Color, tag: number): void {
    const { cx, cy, ux, uy, hu, hv } = box;
    const vx = -uy;
    const vy = ux;
    const P = (u: number, v: number, y: number) => new THREE.Vector3(cx + ux * u + vx * v, y, -(cy + uy * u + vy * v));
    const colmo = h + hv * pendenza;
    const sporto = 0.4;
    const a = P(-hu - sporto, -hv - sporto, h - 0.2);
    const b = P(hu + sporto, -hv - sporto, h - 0.2);
    const d = P(hu + sporto, hv + sporto, h - 0.2);
    const e = P(-hu - sporto, hv + sporto, h - 0.2);
    const r1 = P(-hu - sporto, 0, colmo);
    const r2 = P(hu + sporto, 0, colmo);
    this.tetti.quad(a, b, r2, r1, tetto, tag);
    this.tetti.quad(d, e, r1, r2, tetto.clone().multiplyScalar(0.88), tag);
    // Timpani del colore delle pareti.
    this.tetti.tri(P(-hu, -hv, h), P(-hu, 0, colmo - 0.1), P(-hu, hv, h), parete, tag);
    this.tetti.tri(P(hu, hv, h), P(hu, 0, colmo - 0.1), P(hu, -hv, h), parete, tag);
  }

  /** Lucernari: file di lastre chiare lungo il capannone, sulle falde o sul tetto piano. */
  private fileLucernari(b: GeoBuilding, box: ReturnType<typeof obb>, y: number, falde: boolean): void {
    if (box.hu < 10 || box.hv < 5) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(box.uy, box.ux));
    const passo = 9;
    const file = falde ? [-0.5, 0.5] : [-0.45, 0, 0.45];
    for (const f of file) {
      for (let u = -box.hu + passo / 2; u < box.hu - 2; u += passo) {
        const x = box.cx + box.ux * u - box.uy * box.hv * f;
        const yy = box.cy + box.uy * u + box.ux * box.hv * f;
        if (!pointInPolygon([x, yy], b.p)) continue;
        m.compose(new THREE.Vector3(x, y + 0.3, -yy), q, new THREE.Vector3(1, 1, 1));
        this.lucernari.push(m.clone());
      }
    }
  }

  private dettagliTetto(b: GeoBuilding, box: ReturnType<typeof obb>, h: number, v: Variante): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const [cx, cy] = centroid(b.p);
    for (let i = 0; i < v.cisterne; i++) {
      const t = 0.3 + hash01(b.id, 30 + i) * 0.4;
      const corner = b.p[Math.floor(hash01(b.id, 40 + i) * b.p.length)]!;
      const x = cx + (corner[0] - cx) * t;
      const y = cy + (corner[1] - cy) * t;
      if (!pointInPolygon([x, y], b.p)) continue;
      m.compose(new THREE.Vector3(x, h + 0.9, -y), q.identity(), new THREE.Vector3(1, 1, 1));
      this.cisterne.push(m.clone());
    }
    for (let i = 0; i < v.antenne; i++) {
      const t = 0.2 + hash01(b.id, 50 + i) * 0.5;
      const x = cx + box.ux * box.hu * (t - 0.5) * 1.2;
      const y = cy + box.uy * box.hu * (t - 0.5) * 1.2;
      m.compose(new THREE.Vector3(x, h + 1.8, -y), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash01(b.id, 60 + i) * Math.PI), new THREE.Vector3(1, 1, 1));
      this.antenne.push(m.clone());
    }
  }

  /** Ciminiera rastremata con una fascia colorata in alto. */
  ciminiera(x: number, y: number, base: number, alta: number, fascia: string): void {
    const r = Math.max(1.6, alta / 28);
    this.ciminiere.cylinder(x, y, r * 1.5, r, alta * 0.86, base, 12, colore('#c9c2b6'));
    this.ciminiere.cylinder(x, y, r * 1.02, r * 1.02, alta * 0.1, base + alta * 0.86, 12, colore(fascia), colore('#3b3631'));
  }

  /** Le mesh: una per stile di facciata, tetti, ciminiere, e i dettagli ripetuti (con il loro nome per i livelli). */
  meshes(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const [stile, g] of this.pareti) {
      if (g.empty) continue;
      out.push(meshDa(g, new THREE.MeshLambertMaterial({ vertexColors: true, map: textureFacciata(stile) }), { nome: `pareti-${stile}`, proietta: true, strato: true }));
    }
    if (!this.tetti.empty) out.push(meshDa(this.tetti, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { nome: 'tetti', proietta: true, strato: true }));
    if (!this.ciminiere.empty) out.push(meshDa(this.ciminiere, new THREE.MeshLambertMaterial({ vertexColors: true }), { nome: 'ciminiere', proietta: true }));
    out.push(...ripetuti('cisterne', new THREE.CylinderGeometry(0.85, 0.85, 1.6, 8), '#eef1f2', this.cisterne));
    const antenna = unisci([new THREE.BoxGeometry(0.12, 3.2, 0.12), new THREE.BoxGeometry(1.6, 0.08, 0.08).translate(0, 1.2, 0)]);
    out.push(...ripetuti('antenne', antenna, '#4f5357', this.antenne, false));
    out.push(...ripetuti('lucernari', new THREE.BoxGeometry(6, 0.6, 2.2), '#bcd3e0', this.lucernari, false));
    return out;
  }
}

/** InstancedMesh di un oggetto ripetuto, se c'è almeno una copia. */
export function ripetuti(nome: Dettaglio | string, geometria: THREE.BufferGeometry, hex: string, matrici: THREE.Matrix4[], ombra = true): THREE.InstancedMesh[] {
  if (matrici.length === 0) return [];
  const mesh = new THREE.InstancedMesh(geometria, new THREE.MeshLambertMaterial({ color: hex }), matrici.length);
  matrici.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.castShadow = ombra;
  mesh.receiveShadow = true;
  mesh.name = nome;
  mesh.computeBoundingSphere();
  return [mesh];
}

/** Unisce geometrie semplici (posizioni e normali), anche indicizzate. */
export function unisci(parti: THREE.BufferGeometry[], colori?: THREE.Color[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  parti.forEach((p, k) => {
    const g = p.index !== null ? p.toNonIndexed() : p;
    const a = g.getAttribute('position');
    const b = g.getAttribute('normal');
    for (let i = 0; i < a.count; i++) {
      pos.push(a.getX(i), a.getY(i), a.getZ(i));
      nor.push(b.getX(i), b.getY(i), b.getZ(i));
      const c = colori?.[k];
      if (c !== undefined) col.push(c.r, c.g, c.b);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (colori !== undefined) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

// ---------- Alberi ----------

export type Specie = 'pino' | 'latifoglia' | 'giovane' | 'cespuglio' | 'ulivo' | 'cipresso';
export const SPECIE: Specie[] = ['pino', 'latifoglia', 'giovane', 'cespuglio', 'ulivo', 'cipresso'];

/**
 * Importanza di un albero per i livelli di dettaglio: 0 viali e lotti, 1 parchi,
 * 2 riempitivo (cespugli, macchia). Il livello basso tiene solo i primi.
 */
export type Importanza = 0 | 1 | 2;

interface PuntoAlbero {
  x: number;
  y: number;
  specie: Specie;
  scala: number;
  seed: number;
  importanza: Importanza;
}

const VERDI: Record<Specie, string[]> = {
  pino: ['#3f6f3a', '#467a3e', '#365f34'],
  latifoglia: ['#5a9a3c', '#67a844', '#4f8f38', '#73b04a'],
  giovane: ['#6fae46', '#7dba50', '#5f9e3e', '#8cc25a'],
  cespuglio: ['#4f7f36', '#5c8c3e', '#6b9846'],
  ulivo: ['#7d9160', '#8a9b6a', '#72875a'],
  cipresso: ['#2f5530', '#36603a'],
};

/** Chioma e tronco in una sola geometria: il tronco ha il colore per vertice scuro, la chioma bianco (prende il verde dell'istanza). */
/** Tronco aperto (senza tappi) a pochi lati: a questa scala è un tratto di un pixel o due. */
const fusto = (r0: number, r1: number, h: number, lati: number) => new THREE.CylinderGeometry(r0, r1, h, lati, 1, true).translate(0, h / 2, 0);

/**
 * Chioma e tronco in una sola geometria, con pochi triangoli: il tronco ha il
 * colore per vertice scuro, la chioma bianco (prende il verde dell'istanza).
 */
function forma(specie: Specie): THREE.BufferGeometry {
  const tronco = new THREE.Color('#7a5a3c');
  const bianco = new THREE.Color('#ffffff');
  switch (specie) {
    case 'pino':
      // Pino domestico: chioma larga e piatta su un fusto alto.
      return unisci([fusto(0.25, 0.4, 8, 4), new THREE.IcosahedronGeometry(4.2, 0).scale(1, 0.42, 1).translate(0, 9, 0)], [tronco, bianco]);
    case 'latifoglia':
      return unisci([fusto(0.22, 0.35, 4.5, 4), new THREE.IcosahedronGeometry(3.2, 0).translate(0, 6, 0)], [tronco, bianco]);
    case 'giovane':
      return unisci([fusto(0.15, 0.22, 2.4, 3), new THREE.OctahedronGeometry(1.9, 0).translate(0, 3.2, 0)], [tronco, bianco]);
    case 'cespuglio':
      return unisci([new THREE.OctahedronGeometry(1.4, 0).scale(1, 0.6, 1).translate(0, 0.7, 0)], [bianco]);
    case 'ulivo':
      // Ulivo: tronco corto e chioma larga e bassa, grigio-verde.
      return unisci([fusto(0.3, 0.45, 2.2, 3), new THREE.OctahedronGeometry(2.5, 0).scale(1, 0.6, 1).translate(0, 3, 0)], [tronco, bianco]);
    case 'cipresso':
      // Cipresso: colonna stretta e alta, verde scuro (cimiteri).
      return unisci([new THREE.ConeGeometry(1.3, 11, 5, 1, true).translate(0, 6, 0)], [bianco]);
  }
}

/** Lato dei riquadri in cui si dividono gli alberi: la camera scarta quelli fuori dallo schermo. */
const RIQUADRO_ALBERI = 2000;

/** Alberi ripetuti: una InstancedMesh per specie, ordinata per importanza. */
export class Alberi {
  private readonly punti: PuntoAlbero[] = [];

  add(x: number, y: number, specie: Specie, seed: number, scala = 1, importanza: Importanza = 1): void {
    this.punti.push({ x, y, specie, scala: scala * (0.8 + hash01(seed, 1) * 0.45), seed, importanza });
  }

  get count(): number {
    return this.punti.length;
  }

  /** Quanti alberi hanno al massimo l'importanza data, per specie: servono ai livelli di dettaglio. */
  /** Le mesh ripetute; `quartiere` dà l'etichetta di quartiere di un punto, perché lo strato colori anche gli alberi. */
  meshes(quartiere?: (x: number, y: number) => number): THREE.InstancedMesh[] {
    const out: THREE.InstancedMesh[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const tmp = new THREE.Color();
    const forme = new Map<Specie, THREE.BufferGeometry>();
    const materiale = new THREE.MeshLambertMaterial({ vertexColors: true });
    // Un gruppo per specie e per riquadro, ordinato per importanza.
    const gruppi = new Map<string, PuntoAlbero[]>();
    for (const p of this.punti) {
      const key = `${p.specie}|${Math.floor(p.x / RIQUADRO_ALBERI)}|${Math.floor(p.y / RIQUADRO_ALBERI)}`;
      const list = gruppi.get(key);
      if (list === undefined) gruppi.set(key, [p]);
      else list.push(p);
    }
    for (const [key, lista] of [...gruppi.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const specie = key.split('|')[0] as Specie;
      lista.sort((a, b) => a.importanza - b.importanza || hash01(a.seed, 4) - hash01(b.seed, 4));
      let geometria = forme.get(specie);
      if (geometria === undefined) {
        geometria = forma(specie);
        forme.set(specie, geometria);
      }
      const mesh = new THREE.InstancedMesh(geometria, materiale, lista.length);
      lista.forEach((p, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash01(p.seed, 2) * Math.PI * 2);
        m.compose(new THREE.Vector3(p.x, 0, -p.y), q, new THREE.Vector3(p.scala, p.scala, p.scala));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, tmp.set(pick(VERDI[specie], hash01(p.seed, 3))));
      });
      mesh.castShadow = specie !== 'cespuglio';
      mesh.receiveShadow = true;
      mesh.name = specie === 'cespuglio' ? 'cespugli' : `alberi-${specie}`;
      // Soglie per i livelli: quante istanze hanno importanza 0, ≤ 1, ≤ 2.
      mesh.userData['soglie'] = [0, 1, 2].map((k) => lista.filter((p) => p.importanza <= k).length);
      if (quartiere !== undefined && mesh.instanceColor !== null) {
        const tags = Uint8Array.from(lista.map((p) => quartiere(p.x, p.y)));
        if (tags.some((t) => t !== 0)) {
          mesh.userData['tags'] = tags;
          mesh.userData['base'] = Float32Array.from(mesh.instanceColor.array as Float32Array);
          mesh.userData['istanze'] = true;
        }
      }
      mesh.computeBoundingSphere();
      out.push(mesh);
    }
    return out;
  }
}
