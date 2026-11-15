/**
 * Scarica UNA VOLTA SOLA da OpenStreetMap (servizio Overpass) i dati della zona
 * del plastico: Tamburi, area industriale, tratto di Mar Piccolo adiacente.
 * Il file grezzo resta fuori dal repository; nel repository va solo la versione
 * ridotta prodotta da geo-riduci.ts. Il gioco non scarica nulla durante la partita.
 *
 *   npx tsx scripts/geo-scarica.ts <file-grezzo.json>
 *
 * Dati © OpenStreetMap contributors, licenza ODbL 1.0 (vedi docs/FONTI.md).
 */
import { writeFileSync } from 'node:fs';
import { BBOX } from './geo-zona.js';

const query = `
[out:json][timeout:180][bbox:${BBOX.join(',')}];
(
  way["building"];
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|motorway_link|trunk_link|primary_link)$"];
  way["railway"="rail"];
  way["natural"="coastline"];
  way["natural"="water"];
  relation["natural"="water"];
  way["natural"="bay"];
  relation["natural"="bay"];
  way["leisure"~"^(park|garden|pitch)$"];
  way["landuse"~"^(grass|forest|meadow|orchard|farmland|industrial|cemetery)$"];
  relation["landuse"="industrial"];
  way["natural"~"^(wood|scrub)$"];
  way["man_made"~"^(pier|breakwater)$"];
);
out geom qt;
`;

async function main(): Promise<void> {
  const out = process.argv[2];
  if (out === undefined) throw new Error('indica il file in cui salvare i dati grezzi');
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'taranto2127-plastico/1.0' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) throw new Error(`Overpass ha risposto ${response.status}: ${await response.text()}`);
  const text = await response.text();
  writeFileSync(out, text);
  console.log(`Salvati ${(text.length / 1e6).toFixed(1)} MB in ${out}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
