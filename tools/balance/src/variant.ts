/**
 * Varianti in memoria: modifiche ai valori dei contenuti per provarle senza
 * toccare i file di packages/content.
 *
 * Una variante è un file JSON con un elenco di modifiche:
 *   [{ "file": "parametri", "path": "economy.servicesCostPerYear", "value": 36 }]
 * Se il valore indicato è un numero annotato ({ "valore", "stima", ... }) e il
 * nuovo valore è un numero, cambia solo "valore". Negli elenchi un elemento si
 * indica con la posizione o con il suo id.
 */
import { readFileSync } from 'node:fs';
import { CONTENT_FILES, type ContentFiles } from '@taranto2127/content';

export interface Patch {
  file: keyof ContentFiles;
  path: string;
  value: unknown;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function child(node: unknown, key: string, where: string): unknown {
  if (Array.isArray(node)) {
    const found = /^\d+$/.test(key) ? node[Number(key)] : node.find((item) => isRecord(item) && item.id === key);
    if (found === undefined) throw new Error(`variante: ${where} non trovato`);
    return found;
  }
  if (!isRecord(node) || !Object.hasOwn(node, key)) throw new Error(`variante: ${where} non trovato`);
  return node[key];
}

/** Applica le modifiche a una copia dei file dei contenuti. */
export function applyPatches(files: ContentFiles, patches: readonly Patch[]): ContentFiles {
  const out = structuredClone(files);
  for (const patch of patches) {
    if (!Object.hasOwn(out, patch.file)) throw new Error(`variante: file inesistente ${patch.file}`);
    const keys = patch.path.split('.');
    const last = keys.pop()!;
    let node: unknown = out[patch.file];
    keys.forEach((key, i) => (node = child(node, key, `${patch.file}:${keys.slice(0, i + 1).join('.')}`)));
    const container = node as Record<string, unknown> | unknown[];
    const index = Array.isArray(container)
      ? /^\d+$/.test(last)
        ? Number(last)
        : container.findIndex((item) => isRecord(item) && item.id === last)
      : last;
    const current = (container as Record<string | number, unknown>)[index];
    if (isRecord(current) && typeof current.valore === 'number' && typeof patch.value === 'number') {
      current.valore = patch.value;
    } else {
      (container as Record<string | number, unknown>)[index] = structuredClone(patch.value);
    }
  }
  return out;
}

export function readVariant(path: string): Patch[] {
  const patches = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!Array.isArray(patches)) throw new Error('variante: serve un elenco di modifiche');
  return patches as Patch[];
}

/** I file dei contenuti con le modifiche della variante, o quelli veri se non ce ne sono. */
export const contentFilesWith = (patches: readonly Patch[] = []): ContentFiles =>
  patches.length === 0 ? CONTENT_FILES : applyPatches(CONTENT_FILES, patches);
