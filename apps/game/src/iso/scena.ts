/**
 * La città isometrica nella pagina (T12, fase B): renderer, luce, ombre, vista,
 * tocco, strato, evidenza della selezione, livelli di dettaglio. Prende il posto
 * della scena del plastico con la stessa interfaccia (PlasticoApi), più rotazione,
 * ingrandimento, livelli e le sonde per la verifica nel browser.
 *
 * Niente sfocatura, niente lastra, niente bordi: la città continua oltre la zona
 * (suolo.ts) e la vista resta dentro la zona (vista.ts).
 */
import type { DistrictId } from '@taranto2127/sim';
import * as THREE from 'three';
import { DISTRICTS_ON_MODEL, centroid, districtOutline, geo, type Pt } from '../plastico/data.js';
import { LOT_LOOKS, type LayerValue, type LotLook } from '../plastico/looks.js';
import { costruisciCitta, type Citta } from './citta.js';
import { Geo3, colore } from './geo3.js';
import { MEZZA_X, MEZZA_Y } from './griglia.js';
import { IMPOSTAZIONI, Regolatore, type Livello, type Scelta } from './livelli.js';
import { costruisciAspetto, type Animato } from './lotti.js';
import { memoriaTexture } from './texture.js';
import { Vista, direzioneCamera, impronta } from './vista.js';

export interface PlasticoApi {
  /** Aspetto di ogni lotto, dallo stato di gioco. */
  setLots(looks: Record<string, LotLook>): void;
  /** Strato colorato: valori e nomi per quartiere, o null per spegnerlo. */
  setLayer(layer: { values: Record<DistrictId, LayerValue>; names: Record<string, string> } | null): void;
  /** Posizione sullo schermo (pixel nella tela) del centro di un lotto o di un quartiere. */
  screenPosition(id: string): { x: number; y: number } | null;
  /** Porta la camera su un lotto o su un quartiere (distanza in metri: più è grande, più si vede). */
  focus(id: string, distance?: number): void;
  /** Evidenzia il lotto o il quartiere aperto in una finestra (null: nessuno). */
  setSelected(id: string | null): void;
  selected(): string | null;
  /** Sposta la vista, senza cambiare ingrandimento né orientamento, perché il centro dell'oggetto cada al centro del rettangolo libero. */
  frameIn(id: string, area: { left: number; top: number; right: number; bottom: number }): void;
  /** Immagini al secondo negli ultimi due secondi. */
  fps(): number;
  dispose(): void;
}

export interface InfoDisegno {
  ordini: number;
  triangoli: number;
  memoriaTexture: number;
  livello: Livello;
  scelta: Scelta;
  ppm: number;
  orientamento: number;
}

export interface CittaApi extends PlasticoApi {
  ruota(verso: 1 | -1): void;
  ingrandisci(k: number): void;
  orientamento(): number;
  scegliLivello(scelta: Scelta): void;
  livello(): Livello;
  info(): InfoDisegno;
  /** Tempi delle ultime immagini, in millisecondi (al più 600). */
  tempi(): number[];
  /** Svuota il registro dei tempi: si misura da qui. */
  azzeraTempi(): void;
  /** Ridisegna e dice, per i quattro angoli dello schermo, se si vede la città (true) o lo sfondo (false). */
  angoli(): boolean[];
  /** Angolo della camera: elevazione e azimut in gradi, e se è ortografica. */
  camera(): { ortografica: boolean; elevazione: number; azimut: number };
  /** Imposta ingrandimento (pixel per metro) e orientamento, subito: per le prove. */
  imposta(ppm: number, orientamento?: number): void;
  /** Centra un punto della zona (metri, x verso est e y verso nord), subito: per le prove. */
  guarda(x: number, y: number, ppm: number): void;
}

export interface CittaOptions {
  canvas: HTMLCanvasElement;
  labels: HTMLElement;
  onSelect: (kind: 'district' | 'lot', id: string) => void;
  onFallback?: (motivo: string) => void;
  onLivello?: (livello: Livello, scelta: Scelta, motivo: string) => void;
  scelta?: Scelta;
}

/** Colore dello sfondo: non dovrebbe vedersi mai (la sonda degli angoli lo cerca). */
export const SFONDO = '#bcdcf2';

const LAYER_TINT = 1;
const LAYER_GROUND_OPACITY = 0.97;
const LAYER_FADE_OUTSIDE = 0.8;
const LAYER_VEIL_OPACITY = 0.42;
/** Sotto questo ingrandimento gli oggetti piccoli (cisterne, antenne, auto) sono meno di un pixel: si spengono. */
const PPM_DETTAGLI = 1.2;
/** Sotto questo ingrandimento cespugli e ulivi sono un pixel: si spengono, il colore del suolo basta. */
const PPM_RIEMPITIVO = 0.8;
/** Direzione del sole: da sud-ovest, alto (x verso est, z verso sud). */
const SOLE = new THREE.Vector3(-0.55, 0.78, 0.32).normalize();

const DETTAGLI = new Set(['cisterne', 'antenne', 'lucernari', 'auto', 'barche', 'scogli']);
const RIEMPITIVO = new Set(['cespugli', 'alberi-ulivo']);

export function createCitta({ canvas, labels, onSelect, onFallback, onLivello, scelta = 'auto' }: CittaOptions): CittaApi {
  // Stencil: il mare segna i suoi pixel, i fondi del terreno li saltano (suolo.ts).
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // La città è quasi ferma: la mappa d'ombra si ridisegna solo quando la vista cambia abbastanza.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  canvas.style.touchAction = 'none';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SFONDO);

  // Giornata di sole: cielo diffuso caldo e sole da sud-ovest, alto.
  scene.add(new THREE.HemisphereLight('#d4e9ff', '#b8a57c', 1.5));
  const sun = new THREE.DirectionalLight('#fff3d9', 2.6);
  sun.castShadow = true;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);

  const citta: Citta = costruisciCitta();
  scene.add(citta.gruppo);
  const cityMeshes: THREE.Mesh[] = [];
  citta.gruppo.traverse((o) => {
    if (o instanceof THREE.Mesh && o.userData['tags'] !== undefined) cityMeshes.push(o);
  });

  // ---------- Lotti ----------
  const animati: Record<string, Animato[]> = {};
  const lotGroups: Record<string, { root: THREE.Group; looks: Partial<Record<LotLook, THREE.Group>>; current: LotLook | null }> = {};
  for (const id of Object.keys(geo.lotti)) {
    const root = new THREE.Group();
    root.name = id;
    scene.add(root);
    lotGroups[id] = { root, looks: {}, current: null };
  }

  // ---------- Superfici per il tocco e strato ----------
  const pickMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide });
  const piano = (ring: Pt[], y: number) => {
    const b = new Geo3();
    b.flat(ring, y, colore('#000'));
    return b.build();
  };
  const lotHits: THREE.Mesh[] = [];
  for (const [id, quad] of Object.entries(geo.lotti)) {
    const m = new THREE.Mesh(piano(quad, 1), pickMaterial);
    m.userData = { kind: 'lot', id };
    lotHits.push(m);
    scene.add(m);
  }
  const districtHits: THREE.Mesh[] = [];
  const overlays: Partial<Record<DistrictId, THREE.Mesh>> = {};
  for (const id of DISTRICTS_ON_MODEL) {
    const outline = districtOutline(id);
    if (outline === undefined) continue;
    const geometry = piano(outline, 0.5);
    const hit = new THREE.Mesh(geometry, pickMaterial);
    hit.userData = { kind: 'district', id };
    districtHits.push(hit);
    scene.add(hit);
    // Velo dello strato: copre il terreno del quartiere e, mezzo trasparente, anche edifici e alberi (sopra a tutto).
    const overlay = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: LAYER_GROUND_OPACITY, depthWrite: false, side: THREE.DoubleSide }));
    const velo = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: LAYER_VEIL_OPACITY, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
    velo.visible = false;
    velo.renderOrder = 3;
    velo.name = `velo-${id}`;
    overlay.userData['velo'] = velo;
    scene.add(velo);
    overlay.visible = false;
    overlay.renderOrder = 2;
    overlay.name = `strato-${id}`;
    overlays[id] = overlay;
    scene.add(overlay);
  }

  // ---------- Evidenza della selezione ----------
  const highlightMaterial = new THREE.MeshBasicMaterial({ color: '#1f6fd1', transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
  const veilMaterial = new THREE.MeshBasicMaterial({ color: '#1f6fd1', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  let highlight: THREE.Group | null = null;
  let selectedId: string | null = null;
  const outlineOf = (id: string): Pt[] | undefined => geo.lotti[id] ?? districtOutline(id as DistrictId);
  const centerOf = (id: string): Pt | null => {
    const outline = outlineOf(id);
    return outline === undefined ? null : centroid(outline);
  };

  // ---------- Vista ----------
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 9000);
  const tamburi = centroid(geo.quartieri['tamburi']!);
  const parks = centroid(geo.lotti['lotto-parchi-minerali']!);
  const margine = 250;
  const vista = new Vista([(tamburi[0] + parks[0]) / 2, (tamburi[1] + parks[1]) / 2], 1.1, { minX: -MEZZA_X - margine, maxX: MEZZA_X + margine, minY: -MEZZA_Y - margine, maxY: MEZZA_Y + margine });

  // ---------- Livelli di dettaglio ----------
  const regolatore = new Regolatore(scelta);
  let impostazioni = IMPOSTAZIONI[regolatore.livello];
  let dettagliVisibili = true;
  let riempitivoVisibile = true;
  const applicaLivello = (livello: Livello) => {
    const prima = impostazioni;
    impostazioni = IMPOSTAZIONI[livello];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, impostazioni.pixel));
    resize();
    if (prima.ombre !== impostazioni.ombre || prima.mappaOmbre !== impostazioni.mappaOmbre || sun.shadow.map === null) {
      sun.castShadow = impostazioni.ombre;
      sun.shadow.mapSize.set(impostazioni.mappaOmbre, impostazioni.mappaOmbre);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (m !== undefined) for (const mm of Array.isArray(m) ? m : [m]) mm.needsUpdate = true;
      });
    }
    aggiornaVisibilita();
    shadowDirty = true;
  };
  const aggiornaVisibilita = () => {
    scene.traverse((o) => {
      if (DETTAGLI.has(o.name)) o.visible = impostazioni.dettagli && dettagliVisibili;
      else if (RIEMPITIVO.has(o.name)) o.visible = impostazioni.riempitivo && riempitivoVisibile;
      else if (o instanceof THREE.InstancedMesh && o.name.startsWith('alberi-')) {
        const soglie = o.userData['soglie'] as number[] | undefined;
        if (soglie !== undefined) o.count = impostazioni.alberiParchi ? soglie[2]! : soglie[0]!;
      }
    });
  };

  // ---------- Ombre adattate alla vista ----------
  let shadowDirty = true;
  let shadowAt: { x: number; y: number; ppm: number; az: number } | null = null;
  const fitShadow = () => {
    const o = vista.ora;
    const { lungoDestra, inAvanti } = impronta(o.ppm, vista.w, vista.h);
    const raggio = Math.min(9000, Math.hypot(lungoDestra, inAvanti) * 1.6);
    const ok =
      shadowAt !== null &&
      Math.hypot(o.centro[0] - shadowAt.x, o.centro[1] - shadowAt.y) < raggio * 0.25 &&
      Math.abs(Math.log(o.ppm / shadowAt.ppm)) < 0.2 &&
      Math.abs(o.azimut - shadowAt.az) < 0.01;
    if (ok && !shadowDirty) return;
    const c = new THREE.Vector3(o.centro[0], 0, -o.centro[1]);
    sun.position.copy(c).addScaledVector(SOLE, 4000);
    sun.target.position.copy(c);
    sun.target.updateMatrixWorld();
    Object.assign(sun.shadow.camera, { left: -raggio, right: raggio, top: raggio, bottom: -raggio, near: 100, far: 9000 });
    sun.shadow.camera.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
    shadowAt = { x: o.centro[0], y: o.centro[1], ppm: o.ppm, az: o.azimut };
    shadowDirty = false;
  };

  function resize(): void {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    vista.dimensioni(w, h);
    vista.applica(camera);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  applicaLivello(regolatore.livello);

  // ---------- Tocco, trascinamento, dita, rotella ----------
  const raycaster = new THREE.Raycaster();
  const pointers = new Map<number, { x: number; y: number }>();
  let down: { x: number; y: number; t: number; moved: number } | null = null;
  let pinch: { dist: number; mx: number; my: number } | null = null;
  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: PointerEvent) => {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 1) down = { ...local(e), t: performance.now(), moved: 0 };
    else down = null;
    pinch = null;
  };
  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (prev === undefined) return;
    const now = local(e);
    pointers.set(e.pointerId, now);
    if (pointers.size === 1) {
      vista.trascina(now.x - prev.x, now.y - prev.y);
      if (down !== null) down.moved += Math.hypot(now.x - prev.x, now.y - prev.y);
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if (pinch !== null && pinch.dist > 0) {
        vista.trascina(mx - pinch.mx, my - pinch.my);
        vista.ingrandisci(dist / pinch.dist, mx, my, true);
      }
      pinch = { dist, mx, my };
    }
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinch = null;
    if (down === null || pointers.size > 0) return;
    const tap = down.moved < 8 && performance.now() - down.t < 600;
    const at = local(e);
    down = null;
    if (!tap) return;
    const ndc = new THREE.Vector2((at.x / canvas.clientWidth) * 2 - 1, -(at.y / canvas.clientHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(lotHits, false)[0] ?? raycaster.intersectObjects(districtHits, false)[0];
    if (hit !== undefined) onSelect(hit.object.userData['kind'] as 'district' | 'lot', hit.object.userData['id'] as string);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const at = local(e);
    vista.ingrandisci(Math.exp(-e.deltaY * 0.0015), at.x, at.y, true);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  const onVisibility = () => regolatore.ricomincia();
  document.addEventListener('visibilitychange', onVisibility);

  // ---------- Etichette dello strato ----------
  let layerLabels: { el: HTMLElement; point: THREE.Vector3 }[] = [];
  const project = (point: THREE.Vector3) => {
    const v = point.clone().project(camera);
    return { x: ((v.x + 1) / 2) * canvas.clientWidth, y: ((1 - v.y) / 2) * canvas.clientHeight };
  };

  // ---------- Ciclo ----------
  const frameTimes: number[] = [];
  const intervals: number[] = [];
  let raf = 0;
  let last = performance.now();
  let tempo = 0;
  let frame = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    const ms = now - last;
    last = now;
    const dt = Math.min(0.1, ms / 1000);
    tempo += dt;
    frame += 1;
    vista.aggiorna(dt);
    vista.applica(camera);
    // Sotto un certo ingrandimento gli oggetti piccoli non si vedono: si spengono.
    const vis = vista.ora.ppm >= PPM_DETTAGLI;
    const riemp = vista.ora.ppm >= PPM_RIEMPITIVO;
    if (vis !== dettagliVisibili || riemp !== riempitivoVisibile) {
      dettagliVisibili = vis;
      riempitivoVisibile = riemp;
      aggiornaVisibilita();
    }
    let moving = false;
    for (const [key, list] of Object.entries(animati)) {
      const [id, look] = key.split(':');
      if (lotGroups[id!]?.current !== look) continue;
      for (const a of list) a.update(tempo);
      moving = moving || list.length > 0;
    }
    if (impostazioni.onde) citta.onde.offset.set((tempo * 0.012) % 1, (tempo * 0.007) % 1);
    if (impostazioni.ombre) {
      fitShadow();
      // Con parti in movimento (pale, gru, fumo) le ombre si aggiornano ogni 12 immagini.
      if (moving && frame % 12 === 0) renderer.shadowMap.needsUpdate = true;
    }
    for (const l of layerLabels) {
      const p = project(l.point);
      l.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
    }
    if (highlight !== null) highlightMaterial.opacity = 0.7 + 0.3 * Math.sin(tempo * 3);
    renderer.render(scene, camera);
    frameTimes.push(now);
    while (frameTimes.length > 0 && now - frameTimes[0]! > 2000) frameTimes.shift();
    if (frame > 1) {
      intervals.push(ms);
      if (intervals.length > 600) intervals.shift();
      const evento = regolatore.registra(ms);
      if (evento?.tipo === 'livello') {
        applicaLivello(evento.livello);
        onLivello?.(evento.livello, regolatore.sceltaOra, evento.motivo);
      } else if (evento?.tipo === 'riserva') onFallback?.(evento.motivo);
    }
  };
  raf = requestAnimationFrame(loop);

  const api: CittaApi = {
    setLots(looks) {
      for (const [id, look] of Object.entries(looks)) {
        const entry = lotGroups[id];
        if (entry === undefined || entry.current === look) continue;
        let group = entry.looks[look];
        if (group === undefined) {
          const aspetto = costruisciAspetto(id, geo.lotti[id]!, look);
          group = aspetto.gruppo;
          animati[`${id}:${look}`] = aspetto.animati;
          entry.looks[look] = group;
          entry.root.add(group);
        }
        for (const other of LOT_LOOKS) if (entry.looks[other] !== undefined) entry.looks[other]!.visible = other === look;
        entry.current = look;
      }
      aggiornaVisibilita();
      shadowDirty = true;
    },
    setLayer(layer) {
      const tint = DISTRICTS_ON_MODEL.map((id) => (layer === null ? null : new THREE.Color(layer.values[id].color)));
      for (const mesh of cityMeshes) {
        const tags = mesh.userData['tags'] as Uint8Array;
        const base = mesh.userData['base'] as Float32Array;
        // Pareti e tetti hanno il colore per vertice; gli alberi per istanza.
        const colors = (mesh.userData['istanze'] === true ? (mesh as THREE.InstancedMesh).instanceColor : mesh.geometry.getAttribute('color')) as THREE.BufferAttribute;
        const array = colors.array as Float32Array;
        for (let v = 0; v < tags.length; v++) {
          const t = tags[v]!;
          const k = v * 3;
          const target = t === 0 ? null : tint[t - 1];
          if (target === null || target === undefined) {
            const fade = layer === null ? 1 : LAYER_FADE_OUTSIDE;
            array[k] = base[k]! * fade;
            array[k + 1] = base[k + 1]! * fade;
            array[k + 2] = base[k + 2]! * fade;
          } else {
            array[k] = base[k]! * (1 - LAYER_TINT) + target.r * LAYER_TINT;
            array[k + 1] = base[k + 1]! * (1 - LAYER_TINT) + target.g * LAYER_TINT;
            array[k + 2] = base[k + 2]! * (1 - LAYER_TINT) + target.b * LAYER_TINT;
          }
        }
        colors.needsUpdate = true;
      }
      for (const id of DISTRICTS_ON_MODEL) {
        const overlay = overlays[id];
        if (overlay === undefined) continue;
        overlay.visible = layer !== null;
        const velo = overlay.userData['velo'] as THREE.Mesh;
        velo.visible = layer !== null;
        if (layer !== null) {
          (overlay.material as THREE.MeshBasicMaterial).color.set(layer.values[id].color);
          (velo.material as THREE.MeshBasicMaterial).color.set(layer.values[id].color);
        }
      }
      labels.replaceChildren();
      layerLabels = [];
      if (layer === null) return;
      for (const id of DISTRICTS_ON_MODEL) {
        const c = centerOf(id);
        if (c === null) continue;
        const el = document.createElement('span');
        el.className = 'layer-label';
        el.setAttribute('data-testid', `etichetta-strato-${id}`);
        el.textContent = `${layer.names[id] ?? id} ${Math.round(layer.values[id].value)}`;
        el.style.borderColor = layer.values[id].color;
        labels.appendChild(el);
        layerLabels.push({ el, point: new THREE.Vector3(c[0], 30, -c[1]) });
      }
    },
    screenPosition(id) {
      const c = centerOf(id);
      if (c === null) return null;
      vista.applica(camera);
      return project(new THREE.Vector3(c[0], 0, -c[1]));
    },
    focus(id, distance = 1500) {
      const c = centerOf(id);
      if (c === null) return;
      // Dalla distanza della vecchia camera in prospettiva all'ingrandimento: 3000 m ≈ 1 pixel per metro.
      vista.centra(c, 3000 / distance);
      vista.applica(camera);
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
      const border = new Geo3();
      border.ribbon([...outline, outline[0]!], geo.lotti[id!] !== undefined ? 14 : 18, 0.6, colore('#1f6fd1'));
      const veil = new Geo3();
      veil.flat(outline, 0.55, colore('#1f6fd1'));
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
      const c = centerOf(id);
      if (c === null) return;
      vista.porta(c, (area.left + area.right) / 2, (area.top + area.bottom) / 2, true);
      vista.applica(camera);
    },
    fps() {
      if (frameTimes.length < 2) return 0;
      return ((frameTimes.length - 1) * 1000) / (frameTimes.at(-1)! - frameTimes[0]!);
    },
    ruota(verso) {
      vista.ruota(verso);
      shadowDirty = true;
    },
    ingrandisci(k) {
      vista.ingrandisci(k);
    },
    orientamento() {
      return vista.orientamento;
    },
    scegliLivello(s) {
      const livello = regolatore.scegli(s);
      applicaLivello(livello);
      onLivello?.(livello, s, s === 'auto' ? 'scelta automatica' : 'scelto a mano');
    },
    livello() {
      return regolatore.livello;
    },
    info() {
      renderer.render(scene, camera);
      return {
        ordini: renderer.info.render.calls,
        triangoli: renderer.info.render.triangles,
        memoriaTexture: memoriaTexture(),
        livello: regolatore.livello,
        scelta: regolatore.sceltaOra,
        ppm: vista.ora.ppm,
        orientamento: vista.orientamento,
      };
    },
    tempi() {
      return [...intervals];
    },
    azzeraTempi() {
      intervals.length = 0;
    },
    angoli() {
      vista.applica(camera);
      renderer.render(scene, camera);
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      // Lo sfondo in sRGB a 8 bit, come sta nel buffer (getHex dà sRGB; i componenti r, g, b sono lineari).
      const hex = new THREE.Color(SFONDO).getHex();
      const ref = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
      const px = new Uint8Array(4);
      return [
        [2, 2],
        [w - 3, 2],
        [2, h - 3],
        [w - 3, h - 3],
      ].map(([x, y]) => {
        gl.readPixels(x!, y!, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const diff = Math.abs(px[0]! - ref[0]!) + Math.abs(px[1]! - ref[1]!) + Math.abs(px[2]! - ref[2]!);
        return diff > 6;
      });
    },
    camera() {
      const d = direzioneCamera(vista.ora.azimut);
      return { ortografica: (camera as THREE.Camera) instanceof THREE.OrthographicCamera, elevazione: (Math.asin(d.y) * 180) / Math.PI, azimut: (((vista.ora.azimut * 180) / Math.PI) % 360 + 360) % 360 };
    },
    imposta(ppm, orientamento) {
      if (orientamento !== undefined) while (vista.orientamento !== orientamento) vista.ruota(1);
      vista.meta.ppm = ppm;
      vista.centra(vista.meta.centro, ppm);
      vista.ora.azimut = vista.meta.azimut;
      vista.applica(camera);
      shadowDirty = true;
    },
    guarda(x, y, ppm) {
      vista.centra([x, y], ppm);
      vista.applica(camera);
      shadowDirty = true;
    },
    dispose() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      document.removeEventListener('visibilitychange', onVisibility);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
      });
      renderer.dispose();
      labels.replaceChildren();
    },
  };
  return api;
}
