/** T12: l'elenco degli elementi grafici è completo (origine, licenza, approvazione) e punta a file che esistono. */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const radice = new URL('../../../../', import.meta.url);
const elenco = JSON.parse(readFileSync(new URL('docs/grafica-elementi.json', radice), 'utf8')) as {
  assets: { id: string; path: string; source: { kind: string; license: string; creator: string }; verification: { approval: string; review_capture: string } }[];
};

describe('elenco degli elementi grafici', () => {
  it('ogni elemento ha origine, licenza, stato di approvazione e un file di codice che esiste', () => {
    expect(elenco.assets.length).toBeGreaterThan(40);
    const ids = new Set<string>();
    for (const a of elenco.assets) {
      expect(ids.has(a.id), a.id).toBe(false);
      ids.add(a.id);
      expect(a.source.kind, a.id).toBe('generato dal codice');
      expect(a.source.license, a.id).toMatch(/AGPL-3\.0/);
      expect(a.source.creator.length, a.id).toBeGreaterThan(0);
      expect(a.verification.approval, a.id).toMatch(/^(approvato da Michele|in attesa di Michele)/);
      expect(existsSync(new URL(a.path, radice)), `${a.id}: ${a.path}`).toBe(true);
    }
  });

  it('copre i tipi di edificio, i tetti, gli alberi, le texture e i sei aspetti dei lotti', () => {
    const ids = elenco.assets.map((a) => a.id);
    for (const prefisso of ['edificio-', 'tetto-', 'albero-', 'texture-', 'suolo-', 'lotto-']) expect(ids.some((id) => id.startsWith(prefisso)), prefisso).toBe(true);
    for (const look of ['fermo', 'lavori', 'acciaio', 'bosco', 'energia', 'mare']) expect(ids.some((id) => id.startsWith(`lotto-${look}`)), look).toBe(true);
  });
});
