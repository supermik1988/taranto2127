/**
 * Pezzi della disposizione a tutto schermo (T11): la finestra che si apre
 * sopra la mappa, il pannello degli strati, l'elenco testuale con ogni
 * informazione della mappa, la scelta tra plastico 3D e mappa schematica.
 */
import { Riserva } from './errori.js';
import { fmt } from '@taranto2127/play/describe';
import { DISTRICT_IDS, type DistrictId, type GameState } from '@taranto2127/sim';
import { Suspense, lazy, type ReactNode } from 'react';
import { PATH_NAMES } from './cards.js';
import { content } from './engine.js';
import { INDICATOR_LABELS, MapLegend, TarantoMap, type MapIndicator } from './map.js';
import { NOMI_LIVELLI, type Livello, type Scelta } from './iso/livelli.js';
import { LOT_LOOK_NAMES, layerValues, lotLook } from './plastico/looks.js';

/** Il plastico si carica a parte: three.js e i dati geografici non pesano sulla prima schermata. */
const Plastico = lazy(() => import('./plastico/Plastico.js'));

// ---------- Plastico o mappa schematica ----------

export type MapMode = 'plastico' | 'schematica';
const MODE_KEY = 'taranto2127:mappa';

/**
 * Quale mappa mostrare: l'indirizzo vince (?mappa=schematica o ?mappa=plastico),
 * poi la scelta salvata, poi il plastico se il browser sa disegnare in 3D.
 */
export function chooseMapMode(search: string, stored: string | null, webgl: boolean): MapMode {
  const asked = new URLSearchParams(search).get('mappa');
  if (asked === 'schematica' || asked === 'plastico') return asked;
  if (stored === 'schematica') return 'schematica';
  return webgl ? 'plastico' : 'schematica';
}

/** true se il browser può creare un contesto WebGL. */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null || canvas.getContext('webgl') !== null;
  } catch {
    return false;
  }
}

export function readStoredMode(): string | null {
  try {
    return localStorage.getItem(MODE_KEY);
  } catch {
    return null;
  }
}

const DETAIL_KEY = 'taranto2127:dettaglio';

/** Livello di dettaglio scelto e salvato (automatico se non c'è). */
export function readStoredDetail(): Scelta {
  try {
    const v = localStorage.getItem(DETAIL_KEY);
    return v === 'alto' || v === 'medio' || v === 'basso' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function storeDetail(detail: Scelta): void {
  try {
    localStorage.setItem(DETAIL_KEY, detail);
  } catch {
    // archivio non disponibile: la scelta vale per questa visita
  }
}

export function storeMode(mode: MapMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // archivio non disponibile: la scelta vale per questa visita
  }
}

/** La mappa a tutto schermo: plastico 3D o, di riserva, la mappa schematica. */
export function MapStage({
  mode,
  state,
  layer,
  selected,
  detail,
  onSelect,
  onFallback,
  onDetail,
}: {
  mode: MapMode;
  state: GameState;
  layer: MapIndicator | null;
  selected: string | null;
  detail: Scelta;
  onSelect: (kind: 'district' | 'lot', id: string) => void;
  onFallback: (reason: string) => void;
  onDetail: (livello: Livello) => void;
}) {
  return (
    <div className="map-stage" data-tour="mappa" data-testid="mappa-palco">
      {mode === 'plastico' ? (
        // Un errore nella città 3D non ferma il gioco: si ripiega sulla mappa schematica (T12d).
        <Riserva onErrore={onFallback}>
          <Suspense fallback={<p className="plastico-loading">Preparo la città…</p>}>
            <Plastico state={state} layer={layer} selected={selected} detail={detail} onSelect={onSelect} onFallback={onFallback} onDetail={onDetail} />
          </Suspense>
        </Riserva>
      ) : (
        <div className="schematic">
          <TarantoMap state={state} indicator={layer ?? 'airQuality'} selected={selected} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}

// ---------- Finestra sopra la mappa ----------

/** Finestra sopra la mappa: sale dal basso sul telefono, si affianca sullo schermo largo; un tocco fuori la chiude. */
export function MapWindow({ title, onClose, children, testId }: { title: string; onClose: () => void; children: ReactNode; testId?: string }) {
  return (
    <>
      <button type="button" className="window-outside" aria-label="Chiudi la finestra" onClick={onClose} data-testid="finestra-fuori" tabIndex={-1} />
      <section className="map-window" role="dialog" aria-label={title} data-testid={testId ?? 'finestra'}>
        <header className="card-head window-head">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} data-testid="finestra-chiudi">Chiudi</button>
        </header>
        <div className="window-body">{children}</div>
      </section>
    </>
  );
}

// ---------- Strati ----------

export function LayersPanel({
  state,
  layer,
  mode,
  detail = 'auto',
  detailNow = null,
  onLayer,
  onMode,
  onDetail = () => undefined,
}: {
  state: GameState;
  layer: MapIndicator | null;
  mode: MapMode;
  /** Livello di dettaglio scelto e livello in uso (null se la città non è ancora pronta). */
  detail?: Scelta;
  detailNow?: Livello | null;
  onLayer: (layer: MapIndicator | null) => void;
  onMode: (mode: MapMode) => void;
  onDetail?: (detail: Scelta) => void;
}) {
  const shown = layer ?? 'airQuality';
  const values = layerValues(state, shown);
  return (
    <div data-testid="strati">
      <p className="note">Colora i quartieri secondo un indicatore. Il numero è il valore da 0 a 100.</p>
      <div className="chips" role="group" aria-label="Strato della mappa">
        {mode === 'plastico' && (
          <button type="button" className={layer === null ? 'chip on' : 'chip'} aria-pressed={layer === null} onClick={() => onLayer(null)} data-testid="strato-spento">
            Spento
          </button>
        )}
        {(Object.keys(INDICATOR_LABELS) as MapIndicator[]).map((ind) => (
          <button key={ind} type="button" className={ind === layer ? 'chip on' : 'chip'} aria-pressed={ind === layer} onClick={() => onLayer(ind)} data-testid={`strato-${ind}`}>
            {INDICATOR_LABELS[ind]}
          </button>
        ))}
      </div>
      <MapLegend indicator={shown} />
      <table className="layer-table" data-testid="valori-strato">
        <tbody>
          {DISTRICT_IDS.map((id) => (
            <tr key={id}>
              <th scope="row">
                <span className="swatch" style={{ background: values[id].color }} aria-hidden="true" /> {content.texts.districts[id]?.nome}
              </th>
              <td data-testid={`valore-strato-${id}`}>{Math.round(values[id].value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {mode === 'plastico' && <p className="note">Paolo VI e le borgate sono fuori dalla zona della città 3D: i loro valori sono qui e nell'elenco.</p>}
      <h3>Mappa</h3>
      <div className="buttons wrap">
        <button type="button" className={mode === 'plastico' ? 'primary' : ''} aria-pressed={mode === 'plastico'} onClick={() => onMode('plastico')} data-testid="modo-plastico">
          Città 3D
        </button>
        <button type="button" className={mode === 'schematica' ? 'primary' : ''} aria-pressed={mode === 'schematica'} onClick={() => onMode('schematica')} data-testid="modo-schematica">
          Mappa schematica
        </button>
      </div>
      {mode === 'plastico' && (
        <>
          <h3>Dettaglio della città</h3>
          <div className="chips" role="group" aria-label="Dettaglio della città">
            {(['auto', 'alto', 'medio', 'basso'] as Scelta[]).map((d) => (
              <button key={d} type="button" className={d === detail ? 'chip on' : 'chip'} aria-pressed={d === detail} onClick={() => onDetail(d)} data-testid={`dettaglio-${d}`}>
                {NOMI_LIVELLI[d]}
              </button>
            ))}
          </div>
          <p className="note" data-testid="dettaglio-ora">
            {detailNow === null ? 'La città si sta preparando.' : `In uso: ${NOMI_LIVELLI[detailNow].toLowerCase()}.`} In automatico il gioco scende di livello da solo se il dispositivo fatica.
          </p>
        </>
      )}
    </div>
  );
}

// ---------- Elenco testuale ----------

const QUANTITY_NAMES: Record<string, string> = {
  airQuality: 'aria',
  cumulativeExposure: 'esposizione',
  health: 'salute',
  services: 'servizi',
  tension: 'tensione',
  trust: 'fiducia',
};
const PHASES: Record<string, string> = { design: 'progettazione', permitting: 'autorizzazioni', tender: 'gara', works: 'lavori', operating: 'esercizio' };

/** Ogni informazione della mappa, in testo: quartieri con i loro valori, lotti con strada, fase e aspetto. */
export function MapList({ state, onSelect }: { state: GameState; onSelect: (kind: 'district' | 'lot', id: string) => void }) {
  return (
    <div data-testid="elenco">
      <h3>Quartieri</h3>
      <ul className="map-list">
        {DISTRICT_IDS.map((id: DistrictId) => {
          const d = state.districts[id];
          return (
            <li key={id}>
              <button type="button" className="link-button" onClick={() => onSelect('district', id)} data-testid={`elenco-quartiere-${id}`}>
                {content.texts.districts[id]?.nome}
              </button>
              <span className="note">
                {' '}
                {Object.entries(QUANTITY_NAMES)
                  .map(([q, name]) => `${name} ${Math.round(d[q as keyof typeof d] as number)}`)
                  .join(' · ')}
              </span>
            </li>
          );
        })}
      </ul>
      <h3>Lotti di ILSIDER</h3>
      <ul className="map-list">
        {state.plantLots.map((lot) => {
          const project = state.projects.find((p) => p.lotId === lot.id && p.phase !== 'cancelled');
          return (
            <li key={lot.id}>
              <button type="button" className="link-button" onClick={() => onSelect('lot', lot.id)} data-testid={`elenco-lotto-${lot.id}`}>
                {content.texts.plantLots[lot.id]?.nome}
              </button>
              <span className="note" data-testid={`elenco-aspetto-${lot.id}`}>
                {' '}
                strada: {PATH_NAMES[lot.path]}
                {project !== undefined && project.phase !== 'operating' && ` · ${PHASES[project.phase]}, ${project.turnsLeftInPhase} anni alla fine della fase`}
                {lot.path !== 'idle' && ` · avanzamento ${fmt(lot.progress * 100)}%`} · sul plastico: {LOT_LOOK_NAMES[lotLook(state, lot.id)]}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
