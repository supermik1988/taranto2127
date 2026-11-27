/** Schede, carte e pannelli dell'interfaccia. Lo stato di gioco si legge soltanto: le azioni passano dal genitore. */
import { adviseCouncil } from '@taranto2127/agents';
import { describeOption, describePolicy, describeProject, fmt, projectForecast } from '@taranto2127/play/describe';
import {
  BUILD_PHASES,
  averageTrust,
  explainDistrict,
  officeCapacity,
  type ExplainedQuantity,
  yearOfTurn,
  type Action,
  type ActivePath,
  type DistrictId,
  type GameState,
  type Project,
  type ProjectPhase,
} from '@taranto2127/sim';
import { useMemo, useState } from 'react';
import { Sparkline } from './charts.js';
import { content, type Snapshot } from './engine.js';
import { Term, fill as fillText } from './guide.js';

export type Request = (action: Action, title: string, lines: string[]) => void;

const PATHS: ActivePath[] = ['green-steel', 'remediation', 'energy', 'sea-culture'];
export const PATH_NAMES: Record<ActivePath | 'idle', string> = {
  idle: 'fermo',
  'green-steel': 'acciaio verde',
  remediation: 'bonifica',
  energy: 'energia rinnovabile',
  'sea-culture': 'mare e cultura',
};
const PHASE_NAMES: Record<ProjectPhase, string> = {
  design: 'progettazione',
  permitting: 'autorizzazioni',
  tender: 'gara',
  works: 'lavori',
  operating: 'esercizio',
  cancelled: 'annullato',
};

const signed = (v: number) => `${v > 0 ? '+' : ''}${fmt(v, 1)}`;
const years = (n: number) => `${n} ${n === 1 ? 'anno' : 'anni'}`;
const arrow = (before: number | undefined, now: number) =>
  before === undefined ? '' : now - before > 0.05 ? '↑' : before - now > 0.05 ? '↓' : '=';
const projectName = (id: string) => content.texts.projects[id]?.nome ?? id;
const lotName = (id: string) => content.texts.plantLots[id]?.nome ?? id;
const fill = (t: string, values: Record<string, string>) => fillText(t, values);
/** Voce del glossario per ogni grandezza del quartiere. */
const QUANTITY_TERMS: Partial<Record<ExplainedQuantity, string>> = {
  cumulativeExposure: 'esposizione',
  trust: 'fiducia',
  tension: 'tensione',
  services: 'servizi',
};

// ---------- Conferma ----------

export function ConfirmSheet(props: { title: string; lines: string[]; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={props.title} data-testid="conferma">
      <div className="sheet">
        <h2>{props.title}</h2>
        {props.lines.map((line, i) => (
          <p key={i} className={line.startsWith('  ') ? 'detail' : ''}>{line.trim()}</p>
        ))}
        <div className="buttons">
          <button type="button" className="primary" onClick={props.onConfirm} data-testid="conferma-si">Conferma</button>
          <button type="button" onClick={props.onCancel}>Annulla</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Quartiere ----------

export function DistrictCard({
  state,
  prev,
  id,
  initial = 'airQuality',
  timeline = [],
  onClose,
}: {
  state: GameState;
  prev: GameState | undefined;
  id: DistrictId;
  /** Linea del tempo, per il mini andamento. */
  timeline?: Snapshot[];
  /** Indicatore di cui mostrare per primo i fattori: quello scelto sulla mappa. */
  initial?: ExplainedQuantity;
  onClose: () => void;
}) {
  const texts = content.explanations;
  const d = state.districts[id];
  const explanation = explainDistrict(state, content.rules, id);
  const [open, setOpen] = useState<ExplainedQuantity>(initial);
  const shown = explanation.filter((q) => q.quantity === open);
  return (
    <section className="card" data-testid="scheda-quartiere">
      <header className="card-head">
        <h2>{content.texts.districts[id]?.nome}</h2>
        <button type="button" onClick={onClose} aria-label="Chiudi la scheda">Chiudi</button>
      </header>
      <p className="note">{content.texts.districts[id]?.descrizione}</p>
      <p className="note">Residenti: {fmt(d.population.young + d.population.adult + d.population.elder)}</p>
      <div className="values" role="tablist" aria-label="I sei indicatori del quartiere" data-testid="valori-quartiere">
        {explanation.map((q) => (
          <button
            key={q.quantity}
            type="button"
            role="tab"
            aria-selected={q.quantity === open}
            className={q.quantity === open ? 'value on' : 'value'}
            title={texts.quantities[q.quantity]}
            onClick={() => setOpen(q.quantity)}
          >
            <span className="value-name">{(texts.quantities[q.quantity] ?? q.quantity).split(' ')[0]}</span>
            <span className="value-number">
              {Math.round(q.current)} {arrow(prev?.districts[id][q.quantity], q.current)}
            </span>
          </button>
        ))}
      </div>
      {shown.map((q) => (
        <div key={q.quantity} className="quantity" data-testid="fattori">
          <h3>
            {QUANTITY_TERMS[q.quantity] !== undefined ? (
              <Term id={QUANTITY_TERMS[q.quantity]!}>{texts.quantities[q.quantity]}</Term>
            ) : (
              texts.quantities[q.quantity]
            )}
            : {Math.round(q.current)} {arrow(prev?.districts[id][q.quantity], q.current)}
            <span className="toward"> — {fill(texts.toward[q.kind] ?? '', { arrivo: String(Math.round(q.target)) })}</span>
          </h3>
          <Sparkline values={timeline.map((snap) => snap.districts[id][q.quantity])} label={texts.quantities[q.quantity] ?? q.quantity} />
          <ul>
            {q.factors.map((f, i) => (
              <li key={i}>
                {fill(texts.factors[f.key] ?? f.key, {
                  peso: fmt(Math.abs(f.weight), 1),
                  segno: signed(f.weight),
                  lotto: lotName(String(f.params?.['lotId'] ?? '')),
                  stato: texts.lotStates[String(f.params?.['state'] ?? '')] ?? '',
                  soglia: String(f.params?.['threshold'] ?? ''),
                  quota: String(f.params?.['share'] ?? ''),
                })}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

// ---------- Lotto ----------

export function LotCard({ state, lotId, onRequest, onClose }: { state: GameState; lotId: string; onRequest: Request; onClose: () => void }) {
  const lot = state.plantLots.find((l) => l.id === lotId)!;
  const project = state.projects.find((p) => p.lotId === lot.id && p.phase !== 'cancelled');
  return (
    <section className="card" data-testid="scheda-lotto">
      <header className="card-head">
        <h2>Lotto: {lotName(lot.id)}</h2>
        <button type="button" onClick={onClose} aria-label="Chiudi la scheda">Chiudi</button>
      </header>
      <p className="note">{content.texts.plantLots[lot.id]?.descrizione}</p>
      <p>
        <Term id="strada">Strada</Term>: <strong>{PATH_NAMES[lot.path]}</strong>
        {lot.path !== 'idle' && ` · avanzamento ${Math.round(lot.progress * 100)}%`}
        {lot.remediated && ' · bonificato'}
      </p>
      {project !== undefined && <ProjectBar project={project} state={state} prev={undefined} />}
      <h3>Destinare il lotto</h3>
      <div className="buttons wrap" data-testid="strade-lotto">
        {PATHS.filter((p) => p !== lot.path).map((path) => (
          <button
            key={path}
            type="button"
            data-testid={`strada-${path}`}
            onClick={() =>
              onRequest({ kind: 'convert-lot', lotId: lot.id, path }, `Destinare «${lotName(lot.id)}» a ${PATH_NAMES[path]}`, [
                ...(lot.path !== 'idle' ? ['Il progetto in corso sul lotto si annulla.'] : []),
                ...describeProject(content.rules.projects[content.rules.lotConversion[path]]!, content),
              ])
            }
          >
            {PATH_NAMES[path]}
          </button>
        ))}
        {lot.path !== 'idle' && (
          <button type="button" onClick={() => onRequest({ kind: 'convert-lot', lotId: lot.id, path: 'idle' }, 'Fermare il lotto', ['Il progetto in corso sul lotto si annulla.'])}>
            fermare
          </button>
        )}
      </div>
    </section>
  );
}

// ---------- Cantieri ----------

function stopReason(project: Project, prev: GameState | undefined): string | null {
  if (project.frozenTurns > 0) return `Fermo dopo lo scandalo sulla scorciatoia: ancora ${years(project.frozenTurns)}.`;
  if (project.worksStalled) return 'Cantiere fermo: mancano fondi o capacità di spesa.';
  const before = prev?.projects.find((p) => p.id === project.id);
  if (before !== undefined && before.phase === project.phase && before.turnsLeftInPhase === project.turnsLeftInPhase && project.phase !== 'operating') {
    return "L'anno scorso non è avanzato: fondi o capacità di spesa insufficienti.";
  }
  return null;
}

export function ProjectBar({ project, state, prev }: { project: Project; state: GameState; prev: GameState | undefined }) {
  const phases: ProjectPhase[] = [...BUILD_PHASES, 'operating'];
  const current = phases.indexOf(project.phase);
  const reason = stopReason(project, prev);
  const lot = project.lotId === undefined ? '' : ` · ${lotName(project.lotId)}`;
  void state;
  return (
    <div className="project" data-testid="cantiere">
      <h3>{projectName(project.definitionId)}{lot}</h3>
      <div className="phases" aria-label={`Fase: ${PHASE_NAMES[project.phase]}`}>
        {phases.map((phase, i) => (
          <span key={phase} className={i < current ? 'done' : i === current ? 'now' : 'todo'}>{PHASE_NAMES[phase]}</span>
        ))}
      </div>
      <p className="note">
        {project.phase === 'operating'
          ? 'In esercizio.'
          : `${PHASE_NAMES[project.phase]}: ${years(project.turnsLeftInPhase)} alla fine della fase`}
        {project.delayTurns > 0 && ` · ritardo accumulato ${years(project.delayTurns)}`}
      </p>
      {reason !== null && <p className="warning">{reason}</p>}
    </div>
  );
}

export function ProjectsView({ state, prev, onRequest }: { state: GameState; prev: GameState | undefined; onRequest: Request }) {
  const [adding, setAdding] = useState(false);
  const active = state.projects.filter((p) => p.phase !== 'cancelled');
  const lotDefs = new Set(Object.values(content.rules.lotConversion));
  const started = new Set(active.map((p) => p.definitionId));
  const available = Object.values(content.rules.projects).filter((d) => !lotDefs.has(d.id) && !(d.unique === true && started.has(d.id)));
  const capacity = useMemo(() => officeCapacity(state, content.rules), [state]);
  return (
    <section className="panel" data-testid="cantieri">
      <h2>Cantieri</h2>
      <p data-testid="capacita-cantieri">
        <Term id="capacita-uffici">Capacità degli uffici</Term>: {fmt(capacity.free, 1)} M€ liberi su {fmt(capacity.total, 1)} quest'anno.
        {capacity.free <= 0 && ' Gli uffici sono saturi: un cantiere nuovo partirà in ritardo.'}
      </p>
      <p className="note">
        Ogni opera passa per quattro <Term id="fase">fasi</Term> prima dell'<Term id="esercizio">esercizio</Term>.
      </p>
      {active.length === 0 && <p>Nessun cantiere: avvia un progetto o destina un lotto dalla mappa.</p>}
      {active.map((p) => (
        <div key={p.id}>
          <ProjectBar project={p} state={state} prev={prev} />
          {(p.phase === 'permitting' || p.phase === 'tender') && (
            <button
              type="button"
              data-testid="salta-fase"
              onClick={() => {
                const def = content.rules.projects[p.definitionId]!;
                const cost = def.phases[p.phase as (typeof BUILD_PHASES)[number]].annualCost * p.turnsLeftInPhase;
                onRequest({ kind: 'shortcut-phase', projectId: p.id }, `Saltare la fase di ${PHASE_NAMES[p.phase]}`, [
                  `«${projectName(p.definitionId)}»: guadagni ${years(p.turnsLeftInPhase)} e non spendi ${fmt(cost, 1)} M€.`,
                ]);
              }}
            >
              Salta questa fase
            </button>
          )}
          {(p.phase === 'permitting' || p.phase === 'tender') && (
            <Term id="scorciatoia">Che cosa vuol dire saltare una fase?</Term>
          )}
        </div>
      ))}
      <button type="button" className="primary" onClick={() => setAdding(!adding)} data-testid="nuovo-progetto">
        {adding ? 'Chiudi l’elenco' : 'Avvia un nuovo progetto'}
      </button>
      {adding &&
        available.map((def) => {
          const f = projectForecast(def);
          return (
            <div key={def.id} className="offer">
              <h3>{projectName(def.id)}</h3>
              <p className="note">{f.minYears}-{f.maxYears} anni · {fmt(f.minCost)}-{fmt(f.maxCost)} M€</p>
              <button type="button" onClick={() => onRequest({ kind: 'start-project', definitionId: def.id }, `Avviare «${projectName(def.id)}»`, describeProject(def, content))}>
                Vedi e avvia
              </button>
            </div>
          );
        })}
    </section>
  );
}

// ---------- Politiche ----------

export function PoliciesView({ state, onRequest }: { state: GameState; onRequest: Request }) {
  return (
    <section className="panel" data-testid="politiche">
      <h2>Politiche</h2>
      {Object.values(content.rules.policies).map((def) => {
        const active = state.activePolicies.includes(def.id);
        const name = content.texts.policies[def.id]?.nome ?? def.id;
        return (
          <div key={def.id} className="offer">
            <h3>{name}{active && <span className="badge"> attiva dal {yearOfTurn(state.policySince[def.id] ?? state.turn)}</span>}</h3>
            <p className="note">{fmt(def.annualCost, 1)} M€ l'anno</p>
            <button
              type="button"
              onClick={() =>
                onRequest({ kind: 'set-policy', policyId: def.id, active: !active }, active ? `Spegnere «${name}»` : `Accendere «${name}»`, [
                  ...(active ? [] : ["Vale dall'anno prossimo."]),
                  ...describePolicy(def, content),
                ])
              }
            >
              {active ? 'Spegni' : 'Accendi'}
            </button>
          </div>
        );
      })}
    </section>
  );
}

// ---------- Consiglio ----------

function describeAction(action: Action): string[] {
  switch (action.kind) {
    case 'start-project':
      return describeProject(content.rules.projects[action.definitionId]!, content);
    case 'convert-lot':
      return action.path === 'idle' ? [] : describeProject(content.rules.projects[content.rules.lotConversion[action.path]]!, content);
    case 'set-policy':
      return describePolicy(content.rules.policies[action.policyId]!, content);
    default:
      return [];
  }
}

export function CouncilView({ state, onRequest }: { state: GameState; onRequest: Request }) {
  const advice = adviseCouncil(state, content.rules, content.council, content.councilLabels);
  return (
    <section className="panel" data-testid="consiglio">
      <h2>Il Consiglio</h2>
      <div className="grid">
        {advice.map((a) => (
          <article key={a.councillorId} className="councillor">
            <h3>{a.name}{a.urgent && <span className="badge"> preoccupato</span>}</h3>
            <p>{a.reason}</p>
            {a.action !== null && (
              <button type="button" onClick={() => onRequest(a.action!, a.name, [a.reason, ...describeAction(a.action!)])}>Segui il consiglio</button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

// ---------- Dilemma ----------

/** Carta a tutto schermo. Non dice mai, prima della scelta, quali opzioni sono nascoste. */
export function DilemmaCard({ state, onAnswer }: { state: GameState; onAnswer: (optionId: string) => void }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const id = state.openDilemmaId!;
  const def = content.rules.dilemmas[id]!;
  const text = content.texts.dilemmas[id]!;
  return (
    <div className="overlay full" role="dialog" aria-modal="true" aria-label={text.titolo} data-testid="dilemma">
      <div className="sheet dilemma">
        <p className="kicker">Dilemma · {yearOfTurn(state.turn)}</p>
        <h2>{text.titolo}</h2>
        <p>{text.testo}</p>
        {Object.entries(def.options).map(([optionId, option]) => {
          const [label, ...rest] = describeOption(option, text.options[optionId]!.etichetta, text.options[optionId]!.conseguenze, content);
          const selected = chosen === optionId;
          return (
            <button key={optionId} type="button" className={selected ? 'option on' : 'option'} onClick={() => setChosen(optionId)} data-testid="opzione">
              <strong>{label}</strong>
              {rest.map((line, i) => <span key={i}>{line.trim()}</span>)}
            </button>
          );
        })}
        {/* Posto per il fumetto della partita guidata (T16): dentro la finestra, tra le opzioni e il pulsante, così non copre nulla. */}
        <div className="spazio-tutorial" data-testid="spazio-tutorial" />
        <div className="buttons">
          <button type="button" className="primary" disabled={chosen === null} onClick={() => chosen !== null && onAnswer(chosen)} data-testid="scegli">
            Scegli questa opzione
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Cronaca ----------

export function CronacaPaper({ year, headlines, onClose }: { year: number; headlines: string[]; onClose: () => void }) {
  const [first, ...others] = headlines;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={`Cronaca del ${year}`} data-testid="cronaca">
      <div className="sheet paper">
        <p className="masthead">La Cronaca dei Due Mari</p>
        <p className="dateline">Bilancio dell'anno {year}</p>
        <h2 className="headline">{first}</h2>
        {others.map((h, i) => <p key={i} className="subhead">{h}</p>)}
        <div className="buttons">
          <button type="button" className="primary" onClick={onClose} data-testid="continua">Continua</button>
        </div>
      </div>
    </div>
  );
}

/** La Cronaca in breve, dentro la pagina: il primo titolo dell'ultimo anno chiuso e il giornale al tocco. */
export function CronacaStrip({ year, headlines, onOpen }: { year: number; headlines: string[]; onOpen: () => void }) {
  return (
    <aside className="cronaca-strip" data-testid="cronaca-breve">
      <span className="masthead-small">La Cronaca dei Due Mari · {year}</span>
      <span className="strip-headline">{headlines[0]}</span>
      <button type="button" onClick={onOpen} data-testid="leggi-cronaca">Leggi</button>
    </aside>
  );
}

// ---------- Finale ----------

const employed = (s: GameState) => Object.values(s.labor.employed).reduce((a, b) => a + b, 0);

export function Portrait({ initial, state, link, onNew }: { initial: GameState; state: GameState; link: string; onNew: () => void }) {
  const standing = state.status === 'ended-2127';
  const blue = state.moral.conscience >= 0;
  const how = state.status === 'ended-bankrupt' ? 'svuotata dal dissesto' : state.status === 'ended-abandoned' ? 'svuotata: ha voltato le spalle al Comune' : 'in piedi';
  const rows: [string, (s: GameState) => number, number][] = [
    ['Occupati', employed, 0],
    ['Cassa integrati', (s) => s.labor.onWageSupport, 0],
    ['Disoccupati', (s) => s.labor.unemployed, 0],
    ['Fondi propri (M€)', (s) => s.economy.funds.own, 1],
    ['Fiducia media', averageTrust, 1],
    ['Aria ai Tamburi', (s) => s.districts.tamburi.airQuality, 0],
    ['Salute ai Tamburi', (s) => s.districts.tamburi.health, 0],
    ['Esposizione ai Tamburi', (s) => s.districts.tamburi.cumulativeExposure, 0],
    ['Terreni contaminati, area industriale', (s) => s.districts['area-industriale'].contaminatedSoil, 0],
    ['Coscienza', (s) => s.moral.conscience, 1],
    ['Reputazione', (s) => s.moral.reputation, 1],
    ['Scandali', (s) => s.moral.scandals.length, 0],
  ];
  return (
    <section className="panel portrait" data-testid="finale">
      <p className="kicker">Ritratto di Taranto, {yearOfTurn(state.turn)}</p>
      <h2>Una città {how}, governata da una coscienza {blue ? 'Blu' : 'Red'}.</h2>
      <p>
        {standing
          ? blue
            ? 'Taranto arriva in fondo al secolo, e ci arriva a testa alta.'
            : 'Taranto arriva in fondo al secolo, ma molte cose si sono fatte di nascosto.'
          : blue
            ? 'Le scelte sono state oneste, ma la città non ha retto.'
            : 'Scorciatoie e silenzi non sono bastati a tenere in piedi la città.'}
      </p>
      <table>
        <thead>
          <tr><th></th><th>{yearOfTurn(initial.turn)}</th><th>{yearOfTurn(state.turn)}</th></tr>
        </thead>
        <tbody>
          {rows.map(([label, read, digits]) => (
            <tr key={label}><th scope="row">{label}</th><td>{fmt(read(initial), digits)}</td><td>{fmt(read(state), digits)}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="buttons wrap">
        <a className="button primary" href={link} data-testid="link-partita">Riapri questa partita</a>
        <button type="button" onClick={onNew}>Nuova partita</button>
      </p>
    </section>
  );
}
