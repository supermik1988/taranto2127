/**
 * Regola di lint sul determinismo, versione breve: controlla la configurazione
 * di ESLint senza avviarlo. La prova che fa girare ESLint su codice di esempio
 * sta in `determinism-lint.lungo.ts` (`pnpm test:lungo`); in `pnpm test` la
 * regola si applica comunque a tutto il codice con `eslint .`.
 */
import { describe, expect, it } from 'vitest';

type Entry = { files?: (string | string[])[]; rules?: Record<string, unknown> };
type Restricted = { object: string; property: string; message?: string };

// eslint.config.js è JavaScript senza tipi: lo si importa da un percorso in variabile, con il tipo dichiarato qui.
const configPath = '../../../eslint.config.js';
const { default: config, DETERMINISM_MESSAGE } = (await import(configPath)) as { default: Entry[]; DETERMINISM_MESSAGE: string };

const entries = config.filter((e) => e.rules?.['no-restricted-properties'] !== undefined);
const patterns = entries.flatMap((e) => (e.files ?? ['**']).flat());

describe('regola di lint sul determinismo (CLAUDE.md, regola 3), configurazione', () => {
  for (const pkg of ['sim', 'agents']) {
    it(`vieta Math.random e Date.now in ${pkg}`, () => {
      const entry = entries.find((e) => (e.files ?? []).flat().some((p) => p.startsWith(`packages/${pkg}/`)));
      expect(entry, pkg).toBeDefined();
      const [level, ...banned] = entry!.rules!['no-restricted-properties'] as [string, ...Restricted[]];
      expect(level).toBe('error');
      expect(banned).toContainEqual({ object: 'Math', property: 'random', message: DETERMINISM_MESSAGE });
      expect(banned).toContainEqual({ object: 'Date', property: 'now', message: DETERMINISM_MESSAGE });
    });
  }

  it('non li vieta fuori da sim e agents', () => {
    expect(patterns.length).toBeGreaterThan(0);
    for (const p of patterns) expect(p.startsWith('packages/sim/') || p.startsWith('packages/agents/'), p).toBe(true);
  });
});
