/**
 * Tipi di edificio della città isometrica (T12) e loro varianti. Puro e
 * deterministico: il tipo viene dal contesto (quartiere, stabilimento,
 * superficie, tipo OpenStreetMap), le varianti solo dall'identificativo della
 * sagoma. Niente Math.random.
 */
import type { DistrictId } from '@taranto2127/sim';
import { hash01, pick, polygonArea, type GeoBuilding } from '../plastico/data.js';

/** I tipi di edificio previsti (almeno sei, scheda T12). */
export type TipoEdificio =
  | 'palazzina' // Tamburi e periferie: 4-7 piani, tetto piano con terrazza, cisterne, antenne, balconi
  | 'casa' // casa bassa di 1-3 piani: terrazza o, se la pianta è quasi rettangolare, tetto a falde
  | 'citta-vecchia' // isola: case strette e alte, fitte, colori pastello, persiane, terrazze
  | 'pubblico' // scuola, chiesa, ufficio: volume ampio, finestre a nastro, tetto a falde in coppi
  | 'negozio' // commerciale: basso, tetto piano, vetrine al piano terra
  | 'capannone' // stabilimento e zone industriali: lamiera grecata, tetto a falde in metallo
  | 'impianto' // stabilimento: volumi ciechi di cemento con ciminiera
  | 'basso'; // garage, tettoie, annessi: un piano, tetto piano

export const TIPI: readonly TipoEdificio[] = ['palazzina', 'casa', 'citta-vecchia', 'pubblico', 'negozio', 'capannone', 'impianto', 'basso'];

export const NOMI_TIPI: Record<TipoEdificio, string> = {
  palazzina: 'Palazzina dei Tamburi',
  casa: 'Casa bassa',
  'citta-vecchia': 'Casa della Città Vecchia',
  pubblico: 'Edificio pubblico',
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
  if (b.k === 'pubblico') return 'pubblico';
  if (b.k === 'negozi') return 'negozio';
  if (ctx.quartiere === 'citta-vecchia') return 'citta-vecchia';
  if (area > 2500) return hash01(b.id, 12) < 0.5 ? 'pubblico' : 'negozio';
  if (area > 160) return 'palazzina';
  return 'casa';
}

/** Facciate disegnate dal codice: una texture per stile, ripetuta lungo le pareti. */
export type StileFacciata = 'balconi' | 'persiane' | 'nastro' | 'vetrine' | 'lamiera' | 'cieco' | 'industriale';
export const STILI: StileFacciata[] = ['balconi', 'persiane', 'nastro', 'vetrine', 'lamiera', 'cieco', 'industriale'];

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
}

/** Tavolozza degli intonaci e delle lamiere, con il ruolo di ogni colore (docs/GRAFICA.md). */
export const INTONACI = {
  // Palazzine: colori caldi e pieni, come gli intonaci del sud.
  palazzina: ['#ecc779', '#e9a07f', '#f2e3bd', '#dd8f5c', '#e6cf9a', '#c9a46d', '#f0b98a'],
  // Città Vecchia: pastelli più chiari e qualche tufo.
  'citta-vecchia': ['#f3e6c4', '#e9c9a3', '#d9c7a1', '#f1d6b8', '#e3d2b0', '#cdbb93'],
  casa: ['#f4ead2', '#efd2a2', '#e6b48b', '#f3e2b3'],
  pubblico: ['#e7b76f', '#d9a06a', '#f0d79d'],
  negozio: ['#ece6d8', '#e3dccb', '#f3efe4'],
  // Capannoni: grigi freddi, azzurri, bianchi sporchi e qualche lamiera arrugginita.
  capannone: ['#9aa7b3', '#b7bdc2', '#8e9aa5', '#a6b1a2', '#c9cfd4', '#7f97ad', '#a8826a', '#b9a48b'],
  impianto: ['#b8b0a3', '#a59c8f', '#c4bcae'],
  basso: ['#dcd3c1', '#cfc5b0'],
} as const satisfies Record<TipoEdificio, readonly string[]>;

export const COPERTURE = {
  terrazza: ['#cfc9bd', '#d8d2c6', '#c5beb1'],
  coppi: ['#c5623d', '#b8573a', '#cf7048'],
  lamiera: ['#7d8a96', '#8f9aa4', '#6f7b86'],
  piano: ['#bdb6a9', '#c9c2b4'],
} as const;

/** Variante ripetibile di un edificio: dipende solo dal tipo e dall'identificativo della sagoma. */
export function variante(b: GeoBuilding, tipo: TipoEdificio, rettangolare: boolean): Variante {
  const r = (salt: number) => hash01(b.id, salt);
  const piano = 3.2;
  let piani: number;
  let facciata: StileFacciata;
  let tetto: Tetto;
  let copertura: string;
  let cisterne = 0;
  let antenne = 0;
  let ciminiera = 0;
  let lucernari = false;
  switch (tipo) {
    case 'palazzina':
      piani = 4 + Math.floor(r(1) * 4); // 4-7 piani, come le palazzine dei Tamburi
      facciata = 'balconi';
      tetto = 'terrazza';
      copertura = pick(COPERTURE.terrazza, r(2));
      cisterne = 1 + Math.floor(r(3) * 4);
      antenne = 1 + Math.floor(r(4) * 3);
      break;
    case 'citta-vecchia':
      piani = 3 + Math.floor(r(1) * 3);
      facciata = 'persiane';
      tetto = 'terrazza';
      copertura = pick(COPERTURE.terrazza, r(2));
      cisterne = Math.floor(r(3) * 2);
      antenne = Math.floor(r(4) * 2);
      break;
    case 'casa':
      piani = 1 + Math.floor(r(1) * 3);
      facciata = 'persiane';
      tetto = rettangolare && r(5) < 0.45 ? 'falde-coppi' : 'terrazza';
      copertura = tetto === 'falde-coppi' ? pick(COPERTURE.coppi, r(2)) : pick(COPERTURE.terrazza, r(2));
      cisterne = tetto === 'terrazza' ? Math.floor(r(3) * 2) : 0;
      antenne = Math.floor(r(4) * 2);
      break;
    case 'pubblico':
      piani = 2 + Math.floor(r(1) * 3);
      facciata = 'nastro';
      tetto = rettangolare ? 'falde-coppi' : 'piano';
      copertura = tetto === 'falde-coppi' ? pick(COPERTURE.coppi, r(2)) : pick(COPERTURE.piano, r(2));
      break;
    case 'negozio':
      piani = 1 + Math.floor(r(1) * 2);
      facciata = 'vetrine';
      tetto = 'piano';
      copertura = pick(COPERTURE.piano, r(2));
      break;
    case 'capannone':
      piani = 3 + Math.floor(r(1) * 4); // 10-22 m di gronda, misurati in «piani» di 3,2 m
      facciata = 'industriale';
      tetto = rettangolare ? 'falde-lamiera' : 'piano';
      lucernari = true;
      copertura = pick(COPERTURE.lamiera, r(2));
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
      copertura = pick(COPERTURE.piano, r(2));
      break;
  }
  const altezza = b.h !== undefined ? Math.max(b.h, 3) : piani * piano + (tipo === 'basso' ? -0.4 : 0.6);
  return {
    tipo,
    altezza,
    piani: Math.max(1, Math.round(altezza / piano)),
    facciata,
    tetto,
    parete: pick(INTONACI[tipo], r(7)),
    copertura,
    cisterne,
    antenne,
    ciminiera,
    lucernari,
  };
}
