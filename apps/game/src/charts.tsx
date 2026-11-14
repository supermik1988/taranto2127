/**
 * Grafici dal 2027 all'anno corrente, pensati prima per il telefono: scala
 * verticale adattata ai valori con margine, un quartiere in evidenza e gli
 * altri attenuati, la media cittadina tratteggiata, nomi solo nella legenda
 * sotto con la variazione dal 2027. Con meno di cinque anni di dati, un
 * messaggio al posto del grafico.
 */
import { DISTRICT_IDS, TURNS_PER_EPOCH, type DistrictId } from '@taranto2127/sim';
import { useState } from 'react';
import { QUANTITIES, cityAverage, content, type Quantity, type Snapshot } from './engine.js';

/** Anni di dati sotto i quali il grafico non dice ancora nulla. */
export const MIN_CHART_YEARS = 5;

type Group = Quantity | 'lavoro' | 'fondi';
type Style = 'focus' | 'muted' | 'average' | 'series';
interface Series {
  key: string;
  name: string;
  values: number[];
  style: Style;
  color: string;
}

export const QUANTITY_LABELS: Record<Quantity, string> = {
  airQuality: 'Aria',
  cumulativeExposure: 'Esposizione',
  health: 'Salute',
  services: 'Servizi',
  tension: 'Tensione',
  trust: 'Fiducia',
};
/** Tavolozza categorica di riferimento (validata per daltonismo), nell'ordine fisso. */
const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a'];
const FOCUS = '#2a78d6';
const MUTED = '#b8b5ad';
const INK = '#1d1d1f';

const districtName = (id: DistrictId) => content.texts.districts[id]?.nome ?? id;

function seriesFor(group: Group, timeline: Snapshot[], focus: DistrictId): { series: Series[]; unit: string; index: boolean } {
  if (group === 'lavoro') {
    const read: [string, string, (s: Snapshot) => number][] = [
      ['occupati', 'Occupati', (s) => s.employed],
      ['cassa', 'Cassa integrati', (s) => s.onWageSupport],
      ['disoccupati', 'Disoccupati', (s) => s.unemployed],
    ];
    return {
      unit: 'persone',
      index: false,
      series: read.map(([key, name, f], i) => ({ key, name, values: timeline.map(f), style: 'series', color: SERIES_COLORS[i]! })),
    };
  }
  if (group === 'fondi') {
    const read: [string, string, (s: Snapshot) => number][] = [
      ['own', content.guide.budget.fondi.own.nome, (s) => s.own],
      ['state', content.guide.budget.fondi.state.nome, (s) => s.state],
      ['eu', content.guide.budget.fondi['eu-earmarked'].nome, (s) => s.eu],
    ];
    return {
      unit: 'milioni di euro',
      index: false,
      series: read.map(([key, name, f], i) => ({ key, name, values: timeline.map(f), style: 'series', color: SERIES_COLORS[i]! })),
    };
  }
  const others: Series[] = DISTRICT_IDS.filter((id) => id !== focus).map((id) => ({
    key: id,
    name: districtName(id),
    values: timeline.map((s) => s.districts[id][group]),
    style: 'muted',
    color: MUTED,
  }));
  return {
    unit: 'punti da 0 a 100',
    index: true,
    series: [
      ...others,
      { key: 'media', name: 'Media della città', values: timeline.map((s) => cityAverage(s, group)), style: 'average', color: INK },
      { key: focus, name: districtName(focus), values: timeline.map((s) => s.districts[focus][group]), style: 'focus', color: FOCUS },
    ],
  };
}

/** Passo "tondo" per le tacche dell'asse: 1, 2, 5 per potenze di dieci. */
function niceStep(range: number, ticks: number): number {
  const raw = range / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

/**
 * Scala verticale dai valori, con un margine sopra e sotto; per gli indici
 * resta dentro 0-100 e non scende sotto un intervallo di 10 punti.
 */
export function verticalScale(values: number[], index: boolean): { min: number; max: number; ticks: number[] } {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const minRange = index ? 10 : Math.max(1, Math.abs(hi) * 0.1);
  if (hi - lo < minRange) {
    const mid = (hi + lo) / 2;
    lo = mid - minRange / 2;
    hi = mid + minRange / 2;
  }
  const pad = (hi - lo) * 0.12;
  lo -= pad;
  hi += pad;
  if (index) {
    lo = Math.max(0, lo);
    hi = Math.min(100, hi);
  }
  const step = niceStep(hi - lo, 4);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return { min, max, ticks };
}

const formatTick = (v: number) => Math.round(v).toLocaleString('it-IT');

function LineChart({ series, timeline, index }: { series: Series[]; timeline: Snapshot[]; index: boolean }) {
  const w = 360;
  const h = 210;
  const left = 46;
  const right = 10;
  const top = 10;
  const bottom = 24;
  const turns = timeline.map((s) => s.turn);
  const first = turns[0] ?? 0;
  const lastTurn = Math.max(first + 1, turns.at(-1) ?? 1);
  const { min, max, ticks } = verticalScale(series.flatMap((s) => s.values), index);
  const x = (turn: number) => left + ((turn - first) / (lastTurn - first)) * (w - left - right);
  const y = (v: number) => top + (1 - (v - min) / (max - min || 1)) * (h - top - bottom);
  const epochs = [1, 2, 3, 4].map((e) => e * TURNS_PER_EPOCH).filter((t) => t > first && t <= lastTurn);
  const width: Record<Style, number> = { focus: 3, series: 2, average: 2, muted: 1.5 };
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Andamento dal 2027" data-testid="grafico">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} y1={y(t)} x2={w - right} y2={y(t)} stroke="#e6e1d6" />
          <text x={left - 6} y={y(t) + 4} className="axis" textAnchor="end">{formatTick(t)}</text>
        </g>
      ))}
      {epochs.map((t) => (
        <line key={t} x1={x(t)} y1={top} x2={x(t)} y2={h - bottom} stroke="#b3ad9f" strokeDasharray="3 3" />
      ))}
      <text x={left} y={h - 6} className="axis">{2027 + first}</text>
      <text x={w - right} y={h - 6} className="axis" textAnchor="end">{2027 + lastTurn}</text>
      {series.map((s) => (
        <polyline
          key={s.key}
          points={s.values.map((v, k) => `${x(turns[k]!)},${y(v)}`).join(' ')}
          fill="none"
          stroke={s.color}
          strokeWidth={width[s.style]}
          strokeDasharray={s.style === 'average' ? '6 4' : undefined}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={s.style === 'muted' ? 0.7 : 1}
        />
      ))}
    </svg>
  );
}

const signed = (v: number, digits: number) => {
  const r = Number(v.toFixed(digits));
  return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r).toLocaleString('it-IT', { maximumFractionDigits: digits })}`;
};

function LegendSwatch({ s }: { s: Series }) {
  return (
    <svg width="28" height="12" aria-hidden="true">
      <line
        x1="2"
        y1="6"
        x2="26"
        y2="6"
        stroke={s.color}
        strokeWidth={s.style === 'focus' ? 3 : 2}
        strokeDasharray={s.style === 'average' ? '6 4' : undefined}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChartsView({ timeline }: { timeline: Snapshot[] }) {
  const [group, setGroup] = useState<Group>('airQuality');
  const [focus, setFocus] = useState<DistrictId>('tamburi');
  const { series, unit, index } = seriesFor(group, timeline, focus);
  const groups: [Group, string][] = [...QUANTITIES.map((q) => [q, QUANTITY_LABELS[q]] as [Group, string]), ['lavoro', 'Lavoro'], ['fondi', 'Fondi']];
  const enough = timeline.length >= MIN_CHART_YEARS;
  const digits = index ? 1 : 0;
  // Legenda: prima il quartiere in evidenza e la media, poi gli altri.
  const legend = [...series].reverse();
  return (
    <section className="panel" data-testid="grafici">
      <h2>Andamento</h2>
      <div className="chips" role="group" aria-label="Che cosa mostrare">
        {groups.map(([g, label]) => (
          <button key={g} type="button" className={g === group ? 'chip on' : 'chip'} aria-pressed={g === group} onClick={() => setGroup(g)}>
            {label}
          </button>
        ))}
      </div>
      {index && (
        <label className="select">
          Quartiere in evidenza{' '}
          <select value={focus} onChange={(e) => setFocus(e.target.value as DistrictId)} data-testid="quartiere-in-evidenza">
            {DISTRICT_IDS.map((id) => <option key={id} value={id}>{districtName(id)}</option>)}
          </select>
        </label>
      )}
      {enough ? (
        <>
          <LineChart series={series} timeline={timeline} index={index} />
          <ul className="chart-legend" data-testid="legenda-grafico">
            {legend.map((s) => {
              const now = s.values.at(-1) ?? 0;
              const start = s.values[0] ?? 0;
              return (
                <li key={s.key} className={s.style === 'muted' ? 'muted' : ''}>
                  <LegendSwatch s={s} />
                  <span className="legend-name">{s.name}</span>
                  <span className="legend-value">
                    {now.toLocaleString('it-IT', { maximumFractionDigits: digits })}{' '}
                    <span className="legend-change">({signed(now - start, digits)} dal 2027)</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="note">Valori in {unit}. Le linee verticali tratteggiate segnano i cambi d'epoca.</p>
        </>
      ) : (
        <p className="empty-chart" data-testid="grafico-attesa">
          Il grafico compare dopo {MIN_CHART_YEARS} anni di dati: per ora ce {timeline.length === 1 ? "n'è uno" : `ne sono ${timeline.length}`}. Avanza nel tempo e torna qui.
        </p>
      )}
    </section>
  );
}

/** Mini andamento per la scheda del quartiere. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return <p className="note" data-testid="mini-andamento">L'andamento comparirà dopo il primo anno.</p>;
  const w = 140;
  const h = 36;
  const { min, max } = verticalScale(values, true);
  const x = (k: number) => 2 + (k / (values.length - 1)) * (w - 4);
  const y = (v: number) => 2 + (1 - (v - min) / (max - min || 1)) * (h - 4);
  const change = (values.at(-1) ?? 0) - (values[0] ?? 0);
  return (
    <div className="spark" data-testid="mini-andamento">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label}: andamento dal 2027`}>
        <polyline points={values.map((v, k) => `${x(k)},${y(v)}`).join(' ')} fill="none" stroke={FOCUS} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(values.length - 1)} cy={y(values.at(-1)!)} r="3" fill={FOCUS} />
      </svg>
      <span className="note">{signed(change, 1)} dal 2027</span>
    </div>
  );
}
