/**
 * Copertura del suolo e impianti per la città isometrica (T12): scarica UNA VOLTA
 * da OpenStreetMap (servizio Overpass), sullo stesso riquadro del plastico, solo
 * gli strati che plastico.json non ha, e li riduce in packages/content/geo/suolo.json.
 * plastico.json non cambia: edifici, lotti e quartieri restano quelli del T11.
 *
 *   npx tsx scripts/geo-suolo.ts                 (scarica e riduce)
 *   npx tsx scripts/geo-suolo.ts <file-grezzo>   (riduce un file già scaricato)
 *
 * Il file grezzo resta fuori dal repository. Nessun nome proprio entra nei dati
 * (regola 6). Dati © OpenStreetMap contributors, licenza ODbL 1.0 (docs/FONTI.md).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BBOX } from './geo-zona.js';
import { HALF_H, HALF_W, assembleRings, line, project, ring, type Element, type Pt } from './geo-utili.js';

const query = `
[out:json][timeout:180][bbox:${BBOX.join(',')}];
(
  way["amenity"="parking"];
  relation["amenity"="parking"];
  way["landuse"~"^(residential|commercial|retail|railway|brownfield|construction|port|garages|religious|education|landfill|quarry)$"];
  relation["landuse"~"^(residential|commercial|retail|railway|brownfield|port)$"];
  way["natural"~"^(beach|sand|bare_rock|shingle|scree|grassland|heath|wetland)$"];
  relation["natural"~"^(beach|bare_rock|wetland)$"];
  way["natural"="coastline"];
  way["leisure"~"^(marina|playground|sports_centre|stadium|track)$"];
  way["amenity"~"^(school|hospital|university|college|kindergarten)$"];
  way["place"="square"];
  way["highway"="pedestrian"]["area"="yes"];
  way["highway"~"^(service|living_street|pedestrian)$"];
  way["man_made"~"^(goods_conveyor|pipeline|storage_tank|silo|chimney|tower|gasometer|crane|bunker_silo|wastewater_plant)$"];
  node["man_made"~"^(chimney|storage_tank|silo|tower|crane)$"];
  way["railway"~"^(siding|yard|spur)$"];
);
out geom qt;
`;

type Kind = 'parcheggi' | 'residenziale' | 'commerciale' | 'ferroviario' | 'incolto' | 'porto' | 'servizi' | 'spiaggia' | 'scogli' | 'prato' | 'piazze' | 'sport' | 'cave';

/** Usi del suolo ridotti a poche famiglie, ciascuna con una sua copertura. */
function areaKind(tags: Record<string, string>): Kind | null {
  if (tags['amenity'] === 'parking') return 'parcheggi';
  const landuse = tags['landuse'] ?? '';
  if (landuse === 'residential') return 'residenziale';
  if (landuse === 'commercial' || landuse === 'retail') return 'commerciale';
  if (landuse === 'railway') return 'ferroviario';
  if (landuse === 'brownfield' || landuse === 'construction' || landuse === 'landfill') return 'incolto';
  if (landuse === 'quarry') return 'cave';
  if (landuse === 'port') return 'porto';
  if (landuse === 'garages') return 'parcheggi';
  if (['religious', 'education'].includes(landuse) || ['school', 'hospital', 'university', 'college', 'kindergarten'].includes(tags['amenity'] ?? '')) return 'servizi';
  const natural = tags['natural'] ?? '';
  if (natural === 'beach' || natural === 'sand' || natural === 'shingle') return 'spiaggia';
  if (natural === 'bare_rock' || natural === 'scree') return 'scogli';
  if (natural === 'grassland' || natural === 'heath' || natural === 'wetland') return 'prato';
  if (tags['place'] === 'square' || (tags['highway'] === 'pedestrian' && tags['area'] === 'yes')) return 'piazze';
  const leisure = tags['leisure'] ?? '';
  if (['playground', 'sports_centre', 'stadium', 'track'].includes(leisure)) return 'sport';
  if (leisure === 'marina') return 'porto';
  return null;
}

const inside = ([x, y]: Pt) => Math.abs(x) <= HALF_W && Math.abs(y) <= HALF_H;
const round = ([x, y]: Pt): Pt => [Math.round(x), Math.round(y)];

async function download(): Promise<string> {
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'taranto2127-plastico/1.0' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) throw new Error(`Overpass ha risposto ${response.status}: ${await response.text()}`);
  const text = await response.text();
  const file = join(tmpdir(), 'taranto2127-suolo-grezzo.json');
  writeFileSync(file, text);
  console.log(`Scaricati ${(text.length / 1e6).toFixed(1)} MB in ${file} (fuori dal repository).`);
  return file;
}

async function main(): Promise<void> {
  const input = process.argv[2] ?? (existsSync(join(tmpdir(), 'taranto2127-suolo-grezzo.json')) ? join(tmpdir(), 'taranto2127-suolo-grezzo.json') : await download());
  const raw = JSON.parse(readFileSync(input, 'utf8')) as { elements: (Element & { lat?: number; lon?: number })[] };
  const aree: Record<Kind, Pt[][]> = { parcheggi: [], residenziale: [], commerciale: [], ferroviario: [], incolto: [], porto: [], servizi: [], spiaggia: [], scogli: [], prato: [], piazze: [], sport: [], cave: [] };
  const servizio: Pt[][] = [];
  const costa: Pt[][] = [];
  const nastri: Pt[][] = [];
  const tubazioni: Pt[][] = [];
  const raccordi: Pt[][] = [];
  const serbatoi: { p: Pt; r: number }[] = [];
  const ciminiere: { p: Pt; h?: number }[] = [];
  const torri: { p: Pt; h?: number }[] = [];
  const gru: Pt[] = [];

  const outerRings = (e: Element): Pt[][] =>
    assembleRings((e.members ?? []).filter((m) => m.role === 'outer' && m.geometry !== undefined).map((m) => m.geometry!.map(project)));
  const height = (tags: Record<string, string>): number | undefined => {
    const h = Number.parseFloat(tags['height'] ?? '');
    return Number.isFinite(h) && h > 0 ? Math.round(h) : undefined;
  };

  for (const e of raw.elements) {
    const tags = e.tags ?? {};
    const geom = e.geometry?.map(project);
    const manMade = tags['man_made'] ?? '';
    // Punti: ciminiere, serbatoi, silos, torri e gru disegnati come nodi.
    if (e.type === 'node' && e.lat !== undefined && e.lon !== undefined) {
      const p = round(project({ lat: e.lat, lon: e.lon }));
      if (!inside(p)) continue;
      if (manMade === 'chimney') ciminiere.push({ p, ...(height(tags) !== undefined && { h: height(tags)! }) });
      else if (manMade === 'storage_tank' || manMade === 'silo') serbatoi.push({ p, r: Math.max(4, Number.parseFloat(tags['diameter'] ?? '') / 2 || 8) });
      else if (manMade === 'tower') torri.push({ p, ...(height(tags) !== undefined && { h: height(tags)! }) });
      else if (manMade === 'crane') gru.push(p);
      continue;
    }
    if (geom === undefined && e.type !== 'relation') continue;
    if (tags['natural'] === 'coastline' && geom !== undefined) {
      costa.push(...line(geom, 3));
      continue;
    }
    if (manMade === 'goods_conveyor' && geom !== undefined) {
      nastri.push(...line(geom, 3));
      continue;
    }
    if (manMade === 'pipeline' && geom !== undefined) {
      // Solo le tubazioni in vista: quelle interrate non si disegnano.
      if (tags['location'] === 'underground' || tags['location'] === 'underwater') continue;
      tubazioni.push(...line(geom, 3));
      continue;
    }
    if (['storage_tank', 'silo', 'gasometer', 'bunker_silo', 'chimney', 'tower', 'wastewater_plant'].includes(manMade) && geom !== undefined) {
      const r = ring(geom, 0.8, 4);
      if (r === null) continue;
      let cx = 0;
      let cy = 0;
      for (const [x, y] of r) {
        cx += x / r.length;
        cy += y / r.length;
      }
      const radius = Math.max(...r.map(([x, y]) => Math.hypot(x - cx, y - cy)));
      const p = round([cx, cy]);
      if (manMade === 'chimney') ciminiere.push({ p, ...(height(tags) !== undefined && { h: height(tags)! }) });
      else if (manMade === 'tower') torri.push({ p, ...(height(tags) !== undefined && { h: height(tags)! }) });
      else serbatoi.push({ p, r: Math.max(3, Math.round(radius)) });
      continue;
    }
    if (tags['highway'] !== undefined && tags['area'] !== 'yes' && geom !== undefined) {
      servizio.push(...line(geom, 2.5));
      continue;
    }
    if (tags['railway'] !== undefined && geom !== undefined) {
      raccordi.push(...line(geom, 4));
      continue;
    }
    const kind = areaKind(tags);
    if (kind === null) continue;
    const rings = e.type === 'relation' ? outerRings(e) : geom !== undefined ? [geom] : [];
    for (const g of rings) {
      const r = ring(g, 2, kind === 'parcheggi' ? 80 : 150);
      if (r !== null) aree[kind].push(r);
    }
  }
  const out = {
    descrizione:
      'Copertura del suolo e impianti per la città isometrica (T12): parcheggi, usi del suolo, spiagge e scogli, linea di costa, vie di servizio, raccordi ferroviari, nastri trasportatori, tubazioni in vista, serbatoi, ciminiere, torri e gru. Stesso riquadro e stesse coordinate di plastico.json (metri dal centro, x verso est, y verso nord). Ridotto da OpenStreetMap con apps/game/scripts/geo-suolo.ts, senza nomi.',
    attribuzione: '© OpenStreetMap contributors. Dati disponibili con licenza Open Database License (ODbL) 1.0: https://www.openstreetmap.org/copyright',
    licenza: 'ODbL-1.0',
    scaricatoIl: process.env['GEO_DATA'] ?? new Date().toISOString().slice(0, 10),
    aree,
    servizio,
    costa,
    raccordi,
    nastri,
    tubazioni,
    serbatoi,
    ciminiere,
    torri,
    gru,
  };
  const target = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'packages', 'content', 'geo', 'suolo.json');
  const text = JSON.stringify(out);
  writeFileSync(target, `${text}\n`);
  const counts = Object.entries(aree).map(([k, v]) => `${k} ${v.length}`).join(' · ');
  console.log(
    `${target}: ${(text.length / 1e3).toFixed(0)} kB · ${counts} · servizio ${servizio.length} · costa ${costa.length} · raccordi ${raccordi.length} · nastri ${nastri.length} · tubazioni ${tubazioni.length} · serbatoi ${serbatoi.length} · ciminiere ${ciminiere.length} · torri ${torri.length} · gru ${gru.length}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
