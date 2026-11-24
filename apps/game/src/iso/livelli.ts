/**
 * Livelli di dettaglio della città isometrica (T12, fase B): alto, medio, basso.
 * Il gioco misura il tempo di ogni immagine; se il 95° percentile di una finestra
 * di immagini supera il budget, scende di un livello da solo. Al livello basso,
 * sotto le 20 immagini al secondo, chiede di tornare alla mappa schematica.
 * Si può anche scegliere il livello a mano (da «Strati»): allora non cambia da solo,
 * ma la riserva schematica resta. Modulo puro: si prova da solo.
 */

export type Livello = 'alto' | 'medio' | 'basso';
export type Scelta = 'auto' | Livello;
export const LIVELLI: Livello[] = ['alto', 'medio', 'basso'];

export const NOMI_LIVELLI: Record<Scelta, string> = {
  auto: 'Automatico',
  alto: 'Alto',
  medio: 'Medio',
  basso: 'Basso',
};

/** Budget di un'immagine: 33 ms, cioè 30 immagini al secondo. */
export const BUDGET_MS = 33;
/** Sotto queste immagini al secondo, al livello basso, si torna alla mappa schematica. */
export const MIN_IMMAGINI = 20;
/** Immagini per finestra di misura; le prime dopo un cambio non contano (si compilano i materiali). */
export const FINESTRA = 90;
export const RISCALDAMENTO = 30;

/** Che cosa mostra ogni livello: densità di pixel, ombre, dettagli e quota di alberi. */
export interface Impostazioni {
  pixel: number;
  ombre: boolean;
  /** Lato della mappa d'ombra in pixel. */
  mappaOmbre: number;
  /** Oggetti piccoli ripetuti: cisterne, antenne, lucernari, auto, barche, scogli. */
  dettagli: boolean;
  /** Cespugli e uliveti (importanza 2). */
  riempitivo: boolean;
  /** Alberi dei parchi e dei cortili (importanza 1); quelli dei viali e dei lotti restano sempre. */
  alberiParchi: boolean;
  /** Onde del mare che scorrono. */
  onde: boolean;
}

export const IMPOSTAZIONI: Record<Livello, Impostazioni> = {
  alto: { pixel: 1.5, ombre: true, mappaOmbre: 4096, dettagli: true, riempitivo: true, alberiParchi: true, onde: true },
  medio: { pixel: 1.1, ombre: true, mappaOmbre: 2048, dettagli: true, riempitivo: false, alberiParchi: true, onde: true },
  basso: { pixel: 1, ombre: false, mappaOmbre: 1024, dettagli: false, riempitivo: false, alberiParchi: false, onde: false },
};

/** 95° percentile di una lista di tempi. */
export function percentile95(tempi: readonly number[]): number {
  if (tempi.length === 0) return 0;
  const s = [...tempi].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]!;
}

export type Evento = { tipo: 'livello'; livello: Livello; motivo: string } | { tipo: 'riserva'; motivo: string } | null;

export class Regolatore {
  private tempi: number[] = [];
  private scartare = RISCALDAMENTO;
  private livelloOra: Livello;
  /** Ultima misura completa: media e 95° percentile in millisecondi. */
  ultima: { media: number; p95: number } | null = null;

  constructor(
    private scelta: Scelta = 'auto',
    private readonly budget = BUDGET_MS,
  ) {
    this.livelloOra = scelta === 'auto' ? 'alto' : scelta;
  }

  get livello(): Livello {
    return this.livelloOra;
  }

  get sceltaOra(): Scelta {
    return this.scelta;
  }

  /** Scelta a mano (o di nuovo automatica): riparte la misura. */
  scegli(scelta: Scelta): Livello {
    this.scelta = scelta;
    if (scelta !== 'auto') this.livelloOra = scelta;
    else this.livelloOra = 'alto';
    this.ricomincia();
    return this.livelloOra;
  }

  /** Dopo un cambio di livello o una pausa (scheda nascosta), le prime immagini non contano. */
  ricomincia(): void {
    this.tempi = [];
    this.scartare = RISCALDAMENTO;
  }

  /** Registra il tempo di un'immagine (ms); restituisce un evento quando la finestra è piena e serve agire. */
  registra(ms: number): Evento {
    if (this.scartare > 0) {
      this.scartare -= 1;
      return null;
    }
    // Pause lunghe (scheda nascosta, finestra trascinata) non dicono nulla sul disegno.
    if (ms > 1000) return null;
    this.tempi.push(ms);
    if (this.tempi.length < FINESTRA) return null;
    const p95 = percentile95(this.tempi);
    const media = this.tempi.reduce((a, b) => a + b, 0) / this.tempi.length;
    this.ultima = { media, p95 };
    this.tempi = [];
    const immagini = 1000 / media;
    if (this.livelloOra === 'basso' && immagini < MIN_IMMAGINI) {
      return { tipo: 'riserva', motivo: `il dispositivo disegna ${Math.round(immagini)} immagini al secondo anche al livello basso, troppo poche per la città` };
    }
    if (this.scelta === 'auto' && p95 > this.budget && this.livelloOra !== 'basso') {
      const prima = this.livelloOra;
      this.livelloOra = this.livelloOra === 'alto' ? 'medio' : 'basso';
      this.ricomincia();
      return { tipo: 'livello', livello: this.livelloOra, motivo: `al livello ${prima} il 95° percentile è ${p95.toFixed(1)} ms, sopra il budget di ${this.budget} ms` };
    }
    return null;
  }
}
