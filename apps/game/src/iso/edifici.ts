/**
 * Edifici e alberi della città isometrica. Le pareti di tutti gli edifici con lo
 * stesso stile di facciata sono una sola geometria; tetti e ciminiere sono una
 * geometria ciascuno; cisterne, antenne, lucernari e alberi sono ripetuti con
 * InstancedMesh. Varianti solo dall'identificativo della sagoma (hash01).
 */
import * as THREE from 'three';
import { centroid, hash01, pick, pointInPolygon, type GeoBuilding } from '../plastico/data.js';
import { Geo3, colore, contorniDa, meshDa, obb } from './geo3.js';
import { textureFacciata } from './texture.js';
import { TAVOLOZZA } from './aspetto.js';
import { aggiungiEdificio } from './catalogo.js';
import { STILI, type StileFacciata, type TipoEdificio, type Variante } from './tipi.js';

/** Categorie di oggetti che i livelli di dettaglio accendono e spengono. */
export type Dettaglio = 'cisterne' | 'antenne' | 'lucernari' | 'auto' | 'cespugli' | 'barche' | 'parabole';

export class CostruttoreEdifici {
  readonly pareti = new Map<StileFacciata, Geo3>(STILI.map((s) => [s, new Geo3()]));
  readonly tetti = new Geo3();
  readonly ciminiere = new Geo3();
  readonly cisterne: THREE.Matrix4[] = [];
  readonly antenne: THREE.Matrix4[] = [];
  readonly lucernari: THREE.Matrix4[] = [];
  /** Parti degli edifici del catalogo nuovo (balconi, cornicioni, tende, gronde): colore per vertice, senza texture. */
  get parti(): Geo3 {
    // Stesso materiale dei tetti (colore per vertice, due facce): stessa geometria, un ordine di disegno in meno.
    return this.tetti;
  }
  readonly parabole: THREE.Matrix4[] = [];
  /** Balconi in rilievo (accesi solo al livello alto e da vicino) e i loro contorni. */
  readonly balconi = new Geo3();
  readonly lineeBalconi: number[] = [];
  /** Spigoli per i contorni, comuni a tutte le geometrie degli edifici. */
  readonly linee: number[] = [];
  /** Colore del fusto delle ciminiere. */
  coloreCiminiera: string = TAVOLOZZA.ciminiera;
  readonly conteggio: Record<TipoEdificio, number> = { palazzina: 0, casa: 0, 'citta-vecchia': 0, centro: 0, pubblico: 0, chiesa: 0, negozio: 0, capannone: 0, impianto: 0, basso: 0 };

  /** Accende o spegne la raccolta dei contorni su tutte le geometrie degli edifici. */
  accendiContorni(si: boolean): void {
    const l = si ? this.linee : null;
    for (const g of [...this.pareti.values(), this.tetti, this.ciminiere]) g.contorni = l;
  }

  /** Aggiunge un edificio del catalogo (catalogo.ts); `tag` è il quartiere (per lo strato), `ruggine` per gli impianti fermi. */
  aggiungi(b: GeoBuilding, tipo: TipoEdificio, tag = 0, ruggine = false): Variante {
    return aggiungiEdificio(this, b, tipo, tag, ruggine);
  }

  tettoAFalde(box: ReturnType<typeof obb>, h: number, pendenza: number, tetto: THREE.Color, parete: THREE.Color, tag: number): void {
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
    this.tetti.spigolo(r1.x, r1.y, r1.z, r2.x, r2.y, r2.z);
    for (const [p, q] of [[a, b], [b, d], [d, e], [e, a], [a, r1], [b, r2], [d, r2], [e, r1]] as const) this.tetti.spigolo(p.x, p.y, p.z, q.x, q.y, q.z);
    // Timpani del colore delle pareti.
    this.tetti.tri(P(-hu, -hv, h), P(-hu, 0, colmo - 0.1), P(-hu, hv, h), parete, tag);
    this.tetti.tri(P(hu, hv, h), P(hu, 0, colmo - 0.1), P(hu, -hv, h), parete, tag);
  }

  /** Lucernari: file di lastre chiare lungo il capannone, sulle falde o sul tetto piano. */
  fileLucernari(b: GeoBuilding, box: ReturnType<typeof obb>, y: number, falde: boolean): void {
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

  dettagliTetto(b: GeoBuilding, box: ReturnType<typeof obb>, h: number, v: Variante): void {
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
    this.ciminiere.cylinder(x, y, r * 1.5, r, alta * 0.86, base, 12, colore(this.coloreCiminiera));
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
    if (!this.balconi.empty) out.push(meshDa(this.balconi, new THREE.MeshLambertMaterial({ vertexColors: true }), { nome: 'balconi', proietta: true, strato: true }));
    const parabola = unisci([new THREE.CylinderGeometry(0.62, 0.12, 0.22, 10).rotateX(-0.2), new THREE.BoxGeometry(0.08, 0.9, 0.08).translate(0, -0.45, 0)]);
    out.push(...ripetuti('parabole', parabola, '#f4f4f0', this.parabole, false));
    for (const [linee, nome] of [
      [this.linee, 'contorni'],
      [this.lineeBalconi, 'contorni-balconi'],
    ] as const) {
      const g = new Geo3();
      g.contorni = linee;
      const l = contorniDa(g, TAVOLOZZA.contorno, nome);
      if (l !== null) out.push(l);
    }
    return out;
  }
}

/** InstancedMesh di un oggetto ripetuto, se c'è almeno una copia. */
export function ripetuti(nome: Dettaglio | string, forma: THREE.BufferGeometry, hex: string, matrici: THREE.Matrix4[], ombra = true): THREE.InstancedMesh[] {
  if (matrici.length === 0) return [];
  // Senza ombra portata le facce di fondo non servono a nulla (la vista è sempre dall'alto, a 30°).
  const geometria = ombra ? forma : senzaFondo(forma);
  const mesh = new THREE.InstancedMesh(geometria, new THREE.MeshLambertMaterial({ color: hex }), matrici.length);
  matrici.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.castShadow = ombra;
  mesh.receiveShadow = true;
  mesh.name = nome;
  mesh.computeBoundingSphere();
  return [mesh];
}

/**
 * Toglie i triangoli rivolti in basso (normale con y < −0,9): con la camera a 30° di
 * elevazione non si vedono mai. Solo per oggetti che non proiettano ombra (la mappa
 * d'ombra disegna le facce posteriori). Conserva posizioni, normali e colori.
 */
export function senzaFondo(forma: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = forma.index !== null ? forma.toNonIndexed() : forma;
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const col = g.getAttribute('color') as THREE.BufferAttribute | undefined;
  const P: number[] = [];
  const N: number[] = [];
  const C: number[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    const ny = (nor.getY(i) + nor.getY(i + 1) + nor.getY(i + 2)) / 3;
    if (ny < -0.9) continue;
    for (let k = i; k < i + 3; k++) {
      P.push(pos.getX(k), pos.getY(k), pos.getZ(k));
      N.push(nor.getX(k), nor.getY(k), nor.getZ(k));
      if (col !== undefined) C.push(col.getX(k), col.getY(k), col.getZ(k));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  if (col !== undefined) out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  out.computeBoundingSphere();
  return out;
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

/** Verdi delle chiome per specie (la tavolozza nuova li sostituisce: aspetto.ts). */
export const VERDI: Record<Specie, string[]> = {
  pino: ['#2f7a3a', '#3a8742', '#2a6b34'],
  latifoglia: ['#4fa33a', '#5db544', '#46973a', '#6cbd48'],
  giovane: ['#6cc04a', '#7fcb55', '#5cae40', '#8fd25e'],
  cespuglio: ['#3f8a35', '#4d983d', '#5aa346'],
  ulivo: ['#7a9a5a', '#86a565', '#6e8f52'],
  cipresso: ['#245a2e', '#2c6636'],
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
