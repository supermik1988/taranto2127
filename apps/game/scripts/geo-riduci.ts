/**
 * Riduce i dati grezzi di OpenStreetMap (scaricati con geo-scarica.ts) nel file
 * del plastico: packages/content/geo/plastico.json. Coordinate in metri rispetto
 * al centro della zona (x verso est, y verso nord), interi; sagome semplificate;
 * edifici minuscoli scartati; nessun nome proprio (regola 6: niente aziende reali).
 *
 *   npx tsx scripts/geo-riduci.ts <file-grezzo.json>
 *
 * Dati © OpenStreetMap contributors, licenza ODbL 1.0 (vedi docs/FONTI.md).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HALF_H, HALF_W, area, assembleRings, east, line, north, project, ring, south, strip, west, type Element, type Pt } from './geo-utili.js';

// ---------- Classificazione ----------

const ROAD_CLASS: Record<string, number> = {
  motorway: 1,
  trunk: 1,
  motorway_link: 2,
  trunk_link: 2,
  primary: 2,
  primary_link: 2,
  secondary: 3,
  tertiary: 3,
  unclassified: 4,
  residential: 4,
};

/** Tipo di edificio ridotto a poche famiglie, per altezza e colore. */
function buildingKind(tags: Record<string, string>): string {
  const b = tags['building'] ?? 'yes';
  if (['industrial', 'warehouse', 'factory', 'hangar', 'manufacture', 'storage_tank', 'silo'].includes(b)) return 'industria';
  if (['apartments', 'residential', 'house', 'detached', 'terrace', 'semidetached_house'].includes(b)) return 'casa';
  if (['school', 'church', 'hospital', 'public', 'civic', 'government', 'university', 'kindergarten', 'chapel'].includes(b)) return 'pubblico';
  if (['commercial', 'retail', 'office', 'supermarket'].includes(b)) return 'negozi';
  if (['roof', 'shed', 'garage', 'garages', 'hut', 'carport', 'service', 'kiosk'].includes(b)) return 'basso';
  return 'altro';
}

/** Altezza dai dati, se presente: metri o piani. */
function buildingHeight(tags: Record<string, string>): number | undefined {
  const h = Number.parseFloat(tags['height'] ?? '');
  if (Number.isFinite(h) && h > 0) return Math.round(h);
  const levels = Number.parseFloat(tags['building:levels'] ?? '');
  if (Number.isFinite(levels) && levels > 0) return Math.round(levels * 3.2);
  return undefined;
}

function greenKind(tags: Record<string, string>): string | null {
  if (tags['leisure'] === 'park' || tags['leisure'] === 'garden') return 'parco';
  if (tags['leisure'] === 'pitch') return 'campo';
  if (tags['landuse'] === 'forest' || tags['natural'] === 'wood') return 'bosco';
  if (tags['natural'] === 'scrub') return 'macchia';
  if (['grass', 'meadow'].includes(tags['landuse'] ?? '')) return 'prato';
  if (['farmland', 'orchard'].includes(tags['landuse'] ?? '')) return 'campi';
  if (tags['landuse'] === 'cemetery') return 'cimitero';
  return null;
}

// ---------- Lotti e quartieri ----------

/** Posizioni stimate dei lotti e contorni dei quartieri: stanno nei dati, con stima e motivazione. */
type Annotated = { valore: [number, number][]; stima: true; motivazione: string };
const LOTS_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'packages', 'content', 'geo', 'lotti.json');
const places = JSON.parse(readFileSync(LOTS_FILE, 'utf8')) as { lotti: Record<string, Annotated>; quartieri: Record<string, Annotated> };
const toMeters = (record: Record<string, Annotated>) =>
  Object.fromEntries(Object.entries(record).map(([id, a]) => [id, a.valore.map(([lat, lon]) => project({ lat, lon }).map(Math.round) as Pt)]));

// ---------- Riduzione ----------

function main(): void {
  const input = process.argv[2];
  if (input === undefined) throw new Error('indica il file grezzo scaricato con geo-scarica.ts');
  const raw = JSON.parse(readFileSync(input, 'utf8')) as { elements: Element[] };
  const buildings: { id: number; p: Pt[]; k: string; h?: number }[] = [];
  const roads: { l: Pt[]; c: number }[] = [];
  const rails: Pt[][] = [];
  const water: Pt[][] = [];
  const greens: { p: Pt[]; k: string }[] = [];
  const piers: Pt[][] = [];
  const industry: Pt[][] = [];
  let plant: Pt[][] = [];

  const outerRings = (e: Element): Pt[][] =>
    assembleRings((e.members ?? []).filter((m) => m.role === 'outer' && m.geometry !== undefined).map((m) => m.geometry!.map(project)));

  for (const e of raw.elements) {
    const tags = e.tags ?? {};
    const geom = e.geometry?.map(project);
    if (tags['building'] !== undefined && geom !== undefined) {
      const r = ring(geom, 0.8, 12);
      if (r !== null) {
        const h = buildingHeight(tags);
        buildings.push({ id: e.id, p: r, k: buildingKind(tags), ...(h !== undefined && { h }) });
      }
    } else if (tags['highway'] !== undefined && geom !== undefined) {
      const c = ROAD_CLASS[tags['highway']];
      if (c !== undefined) for (const l of line(geom, 2.5)) roads.push({ l, c });
    } else if (tags['railway'] === 'rail' && geom !== undefined) {
      rails.push(...line(geom, 4));
    } else if (tags['natural'] === 'water' || tags['natural'] === 'bay') {
      // Il golfo esce di molto dalla zona: si ritaglia sul riquadro, come il Mar Grande.
      // Dal T11b serve: il fronte a mare dello stabilimento, a ovest, dà sul golfo.
      const rings = e.type === 'relation' ? outerRings(e) : geom !== undefined ? [geom] : [];
      for (const g of rings) {
        const r = ring(g, 3, 150);
        if (r !== null) water.push(r);
      }
    } else if (tags['man_made'] === 'pier' || tags['man_made'] === 'breakwater') {
      if (geom === undefined) continue;
      const closed = geom.length > 3 && geom[0]![0] === geom.at(-1)![0] && geom[0]![1] === geom.at(-1)![1];
      if (closed) {
        const r = ring(geom, 1.5, 30);
        if (r !== null) piers.push(r);
      } else {
        // Molo disegnato come linea: diventa una striscia larga 12 metri.
        for (const l of line(geom, 2)) piers.push(strip(l, 6));
      }
    } else if (tags['landuse'] === 'industrial') {
      const rings = e.type === 'relation' ? outerRings(e) : geom !== undefined ? [geom] : [];
      // Lo stabilimento è la sua area principale più le aree portuali dello stesso gestore (i pontili sul mare, T11b).
      // Il nome serve solo a riconoscerle: nel file del plastico non entra (regola 6).
      const owner = `${tags['name'] ?? ''} ${tags['operator'] ?? ''}`.toLowerCase();
      const isPlant = (e.type === 'relation' && e.id === 11843712) || /acciaierie d'italia|arcelormittal|\bilva\b/.test(owner);
      for (const g of rings) {
        const r = ring(g, 4, 500);
        if (r === null) continue;
        if (isPlant) plant.push(r);
        else industry.push(r);
      }
    } else {
      const k = greenKind(tags);
      if (k !== null && geom !== undefined) {
        const r = ring(geom, 2, 60);
        if (r !== null) greens.push({ p: r, k });
      }
    }
  }
  plant = plant.sort((a, b) => area(b) - area(a));

  const lots = toMeters(places.lotti);
  const districts = toMeters(places.quartieri);

  const out = {
    descrizione:
      'Plastico della zona dei Tamburi, dello stabilimento ILSIDER e del primo seno del Mar Piccolo. Coordinate in metri dal centro della zona, x verso est e y verso nord. Ridotto da OpenStreetMap con apps/game/scripts/geo-riduci.ts: sagome semplificate, edifici sotto i 12 m² scartati, nessun nome. Ogni edificio porta il suo identificativo OpenStreetMap (id), da cui il gioco ricava altezza e colori. Lotti di ILSIDER e contorni dei quartieri vengono da lotti.json, stime dichiarate.',
    attribuzione: '© OpenStreetMap contributors. Dati disponibili con licenza Open Database License (ODbL) 1.0: https://www.openstreetmap.org/copyright',
    licenza: 'ODbL-1.0',
    scaricatoIl: process.env['GEO_DATA'] ?? new Date().toISOString().slice(0, 10),
    riquadro: { sud: south, ovest: west, nord: north, est: east },
    dimensioni: { larghezza: Math.round(HALF_W * 2), altezza: Math.round(HALF_H * 2) },
    acqua: water,
    stabilimento: plant,
    industria: industry,
    verde: greens,
    moli: piers,
    strade: roads,
    ferrovie: rails,
    edifici: buildings,
    lotti: lots,
    quartieri: districts,
  };
  const target = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'packages', 'content', 'geo', 'plastico.json');
  const text = JSON.stringify(out);
  writeFileSync(target, `${text}\n`);
  console.log(
    `${target}: ${(text.length / 1e6).toFixed(2)} MB · edifici ${buildings.length} · strade ${roads.length} · acqua ${water.length} · verde ${greens.length} · moli ${piers.length} · stabilimento ${plant.length} anelli`,
  );
}

main();
