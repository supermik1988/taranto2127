/**
 * La città isometrica (T12, fase A: provino). Costruisce dal codice, con le sagome
 * di OpenStreetMap, edifici con facciate e tetti, strade con marciapiedi e
 * segnaletica, viali alberati, parchi, mare e i lotti di ILSIDER. Coordinate come
 * nel plastico: x verso est, z = −nord, y in alto, un'unità è un metro. Scala
 * reale: nessuna esagerazione verticale.
 *
 * Geometrie raggruppate: tutte le pareti di uno stile di facciata sono una sola
 * geometria, così come tetti, strade e verde; cisterne, antenne e alberi sono
 * ripetuti con InstancedMesh. Migliaia di edifici restano pochi ordini di disegno.
 */
import type { DistrictId } from '@taranto2127/sim';
import * as THREE from 'three';
import { centroid, districtAt, geo, hash01, hashString, pick, pointInPolygon, polygonArea, type GeoBuilding, type Pt } from '../plastico/data.js';
import { CAMPATA, PIANO, textureFacciata } from './texture.js';
import { tipoEdificio, variante, type StileFacciata, type TipoEdificio, type Variante } from './tipi.js';

// ---------- Costruttore di geometrie con coordinate di texture ----------

const tmp = new THREE.Color();

class Geo3 {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly col: number[] = [];
  readonly uv: number[] = [];

  v(x: number, y: number, z: number, n: THREE.Vector3, c: THREE.Color, u = 0, w = 0): void {
    this.pos.push(x, y, z);
    this.nor.push(n.x, n.y, n.z);
    this.col.push(c.r, c.g, c.b);
    this.uv.push(u, w);
  }

  /** Triangolo orizzontale con la faccia verso l'alto. */
  private up(a: Pt, b: Pt, d: Pt, y: number, c: THREE.Color): void {
    const n = new THREE.Vector3(0, 1, 0);
    const ccw = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]) > 0;
    for (const [x, py] of ccw ? [a, b, d] : [a, d, b]) this.v(x, y, -py, n, c, x / CAMPATA, py / CAMPATA);
  }

  flat(ring: Pt[], y: number, c: THREE.Color): void {
    if (ring.length < 3) return;
    const faces = THREE.ShapeUtils.triangulateShape(ring.map(([x, py]) => new THREE.Vector2(x, py)), []);
    for (const [a, b, d] of faces) this.up(ring[a!]!, ring[b!]!, ring[d!]!, y, c);
  }

  /** Pareti di un anello antiorario, con coordinate di texture in campate e piani. */
  walls(ring: Pt[], y0: number, y1: number, c: THREE.Color, textured = true): void {
    let along = 0;
    const n = new THREE.Vector3();
    for (let i = 0; i < ring.length; i++) {
      const [x1, p1] = ring[i]!;
      const [x2, p2] = ring[(i + 1) % ring.length]!;
      const len = Math.hypot(x2 - x1, p2 - p1);
      if (len < 0.01) continue;
      n.set((p2 - p1) / len, 0, (x2 - x1) / len);
      const u0 = textured ? along / CAMPATA : 0;
      const u1 = textured ? (along + len) / CAMPATA : 0;
      const v0 = textured ? y0 / PIANO : 0;
      const v1 = textured ? y1 / PIANO : 0;
      this.v(x1, y0, -p1, n, c, u0, v0);
      this.v(x2, y0, -p2, n, c, u1, v0);
      this.v(x2, y1, -p2, n, c, u1, v1);
      this.v(x1, y0, -p1, n, c, u0, v0);
      this.v(x2, y1, -p2, n, c, u1, v1);
      this.v(x1, y1, -p1, n, c, u0, v1);
      along += len;
    }
  }

  /** Quadrilatero qualunque (vertici nello spazio), con la normale data. */
  quad(a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, e: THREE.Vector3, c: THREE.Color): void {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(e, a)).normalize();
    for (const p of [a, b, d, a, d, e]) this.v(p.x, p.y, p.z, n, c);
  }

  tri(a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, c: THREE.Color): void {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
    for (const p of [a, b, d]) this.v(p.x, p.y, p.z, n, c);
  }

  /** Nastro piatto lungo una linea, con raccordi ai giunti. */
  ribbon(line: Pt[], width: number, y: number, c: THREE.Color): void {
    const half = width / 2;
    for (let i = 1; i < line.length; i++) {
      const [x1, p1] = line[i - 1]!;
      const [x2, p2] = line[i]!;
      const len = Math.hypot(x2 - x1, p2 - p1) || 1;
      const nx = (-(p2 - p1) / len) * half;
      const ny = ((x2 - x1) / len) * half;
      const ex = ((x2 - x1) / len) * half * 0.5;
      const ey = ((p2 - p1) / len) * half * 0.5;
      const a: Pt = [x1 + nx - ex, p1 + ny - ey];
      const b: Pt = [x2 + nx + ex, p2 + ny + ey];
      const d: Pt = [x2 - nx + ex, p2 - ny + ey];
      const e: Pt = [x1 - nx - ex, p1 - ny - ey];
      this.up(a, e, d, y, c);
      this.up(a, d, b, y, c);
    }
  }

  get empty(): boolean {
    return this.pos.length === 0;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

const c = (hex: string) => new THREE.Color(hex);

function mesh(g: Geo3, material: THREE.Material, cast = true, receive = true): THREE.Mesh {
  const m = new THREE.Mesh(g.build(), material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

const plain = (opts: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, ...opts });

// ---------- Forme ----------

/** Rettangolo orientato più piccolo che contiene la sagoma (provando la direzione di ogni lato). */
export function obb(ring: Pt[]): { cx: number; cy: number; ux: number; uy: number; hu: number; hv: number; fill: number } {
  let best = { cx: 0, cy: 0, ux: 1, uy: 0, hu: 0, hv: 0, area: Infinity };
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 0.5) continue;
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const [x, y] of ring) {
      const u = x * ux + y * uy;
      const v = -x * uy + y * ux;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const area = (maxU - minU) * (maxV - minV);
    if (area < best.area) {
      const cu = (minU + maxU) / 2;
      const cv = (minV + maxV) / 2;
      best = { cx: cu * ux - cv * uy, cy: cu * uy + cv * ux, ux, uy, hu: (maxU - minU) / 2, hv: (maxV - minV) / 2, area };
    }
  }
  return { ...best, fill: Math.abs(polygonArea(ring)) / best.area };
}

// ---------- Edifici ----------

interface Dettagli {
  cisterne: THREE.Matrix4[];
  antenne: THREE.Matrix4[];
}

const STILI: StileFacciata[] = ['balconi', 'persiane', 'nastro', 'vetrine', 'lamiera', 'cieco'];

/** Edifici raggruppati per stile di facciata, più tetti e dettagli. */
export class CostruttoreEdifici {
  readonly pareti = new Map<StileFacciata, Geo3>(STILI.map((s) => [s, new Geo3()]));
  readonly tetti = new Geo3();
  readonly dettagli: Dettagli = { cisterne: [], antenne: [] };
  readonly ciminiere: THREE.Object3D[] = [];
  readonly conteggio: Record<TipoEdificio, number> = { palazzina: 0, casa: 0, 'citta-vecchia': 0, pubblico: 0, negozio: 0, capannone: 0, impianto: 0, basso: 0 };

  aggiungi(b: GeoBuilding, tipo: TipoEdificio): Variante {
    const box = obb(b.p);
    const v = variante(b, tipo, box.fill > 0.82 && box.hv > 2.5);
    this.conteggio[tipo] += 1;
    const parete = c(v.parete);
    const copertura = c(v.copertura);
    const h = v.altezza;
    this.pareti.get(v.facciata)!.walls(b.p, 0, h, parete);
    if (v.tetto === 'falde-coppi' || v.tetto === 'falde-lamiera') {
      this.tettoAFalde(box, h, v.tetto === 'falde-coppi' ? 0.5 : 0.22, copertura, parete);
    } else {
      this.tetti.flat(b.p, h, copertura);
      // Parapetto: le terrazze hanno il muretto bianco tipico dei tetti piani del sud.
      const alto = v.tetto === 'terrazza' ? 1.0 : 0.4;
      this.tetti.walls(b.p, h, h + alto, v.tetto === 'terrazza' ? c('#f3efe6') : parete.clone().multiplyScalar(0.92), false);
      this.dettagliTetto(b, box, h, v);
    }
    if (v.ciminiera > 0) this.ciminiera(box.cx, box.cy, h, v.ciminiera, b.id);
    return v;
  }

  private tettoAFalde(box: ReturnType<typeof obb>, h: number, pendenza: number, tetto: THREE.Color, parete: THREE.Color): void {
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
    this.tetti.quad(a, b, r2, r1, tetto);
    this.tetti.quad(d, e, r1, r2, tetto.clone().multiplyScalar(0.88));
    // Timpani del colore delle pareti.
    this.tetti.tri(P(-hu, -hv, h), P(-hu, 0, colmo - 0.1), P(-hu, hv, h), parete);
    this.tetti.tri(P(hu, hv, h), P(hu, 0, colmo - 0.1), P(hu, -hv, h), parete);
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
      m.compose(new THREE.Vector3(x, h + 0.9, -y), q, new THREE.Vector3(1, 1, 1));
      this.dettagli.cisterne.push(m.clone());
    }
    for (let i = 0; i < v.antenne; i++) {
      const t = 0.2 + hash01(b.id, 50 + i) * 0.5;
      const x = cx + box.ux * box.hu * (t - 0.5) * 1.2;
      const y = cy + box.uy * box.hu * (t - 0.5) * 1.2;
      m.compose(new THREE.Vector3(x, h + 1.8, -y), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash01(b.id, 60 + i) * Math.PI), new THREE.Vector3(1, 1, 1));
      this.dettagli.antenne.push(m.clone());
    }
  }

  private ciminiera(x: number, y: number, h: number, alta: number, id: number): void {
    const g = new THREE.Group();
    const fusto = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, alta, 16), new THREE.MeshLambertMaterial({ color: '#c9c2b6' }));
    fusto.position.y = alta / 2;
    const fascia = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.45, alta * 0.12, 16), new THREE.MeshLambertMaterial({ color: hash01(id, 70) < 0.5 ? '#c0392b' : '#7a7470' }));
    fascia.position.y = alta * 0.9;
    for (const part of [fusto, fascia]) {
      part.castShadow = true;
      g.add(part);
    }
    g.position.set(x + 4, h * 0.2, -y);
    this.ciminiere.push(g);
  }

  /** Le mesh: una per stile di facciata, una per i tetti, due ripetute per i dettagli. */
  meshes(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const [stile, g] of this.pareti) {
      if (g.empty) continue;
      const m = mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, map: textureFacciata(stile) }));
      m.name = `pareti-${stile}`;
      out.push(m);
    }
    const roofs = mesh(this.tetti, plain({ side: THREE.DoubleSide }));
    roofs.name = 'tetti';
    out.push(roofs);
    if (this.dettagli.cisterne.length > 0) {
      const tank = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.85, 0.85, 1.6, 10), new THREE.MeshLambertMaterial({ color: '#eef1f2' }), this.dettagli.cisterne.length);
      this.dettagli.cisterne.forEach((mm, i) => tank.setMatrixAt(i, mm));
      tank.castShadow = true;
      tank.name = 'cisterne';
      out.push(tank);
    }
    if (this.dettagli.antenne.length > 0) {
      const pole = new THREE.BoxGeometry(0.12, 3.2, 0.12);
      const bar = new THREE.BoxGeometry(1.6, 0.08, 0.08).translate(0, 1.2, 0);
      const geom = mergeTwo(pole, bar);
      const antenna = new THREE.InstancedMesh(geom, new THREE.MeshLambertMaterial({ color: '#4f5357' }), this.dettagli.antenne.length);
      this.dettagli.antenne.forEach((mm, i) => antenna.setMatrixAt(i, mm));
      antenna.name = 'antenne';
      out.push(antenna);
    }
    out.push(...this.ciminiere);
    return out;
  }
}

/** Unisce due geometrie non indicizzate (bastano per palo e traversa dell'antenna). */
function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const na = a.toNonIndexed();
  const nb = b.toNonIndexed();
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) {
    const x = na.getAttribute(name).array as Float32Array;
    const y = nb.getAttribute(name).array as Float32Array;
    const merged = new Float32Array(x.length + y.length);
    merged.set(x);
    merged.set(y, x.length);
    g.setAttribute(name, new THREE.BufferAttribute(merged, 3));
  }
  return g;
}

// ---------- Alberi ----------

export type Specie = 'pino' | 'latifoglia' | 'giovane';

/** Alberi ripetuti: una InstancedMesh per chiome e una per tronchi, per specie. */
export class Alberi {
  private readonly punti: { x: number; y: number; specie: Specie; scala: number; seed: number }[] = [];

  add(x: number, y: number, specie: Specie, seed: number, scala = 1): void {
    this.punti.push({ x, y, specie, scala: scala * (0.8 + hash01(seed, 1) * 0.45), seed });
  }

  get count(): number {
    return this.punti.length;
  }

  meshes(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    const forme: Record<Specie, { chioma: THREE.BufferGeometry; tronco: number; verdi: string[] }> = {
      // Pino domestico: chioma larga e piatta, verde scuro.
      pino: { chioma: new THREE.SphereGeometry(4.2, 10, 6).scale(1, 0.45, 1).translate(0, 9, 0), tronco: 8, verdi: ['#3f6f3a', '#467a3e', '#365f34'] },
      // Latifoglia dei viali: chioma tonda, verde pieno.
      latifoglia: { chioma: new THREE.IcosahedronGeometry(3.2, 1).translate(0, 6, 0), tronco: 4.5, verdi: ['#5a9a3c', '#67a844', '#4f8f38', '#73b04a'] },
      // Alberello del bosco giovane: piccolo e chiaro.
      giovane: { chioma: new THREE.IcosahedronGeometry(1.8, 0).translate(0, 3.2, 0), tronco: 2.4, verdi: ['#6fae46', '#7dba50', '#5f9e3e', '#8cc25a'] },
    };
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (const specie of ['pino', 'latifoglia', 'giovane'] as Specie[]) {
      const lista = this.punti.filter((p) => p.specie === specie);
      if (lista.length === 0) continue;
      const forma = forme[specie];
      const chiome = new THREE.InstancedMesh(forma.chioma, new THREE.MeshLambertMaterial(), lista.length);
      const tronchi = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.4, forma.tronco, 5).translate(0, forma.tronco / 2, 0), new THREE.MeshLambertMaterial({ color: '#6b4d33' }), lista.length);
      lista.forEach((p, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash01(p.seed, 2) * Math.PI * 2);
        m.compose(new THREE.Vector3(p.x, 0, -p.y), q, new THREE.Vector3(p.scala, p.scala, p.scala));
        chiome.setMatrixAt(i, m);
        tronchi.setMatrixAt(i, m);
        chiome.setColorAt(i, tmp.set(pick(forma.verdi, hash01(p.seed, 3))));
      });
      chiome.castShadow = true;
      chiome.receiveShadow = true;
      chiome.name = `alberi-${specie}`;
      out.push(chiome, tronchi);
    }
    return out;
  }
}

// ---------- Indice delle sagome, per non piantare alberi dentro le case ----------

class Indice {
  private readonly celle = new Map<string, Pt[][]>();
  constructor(private readonly lato = 40) {}

  add(ring: Pt[]): void {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of ring) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    for (let i = Math.floor(minX / this.lato); i <= Math.floor(maxX / this.lato); i++) {
      for (let j = Math.floor(minY / this.lato); j <= Math.floor(maxY / this.lato); j++) {
        const key = `${i},${j}`;
        const list = this.celle.get(key) ?? [];
        list.push(ring);
        this.celle.set(key, list);
      }
    }
  }

  dentro(x: number, y: number, margine = 0): boolean {
    const list = this.celle.get(`${Math.floor(x / this.lato)},${Math.floor(y / this.lato)}`) ?? [];
    if (list.some((r) => pointInPolygon([x, y], r))) return true;
    if (margine === 0) return false;
    return [[margine, 0], [-margine, 0], [0, margine], [0, -margine]].some(([dx, dy]) => list.some((r) => pointInPolygon([x + dx!, y + dy!], r)));
  }
}

// ---------- Tavolozza del terreno e delle strade ----------

export const TERRENO = {
  campagna: '#cfc58f', // terra secca e prato bruciato dal sole
  citta: '#d9d1bd', // suolo urbano chiaro tra le case
  industria: '#c8b89a', // piazzali dello stabilimento
  mare: '#2f83c4',
  asfalto: '#56595f',
  asfaltoSuperstrada: '#4c4f55',
  marciapiede: '#d3ccbf',
  segnaletica: '#f4f2ea',
  binari: '#7d7266',
  verde: { parco: '#79b84e', campo: '#8cc75a', bosco: '#4f8f3c', macchia: '#6f9f4b', prato: '#86c057', campi: '#c2c967', cimitero: '#7aa565' } as Record<string, string>,
};

const LARGHEZZE = [0, 16, 13, 10, 7];

// ---------- La scena del provino ----------

export interface Area {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export type StatoParchi = 'fermo' | 'bosco';

const dentroArea = (a: Area, [x, y]: Pt) => x >= a.minX && x <= a.maxX && y >= a.minY && y <= a.maxY;

/**
 * Costruisce la parte di città che cade nell'area: edifici, strade, verde,
 * acqua, alberi e il lotto dei parchi minerali nello stato dato.
 */
export function costruisciCitta(area: Area, statoParchi: StatoParchi): { gruppo: THREE.Group; conteggio: Record<TipoEdificio, number>; alberi: number } {
  const gruppo = new THREE.Group();
  const indice = new Indice();
  const parchi = geo.lotti['lotto-parchi-minerali']!;

  // Terreno: oltre la zona continua in forma semplice, niente vuoto ai bordi.
  const suolo = new Geo3();
  const margine = 6000;
  suolo.flat([[area.minX - margine, area.minY - margine], [area.maxX + margine, area.minY - margine], [area.maxX + margine, area.maxY + margine], [area.minX - margine, area.maxY + margine]], -0.05, c(TERRENO.campagna));
  for (const id of ['tamburi', 'citta-vecchia', 'borgo'] as const) {
    const outline = geo.quartieri[id];
    if (outline !== undefined) suolo.flat(outline, 0.02, c(TERRENO.citta));
  }
  for (const r of geo.industria) suolo.flat(r, 0.03, c(TERRENO.industria));
  for (const r of geo.stabilimento) suolo.flat(r, 0.04, c(TERRENO.industria));
  const suoloMesh = mesh(suolo, plain(), false, true);
  suoloMesh.name = 'suolo';
  gruppo.add(suoloMesh);

  // Mare: blu pieno, con un riflesso morbido del sole.
  const mare = new Geo3();
  for (const r of geo.acqua) mare.flat(r, 0.08, c(TERRENO.mare));
  const mareMesh = new THREE.Mesh(mare.build(), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: new THREE.Color('#9fc9ea') }));
  mareMesh.receiveShadow = true;
  mareMesh.name = 'mare';
  gruppo.add(mareMesh);

  // Verde.
  const verde = new Geo3();
  const alberi = new Alberi();
  for (const v of geo.verde) {
    if (!v.p.some((p) => dentroArea(area, p))) continue;
    verde.flat(v.p, 0.1, c(TERRENO.verde[v.k] ?? TERRENO.verde['prato']!));
    if (v.k === 'parco' || v.k === 'bosco' || v.k === 'cimitero') piantaInPoligono(v.p, alberi, v.k === 'bosco' ? 9 : 13, v.k === 'cimitero' ? 'pino' : 'latifoglia', hashString(JSON.stringify(v.p[0])));
  }
  if (!verde.empty) gruppo.add(mesh(verde, plain(), false, true));

  // Edifici: quelli del lotto dei parchi minerali seguono lo stato del lotto.
  const edifici = new CostruttoreEdifici();
  for (const b of geo.edifici) {
    const ctr = centroid(b.p);
    if (!dentroArea(area, ctr)) continue;
    // Nel lotto dei parchi minerali gli edifici di OpenStreetMap non si disegnano: il lotto ha il suo aspetto per stato.
    if (pointInPolygon(ctr, parchi)) continue;
    const quartiere: DistrictId | undefined = districtAt(ctr);
    const stabilimento = geo.stabilimento.some((r) => pointInPolygon(ctr, r));
    edifici.aggiungi(b, tipoEdificio(b, { quartiere, stabilimento }));
    indice.add(b.p);
  }
  for (const m of edifici.meshes()) gruppo.add(m);

  // Strade: marciapiede sotto, asfalto sopra, mezzeria tratteggiata; viali alberati lungo le principali.
  const strade = new Geo3();
  const segni = new Geo3();
  for (const s of geo.strade) {
    if (!s.l.some((p) => dentroArea(area, p))) continue;
    const w = LARGHEZZE[s.c]!;
    if (s.c >= 2) strade.ribbon(s.l, w + 5, 0.12, c(TERRENO.marciapiede));
  }
  for (const s of geo.strade) {
    if (!s.l.some((p) => dentroArea(area, p))) continue;
    const w = LARGHEZZE[s.c]!;
    strade.ribbon(s.l, w, 0.16, c(s.c === 1 ? TERRENO.asfaltoSuperstrada : TERRENO.asfalto));
    if (s.c <= 3) tratteggio(s.l, segni, s.c === 1 ? 0.35 : 0.25);
    if (s.c === 2 || s.c === 3) viale(s.l, w / 2 + 3, alberi, indice, s.c);
  }
  for (const f of geo.ferrovie) if (f.some((p) => dentroArea(area, p))) strade.ribbon(f, 3, 0.14, c(TERRENO.binari));
  const stradeMesh = mesh(strade, plain(), false, true);
  stradeMesh.name = 'strade';
  gruppo.add(stradeMesh);
  if (!segni.empty) gruppo.add(mesh(segni, plain(), false, true));

  // Il lotto dei parchi minerali nello stato del provino.
  gruppo.add(statoParchi === 'fermo' ? parchiFermi(parchi) : boscoGiovane(parchi, alberi));
  for (const m of alberi.meshes()) gruppo.add(m);
  return { gruppo, conteggio: edifici.conteggio, alberi: alberi.count };
}

function tratteggio(line: Pt[], out: Geo3, half: number): void {
  const bianco = c(TERRENO.segnaletica);
  let phase = 0;
  for (let i = 1; i < line.length; i++) {
    const [x1, y1] = line[i - 1]!;
    const [x2, y2] = line[i]!;
    const len = Math.hypot(x2 - x1, y2 - y1);
    for (let t = phase; t < len; t += 9) {
      const a = t / len;
      const b = Math.min(len, t + 4.5) / len;
      out.ribbon([[x1 + (x2 - x1) * a, y1 + (y2 - y1) * a], [x1 + (x2 - x1) * b, y1 + (y2 - y1) * b]], half * 2, 0.2, bianco);
    }
    phase = (phase + 9 - (len % 9)) % 9;
  }
}

function viale(line: Pt[], offset: number, alberi: Alberi, indice: Indice, classe: number): void {
  const passo = classe === 2 ? 12 : 15;
  for (let i = 1; i < line.length; i++) {
    const [x1, y1] = line[i - 1]!;
    const [x2, y2] = line[i]!;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 6) continue;
    const nx = -(y2 - y1) / len;
    const ny = (x2 - x1) / len;
    for (let t = passo / 2; t < len; t += passo) {
      for (const side of [-1, 1]) {
        const x = x1 + ((x2 - x1) * t) / len + nx * offset * side;
        const y = y1 + ((y2 - y1) * t) / len + ny * offset * side;
        if (indice.dentro(x, y, 2.5) || geo.acqua.some((r) => pointInPolygon([x, y], r))) continue;
        alberi.add(x, y, 'latifoglia', Math.round(x * 31 + y * 17), 0.85);
      }
    }
  }
}

function piantaInPoligono(ring: Pt[], alberi: Alberi, passo: number, specie: Specie, seed: number, scala = 1): void {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  let k = 0;
  for (let x = minX + passo / 2; x < maxX; x += passo) {
    for (let y = minY + passo / 2; y < maxY; y += passo) {
      k += 1;
      const jx = x + (hash01(seed, k) - 0.5) * passo * 0.8;
      const jy = y + (hash01(seed, k + 7777) - 0.5) * passo * 0.8;
      if (pointInPolygon([jx, jy], ring)) alberi.add(jx, jy, specie, seed + k, scala);
    }
  }
}

// ---------- Il lotto dei parchi minerali ----------

/** Punto del lotto per coordinate relative u (lungo il primo lato) e v (lungo il secondo). */
function nelLotto(quad: Pt[], u: number, v: number): Pt {
  const [q0, q1, q2, q3] = quad as [Pt, Pt, Pt, Pt];
  const ax = q0[0] + (q1[0] - q0[0]) * u;
  const ay = q0[1] + (q1[1] - q0[1]) * u;
  const bx = q3[0] + (q2[0] - q3[0]) * u;
  const by = q3[1] + (q2[1] - q3[1]) * u;
  return [ax + (bx - ax) * v, ay + (by - ay) * v];
}

/**
 * Parchi minerali fermi: piazzale polveroso, lunghi cumuli di minerale di ferro,
 * carbone e calcare, macchine di ripresa ferme e arrugginite sui loro binari,
 * nastri trasportatori su cavalletti.
 */
function parchiFermi(quad: Pt[]): THREE.Group {
  const g = new THREE.Group();
  const fondo = new Geo3();
  // Sopra l'acqua dei canali di servizio, che nel provino non si vedono.
  fondo.flat(quad, 0.11, c('#a89377'));
  g.add(mesh(fondo, plain(), false, true));
  const cumuli = new Geo3();
  const colori = ['#8a3b22', '#2f2b29', '#a8a29a', '#7a3220', '#3a3431'];
  const file = 6;
  for (let i = 0; i < file; i++) {
    const v0 = 0.08 + (i * 0.84) / file;
    const v1 = v0 + 0.84 / file - 0.035;
    const a = nelLotto(quad, 0.06, v0);
    const b = nelLotto(quad, 0.94, v0);
    const d = nelLotto(quad, 0.94, v1);
    const e = nelLotto(quad, 0.06, v1);
    const altezza = 12 + hash01(i, 90) * 6;
    const colore = c(colori[i % colori.length]!);
    // Cumulo lungo a sezione triangolare, con le testate inclinate.
    const P = ([x, y]: Pt, h = 0) => new THREE.Vector3(x, h, -y);
    const mid1: Pt = [(a[0] + e[0]) / 2, (a[1] + e[1]) / 2];
    const mid2: Pt = [(b[0] + d[0]) / 2, (b[1] + d[1]) / 2];
    const inset = 0.06;
    const r1: Pt = [mid1[0] + (mid2[0] - mid1[0]) * inset, mid1[1] + (mid2[1] - mid1[1]) * inset];
    const r2: Pt = [mid2[0] + (mid1[0] - mid2[0]) * inset, mid2[1] + (mid1[1] - mid2[1]) * inset];
    cumuli.quad(P(a), P(b), P(r2, altezza), P(r1, altezza), colore);
    cumuli.quad(P(d), P(e), P(r1, altezza), P(r2, altezza), colore.clone().multiplyScalar(0.8));
    cumuli.tri(P(e), P(a), P(r1, altezza), colore.clone().multiplyScalar(0.9));
    cumuli.tri(P(b), P(d), P(r2, altezza), colore.clone().multiplyScalar(0.9));
  }
  g.add(mesh(cumuli, plain({ side: THREE.DoubleSide })));
  // Macchine di ripresa ferme tra un cumulo e l'altro, arrugginite, su binari.
  const ruggine = new THREE.MeshLambertMaterial({ color: '#9a5b35' });
  const giallo = new THREE.MeshLambertMaterial({ color: '#b68f45' });
  const binari = new Geo3();
  for (let i = 1; i < file; i++) {
    const v = 0.08 + (i * 0.84) / file - 0.018;
    binari.ribbon([nelLotto(quad, 0.04, v), nelLotto(quad, 0.96, v)], 4, 0.14, c('#6d6257'));
    const [x, y] = nelLotto(quad, 0.2 + hash01(i, 91) * 0.6, v);
    const macchina = new THREE.Group();
    const carro = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 10), ruggine);
    carro.position.y = 3;
    const torre = new THREE.Mesh(new THREE.BoxGeometry(5, 18, 5), giallo);
    torre.position.y = 12;
    const braccio = new THREE.Mesh(new THREE.BoxGeometry(42, 2.2, 2.2), ruggine);
    braccio.position.set(14, 17, 0);
    braccio.rotation.z = -0.18;
    for (const part of [carro, torre, braccio]) {
      part.castShadow = true;
      macchina.add(part);
    }
    macchina.position.set(x, 0, -y);
    const [x2, y2] = nelLotto(quad, 0.9, v);
    macchina.rotation.y = -Math.atan2(y2 - y, x2 - x) + hash01(i, 92) * 0.6 - 0.3;
    g.add(macchina);
  }
  g.add(mesh(binari, plain(), false, true));
  // Nastri trasportatori su cavalletti, verso lo stabilimento.
  const nastri = new THREE.Group();
  const cavalletto = new THREE.BoxGeometry(1.2, 9, 1.2);
  for (const v of [0.04, 0.97]) {
    const a = nelLotto(quad, 0.02, v);
    const b = nelLotto(quad, 0.98, v);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nastro = new THREE.Mesh(new THREE.BoxGeometry(len, 2, 3), new THREE.MeshLambertMaterial({ color: '#8b7a68' }));
    nastro.position.set((a[0] + b[0]) / 2, 10, -(a[1] + b[1]) / 2);
    nastro.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    nastro.castShadow = true;
    nastri.add(nastro);
    for (let t = 0; t <= 1; t += 0.08) {
      const [x, y] = nelLotto(quad, 0.02 + t * 0.96, v);
      const piede = new THREE.Mesh(cavalletto, ruggine);
      piede.position.set(x, 4.5, -y);
      piede.castShadow = true;
      nastri.add(piede);
    }
  }
  g.add(nastri);
  return g;
}

/** Bonifica conclusa: prato, sentieri chiari e un bosco giovane di alberelli di altezze diverse. */
function boscoGiovane(quad: Pt[], alberi: Alberi): THREE.Group {
  const g = new THREE.Group();
  const fondo = new Geo3();
  fondo.flat(quad, 0.11, c('#86bd55'));
  const sentieri = new Geo3();
  sentieri.ribbon([nelLotto(quad, 0, 0.5), nelLotto(quad, 0.3, 0.42), nelLotto(quad, 0.6, 0.58), nelLotto(quad, 1, 0.5)], 4, 0.13, c('#e2d6b3'));
  sentieri.ribbon([nelLotto(quad, 0.5, 0), nelLotto(quad, 0.45, 0.4), nelLotto(quad, 0.55, 1)], 4, 0.13, c('#e2d6b3'));
  g.add(mesh(fondo, plain(), false, true));
  g.add(mesh(sentieri, plain(), false, true));
  const passo = 11;
  let k = 0;
  for (let u = 0.02; u < 0.98; u += passo / 1000) {
    for (let v = 0.02; v < 0.98; v += passo / 650) {
      k += 1;
      const ju = u + (hash01(k, 95) - 0.5) * 0.008;
      const jv = v + (hash01(k, 96) - 0.5) * 0.012;
      // I sentieri restano liberi.
      if (Math.abs(jv - (0.5 + Math.sin(ju * 6) * 0.06)) < 0.025 || Math.abs(ju - 0.5) < 0.012) continue;
      const [x, y] = nelLotto(quad, ju, jv);
      alberi.add(x, y, hash01(k, 97) < 0.12 ? 'pino' : 'giovane', k * 13 + 5, hash01(k, 98) < 0.3 ? 1.5 : 1);
    }
  }
  return g;
}

// ---------- Foglio di confronto ----------

/** Sagome di prova per il foglio con tutti i tipi affiancati (identificativi fissi, varianti ripetibili). */
export function foglioTipi(): { gruppo: THREE.Group; etichette: { tipo: TipoEdificio; x: number; y: number; z: number }[] } {
  const rect = (x: number, y: number, w: number, d: number): Pt[] => [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
  /** Primo identificativo, da `da` in su, la cui variante ha il tetto chiesto: gli esempi mostrano entrambe le varianti. */
  const conTetto = (tipo: TipoEdificio, p: Pt[], tetto: string, da: number): number => {
    for (let id = da; id < da + 500; id++) if (variante({ id, p, k: 'altro' }, tipo, true).tetto === tetto) return id;
    return da;
  };
  // Prima fila: abitare. Seconda fila: servizi, commercio, industria.
  const casaFalde = rect(36, 0, 13, 10);
  const casi: { tipo: TipoEdificio; id: number; p: Pt[]; k: string }[] = [
    { tipo: 'palazzina', id: 1001, p: rect(0, 0, 26, 14), k: 'altro' },
    { tipo: 'casa', id: conTetto('casa', rect(36, 0, 13, 10), 'terrazza', 1100), p: rect(36, 22, 13, 10), k: 'altro' },
    { tipo: 'casa', id: conTetto('casa', casaFalde, 'falde-coppi', 1100), p: casaFalde, k: 'altro' },
    { tipo: 'citta-vecchia', id: 1011, p: rect(62, 2, 8, 12), k: 'altro' },
    { tipo: 'citta-vecchia', id: 1012, p: rect(70, 2, 7, 12), k: 'altro' },
    { tipo: 'citta-vecchia', id: 1013, p: rect(77, 2, 9, 12), k: 'altro' },
    { tipo: 'basso', id: 1061, p: rect(96, 4, 8, 6), k: 'basso' },
    { tipo: 'pubblico', id: 1021, p: rect(0, -70, 36, 20), k: 'pubblico' },
    { tipo: 'negozio', id: 1031, p: rect(46, -68, 30, 16), k: 'negozi' },
    { tipo: 'capannone', id: 1041, p: rect(86, -74, 56, 26), k: 'industria' },
    { tipo: 'impianto', id: 1052, p: rect(152, -70, 26, 18), k: 'industria' },
  ];
  const gruppo = new THREE.Group();
  const suolo = new Geo3();
  suolo.flat([[-600, -600], [800, -600], [800, 600], [-600, 600]], -0.05, c(TERRENO.campagna));
  suolo.flat([[-20, -90], [190, -90], [190, 40], [-20, 40]], 0, c(TERRENO.citta));
  const strada = new Geo3();
  for (const y of [-14, -84]) {
    suolo.ribbon([[-20, y], [190, y]], 17, 0.03, c(TERRENO.marciapiede));
    strada.ribbon([[-20, y], [190, y]], 12, 0.05, c(TERRENO.asfalto));
  }
  gruppo.add(mesh(suolo, plain(), false, true), mesh(strada, plain(), false, true));
  const edifici = new CostruttoreEdifici();
  const etichette: { tipo: TipoEdificio; x: number; y: number; z: number }[] = [];
  const visti = new Set<TipoEdificio>();
  for (const caso of casi) {
    const v = edifici.aggiungi({ id: caso.id, p: caso.p, k: caso.k }, caso.tipo);
    if (visti.has(caso.tipo)) continue;
    visti.add(caso.tipo);
    const [x, y] = centroid(caso.p);
    etichette.push({ tipo: caso.tipo, x, y: v.altezza + (v.ciminiera > 0 ? v.ciminiera * 0.2 + 4 : 4), z: -y });
  }
  for (const m of edifici.meshes()) gruppo.add(m);
  const alberi = new Alberi();
  for (let x = -14; x < 190; x += 14) {
    alberi.add(x, -24, 'latifoglia', x + 3, 0.85);
    alberi.add(x + 7, -94, 'latifoglia', x + 5, 0.85);
  }
  alberi.add(112, 22, 'pino', 9);
  for (const m of alberi.meshes()) gruppo.add(m);
  return { gruppo, etichette };
}
