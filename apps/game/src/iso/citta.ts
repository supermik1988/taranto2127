/**
 * La città isometrica intera (T12, fase B): costruisce dal codice, con i dati di
 * OpenStreetMap, gli edifici con facciate e tetti, lo stabilimento con i suoi
 * impianti, il suolo coperto, il mare, la costa, le strade e gli alberi. Gli
 * aspetti dei lotti stanno in lotti.ts e si aggiungono a parte, secondo lo stato.
 *
 * Coordinate: x verso est, z = −nord, y in alto, un'unità è un metro. Scala
 * reale: nessuna esagerazione verticale. Geometrie raggruppate per materiale:
 * migliaia di edifici restano pochi ordini di disegno.
 */
import * as THREE from 'three';
import { DISTRICTS_ON_MODEL, centroid, districtAt, geo, pointInPolygon } from '../plastico/data.js';
import { Alberi, CostruttoreEdifici } from './edifici.js';
import { Griglia, OCCUPATO } from './griglia.js';
import { costruisciImpianti, type NumeriImpianti } from './impianti.js';
import { costruisciSuolo, type NumeriSuolo, type Pezza } from './suolo.js';
import { tipoEdificio, type TipoEdificio } from './tipi.js';

/** Etichetta di quartiere per lo strato: 0 nessuno, poi l'ordine di DISTRICTS_ON_MODEL. */
export const TAG_QUARTIERE = new Map(DISTRICTS_ON_MODEL.map((id, i) => [id, i + 1]));

export interface Citta {
  gruppo: THREE.Group;
  pezze: Pezza[];
  onde: THREE.Texture;
  conteggio: Record<TipoEdificio, number>;
  alberi: number;
  impianti: NumeriImpianti;
  suolo: NumeriSuolo;
}

export function costruisciCitta(): Citta {
  const gruppo = new THREE.Group();
  gruppo.name = 'citta';
  const griglia = new Griglia();
  const lotti = Object.values(geo.lotti);
  for (const q of lotti) griglia.poligono(q, OCCUPATO.lotto);

  // Edifici: quelli dentro i lotti di ILSIDER non si disegnano, ogni lotto ha il suo aspetto per stato.
  const edifici = new CostruttoreEdifici();
  for (const b of geo.edifici) {
    const ctr = centroid(b.p);
    if (lotti.some((q) => pointInPolygon(ctr, q))) continue;
    const quartiere = districtAt(ctr);
    const stabilimento = geo.stabilimento.some((r) => pointInPolygon(ctr, r));
    edifici.aggiungi(b, tipoEdificio(b, { quartiere, stabilimento }), quartiere === undefined ? 0 : TAG_QUARTIERE.get(quartiere)!);
    griglia.poligono(b.p, OCCUPATO.edificio);
  }

  const alberi = new Alberi();
  const suolo = costruisciSuolo(griglia, alberi);
  const impianti = costruisciImpianti(edifici, griglia);
  for (const o of suolo.oggetti) gruppo.add(o);
  for (const o of impianti.oggetti) gruppo.add(o);
  for (const m of edifici.meshes()) gruppo.add(m);
  // Lo strato colora anche gli alberi dei quartieri.
  const tagDi = (x: number, y: number) => {
    const d = districtAt([x, y]);
    return d === undefined ? 0 : TAG_QUARTIERE.get(d)!;
  };
  for (const m of alberi.meshes(tagDi)) gruppo.add(m);
  return { gruppo, pezze: suolo.pezze, onde: suolo.onde, conteggio: edifici.conteggio, alberi: alberi.count, impianti: impianti.numeri, suolo: suolo.numeri };
}
