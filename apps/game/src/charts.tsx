/** Grafici dal 2027 all'anno corrente, con i cambi d'epoca. */
import { DISTRICT_IDS, TURNS_PER_EPOCH } from '@taranto2127/sim';
import { useState } from 'react';
import { QUANTITIES, content, type Quantity, type Snapshot } from './engine.js';

type Series = { name: string; short: string; values: number[]; dash?: string };
type Group = Quantity | 'lavoro' | 'fondi';

const QUANTITY_LABELS: Record<Quantity, string> = {
  airQuality: 'Aria',
  cumulativeExposure: 'Esposizione',
  health: 'Salute',
  services: 'Servizi',
  tension: 'Tensione',
  trust: 'Fiducia',
};
const COLORS = ['#1f4e8c', '#b3261e', '#6f6a2e', '#4f86a6', '#7a4f8a', '#2f7d5b'];
const DASHES = ['', '6 3', '2 3', '8 3 2 3', '4 4', '1 2'];

function seriesFor(group: Group, timeline: Snapshot[]): { series: Series[]; unit: string; fixedMax?: number } {
  if (group === 'lavoro') {
    return {
      unit: 'persone',
      series: [
        { name: 'Occupati', short: 'Occ.', values: timeline.map((s) => s.employed) },
        { name: 'Cassa integrati', short: 'Cassa', values: timeline.map((s) => s.onWageSupport) },
        { name: 'Disoccupati', short: 'Disocc.', values: timeline.map((s) => s.unemployed) },
      ],
    };
  }
  if (group === 'fondi') {
    return {
      unit: 'milioni di euro',
      series: [
        { name: 'Fondi propri', short: 'Propri', values: timeline.map((s) => s.own) },
        { name: 'Fondo statale', short: 'Stato', values: timeline.map((s) => s.state) },
        { name: 'Fondo europeo', short: 'UE', values: timeline.map((s) => s.eu) },
      ],
    };
  }
  return {
    unit: 'da 0 a 100',
    fixedMax: 100,
    series: DISTRICT_IDS.map((id) => {
      const name = content.texts.districts[id]?.nome ?? id;
      return { name, short: name.split(/[ ,]/)[0]!, values: timeline.map((s) => s.districts[id][group]) };
    }),
  };
}

function LineChart({ series, timeline, fixedMax }: { series: Series[]; timeline: Snapshot[]; fixedMax?: number }) {
  const w = 360;
  const h = 220;
  const left = 40;
  const right = 52;
  const top = 10;
  const bottom = 26;
  const turns = timeline.map((s) => s.turn);
  const lastTurn = Math.max(1, turns.at(-1) ?? 1);
  const all = series.flatMap((s) => s.values);
  const min = fixedMax === undefined ? Math.min(0, ...all) : 0;
  const max = fixedMax ?? Math.max(1, ...all);
  const x = (turn: number) => left + (turn / lastTurn) * (w - left - right);
  const y = (v: number) => top + (1 - (v - min) / (max - min || 1)) * (h - top - bottom);
  const epochs = [1, 2, 3, 4].map((e) => e * TURNS_PER_EPOCH).filter((t) => t <= lastTurn);
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Andamento dal 2027">
      <line x1={left} y1={y(min)} x2={w - right} y2={y(min)} stroke="#8a857a" />
      <line x1={left} y1={top} x2={left} y2={y(min)} stroke="#8a857a" />
      <text x={left - 4} y={top + 10} className="axis" textAnchor="end">{Math.round(max)}</text>
      <text x={left - 4} y={y(min)} className="axis" textAnchor="end">{Math.round(min)}</text>
      <text x={left} y={h - 6} className="axis">2027</text>
      <text x={w - right} y={h - 6} className="axis" textAnchor="end">{2027 + lastTurn}</text>
      {epochs.map((t) => (
        <g key={t}>
          <line x1={x(t)} y1={top} x2={x(t)} y2={y(min)} stroke="#b3ad9f" strokeDasharray="3 3" />
          <text x={x(t) + 2} y={top + 10} className="axis">ep. {t / TURNS_PER_EPOCH + 1}</text>
        </g>
      ))}
      {series.map((s, i) => {
        const points = s.values.map((v, k) => `${x(turns[k]!)},${y(v)}`).join(' ');
        const lastV = s.values.at(-1) ?? 0;
        return (
          <g key={s.name}>
            <polyline points={points} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="2" strokeDasharray={DASHES[i % DASHES.length]} />
            <text x={w - right + 3} y={y(lastV) + 4 + (i % 2) * 2} className="axis" fill={COLORS[i % COLORS.length]}>{s.short}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function ChartsView({ timeline }: { timeline: Snapshot[] }) {
  const [group, setGroup] = useState<Group>('airQuality');
  const { series, unit, fixedMax } = seriesFor(group, timeline);
  const groups: [Group, string][] = [...QUANTITIES.map((q) => [q, QUANTITY_LABELS[q]] as [Group, string]), ['lavoro', 'Lavoro'], ['fondi', 'Fondi']];
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
      <LineChart series={series} timeline={timeline} {...(fixedMax !== undefined && { fixedMax })} />
      <ul className="chart-legend">
        {series.map((s, i) => (
          <li key={s.name}>
            <svg width="28" height="10" aria-hidden="true">
              <line x1="0" y1="5" x2="28" y2="5" stroke={COLORS[i % COLORS.length]} strokeWidth="2" strokeDasharray={DASHES[i % DASHES.length]} />
            </svg>
            {s.name}: {Math.round(s.values.at(-1) ?? 0).toLocaleString('it-IT')}
          </li>
        ))}
      </ul>
      <p className="note">Valori in {unit}. Le linee tratteggiate verticali segnano i cambi d'epoca.</p>
    </section>
  );
}
