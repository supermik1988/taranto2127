/**
 * Costruttore di geometrie della città isometrica: accumula triangoli con normali,
 * colori per vertice, coordinate di texture e un'etichetta per vertice (il
 * quartiere, per lo strato), poi produce una sola geometria. Tutto ciò che ha lo
 * stesso materiale finisce in una geometria: pochi ordini di disegno.
 *
 * Coordinate: i punti dei dati sono [x, nord] in metri; nel mondo x verso est,
 * z = −nord, y in alto.
 */
import * as THREE from 'three';
import type { Pt } from '../plastico/data.js';

const UP = new THREE.Vector3(0, 1, 0);
const n = new THREE.Vector3();
const e1 = new THREE.Vector3();
const e2 = new THREE.Vector3();

export const colore = (hex: string) => new THREE.Color(hex);

export interface OpzioniPareti {
  /** Larghezza in metri di una ripetizione della texture lungo la parete. */
  moduloU?: number;
  /** Altezza in metri di una ripetizione; 0 = la texture copre tutta l'altezza della parete. */
  moduloV?: number;
  /** Etichetta dei vertici (quartiere). */
  tag?: number;
}

export class Geo3 {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly col: number[] = [];
  readonly uv: number[] = [];
  readonly tag: number[] = [];
  /** Spigoli per i contorni (coppie di punti); null = non si raccolgono. */
  contorni: number[] | null = null;

  /** Un segmento di contorno, se si raccolgono. */
  spigolo(ax: number, ay: number, az: number, bx: number, by: number, bz: number): void {
    this.contorni?.push(ax, ay, az, bx, by, bz);
  }

  v(x: number, y: number, z: number, nn: THREE.Vector3, c: THREE.Color, u = 0, w = 0, tag = 0): void {
    this.pos.push(x, y, z);
    this.nor.push(nn.x, nn.y, nn.z);
    this.col.push(c.r, c.g, c.b);
    this.uv.push(u, w);
    this.tag.push(tag);
  }

  /** Triangolo orizzontale con la faccia verso l'alto; texture in coordinate del mondo (un'unità ogni `scala` metri). */
  private up(a: Pt, b: Pt, d: Pt, y: number, c: THREE.Color, scala: number, tag: number): void {
    const ccw = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]) > 0;
    for (const [x, py] of ccw ? [a, b, d] : [a, d, b]) this.v(x, y, -py, UP, c, x / scala, py / scala, tag);
  }

  /** Poligono orizzontale all'altezza y (anche con buchi). */
  flat(ring: Pt[], y: number, c: THREE.Color, scala = 8, tag = 0, holes: Pt[][] = []): void {
    if (ring.length < 3) return;
    const contour = ring.map(([x, py]) => new THREE.Vector2(x, py));
    const holeVecs = holes.map((h) => h.map(([x, py]) => new THREE.Vector2(x, py)));
    const all = [...ring, ...holes.flat()];
    const faces = THREE.ShapeUtils.triangulateShape(contour, holeVecs);
    for (const [a, b, d] of faces) this.up(all[a!]!, all[b!]!, all[d!]!, y, c, scala, tag);
  }

  /** Pareti di un anello antiorario, da y0 a y1, con coordinate di texture in moduli. */
  walls(ring: Pt[], y0: number, y1: number, c: THREE.Color, opz: OpzioniPareti = {}): void {
    this.contornoPareti(ring, y0, y1);
    const mu = opz.moduloU ?? 0;
    const mv = opz.moduloV ?? 0;
    const tag = opz.tag ?? 0;
    let along = 0;
    for (let i = 0; i < ring.length; i++) {
      const [x1, p1] = ring[i]!;
      const [x2, p2] = ring[(i + 1) % ring.length]!;
      const len = Math.hypot(x2 - x1, p2 - p1);
      if (len < 0.01) continue;
      n.set((p2 - p1) / len, 0, (x2 - x1) / len);
      const u0 = mu > 0 ? along / mu : 0;
      const u1 = mu > 0 ? (along + len) / mu : 0;
      const v0 = mv > 0 ? y0 / mv : 0;
      const v1 = mv > 0 ? y1 / mv : 1;
      this.v(x1, y0, -p1, n, c, u0, v0, tag);
      this.v(x2, y0, -p2, n, c, u1, v0, tag);
      this.v(x2, y1, -p2, n, c, u1, v1, tag);
      this.v(x1, y0, -p1, n, c, u0, v0, tag);
      this.v(x2, y1, -p2, n, c, u1, v1, tag);
      this.v(x1, y1, -p1, n, c, u0, v1, tag);
      along += len;
    }
  }

  /** Contorni di un anello di pareti: spigoli verticali dove la parete gira di più di 25°, bordo in alto e alla base. */
  private contornoPareti(ring: Pt[], y0: number, y1: number): void {
    if (this.contorni === null) return;
    const k = ring.length;
    for (let i = 0; i < k; i++) {
      const p0 = ring[(i + k - 1) % k]!;
      const p1 = ring[i]!;
      const p2 = ring[(i + 1) % k]!;
      const a0 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      const a1 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
      let d = Math.abs(a1 - a0);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d > (25 * Math.PI) / 180) this.spigolo(p1[0], y0, -p1[1], p1[0], y1, -p1[1]);
      this.spigolo(p1[0], y1, -p1[1], p2[0], y1, -p2[1]);
      if (y0 <= 0.5) this.spigolo(p1[0], y0 + 0.36, -p1[1], p2[0], y0 + 0.36, -p2[1]);
    }
  }

  /** Quadrilatero nello spazio (a, b, d, e in ordine), con la normale dei primi tre punti. */
  quad(a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, e: THREE.Vector3, c: THREE.Color, tag = 0): void {
    n.copy(e1.subVectors(b, a)).cross(e2.subVectors(e, a)).normalize();
    for (const p of [a, b, d, a, d, e]) this.v(p.x, p.y, p.z, n, c, 0, 0, tag);
  }

  tri(a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, c: THREE.Color, tag = 0): void {
    n.copy(e1.subVectors(b, a)).cross(e2.subVectors(d, a)).normalize();
    for (const p of [a, b, d]) this.v(p.x, p.y, p.z, n, c, 0, 0, tag);
  }

  /** Nastro piatto lungo una linea, con raccordi ai giunti; texture lungo la linea se `modulo` > 0. */
  ribbon(line: Pt[], width: number, y: number, c: THREE.Color, scala = 8): void {
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
      this.up(a, e, d, y, c, scala, 0);
      this.up(a, d, b, y, c, scala, 0);
    }
  }

  /**
   * Scatola orientata: centro (x, nord), larghezza lungo l'angolo, profondità,
   * da y0 a y0 + h. Cinque facce (il fondo non si vede).
   */
  box(x: number, y: number, w: number, d: number, h: number, angolo: number, y0: number, c: THREE.Color, tag = 0): void {
    const ux = Math.cos(angolo);
    const uy = Math.sin(angolo);
    const P = (u: number, v: number): Pt => [x + ux * u - uy * v, y + uy * u + ux * v];
    const ring = [P(-w / 2, -d / 2), P(w / 2, -d / 2), P(w / 2, d / 2), P(-w / 2, d / 2)];
    this.walls(ring, y0, y0 + h, c, { tag });
    this.flat(ring, y0 + h, c.clone().multiplyScalar(1.06), 8, tag);
  }

  /** Cilindro (o tronco di cono) verticale con il tappo in alto. */
  cylinder(x: number, y: number, rBase: number, rTop: number, h: number, y0: number, lati: number, c: THREE.Color, tappo?: THREE.Color): void {
    for (let i = 0; i < lati; i++) {
      const a0 = (i / lati) * Math.PI * 2;
      const a1 = ((i + 1) / lati) * Math.PI * 2;
      const b0 = new THREE.Vector3(x + Math.cos(a0) * rBase, y0, -(y + Math.sin(a0) * rBase));
      const b1 = new THREE.Vector3(x + Math.cos(a1) * rBase, y0, -(y + Math.sin(a1) * rBase));
      const t0 = new THREE.Vector3(x + Math.cos(a0) * rTop, y0 + h, -(y + Math.sin(a0) * rTop));
      const t1 = new THREE.Vector3(x + Math.cos(a1) * rTop, y0 + h, -(y + Math.sin(a1) * rTop));
      // Normale orizzontale verso l'esterno, per un'ombreggiatura morbida del fusto.
      const am = (a0 + a1) / 2;
      n.set(Math.cos(am), 0, -Math.sin(am));
      for (const p of [b0, t1, b1, b0, t0, t1]) this.v(p.x, p.y, p.z, n, c);
    }
    if (this.contorni !== null) {
      for (let i = 0; i < lati; i++) {
        const a0 = (i / lati) * Math.PI * 2;
        const a1 = ((i + 1) / lati) * Math.PI * 2;
        this.spigolo(x + Math.cos(a0) * rTop, y0 + h, -(y + Math.sin(a0) * rTop), x + Math.cos(a1) * rTop, y0 + h, -(y + Math.sin(a1) * rTop));
      }
    }
    if (rTop > 0) {
      const ring: Pt[] = [];
      for (let i = 0; i < lati; i++) ring.push([x + Math.cos((i / lati) * Math.PI * 2) * rTop, y + Math.sin((i / lati) * Math.PI * 2) * rTop]);
      this.flat(ring, y0 + h, tappo ?? c.clone().multiplyScalar(1.1));
    }
  }

  /** Trave tra due punti nello spazio, a sezione quadrata. */
  beam(a: THREE.Vector3, b: THREE.Vector3, lato: number, c: THREE.Color): void {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 0.01) return;
    dir.divideScalar(len);
    const side = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3().crossVectors(dir, side).normalize().multiplyScalar(lato / 2);
    const q = new THREE.Vector3().crossVectors(dir, p).normalize().multiplyScalar(lato / 2);
    const corners = [p.clone().add(q), p.clone().sub(q), p.clone().negate().sub(q), p.clone().negate().add(q)];
    for (let i = 0; i < 4; i++) {
      const c0 = corners[i]!;
      const c1 = corners[(i + 1) % 4]!;
      this.quad(a.clone().add(c0), b.clone().add(c0), b.clone().add(c1), a.clone().add(c1), c);
    }
  }

  get empty(): boolean {
    return this.pos.length === 0;
  }

  get triangles(): number {
    return this.pos.length / 9;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Mesh da un costruttore, con ombre e, se servono allo strato, le etichette e i colori di partenza. */
export function meshDa(g: Geo3, material: THREE.Material, opz: { nome: string; proietta?: boolean; riceve?: boolean; strato?: boolean }): THREE.Mesh {
  const m = new THREE.Mesh(g.build(), material);
  m.name = opz.nome;
  m.castShadow = opz.proietta ?? false;
  m.receiveShadow = opz.riceve ?? true;
  if (opz.strato === true) {
    m.userData['tags'] = Uint8Array.from(g.tag);
    m.userData['base'] = Float32Array.from(g.col);
  }
  return m;
}

/** Linee dei contorni raccolti da un costruttore (variante illustrata), o null se non ce ne sono. */
export function contorniDa(g: Geo3, hex: string, nome = 'contorni'): THREE.LineSegments | null {
  if (g.contorni === null || g.contorni.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.contorni, 3));
  geo.computeBoundingSphere();
  const linee = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: hex }));
  linee.name = nome;
  return linee;
}

/** Anello allargato di `d` metri verso l'esterno (anello antiorario), con gli spigoli a punta limitati. */
export function allarga(ring: Pt[], d: number): Pt[] {
  const k = ring.length;
  return ring.map((p, i) => {
    const a = ring[(i + k - 1) % k]!;
    const b = ring[(i + 1) % k]!;
    const n1 = norm([p[1] - a[1], -(p[0] - a[0])]);
    const n2 = norm([b[1] - p[1], -(b[0] - p[0])]);
    const m = norm([n1[0] + n2[0], n1[1] + n2[1]]);
    const cos = Math.max(0.5, m[0] * n1[0] + m[1] * n1[1]);
    return [p[0] + (m[0] * d) / cos, p[1] + (m[1] * d) / cos];
  });
}

function norm(v: Pt): Pt {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

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
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    a += x1 * y2 - x2 * y1;
  }
  return { ...best, fill: Math.abs(a / 2) / best.area };
}

/** Punto di un lotto per coordinate relative u (lungo il primo lato) e v (lungo il secondo), da 0 a 1. */
export function nelLotto(quad: Pt[], u: number, v: number): Pt {
  const [q0, q1, q2, q3] = quad as [Pt, Pt, Pt, Pt];
  const ax = q0[0] + (q1[0] - q0[0]) * u;
  const ay = q0[1] + (q1[1] - q0[1]) * u;
  const bx = q3[0] + (q2[0] - q3[0]) * u;
  const by = q3[1] + (q2[1] - q3[1]) * u;
  return [ax + (bx - ax) * v, ay + (by - ay) * v];
}

/** Riquadro di un insieme di punti. */
export function riquadro(points: Pt[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

/** Indice a griglia di poligoni, per chiedere in fretta «questo punto cade dentro qualcosa?». */
export class Indice {
  private readonly celle = new Map<number, Pt[][]>();
  constructor(private readonly lato = 40) {}

  private key(i: number, j: number): number {
    return (i + 5000) * 10000 + (j + 5000);
  }

  add(ring: Pt[]): void {
    const r = riquadro(ring);
    for (let i = Math.floor(r.minX / this.lato); i <= Math.floor(r.maxX / this.lato); i++) {
      for (let j = Math.floor(r.minY / this.lato); j <= Math.floor(r.maxY / this.lato); j++) {
        const k = this.key(i, j);
        const list = this.celle.get(k);
        if (list === undefined) this.celle.set(k, [ring]);
        else list.push(ring);
      }
    }
  }

  dentro(x: number, y: number, margine = 0): boolean {
    const list = this.celle.get(this.key(Math.floor(x / this.lato), Math.floor(y / this.lato)));
    if (list === undefined) return false;
    if (list.some((r) => inPoly(x, y, r))) return true;
    if (margine === 0) return false;
    return [
      [margine, 0],
      [-margine, 0],
      [0, margine],
      [0, -margine],
    ].some(([dx, dy]) => list.some((r) => inPoly(x + dx!, y + dy!, r)));
  }
}

function inPoly(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
