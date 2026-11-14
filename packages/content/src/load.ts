/**
 * Caricatore dei contenuti di gioco. Legge i file JSON di `data/`, li valida
 * contro gli schemi di `schema/`, toglie le annotazioni (stima o fonte) e i
 * testi, e restituisce i dati nella forma che `packages/sim` si aspetta.
 */
import type { CouncilLabels, CouncilRules } from '@taranto2127/agents';
import type { ActivePath, DistrictId, InitialContent, ProjectPhase, TurnRules } from '@taranto2127/sim';
import Ajv from 'ajv';
import citta from '../data/citta.json';
import clima from '../data/clima.json';
import consiglio from '../data/consiglio.json';
import cronaca from '../data/cronaca.json';
import spiegazioni from '../data/spiegazioni.json';
import guida from '../data/guida.json';
import dilemmi from '../data/dilemmi.json';
import parametri from '../data/parametri.json';
import partenza from '../data/partenza.json';
import politiche from '../data/politiche.json';
import progetti from '../data/progetti.json';
import quartieri from '../data/quartieri.json';
import cittaSchema from '../schema/citta.schema.json';
import climaSchema from '../schema/clima.schema.json';
import consiglioSchema from '../schema/consiglio.schema.json';
import cronacaSchema from '../schema/cronaca.schema.json';
import spiegazioniSchema from '../schema/spiegazioni.schema.json';
import guidaSchema from '../schema/guida.schema.json';
import comuneSchema from '../schema/comune.schema.json';
import dilemmiSchema from '../schema/dilemmi.schema.json';
import parametriSchema from '../schema/parametri.schema.json';
import partenzaSchema from '../schema/partenza.schema.json';
import politicheSchema from '../schema/politiche.schema.json';
import progettiSchema from '../schema/progetti.schema.json';
import quartieriSchema from '../schema/quartieri.schema.json';

export class ContentError extends Error {
  constructor(readonly errors: readonly string[]) {
    super(`Contenuti non validi:\n- ${errors.join('\n- ')}`);
    this.name = 'ContentError';
  }
}

/** I file di dati, per nome. Si possono sostituire nei test. */
export interface ContentFiles {
  quartieri: unknown;
  partenza: unknown;
  clima: unknown;
  progetti: unknown;
  politiche: unknown;
  dilemmi: unknown;
  parametri: unknown;
  citta: unknown;
  consiglio: unknown;
  cronaca: unknown;
  spiegazioni: unknown;
  guida: unknown;
}

export const CONTENT_FILES: ContentFiles = {
  quartieri,
  partenza,
  clima,
  progetti,
  politiche,
  dilemmi,
  parametri,
  citta,
  consiglio,
  cronaca,
  spiegazioni,
  guida,
};

const SCHEMAS: Record<keyof ContentFiles, object> = {
  quartieri: quartieriSchema,
  partenza: partenzaSchema,
  clima: climaSchema,
  progetti: progettiSchema,
  politiche: politicheSchema,
  dilemmi: dilemmiSchema,
  parametri: parametriSchema,
  citta: cittaSchema,
  consiglio: consiglioSchema,
  cronaca: cronacaSchema,
  spiegazioni: spiegazioniSchema,
  guida: guidaSchema,
};

// strictRequired spento: quartieri e settori sono chiavi obbligatorie elencate con propertyNames, non con properties.
const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
ajv.addSchema(comuneSchema);
const validators = Object.fromEntries(
  Object.entries(SCHEMAS).map(([name, schema]) => [name, ajv.compile(schema)]),
) as Record<keyof ContentFiles, ReturnType<typeof ajv.compile>>;

/** Controlla ogni file contro il suo schema. Restituisce l'elenco degli errori, vuoto se tutto va bene. */
export function validateContentFiles(files: ContentFiles = CONTENT_FILES): string[] {
  const errors: string[] = [];
  for (const name of Object.keys(SCHEMAS) as (keyof ContentFiles)[]) {
    const validate = validators[name];
    if (!validate(files[name])) {
      for (const e of validate.errors ?? []) errors.push(`${name}.json${e.instancePath}: ${e.message ?? 'non valido'}`);
    }
  }
  return errors;
}

/** Chiavi dei testi in italiano: servono a interfaccia e voci, non al motore. */
const TEXT_KEYS = new Set(['nome', 'descrizione', 'titolo', 'testo', 'etichetta', 'conseguenze', 'tema']);

const isAnnotated = (value: unknown): value is { valore: number } =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && typeof (value as { valore?: unknown }).valore === 'number';

/** Sostituisce ogni numero annotato con il suo valore e toglie i testi. */
export function toEngineData(value: unknown): unknown {
  if (isAnnotated(value)) return value.valore;
  if (Array.isArray(value)) return value.map(toEngineData);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !TEXT_KEYS.has(key))
        .map(([key, child]) => [key, toEngineData(child)]),
    );
  }
  return value;
}

/** Testi per interfaccia e voci, divisi per tipo di oggetto e per identificativo. */
export interface ContentTexts {
  districts: Record<string, { nome: string; descrizione: string }>;
  plantLots: Record<string, { nome: string; descrizione: string }>;
  council: Record<string, { descrizione: string }>;
  climateScenario: { nome: string; descrizione: string };
  projects: Record<string, { nome: string; descrizione: string }>;
  policies: Record<string, { nome: string; descrizione: string }>;
  dilemmas: Record<
    string,
    { tema: string; titolo: string; testo: string; options: Record<string, { etichetta: string; conseguenze: string }> }
  >;
}

type Named = { id?: string; nome: string; descrizione: string };

function texts(files: ContentFiles): ContentTexts {
  const q = files.quartieri as { districts: Record<string, Named> };
  const p = files.partenza as { plantLots: Named[]; council: { id: string; descrizione: string }[] };
  const c = files.clima as { climateScenario: Named };
  const pr = files.progetti as { projects: Record<string, Named> };
  const po = files.politiche as { policies: Record<string, Named> };
  const d = files.dilemmi as {
    dilemmas: Record<string, { tema: string; titolo: string; testo: string; options: Record<string, { etichetta: string; conseguenze: string }> }>;
  };
  const pick = ({ nome, descrizione }: Named) => ({ nome, descrizione });
  const byKey = (record: Record<string, Named>) =>
    Object.fromEntries(Object.entries(record).map(([key, value]) => [key, pick(value)]));
  return {
    districts: byKey(q.districts),
    plantLots: Object.fromEntries(p.plantLots.map((lot) => [lot.id!, pick(lot)])),
    council: Object.fromEntries(p.council.map((member) => [member.id, { descrizione: member.descrizione }])),
    climateScenario: pick(c.climateScenario),
    projects: byKey(pr.projects),
    policies: byKey(po.policies),
    dilemmas: Object.fromEntries(
      Object.entries(d.dilemmas).map(([id, dilemma]) => [
        id,
        {
          tema: dilemma.tema,
          titolo: dilemma.titolo,
          testo: dilemma.testo,
          options: Object.fromEntries(
            Object.entries(dilemma.options).map(([optionId, o]) => [optionId, { etichetta: o.etichetta, conseguenze: o.conseguenze }]),
          ),
        },
      ]),
    ),
  };
}

/** Controlli che lo schema non esprime: identificativi coerenti, minimi sotto i massimi, riferimenti esistenti. */
export function checkConsistency(rules: TurnRules): string[] {
  const errors: string[] = [];
  for (const [key, project] of Object.entries(rules.projects)) {
    if (project.id !== key) errors.push(`progetti: la chiave ${key} non coincide con l'id ${project.id}`);
    for (const [phase, spec] of Object.entries(project.phases)) {
      if (spec.minTurns > spec.maxTurns) errors.push(`progetti.${key}.${phase}: minimo maggiore del massimo`);
    }
  }
  for (const [path, id] of Object.entries(rules.lotConversion)) {
    if (!Object.hasOwn(rules.projects, id)) errors.push(`lotConversion.${path}: progetto inesistente ${id}`);
  }
  for (const [key, policy] of Object.entries(rules.policies)) {
    if (policy.id !== key) errors.push(`politiche: la chiave ${key} non coincide con l'id ${policy.id}`);
  }
  for (const [key, dilemma] of Object.entries(rules.dilemmas)) {
    if (dilemma.id !== key) errors.push(`dilemmi: la chiave ${key} non coincide con l'id ${dilemma.id}`);
    if (dilemma.firstTurn > dilemma.lastTurn) errors.push(`dilemmi.${key}: primo turno dopo l'ultimo`);
  }
  for (const tranche of rules.economy.euTranches) {
    if (tranche.expiresInYear < tranche.arrivesInYear) errors.push(`parametri: la rata ${tranche.id} scade prima di arrivare`);
  }
  return errors;
}

/** Titoli della Cronaca e soglie di variazione oltre le quali se ne parla. */
export interface ChronicleTexts {
  thresholds: { trust: number; health: number; air: number; tension: number };
  headlines: Record<string, string>;
}

/** Frasi della spiegazione dei quartieri (vedi explainDistrict nel motore). */
export interface ExplanationTexts {
  quantities: Record<string, string>;
  toward: Record<string, string>;
  factors: Record<string, string>;
  lotStates: Record<string, string>;
}

/** Guida al gioco: visita, come si gioca, glossario, bilancio, fermate del tempo. Solo per l'interfaccia. */
export interface GuideTexts {
  tour: { id: string; titolo: string; testo: string; bersaglio: string }[];
  howTo: { titolo: string; paragrafi: string[] }[];
  glossary: Record<string, { termine: string; spiegazione: string }>;
  budget: {
    fondi: Record<'own' | 'state' | 'eu-earmarked', { nome: string; puoPagare: string }>;
    voci: Record<string, string>;
    nota: string;
    disavanzo: string;
    dissestoOra: string;
    inAttivo: string;
    capacita: string;
    cantieriFermi: string;
    motiviFermo: Record<'funds' | 'capacity' | 'frozen', string>;
  };
  stops: Record<string, string> & { esiti: Record<'kept' | 'broken' | 'open', string> };
  time: { avvia: string; pausa: string; unAnno: string; velocita: string[]; secondiPerAnno: number[]; inPausa: string; inCorso: string };
}

export interface LoadedContent {
  initialContent: InitialContent;
  rules: TurnRules;
  texts: ContentTexts;
  council: CouncilRules;
  councilLabels: CouncilLabels;
  chronicle: ChronicleTexts;
  explanations: ExplanationTexts;
  guide: GuideTexts;
}

/**
 * Carica i contenuti: valida gli schemi e la coerenza, poi restituisce i dati
 * per il motore e i testi. Lancia `ContentError` se qualcosa non va.
 */
export function loadContent(files: ContentFiles = CONTENT_FILES): LoadedContent {
  const schemaErrors = validateContentFiles(files);
  if (schemaErrors.length > 0) throw new ContentError(schemaErrors);

  const q = toEngineData(files.quartieri) as { districts: InitialContent['districts'] };
  const p = toEngineData(files.partenza) as Omit<InitialContent, 'districts'>;
  const c = toEngineData(files.clima) as Pick<TurnRules, 'climateScenario'>;
  const pr = toEngineData(files.progetti) as Pick<TurnRules, 'projects' | 'lotConversion'>;
  const po = toEngineData(files.politiche) as Pick<TurnRules, 'policies'>;
  const d = toEngineData(files.dilemmi) as Pick<TurnRules, 'dilemmas'>;
  const pa = toEngineData(files.parametri) as Pick<TurnRules, 'dilemmaArrivalProbability' | 'moral' | 'economy'>;
  const city = toEngineData(files.citta) as TurnRules['city'];

  const initialContent: InitialContent = {
    calibrationVersion: p.calibrationVersion,
    districts: q.districts as Record<DistrictId, InitialContent['districts'][DistrictId]>,
    labor: p.labor,
    economy: p.economy,
    climate: p.climate,
    plantLots: p.plantLots,
    council: p.council,
  };
  const rules: TurnRules = {
    city,
    projects: pr.projects,
    dilemmas: d.dilemmas,
    dilemmaArrivalProbability: pa.dilemmaArrivalProbability,
    policies: po.policies,
    moral: pa.moral,
    economy: pa.economy,
    lotConversion: pr.lotConversion,
    climateScenario: c.climateScenario,
  };
  const lotIds = new Set(initialContent.plantLots.map((l) => l.id));
  const consistencyErrors = [
    ...checkConsistency(rules),
    ...Object.keys(rules.city.air.lotWeights).filter((id) => !lotIds.has(id)).map((id) => `citta.air.lotWeights: lotto inesistente ${id}`),
    ...[...lotIds].filter((id) => !(id in rules.city.air.lotWeights)).map((id) => `citta.air.lotWeights: manca il lotto ${id}`),
  ];
  if (consistencyErrors.length > 0) throw new ContentError(consistencyErrors);
  const allTexts = texts(files);
  const cons = toEngineData(files.consiglio) as CouncilRules & {
    pathNames: Record<ActivePath, string>;
    phaseNames: Partial<Record<ProjectPhase, string>>;
  };
  const council: CouncilRules = { patienceForShortcut: cons.patienceForShortcut, savingReason: cons.savingReason, visions: cons.visions };
  const councilErrors = Object.entries(council.visions).flatMap(([vision, v]) => [
    ...v.projects.filter((id) => !Object.hasOwn(rules.projects, id)).map((id) => `consiglio.${vision}: progetto inesistente ${id}`),
    ...v.policies.filter((id) => !Object.hasOwn(rules.policies, id)).map((id) => `consiglio.${vision}: politica inesistente ${id}`),
    ...(v.lotOrder ?? []).filter((id) => !lotIds.has(id)).map((id) => `consiglio.${vision}: lotto inesistente ${id}`),
  ]);
  if (councilErrors.length > 0) throw new ContentError(councilErrors);
  const names = (record: Record<string, { nome: string }>) => Object.fromEntries(Object.entries(record).map(([id, t]) => [id, t.nome]));
  const councilLabels: CouncilLabels = {
    projects: names(allTexts.projects),
    policies: names(allTexts.policies),
    lots: names(allTexts.plantLots),
    paths: cons.pathNames,
    phases: cons.phaseNames,
  };
  const k = toEngineData(files.cronaca) as { soglie: { fiducia: number; salute: number; aria: number; tensione: number }; titoli: Record<string, string> };
  const chronicle: ChronicleTexts = {
    thresholds: { trust: k.soglie.fiducia, health: k.soglie.salute, air: k.soglie.aria, tension: k.soglie.tensione },
    headlines: k.titoli,
  };
  const sp = files.spiegazioni as { grandezze: Record<string, string>; verso: Record<string, string>; fattori: Record<string, string>; statiLotto: Record<string, string> };
  const explanations: ExplanationTexts = { quantities: sp.grandezze, toward: sp.verso, factors: sp.fattori, lotStates: sp.statiLotto };
  const g = files.guida as {
    visita: GuideTexts['tour'];
    comeSiGioca: GuideTexts['howTo'];
    glossario: GuideTexts['glossary'];
    bilancio: GuideTexts['budget'];
    fermate: GuideTexts['stops'];
    tempo: GuideTexts['time'];
  };
  const guide: GuideTexts = { tour: g.visita, howTo: g.comeSiGioca, glossary: g.glossario, budget: g.bilancio, stops: g.fermate, time: toEngineData(g.tempo) as GuideTexts['time'] };
  return { initialContent, rules, texts: allTexts, council, councilLabels, chronicle, explanations, guide };
}
