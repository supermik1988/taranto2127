/**
 * Il bilancio: le tre casse e che cosa può pagare ognuna, entrate e uscite
 * dell'ultimo anno voce per voce, previsione dell'anno in corso, disavanzo e
 * dissesto, rate europee, capacità degli uffici. Le cifre vengono da
 * forecastYear del motore: la previsione usa lo stesso codice del turno.
 */
import { fmt } from '@taranto2127/play/describe';
import { forecastYear, yearOfTurn, type FundKind, type GameState, type LedgerEntry, type YearBudget } from '@taranto2127/sim';
import { useMemo } from 'react';
import { content } from './engine.js';
import { Term, fill } from './guide.js';

const texts = content.guide.budget;
const FUNDS: Exclude<FundKind, 'private'>[] = ['own', 'state', 'eu-earmarked'];
const money = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), 1)}`;
const years = (n: number) => `${n} ${n === 1 ? 'anno' : 'anni'}`;

export const fundName = (fund: Exclude<FundKind, 'private'>) => texts.fondi[fund].nome;

/** Nome leggibile di una voce del registro. */
function entryLabel(entry: LedgerEntry, state: GameState, prev: GameState | undefined): string {
  if (entry.key === 'policy') return fill(texts.voci['policy']!, { nome: content.texts.policies[entry.ref ?? '']?.nome ?? entry.ref ?? '' });
  if (entry.key === 'project') {
    const project = state.projects.find((p) => p.id === entry.ref) ?? prev?.projects.find((p) => p.id === entry.ref);
    const name = content.texts.projects[project?.definitionId ?? '']?.nome ?? entry.ref ?? '';
    const lot = project?.lotId === undefined ? '' : ` (${content.texts.plantLots[project.lotId]?.nome ?? project.lotId})`;
    return fill(texts.voci['project']!, { nome: `${name}${lot}` });
  }
  return texts.voci[`${entry.key}/${entry.fund}`] ?? texts.voci[entry.key] ?? entry.key;
}

/** Voci uguali (stessa etichetta, stessa cassa) si sommano. */
function rows(budget: YearBudget, state: GameState, prev: GameState | undefined) {
  const merged = new Map<string, { label: string; fund: FundKind; amount: number }>();
  for (const entry of budget.entries) {
    const label = entryLabel(entry, state, prev);
    const key = `${label}|${entry.fund}`;
    const row = merged.get(key) ?? { label, fund: entry.fund, amount: 0 };
    row.amount += entry.amount;
    merged.set(key, row);
  }
  return [...merged.values()].filter((r) => Math.abs(r.amount) >= 0.05 && r.fund !== 'private');
}

function Ledger({ budget, state, prev, testId }: { budget: YearBudget; state: GameState; prev: GameState | undefined; testId: string }) {
  const lines = rows(budget, state, prev);
  return (
    <div className="ledger" data-testid={testId}>
      {FUNDS.map((fund) => {
        const own = lines.filter((r) => r.fund === fund);
        return (
          <div key={fund} className="ledger-fund">
            <h4>{fundName(fund)}</h4>
            <table>
              <tbody>
                <tr className="ledger-start"><th scope="row">All'inizio</th><td>{fmt(budget.start[fund], 1)}</td></tr>
                {own.length === 0 && <tr><th scope="row" className="muted">Nessun movimento</th><td></td></tr>}
                {own.map((r) => (
                  <tr key={r.label} className={r.amount < 0 ? 'out' : 'in'}>
                    <th scope="row">{r.label}</th>
                    <td>{money(r.amount)}</td>
                  </tr>
                ))}
                <tr className="ledger-end"><th scope="row">Alla fine</th><td>{fmt(budget.end[fund], 1)}</td></tr>
              </tbody>
            </table>
          </div>
        );
      })}
      <p className="note">Milioni di euro.</p>
    </div>
  );
}

export function BudgetView({ state, prev }: { state: GameState; prev: GameState | undefined }) {
  const rules = content.rules;
  const forecast = useMemo(() => forecastYear(state, rules), [state, rules]);
  const last = useMemo(() => (prev === undefined ? undefined : forecastYear(prev, rules)), [prev, rules]);
  const funds = state.economy.funds;
  const year = yearOfTurn(state.turn);
  const projectName = (id: string) => {
    const p = state.projects.find((x) => x.id === id);
    return content.texts.projects[p?.definitionId ?? '']?.nome ?? id;
  };
  const upcoming = rules.economy.euTranches.filter((t) => t.arrivesInYear >= year);
  // Fondi europei che non appartengono a una rata con scadenza (per esempio quelli di partenza).
  const unbound = funds['eu-earmarked'] - state.economy.euTranches.reduce((sum, t) => sum + t.remaining, 0);

  return (
    <section className="panel" data-testid="bilancio">
      <h2>Bilancio</h2>
      <p className="estimate" data-testid="nota-stime">{texts.nota}</p>

      <div className="funds-grid">
        {FUNDS.map((fund) => (
          <article key={fund} className="fund" data-testid={`cassa-${fund}`}>
            <h3>{fundName(fund)}</h3>
            <p className={`fund-amount ${funds[fund] < 0 ? 'negative' : ''}`}>{fmt(funds[fund], 1)} M€</p>
            <p className="note">
              {fill(texts.fondi[fund].puoPagare, { anni: rules.economy.bankruptcyAfterDeficitYears, tetto: fmt(rules.economy.stateCarryOverCap) })}
            </p>
          </article>
        ))}
      </div>

      {forecast.yearsToBankruptcy !== null ? (
        <p className="warning box" role="alert" data-testid="avviso-disavanzo">
          <Term id="disavanzo">Disavanzo</Term>:{' '}
          {forecast.yearsToBankruptcy === 0 ? texts.dissestoOra : fill(texts.disavanzo, { anni: years(forecast.yearsToBankruptcy) })}{' '}
          <Term id="dissesto">Che cos'è il dissesto?</Term>
        </p>
      ) : (
        <p className="note">{texts.inAttivo}</p>
      )}

      <h3>
        <Term id="capacita-uffici">Capacità degli uffici</Term>
      </h3>
      <p data-testid="capacita-bilancio">{fill(texts.capacita, { libera: fmt(forecast.capacity.free, 1), totale: fmt(forecast.capacity.total, 1) })}</p>
      {forecast.stalled.length > 0 && (
        <p className="warning">
          {fill(texts.cantieriFermi, {
            elenco: forecast.stalled.map((s) => `${projectName(s.projectId)} (${texts.motiviFermo[s.reason]})`).join('; '),
          })}
        </p>
      )}

      <h3>Previsione per il {forecast.year}</h3>
      <p className="note">Che cosa succede ai conti chiudendo quest'anno, se non fai altro.</p>
      <Ledger budget={forecast} state={state} prev={prev} testId="previsione" />

      <h3>Ultimo anno chiuso{last !== undefined ? `: ${last.year}` : ''}</h3>
      {last === undefined ? (
        <p className="note">Nessun anno è ancora stato chiuso: qui compariranno entrate e uscite, voce per voce.</p>
      ) : (
        <Ledger budget={last} state={state} prev={prev} testId="ultimo-anno" />
      )}

      <h3>
        <Term id="rata-europea">Rate europee</Term>
      </h3>
      <ul className="tranches" data-testid="rate-europee">
        {state.economy.euTranches.map((t) => (
          <li key={t.id}>
            Da spendere: {fmt(t.remaining, 1)} M€ entro la fine del {yearOfTurn(t.expiresOnTurn)}
            {t.expiresOnTurn <= state.turn &&<strong className="warning"> · scade quest'anno</strong>}
          </li>
        ))}
        {upcoming.map((t) => (
          <li key={t.id} className="muted">In arrivo nel {t.arrivesInYear}: {fmt(t.amount)} M€, da spendere entro il {t.expiresInYear}</li>
        ))}
        {unbound > 0.05 && <li>Già disponibili, senza scadenza: {fmt(unbound, 1)} M€</li>}
        {state.economy.euTranches.length === 0 && upcoming.length === 0 && unbound <= 0.05 && <li className="muted">Nessuna rata aperta né in arrivo.</li>}
      </ul>
    </section>
  );
}
