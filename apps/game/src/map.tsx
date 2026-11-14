/**
 * Mappa schematica di Taranto: non in scala, ma con le posizioni relative vere.
 * Mar Grande a ovest, Mar Piccolo a nord-est, la Città Vecchia sull'isola fra i
 * due mari con i suoi due ponti, il Borgo a sud-est, le borgate a sud, i Tamburi
 * a nord accanto allo stabilimento, Paolo VI più a nord, l'area industriale a
 * nord-ovest con i sei lotti di ILSIDER.
 */
import type { ActivePath, DistrictId, GameState } from '@taranto2127/sim';
import { content } from './engine.js';

export type MapIndicator = 'airQuality' | 'health' | 'trust' | 'tension';

export const INDICATOR_LABELS: Record<MapIndicator, string> = {
  airQuality: 'Aria',
  health: 'Salute',
  trust: 'Fiducia',
  tension: 'Tensione',
};

/** Colore di un valore da 0 a 100: ocra = male, verde acqua = bene. Per la tensione la scala si inverte. */
export function indicatorColor(value: number, indicator: MapIndicator): string {
  const good = indicator === 'tension' ? 100 - value : value;
  const t = Math.max(0, Math.min(1, good / 100));
  const bad = [201, 139, 74];
  const mid = [239, 230, 207];
  const ok = [79, 143, 127];
  const mix = (a: number[], b: number[], k: number) => a.map((x, i) => Math.round(x + (b[i]! - x) * k));
  const [r, g, b] = t < 0.5 ? mix(bad, mid, t * 2) : mix(mid, ok, (t - 0.5) * 2);
  return `rgb(${r}, ${g}, ${b})`;
}

interface Area {
  id: DistrictId;
  path: string;
  label: [number, number];
}

const DISTRICTS: Area[] = [
  { id: 'area-industriale', path: 'M8,70 L150,62 L168,150 L158,232 L112,262 L8,262 Z', label: [84, 236] },
  { id: 'tamburi', path: 'M158,232 L168,150 L214,160 L210,238 L176,256 Z', label: [188, 205] },
  { id: 'paolo-vi', path: 'M150,62 L292,40 L300,118 L222,140 L168,150 Z', label: [226, 92] },
  { id: 'citta-vecchia', path: 'M168,282 L204,272 L212,288 L176,300 Z', label: [190, 287] },
  { id: 'borgo', path: 'M214,300 L272,286 L304,312 L300,382 L218,392 L206,330 Z', label: [256, 342] },
  { id: 'talsano-lama-san-vito', path: 'M218,404 L302,394 L392,412 L392,560 L250,560 L206,500 Z', label: [300, 478] },
];

const SEAS = {
  marGrande: 'M0,262 L112,262 L158,276 L166,296 L200,312 L198,360 L190,430 L206,500 L250,560 L0,560 Z',
  marPiccolo: 'M210,238 L214,160 L300,118 L392,128 L392,300 L332,282 L304,312 L272,286 L216,276 Z',
};

/** Lotti dentro l'area industriale, tre colonne per due righe: i parchi minerali verso i Tamburi, le banchine verso il mare. */
const LOTS: { id: string; x: number; y: number }[] = [
  { id: 'lotto-laminatoi', x: 18, y: 98 },
  { id: 'lotto-altoforni', x: 66, y: 98 },
  { id: 'lotto-cokerie', x: 114, y: 98 },
  { id: 'lotto-banchine', x: 18, y: 158 },
  { id: 'lotto-acciaieria', x: 66, y: 158 },
  { id: 'lotto-parchi-minerali', x: 114, y: 158 },
];
const LOT_W = 44;
const LOT_H = 54;

const PATH_STYLE: Record<ActivePath | 'idle', { fill: string; code: string }> = {
  idle: { fill: '#9a958a', code: 'F' },
  'green-steel': { fill: '#6c7a96', code: 'AV' },
  remediation: { fill: '#a7845a', code: 'BO' },
  energy: { fill: '#6f9a5e', code: 'EN' },
  'sea-culture': { fill: '#4f86a6', code: 'MC' },
};
const PHASE_CODE: Record<string, string> = { design: 'P', permitting: 'A', tender: 'G', works: 'L', operating: 'E' };

export const LOT_LEGEND = [
  ['F', 'fermo'],
  ['AV', 'acciaio verde'],
  ['BO', 'bonifica'],
  ['EN', 'energia'],
  ['MC', 'mare e cultura'],
] as const;
export const PHASE_LEGEND = 'P progettazione · A autorizzazioni · G gara · L lavori · E esercizio';

export function lotCode(state: GameState, lotId: string): { code: string; detail: string; fill: string; remediated: boolean } {
  const lot = state.plantLots.find((l) => l.id === lotId)!;
  const style = PATH_STYLE[lot.path];
  const project = state.projects.find((p) => p.lotId === lot.id && p.phase !== 'cancelled');
  const phase = project === undefined ? '' : (PHASE_CODE[project.phase] ?? '');
  const detail = lot.path === 'idle' ? (lot.remediated ? 'bonificato' : '') : `${phase} ${Math.round(lot.progress * 100)}%`;
  return { code: style.code, detail: detail.trim(), fill: style.fill, remediated: lot.remediated };
}

export interface MapProps {
  state: GameState;
  indicator: MapIndicator;
  selected: string | null;
  onSelect: (kind: 'district' | 'lot', id: string) => void;
}

export function TarantoMap({ state, indicator, selected, onSelect }: MapProps) {
  const name = (id: DistrictId) => content.texts.districts[id]?.nome ?? id;
  return (
    <svg className="map" viewBox="0 0 392 560" role="img" aria-label="Mappa schematica di Taranto" data-testid="mappa">
      <rect x="0" y="0" width="392" height="560" fill="#ece6d6" />
      <path d={SEAS.marGrande} fill="#c9dde6" />
      <path d={SEAS.marPiccolo} fill="#c9dde6" />
      <text x="40" y="420" className="sea-label">Mar Grande</text>
      <text x="300" y="220" className="sea-label">Mar Piccolo</text>
      {DISTRICTS.map((area) => {
        const value = state.districts[area.id][indicator];
        const isSelected = selected === area.id;
        return (
          <g
            key={area.id}
            className="area"
            role="button"
            tabIndex={0}
            aria-label={`${name(area.id)}: ${INDICATOR_LABELS[indicator]} ${Math.round(value)}`}
            data-testid={`quartiere-${area.id}`}
            onClick={() => onSelect('district', area.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect('district', area.id)}
          >
            <path d={area.path} fill={indicatorColor(value, indicator)} stroke={isSelected ? '#1d1d1f' : '#6b665a'} strokeWidth={isSelected ? 3 : 1} />
            {area.id !== 'area-industriale' && area.id !== 'citta-vecchia' && (
              <text x={area.label[0]} y={area.label[1] - 9} className="area-name">{name(area.id).split(',')[0]}</text>
            )}
            <text x={area.label[0]} y={area.id === 'citta-vecchia' ? area.label[1] + 4 : area.label[1] + 11} className="area-value">
              {Math.round(value)}
            </text>
          </g>
        );
      })}
      {/* I due ponti della Città Vecchia: Porta Napoli a nord-ovest, il ponte girevole a sud-est. */}
      <line x1="170" y1="282" x2="160" y2="266" stroke="#5c574c" strokeWidth="3" />
      <line x1="210" y1="290" x2="216" y2="302" stroke="#5c574c" strokeWidth="3" />
      <text x="146" y="316" className="small-label">Città Vecchia</text>
      <text x="12" y="84" className="small-label">Area industriale · lotti di ILSIDER</text>
      {LOTS.map((lot) => {
        const info = lotCode(state, lot.id);
        const isSelected = selected === lot.id;
        return (
          <g
            key={lot.id}
            className="area"
            role="button"
            tabIndex={0}
            aria-label={`Lotto ${content.texts.plantLots[lot.id]?.nome ?? lot.id}: ${info.code} ${info.detail}`}
            data-testid={`lotto-${lot.id}`}
            onClick={() => onSelect('lot', lot.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect('lot', lot.id)}
          >
            <rect x={lot.x} y={lot.y} width={LOT_W} height={LOT_H} rx="3" fill={info.fill} stroke={isSelected ? '#1d1d1f' : '#f7f5f0'} strokeWidth={isSelected ? 3 : 1.5} />
            <text x={lot.x + LOT_W / 2} y={lot.y + 20} className="lot-code">{info.code}</text>
            <text x={lot.x + LOT_W / 2} y={lot.y + 36} className="lot-detail">{info.detail}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function MapLegend({ indicator }: { indicator: MapIndicator }) {
  const stops = [0, 25, 50, 75, 100];
  const better = indicator === 'tension' ? 'più bassa è meglio' : 'più alto è meglio';
  return (
    <div className="legend" data-testid="legenda">
      <div className="legend-scale">
        {stops.map((v) => (
          <span key={v} style={{ background: indicatorColor(v, indicator) }}>{v}</span>
        ))}
      </div>
      <p className="legend-note">{INDICATOR_LABELS[indicator]} da 0 a 100, {better}. Ogni area mostra il suo valore.</p>
      <p className="legend-note">
        Lotti: {LOT_LEGEND.map(([c, l]) => `${c} ${l}`).join(' · ')}. Fase: {PHASE_LEGEND}.
      </p>
    </div>
  );
}
