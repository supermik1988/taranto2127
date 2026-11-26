/**
 * Mai più pagina bianca (T12d): se qualcosa si rompe, il giocatore vede che cosa è
 * successo e può riprovare o ripartire da zero.
 *
 * - `Riserva` intercetta gli errori di React: al livello più alto mostra il messaggio
 *   di guasto; attorno alla città 3D chiama `onErrore`, e il gioco ripiega sulla mappa
 *   schematica senza fermarsi.
 * - `segnaAvvio` dice alla sentinella di index.html che il gioco è partito.
 * - `ripartiDaZero` cancella i dati del gioco salvati nel browser e ricarica.
 * - `guastoDiProva` legge un guasto voluto dall'archivio del browser (solo per le prove
 *   nel browser): così «Riparti da zero», che svuota l'archivio, lo toglie davvero.
 */
import { Component, type ReactNode } from 'react';

/** Prefisso delle chiavi del gioco nell'archivio del browser. */
export const PREFISSO = 'taranto2127:';
/** Chiave del guasto di prova: 'modulo' | 'avvio' | 'citta' | 'citta-disegno'. */
export const CHIAVE_GUASTO = 'taranto2127:prova-guasto';

type Finestra = Window & { __taranto2127Avviato?: boolean; __taranto2127Guasto?: boolean };

/** Il gioco è partito: la sentinella non deve più intervenire. */
export function segnaAvvio(): void {
  (window as Finestra).__taranto2127Avviato = true;
}

/** Guasto di prova chiesto dall'archivio del browser, o null. */
export function guastoDiProva(): string | null {
  try {
    return window.localStorage.getItem(CHIAVE_GUASTO);
  } catch {
    return null;
  }
}

/** Cancella i dati del gioco (solo le chiavi del gioco) e ricarica dall'indirizzo senza partita. */
export function ripartiDaZero(): void {
  for (const archivio of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const a = archivio();
      const chiavi: string[] = [];
      for (let i = 0; i < a.length; i++) {
        const k = a.key(i);
        if (k !== null && k.startsWith(PREFISSO)) chiavi.push(k);
      }
      for (const k of chiavi) a.removeItem(k);
    } catch {
      // archivio non disponibile: niente da cancellare
    }
  }
  window.location.replace(window.location.pathname);
}

/** Nome e versione del browser, da userAgent (senza dati personali). */
export function nomeBrowser(ua = navigator.userAgent): string {
  const prove: [RegExp, string][] = [
    [/SamsungBrowser\/([\d.]+)/, 'Samsung Internet'],
    [/EdgA?\/([\d.]+)/, 'Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/CriOS\/([\d.]+)/, 'Chrome per iOS'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Version\/([\d.]+).*Safari/, 'Safari'],
  ];
  for (const [re, nome] of prove) {
    const m = re.exec(ua);
    if (m !== null) return `${nome} ${m[1]!.split('.').slice(0, 2).join('.')}${/Android/.test(ua) ? ' (Android)' : /iPhone|iPad/.test(ua) ? ' (iOS)' : ''}`;
  }
  return ua.slice(0, 80);
}

/** Il messaggio di guasto: lo stesso della sentinella di index.html. */
export function MessaggioGuasto({ errore }: { errore: string }) {
  return (
    <div className="guasto" role="alert" data-testid="messaggio-guasto">
      <h1>Il gioco non è riuscito a partire</h1>
      <p>Qualcosa si è rotto mentre il gioco si avviava in questo browser. Non è colpa tua: puoi riprovare, oppure ripartire da zero cancellando la partita salvata in questo browser.</p>
      <p className="guasto-dettaglio">
        Errore: <code>{errore}</code>
        <br />
        Browser: {nomeBrowser()}
      </p>
      <p>
        <button type="button" onClick={() => window.location.reload()} data-testid="guasto-riprova">
          Riprova
        </button>{' '}
        <button type="button" onClick={ripartiDaZero} data-testid="guasto-riparti">
          Riparti da zero
        </button>
      </p>
    </div>
  );
}

interface PropsRiserva {
  children: ReactNode;
  /** Se c'è, l'errore si passa qui e non si mostra nulla (città 3D: si ripiega sulla mappa schematica). */
  onErrore?: (motivo: string) => void;
}

/** Contenitore che intercetta gli errori di React sotto di sé. */
export class Riserva extends Component<PropsRiserva, { errore: string | null }> {
  override state = { errore: null as string | null };

  static getDerivedStateFromError(e: unknown): { errore: string } {
    return { errore: e instanceof Error ? e.message : String(e) };
  }

  override componentDidCatch(e: unknown): void {
    const motivo = e instanceof Error ? e.message : String(e);
    if (this.props.onErrore !== undefined) this.props.onErrore(`la città 3D si è fermata per un errore (${motivo})`);
    else {
      // Il messaggio è visibile: la sentinella non deve sovrapporne un altro.
      (window as Finestra).__taranto2127Guasto = true;
      segnaAvvio();
    }
  }

  override render(): ReactNode {
    if (this.state.errore === null) return this.props.children;
    return this.props.onErrore !== undefined ? null : <MessaggioGuasto errore={this.state.errore} />;
  }
}
