/**
 * Tipi di edificio della città isometrica (T12) e loro varianti. Puro e
 * deterministico: il tipo viene dal contesto (quartiere, stabilimento,
 * superficie, tipo OpenStreetMap), le varianti solo dall'identificativo della
 * sagoma. Niente Math.random.
 */
import type { DistrictId } from '@taranto2127/sim';
import { hash01, pick, polygonArea, type GeoBuilding } from '../plastico/data.js';
import { TAVOLOZZA } from './aspetto.js';

/** I tipi di edificio previsti (almeno sei, scheda T12). */
export type TipoEdificio =
  | 'palazzina' // Tamburi e periferie: 4-7 piani, tetto piano con terrazza, cisterne, antenne, balconi
  | 'casa' // casa bassa di 1-3 piani: terrazza o, se la pianta è quasi rettangolare, tetto a falde
  | 'citta-vecchia' // isola: case strette e alte, fitte, colori pastello, persiane, terrazze
  | 'centro' // Borgo: palazzi con cornicioni, zoccolo bugnato, persiane
  | 'pubblico' // scuola, ufficio: volume ampio, finestre a nastro, tetto piano o a falde in coppi
  | 'chiesa' // navata con tetto in coppi e campanile o cupola
  | 'negozio' // commerciale: basso, tetto piano, vetrine al piano terra
  | 'capannone' // stabilimento e zone industriali: lamiera grecata, tetto a falde in metallo
  | 'impianto' // stabilimento: volumi ciechi di cemento con ciminiera
  | 'basso'; // garage, tettoie, annessi: un piano, tetto piano

export const TIPI: readonly TipoEdificio[] = ['palazzina', 'casa', 'citta-vecchia', 'centro', 'pubblico', 'chiesa', 'negozio', 'capannone', 'impianto', 'basso'];

export const NOMI_TIPI: Record<TipoEdificio, string> = {
  palazzina: 'Palazzina dei Tamburi',
  casa: 'Casa bassa',
  'citta-vecchia': 'Casa della Città Vecchia',
  centro: 'Palazzo del centro',
  pubblico: 'Scuola o edificio pubblico',
  chiesa: 'Chiesa',
  negozio: 'Negozi',
  capannone: 'Capannone',
  impianto: 'Impianto con ciminiera',
  basso: 'Garage e annessi',
};

/** Contesto in cui sta una sagoma. */
export interface Contesto {
  quartiere: DistrictId | undefined;
  /** true se la sagoma sta nello stabilimento (area principale o pontili). */
  stabilimento: boolean;
}

/** Tipo di un edificio: dal tipo OpenStreetMap, dal contesto e dalla superficie. */
export function tipoEdificio(b: GeoBuilding, ctx: Contesto): TipoEdificio {
  const area = Math.abs(polygonArea(b.p));
  if (b.k === 'basso' || area < 40) return 'basso';
  if (ctx.stabilimento || b.k === 'industria') {
    // Nello stabilimento: i volumi grandi sono capannoni, alcuni medi sono impianti con ciminiera.
    if (ctx.stabilimento && area > 300 && area < 4000 && hash01(b.id, 11) < 0.22) return 'impianto';
    return 'capannone';
  }
  // Chiese: OpenStreetMap qui non distingue il culto. Stima dichiarata (docs/GRAFICA.md): un edificio
  // pubblico su quattro di media grandezza è una chiesa.
  if (b.k === 'pubblico') return area > 250 && area < 2500 && hash01(b.id, 13) < 0.25 ? 'chiesa' : 'pubblico';
  if (b.k === 'negozi') return 'negozio';
  if (ctx.quartiere === 'citta-vecchia') return 'citta-vecchia';
  // Borgo: i palazzi del centro (stima dal quartiere).
  if (ctx.quartiere === 'borgo' && area > 160) return 'centro';
  if (area > 2500) return hash01(b.id, 12) < 0.5 ? 'pubblico' : 'negozio';
  if (area > 160) return 'palazzina';
  return 'casa';
}

/** Facciate disegnate dal codice: una texture per stile, ripetuta lungo le pareti. */
export type StileFacciata = 'balconi' | 'persiane' | 'centro' | 'nastro' | 'vetrine' | 'lamiera' | 'cieco' | 'chiesa' | 'industriale';
export const STILI: StileFacciata[] = ['balconi', 'persiane', 'centro', 'nastro', 'vetrine', 'lamiera', 'cieco', 'chiesa', 'industriale'];

export type Tetto = 'terrazza' | 'falde-coppi' | 'falde-lamiera' | 'piano';

export interface Variante {
  tipo: TipoEdificio;
  /** Altezza in metri. */
  altezza: number;
  piani: number;
  facciata: StileFacciata;
  tetto: Tetto;
  /** Colore dell'intonaco o della lamiera (sRGB esadecimale). */
  parete: string;
  /** Colore del tetto o della terrazza. */
  copertura: string;
  /** Cisterne d'acqua e antenne sul tetto piano. */
  cisterne: number;
  antenne: number;
  /** Ciminiera: altezza in metri (0 = nessuna). */
  ciminiera: number;
  /** Lucernari sul tetto (capannoni). */
  lucernari: boolean;
  /** Negozi con le tende al piano terra (palazzine: stima, 4 su 10 dai tre piani in su). */
  negozi: boolean;
  /** Balconi in rilievo (palazzine, palazzi del centro). */
  balconi: boolean;
  /** Sporgenza del cornicione in metri (0 = nessuno). */
  cornice: number;
  /** Chiese: campanile o cupola. */
  campanile: 'campanile' | 'cupola' | null;
  /** Pergolato sul terrazzo (case basse). */
  pergolato: boolean;
  parabole: number;
  /** Gronda di colore pieno sotto il tetto (capannoni). */
  gronda: string | null;
  /** Zoccolo bugnato al piano terra (palazzi del centro). */
  zoccolo: boolean;
}

/** Tavolozza degli intonaci e delle lamiere per tipo (T12c, docs/GRAFICA.md «Sistema visivo»). */
export const INTONACI = {
  palazzina: TAVOLOZZA.intonaci,
  'citta-vecchia': ['#f6e7c6', '#f1cfa8', '#f7dcc0', '#efe0b6', '#e6d3ae', '#f4c9a8'],
  centro: ['#f0d9a8', '#e8c48e', '#f3e3c3', '#e6b48f', '#f5ead3', '#dfa77f'],
  casa: TAVOLOZZA.case,
  pubblico: ['#f0c987', '#e9a77a', '#f4dfb4', '#cfe0c4'],
  chiesa: ['#f3e6c8', '#efdcb4', '#f6efe0'],
  negozio: ['#f8f1e4', '#f3e9d6', '#fbf3e6'],
  capannone: TAVOLOZZA.lamiere,
  impianto: ['#ddd5c7', '#cfc6b6', '#e6dfd2'],
  basso: ['#f4ecdc', '#e9dcc4', '#f1e2c7'],
} as const satisfies Record<TipoEdificio, readonly string[]>;

export const COPERTURE = {
  terrazza: TAVOLOZZA.terrazze,
  coppi: TAVOLOZZA.coppi,
  lamiera: TAVOLOZZA.tettiLamiera,
  piano: ['#d9cfbf', '#cfd3d6'],
} as const;

const GRONDE = ['#f2efe6', '#d63a2a', '#2f6f9f', '#f0b429'];

/** Variante ripetibile di un edificio: dipende solo dal tipo e dall'identificativo della sagoma. */
export function variante(b: GeoBuilding, tipo: TipoEdificio, rettangolare: boolean): Variante {
  const r = (salt: number) => hash01(b.id, salt);
  const piano = 3.2;
  let piani: number;
  let facciata: StileFacciata = 'persiane';
  let tetto: Tetto = 'terrazza';
  let copertura: string = pick(COPERTURE.terrazza, r(2));
  let cisterne = 0;
  let antenne = 0;
  let ciminiera = 0;
  let lucernari = false;
  let negozi = false;
  let balconi = false;
  let cornice = 0;
  let campanile: Variante['campanile'] = null;
  let pergolato = false;
  let parabole = 0;
  let gronda: string | null = null;
  let zoccolo = false;
  switch (tipo) {
    case 'palazzina':
      piani = 4 + Math.floor(r(1) * 4); // 4-7 piani, come le palazzine dei Tamburi
      facciata = 'balconi';
      cisterne = 1 + Math.floor(r(3) * 4);
      antenne = 1 + Math.floor(r(4) * 3);
      negozi = r(902) < 0.4;
      balconi = true;
      cornice = 0.35;
      parabole = Math.floor(r(904) * 3);
      break;
    case 'citta-vecchia':
      piani = 3 + Math.floor(r(1) * 3);
      cisterne = Math.floor(r(3) * 2);
      antenne = Math.floor(r(4) * 2);
      cornice = r(905) < 0.5 ? 0.25 : 0;
      break;
    case 'centro':
      piani = 3 + Math.floor(r(1) * 3);
      facciata = 'centro';
      cisterne = Math.floor(r(3) * 2);
      antenne = 1 + Math.floor(r(4) * 2);
      cornice = 0.7 + r(906) * 0.4;
      zoccolo = true;
      balconi = r(907) < 0.5;
      negozi = r(902) < 0.5;
      parabole = Math.floor(r(904) * 2);
      break;
    case 'casa':
      piani = 1 + Math.floor(r(1) * 3);
      tetto = rettangolare && r(5) < 0.45 ? 'falde-coppi' : 'terrazza';
      copertura = tetto === 'falde-coppi' ? pick(COPERTURE.coppi, r(2)) : pick(COPERTURE.terrazza, r(2));
      cisterne = tetto === 'terrazza' ? Math.floor(r(3) * 2) : 0;
      antenne = Math.floor(r(4) * 2);
      pergolato = tetto === 'terrazza' && r(905) < 0.35;
      parabole = tetto === 'terrazza' && r(904) < 0.5 ? 1 : 0;
      break;
    case 'pubblico':
      piani = 2 + Math.floor(r(1) * 3);
      facciata = 'nastro';
      tetto = rettangolare && r(5) < 0.5 ? 'falde-coppi' : 'piano';
      copertura = tetto === 'falde-coppi' ? pick(COPERTURE.coppi, r(2)) : pick(COPERTURE.piano, r(2));
      cornice = tetto === 'piano' ? 0.6 : 0;
      break;
    case 'chiesa':
      piani = 4;
      facciata = 'chiesa';
      tetto = 'falde-coppi';
      copertura = pick(COPERTURE.coppi, r(2));
      campanile = r(908) < 0.6 ? 'campanile' : 'cupola';
      break;
    case 'negozio':
      piani = 1 + Math.floor(r(1) * 2);
      facciata = 'vetrine';
      tetto = 'piano';
      copertura = pick(COPERTURE.piano, r(2));
      negozi = true;
      cornice = 0.3;
      break;
    case 'capannone':
      piani = 3 + Math.floor(r(1) * 4); // 10-22 m di gronda, misurati in «piani» di 3,2 m
      facciata = 'industriale';
      tetto = rettangolare ? 'falde-lamiera' : 'piano';
      lucernari = true;
      copertura = pick(COPERTURE.lamiera, r(2));
      gronda = pick(GRONDE, r(909));
      break;
    case 'impianto':
      piani = 4 + Math.floor(r(1) * 5);
      facciata = 'cieco';
      tetto = 'piano';
      copertura = pick(COPERTURE.piano, r(2));
      ciminiera = 45 + Math.floor(r(6) * 50);
      break;
    case 'basso':
      piani = 1;
      facciata = 'cieco';
      tetto = 'piano';
      copertura = pick(COPERTURE.terrazza, r(2));
      break;
  }
  const altezza = b.h !== undefined ? Math.max(b.h, 3) : tipo === 'chiesa' ? 13 + r(910) * 6 : piani * piano + (tipo === 'basso' ? -0.4 : 0.6);
  const quantiPiani = Math.max(1, Math.round(altezza / piano));
  return {
    tipo,
    altezza,
    piani: quantiPiani,
    facciata,
    tetto,
    parete: pick(INTONACI[tipo], r(7)),
    copertura,
    cisterne,
    antenne,
    ciminiera,
    lucernari,
    negozi: negozi && quantiPiani >= (tipo === 'negozio' ? 1 : 3),
    balconi,
    cornice,
    campanile,
    pergolato,
    parabole,
    gronda,
    zoccolo,
  };
}

/** Firma della variante: ciò che si vede di diverso tra due edifici dello stesso tipo, oltre al colore. */
export function firmaVariante(v: Variante): string {
  return [v.facciata, v.tetto, v.negozi ? 'negozi' : '', v.balconi ? 'balconi' : '', v.campanile ?? '', v.pergolato ? 'pergolato' : '', v.cornice > 0 ? 'cornice' : '', v.gronda ?? '', v.zoccolo ? 'zoccolo' : ''].join('|');
}
