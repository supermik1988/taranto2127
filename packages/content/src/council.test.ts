import { actionConcerns, adviseCouncil, type CouncilAdvice } from '@taranto2127/agents';
import { DISTRICT_IDS, applyAction, createInitialState, type Action, type GameState } from '@taranto2127/sim';
import { describe, expect, it } from 'vitest';
import { loadContent } from './load.js';
import { randomGame } from './test-support/random-game.js';

const content = loadContent();
const { initialContent, rules, council, councilLabels } = content;
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

  it('salute e ambiente, con l’aria dei Tamburi sotto guardia, chiede con urgenza un’opera che migliora quell’aria', () => {
    const health = advise(initial()).find((a) => a.vision === 'health-environment')!;
    expect(health.urgent).toBe(true);
    expect(health.action).toMatchObject({ kind: 'start-project', definitionId: 'fascia-verde-tamburi' });
    expect(health.reason).toContain('Tamburi');
  });

  it('con l’allarme mareggiate propone le difese costiere, prima del lotto delle banchine', () => {
    const sea = advise(initial()).find((a) => a.vision === 'sea-culture')!;
    expect(initial().districts['citta-vecchia'].floodRisk).toBeGreaterThan(30);
    expect(sea.urgent).toBe(true);
    expect(sea.action).toMatchObject({ kind: 'start-project', definitionId: 'difese-costiere' });
    // Senza allarme torna l'ordine normale: prima il lotto preferito.
    const calm = structuredClone(initial());
    calm.districts['citta-vecchia'].floodRisk = 10;
    expect(advise(calm).find((a) => a.vision === 'sea-culture')!.action).toMatchObject({ kind: 'convert-lot', lotId: 'lotto-banchine' });
  });

  it('ogni visione propone qualcosa di suo all’inizio della partita, e i lotti proposti sono diversi', () => {
    const byVision = Object.fromEntries(advise(initial()).map((a) => [a.vision, a.action]));
    expect(byVision['work-industry']).toMatchObject({ kind: 'convert-lot', lotId: 'lotto-acciaieria', path: 'green-steel' });
    expect(byVision['health-environment']).toMatchObject({ kind: 'start-project', definitionId: 'fascia-verde-tamburi' });
    expect(byVision['sea-culture']).toMatchObject({ kind: 'start-project', definitionId: 'difese-costiere' });
    expect(byVision['public-accounts']).toMatchObject({ kind: 'convert-lot', lotId: 'lotto-laminatoi', path: 'energy' });
    expect(byVision['youth-future']).toMatchObject({ kind: 'start-project', definitionId: 'centro-ricerca-mare' });
    // Allarme sui servizi di Paolo VI: l'opera proposta riguarda Paolo VI.
    expect(byVision['districts-periphery']).toMatchObject({ kind: 'start-project', definitionId: 'scuole-paolo-vi' });
  });

  it('se il primo lotto preferito non è più fermo, propone il successivo del suo ordine', () => {
    const state = applyAction(initial(), { kind: 'convert-lot', lotId: 'lotto-acciaieria', path: 'energy' }, rules);
    const work = advise(state).find((a) => a.vision === 'work-industry')!;
    expect(work.action).toMatchObject({ kind: 'convert-lot', lotId: 'lotto-altoforni', path: 'green-steel' });
  });

  it('se il motivo cita un quartiere, l’azione proposta riguarda quel quartiere', { timeout: 60_000 }, () => {
    const names = DISTRICT_IDS.map((id) => [id, content.texts.districts[id]!.nome] as const);
    const concerns = (state: GameState, action: Action, district: string): boolean => {
      if (action.kind === 'shortcut-phase') {
        const project = state.projects.find((p) => p.id === action.projectId)!;
        return actionConcerns({ kind: 'start-project', definitionId: project.definitionId }, district, rules);
      }
      return actionConcerns(action, district, rules);
    };
    let cited = 0;
    const check = (s: GameState) => {
      for (const a of advise(s)) {
        if (a.action === null || (a.action.kind === 'set-policy' && !a.action.active)) continue;
        for (const [id, name] of names) {
          if (!a.reason.includes(name)) continue;
          cited++;
          expect(concerns(s, a.action, id), `${a.vision}: «${a.reason}» → ${JSON.stringify(a.action)}`).toBe(true);
        }
      }
    };
    check(initial());
    for (const seed of [1, 2, 3]) {
      randomGame(seed, initialContent, rules, (s) => {
        if (s.status === 'running' && s.turn % 5 === 0 && s.openDilemmaId === null) check(s);
      });
    }
    expect(cited).toBeGreaterThan(20);
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
