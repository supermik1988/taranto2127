/**
 * Tipi di edificio della città isometrica (T12, provino): almeno sei tipi distinti
 * sulla zona vera, e varianti che dipendono solo dal tipo e dall'identificativo.
 */
import { describe, expect, it } from 'vitest';
import { centroid, districtAt, geo, pointInPolygon } from '../plastico/data.js';
import { INTONACI, TIPI, tipoEdificio, variante, type TipoEdificio } from './tipi.js';

function tipoDi(b: (typeof geo.edifici)[number]): TipoEdificio {
  const ctr = centroid(b.p);
  return tipoEdificio(b, { quartiere: districtAt(ctr), stabilimento: geo.stabilimento.some((r) => pointInPolygon(ctr, r)) });
}

describe('tipi di edificio', () => {
  it('la zona ha almeno sei tipi distinti', () => {
    const conteggio = new Map<TipoEdificio, number>();
    for (const b of geo.edifici) {
      const t = tipoDi(b);
      conteggio.set(t, (conteggio.get(t) ?? 0) + 1);
    }
    expect(conteggio.size).toBeGreaterThanOrEqual(6);
    for (const t of conteggio.keys()) expect(TIPI).toContain(t);
  });

  it('palazzine con terrazza e balconi, capannoni in lamiera, impianti con ciminiera', () => {
    const b = geo.edifici[0]!;
    expect(variante(b, 'palazzina', true)).toMatchObject({ tetto: 'terrazza', facciata: 'balconi' });
    expect(variante(b, 'capannone', false)).toMatchObject({ facciata: 'industriale', tetto: 'piano', lucernari: true });
    expect(variante(b, 'impianto', true).ciminiera).toBeGreaterThan(0);
  });

  it('la variante dipende solo dal tipo e dall\'identificativo', () => {
    for (const b of geo.edifici.slice(0, 200)) {
      const tipo = tipoDi(b);
      const a = variante(b, tipo, false);
      // Stessa sagoma ricostruita: stesso risultato.
      expect(variante({ ...b, p: b.p.map(([x, y]) => [x, y]) }, tipo, false)).toEqual(a);
      // Stesso identificativo con un'altra forma (stessa superficie, spostata): stesso aspetto.
      const spostata = { ...b, p: b.p.map(([x, y]) => [x + 500, y - 300] as [number, number]) };
      expect(variante(spostata, tipo, false)).toEqual(a);
      expect(INTONACI[tipo]).toContain(a.parete);
    }
  });

  it('identificativi diversi danno colori diversi', () => {
    const colori = new Set(geo.edifici.slice(0, 300).map((b) => variante(b, 'palazzina', true).parete));
    expect(colori.size).toBeGreaterThanOrEqual(5);
  });
});
