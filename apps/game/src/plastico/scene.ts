/**
 * La scena del plastico, in three.js. Si carica solo quando si mostra il
 * plastico (caricamento separato). Coordinate: x verso est, z verso sud
 * (z = −nord), y in alto; un'unità è un metro.
 *
 * Tutto è costruito dal codice: nessun modello esterno. Il caso è sempre
 * ripetibile (hash01, hashString): niente Math.random.
 */
import type { DistrictId } from '@taranto2127/sim';
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { HorizontalTiltShiftShader } from 'three/examples/jsm/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/examples/jsm/shaders/VerticalTiltShiftShader.js';
import {
  DISTRICTS_ON_MODEL,
  PALETTE,
  VERTICAL,
  buildingColors,
  buildingHeight,
  centroid,
  districtAt,
  districtOutline,
  geo,
  hash01,
  hashString,
  lotOf,
  pick,
  pointInPolygon,
  type GeoBuilding,
  type Pt,
} from './data.js';
import { LOT_LOOKS, type LayerValue, type LotLook } from './looks.js';

export interface PlasticoApi {
  /** Aspetto di ogni lotto, dallo stato di gioco. */
  setLots(looks: Record<string, LotLook>): void;
  /** Strato colorato: valori e nomi per quartiere, o null per spegnerlo. */
  setLayer(layer: { values: Record<DistrictId, LayerValue>; names: Record<string, string> } | null): void;
  /** Posizione sullo schermo (pixel nella tela) del centro di un lotto o di un quartiere. */
  screenPosition(id: string): { x: number; y: number } | null;
  /** Porta la camera su un lotto o su un quartiere. */
  focus(id: string, distance?: number): void;
  /** Evidenzia sul plastico il lotto o il quartiere aperto in una finestra (null: nessuno). */
  setSelected(id: string | null): void;
  /** Il lotto o il quartiere evidenziato. */
  selected(): string | null;
  /**
   * Sposta la camera, senza cambiare distanza né rotazione, perché il centro
   * dell'oggetto cada al centro del rettangolo libero (pixel nella tela).
   */
  frameIn(id: string, area: { left: number; top: number; right: number; bottom: number }): void;
  /** Immagini al secondo negli ultimi due secondi. */
  fps(): number;
  dispose(): void;
}

export interface PlasticoOptions {
  canvas: HTMLCanvasElement;
  labels: HTMLElement;
  onSelect: (kind: 'district' | 'lot', id: string) => void;
}

// ---------- Costruttore di geometrie ----------

const color = new THREE.Color();

/** Accumula triangoli con normali e colori per vertice, poi produce una sola geometria. */
class Builder {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly col: number[] = [];
  /** Per ogni vertice, il quartiere a cui appartiene (0 = nessuno), per lo strato. */
  readonly tag: number[] = [];

  private vertex(x: number, y: number, z: number, n: THREE.Vector3, c: THREE.Color, tag: number): void {
    this.pos.push(x, y, z);
    this.nor.push(n.x, n.y, n.z);
    this.col.push(c.r, c.g, c.b);
    this.tag.push(tag);
  }

  /** Triangolo orizzontale, ordinato in modo che la faccia anteriore guardi in alto. */
  private up3(a: Pt, b: Pt, d: Pt, y: number, c: THREE.Color, tag: number): void {
    const up = new THREE.Vector3(0, 1, 0);
    // In coordinate di mondo (x, −nord), antiorario visto dall'alto = antiorario nel piano (x, nord).
    const ccw = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]) > 0;
    for (const [x, py] of ccw ? [a, b, d] : [a, d, b]) this.vertex(x, y, -py, up, c, tag);
  }

  /** Poligono orizzontale all'altezza y. */
  flat(ring: Pt[], y: number, c: THREE.Color, tag = 0): void {
    if (ring.length < 3) return;
    const contour = ring.map(([x, py]) => new THREE.Vector2(x, py));
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const [a, b, d] of faces) this.up3(ring[a!]!, ring[b!]!, ring[d!]!, y, c, tag);
  }

  /** Pareti verticali di un anello, da y0 a y1. */
  walls(ring: Pt[], y0: number, y1: number, c: THREE.Color, tag = 0): void {
    const n = new THREE.Vector3();
    for (let i = 0; i < ring.length; i++) {
      const [x1, py1] = ring[i]!;
      const [x2, py2] = ring[(i + 1) % ring.length]!;
      const len = Math.hypot(x2 - x1, py2 - py1) || 1;
      // Anello antiorario nel piano (x, nord): normale esterna (dy, −dx), con z = −nord.
      n.set((py2 - py1) / len, 0, (x2 - x1) / len);
      const z1 = -py1;
      const z2 = -py2;
      this.vertex(x1, y0, z1, n, c, tag);
      this.vertex(x2, y0, z2, n, c, tag);
      this.vertex(x2, y1, z2, n, c, tag);
      this.vertex(x1, y0, z1, n, c, tag);
      this.vertex(x2, y1, z2, n, c, tag);
      this.vertex(x1, y1, z1, n, c, tag);
    }
  }

  /** Nastro piatto lungo una linea (strade, binari). */
  ribbon(line: Pt[], width: number, y: number, c: THREE.Color): void {
    const half = width / 2;
    for (let i = 1; i < line.length; i++) {
      const [x1, py1] = line[i - 1]!;
      const [x2, py2] = line[i]!;
      const len = Math.hypot(x2 - x1, py2 - py1) || 1;
      const nx = (-(py2 - py1) / len) * half;
      const ny = ((x2 - x1) / len) * half;
      // Un poco oltre gli estremi, così i tratti si raccordano senza buchi.
      const ex = ((x2 - x1) / len) * half * 0.6;
      const ey = ((py2 - py1) / len) * half * 0.6;
      const a: Pt = [x1 + nx - ex, py1 + ny - ey];
      const b: Pt = [x2 + nx + ex, py2 + ny + ey];
      const d: Pt = [x2 - nx + ex, py2 - ny + ey];
      const e: Pt = [x1 - nx - ex, py1 - ny - ey];
      this.up3(a, e, d, y, c, 0);
      this.up3(a, d, b, y, c, 0);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

const c = (hex: string) => new THREE.Color(hex);
const vertexMaterial = (opts: THREE.MeshLambertMaterialParameters = {}) =>
  new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, ...opts });

function meshOf(builder: Builder, material: THREE.Material, shadows: { cast?: boolean; receive?: boolean } = {}): THREE.Mesh {
  const mesh = new THREE.Mesh(builder.build(), material);
  mesh.castShadow = shadows.cast ?? false;
  mesh.receiveShadow = shadows.receive ?? true;
  return mesh;
}

// ---------- Primitive dei modelli ----------

const standard = new Map<string, THREE.MeshLambertMaterial>();
function mat(hex: string, opts: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  const key = `${hex}|${JSON.stringify(opts)}`;
  let m = standard.get(key);
  if (m === undefined) {
    m = new THREE.MeshLambertMaterial({ color: hex, ...opts });
    standard.set(key, m);
  }
  return m;
}

function box(w: number, h: number, d: number, hex: string): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex));
  mesh.position.y = h / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(rTop: number, rBottom: number, h: number, hex: string, segments = 14): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), mat(hex));
  mesh.position.y = h / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Capannone con tetto a due falde. */
function shed(w: number, h: number, d: number, wall: string, roof: string): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, h, d, wall));
  const shape = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, d * 0.28)]);
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  roofGeo.translate(0, 0, -w / 2);
  roofGeo.rotateY(Math.PI / 2);
  const r = new THREE.Mesh(roofGeo, mat(roof));
  r.position.y = h;
  r.castShadow = true;
  g.add(r);
  return g;
}

// ---------- Lotti ----------

/** Riferimento di un lotto: quadrilatero, centro, orientamento, misure. */
interface LotFrame {
  quad: Pt[];
  center: Pt;
  angle: number;
  width: number;
  depth: number;
}

function lotFrame(quad: Pt[]): LotFrame {
  const [q0, q1, , q3] = quad as [Pt, Pt, Pt, Pt];
  return {
    quad,
    center: centroid(quad),
    angle: Math.atan2(q1[1] - q0[1], q1[0] - q0[0]),
    width: Math.hypot(q1[0] - q0[0], q1[1] - q0[1]),
    depth: Math.hypot(q3[0] - q0[0], q3[1] - q0[1]),
  };
}

/** Punto del lotto per coordinate relative (u lungo il primo lato, v lungo il secondo), da 0 a 1. */
function at(frame: LotFrame, u: number, v: number): THREE.Vector3 {
  const [q0, q1, q2, q3] = frame.quad as [Pt, Pt, Pt, Pt];
  const ax = q0[0] + (q1[0] - q0[0]) * u;
  const ay = q0[1] + (q1[1] - q0[1]) * u;
  const bx = q3[0] + (q2[0] - q3[0]) * u;
  const by = q3[1] + (q2[1] - q3[1]) * u;
  return new THREE.Vector3(ax + (bx - ax) * v, 0, -(ay + (by - ay) * v));
}

/** Mette un oggetto nel lotto, ruotato come il lotto. */
function place(group: THREE.Group, object: THREE.Object3D, frame: LotFrame, u: number, v: number, turn = 0): THREE.Object3D {
  const p = at(frame, u, v);
  object.position.x = p.x;
  object.position.z = p.z;
  object.rotation.y = frame.angle + turn;
  group.add(object);
  return object;
}

/** Generatore ripetibile per un lotto e un aspetto. */
function rngFor(seed: string): () => number {
  let i = 0;
  const base = hashString(seed) * 1e6;
  return () => hash01(base, i++);
}

interface Animated {
  update(time: number): void;
}

const GROUND: Record<LotLook, string> = {
  fermo: '#a59683',
  lavori: '#c7a77c',
  acciaio: '#cfcbc3',
  bosco: '#8cc46a',
  energia: '#b8d48c',
  mare: '#e6dcc6',
};

/** Quota del terreno dello stabilimento: il fondo dei lotti sta qui, mai sopra. */
export const TERRAIN_Y = 0.4;

/**
 * Bordo irregolare di un lotto: i lati del quadrilatero divisi in tratti, ogni
 * punto spinto verso l'interno di una quantità ripetibile tra `min` e `max` metri.
 */
function raggedRing(frame: LotFrame, min: number, max: number, seed: string): Pt[] {
  const rnd = rngFor(seed);
  const [q0, q1, q2, q3] = frame.quad as [Pt, Pt, Pt, Pt];
  const center = frame.center;
  const ring: Pt[] = [];
  const steps = 14;
  for (const [a, b] of [
    [q0, q1],
    [q1, q2],
    [q2, q3],
    [q3, q0],
  ] as [Pt, Pt][]) {
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      const dx = center[0] - x;
      const dy = center[1] - y;
      const len = Math.hypot(dx, dy) || 1;
      const inset = min + rnd() * (max - min);
      ring.push([x + (dx / len) * inset, y + (dy / len) * inset]);
    }
  }
  return ring;
}

/**
 * Fondo del lotto alla quota del terreno: una fascia di raccordo, a metà tra il
 * colore del lotto e quello dello stabilimento, sotto un fondo dal bordo
 * irregolare. Niente piastra rialzata: lo spessore è zero, sta sopra il terreno
 * solo per l'ordine di disegno (polygonOffset), non per la quota.
 */
function lotGround(frame: LotFrame, look: LotLook): THREE.Group {
  const g = new THREE.Group();
  const blend = c(GROUND[look]).lerp(c(PALETTE.stabilimento), 0.55);
  const outer = new Builder();
  outer.flat(raggedRing(frame, 0, 18, `${look}:esterno`), TERRAIN_Y, blend);
  const inner = new Builder();
  inner.flat(raggedRing(frame, 22, 55, `${look}:interno`), TERRAIN_Y, c(GROUND[look]));
  const outerMesh = meshOf(outer, vertexMaterial({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  const innerMesh = meshOf(inner, vertexMaterial({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  outerMesh.name = 'fondo-lotto';
  innerMesh.name = 'fondo-lotto';
  g.add(outerMesh, innerMesh);
  return g;
}

function buildFermo(frame: LotFrame, buildings: GeoBuilding[], rnd: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(lotGround(frame, 'fermo'));
  // Gli edifici veri del reparto, spenti e arrugginiti.
  const b = new Builder();
  for (const building of buildings) {
    const h = buildingHeight(building) * VERTICAL;
    const { wall, roof } = buildingColors(building, true);
    b.walls(building.p, 0, h, c(wall));
    b.flat(building.p, h, c(roof));
  }
  if (buildings.length > 0) g.add(meshOf(b, vertexMaterial(), { cast: true }));
  // Torri e camini spenti.
  for (let i = 0; i < 3; i++) place(g, cylinder(14, 18, 70 + rnd() * 30, '#6f5b4b'), frame, 0.3 + i * 0.2, 0.45 + rnd() * 0.1);
  for (let i = 0; i < 2; i++) place(g, cylinder(4, 6, 120, '#7c6b5f'), frame, 0.2 + i * 0.55, 0.75);
  // Nastri trasportatori fermi e cumuli di minerale lasciati lì.
  place(g, box(frame.width * 0.6, 6, 6, '#8a7564'), frame, 0.5, 0.2);
  for (let i = 0; i < 8; i++) {
    const heap = new THREE.Mesh(new THREE.ConeGeometry(26 + rnd() * 16, 18 + rnd() * 10, 12), mat(i % 2 === 0 ? '#8c4a2f' : '#6e3b28'));
    heap.position.y = 11;
    heap.castShadow = true;
    place(g, heap, frame, 0.1 + rnd() * 0.8, 0.08 + rnd() * 0.3);
  }
  return g;
}

function buildLavori(frame: LotFrame, rnd: () => number, animated: Animated[]): THREE.Group {
  const g = new THREE.Group();
  g.add(lotGround(frame, 'lavori'));
  // Recinzione arancione lungo i quattro lati.
  const sides: [number, number, number, number][] = [
    [0, 0, 1, 0],
    [1, 0, 1, 1],
    [1, 1, 0, 1],
    [0, 1, 0, 0],
  ];
  for (const [u1, v1, u2, v2] of sides) {
    const a = at(frame, u1, v1);
    const b2 = at(frame, u2, v2);
    const len = a.distanceTo(b2);
    const fence = box(len, 7, 2, '#e07b39');
    fence.position.set((a.x + b2.x) / 2, 3.5, (a.z + b2.z) / 2);
    fence.rotation.y = -Math.atan2(b2.z - a.z, b2.x - a.x);
    g.add(fence);
  }
  // Gru a torre con il braccio che gira piano.
  for (let i = 0; i < 3; i++) {
    const crane = new THREE.Group();
    crane.add(box(7, 110, 7, '#f2b632'));
    const jib = new THREE.Group();
    const arm = box(120, 5, 5, '#f2b632');
    arm.position.set(35, 0, 0);
    jib.add(arm);
    const weight = box(14, 10, 10, '#55524b');
    weight.position.set(-22, -5, 0);
    jib.add(weight);
    jib.position.y = 108;
    crane.add(jib);
    place(g, crane, frame, 0.25 + i * 0.25, 0.3 + rnd() * 0.4);
    const speed = 0.08 + rnd() * 0.08;
    const phase = rnd() * Math.PI * 2;
    animated.push({ update: (t) => (jib.rotation.y = phase + t * speed) });
  }
  // Mucchi di terra e strutture a metà.
  for (let i = 0; i < 7; i++) {
    const heap = new THREE.Mesh(new THREE.ConeGeometry(18 + rnd() * 10, 14 + rnd() * 8, 10), mat('#b8935f'));
    heap.position.y = 9;
    heap.castShadow = true;
    place(g, heap, frame, 0.1 + rnd() * 0.8, 0.1 + rnd() * 0.8);
  }
  for (let i = 0; i < 3; i++) place(g, box(70, 18 + rnd() * 18, 40, '#d9d2c4'), frame, 0.2 + i * 0.3, 0.75);
  return g;
}

function buildAcciaio(frame: LotFrame, rnd: () => number, animated: Animated[]): THREE.Group {
  const g = new THREE.Group();
  g.add(lotGround(frame, 'acciaio'));
  // Capannoni nuovi in due file, con edifici di servizio e un parcheggio di camion.
  const shedLength = Math.min(320, frame.width * 0.34);
  for (let i = 0; i < 4; i++) {
    for (const u of [0.26, 0.62]) place(g, shed(shedLength, 30, 70, '#eef1f3', i % 2 === 0 ? '#4a7bb0' : '#5b8fc4'), frame, u, 0.16 + i * 0.21);
  }
  for (let i = 0; i < 4; i++) place(g, box(40, 14 + rnd() * 8, 30, '#f3efe6'), frame, 0.08, 0.2 + i * 0.18);
  for (let i = 0; i < 8; i++) place(g, box(14, 5, 5, i % 3 === 0 ? '#c4483a' : '#e9e6df'), frame, 0.9, 0.12 + i * 0.04);
  // Un solo camino, bianco e rosso, con poco fumo.
  const chimney = new THREE.Group();
  chimney.add(cylinder(5, 7, 110, '#f4f4f2'));
  const band = cylinder(5.3, 5.6, 12, '#c4483a');
  band.position.y = 96;
  chimney.add(band);
  place(g, chimney, frame, 0.85, 0.5);
  const top = at(frame, 0.85, 0.5);
  const puffMat = new THREE.MeshLambertMaterial({ color: '#f6f6f4', transparent: true, opacity: 0.45, depthWrite: false });
  for (let i = 0; i < 5; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), puffMat);
    g.add(puff);
    const phase = i / 5;
    const drift = rnd() * 0.6;
    animated.push({
      update: (t) => {
        const k = (t * 0.12 + phase) % 1;
        puff.position.set(top.x + k * 30 + drift * 10, 112 + k * 60, top.z - k * 12);
        puff.scale.setScalar(0.6 + k * 1.6);
      },
    });
  }
  return g;
}

/** Alberi con InstancedMesh: chioma a cono e tronco, colori leggermente diversi. */
function trees(positions: THREE.Vector3[], rnd: () => number, size = 1): THREE.Group {
  const g = new THREE.Group();
  const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(8 * size, 22 * size, 8), new THREE.MeshLambertMaterial(), positions.length);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.4 * size, 1.8 * size, 6 * size, 6), mat('#7a5a3c'), positions.length);
  const m = new THREE.Matrix4();
  const greens = ['#4f8f45', '#5f9e4c', '#6aa955', '#4a8540', '#77b25c'];
  positions.forEach((p, i) => {
    const s = 0.6 + rnd() * 0.7;
    m.compose(new THREE.Vector3(p.x, 6 * size + 11 * size * s, p.z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    crown.setMatrixAt(i, m);
    crown.setColorAt(i, color.set(pick(greens, rnd())));
    m.compose(new THREE.Vector3(p.x, 3 * size, p.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    trunk.setMatrixAt(i, m);
  });
  crown.castShadow = true;
  crown.receiveShadow = true;
  g.add(crown, trunk);
  return g;
}

function buildBosco(frame: LotFrame, rnd: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(lotGround(frame, 'bosco'));
  const positions: THREE.Vector3[] = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // Un sentiero in diagonale resta libero.
      if (Math.abs(i - j) < 1) continue;
      positions.push(at(frame, (i + 0.2 + rnd() * 0.6) / n, (j + 0.2 + rnd() * 0.6) / n));
    }
  }
  g.add(trees(positions, rnd, 0.9));
  return g;
}

function buildEnergia(frame: LotFrame, rnd: () => number, animated: Animated[]): THREE.Group {
  const g = new THREE.Group();
  g.add(lotGround(frame, 'energia'));
  // Pale eoliche nella metà lontana.
  const blade = new THREE.BoxGeometry(3, 52, 1);
  blade.translate(0, 26, 0);
  for (let i = 0; i < 6; i++) {
    const turbine = new THREE.Group();
    turbine.add(cylinder(1.8, 3.2, 100, '#f7f7f5', 10));
    const nacelle = box(12, 6, 6, '#f1f1ee');
    nacelle.position.set(2, 101, 0);
    turbine.add(nacelle);
    const rotor = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Mesh(blade, mat('#fbfbf9'));
      b.rotation.z = (k * Math.PI * 2) / 3;
      b.castShadow = true;
      rotor.add(b);
    }
    rotor.position.set(-5, 102, 0);
    rotor.rotation.y = Math.PI / 2;
    turbine.add(rotor);
    place(g, turbine, frame, 0.15 + (i % 3) * 0.35, 0.62 + Math.floor(i / 3) * 0.25, Math.PI / 2);
    const speed = 0.9 + rnd() * 0.3;
    const phase = rnd() * Math.PI;
    animated.push({ update: (t) => (rotor.rotation.x = phase + t * speed) });
  }
  // Pannelli solari in file nella metà vicina.
  const rows = 9;
  const cols = 7;
  const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(frame.width / (cols + 2), 1, 14), mat('#2f4f7f'), rows * cols);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.45, frame.angle, 0, 'YXZ'));
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const p = at(frame, (col + 1) / (cols + 1), 0.06 + (r / rows) * 0.42);
      m.compose(new THREE.Vector3(p.x, 6, p.z), q, new THREE.Vector3(1, 1, 1));
      panels.setMatrixAt(k++, m);
    }
  }
  panels.castShadow = true;
  g.add(panels);
  return g;
}

/**
 * Lati del lotto che danno sull'acqua vera (mare, canale): un lato conta se la
 * maggior parte dei punti appena fuori dal lato cade in un'acqua di OpenStreetMap.
 * Restituisce gli indici dei lati: 0 = q0→q1, 1 = q1→q2, 2 = q2→q3, 3 = q3→q0.
 */
export function waterSides(quad: Pt[]): number[] {
  const sides: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = quad[i]!;
    const b = quad[(i + 1) % 4]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    // Anello antiorario: la normale esterna è (dy, −dx).
    const nx = (b[1] - a[1]) / len;
    const ny = -(b[0] - a[0]) / len;
    let wet = 0;
    const samples = 7;
    for (let k = 1; k <= samples; k++) {
      const t = k / (samples + 1);
      const point: Pt = [a[0] + (b[0] - a[0]) * t + nx * 12, a[1] + (b[1] - a[1]) * t + ny * 12];
      if (geo.acqua.some((ring) => pointInPolygon(point, ring))) wet += 1;
    }
    if (wet >= Math.ceil(samples / 2)) sides.push(i);
  }
  return sides;
}

/** Coordinate relative (u, v) dei due estremi di ogni lato del lotto. */
const SIDE_UV: [number, number, number, number][] = [
  [0, 0, 1, 0],
  [1, 0, 1, 1],
  [1, 1, 0, 1],
  [0, 1, 0, 0],
];

function buildMare(frame: LotFrame, rnd: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(lotGround(frame, 'mare'));
  // Nessuna acqua finta: se il lotto tocca il mare vero, banchine aperte su quel lato.
  const wet = waterSides(frame.quad);
  for (const side of wet) {
    const [u1, v1, u2, v2] = SIDE_UV[side]!;
    const a = at(frame, u1, v1);
    const b = at(frame, u2, v2);
    const len = a.distanceTo(b);
    const angle = -Math.atan2(b.z - a.z, b.x - a.x);
    const quay = box(len * 0.92, 4, 26, '#d8d0c0');
    quay.position.set((a.x + b.x) / 2, 2, (a.z + b.z) / 2);
    quay.rotation.y = angle;
    g.add(quay);
    // Bitte lungo la banchina e qualche barca ormeggiata appena fuori, sul mare vero.
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      const bollard = cylinder(1.5, 1.8, 3, '#55524b', 8);
      bollard.position.set(a.x + (b.x - a.x) * t, 4, a.z + (b.z - a.z) * t);
      g.add(bollard);
    }
    const outward = new THREE.Vector3(b.z - a.z, 0, -(b.x - a.x)).normalize();
    // La normale esterna nel mondo dipende dal verso del lato: si sceglie quella che si allontana dal centro.
    const center = at(frame, 0.5, 0.5);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    if (outward.dot(mid.clone().sub(center)) < 0) outward.negate();
    for (let i = 0; i < 5; i++) {
      const t = 0.15 + i * 0.17;
      const boat = box(18, 4, 6, '#ffffff');
      boat.position.set(a.x + (b.x - a.x) * t + outward.x * 40, 1.2, a.z + (b.z - a.z) * t + outward.z * 40);
      boat.rotation.y = angle;
      g.add(boat);
    }
  }
  // Una piazza chiara al centro, edifici pubblici colorati intorno, alberi lungo i viali.
  const square = new Builder();
  const corners: Pt[] = [
    [0.35, 0.35],
    [0.65, 0.35],
    [0.65, 0.65],
    [0.35, 0.65],
  ].map(([u, v]) => {
    const p = at(frame, u!, v!);
    return [p.x, -p.z] as Pt;
  });
  square.flat(corners, TERRAIN_Y, c('#f3ead6'));
  const squareMesh = meshOf(square, vertexMaterial({ polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  squareMesh.name = 'fondo-lotto';
  g.add(squareMesh);
  const colors = ['#d0704e', '#e3b04b', '#3e9c9c', '#f1e3c3', '#b5523b', '#7f9fc4'];
  const spots: [number, number][] = [
    [0.22, 0.25],
    [0.5, 0.2],
    [0.78, 0.25],
    [0.8, 0.72],
    [0.5, 0.8],
    [0.2, 0.72],
  ];
  spots.forEach(([u, v], i) => {
    const h = 18 + rnd() * 16;
    const building = new THREE.Group();
    building.add(box(60 + rnd() * 30, h, 40 + rnd() * 20, colors[i]!));
    const roof = box(64, 3, 46, '#f3eee4');
    roof.position.y = h + 1.5;
    building.add(roof);
    place(g, building, frame, u, v);
  });
  const positions: THREE.Vector3[] = [];
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    positions.push(at(frame, 0.3 + t * 0.4, 0.3), at(frame, 0.3 + t * 0.4, 0.7), at(frame, 0.3, 0.3 + t * 0.4), at(frame, 0.7, 0.3 + t * 0.4));
  }
  for (let i = 0; i < 30; i++) positions.push(at(frame, 0.08 + rnd() * 0.84, 0.08 + rnd() * 0.84));
  g.add(trees(positions, rnd, 0.7));
  return g;
}

/** Costruisce un aspetto di un lotto fuori dalla scena: lo usano la scena e i test. */
export function buildLotLook(id: string, quad: Pt[], look: LotLook, buildings: GeoBuilding[] = []): { group: THREE.Group; animated: Animated[] } {
  const frame = lotFrame(quad);
  const rnd = rngFor(`${id}:${look}`);
  const animated: Animated[] = [];
  const group =
    look === 'fermo'
      ? buildFermo(frame, buildings, rnd)
      : look === 'lavori'
        ? buildLavori(frame, rnd, animated)
        : look === 'acciaio'
          ? buildAcciaio(frame, rnd, animated)
          : look === 'bosco'
            ? buildBosco(frame, rnd)
            : look === 'energia'
              ? buildEnergia(frame, rnd, animated)
              : buildMare(frame, rnd);
  group.name = `${id}:${look}`;
  return { group, animated };
}

// ---------- Scena ----------

/**
 * Forza dello strato. Gli edifici prendono quasi tutto il colore della legenda:
 * la forma resta leggibile perché pareti e tetti sono illuminati diversamente.
 * Il terreno del quartiere si copre quasi del tutto; fuori dai quartieri tutto si attenua.
 */
const LAYER_TINT = 0.9;
const LAYER_GROUND_OPACITY = 0.9;
const LAYER_FADE_OUTSIDE = 0.8;

export function createPlastico({ canvas, labels, onSelect }: PlasticoOptions): PlasticoApi {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Il plastico è quasi tutto fermo: la mappa d'ombra si ridisegna solo quando serve (vedi loop e setLots).
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  let frameCount = 0;

  const scene = new THREE.Scene();
  const sky = new THREE.Color('#d6e6ee');
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 9000, 20000);

  const W = geo.dimensioni.larghezza;
  const H = geo.dimensioni.altezza;

  // Luce di giorno sereno: cielo diffuso e sole basso da sud-est, ombre leggere.
  scene.add(new THREE.HemisphereLight('#e4f0ff', '#c9b796', 1.25));
  const sun = new THREE.DirectionalLight('#fff4df', 3.4);
  sun.position.set(2600, 4200, 2400);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const s = Math.max(W, H) / 2 + 200;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 100, far: 12000 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 2;
  sun.shadow.radius = 3;
  scene.add(sun);

  // Base del plastico: una lastra con i bordi più scuri, come un modellino su un tavolo.
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 120, 60, H + 120), mat('#9d8b70'));
  base.position.y = -30.5;
  base.receiveShadow = true;
  scene.add(base);

  const flat = new Builder();
  flat.flat([[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]], 0, c(PALETTE.terra));
  for (const r of geo.industria) flat.flat(r, 0.6, c(PALETTE.industria));
  for (const r of geo.stabilimento) flat.flat(r, 0.4, c(PALETTE.stabilimento));
  for (const v of geo.verde) flat.flat(v.p, 1.2, c(PALETTE.verde[v.k as keyof typeof PALETTE.verde] ?? PALETTE.verde.prato));
  scene.add(meshOf(flat, vertexMaterial()));

  const water = new Builder();
  for (const r of geo.acqua) water.flat(r, 0.9, c(PALETTE.mare));
  scene.add(meshOf(water, vertexMaterial({ emissive: new THREE.Color('#1d4f6b'), emissiveIntensity: 0.15 })));

  const lines = new Builder();
  const widths = [0, 22, 16, 11, 7];
  for (const road of [...geo.strade].sort((a, b) => b.c - a.c)) lines.ribbon(road.l, widths[road.c]!, 1.6 + (4 - road.c) * 0.15, c(PALETTE.strade[road.c]!));
  for (const rail of geo.ferrovie) lines.ribbon(rail, 3.5, 1.5, c(PALETTE.ferrovie));
  scene.add(meshOf(lines, vertexMaterial()));

  const piers = new Builder();
  for (const r of geo.moli) {
    piers.walls(r, 0, 4, c('#b3ab9c'));
    piers.flat(r, 4, c(PALETTE.moli));
  }
  scene.add(meshOf(piers, vertexMaterial(), { cast: true }));

  // Edifici della città, tutti in una geometria; quelli dentro i lotti vanno ai lotti.
  const DISTRICT_TAG = new Map<DistrictId, number>(DISTRICTS_ON_MODEL.map((id, i) => [id, i + 1]));
  const city = new Builder();
  const byLot: Record<string, GeoBuilding[]> = {};
  for (const b of geo.edifici) {
    const lot = lotOf(b);
    if (lot !== undefined) {
      (byLot[lot] ??= []).push(b);
      continue;
    }
    const h = buildingHeight(b) * VERTICAL;
    const district = districtAt(centroid(b.p));
    const tag = district === undefined ? 0 : DISTRICT_TAG.get(district)!;
    const inPlant = district === 'area-industriale';
    const { wall, roof } = buildingColors(b, inPlant && b.k !== 'casa' && hash01(b.id, 3) < 0.5);
    city.walls(b.p, 0, h, c(wall), tag);
    city.flat(b.p, h, c(roof), tag);
  }
  const cityGeometry = city.build();
  const cityMesh = new THREE.Mesh(cityGeometry, vertexMaterial());
  cityMesh.castShadow = true;
  cityMesh.receiveShadow = true;
  scene.add(cityMesh);
  const baseColors = Float32Array.from(cityGeometry.getAttribute('color').array as Float32Array);
  const tags = Uint8Array.from(city.tag);

  // Lotti: un gruppo per lotto, con gli aspetti costruiti alla prima richiesta.
  const animated: Record<string, Animated[]> = {};
  const lotGroups: Record<string, { root: THREE.Group; looks: Partial<Record<LotLook, THREE.Group>>; current: LotLook | null; frame: LotFrame }> = {};
  for (const [id, quad] of Object.entries(geo.lotti)) {
    const root = new THREE.Group();
    root.name = id;
    scene.add(root);
    lotGroups[id] = { root, looks: {}, current: null, frame: lotFrame(quad) };
  }
  const buildLook = (id: string, look: LotLook): THREE.Group => {
    const { group, animated: list } = buildLotLook(id, lotGroups[id]!.frame.quad, look, byLot[id] ?? []);
    animated[`${id}:${look}`] = list;
    return group;
  };

  // Superfici invisibili per il tocco: prima i lotti, poi i quartieri.
  const pickMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide });
  const lotHits: THREE.Mesh[] = [];
  for (const [id, quad] of Object.entries(geo.lotti)) {
    const b = new Builder();
    b.flat(quad, 25, c('#000'));
    const m = new THREE.Mesh(b.build(), pickMaterial);
    m.userData = { kind: 'lot', id };
    lotHits.push(m);
    scene.add(m);
  }
  const districtHits: THREE.Mesh[] = [];
  const overlays: Partial<Record<DistrictId, THREE.Mesh>> = {};
  for (const id of DISTRICTS_ON_MODEL) {
    const outline = districtOutline(id);
    if (outline === undefined) continue;
    const b = new Builder();
    b.flat(outline, 3, c('#000'));
    const hit = new THREE.Mesh(b.build(), pickMaterial);
    hit.userData = { kind: 'district', id };
    districtHits.push(hit);
    scene.add(hit);
    const overlay = new THREE.Mesh(hit.geometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: LAYER_GROUND_OPACITY, depthWrite: false, side: THREE.DoubleSide }));
    overlay.visible = false;
    overlay.renderOrder = 2;
    overlays[id] = overlay;
    scene.add(overlay);
  }

  // Evidenza della selezione: un nastro blu lungo il contorno, sopra il terreno, che pulsa piano.
  const highlightMaterial = new THREE.MeshBasicMaterial({ color: '#1f6fd1', transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
  const veilMaterial = new THREE.MeshBasicMaterial({ color: '#1f6fd1', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  let highlight: THREE.Group | null = null;
  let selectedId: string | null = null;
  const outlineOf = (id: string): Pt[] | undefined => geo.lotti[id] ?? districtOutline(id as DistrictId);

  // Camera: dall'alto, da sud-est, sullo stabilimento e sui Tamburi.
  const camera = new THREE.PerspectiveCamera(32, 1, 150, 30000);
  const tamburi = centroid(geo.quartieri['tamburi']!);
  const parks = centroid(geo.lotti['lotto-parchi-minerali']!);
  const target = new THREE.Vector3((tamburi[0] + parks[0]) / 2, 0, -(tamburi[1] + parks[1]) / 2);
  camera.position.copy(target).add(new THREE.Vector3(1300, 4200, 4600));
  const controls = new MapControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 450;
  controls.maxDistance = 9000;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = 1.2;
  controls.zoomToCursor = true;
  controls.addEventListener('change', () => {
    // La camera non esce dal plastico.
    const before = controls.target.clone();
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -W / 2, W / 2);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -H / 2, H / 2);
    controls.target.y = 0;
    camera.position.add(controls.target.clone().sub(before));
  });
  controls.update();

  // Effetto modellino: sfocatura in alto e in basso, nitido al centro.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const hBlur = new ShaderPass(HorizontalTiltShiftShader);
  const vBlur = new ShaderPass(VerticalTiltShiftShader);
  hBlur.uniforms['r']!.value = 0.5;
  vBlur.uniforms['r']!.value = 0.5;
  composer.addPass(hBlur);
  composer.addPass(vBlur);
  composer.addPass(new OutputPass());

  function resize(): void {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const strength = 2.5;
    hBlur.uniforms['h']!.value = strength / w;
    vBlur.uniforms['v']!.value = strength / h;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  // Tocco: un tocco breve, senza trascinare, sceglie un lotto o un quartiere.
  const raycaster = new THREE.Raycaster();
  let down: { x: number; y: number; t: number } | null = null;
  const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY, t: performance.now() });
  const onUp = (e: PointerEvent) => {
    if (down === null) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 600;
    down = null;
    if (moved > 8 || !quick) return;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(lotHits, false)[0] ?? raycaster.intersectObjects(districtHits, false)[0];
    if (hit !== undefined) onSelect(hit.object.userData['kind'] as 'district' | 'lot', hit.object.userData['id'] as string);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);

  // Etichette dello strato.
  let layerLabels: { id: DistrictId; el: HTMLElement; point: THREE.Vector3 }[] = [];
  const project = (point: THREE.Vector3) => {
    const v = point.clone().project(camera);
    if (v.z > 1) return null;
    return { x: ((v.x + 1) / 2) * canvas.clientWidth, y: ((1 - v.y) / 2) * canvas.clientHeight };
  };

  // Animazione e misura delle immagini al secondo.
  const frameTimes: number[] = [];
  let raf = 0;
  const clock = new THREE.Clock();
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    controls.update();
    let moving = false;
    for (const [key, list] of Object.entries(animated)) {
      const [id, look] = key.split(':');
      if (lotGroups[id!]?.current !== look) continue;
      for (const a of list) a.update(t);
      moving = moving || list.length > 0;
    }
    // Con parti in movimento (pale, gru, fumo) le ombre si aggiornano ogni 12 immagini.
    frameCount += 1;
    if (moving && frameCount % 12 === 0) renderer.shadowMap.needsUpdate = true;
    for (const l of layerLabels) {
      const p = project(l.point);
      l.el.style.display = p === null ? 'none' : '';
      if (p !== null) l.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
    }
    if (highlight !== null) highlightMaterial.opacity = 0.7 + 0.3 * Math.sin(t * 3);
    composer.render();
    const now = performance.now();
    frameTimes.push(now);
    while (frameTimes.length > 0 && now - frameTimes[0]! > 2000) frameTimes.shift();
  };
  loop();

  const centerOf = (id: string): THREE.Vector3 | null => {
    const quad = geo.lotti[id];
    if (quad !== undefined) {
      const [x, y] = centroid(quad);
      return new THREE.Vector3(x, 20, -y);
    }
    const outline = districtOutline(id as DistrictId);
    if (outline === undefined) return null;
    const [x, y] = centroid(outline);
    return new THREE.Vector3(x, 20, -y);
  };

  return {
    setLots(looks) {
      for (const [id, look] of Object.entries(looks)) {
        const entry = lotGroups[id];
        if (entry === undefined || entry.current === look) continue;
        const group = (entry.looks[look] ??= buildLook(id, look));
        for (const other of LOT_LOOKS) if (entry.looks[other] !== undefined) entry.looks[other]!.visible = other === look;
        if (group.parent === null) entry.root.add(group);
        entry.current = look;
        renderer.shadowMap.needsUpdate = true;
      }
    },
    setLayer(layer) {
      const colors = cityGeometry.getAttribute('color') as THREE.BufferAttribute;
      const array = colors.array as Float32Array;
      const tint = DISTRICTS_ON_MODEL.map((id) => (layer === null ? null : new THREE.Color(layer.values[id].color)));
      for (let v = 0; v < tags.length; v++) {
        const t = tags[v]!;
        const k = v * 3;
        const target = t === 0 ? null : tint[t - 1];
        if (target === null || target === undefined) {
          // A strato acceso, ciò che sta fuori dai quartieri si attenua.
          const fade = layer === null ? 1 : LAYER_FADE_OUTSIDE;
          array[k] = baseColors[k]! * fade;
          array[k + 1] = baseColors[k + 1]! * fade;
          array[k + 2] = baseColors[k + 2]! * fade;
        } else {
          array[k] = baseColors[k]! * (1 - LAYER_TINT) + target.r * LAYER_TINT;
          array[k + 1] = baseColors[k + 1]! * (1 - LAYER_TINT) + target.g * LAYER_TINT;
          array[k + 2] = baseColors[k + 2]! * (1 - LAYER_TINT) + target.b * LAYER_TINT;
        }
      }
      colors.needsUpdate = true;
      for (const id of DISTRICTS_ON_MODEL) {
        const overlay = overlays[id];
        if (overlay === undefined) continue;
        overlay.visible = layer !== null;
        if (layer !== null) (overlay.material as THREE.MeshBasicMaterial).color.set(layer.values[id].color);
      }
      labels.replaceChildren();
      layerLabels = [];
      if (layer === null) return;
      for (const id of DISTRICTS_ON_MODEL) {
        const point = centerOf(id);
        if (point === null) continue;
        point.y = 60;
        const el = document.createElement('span');
        el.className = 'layer-label';
        el.dataset['testid'] = `etichetta-strato-${id}`;
        el.setAttribute('data-testid', `etichetta-strato-${id}`);
        el.textContent = `${layer.names[id] ?? id} ${Math.round(layer.values[id].value)}`;
        el.style.borderColor = layer.values[id].color;
        labels.appendChild(el);
        layerLabels.push({ id, el, point });
      }
    },
    screenPosition(id) {
      const point = centerOf(id);
      return point === null ? null : project(point);
    },
    focus(id, distance = 1500) {
      const point = centerOf(id);
      if (point === null) return;
      point.y = 0;
      const offset = camera.position.clone().sub(controls.target).setLength(distance);
      controls.target.copy(point);
      camera.position.copy(point).add(offset);
      controls.update();
    },
    setSelected(id) {
      if (highlight !== null) {
        scene.remove(highlight);
        highlight.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
        highlight = null;
      }
      selectedId = id;
      const outline = id === null ? undefined : outlineOf(id);
      if (outline === undefined) return;
      // Un nastro lungo il contorno e un velo leggero sulla superficie: si vede anche da vicino, quando il bordo esce dallo schermo.
      const border = new Builder();
      border.ribbon([...outline, outline[0]!], geo.lotti[id!] !== undefined ? 26 : 30, 8, c('#1f6fd1'));
      const veil = new Builder();
      veil.flat(outline, 6, c('#1f6fd1'));
      const borderMesh = new THREE.Mesh(border.build(), highlightMaterial);
      const veilMesh = new THREE.Mesh(veil.build(), veilMaterial);
      borderMesh.renderOrder = 6;
      veilMesh.renderOrder = 5;
      highlight = new THREE.Group();
      highlight.add(veilMesh, borderMesh);
      highlight.name = 'evidenza';
      scene.add(highlight);
    },
    selected() {
      return selectedId;
    },
    frameIn(id, area) {
      const point = centerOf(id);
      if (point === null) return;
      point.y = 0;
      const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const groundAt = (x: number, y: number): THREE.Vector3 | null => {
        const ndc = new THREE.Vector2((x / canvas.clientWidth) * 2 - 1, -(y / canvas.clientHeight) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        return raycaster.ray.intersectPlane(ground, new THREE.Vector3());
      };
      const wanted = { x: (area.left + area.right) / 2, y: (area.top + area.bottom) / 2 };
      // Prospettiva: tre passi bastano perché l'oggetto arrivi a pochi pixel dal punto voluto.
      for (let i = 0; i < 3; i++) {
        camera.updateMatrixWorld();
        const now = project(point);
        if (now === null) break;
        const from = groundAt(now.x, now.y);
        const to = groundAt(wanted.x, wanted.y);
        if (from === null || to === null) break;
        const shift = from.sub(to);
        shift.y = 0;
        controls.target.add(shift);
        camera.position.add(shift);
      }
      controls.update();
    },
    fps() {
      if (frameTimes.length < 2) return 0;
      return ((frameTimes.length - 1) * 1000) / (frameTimes.at(-1)! - frameTimes[0]!);
    },
    dispose() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      controls.dispose();
      composer.dispose();
      renderer.dispose();
      labels.replaceChildren();
    },
  };
}
