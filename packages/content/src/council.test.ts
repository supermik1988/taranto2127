import { adviseCouncil, type CouncilAdvice } from '@taranto2127/agents';
import { applyAction, createInitialState, type GameState } from '@taranto2127/sim';
import { describe, expect, it } from 'vitest';
import { loadContent } from './load.js';
import { randomGame } from './test-support/random-game.js';

const { initialContent, rules, council, councilLabels } = loadContent();
const initial = (seed = 1): GameState => createInitialState(seed, initialContent);
const advise = (state: GameState): CouncilAdvice[] => adviseCouncil(state, rules, council, councilLabels);

/** L'azione è coerente con la visione del consigliere? */
function coherent(state: GameState, advice: CouncilAdvice): boolean {
  const vision = council.visions[advice.vision];
  const action = advice.action;
  if (action === null) return true;
  switch (action.kind) {
    case 'start-project':
      return vision.projects.includes(action.definitionId);
    case 'set-policy':
      return action.active ? vision.policies.includes(action.policyId) : advice.vision === 'public-accounts';
    case 'convert-lot':
      return action.path === vision.lotPath;
    case 'shortcut-phase': {
      const project = state.projects.find((p) => p.id === action.projectId)!;
      return vision.projects.includes(project.definitionId) || rules.lotConversion[vision.lotPath ?? 'energy'] === project.definitionId;
    }
    default:
      return false;
  }
}

describe('il Consiglio', () => {
  it('sei consiglieri, sei consigli, nell’ordine del Consiglio', () => {
    const advice = advise(initial());
    expect(advice.map((a) => a.councillorId)).toEqual(initialContent.council.map((c) => c.id));
    for (const a of advice) expect(a.reason.length).toBeGreaterThan(10);
  });

  it('il consiglio è identico a parità di stato', () => {
    const state = randomGame(5, initialContent, rules);
    expect(JSON.stringify(advise(state))).toBe(JSON.stringify(advise(structuredClone(state))));
  });

  it('ogni consigliere propone azioni coerenti con la sua visione, e ammesse dal motore', { timeout: 60_000 }, () => {
    let checked = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      randomGame(seed, initialContent, rules, (s) => {
        if (s.status !== 'running' || s.turn % 7 !== 0 || s.openDilemmaId !== null) return;
        for (const a of advise(s)) {
          expect(coherent(s, a), `${a.vision} al turno ${s.turn}: ${JSON.stringify(a.action)}`).toBe(true);
          if (a.action !== null) expect(() => applyAction(s, a.action!, rules)).not.toThrow();
          checked++;
        }
      });
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('salute e ambiente, con l’aria dei Tamburi sotto guardia, chiede con urgenza la bonifica di un lotto', () => {
    const health = advise(initial()).find((a) => a.vision === 'health-environment')!;
    expect(health.urgent).toBe(true);
    expect(health.action).toMatchObject({ kind: 'convert-lot', path: 'remediation' });
    expect(health.reason).toContain('Tamburi');
  });

  it('ogni visione propone qualcosa di suo all’inizio della partita', () => {
    const byVision = Object.fromEntries(advise(initial()).map((a) => [a.vision, a.action]));
    expect(byVision['work-industry']).toMatchObject({ kind: 'convert-lot', path: 'green-steel' });
    expect(byVision['sea-culture']).toMatchObject({ kind: 'convert-lot', path: 'sea-culture' });
    expect(byVision['public-accounts']).toMatchObject({ kind: 'convert-lot', path: 'energy' });
    expect(byVision['youth-future']).toMatchObject({ kind: 'start-project', definitionId: 'centro-ricerca-mare' });
    expect(byVision['districts-periphery']).toMatchObject({ kind: 'start-project', definitionId: 'riqualificazione-talsano' });
  });

  it('un consigliere con poca pazienza propone di saltare la fase di un cantiere che gli sta a cuore', () => {
    let state = applyAction(initial(), { kind: 'start-project', definitionId: 'scuole-paolo-vi' }, rules);
    state = structuredClone(state);
    state.projects[0]!.phase = 'permitting';
    state.projects[0]!.turnsLeftInPhase = 2;
    state.council.find((c) => c.vision === 'districts-periphery')!.patience = 10;
    const periphery = advise(state).find((a) => a.vision === 'districts-periphery')!;
    expect(periphery).toMatchObject({ shortcut: true, action: { kind: 'shortcut-phase', projectId: state.projects[0]!.id } });
    // Con pazienza normale, nessuna scorciatoia.
    const patient = advise(applyAction(initial(), { kind: 'start-project', definitionId: 'scuole-paolo-vi' }, rules));
    expect(patient.some((a) => a.shortcut)).toBe(false);
  });

  it('con i fondi propri in allarme, i conti propongono di spegnere la politica più cara', () => {
    let state = applyAction(initial(), { kind: 'set-policy', policyId: 'integrazione-reddito', active: true }, rules);
    state = applyAction(state, { kind: 'set-policy', policyId: 'consulte-quartiere', active: true }, rules);
    state = structuredClone(state);
    state.economy.funds.own = 5;
    state.turn = 5; // anni minimi superati
    const accounts = advise(state).find((a) => a.vision === 'public-accounts')!;
    expect(accounts).toMatchObject({ urgent: true, action: { kind: 'set-policy', policyId: 'integrazione-reddito', active: false } });
  });
});
