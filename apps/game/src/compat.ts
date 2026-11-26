/**
 * Sostituti delle funzioni recenti che il motore e i contenuti usano (T12d):
 * `structuredClone`, `Object.hasOwn`, `.at()` su array, stringhe e array tipizzati.
 * Senza di loro, su un Chrome per Android anteriore alla 98 o su Safari per iOS
 * anteriore alla 15.4, il motore si ferma all'avvio e la pagina resta bianca.
 *
 * Si importa per primo in main.tsx: i moduli si eseguono nell'ordine degli import,
 * quindi i sostituti ci sono prima del motore. Ogni sostituto si installa solo se il
 * browser non ha già la funzione vera. Sintassi e funzioni dentro il bersaglio.
 */

/** Copia profonda dei dati del gioco: valori semplici, array, oggetti, date, Map, Set, array tipizzati. */
export function copiaProfonda<T>(valore: T, visti = new Map<unknown, unknown>()): T {
  if (valore === null || typeof valore !== 'object') return valore;
  if (visti.has(valore)) return visti.get(valore) as T;
  if (valore instanceof Date) return new Date(valore.getTime()) as T;
  if (ArrayBuffer.isView(valore)) return (valore as unknown as { slice: () => unknown }).slice() as T;
  if (valore instanceof Map) {
    const m = new Map();
    visti.set(valore, m);
    valore.forEach((v, k) => m.set(copiaProfonda(k, visti), copiaProfonda(v, visti)));
    return m as T;
  }
  if (valore instanceof Set) {
    const s = new Set();
    visti.set(valore, s);
    valore.forEach((v) => s.add(copiaProfonda(v, visti)));
    return s as T;
  }
  if (Array.isArray(valore)) {
    const a: unknown[] = [];
    visti.set(valore, a);
    for (let i = 0; i < valore.length; i++) a.push(copiaProfonda(valore[i], visti));
    return a as T;
  }
  const o: Record<string, unknown> = {};
  visti.set(valore, o);
  for (const k of Object.keys(valore)) o[k] = copiaProfonda((valore as Record<string, unknown>)[k], visti);
  return o as T;
}

function at<T>(this: ArrayLike<T>, indice: number): T | undefined {
  const n = Math.trunc(indice) || 0;
  const i = n < 0 ? this.length + n : n;
  return i < 0 || i >= this.length ? undefined : this[i];
}

const definisci = (dove: object, nome: string, valore: unknown) => {
  if (nome in dove) return;
  Object.defineProperty(dove, nome, { value: valore, writable: true, configurable: true, enumerable: false });
};

/** Installa i sostituti che mancano. Restituisce i nomi di quelli installati (per le prove e il messaggio di guasto). */
export function installaSostituti(g: typeof globalThis = globalThis): string[] {
  const installati: string[] = [];
  if (typeof (g as { structuredClone?: unknown }).structuredClone !== 'function') {
    definisci(g, 'structuredClone', (v: unknown) => copiaProfonda(v));
    installati.push('structuredClone');
  }
  if (typeof (Object as { hasOwn?: unknown }).hasOwn !== 'function') {
    definisci(Object, 'hasOwn', (o: object, k: PropertyKey) => Object.prototype.hasOwnProperty.call(o, k));
    installati.push('Object.hasOwn');
  }
  const tipizzato = Object.getPrototypeOf(Int8Array.prototype) as object;
  for (const [proto, nome] of [
    [Array.prototype, 'Array.prototype.at'],
    [String.prototype, 'String.prototype.at'],
    [tipizzato, 'TypedArray.prototype.at'],
  ] as const) {
    if (typeof (proto as { at?: unknown }).at !== 'function') {
      definisci(proto, 'at', at);
      installati.push(nome);
    }
  }
  return installati;
}

installaSostituti();
