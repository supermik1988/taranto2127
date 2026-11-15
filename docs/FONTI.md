# Fonti e licenze di terze parti

Ogni dato, libreria o modello che entra nel gioco senza essere stato scritto da noi,
con la sua licenza. Il codice del gioco è AGPL-3.0, i contenuti CC BY-SA 4.0 (D15):
ciò che sta qui deve essere compatibile.

## Dati geografici

| Che cosa | Dove | Fonte | Licenza | Note |
| --- | --- | --- | --- | --- |
| Costa, acque, strade, ferrovie, moli, aree verdi, aree industriali, sagome degli edifici della zona dei Tamburi, dello stabilimento e del primo seno del Mar Piccolo | `packages/content/geo/plastico.json` | © OpenStreetMap contributors, scaricati una volta il 15 novembre 2026 dal servizio Overpass con `apps/game/scripts/geo-scarica.ts` e ridotti con `apps/game/scripts/geo-riduci.ts` | [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/) | Attribuzione nel file e visibile nel gioco, in un angolo del plastico, con il collegamento a <https://www.openstreetmap.org/copyright>. Il file ridotto è un'opera derivata della banca dati: resta sotto ODbL. I nomi di aziende presenti in OpenStreetMap non vengono copiati (regola 6) |
| Posizione dei sei lotti di ILSIDER e contorni dei quartieri nella zona | `packages/content/geo/lotti.json` | Stime nostre, disegnate a mano guardando OpenStreetMap e le ortofoto pubbliche | come i contenuti (CC BY-SA 4.0) | Ogni poligono porta `stima: true` e la motivazione |

Il gioco non scarica nulla da OpenStreetMap durante la partita.

## Librerie

| Libreria | Versione | Uso | Licenza |
| --- | --- | --- | --- |
| [three.js](https://threejs.org/) (`three`), compresi i moduli di esempio `MapControls`, `EffectComposer`, `RenderPass`, `ShaderPass`, `OutputPass`, `HorizontalTiltShiftShader`, `VerticalTiltShiftShader` | 0.169.0 | Scena 3D del plastico, camera, effetto modellino | MIT, compatibile con AGPL-3.0 |
| `@types/three` | 0.169.0 | Solo tipi, per lo sviluppo | MIT |

Le librerie già presenti prima del T11 (React, Vite, Ajv, Playwright e le altre) sono
elencate in `package.json` e in `pnpm-lock.yaml`, con le loro licenze.

## Modelli 3D

Nessun modello esterno: edifici, impianti, gru, pale, pannelli, alberi, barche e
capannoni del plastico sono costruiti dal codice in `apps/game/src/plastico/scene.ts`
con forme semplici (parallelepipedi, cilindri, coni, prismi). Sono originali e seguono
la licenza del codice. Il dettaglio è in `docs/GRAFICA.md`.
