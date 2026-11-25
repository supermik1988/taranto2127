/**
 * La città isometrica nella pagina (T12; prima il plastico del T11). Questo modulo,
 * three.js e i dati geografici si caricano a parte (React.lazy in layout.tsx): la
 * prima schermata non aspetta il 3D.
 */
import type { DistrictId, GameState } from '@taranto2127/sim';
import { useEffect, useRef, useState } from 'react';
import { content } from '../engine.js';
import { MIN_IMMAGINI, type Livello, type Scelta } from '../iso/livelli.js';
import { createCitta, type CittaApi, type InfoDisegno } from '../iso/scena.js';
import { vitaDaStato } from '../iso/vita.js';
import type { MapIndicator } from '../map.js';
import { geo } from './data.js';
import { layerValues, lotLook, type LotLook } from './looks.js';

/** Sotto questa soglia, anche al livello basso, il dispositivo non regge il 3D. */
export const MIN_FPS = MIN_IMMAGINI;

/** Interfaccia per la verifica automatica nel browser. */
export interface PlasticoProbe {
  screenPosition(id: string): { x: number; y: number } | null;
  focus(id: string, distance?: number): void;
  looks(): Record<string, LotLook>;
  /** Solo per le prove visive: mostra aspetti diversi da quelli della partita, fino al prossimo cambiamento dello stato. */
  preview(looks: Record<string, LotLook>): void;
  selected(): string | null;
  frameIn(id: string, area: { left: number; top: number; right: number; bottom: number }): void;
  fps(): number;
  measured: number | null;
  ruota(verso: 1 | -1): void;
  orientamento(): number;
  livello(): Livello;
  scegliLivello(scelta: Scelta): void;
  info(): InfoDisegno;
  tempi(): number[];
  azzeraTempi(): void;
  angoli(): boolean[];
  luminosita(x0: number, y0: number, x1: number, y1: number): number;
  movimento(): { accesi: number; fermi: boolean };
  mostraCatalogo(): { x: number; y: number };
  nascondi(prefissi: string[]): number;
  campioneColori(colori: string[]): { atteso: string; letto: [number, number, number] }[];
  camera(): { ortografica: boolean; elevazione: number; azimut: number };
  imposta(ppm: number, orientamento?: number): void;
  guarda(x: number, y: number, ppm: number): void;
  /** Cambi di livello avvenuti da soli, con il motivo. */
  cambi: string[];
}

declare global {
  interface Window {
    taranto2127Plastico?: PlasticoProbe;
  }
}

/**
 * Parte della tela che finestre e barre lasciano libera: sopra la finestra che sale
 * dal basso (telefono) o a sinistra di quella laterale (schermo largo).
 */
function freeArea(canvas: HTMLCanvasElement): { left: number; top: number; right: number; bottom: number } {
  const box = canvas.getBoundingClientRect();
  const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
  const hud = rect('.hud-top');
  const rail = rect('.rail');
  const win = rect('.map-window');
  const bar = rect('.timebar');
  let top = hud?.bottom ?? 0;
  let bottom = bar?.top ?? box.height;
  let right = rail?.left ?? box.width;
  const left = 0;
  if (win !== undefined) {
    if (win.left <= 1) bottom = Math.min(bottom, win.top);
    else right = Math.min(right, win.left);
  }
  top = Math.max(0, top - box.top);
  bottom = Math.max(top + 1, bottom - box.top);
  right = Math.max(left + 1, right - box.left);
  return { left, top, right, bottom };
}

export default function Plastico({
  state,
  layer,
  selected = null,
  detail = 'auto',
  onSelect,
  onFallback,
  onDetail,
}: {
  state: GameState;
  /** Lotto o quartiere aperto in una finestra: resta evidenziato e in vista. */
  selected?: string | null;
  /** Indicatore dello strato colorato, o null se spento. */
  layer: MapIndicator | null;
  /** Livello di dettaglio scelto in «Strati». */
  detail?: Scelta;
  onSelect: (kind: 'district' | 'lot', id: string) => void;
  /** Il 3D non va: si torna alla mappa schematica, con il motivo. */
  onFallback: (reason: string) => void;
  /** Il livello in uso è cambiato (anche da solo). */
  onDetail?: (livello: Livello) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const api = useRef<CittaApi | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const fallback = useRef(onFallback);
  fallback.current = onFallback;
  const detailChanged = useRef(onDetail);
  detailChanged.current = onDetail;
  const [ready, setReady] = useState(false);

  const looks = (): Record<string, LotLook> => Object.fromEntries(state.plantLots.map((l) => [l.id, lotLook(state, l.id)]));
  const looksRef = useRef(looks);
  looksRef.current = looks;

  useEffect(() => {
    if (canvas.current === null || labels.current === null) return;
    let instance: CittaApi;
    const cambi: string[] = [];
    try {
      instance = createCitta({
        canvas: canvas.current,
        labels: labels.current,
        onSelect: (kind, id) => select.current(kind, id),
        onFallback: (motivo) => fallback.current(motivo),
        onLivello: (livello, _scelta, motivo) => {
          cambi.push(`${livello}: ${motivo}`);
          detailChanged.current?.(livello);
        },
        scelta: detail,
      });
    } catch (error) {
      fallback.current(`il browser non riesce a disegnare la città (${error instanceof Error ? error.message : String(error)})`);
      return;
    }
    api.current = instance;
    setReady(true);
    detailChanged.current?.(instance.livello());
    const probe: PlasticoProbe = {
      screenPosition: (id) => instance.screenPosition(id),
      focus: (id, distance) => instance.focus(id, distance),
      looks: () => looksRef.current(),
      preview: (l) => instance.setLots(l),
      selected: () => instance.selected(),
      frameIn: (id, area) => instance.frameIn(id, area),
      fps: () => instance.fps(),
      measured: null,
      ruota: (verso) => instance.ruota(verso),
      orientamento: () => instance.orientamento(),
      livello: () => instance.livello(),
      scegliLivello: (s) => instance.scegliLivello(s),
      info: () => instance.info(),
      tempi: () => instance.tempi(),
      azzeraTempi: () => instance.azzeraTempi(),
      angoli: () => instance.angoli(),
      luminosita: (a, b, c, d) => instance.luminosita(a, b, c, d),
      movimento: () => instance.movimento(),
      mostraCatalogo: () => instance.mostraCatalogo(),
      nascondi: (p) => instance.nascondi(p),
      campioneColori: (c) => instance.campioneColori(c),
      camera: () => instance.camera(),
      imposta: (ppm, o) => instance.imposta(ppm, o),
      guarda: (x, y, ppm) => instance.guarda(x, y, ppm),
      cambi,
    };
    window.taranto2127Plastico = probe;
    const timer = setTimeout(() => (probe.measured = instance.fps()), 5500);
    return () => {
      clearTimeout(timer);
      instance.dispose();
      api.current = null;
      if (window.taranto2127Plastico === probe) delete window.taranto2127Plastico;
    };
    // La scelta del livello si applica nell'effetto qui sotto, senza ricostruire la città.
  }, []);

  // Livello scelto in «Strati».
  useEffect(() => {
    if (ready && api.current !== null && api.current.info().scelta !== detail) api.current.scegliLivello(detail);
  }, [ready, detail]);

  // Aspetto dei lotti, dallo stato del motore.
  useEffect(() => {
    if (ready) {
      api.current?.setLots(looks());
      api.current?.setVita(vitaDaStato(state));
    }
  }, [ready, state]);

  // Ciò che è aperto in una finestra resta evidenziato e, dopo che la finestra si è disposta, in vista.
  useEffect(() => {
    if (!ready) return;
    api.current?.setSelected(selected);
    if (selected === null) return;
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (canvas.current !== null) api.current?.frameIn(selected, freeArea(canvas.current));
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [ready, selected]);

  // Strato colorato.
  useEffect(() => {
    if (!ready) return;
    if (layer === null) api.current?.setLayer(null);
    else {
      const names = Object.fromEntries(Object.entries(content.texts.districts).map(([id, t]) => [id, t.nome]));
      api.current?.setLayer({ values: layerValues(state, layer) as Record<DistrictId, ReturnType<typeof layerValues>[DistrictId]>, names });
    }
  }, [ready, layer, state]);

  return (
    <div className="plastico" data-testid="plastico">
      <canvas ref={canvas} className="plastico-canvas" aria-label="Città isometrica della zona dei Tamburi e dello stabilimento" data-testid="mappa-3d" />
      <div ref={labels} className="plastico-labels" aria-hidden="true" />
      {!ready && <p className="plastico-loading">Preparo la città…</p>}
      {ready && (
        <div className="map-controls" role="group" aria-label="Vista della città">
          <button type="button" onClick={() => api.current?.ingrandisci(1.6)} aria-label="Avvicina" data-testid="vista-avvicina">
            +
          </button>
          <button type="button" onClick={() => api.current?.ingrandisci(1 / 1.6)} aria-label="Allontana" data-testid="vista-allontana">
            −
          </button>
          <button type="button" onClick={() => api.current?.ruota(1)} aria-label="Ruota la vista di un quarto di giro" data-testid="vista-ruota">
            ⟳
          </button>
        </div>
      )}
      <p className="attribution" data-testid="attribuzione">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{geo.attribuzione.split('.')[0]}</a> · ODbL
      </p>
    </div>
  );
}
