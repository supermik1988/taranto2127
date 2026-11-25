/**
 * Aspetto della città isometrica (T12c): il sistema visivo «illustrato» scelto da
 * Michele nella fase A (variante 1) e reso l'unico aspetto della città. Luce a tre
 * fasce nette, contorni scuri sottili che si alleggeriscono con la distanza, colori
 * pieni e piatti. Tutti i valori sono scritti in docs/GRAFICA.md («Sistema visivo»).
 * Modulo puro: niente three.js, niente pagina.
 */

/**
 * Tavolozza con i ruoli (sRGB esadecimale). Meno beige e meno grigio: intonaci
 * caldi variati, verde vivo, mare profondo con la fascia chiara sotto costa, cortili
 * e piazze in pietra chiara distinti dall'asfalto grigio blu.
 */
export const TAVOLOZZA = {
  /** Intonaci delle palazzine e delle case: toni caldi, variati. */
  intonaci: ['#f2c46d', '#ec9b6c', '#f6dfb2', '#dc7b52', '#f7ead0', '#eab09a', '#f0a95e', '#e6c98d', '#a9c9dc'],
  /** Intonaci delle case basse: più chiari, calce e pastelli. */
  case: ['#fbf3e1', '#f6d9a8', '#f3c3a4', '#fae7b8', '#d9e6c4'],
  /** Calce dei parapetti e delle soglie. */
  calce: '#fbf6ec',
  /** Zoccolo bugnato e cornicioni. */
  zoccolo: '#c9a27c',
  cornice: '#fff4dc',
  /** Terrazze sui tetti piani: cotto chiaro e guaina. */
  terrazze: ['#e3c9a5', '#d9b893', '#cfd3d6'],
  /** Tetti a falde in coppi. */
  coppi: ['#d0582f', '#c24c2b', '#dd6c3c'],
  /** Lamiere dei capannoni: azzurri, bianchi, verde acqua e qualche ruggine. */
  lamiere: ['#5f8fb8', '#8db3cc', '#d4dde2', '#6ba59a', '#b6c7d1', '#a85a32', '#c0703c'],
  /** Lamiere e tetti degli impianti fermi (lotti di ILSIDER). */
  ruggini: ['#9c5a3a', '#8a5a44', '#a8673f', '#7f5e4c', '#94603f'],
  tettiRuggine: ['#7d4630', '#6f5a49', '#8a4b2c'],
  /** Tetti dei capannoni. */
  tettiLamiera: ['#6f8798', '#8a9fab', '#5b7385'],
  /** Accenti: tende dei negozi, panni stesi, ringhiere. */
  tende: ['#d9442c', '#2f7fbf', '#2e9d5b', '#f0b429', '#e9e2d0'],
  panni: ['#ffffff', '#e94f4f', '#3a8fd8', '#f4c842', '#7bc46a', '#f08fb0'],
  ringhiere: ['#3b3f45', '#f2efe6', '#4b6b5a'],
  /** Serbatoi dello stabilimento. */
  serbatoi: ['#f4f5f2', '#e6e9ea', '#d7dcdf', '#c9744a', '#f0e6d2'],
  /** Ciminiere: fusto chiaro e fascia rossa. */
  ciminiera: '#e6e0d6',
  fasciaCiminiera: '#d63a2a',
  /** Nastri trasportatori e tubazioni. */
  nastro: '#c08a4e',
  cavalletto: '#6d5a4a',
  tubi: ['#9aa4ab', '#c6633a', '#e2b83e'],
  /** Contorno. */
  contorno: '#2b2530',
} as const;

/** Luce: emisfero (cielo e suolo), sole, rampa delle fasce. */
export const LUCE = {
  cielo: '#f2f6ff',
  terra: '#d8c8a8',
  emisfero: 1.25,
  sole: '#fff8ec',
  intensitaSole: 1.95,
  /**
   * Fasce della luce diretta: in ombra, di fianco, al sole. La fascia in ombra è più
   * chiara di quella del campione (0,30): da lontano i Tamburi restavano scuri.
   */
  fasce: [0.5, 0.74, 1],
} as const;

/**
 * Contorni che si alleggeriscono con la distanza (approvazione della fase A,
 * punto 2): l'opacità sale in modo continuo da 0 a CONTORNO_PIENO tra
 * PPM_CONTORNI_DA e PPM_CONTORNI_A pixel per metro. Nessuno scatto: sotto la soglia
 * l'opacità è già zero quando le linee si spengono.
 */
export const PPM_CONTORNI_DA = 1;
export const PPM_CONTORNI_A = 3;
export const CONTORNO_PIENO = 0.9;
/**
 * Sotto questa opacità le linee non si disegnano affatto (risparmio: sono centinaia di
 * migliaia di segmenti). Una riga di un pixel al 6% non si distingue: nessuno scatto visibile.
 */
export const OPACITA_MINIMA_CONTORNI = 0.06;

export function opacitaContorni(ppm: number): number {
  const t = Math.min(1, Math.max(0, (ppm - PPM_CONTORNI_DA) / (PPM_CONTORNI_A - PPM_CONTORNI_DA)));
  // Curva morbida (smoothstep): nessun gradino né all'inizio né alla fine.
  return CONTORNO_PIENO * t * t * (3 - 2 * t);
}

/**
 * Balconi in rilievo solo al livello alto e da vicino (approvazione, punto 3):
 * altrimenti sono dipinti nella facciata.
 */
export const PPM_BALCONI = 2;
