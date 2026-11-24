# Fonti e licenze di terze parti

Ogni dato, libreria o modello che entra nel gioco senza essere stato scritto da noi,
con la sua licenza. Il codice del gioco è AGPL-3.0, i contenuti CC BY-SA 4.0 (D15):
ciò che sta qui deve essere compatibile.

## Dati geografici

| Che cosa | Dove | Fonte | Licenza | Note |
| --- | --- | --- | --- | --- |
| Costa, acque, strade, ferrovie, moli, aree verdi, aree industriali, sagome degli edifici della zona dei Tamburi, dello stabilimento e del primo seno del Mar Piccolo | `packages/content/geo/plastico.json` | © OpenStreetMap contributors, scaricati dal servizio Overpass il 15 novembre 2026 e di nuovo, una volta, il 17 novembre 2026 con la zona allargata a ovest fino al fronte a mare dello stabilimento (T11b), con `apps/game/scripts/geo-scarica.ts` e ridotti con `apps/game/scripts/geo-riduci.ts` | [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/) | Attribuzione nel file e visibile nel gioco, in un angolo del plastico, con il collegamento a <https://www.openstreetmap.org/copyright>. Il file ridotto è un'opera derivata della banca dati: resta sotto ODbL. I nomi di aziende presenti in OpenStreetMap non vengono copiati (regola 6) |
| Copertura del suolo e impianti per la città isometrica (T12): parcheggi, usi del suolo, spiagge, piazze, linea di costa, vie di servizio, nastri trasportatori, tubazioni in vista, serbatoi, ciminiere, torri | `packages/content/geo/suolo.json` | © OpenStreetMap contributors, scaricati dal servizio Overpass una volta il 24 novembre 2026, sullo stesso riquadro di `plastico.json`, con `apps/game/scripts/geo-suolo.ts` (scarica e riduce; le funzioni comuni stanno in `geo-utili.ts`) | [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/) | Attribuzione nel file e la stessa, già visibile nel gioco, di `plastico.json`. Nessun nome copiato (regola 6). `plastico.json` non è cambiato |
| Posizione dei sei lotti di ILSIDER e contorni dei quartieri nella zona | `packages/content/geo/lotti.json` | Stime nostre, disegnate a mano guardando OpenStreetMap e le ortofoto pubbliche | come i contenuti (CC BY-SA 4.0) | Ogni poligono porta `stima: true` e la motivazione |

Il gioco non scarica nulla da OpenStreetMap durante la partita.

## Librerie

| Libreria | Versione | Uso | Licenza |
| --- | --- | --- | --- |
| [three.js](https://threejs.org/) (`three`), solo il nucleo: dal T12 nessun modulo di esempio (niente `MapControls` né effetto modellino) | 0.169.0 | Città isometrica: scena, camera ortografica, luce, ombre | MIT, compatibile con AGPL-3.0 |
| `@types/three` | 0.169.0 | Solo tipi, per lo sviluppo | MIT |

Le librerie già presenti prima del T11 (React, Vite, Ajv, Playwright e le altre) sono
elencate in `package.json` e in `pnpm-lock.yaml`, con le loro licenze.

## Modelli 3D

Nessun modello esterno: edifici, impianti, gru, pale, pannelli, alberi, barche, auto e
capannoni della città isometrica sono costruiti dal codice in `apps/game/src/iso/`
con forme semplici (prismi estrusi dalle sagome, cilindri, coni, poliedri). Anche le
texture (facciate, suolo, onde del mare) sono disegnate dal codice su una tela, senza
immagini esterne. Sono originali e seguono la licenza del codice. Il dettaglio è in
`docs/GRAFICA.md`, l'elenco con origine e licenza in `docs/grafica-elementi.json`.
