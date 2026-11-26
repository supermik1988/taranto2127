/**
 * Il suolo della città isometrica (T12): copertura del terreno, mare con le onde,
 * costa, moli con le barche, strade con marciapiedi e filari, binari, parcheggi.
 *
 * Niente terreno vuoto (correzione 1 della fase A): ogni punto della zona ha una
 * copertura. Dove OpenStreetMap la dice (parcheggi, piazze, spiagge, verde, usi
 * del suolo) si usa quella; altrove la si stima dal tipo di zona, a celle con un
 * caso fisso: piazzali, terra battuta ed erba nello stabilimento, cortili e
 * giardini nei quartieri, erba, campi e uliveti in campagna. Le stime sono
 * dichiarate in docs/GRAFICA.md.
 *
 * Ogni pezzo di terreno è anche una «pezza» (tipo, contorno, quota): la prova
 * sulla copertura legge le stesse pezze che si disegnano.
 */
import * as THREE from 'three';
import { centroid, districtOutline, geo, hash01, hashString, pick, pointInPolygon, polygonArea, type Pt } from '../plastico/data.js';
import { Alberi, ripetuti, unisci, type Importanza, type Specie } from './edifici.js';
import { Geo3, colore, meshDa, riquadro } from './geo3.js';
import { Griglia, MEZZA_X, MEZZA_Y, OCCUPATO, datiSuolo } from './griglia.js';
import { FONDO_SUOLO, SCALA_SUOLO, SUOLI, textureOnde, textureSuolo, type Suolo } from './texture.js';

/** Quota del pelo dell'acqua: più bassa della terra, così la riva ha uno spessore e il mare non sembra una piscina. */
export const LIVELLO_MARE = -0.9;
/** Quote del terreno a strati: abbastanza distanti da non tremolare con la camera ortografica. */
export const QUOTE = { base: 0, zona: 0.04, stima: 0.08, dati: 0.12, verde: 0.16, lotti: 0.2, marciapiede: 0.24, strada: 0.28, segni: 0.32 } as const;

export type Strato = keyof typeof QUOTE;

/** Un pezzo di terreno disegnato. */
export interface Pezza {
  tipo: Suolo;
  ring: Pt[];
  quota: number;
  /** Da dove viene: dai dati (OpenStreetMap) o stimata dal tipo di zona. */
  origine: 'dati' | 'stima';
}

/** Tavolozza del mare, delle strade e della costa (docs/GRAFICA.md). */
export const COLORI = {
  mare: '#1f66b0',
  mareChiuso: '#1d5f8e', // bacini e canali: più scuri del mare aperto
  /** Fascia chiara sotto costa (basso fondale), sfuma verso il mare in 40 m. */
  bassoFondale: '#46b3cf',
  schiuma: '#f2fbff',
  asfalto: '#4f5663',
  asfaltoSuperstrada: '#454b57',
  servizio: '#6a6660',
  marciapiede: '#e2d4ba',
  segnaletica: '#fbf8ee',
  rotaia: '#4a4038',
  banchina: '#d9cdb5',
  scogliera: '#958a7a',
  molo: '#e6dcc6',
} as const;

const LARGHEZZE = [0, 16, 13, 10, 7];

const SUOLO_DATI: Record<keyof typeof datiSuolo.aree, Suolo> = {
  parcheggi: 'parcheggio',
  residenziale: 'cortile',
  commerciale: 'lastricato',
  ferroviario: 'ghiaia',
  incolto: 'terra',
  porto: 'piazzale',
  servizi: 'cortile',
  spiaggia: 'sabbia',
  scogli: 'roccia',
  prato: 'erba',
  piazze: 'lastricato',
  sport: 'campo',
  cave: 'terra',
};

const SUOLO_VERDE: Record<string, Suolo> = { parco: 'erba', campo: 'campo', bosco: 'sottobosco', macchia: 'sottobosco', prato: 'erba', campi: 'campi', cimitero: 'erba' };

const sulBordo = ([x, y]: Pt) => Math.abs(Math.abs(x) - MEZZA_X) < 3 || Math.abs(Math.abs(y) - MEZZA_Y) < 3;

/**
 * Celle irregolari che coprono la zona: un reticolo di passo `lato` con i nodi
 * spostati di un terzo del passo (caso fisso). I nodi sono condivisi tra celle
 * vicine, così non restano buchi: sembrano appezzamenti, non una scacchiera.
 */
function* celleIrregolari(lato: number, seme: number): Generator<{ cella: Pt[]; i: number; j: number }> {
  const ni = Math.ceil((MEZZA_X * 2) / lato);
  const nj = Math.ceil((MEZZA_Y * 2) / lato);
  const nodo = (i: number, j: number): Pt => {
    const bordo = i === 0 || j === 0 || i === ni || j === nj;
    const dx = bordo ? 0 : (hash01(i, j, seme, 1) - 0.5) * lato * 0.6;
    const dy = bordo ? 0 : (hash01(i, j, seme, 2) - 0.5) * lato * 0.6;
    return [-MEZZA_X + i * lato + dx, -MEZZA_Y + j * lato + dy];
  };
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) yield { cella: [nodo(i, j), nodo(i + 1, j), nodo(i + 1, j + 1), nodo(i, j + 1)], i, j };
}

/**
 * Giardini dei quartieri: aiuole di forma libera (raggio 6-12 m) dove c'è spazio
 * tra le case e le strade, con uno-tre alberi. Stima: OpenStreetMap non ha i cortili.
 */
function giardini(quartiere: Pt[], griglia: Griglia, alberi: Alberi, disegna: (ring: Pt[]) => void): void {
  const { minX, minY, maxX, maxY } = riquadro(quartiere);
  const passo = 24;
  const pieno = OCCUPATO.edificio | OCCUPATO.strada | OCCUPATO.acqua | OCCUPATO.binari;
  for (let x = minX; x < maxX; x += passo) {
    for (let y = minY; y < maxY; y += passo) {
      const seed = Math.round(x * 3 + y * 7);
      if (hash01(seed, 311) > 0.7) continue;
      const cx = x + hash01(seed, 312) * passo * 0.6;
      const cy = y + hash01(seed, 313) * passo * 0.6;
      if (!pointInPolygon([cx, cy], quartiere)) continue;
      const raggio = 6 + hash01(seed, 314) * 6;
      // Serve spazio libero tutto intorno: si prova il centro e otto punti sul bordo.
      let ok = griglia.libero(cx, cy, pieno);
      for (let k = 0; k < 8 && ok; k++) ok = griglia.libero(cx + Math.cos((k * Math.PI) / 4) * raggio, cy + Math.sin((k * Math.PI) / 4) * raggio, pieno);
      if (!ok) continue;
      const ring: Pt[] = [];
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        const r = raggio * (0.75 + hash01(seed, 320 + k) * 0.35);
        ring.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      disegna(ring);
      const quanti = 1 + Math.floor(hash01(seed, 315) * 3);
      for (let k = 0; k < quanti; k++) {
        const a = hash01(seed, 330 + k) * Math.PI * 2;
        const d = hash01(seed, 340 + k) * raggio * 0.55;
        alberi.add(cx + Math.cos(a) * d, cy + Math.sin(a) * d, hash01(seed, 350 + k) < 0.4 ? 'pino' : 'latifoglia', seed + k, 0.9, 1);
      }
    }
  }
}

/** Numeri del suolo che le prove controllano (correzioni 3 e 4 della fase A). */
export interface NumeriSuolo {
  /** Strade secondarie (classe 4) dei quartieri con i marciapiedi. */
  secondarieConMarciapiedi: number;
  /** Alberi piantati lungo le strade secondarie. */
  alberiSecondarie: number;
  /** Tratti di riva per tipo. */
  rive: Record<Riva, number>;
  scogli: number;
  barche: number;
}

export interface RisultatoSuolo {
  oggetti: THREE.Object3D[];
  pezze: Pezza[];
  /** Texture delle onde, da far scorrere nel tempo. */
  onde: THREE.Texture;
  numeri: NumeriSuolo;
}

/**
 * Costruisce il suolo. La griglia deve già contenere edifici e lotti; qui si
 * aggiungono acqua e strade. Gli alberi e i cespugli vanno in `alberi`.
 */
export function costruisciSuolo(griglia: Griglia, alberi: Alberi): RisultatoSuolo {
  const oggetti: THREE.Object3D[] = [];
  const pezze: Pezza[] = [];
  // Ogni strato e ogni tipo di suolo ha la sua geometria: i fondi si disegnano prima di tutto,
  // in ordine di strato e senza scrivere la profondità; poi il mare li copre dove c'è acqua.
  const terreno = new Map<string, { strato: Strato; tipo: Suolo; g: Geo3 }>();
  const bianco = colore('#ffffff');
  const pezza = (tipo: Suolo, ring: Pt[], strato: Strato, origine: 'dati' | 'stima', tinta = bianco) => {
    const key = `${strato}:${tipo}`;
    let entry = terreno.get(key);
    if (entry === undefined) {
      entry = { strato, tipo, g: new Geo3() };
      terreno.set(key, entry);
    }
    entry.g.flat(ring, QUOTE[strato], tinta, SCALA_SUOLO);
    pezze.push({ tipo, ring, quota: QUOTE[strato], origine });
  };

  // Acqua e strade nella griglia, prima di piantare.
  for (const r of geo.acqua) griglia.poligono(r, OCCUPATO.acqua);
  for (const s of geo.strade) griglia.linea(s.l, LARGHEZZE[s.c]! + 4, OCCUPATO.strada);
  for (const s of datiSuolo.servizio) griglia.linea(s, 6, OCCUPATO.strada);
  for (const f of geo.ferrovie) griglia.linea(f, 5, OCCUPATO.binari);

  // 1. Fondo della zona: erba mediterranea con cespugli (una copertura, non il vuoto).
  const zona: Pt[] = [
    [-MEZZA_X, -MEZZA_Y],
    [MEZZA_X, -MEZZA_Y],
    [MEZZA_X, MEZZA_Y],
    [-MEZZA_X, MEZZA_Y],
  ];
  pezza('erba', zona, 'base', 'stima');

  // 2. Tipo di zona: piazzali nello stabilimento e nelle aree industriali, cortili nei quartieri.
  const quartieri = (['tamburi', 'citta-vecchia', 'borgo'] as const).map((id) => districtOutline(id)).filter((r): r is Pt[] => r !== undefined);
  for (const r of geo.stabilimento) pezza('piazzale', r, 'zona', 'stima');
  for (const r of geo.industria) pezza('piazzale', r, 'zona', 'stima');
  for (const r of quartieri) pezza('cortile', r, 'zona', 'stima');

  // 3. Stime, con un caso fisso: varietà dentro ogni tipo di zona.
  const inStabilimento = (p: Pt) => geo.stabilimento.some((r) => pointInPolygon(p, r)) || geo.industria.some((r) => pointInPolygon(p, r));
  const inQuartiere = (p: Pt) => quartieri.some((r) => pointInPolygon(p, r));
  const bagnato = (p: Pt) => (griglia.get(p[0], p[1]) & OCCUPATO.acqua) !== 0;
  // Stabilimento: lotti di terreno irregolari di circa 120 m, piazzale (già sotto), terra battuta o erba secca.
  for (const { cella, i, j } of celleIrregolari(120, 301)) {
    if (!cella.every(inStabilimento)) continue;
    const r = hash01(i, j, 302);
    if (r < 0.2) pezza('terra', cella, 'stima', 'stima', colore('#efe6d8'));
    else if (r < 0.42) {
      pezza('erba', cella, 'stima', 'stima', colore('#e8e2c8'));
      piantaCespugli(cella, alberi, griglia, 520, hashString(`s${i},${j}`));
    }
  }
  // Quartieri: giardini a forma libera negli spazi vuoti tra le case, con qualche albero.
  for (const r of quartieri) giardini(r, griglia, alberi, (ring) => pezza('erba', ring, 'stima', 'stima', colore('#f0f6dc')));
  // Campagna e periferia: appezzamenti irregolari di circa 150 m, erba, campi e uliveti in file.
  for (const { cella, i, j } of celleIrregolari(150, 303)) {
    const centro = centroid(cella);
    if (inStabilimento(centro) || inQuartiere(centro)) continue;
    if (cella.some(bagnato) || bagnato(centro)) {
      piantaCespugli(cella, alberi, griglia, 1800, hashString(`c${i},${j}`));
      continue;
    }
    const r = hash01(i, j, 304);
    if (r < 0.3) pezza('campi', cella, 'stima', 'stima', colore(pick(['#ffffff', '#f4ecd0', '#e9f0c8'], hash01(i, j, 305))));
    else if (r < 0.42) {
      pezza('erba', cella, 'stima', 'stima', colore('#f2e6c4'));
      // Uliveto: file regolari di alberi bassi, grigio-verdi.
      const { minX, minY, maxX, maxY } = riquadro(cella);
      for (let px = minX + 7; px < maxX; px += 14) {
        for (let py = minY + 7; py < maxY; py += 14) {
          if (!pointInPolygon([px, py], cella)) continue;
          if (griglia.libero(px, py, OCCUPATO.edificio | OCCUPATO.strada | OCCUPATO.acqua | OCCUPATO.binari, 3)) alberi.add(px, py, 'ulivo', Math.round(px * 7 + py * 13), 0.75, 2);
        }
      }
    } else piantaCespugli(cella, alberi, griglia, 1400, hashString(`c${i},${j}`));
  }

  // 4. Dati di OpenStreetMap: usi del suolo, parcheggi, piazze, spiagge.
  const auto: THREE.Matrix4[] = [];
  for (const [kind, rings] of Object.entries(datiSuolo.aree) as [keyof typeof datiSuolo.aree, Pt[][]][]) {
    for (const r of rings) {
      pezza(SUOLO_DATI[kind], r, 'dati', 'dati');
      if (kind === 'parcheggi') parcheggia(r, auto, griglia);
    }
  }
  for (const v of geo.verde) {
    const tipo = SUOLO_VERDE[v.k] ?? 'erba';
    pezza(tipo, v.p, 'verde', 'dati', v.k === 'cimitero' ? colore('#e4ecd6') : bianco);
    const seed = hashString(JSON.stringify(v.p[0]));
    if (v.k === 'parco') pianta(v.p, alberi, griglia, 13, 'latifoglia', seed, 1, 1);
    else if (v.k === 'bosco') pianta(v.p, alberi, griglia, 8, 'pino', seed, 1, 1);
    else if (v.k === 'macchia') pianta(v.p, alberi, griglia, 7, 'cespuglio', seed, 1.4, 2);
    else if (v.k === 'cimitero') pianta(v.p, alberi, griglia, 9, 'cipresso', seed, 1, 1);
  }

  const ordine = Object.keys(QUOTE) as Strato[];
  for (const { strato, tipo, g } of terreno.values()) {
    const m = meshDa(g, materialeSuolo(tipo), { nome: `suolo-${tipo}` });
    // Dall'alto verso il basso: lo strato più alto scrive la profondità per primo e quelli sotto non si calcolano.
    m.renderOrder = ORDINE_SUOLO - ordine.indexOf(strato) * 10 + SUOLI.indexOf(tipo) * 0.1;
    m.userData['strato'] = strato;
    oggetti.push(m);
  }
  oggetti.push(...ripetuti('auto', formaAuto(), '#ffffff', auto, false).map((m) => coloraAuto(m)));

  // 5. Oltre la zona: il terreno e il mare continuano in forma semplice, niente vuoto.
  oggetti.push(...oltreLaZona());

  // 6. Mare, costa e moli.
  const mare = costruisciMare();
  oggetti.push(...mare.oggetti);

  // 7. Strade, binari e filari.
  const strade = costruisciStrade(griglia, alberi, quartieri);
  oggetti.push(...strade.oggetti);
  return { oggetti, pezze, onde: mare.onde, numeri: { ...strade.numeri, ...mare.numeri } };
}

function piantaCespugli(cella: Pt[], alberi: Alberi, griglia: Griglia, areaPerCespuglio: number, seed: number): void {
  const { minX, minY, maxX, maxY } = riquadro(cella);
  const quanti = Math.round(((maxX - minX) * (maxY - minY)) / areaPerCespuglio);
  for (let k = 0; k < quanti; k++) {
    const x = minX + hash01(seed, k, 11) * (maxX - minX);
    const y = minY + hash01(seed, k, 12) * (maxY - minY);
    if (griglia.libero(x, y, OCCUPATO.edificio | OCCUPATO.strada | OCCUPATO.acqua | OCCUPATO.lotto | OCCUPATO.binari, 2)) alberi.add(x, y, 'cespuglio', seed + k * 7, 1, 2);
  }
}

function pianta(ring: Pt[], alberi: Alberi, griglia: Griglia, passo: number, specie: Specie, seed: number, scala: number, importanza: Importanza): void {
  const { minX, minY, maxX, maxY } = riquadro(ring);
  let k = 0;
  for (let x = minX + passo / 2; x < maxX; x += passo) {
    for (let y = minY + passo / 2; y < maxY; y += passo) {
      k += 1;
      const jx = x + (hash01(seed, k) - 0.5) * passo * 0.8;
      const jy = y + (hash01(seed, k + 7777) - 0.5) * passo * 0.8;
      if (!pointInPolygon([jx, jy], ring)) continue;
      if (!griglia.libero(jx, jy, OCCUPATO.edificio | OCCUPATO.strada | OCCUPATO.acqua | OCCUPATO.lotto, 2)) continue;
      alberi.add(jx, jy, specie, seed + k, scala, importanza);
    }
  }
}

// ---------- Parcheggi ----------

function formaAuto(): THREE.BufferGeometry {
  // Scocca bianca (prende il colore dell'istanza) e abitacolo scuro.
  return unisci([new THREE.BoxGeometry(4.2, 1.0, 1.8).translate(0, 0.65, 0), new THREE.BoxGeometry(2.2, 0.7, 1.6).translate(-0.2, 1.5, 0)], [colore('#ffffff'), colore('#3a4654')]);
}

function coloraAuto(mesh: THREE.InstancedMesh): THREE.InstancedMesh {
  (mesh.material as THREE.MeshLambertMaterial).vertexColors = true;
  const colori = ['#f4f4f2', '#c8ccd0', '#2f3338', '#b83a32', '#3c6aa8', '#e2c35a', '#7d8a92'];
  const c = new THREE.Color();
  for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, c.set(pick(colori, hash01(i, 401))));
  return mesh;
}

function parcheggia(ring: Pt[], auto: THREE.Matrix4[], griglia: Griglia): void {
  const { minX, minY, maxX, maxY } = riquadro(ring);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  // Stalli di 2,7 × 5 m, come nella texture; un'auto ogni due stalli.
  for (let x = minX + 1.5; x < maxX; x += 2.7) {
    for (let y = minY + 3; y < maxY; y += 6.5) {
      if (hash01(Math.round(x * 10), Math.round(y * 10), 402) > 0.5) continue;
      if (!pointInPolygon([x, y], ring) || !griglia.libero(x, y, OCCUPATO.edificio, 1)) continue;
      m.compose(new THREE.Vector3(x, QUOTE.dati, -y), q, new THREE.Vector3(1, 1, 1));
      auto.push(m.clone());
    }
  }
}

// ---------- Oltre la zona ----------

/**
 * Fasce lunghe 6 km fuori da ogni lato della zona: mare dove il bordo è acqua,
 * erba dove è terra. Così, comunque si guardi, oltre la zona non c'è il vuoto.
 */
function oltreLaZona(): THREE.Object3D[] {
  // 60 km: alla distanza massima, su un telefono lungo, la vista arriva a decine di chilometri dalla zona (T12e).
  const lontano = 60000;
  const terra = new Geo3();
  const acqua = new Geo3();
  const passo = 50;
  const bagnato = (p: Pt) => geo.acqua.some((r) => pointInPolygon(p, r));
  const lati: { da: Pt; a: Pt; fuori: Pt }[] = [
    { da: [-MEZZA_X, -MEZZA_Y], a: [MEZZA_X, -MEZZA_Y], fuori: [0, -1] },
    { da: [MEZZA_X, -MEZZA_Y], a: [MEZZA_X, MEZZA_Y], fuori: [1, 0] },
    { da: [MEZZA_X, MEZZA_Y], a: [-MEZZA_X, MEZZA_Y], fuori: [0, 1] },
    { da: [-MEZZA_X, MEZZA_Y], a: [-MEZZA_X, -MEZZA_Y], fuori: [-1, 0] },
  ];
  for (const { da, a, fuori } of lati) {
    const len = Math.hypot(a[0] - da[0], a[1] - da[1]);
    for (let t = 0; t < len; t += passo) {
      const t1 = Math.min(len, t + passo);
      const p0: Pt = [da[0] + ((a[0] - da[0]) * t) / len, da[1] + ((a[1] - da[1]) * t) / len];
      const p1: Pt = [da[0] + ((a[0] - da[0]) * t1) / len, da[1] + ((a[1] - da[1]) * t1) / len];
      const mezzo: Pt = [(p0[0] + p1[0]) / 2 - fuori[0] * 5, (p0[1] + p1[1]) / 2 - fuori[1] * 5];
      const ring: Pt[] = [p0, p1, [p1[0] + fuori[0] * lontano, p1[1] + fuori[1] * lontano], [p0[0] + fuori[0] * lontano, p0[1] + fuori[1] * lontano]];
      if (bagnato(mezzo)) acqua.flat(ring, LIVELLO_MARE, colore(COLORI.mare), 40);
      else terra.flat(ring, QUOTE.base, colore('#ffffff'), SCALA_SUOLO);
    }
  }
  // Angoli: terra.
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    const x0 = sx * MEZZA_X;
    const y0 = sy * MEZZA_Y;
    terra.flat([[x0, y0], [x0 + sx * lontano, y0], [x0 + sx * lontano, y0 + sy * lontano], [x0, y0 + sy * lontano]], QUOTE.base, colore('#ffffff'), SCALA_SUOLO);
  }
  const out: THREE.Object3D[] = [];
  const fuori = meshDa(terra, materialeSuolo('erba'), { nome: 'oltre-terra' });
  fuori.renderOrder = ORDINE_SUOLO + 5;
  out.push(fuori);
  if (!acqua.empty) {
    const mare = meshDa(acqua, materialeMare(), { nome: 'oltre-mare' });
    mare.renderOrder = ORDINE_MARE;
    out.push(mare);
  }
  return out;
}

// ---------- Ordine di disegno: prima il mare, poi i fondi ----------

/**
 * Il mare si disegna per primo e segna i suoi pixel nello stencil; i fondi del
 * terreno, disegnati dopo, saltano quei pixel. Così il mare può stare più in
 * basso della terra (la riva ha uno spessore) senza che il fondo d'erba lo copra.
 */
export const ORDINE_MARE = -300;
export const ORDINE_SUOLO = -200;
const STENCIL_MARE = 1;

function materialeSuolo(tipo: Suolo): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    vertexColors: true,
    map: textureSuolo(tipo),
    stencilWrite: true,
    stencilRef: STENCIL_MARE,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
  });
}

// ---------- Mare e costa ----------

let mareMateriale: THREE.MeshLambertMaterial | null = null;

/**
 * Mare: luce diffusa con la mappa delle onde (T12c). Niente riflesso speculare,
 * che dipende dalla direzione della vista: così il mare è uguale nei quattro
 * orientamenti. Le onde si vedono perché cambiano l'angolo con il sole e il cielo.
 * Resta fuori dalle fasce (userData.continuo): le onde sono sfumature.
 */
function materialeMare(): THREE.MeshLambertMaterial {
  if (mareMateriale !== null) return mareMateriale;
  const onde = textureOnde();
  onde.repeat.set(1, 1);
  mareMateriale = new THREE.MeshLambertMaterial({
    vertexColors: true,
    normalMap: onde,
    normalScale: new THREE.Vector2(1.6, 1.6),
    side: THREE.DoubleSide,
    stencilWrite: true,
    stencilRef: STENCIL_MARE,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp,
  });
  mareMateriale.name = 'mare';
  mareMateriale.userData['continuo'] = true;
  return mareMateriale;
}

export type Riva = 'spiaggia' | 'banchina' | 'scogli';

/** Che riva ha un tratto di costa: dai dati (spiagge, moli, aree portuali e industriali, città), altrimenti scogli. */
export function tipoRiva(p: Pt): Riva {
  const vicino = (rings: Pt[][], d: number) => rings.some((r) => pointInPolygon(p, r) || r.some(([x, y]) => Math.hypot(x - p[0], y - p[1]) < d));
  if (vicino(datiSuolo.aree.spiaggia, 40)) return 'spiaggia';
  const quartieri = (['tamburi', 'citta-vecchia', 'borgo'] as const).map((id) => districtOutline(id)).filter((r): r is Pt[] => r !== undefined);
  if (geo.stabilimento.some((r) => pointInPolygon(p, r)) || geo.industria.some((r) => pointInPolygon(p, r))) return 'banchina';
  if (quartieri.some((r) => pointInPolygon(p, r)) || datiSuolo.aree.porto.some((r) => pointInPolygon(p, r))) return 'banchina';
  if (vicino(geo.moli, 30)) return 'banchina';
  return 'scogli';
}

function costruisciMare(): { oggetti: THREE.Object3D[]; onde: THREE.Texture; numeri: Pick<NumeriSuolo, 'rive' | 'scogli' | 'barche'> } {
  const acqua = new Geo3();
  // Fascia chiara sotto costa: a parte, senza stencil, così dove sconfina sulla terra il suolo la copre.
  const fascia = new Geo3();
  const rive = new Geo3();
  const schiuma = new Geo3();
  const massi: THREE.Matrix4[] = [];
  const barche: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sopra = QUOTE.base + 0.05;
  const rivePerTipo: Record<Riva, number> = { spiaggia: 0, banchina: 0, scogli: 0 };

  for (const ring of geo.acqua) {
    const area = Math.abs(polygonArea(ring));
    // Alcuni anelli dei dati girano in senso orario: l'acqua sta allora a destra dei lati.
    const verso = polygonArea(ring) >= 0 ? 1 : -1;
    // I bacini chiusi sono più scuri del mare aperto.
    const fondo = colore(area > 1e6 ? COLORI.mare : COLORI.mareChiuso);
    acqua.flat(ring, LIVELLO_MARE, fondo, 40);
    const basso = colore(COLORI.bassoFondale);
    // Rive: un muro dal pelo dell'acqua alla terra, rivolto verso l'acqua, per ogni lato che non sta sul bordo della zona.
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      if (sulBordo(a) && sulBordo(b)) continue;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.5) continue;
      // Anello antiorario: l'acqua sta a sinistra, verso (−dy, dx); orario: a destra.
      const ix = (-(b[1] - a[1]) / len) * verso;
      const iy = ((b[0] - a[0]) / len) * verso;
      const mezzo: Pt = [(a[0] + b[0]) / 2 - ix * 6, (a[1] + b[1]) / 2 - iy * 6];
      const riva = tipoRiva(mezzo);
      rivePerTipo[riva] += 1;
      const A = (p: Pt, y: number, d = 0) => new THREE.Vector3(p[0] + ix * d, y, -(p[1] + iy * d));
      {
        // Basso fondale: chiaro a riva, sfuma nel colore del mare in 40 m.
        const y = LIVELLO_MARE + 0.02;
        const su = new THREE.Vector3(0, 1, 0);
        const pa = A(a, y);
        const pb = A(b, y);
        const qa = A(a, y, 40);
        const qb = A(b, y, 40);
        // Triangoli antiorari visti dall'alto: [a, b, b+40·i] con i verso l'acqua.
        const [p1, p2] = verso === 1 ? [pb, qb] : [qb, pb];
        const [c1, c2] = verso === 1 ? [basso, fondo] : [fondo, basso];
        fascia.v(pa.x, y, pa.z, su, basso, pa.x / 40, -pa.z / 40);
        fascia.v(p1.x, y, p1.z, su, c1, p1.x / 40, -p1.z / 40);
        fascia.v(p2.x, y, p2.z, su, c2, p2.x / 40, -p2.z / 40);
        const [r1, r2] = verso === 1 ? [qb, qa] : [qa, qb];
        fascia.v(pa.x, y, pa.z, su, basso, pa.x / 40, -pa.z / 40);
        fascia.v(r1.x, y, r1.z, su, fondo, r1.x / 40, -r1.z / 40);
        fascia.v(r2.x, y, r2.z, su, fondo, r2.x / 40, -r2.z / 40);
      }
      if (riva === 'spiaggia') {
        // Spiaggia: un piano inclinato di sabbia che entra in acqua.
        rive.quad(A(a, sopra), A(a, LIVELLO_MARE - 0.2, 9), A(b, LIVELLO_MARE - 0.2, 9), A(b, sopra), colore(FONDO_SUOLO.sabbia));
        schiuma.quad(A(a, LIVELLO_MARE + 0.03, 6), A(a, LIVELLO_MARE + 0.03, 9), A(b, LIVELLO_MARE + 0.03, 9), A(b, LIVELLO_MARE + 0.03, 6), colore(COLORI.schiuma));
      } else {
        rive.quad(A(a, sopra), A(b, sopra), A(b, LIVELLO_MARE - 0.4), A(a, LIVELLO_MARE - 0.4), colore(riva === 'banchina' ? COLORI.banchina : COLORI.scogliera));
        if (riva === 'scogli') {
          schiuma.quad(A(a, LIVELLO_MARE + 0.03, 0), A(a, LIVELLO_MARE + 0.03, 2.5), A(b, LIVELLO_MARE + 0.03, 2.5), A(b, LIVELLO_MARE + 0.03, 0), colore(COLORI.schiuma));
          for (let t = 2; t < len; t += 4.5) {
            const seed = Math.round((a[0] + t) * 13 + a[1] * 7);
            const s = 0.8 + hash01(seed, 501) * 1.4;
            const p: Pt = [a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len];
            q.setFromEuler(new THREE.Euler(hash01(seed, 502) * 3, hash01(seed, 503) * 3, 0));
            m.compose(A(p, LIVELLO_MARE + 0.2, 0.6 + hash01(seed, 504) * 1.4), q, new THREE.Vector3(s, s * 0.7, s));
            massi.push(m.clone());
          }
        } else if (area < 1e6 && len > 20) {
          // Bacini e canali: barche ormeggiate lungo le banchine.
          barcheLungo(a, b, len, ix, iy, barche, 0.45);
        }
      }
    }
  }

  // Moli: piattaforme di cemento sopra l'acqua, con le barche ormeggiate lungo i lati.
  const moli = new Geo3();
  for (const ring of geo.moli) {
    const r = ring; // anelli antiorari, come tutti quelli dei dati
    moli.flat(r, 1.0, colore(COLORI.molo), 8);
    moli.walls(r, LIVELLO_MARE - 0.4, 1.0, colore(COLORI.banchina));
    for (let i = 0; i < r.length; i++) {
      const a = r[i]!;
      const b = r[(i + 1) % r.length]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 25) continue;
      // Esterno dell'anello antiorario: (dy, −dx).
      const ox = (b[1] - a[1]) / len;
      const oy = -(b[0] - a[0]) / len;
      const fuori: Pt = [(a[0] + b[0]) / 2 + ox * 8, (a[1] + b[1]) / 2 + oy * 8];
      if (!geo.acqua.some((w) => pointInPolygon(fuori, w))) continue;
      barcheLungo(a, b, len, ox, oy, barche, 0.6);
    }
  }

  const oggetti: THREE.Object3D[] = [];
  const acquaMesh = meshDa(acqua, materialeMare(), { nome: 'mare' });
  acquaMesh.renderOrder = ORDINE_MARE;
  oggetti.push(acquaMesh);
  const fasciaMat = materialeMare().clone();
  Object.assign(fasciaMat, { stencilWrite: false, side: THREE.FrontSide });
  fasciaMat.userData['continuo'] = true;
  const fasciaMesh = meshDa(fascia, fasciaMat, { nome: 'basso-fondale' });
  fasciaMesh.renderOrder = ORDINE_MARE + 1;
  oggetti.push(fasciaMesh);
  oggetti.push(meshDa(rive, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { nome: 'rive' }));
  oggetti.push(meshDa(schiuma, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { nome: 'schiuma' }));
  oggetti.push(meshDa(moli, new THREE.MeshLambertMaterial({ vertexColors: true }), { nome: 'moli', proietta: true }));
  oggetti.push(...ripetuti('scogli', new THREE.OctahedronGeometry(1.2, 0), '#8a8377', massi, false));
  const barca = unisci(
    [new THREE.BoxGeometry(9, 1.2, 3).translate(0, 0.3, 0), new THREE.BoxGeometry(3, 1.4, 2.2).translate(-0.8, 1.4, 0), new THREE.BoxGeometry(0.2, 5, 0.2).translate(1.5, 3, 0)],
    [colore('#ffffff'), colore('#e9eef2'), colore('#6b6f73')],
  );
  const barcheMesh = ripetuti('barche', barca, '#ffffff', barche, true);
  for (const b of barcheMesh) {
    (b.material as THREE.MeshLambertMaterial).vertexColors = true;
    const c = new THREE.Color();
    for (let i = 0; i < b.count; i++) b.setColorAt(i, c.set(pick(['#ffffff', '#ffffff', '#2f5d8a', '#c4473a', '#f2f2ee', '#3f7a4b'], hash01(i, 511))));
  }
  oggetti.push(...barcheMesh);
  return { oggetti, onde: textureOnde(), numeri: { rive: rivePerTipo, scogli: massi.length, barche: barche.length } };
}

function barcheLungo(a: Pt, b: Pt, len: number, ox: number, oy: number, barche: THREE.Matrix4[], quota: number): void {
  const m = new THREE.Matrix4();
  const angolo = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angolo);
  for (let t = 8; t < len - 8; t += 13) {
    const seed = Math.round(a[0] * 3 + a[1] * 5 + t * 11);
    if (hash01(seed, 521) > quota) continue;
    const x = a[0] + ((b[0] - a[0]) * t) / len + ox * 4;
    const y = a[1] + ((b[1] - a[1]) * t) / len + oy * 4;
    const s = 0.7 + hash01(seed, 522) * 0.6;
    m.compose(new THREE.Vector3(x, LIVELLO_MARE, -y), q, new THREE.Vector3(s, s, s));
    barche.push(m.clone());
  }
}

// ---------- Strade ----------

function costruisciStrade(griglia: Griglia, alberi: Alberi, quartieri: Pt[][]): { oggetti: THREE.Object3D[]; numeri: Pick<NumeriSuolo, 'secondarieConMarciapiedi' | 'alberiSecondarie'> } {
  let secondarieConMarciapiedi = 0;
  let alberiSecondarie = 0;
  const marciapiedi = new Geo3();
  const asfalto = new Geo3();
  const segni = new Geo3();
  const binari = new Geo3();
  const rotaie = new Geo3();
  const inQuartiere = (p: Pt) => quartieri.some((r) => pointInPolygon(p, r));
  for (const s of geo.strade) {
    const w = LARGHEZZE[s.c]!;
    // Marciapiedi sulle strade principali e, nei quartieri, anche sulle secondarie.
    const urbana = s.c === 4 && inQuartiere(s.l[Math.floor(s.l.length / 2)]!);
    if (s.c >= 2 && (s.c <= 3 || urbana)) marciapiedi.ribbon(s.l, w + (s.c === 4 ? 4 : 5), QUOTE.marciapiede, colore(COLORI.marciapiede));
    if (urbana) secondarieConMarciapiedi += 1;
  }
  for (const s of datiSuolo.servizio) asfalto.ribbon(s, 5, QUOTE.strada - 0.02, colore(COLORI.servizio));
  for (const s of geo.strade) {
    const w = LARGHEZZE[s.c]!;
    asfalto.ribbon(s.l, w, QUOTE.strada, colore(s.c === 1 ? COLORI.asfaltoSuperstrada : COLORI.asfalto));
    if (s.c <= 3) tratteggio(s.l, segni, s.c === 1 ? 0.35 : 0.25);
    const mezzo = s.l[Math.floor(s.l.length / 2)]!;
    if (s.c === 2 || s.c === 3) viale(s.l, w / 2 + 3, alberi, griglia, s.c === 2 ? 12 : 15, 0.85, 0);
    // Filari anche sulle strade secondarie dei quartieri, su una strada su due (dove c'è spazio).
    else if (s.c === 4 && inQuartiere(mezzo) && hash01(Math.round(mezzo[0]), Math.round(mezzo[1]), 601) < 0.55) alberiSecondarie += viale(s.l, w / 2 + 2.8, alberi, griglia, 17, 0.7, 1);
  }
  for (const f of geo.ferrovie) {
    binari.ribbon(f, 4, QUOTE.dati + 0.02, colore('#ffffff'), 4);
    for (const off of [-0.75, 0.75]) rotaie.ribbon(spostata(f, off), 0.3, QUOTE.dati + 0.05, colore(COLORI.rotaia));
  }
  const oggetti = [
    meshDa(marciapiedi, new THREE.MeshLambertMaterial({ vertexColors: true }), { nome: 'marciapiedi' }),
    meshDa(asfalto, new THREE.MeshLambertMaterial({ vertexColors: true }), { nome: 'strade' }),
    meshDa(segni, new THREE.MeshLambertMaterial({ vertexColors: true }), { nome: 'segnaletica' }),
    meshDa(binari, new THREE.MeshLambertMaterial({ vertexColors: true, map: textureSuolo('ghiaia') }), { nome: 'massicciata' }),
    meshDa(rotaie, new THREE.MeshLambertMaterial({ vertexColors: true }), { nome: 'rotaie' }),
  ];
  return { oggetti, numeri: { secondarieConMarciapiedi, alberiSecondarie } };
}

/** Linea spostata di lato di `d` metri. */
function spostata(line: Pt[], d: number): Pt[] {
  return line.map((p, i) => {
    const a = line[Math.max(0, i - 1)]!;
    const b = line[Math.min(line.length - 1, i + 1)]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [p[0] - ((b[1] - a[1]) / len) * d, p[1] + ((b[0] - a[0]) / len) * d];
  });
}

function tratteggio(line: Pt[], out: Geo3, half: number): void {
  const bianco = colore(COLORI.segnaletica);
  let phase = 0;
  for (let i = 1; i < line.length; i++) {
    const [x1, y1] = line[i - 1]!;
    const [x2, y2] = line[i]!;
    const len = Math.hypot(x2 - x1, y2 - y1);
    for (let t = phase; t < len; t += 9) {
      const a = t / len;
      const b = Math.min(len, t + 4.5) / len;
      out.ribbon(
        [
          [x1 + (x2 - x1) * a, y1 + (y2 - y1) * a],
          [x1 + (x2 - x1) * b, y1 + (y2 - y1) * b],
        ],
        half * 2,
        QUOTE.segni,
        bianco,
      );
    }
    phase = (phase + 9 - (len % 9)) % 9;
  }
}

/** Filare lungo una strada, sui due lati, dove c'è spazio; restituisce quanti alberi ha piantato. */
function viale(line: Pt[], offset: number, alberi: Alberi, griglia: Griglia, passo: number, scala: number, importanza: Importanza): number {
  let n = 0;
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
        if (!griglia.libero(x, y, OCCUPATO.edificio | OCCUPATO.acqua | OCCUPATO.lotto | OCCUPATO.binari, 2.5) || !griglia.libero(x, y, OCCUPATO.strada)) continue;
        alberi.add(x, y, 'latifoglia', Math.round(x * 31 + y * 17), scala, importanza);
        n += 1;
      }
    }
  }
  return n;
}
