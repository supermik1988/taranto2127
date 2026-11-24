/**
 * Aspetto della città isometrica (T12c, fase A): il sistema visivo nuovo in due
 * varianti, da provare su un campione prima di estenderlo a tutta la zona.
 *
 * - «attuale»: com'è la città dopo T12 (68289f1). Resta l'aspetto predefinito
 *   finché Michele non sceglie una variante.
 * - «illustrata» (variante 1): luce a tre fasce nette, contorni scuri sottili
 *   sugli spigoli, colori pieni e piatti.
 * - «predisegnata» (variante 2): ombre morbide, ombre di contatto alla base
 *   degli edifici, facciate con molto dettaglio dipinto, nessun contorno.
 *
 * Le due varianti usano la stessa tavolozza nuova e gli stessi edifici nuovi
 * (catalogo.ts), che nella fase A si costruiscono solo dentro il riquadro del
 * campione. Tutti i valori sono scritti in docs/GRAFICA.md («Sistema visivo»).
 * Modulo puro: niente three.js, niente pagina.
 */

export type Aspetto = 'attuale' | 'illustrata' | 'predisegnata';
export const ASPETTI: Aspetto[] = ['attuale', 'illustrata', 'predisegnata'];

/** Aspetto chiesto dall'indirizzo della pagina (?aspetto=1, 2, illustrata, predisegnata); altrimenti quello di oggi. */
export function aspettoDa(search: string): Aspetto {
  const v = new URLSearchParams(search).get('aspetto');
  if (v === '1' || v === 'illustrata') return 'illustrata';
  if (v === '2' || v === 'predisegnata') return 'predisegnata';
  return 'attuale';
}

/**
 * Riquadro del campione, in metri (x verso est, y verso nord): il lato ovest dei
 * Tamburi, il bordo dello stabilimento con le ciminiere a (7, 578) e (446, 408) e il
 * nastro che scende verso (−267, −534), la costa con i moli a sud dei Tamburi.
 */
export const CAMPIONE = { minX: -350, maxX: 2100, minY: -1950, maxY: 750 } as const;

export const nelCampione = (x: number, y: number): boolean => x >= CAMPIONE.minX && x <= CAMPIONE.maxX && y >= CAMPIONE.minY && y <= CAMPIONE.maxY;

/**
 * Tavolozza nuova, con i ruoli (sRGB esadecimale). Meno beige e meno grigio:
 * intonaci caldi variati, verde vivo, mare profondo con la fascia chiara sotto
 * costa, cortili e piazze in pietra calda distinti dall'asfalto blu-grigio.
 */
export const TAVOLOZZA = {
  /** Intonaci delle palazzine e delle case: toni caldi, variati. */
  intonaci: ['#f2c46d', '#ec9b6c', '#f6dfb2', '#dc7b52', '#f7ead0', '#eab09a', '#f0a95e', '#e6c98d', '#a9c9dc'],
  /** Intonaci delle case basse: più chiari, calce e pastelli. */
  case: ['#fbf3e1', '#f6d9a8', '#f3c3a4', '#fae7b8', '#d9e6c4'],
  /** Calce dei parapetti e delle soglie. */
  calce: '#fbf6ec',
  /** Piano terra (zoccolo in pietra o intonaco scuro) e cornicioni. */
  zoccolo: '#b98d68',
  cornice: '#fff4dc',
  /** Terrazze sui tetti piani: cotto chiaro e guaina. */
  terrazze: ['#e3c9a5', '#d9b893', '#cfd3d6'],
  /** Tetti a falde in coppi. */
  coppi: ['#d0582f', '#c24c2b', '#dd6c3c'],
  /** Lamiere dei capannoni: azzurri, bianchi, verde acqua e qualche ruggine. */
  lamiere: ['#5f8fb8', '#8db3cc', '#d4dde2', '#6ba59a', '#b6c7d1', '#a85a32', '#c0703c'],
  /** Tetti dei capannoni. */
  tettiLamiera: ['#6f8798', '#8a9fab', '#5b7385'],
  /** Accenti: tende dei negozi, panni stesi, persiane. */
  tende: ['#d9442c', '#2f7fbf', '#2e9d5b', '#f0b429', '#e9e2d0'],
  panni: ['#ffffff', '#e94f4f', '#3a8fd8', '#f4c842', '#7bc46a', '#f08fb0'],
  ringhiere: ['#3b3f45', '#f2efe6', '#4b6b5a'],
  /** Ciminiere: fusto chiaro e fascia rossa. */
  ciminiera: '#e6e0d6',
  fasciaCiminiera: '#d63a2a',
  /** Ruggine (impianti fermi, colature). */
  ruggine: '#9c4f2a',
  /** Contorno della variante illustrata. */
  contorno: '#2b2530',
} as const;

/** Colori del suolo, del mare e delle strade che cambiano con la tavolozza nuova (stesse chiavi di suolo.ts e texture.ts). */
export const SUOLO_NUOVO = {
  erba: '#86c051',
  cortile: '#f3e6cf',
  piazzale: '#c9b99a',
  parcheggio: '#5c6470',
  sabbia: '#f1dca2',
  roccia: '#a3988a',
  ghiaia: '#8f8172',
  terra: '#c39a6b',
  lastricato: '#f5d6a0',
  campi: '#d4cc62',
  sottobosco: '#4f9a3c',
  campo: '#5fbf4a',
} as const;

export const COLORI_NUOVI = {
  mare: '#1f66b0',
  mareChiuso: '#1d5f8e',
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

export const VERDI_NUOVI = {
  pino: ['#2f7a3a', '#3a8742', '#2a6b34'],
  latifoglia: ['#4fa33a', '#5db544', '#46973a', '#6cbd48'],
  giovane: ['#6cc04a', '#7fcb55', '#5cae40', '#8fd25e'],
  cespuglio: ['#3f8a35', '#4d983d', '#5aa346'],
  ulivo: ['#7a9a5a', '#86a565', '#6e8f52'],
  cipresso: ['#245a2e', '#2c6636'],
} as const;

/** Luce di ogni aspetto: cielo e suolo dell'emisfero, sole, tipo di ombra, fasce. */
export interface Luce {
  cielo: string;
  terra: string;
  emisfero: number;
  sole: string;
  intensitaSole: number;
  /** Ombre morbide (PCF morbido) o a bordo netto. */
  ombreMorbide: boolean;
  /** Fasce della luce diretta (variante illustrata): valori della rampa; vuoto = luce continua. */
  fasce: number[];
  /** Contorni scuri sugli spigoli. */
  contorni: boolean;
  /** Ombre di contatto alla base degli edifici. */
  contatto: boolean;
}

export const LUCI: Record<Aspetto, Luce> = {
  attuale: { cielo: '#d4e9ff', terra: '#b8a57c', emisfero: 1.5, sole: '#fff3d9', intensitaSole: 2.6, ombreMorbide: false, fasce: [], contorni: false, contatto: false },
  // Tetto al sole: (1,25 + 1,95) / π ≈ 1,02 → il colore scritto arriva quasi tale e quale.
  illustrata: { cielo: '#f2f6ff', terra: '#d8c8a8', emisfero: 1.25, sole: '#fff8ec', intensitaSole: 1.95, ombreMorbide: false, fasce: [0.3, 0.62, 1], contorni: true, contatto: false },
  predisegnata: { cielo: '#e6f0ff', terra: '#d6c29a', emisfero: 1.6, sole: '#fff1dc', intensitaSole: 1.75, ombreMorbide: true, fasce: [], contorni: false, contatto: true },
};

/** Sotto questo ingrandimento (pixel per metro) i contorni coprirebbero tutto: si spengono. */
export const PPM_CONTORNI = 0.9;
