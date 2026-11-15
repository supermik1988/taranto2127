/**
 * Il plastico nella pagina. Questo modulo, three.js e plastico.json si
 * caricano a parte (React.lazy in App.tsx): la prima schermata non aspetta il 3D.
 */
import type { DistrictId, GameState } from '@taranto2127/sim';
import { useEffect, useRef, useState } from 'react';
import { content } from '../engine.js';
import type { MapIndicator } from '../map.js';
import { geo } from './data.js';
import { layerValues, lotLook, type LotLook } from './looks.js';
import { createPlastico, type PlasticoApi } from './scene.js';

/** Sotto questa soglia, misurata dopo il riscaldamento, il dispositivo non regge il 3D. */
export const MIN_FPS = 20;
const WARMUP_MS = 2500;
const MEASURE_MS = 3000;

/** Interfaccia per la verifica automatica: posizione sullo schermo, aspetto dei lotti, immagini al secondo. */
export interface PlasticoProbe {
  screenPosition(id: string): { x: number; y: number } | null;
  focus(id: string, distance?: number): void;
  looks(): Record<string, LotLook>;
  /** Solo per le prove visive: mostra aspetti diversi da quelli della partita, fino al prossimo cambiamento dello stato. */
  preview(looks: Record<string, LotLook>): void;
  fps(): number;
  measured: number | null;
}

declare global {
  interface Window {
    taranto2127Plastico?: PlasticoProbe;
  }
}

export default function Plastico({
  state,
  layer,
  onSelect,
  onFallback,
}: {
  state: GameState;
  /** Indicatore dello strato colorato, o null se spento. */
  layer: MapIndicator | null;
  onSelect: (kind: 'district' | 'lot', id: string) => void;
  /** Il 3D non va: si torna alla mappa schematica, con il motivo. */
  onFallback: (reason: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const api = useRef<PlasticoApi | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const fallback = useRef(onFallback);
  fallback.current = onFallback;
  const [ready, setReady] = useState(false);

  const looks = (): Record<string, LotLook> => Object.fromEntries(state.plantLots.map((l) => [l.id, lotLook(state, l.id)]));
  const looksRef = useRef(looks);
  looksRef.current = looks;

  useEffect(() => {
    if (canvas.current === null || labels.current === null) return;
    let instance: PlasticoApi;
    try {
      instance = createPlastico({ canvas: canvas.current, labels: labels.current, onSelect: (kind, id) => select.current(kind, id) });
    } catch (error) {
      fallback.current(`il browser non riesce a disegnare il plastico (${error instanceof Error ? error.message : String(error)})`);
      return;
    }
    api.current = instance;
    setReady(true);
    const probe: PlasticoProbe = {
      screenPosition: (id) => instance.screenPosition(id),
      focus: (id, distance) => instance.focus(id, distance),
      looks: () => looksRef.current(),
      preview: (looks) => instance.setLots(looks),
      fps: () => instance.fps(),
      measured: null,
    };
    window.taranto2127Plastico = probe;
    // Prestazioni: dopo il riscaldamento si misura; troppo lento, si passa alla mappa schematica.
    const timer = setTimeout(() => {
      const fps = instance.fps();
      probe.measured = fps;
      if (fps > 0 && fps < MIN_FPS) fallback.current(`il dispositivo disegna ${Math.round(fps)} immagini al secondo, troppo poche per il plastico`);
    }, WARMUP_MS + MEASURE_MS);
    return () => {
      clearTimeout(timer);
      instance.dispose();
      api.current = null;
      if (window.taranto2127Plastico === probe) delete window.taranto2127Plastico;
    };
  }, []);

  // Aspetto dei lotti, dallo stato del motore.
  useEffect(() => {
    if (ready) api.current?.setLots(looks());
  }, [ready, state]);

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
      <canvas ref={canvas} className="plastico-canvas" aria-label="Plastico 3D della zona dei Tamburi e dello stabilimento" data-testid="mappa-3d" />
      <div ref={labels} className="plastico-labels" aria-hidden="true" />
      {!ready && <p className="plastico-loading">Preparo il plastico…</p>}
      <p className="attribution" data-testid="attribuzione">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{geo.attribuzione.split('.')[0]}</a> · ODbL
      </p>
    </div>
  );
}
