/** La Cronaca: fino a tre titoli sull'anno appena chiuso, dai cambiamenti più forti. */
import type { LoadedContent } from '@taranto2127/content';
import { DISTRICT_IDS, type GameState } from '@taranto2127/sim';

interface Event {
  priority: number;
  text: string;
}

const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (m, key: string) => values[key] ?? m);

const choiceOf = (actId: string): string => actId.slice(0, actId.lastIndexOf(':'));

export function chronicle(prev: GameState, next: GameState, content: LoadedContent): string[] {
  const { headlines, thresholds } = content.chronicle;
  const projectName = (definitionId: string) => content.texts.projects[definitionId]?.nome ?? definitionId;
  const events: Event[] = [];
  const add = (priority: number, key: string, values: Record<string, string> = {}) =>
    events.push({ priority, text: fill(headlines[key] ?? key, values) });

  if (next.status === 'ended-bankrupt') add(100, 'dissesto');
  if (next.status === 'ended-abandoned') add(100, 'abbandono');
  if (next.status === 'ended-2127') add(100, 'fine');

  const seen = new Set<string>();
  for (const scandal of next.moral.scandals.slice(prev.moral.scandals.length)) {
    const choice = choiceOf(scandal.actId);
    if (seen.has(choice)) continue;
    seen.add(choice);
    const source = scandal.source;
    if (source?.kind === 'shortcut') {
      const project = next.projects.find((p) => p.id === source.projectId);
      add(90, 'scandalo-scorciatoia', { progetto: projectName(project?.definitionId ?? source.projectId) });
    } else if (source?.kind === 'dilemma') {
      add(90, 'scandalo-dilemma', { dilemma: content.texts.dilemmas[source.dilemmaId]?.titolo ?? source.dilemmaId });
    } else add(90, 'scandalo');
  }

  for (const promise of next.promises) {
    const before = prev.promises.find((p) => p.id === promise.id);
    if (before?.status !== 'open' || promise.status === 'open') continue;
    add(promise.status === 'broken' ? 80 : 75, promise.status === 'broken' ? 'promessa-tradita' : 'promessa-mantenuta', {
      promessa: promise.text,
    });
  }

  for (const project of next.projects) {
    const before = prev.projects.find((p) => p.id === project.id);
    if (before === undefined) continue;
    const name = projectName(project.definitionId);
    if (before.phase !== 'operating' && project.phase === 'operating') add(60, 'in-esercizio', { progetto: name });
    else if (before.phase !== 'works' && project.phase === 'works') add(50, 'cantiere-apre', { progetto: name });
    if (!before.worksStalled && project.worksStalled) add(55, 'cantiere-fermo', { progetto: name });
  }

  for (const id of DISTRICT_IDS) {
    const a = prev.districts[id];
    const b = next.districts[id];
    const quartiere = content.texts.districts[id]?.nome ?? id;
    const checks: [number, number, string][] = [
      [a.trust - b.trust, thresholds.trust, 'quartiere-fiducia'],
      [a.health - b.health, thresholds.health, 'quartiere-salute'],
      [a.airQuality - b.airQuality, thresholds.air, 'quartiere-aria'],
      [b.tension - a.tension, thresholds.tension, 'quartiere-tensione'],
    ];
    // Per ogni quartiere, solo il peggioramento più forte rispetto alla sua soglia.
    const worst = checks.filter(([drop, threshold]) => threshold > 0 && drop >= threshold).sort((x, y) => y[0] / y[1] - x[0] / x[1])[0];
    if (worst !== undefined) add(40 + Math.min(9, worst[0] / worst[1]), worst[2], { quartiere });
  }

  const top = events
    .map((e, i) => ({ ...e, i }))
    .sort((x, y) => y.priority - x.priority || x.i - y.i)
    .slice(0, 3)
    .map((e) => e.text);
  return top.length === 0 ? [headlines['nessuna'] ?? ''] : top;
}
