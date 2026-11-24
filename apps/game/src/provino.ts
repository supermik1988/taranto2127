/**
 * Provino di stile della città isometrica (T12, fase A). Pagina a parte, servita
 * solo in sviluppo (`provino.html`): il gioco pubblicato non la include.
 *
 *   ?vista=isolato | costa | parchi | tipi     &stato=fermo | bosco (solo parchi)
 *
 * Camera ortografica con angolo fisso: azimut 45°, elevazione 30° (vista dimetrica
 * 2:1, da gestionale di città). Scala reale, in pixel per metro.
 */
import * as THREE from 'three';
import { centroid, geo } from './plastico/data.js';
import { costruisciCitta, foglioTipi, type Area, type StatoParchi } from './iso/citta.js';
import { NOMI_TIPI } from './iso/tipi.js';

/** Angolo fisso della vista: azimut da sud-est verso nord-ovest, elevazione 30° (2:1). */
export const AZIMUT = (45 * Math.PI) / 180;
export const ELEVAZIONE = (30 * Math.PI) / 180;

const params = new URLSearchParams(location.search);
const vista = params.get('vista') ?? 'isolato';
const stato: StatoParchi = params.get('stato') === 'bosco' ? 'bosco' : 'fermo';

const parchi = centroid(geo.lotti['lotto-parchi-minerali']!);

/** Inquadrature del provino: centro (metri) e pixel per metro alla scala reale del gioco. */
const VISTE: Record<string, { centro: [number, number]; ppm: number; titolo: string }> = {
  isolato: { centro: [1330, -470], ppm: 4, titolo: 'Un isolato dei Tamburi' },
  costa: { centro: [2470, -330], ppm: 2.6, titolo: 'La costa del Mar Piccolo ai Tamburi' },
  parchi: { centro: parchi, ppm: 1.15, titolo: `Parchi minerali: ${stato === 'bosco' ? 'bonifica conclusa, bosco giovane' : 'fermi'}` },
  tipi: { centro: [85, -30], ppm: 5, titolo: 'I tipi di edificio' },
};
const v = VISTE[vista] ?? VISTE['isolato']!;

const canvas = document.getElementById('tela') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // punto di partenza della scheda T12
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#bcdcf2');

// Giornata di sole: cielo diffuso caldo e sole da sud-ovest, alto, con ombre nette ma morbide ai bordi.
scene.add(new THREE.HemisphereLight('#d4e9ff', '#b8a57c', 1.5));
const sole = new THREE.DirectionalLight('#fff3d9', 2.6);
sole.castShadow = true;
sole.shadow.mapSize.set(4096, 4096);
sole.shadow.bias = -0.0003;
sole.shadow.normalBias = 0.6;
scene.add(sole, sole.target);

const area: Area = { minX: -300, maxX: 3400, minY: -1800, maxY: 800 };
let etichette: { testo: string; punto: THREE.Vector3 }[] = [];
if (vista === 'tipi') {
  const foglio = foglioTipi();
  scene.add(foglio.gruppo);
  etichette = foglio.etichette.map((e) => ({ testo: NOMI_TIPI[e.tipo], punto: new THREE.Vector3(e.x, e.y, e.z) }));
} else {
  const { gruppo, conteggio, alberi } = costruisciCitta(area, stato);
  scene.add(gruppo);
  Object.assign(window, { provinoConteggio: conteggio, provinoAlberi: alberi });
}

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 20000);
const centro = new THREE.Vector3(v.centro[0], 0, -v.centro[1]);
const direzione = new THREE.Vector3(Math.cos(ELEVAZIONE) * Math.sin(AZIMUT), Math.sin(ELEVAZIONE), Math.cos(ELEVAZIONE) * Math.cos(AZIMUT));

function inquadra(): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  // Scala reale: la stessa quantità di metri per pixel a ogni larghezza di schermo.
  const halfW = w / 2 / v.ppm;
  const halfH = h / 2 / v.ppm;
  Object.assign(camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
  camera.position.copy(centro).addScaledVector(direzione, 4000);
  camera.lookAt(centro);
  camera.updateProjectionMatrix();
  // Ombre: la camera del sole copre ciò che si vede, con un margine.
  const raggio = Math.hypot(halfW, halfH / Math.sin(ELEVAZIONE)) * 1.15;
  sole.position.copy(centro).add(new THREE.Vector3(-0.55, 0.78, 0.32).normalize().multiplyScalar(2500));
  sole.target.position.copy(centro);
  Object.assign(sole.shadow.camera, { left: -raggio, right: raggio, top: raggio, bottom: -raggio, near: 100, far: 6000 });
  sole.shadow.camera.updateProjectionMatrix();
}

const titolo = document.createElement('div');
titolo.className = 'titolo';
titolo.textContent = v.titolo;
document.body.appendChild(titolo);
if (vista !== 'tipi') {
  const attr = document.createElement('div');
  attr.className = 'attribuzione';
  attr.textContent = '© OpenStreetMap contributors · ODbL';
  document.body.appendChild(attr);
}
const elementi = etichette.map((e) => {
  const el = document.createElement('div');
  el.className = 'etichetta';
  el.textContent = e.testo;
  document.body.appendChild(el);
  return { el, punto: e.punto };
});

function disegna(): void {
  inquadra();
  renderer.render(scene, camera);
  for (const { el, punto } of elementi) {
    const p = punto.clone().project(camera);
    el.style.left = `${((p.x + 1) / 2) * canvas.clientWidth}px`;
    el.style.top = `${((1 - p.y) / 2) * canvas.clientHeight}px`;
  }
}

disegna();
window.addEventListener('resize', disegna);
requestAnimationFrame(() => {
  disegna();
  const info = renderer.info.render;
  Object.assign(window, { provinoPronto: true, provinoInfo: { ordini: info.calls, triangoli: info.triangles } });
});
