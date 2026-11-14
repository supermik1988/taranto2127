/**
 * Una partita dal terminale come macchina a stati: riceve una riga di comando,
 * restituisce il testo da mostrare. Così la si può pilotare anche da un copione.
 */
import { adviseCouncil } from '@taranto2127/agents';
import { loadContent, type LoadedContent } from '@taranto2127/content';
import {
  ActionError,
  BUILD_PHASES,
  MAX_FREE_ACTIONS_PER_TURN,
  TurnError,
  advanceTurn,
  applyAction,
  createInitialState,
  epochOfTurn,
  freeActionsUsed,
  yearOfTurn,
  type Action,
  type ActivePath,
  type GameState,
} from '@taranto2127/sim';
import { chronicle } from './chronicle.js';
import { describeOption, describePolicy, describeProject, fmt, projectForecast, wrap } from './describe.js';
import { saveGame } from './save.js';
import { HELP, WIDTH, councilScreen, portraitScreen, yearScreen } from './screens.js';

type Mode =
  | { kind: 'main' }
  | { kind: 'pick'; title: string; items: { label: string; next: () => string[] }[] }
  | { kind: 'confirm'; action: Action; after: string[] };

const PATHS: ActivePath[] = ['green-steel', 'remediation', 'energy', 'sea-culture'];
const PATH_NAMES: Record<ActivePath, string> = {
  'green-steel': 'acciaio verde',
  remediation: 'bonifica',
  energy: 'energia rinnovabile',
  'sea-culture': 'mare e cultura',
};
const PHASE_NAMES: Record<string, string> = { permitting: 'autorizzazioni', tender: 'gara' };

export interface SessionOptions {
  seed?: number;
  state?: GameState;
  content?: LoadedContent;
}

export class PlaySession {
  readonly content: LoadedContent;
  state: GameState;
  /** Stato dell'anno prima, per le frecce della schermata. */
  prev: GameState | undefined;
  readonly initial: GameState;
  private mode: Mode = { kind: 'main' };
  quit = false;

  constructor(options: SessionOptions = {}) {
    this.content = options.content ?? loadContent();
    const seed = options.state?.seed ?? options.seed ?? 1;
    this.initial = createInitialState(seed, this.content.initialContent);
    this.state = options.state ?? this.initial;
  }

  /** Schermata iniziale. */
  start(): string {
    return this.render([...this.intro(), '', ...this.screen()]);
  }

  private intro(): string[] {
    return [
      'TARANTO2127 — sei la coscienza della città, dal 2027 al 2127.',
      `Seme ${this.state.seed}. Scrivi ? per l'elenco dei comandi.`,
    ];
  }

  private screen(): string[] {
    return this.state.status === 'running'
      ? [...yearScreen(this.state, this.prev, this.content), '', 'Comandi: a · aa · c · p · l · o · s · d · v · salva · ? · q']
      : portraitScreen(this.initial, this.state, this.content);
  }

  private render(lines: string[]): string {
    return lines.flatMap((line) => wrap(line, WIDTH)).join('\n');
  }

  /** Elabora una riga di comando e restituisce il testo da mostrare. */
  handle(input: string): string {
    const line = input.trim();
    try {
      return this.render(this.dispatch(line));
    } catch (error) {
      if (error instanceof ActionError || error instanceof TurnError) {
        this.mode = { kind: 'main' };
        return this.render([`Non si può: ${error.message}`]);
      }
      throw error;
    }
  }

  private dispatch(line: string): string[] {
    const mode = this.mode;
    if (mode.kind === 'pick') {
      if (line === '0' || line === 'n' || line === '') {
        this.mode = { kind: 'main' };
        return ['Annullato.'];
      }
      const index = Number(line) - 1;
      const item = mode.items[index];
      if (!Number.isInteger(index) || item === undefined) return [`Scegli un numero da 1 a ${mode.items.length}, oppure 0 per tornare.`];
      return item.next();
    }
    if (mode.kind === 'confirm') {
      this.mode = { kind: 'main' };
      if (line !== 's' && line !== 'si' && line !== 'sì') return ['Annullato.'];
      this.state = applyAction(this.state, mode.action, this.content.rules);
      const left = MAX_FREE_ACTIONS_PER_TURN - freeActionsUsed(this.state);
      return ['Fatto.', ...mode.after, `Azioni libere rimaste quest'anno: ${Math.max(0, left)}.`];
    }

    const [command, ...rest] = line.split(/\s+/);
    if (command === 'q' || command === 'esci') {
      this.quit = true;
      return ['Arrivederci.'];
    }
    if (command === '?' || command === 'aiuto') return HELP;
    if (command === 'v' || command === '') return this.screen();
    if (command === 'salva') {
      const path = rest[0] ?? `taranto2127-seme${this.state.seed}-${yearOfTurn(this.state.turn)}.json`;
      saveGame(path, this.state);
      return [`Partita salvata in ${path}. Per riprenderla: pnpm play -- --carica ${path}`];
    }
    if (this.state.status !== 'running') return portraitScreen(this.initial, this.state, this.content);
    switch (command) {
      case 'a':
        return this.advance(1);
      case 'aa':
        return this.advance(10);
      case 'c':
        return councilScreen(adviseCouncil(this.state, this.content.rules, this.content.council, this.content.councilLabels));
      case 'p':
        return this.pickProject();
      case 'l':
        return this.pickLot();
      case 'o':
        return this.pickPolicy();
      case 's':
        return this.pickShortcut();
      case 'd':
        return this.dilemma();
      default:
        return [`Comando sconosciuto: ${line}. Scrivi ? per l'elenco.`];
    }
  }

  // ---------- Avanzare ----------

  /** Avanza di un anno, o fino a `max` anni fermandosi a un dilemma, a una fase che finisce o a un cambio d'epoca. */
  private advance(max: number): string[] {
    if (this.state.openDilemmaId !== null) return ['C\'è un dilemma aperto: rispondi con d prima di chiudere l\'anno.'];
    const out: string[] = [];
    for (let i = 0; i < max && this.state.status === 'running'; i++) {
      const before = this.state;
      const after = advanceTurn(before, this.content.rules);
      this.prev = before;
      this.state = after;
      out.push(`── Cronaca del ${yearOfTurn(before.turn)} ──`, ...chronicle(before, after, this.content).map((t) => `  ${t}`));
      const phaseChanged = after.projects.some((p) => before.projects.find((q) => q.id === p.id)?.phase !== p.phase);
      const epochChanged = epochOfTurn(Math.min(after.turn, 99)) !== epochOfTurn(before.turn);
      if (after.openDilemmaId !== null || phaseChanged || epochChanged) break;
    }
    return [...out, '', ...this.screen()];
  }

  // ---------- Menu ----------

  private pick(title: string, items: { label: string; next: () => string[] }[], empty: string): string[] {
    if (items.length === 0) return [empty];
    this.mode = { kind: 'pick', title, items };
    return [title, ...items.map((item, i) => `  ${i + 1}. ${item.label}`), '  0. torna indietro'];
  }

  private confirm(action: Action, description: string[], after: string[] = []): string[] {
    this.mode = { kind: 'confirm', action, after };
    return [...description, '', 'Confermi? (s/n)'];
  }

  private pickProject(): string[] {
    const lotDefs = new Set(Object.values(this.content.rules.lotConversion));
    const started = new Set(this.state.projects.filter((p) => p.phase !== 'cancelled').map((p) => p.definitionId));
    const defs = Object.values(this.content.rules.projects).filter((d) => !lotDefs.has(d.id) && !(d.unique === true && started.has(d.id)));
    return this.pick(
      'Quale progetto avviare?',
      defs.map((def) => {
        const f = projectForecast(def);
        return {
          label: `${this.content.texts.projects[def.id]?.nome ?? def.id} (${f.minYears}-${f.maxYears} anni, ${fmt(f.minCost)}-${fmt(f.maxCost)} M€)`,
          next: () => this.confirm({ kind: 'start-project', definitionId: def.id }, describeProject(def, this.content)),
        };
      }),
      'Nessun progetto disponibile.',
    );
  }

  private pickLot(): string[] {
    return this.pick(
      'Quale lotto di ILSIDER?',
      this.state.plantLots.map((lot) => ({
        label: `${this.content.texts.plantLots[lot.id]?.nome ?? lot.id}: ${lot.path === 'idle' ? 'fermo' : `${PATH_NAMES[lot.path as ActivePath]}, ${fmt(lot.progress * 100)}%`}${lot.remediated ? ', bonificato' : ''}`,
        next: () =>
          this.pick(
            `Che cosa fare del lotto «${this.content.texts.plantLots[lot.id]?.nome ?? lot.id}»?`,
            [
              ...PATHS.filter((p) => p !== lot.path).map((path) => {
                const def = this.content.rules.projects[this.content.rules.lotConversion[path]]!;
                return {
                  label: PATH_NAMES[path],
                  next: () =>
                    this.confirm({ kind: 'convert-lot', lotId: lot.id, path }, [
                      `Destinare il lotto a ${PATH_NAMES[path]}${lot.path !== 'idle' ? ' (il progetto in corso sul lotto si annulla)' : ''}:`,
                      ...describeProject(def, this.content),
                    ]),
                };
              }),
              ...(lot.path === 'idle'
                ? []
                : [{ label: 'fermare il lotto', next: () => this.confirm({ kind: 'convert-lot', lotId: lot.id, path: 'idle' }, ['Il progetto in corso sul lotto si annulla.']) }]),
            ],
            'Nessuna scelta.',
          ),
      })),
      'Nessun lotto.',
    );
  }

  private pickPolicy(): string[] {
    return this.pick(
      'Quale politica?',
      Object.values(this.content.rules.policies).map((def) => {
        const active = this.state.activePolicies.includes(def.id);
        const name = this.content.texts.policies[def.id]?.nome ?? def.id;
        return {
          label: `${name} (${fmt(def.annualCost, 1)} M€/anno) ${active ? '— ATTIVA' : ''}`,
          next: () =>
            this.confirm({ kind: 'set-policy', policyId: def.id, active: !active }, [
              active ? `Spegnere «${name}»:` : `Accendere «${name}» (vale dall'anno prossimo):`,
              ...describePolicy(def, this.content),
            ]),
        };
      }),
      'Nessuna politica.',
    );
  }

  private pickShortcut(): string[] {
    const projects = this.state.projects.filter((p) => p.phase === 'permitting' || p.phase === 'tender');
    return this.pick(
      'Quale fase saltare?',
      projects.map((p) => {
        const def = this.content.rules.projects[p.definitionId]!;
        const name = this.content.texts.projects[p.definitionId]?.nome ?? p.definitionId;
        const phase = PHASE_NAMES[p.phase]!;
        const cost = def.phases[p.phase as (typeof BUILD_PHASES)[number]].annualCost * p.turnsLeftInPhase;
        return {
          label: `${name}: ${phase}, ${p.turnsLeftInPhase} anni`,
          next: () =>
            this.confirm(
              { kind: 'shortcut-phase', projectId: p.id },
              [`Saltare la fase di ${phase} di «${name}»: guadagni ${p.turnsLeftInPhase} anni e non spendi ${fmt(cost, 1)} M€.`],
              ['Questa era una scelta nascosta: i cittadini non lo sanno. Per ora.'],
            ),
        };
      }),
      'Nessun cantiere in autorizzazione o in gara.',
    );
  }

  private dilemma(): string[] {
    const id = this.state.openDilemmaId;
    if (id === null) return ['Nessun dilemma aperto.'];
    const def = this.content.rules.dilemmas[id]!;
    const text = this.content.texts.dilemmas[id]!;
    const options = Object.entries(def.options);
    const intro = [`═══ ${text.titolo} ═══`, text.testo, ''];
    this.mode = {
      kind: 'pick',
      title: text.titolo,
      items: options.map(([optionId, option]) => ({
        label: text.options[optionId]!.etichetta,
        next: () =>
          this.confirm(
            { kind: 'answer-dilemma', dilemmaId: id, optionId },
            [`Scelta: ${text.options[optionId]!.etichetta}`],
            option.hidden ? ['Questa era una scelta nascosta: nessuno lo sa, per ora.'] : [],
          ),
      })),
    };
    const lines = options.flatMap(([optionId, option], i) =>
      describeOption(option, `  ${i + 1}. ${text.options[optionId]!.etichetta}`, text.options[optionId]!.conseguenze, this.content),
    );
    return [...intro, ...lines, '  0. torna indietro'];
  }
}

export function newSession(options: SessionOptions = {}): PlaySession {
  return new PlaySession(options);
}
