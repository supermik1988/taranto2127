import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function restrictedErrors(code: string, filePath: string): Promise<number> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-properties').length;
}

// ESLint impiega qualche secondo ad avviarsi, di più quando la macchina è carica.
describe('regola di lint sul determinismo (CLAUDE.md, regola 3)', { timeout: 30_000 }, () => {
  for (const pkg of ['sim', 'agents']) {
    it(`vieta Math.random e Date.now in ${pkg}`, async () => {
      const file = `${root}packages/${pkg}/src/esempio.ts`;
      expect(await restrictedErrors('export const r = Math.random();\n', file)).toBe(1);
      expect(await restrictedErrors('export const t = Date.now();\n', file)).toBe(1);
    });
  }

  it('non li vieta fuori da sim e agents', async () => {
    const file = `${root}packages/voices/src/esempio.ts`;
    expect(await restrictedErrors('export const r = Math.random() + Date.now();\n', file)).toBe(0);
  });
});
