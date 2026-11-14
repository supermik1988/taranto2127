import {
  advanceTurn,
  applyAction,
  applyDeltas,
  applyLaborMoves,
  createInitialState,
  readNumber,
  replay,
  validateState,
  type EffectSet,
  type GameState,
  type MoralWeights,
} from '@taranto2127/sim';
import { describe, expect, it } from 'vitest';
import { CONTENT_FILES, ContentError, loadContent, validateContentFiles, type ContentFiles } from './load.js';
import { randomGame } from './test-support/random-game.js';

const { initialContent, rules, texts } = loadContent();
const initial = (seed = 1): GameState => createInitialState(seed, initialContent);
const laborForce = (s: GameState): number =>
  Object.values(s.labor.employed).reduce((a, b) => a + b, 0) + s.labor.onWageSupport + s.labor.unemployed + s.labor.inTraining;

/** Visita ogni valore del JSON grezzo, con il percorso e il genitore. */
function walk(value: unknown, path: string, visit: (value: unknown, path: string, parent: unknown, key: string) => void): void {
  if (Array.isArray(value)) value.forEach((child, i) => {
    visit(child, `${path}[${i}]`, value, String(i));
    walk(child, `${path}[${i}]`, visit);
  });
  else if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      visit(child, `${path}.${key}`, value, key);
      walk(child, `${path}.${key}`, visit);
    }
  }
}

describe('schema e caricatore', () => {
  it('tutti i file passano lo schema', () => {
    expect(validateContentFiles()).toEqual([]);
  });

  it('un file che viola lo schema viene rifiutato con un errore leggibile', () => {
    const broken: ContentFiles = structuredClone(CONTENT_FILES);
    (broken.quartieri as { districts: Record<string, { health: { valore: number } }> }).districts['borgo']!.health.valore = 140;
    expect(validateContentFiles(broken).some((e) => e.includes('quartieri.json/districts/borgo/health'))).toBe(true);
    expect(() => loadContent(broken)).toThrow(ContentError);
  });

  it('un consigliere indicato per posizione nei dati viene rifiutato dallo schema', () => {
    const broken: ContentFiles = structuredClone(CONTENT_FILES);
    const text = JSON.stringify(broken.dilemmi).replace('council.cons-lavoro.trustInPlayer', 'council.0.trustInPlayer');
    broken.dilemmi = JSON.parse(text);
    expect(validateContentFiles(broken).some((e) => e.startsWith('dilemmi.json'))).toBe(true);
    const condition: ContentFiles = structuredClone(CONTENT_FILES);
    condition.dilemmi = JSON.parse(JSON.stringify(condition.dilemmi).replace('"labor.unemployed"', '"council.2.patience"'));
    expect(validateContentFiles(condition).some((e) => e.startsWith('dilemmi.json'))).toBe(true);
  });

  it('nessun riferimento per posizione ai consiglieri nei dati', () => {
    expect(JSON.stringify(CONTENT_FILES)).not.toMatch(/council\.[0-9]+\./);
    expect(JSON.stringify(rules.dilemmas)).toContain('council.cons-lavoro.trustInPlayer');
  });

  it('il caricatore toglie annotazioni e testi: restano solo numeri, chiavi e identificativi del motore', () => {
    walk(rules, 'rules', (value, path, _parent, key) => {
      expect(['nome', 'descrizione', 'titolo', 'testo', 'etichetta', 'conseguenze', 'stima', 'motivazione', 'valore'], path).not.toContain(key);
      if (typeof value === 'object' && value !== null && 'valore' in value) throw new Error(`annotazione rimasta in ${path}`);
    });
    expect(typeof rules.economy.servicesCostPerYear).toBe('number');
    expect(initialContent.calibrationVersion).toBe('0.1-stime');
  });

  it('i testi restano disponibili per interfaccia e voci', () => {
    expect(texts.districts['tamburi']!.nome).toBe('Tamburi');
    expect(Object.keys(texts.dilemmas)).toHaveLength(Object.keys(rules.dilemmas).length);
    for (const [id, dilemma] of Object.entries(texts.dilemmas)) {
      expect(Object.keys(dilemma.options).sort(), id).toEqual(Object.keys(rules.dilemmas[id]!.options).sort());
    }
  });
});

describe('ogni numero è una stima dichiarata o ha una fonte', () => {
  it('nessun valore numerico è privo di "stima" o "fonte"', () => {
    const missing: string[] = [];
    for (const [name, file] of Object.entries(CONTENT_FILES)) {
      walk(file, name, (value, path, parent, key) => {
        if (typeof value !== 'number') return;
        const annotated =
          key === 'valore' &&
          typeof parent === 'object' &&
          parent !== null &&
          ((('stima' in parent && parent.stima === true) && 'motivazione' in parent) || 'fonte' in parent);
        if (!annotated) missing.push(path);
      });
    }
    expect(missing).toEqual([]);
  });

  it('in T05a sono ammesse solo stime: nessuna fonte, ogni stima ha una motivazione', () => {
    let estimates = 0;
    for (const [name, file] of Object.entries(CONTENT_FILES)) {
      walk(file, name, (value, path, _parent, key) => {
        if (key === 'fonte') throw new Error(`fonte non ammessa in T05a: ${path}`);
        if (key === 'stima') {
          expect(value, path).toBe(true);
          estimates++;
        }
      });
    }
    expect(estimates).toBeGreaterThan(300);
  });
});

describe('contenuti minimi', () => {
  it('sei quartieri, sei lotti, sei consiglieri con una visione ciascuno', () => {
    expect(Object.keys(initialContent.districts)).toHaveLength(6);
    expect(initialContent.plantLots).toHaveLength(6);
    expect(initialContent.council).toHaveLength(6);
    expect(new Set(initialContent.council.map((c) => c.vision)).size).toBe(6);
  });

  it('almeno dodici progetti, comprese le quattro strade dei lotti', () => {
    expect(Object.keys(rules.projects).length).toBeGreaterThanOrEqual(12);
    for (const id of Object.values(rules.lotConversion)) expect(rules.projects[id], id).toBeDefined();
  });

  it('otto politiche, di cui almeno una di formazione; sei dilemmi; cinque epoche di clima', () => {
    expect(Object.keys(rules.policies)).toHaveLength(8);
    expect(Object.values(rules.policies).some((p) => p.training !== undefined)).toBe(true);
    expect(Object.keys(rules.dilemmas)).toHaveLength(6);
    expect(rules.climateScenario.annualChangeByEpoch).toHaveLength(5);
  });

  it('le opere di quartiere sono uniche; i progetti di riconversione dei lotti no', () => {
    const unique = Object.values(rules.projects).filter((p) => p.unique === true).map((p) => p.id).sort();
    expect(unique).toEqual([
      'banchine-logistica',
      'centro-ricerca-mare',
      'difese-costiere',
      'fascia-verde-tamburi',
      'medicina-territorio',
      'riqualificazione-talsano',
      'risanamento-citta-vecchia',
      'scuole-paolo-vi',
      'trasporto-rapido',
    ]);
    for (const id of Object.values(rules.lotConversion)) expect(rules.projects[id]!.unique, id).not.toBe(true);
  });

  it('un progetto unico dei contenuti non si avvia due volte', () => {
    const once = applyAction(initial(), { kind: 'start-project', definitionId: 'scuole-paolo-vi' }, rules);
    expect(() => applyAction(once, { kind: 'start-project', definitionId: 'scuole-paolo-vi' }, rules)).toThrow();
  });

  it('durate in anni interi, con minimo e massimo per ogni fase', () => {
    for (const project of Object.values(rules.projects)) {
      for (const [phase, spec] of Object.entries(project.phases)) {
        expect(Number.isInteger(spec.minTurns) && Number.isInteger(spec.maxTurns), `${project.id}.${phase}`).toBe(true);
        expect(spec.minTurns, `${project.id}.${phase}`).toBeLessThanOrEqual(spec.maxTurns);
      }
      expect(project.phases.works.minTurns, project.id).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('regole di contenuto', () => {
  const moralSum = (weights: MoralWeights): number => Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
  const hasEffects = (e: EffectSet): boolean => e.deltas.length > 0 || (e.laborMoves?.length ?? 0) > 0;

  it('ogni dilemma ha un’opzione scorretta con un vantaggio e una corretta con un prezzo', () => {
    for (const dilemma of Object.values(rules.dilemmas)) {
      const options = Object.values(dilemma.options);
      const wrong = options.filter((o) => moralSum(o.moral) < 0);
      const right = options.filter((o) => moralSum(o.moral) > 0);
      expect(wrong.length, dilemma.id).toBeGreaterThan(0);
      expect(right.length, dilemma.id).toBeGreaterThan(0);
      // Il vantaggio della scorretta e il prezzo della corretta sono conseguenze concrete, non solo pesi morali.
      for (const o of [...wrong, ...right]) {
        expect(hasEffects(o.immediate) || o.delayed.some((d) => hasEffects(d.effects)), dilemma.id).toBe(true);
      }
    }
  });

  it('nessun nome reale di azienda o di stabilimento nei testi (regola 6)', () => {
    const all = JSON.stringify(texts).toLowerCase() + JSON.stringify(initialContent.council).toLowerCase();
    for (const name of ['ilva', 'arcelor', 'mittal', "acciaierie d'italia", 'italsider']) expect(all, name).not.toContain(name);
  });

  it('nessuna morte usata come punteggio (regola 8)', () => {
    const all = JSON.stringify(texts).toLowerCase();
    for (const word of ['morti', 'decessi', 'vittime', 'mortalità']) expect(all, word).not.toContain(word);
  });

  it('le strade di riconversione non hanno peso morale né nei progetti né nei dilemmi (regola 5)', () => {
    const lotProjects = new Set(Object.values(rules.lotConversion));
    for (const id of lotProjects) {
      const effects = rules.projects[id]!.operatingEffects;
      for (const d of [...effects.once.deltas, ...effects.everyYear.deltas]) expect(d.target.startsWith('moral.')).toBe(false);
    }
    const dilemmaText = JSON.stringify(texts.dilemmas).toLowerCase();
    for (const word of ['acciaio verde', 'forno elettrico', 'rinnovabil']) expect(dilemmaText, word).not.toContain(word);
  });
});

describe('i contenuti funzionano nel motore', () => {
  it('lo stato iniziale costruito dai contenuti passa validateState', () => {
    expect(validateState(initial()).errors).toEqual([]);
  });

  it('ogni effetto e ogni condizione dei dati si applica allo stato iniziale', () => {
    const state = initial();
    const sets: [string, EffectSet][] = [];
    for (const p of Object.values(rules.projects)) sets.push([p.id, p.operatingEffects.once], [p.id, p.operatingEffects.everyYear]);
    for (const p of Object.values(rules.policies)) sets.push([p.id, p.everyYear]);
    for (const d of Object.values(rules.dilemmas)) {
      for (const [optionId, o] of Object.entries(d.options)) {
        sets.push([`${d.id}/${optionId}`, o.immediate], ...o.delayed.map((x) => [`${d.id}/${optionId}`, x.effects] as [string, EffectSet]));
        if (o.promise?.condition) expect(() => readNumber(state, o.promise!.condition!.target)).not.toThrow();
      }
      for (const c of d.conditions) expect(() => readNumber(state, c.target), d.id).not.toThrow();
    }
    for (const [id, set] of sets) {
      expect(() => applyLaborMoves(applyDeltas(state, set.deltas), set.laborMoves ?? []), id).not.toThrow();
    }
  });

  it('ogni progetto si avvia e ogni politica si accende', () => {
    for (const definitionId of Object.keys(rules.projects)) {
      expect(() => applyAction(initial(), { kind: 'start-project', definitionId }, rules), definitionId).not.toThrow();
    }
    for (const policyId of Object.keys(rules.policies)) {
      expect(() => applyAction(initial(), { kind: 'set-policy', policyId, active: true }, rules), policyId).not.toThrow();
    }
  });

  it('cento anni senza fare nulla restano validi', () => {
    let state = initial();
    while (state.status === 'running') {
      if (state.openDilemmaId !== null) {
        const optionId = Object.keys(rules.dilemmas[state.openDilemmaId]!.options)[0]!;
        state = applyAction(state, { kind: 'answer-dilemma', dilemmaId: state.openDilemmaId, optionId }, rules);
      }
      state = advanceTurn(state, rules);
      expect(validateState(state).errors).toEqual([]);
    }
  });
});

describe('partite casuali con i contenuti veri', { timeout: 120_000 }, () => {
  const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
  const finals = new Map<number, GameState>();

  it('100 turni di gioco casuale su 20 semi restano validi, con forza lavoro costante', () => {
    for (const seed of seeds) {
      const force = laborForce(initial(seed));
      const final = randomGame(seed, initialContent, rules, (s) => {
        expect(validateState(s).errors).toEqual([]);
        expect(laborForce(s)).toBe(force);
      });
      expect(['ended-2127', 'ended-bankrupt']).toContain(final.status);
      finals.set(seed, final);
    }
  });

  it('almeno una partita arriva al 2127 e almeno una finisce in dissesto', () => {
    const statuses = seeds.map((seed) => finals.get(seed)?.status ?? randomGame(seed, initialContent, rules).status);
    expect(statuses).toContain('ended-2127');
    expect(statuses).toContain('ended-bankrupt');
  });

  it('la stessa partita è identica a parità di seme e storia', () => {
    const a = randomGame(7, initialContent, rules);
    expect(JSON.stringify(randomGame(7, initialContent, rules))).toBe(JSON.stringify(a));
    expect(JSON.stringify(replay(initial(7), a.history, rules, a.turn))).toBe(JSON.stringify(a));
  });
});
