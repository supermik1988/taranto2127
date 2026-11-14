/**
 * Percorsi verso le variabili dello stato, es. "districts.tamburi.health" o
 * "council.cons-lavoro.trustInPlayer". Negli elenchi di oggetti con `id`
 * l'elemento si indica con il suo id. Il Consiglio si indica solo per id:
 * la posizione cambia quando il Consiglio si rinnova.
 */

export class PathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathError';
  }
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
/** Elenchi in cui la posizione non è ammessa: solo l'id. */
const ID_ONLY_LISTS = new Set(['council']);

function step(node: unknown, key: string, parentKey: string | undefined, path: string): unknown {
  if (FORBIDDEN_KEYS.has(key)) throw new PathError(`${path}: percorso inesistente`);
  if (Array.isArray(node)) {
    if (/^\d+$/.test(key)) {
      if (parentKey !== undefined && ID_ONLY_LISTS.has(parentKey)) {
        throw new PathError(`${path}: un consigliere si indica con il suo id, non con la posizione`);
      }
      if (Number(key) >= node.length) throw new PathError(`${path}: percorso inesistente`);
      return node[Number(key)];
    }
    const found = node.find((item: unknown) => typeof item === 'object' && item !== null && (item as { id?: unknown }).id === key);
    if (found === undefined) throw new PathError(`${path}: percorso inesistente`);
    return found;
  }
  if (typeof node !== 'object' || node === null || !Object.hasOwn(node, key)) {
    throw new PathError(`${path}: percorso inesistente`);
  }
  return (node as Record<string, unknown>)[key];
}

/** L'oggetto che contiene la variabile indicata dal percorso, e il nome del campo. */
export function resolveContainer(root: unknown, path: string): { container: Record<string, unknown>; field: string } {
  const keys = path.split('.');
  const field = keys.pop();
  if (field === undefined || field === '') throw new PathError(`${path}: percorso vuoto`);
  let node = root;
  let parentKey: string | undefined;
  for (const key of keys) {
    node = step(node, key, parentKey, path);
    parentKey = key;
  }
  // Controlla che il campo esista come proprietà propria (e non come elemento di un elenco).
  if (Array.isArray(node) || typeof node !== 'object' || node === null || FORBIDDEN_KEYS.has(field) || !Object.hasOwn(node, field)) {
    throw new PathError(`${path}: percorso inesistente`);
  }
  return { container: node as Record<string, unknown>, field };
}

/** Legge il valore indicato dal percorso. */
export function readPath(root: unknown, path: string): unknown {
  const { container, field } = resolveContainer(root, path);
  return container[field];
}
