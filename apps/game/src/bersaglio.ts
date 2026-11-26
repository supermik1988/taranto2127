/**
 * Compatibilità dichiarata (T12d): i browser minimi supportati, il bersaglio di
 * compilazione che li copre e le funzioni recenti che il gioco usa solo grazie a un
 * sostituto (compat.ts). Modulo puro: lo leggono vite.config.ts, compat.ts e la
 * verifica nel browser (controllo automatico della pagina compilata).
 */

/** Bersaglio della compilazione (esbuild, tramite Vite): la sintassi oltre questi browser viene tradotta. */
export const BERSAGLIO = ['es2020', 'chrome87', 'edge88', 'firefox78', 'safari15'];

/** I browser minimi, in parole (docs/GRAFICA.md, «Compatibilità e avvio»). */
export const BROWSER_MINIMI =
  'Chrome e Chrome per Android 87 (novembre 2020), Samsung Internet 14 (2021), Edge 88, Firefox 78, Safari e Safari per iOS 15 (2021)';

/**
 * Funzioni più recenti del bersaglio. Chi le usa senza sostituto rompe l'avvio sui
 * browser minimi: il controllo della pagina compilata le cerca tutte.
 * `minimo` dice da quale versione ci sono (Chrome / Safari).
 */
export const RECENTI: { nome: string; cerca: RegExp; minimo: string }[] = [
  { nome: 'structuredClone', cerca: /\bstructuredClone\b/, minimo: 'Chrome 98, Safari 15.4' },
  { nome: 'Object.hasOwn', cerca: /\bObject\.hasOwn\b/, minimo: 'Chrome 93, Safari 15.4' },
  { nome: 'Array.prototype.at', cerca: /\.at\(/, minimo: 'Chrome 92, Safari 15.4' },
  { nome: 'Array.prototype.findLast', cerca: /\.findLast(Index)?\(/, minimo: 'Chrome 97, Safari 15.4' },
  { nome: 'Array.prototype.toSorted', cerca: /\.to(Sorted|Reversed|Spliced)\(/, minimo: 'Chrome 110, Safari 16' },
  { nome: 'Object.groupBy', cerca: /\b(Object|Map)\.groupBy\b/, minimo: 'Chrome 117, Safari 17.4' },
  { nome: 'Promise.withResolvers', cerca: /\bPromise\.withResolvers\b/, minimo: 'Chrome 119, Safari 17.4' },
  { nome: 'Array.fromAsync', cerca: /\bArray\.fromAsync\b/, minimo: 'Chrome 121, Safari 16.4' },
  { nome: 'crypto.randomUUID', cerca: /\.randomUUID\(/, minimo: 'Chrome 92, Safari 15.4' },
  { nome: 'AbortSignal.timeout', cerca: /\bAbortSignal\.timeout\b/, minimo: 'Chrome 103, Safari 16' },
  { nome: 'String.prototype.isWellFormed', cerca: /\.(isWellFormed|toWellFormed)\(/, minimo: 'Chrome 111, Safari 16.4' },
  { nome: 'requestIdleCallback', cerca: /\brequestIdleCallback\b/, minimo: 'Chrome 47, Safari nessuno' },
];

/** Funzioni recenti coperte da un sostituto in compat.ts (caricato prima di tutto il resto). */
export const SOSTITUITE = ['structuredClone', 'Object.hasOwn', 'Array.prototype.at'];
