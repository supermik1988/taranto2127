# Grafica: il plastico

> Dal T12 (D20) lo stile della mappa cambia: città isometrica, senza effetto
> modellino. Il brief di direzione artistica è in fondo, nella sezione
> «Città isometrica (T12): brief di direzione artistica». Le sezioni sul plastico
> restano valide finché la fase B non lo sostituisce.

Scelte del T11 (D18): un plastico 3D della città, effetto modellino, luce morbida,
colori pieni; mappa a tutto schermo, comandi ai bordi, finestre al tocco. Per ora una
zona: i Tamburi, lo stabilimento ILSIDER e il primo seno del Mar Piccolo, con un
pezzo di Mar Grande, del porto, della Città Vecchia e del Borgo.

## Scelte tecniche

- **Motore 3D: three.js 0.169.0** (MIT), senza strati sopra. Moduli usati:
  `MapControls` per la camera, `EffectComposer` con `RenderPass`, due passate di
  sfocatura tilt-shift e `OutputPass` per l'effetto modellino.
- **Caricamento separato.** `apps/game/src/plastico/` (scena, componente, dati) entra
  nella pagina con `React.lazy` solo quando si mostra il plastico. La prima schermata
  scarica lo stesso codice di prima del T11; con la mappa schematica il codice 3D non
  si scarica affatto (lo controlla `scripts/verifica.ts`).
- **Dati geografici scaricati una volta.** `scripts/geo-scarica.ts` interroga Overpass
  e salva il file grezzo fuori dal repository; `scripts/geo-riduci.ts` lo trasforma in
  `packages/content/geo/plastico.json`: metri dal centro della zona, sagome
  semplificate (Douglas-Peucker, 0,8 m per gli edifici), ritaglio sul riquadro
  (40,468-40,522 N, 17,150-17,262 E, circa 9,5 × 6 km), edifici sotto i 12 m² scartati,
  nessun nome proprio. Il gioco non scarica nulla durante la partita.
  - *T11b, riquadro allargato a ovest* (scelta di Michele). Nel primo scaricamento
    (15 novembre) il bordo ovest era a 17,168° e lo stabilimento non toccava il mare: il
    suo contorno in OpenStreetMap dista 1,1 km dal Mar Piccolo e 1,3 km dal Mar Grande,
    e il suo fronte a mare vero, a ovest, cadeva fuori. Il 17 novembre il riquadro è
    stato allargato di circa 1,5 km (bordo a 17,150°) e i dati scaricati di nuovo, una
    volta. Il golfo di Taranto, prima escluso, entra ritagliato sul riquadro: è il mare
    aperto a ovest dello stabilimento. Il contorno dello stabilimento comprende ora
    anche le aree portuali dello stesso gestore in OpenStreetMap (il quinto sporgente,
    un pontile lungo circa 1,1 km): il nome serve solo a riconoscerle e non entra nel file.
- **Lotti e quartieri nei dati.** Le posizioni dei sei lotti e i contorni di Tamburi,
  Città Vecchia e Borgo stanno in `packages/content/geo/lotti.json`, ognuno con
  `stima: true` e la motivazione. L'area industriale è il contorno principale dello
  stabilimento in OpenStreetMap; i pontili dello stesso gestore fanno parte dello
  stabilimento ma non del quartiere. Paolo VI e le borgate cadono fuori dalla zona: i loro valori sono
  nel pannello Strati e nell'elenco.
- **Una sola geometria per la città.** I 5.737 edifici diventano pareti e tetto in
  un'unica geometria con i colori per vertice; strade, ferrovie, verde e acqua sono
  altre quattro geometrie. Così il disegno resta leggero anche sul telefono.
- **Altezze e colori ripetibili.** Ricavati dall'identificativo OpenStreetMap della
  sagoma con una funzione fissa (`hash01` in `plastico/data.ts`): stesso edificio,
  stessa altezza e stessi colori a ogni avvio, niente `Math.random`. Dove OpenStreetMap
  ha l'altezza o i piani, vale quella. Altezze tipiche: palazzine dei Tamburi 12-22 m,
  case piccole 5-9 m, capannoni 9-23 m. Esagerazione verticale 2,4, come nei plastici.
- **Fondo dei lotti alla quota del terreno** (dopo la revisione, decisione di Michele:
  niente piastre rialzate e squadrate). Il fondo di ogni lotto sta alla stessa quota del
  terreno dello stabilimento (`TERRAIN_Y` = 0,4 m) e ha spessore zero: si vede sopra il
  terreno solo per l'ordine di disegno (`polygonOffset`), non per l'altezza. Il bordo è
  irregolare e sfumato in due passi: una fascia di raccordo, con il colore a metà tra
  quello del lotto e quello dello stabilimento e un bordo che rientra fino a 18 m, sotto
  un fondo pieno che rientra tra 22 e 55 m. Gli scarti sono ripetibili (ricavati
  dall'identificativo del lotto). Strade e binari passano sopra il fondo, come sul
  terreno vero. Gli edifici del lotto fermo partono da terra. Il lotto resta toccabile
  perché la superficie invisibile del tocco copre l'intero quadrilatero.
- **Mare e cultura senza vasca** (dopo la revisione). Nessuno specchio d'acqua finto. Il
  codice controlla quali lati del lotto danno sull'acqua vera di OpenStreetMap
  (`waterSides`: sette punti 12 m fuori dal lato, conta se la maggioranza cade
  nell'acqua). Su quei lati: banchina aperta, bitte e barche ormeggiate appena fuori, sul
  mare vero. Al centro di ogni lotto: una piazza chiara, sei edifici pubblici colorati,
  viali alberati. Tocca il mare solo il lotto delle **Banchine**: dal T11b sta sul quinto
  sporgente, il pontile con cui lo stabilimento entra nel mare a ovest, e i suoi lati
  lunghi seguono le sponde del pontile sei metri all'interno (lotto di circa 500 × 245 m).
  Un test controlla che il lato bagnato dia sul mare aperto (un'acqua più grande di
  1 km²: golfo, Mar Grande, Mar Piccolo), non su un canale, e che tutti i vertici del
  lotto stiano dentro lo stabilimento. Gli altri cinque lotti sono interni.
- **Si vede che cosa hai toccato** (dopo la revisione, decisione dell'architetto). Il
  lotto o il quartiere aperto in una finestra resta evidenziato da un nastro blu
  (`#1f6fd1`) lungo il contorno, che pulsa piano. Quando la finestra si è disposta, la
  camera si sposta, senza cambiare distanza né rotazione, perché il centro dell'oggetto
  cada al centro della parte di schermo libera: sopra la finestra che sale dal basso sul
  telefono, a sinistra di quella laterale sullo schermo largo, sempre sotto la barra in
  alto (`frameIn`, tre passi per correggere la prospettiva).
- **Aspetto dei lotti** letto dallo stato del motore (regola 1) in `plastico/looks.ts`:
  cantiere se un progetto del lotto è nella fase dei lavori; l'aspetto della strada
  quando il progetto è in esercizio; bosco giovane se il lotto è stato bonificato e poi
  lasciato fermo; altrimenti fermo (anche in progettazione, autorizzazioni e gara: sul
  terreno non si vede ancora nulla). Ogni aspetto si costruisce la prima volta che
  serve.
- **Luce e ombre.** Cielo diffuso (luce emisferica) e sole da sud-est con ombre morbide
  (mappa d'ombra 4096 px sull'intera zona, ridisegnata solo quando serve). Base del plastico come una lastra su un
  tavolo, nebbia leggera in lontananza.
- **Camera.** Si sposta con un dito o con il mouse, ingrandisce con due dita o con la
  rotella (verso il punto indicato), ruota con due dita o con il tasto destro. Limiti:
  distanza da 450 a 9.000 m, inclinazione tra 11° e 69° dalla verticale, centro sempre
  dentro la zona.
- **Tocco.** Un tocco breve (meno di 8 px di spostamento, meno di 0,6 s) sceglie prima
  un lotto, poi un quartiere, con superfici invisibili sopra ciascuno.
- **Strato.** Il pannello Strati colora pareti e tetti degli edifici di ogni quartiere
  e stende sul terreno il colore dell'indicatore scelto (aria, salute, fiducia,
  tensione), con un'etichetta che porta nome e valore. I colori sono quelli della mappa
  schematica (`indicatorColor`), quindi la legenda è una sola.
  - *Dopo la revisione (decisione di Michele: «più deciso sul telefono»).* Gli edifici
    prendono il 90% del colore della legenda (prima il 75%): la forma resta leggibile
    perché pareti e tetti sono illuminati diversamente. Il terreno del quartiere si
    copre al 90% (prima 50%); fuori dai quartieri tutto si attenua all'80% (prima 92%).
  - La causa vera della tinta debole era la legenda: il colore di metà scala era un
    crema (`#efe6cf`) quasi uguale al terreno (`#e8dcc0`), e i Tamburi, con l'aria
    intorno a 35, cadevano proprio lì. La scala diventa arancio scuro `#be5c26` (male),
    giallo caldo `#eec45c` (metà), verde acqua `#348874` (bene). Vale anche per la mappa
    schematica, che usa la stessa funzione.
  - Misura (`verifica.ts`, `layerContrast`): differenza media di colore tra strato
    spento e acceso sugli stessi pixel dei Tamburi a 390 px, con la stessa camera e
    senza etichette, su una scala da 0 a 255. In `556dc09`: **18,77**. Ora: **46,71**.
    Soglia dichiarata: **40**, più del doppio del valore di partenza; la verifica fallisce
    sotto la soglia o sotto il doppio.
- **Riserva.** Senza WebGL, o se dopo 5,5 secondi il plastico disegna meno di 20
  immagini al secondo, il gioco passa alla mappa schematica e lo dice. La si sceglie
  anche a mano (pannello Strati, ricordata nel browser) o con `?mappa=schematica`
  nell'indirizzo; `?mappa=plastico` forza il 3D.
- **Accessibilità.** Il pulsante «Elenco» riporta in testo ogni informazione della
  mappa: i sei valori di ogni quartiere, anche fuori dalla zona, e per ogni lotto
  strada, fase, anni mancanti, avanzamento e aspetto sul plastico. Ogni voce apre la
  stessa finestra del tocco sulla mappa.
- **Attribuzione.** «© OpenStreetMap contributors · ODbL» resta visibile in un angolo
  del plastico, con il collegamento alla pagina dei diritti.

## Disposizione

- In alto: anno ed epoca, le tre casse (un tocco apre il bilancio), capacità degli
  uffici (solo su schermo largo), barre di coscienza e reputazione, «?» e «Partita».
- In basso: i comandi del tempo e la riga delle fermate.
- Sul lato destro: Consiglio, Cantieri, Bilancio, Grafici, Politiche, Strati, Elenco.
- Le finestre si aprono sopra la mappa e si chiudono con un tocco fuori o con
  «Chiudi». Sul telefono salgono dal basso (al massimo il 78% dell'altezza); sullo
  schermo largo stanno a destra, accanto ai pulsanti, che restano attivi.

## Tavolozza

| Uso | Colore |
| --- | --- |
| Terreno | `#e8dcc0` |
| Mare e acque | `#6fb1cf` |
| Stabilimento | `#c8b79f` |
| Altre aree industriali | `#d5c8b2` |
| Verde: parco, campo sportivo, bosco, macchia, prato, campi, cimitero | `#8cc46a`, `#a6d27a`, `#5e9b4c`, `#7fa860`, `#9ccb74`, `#c9d27e`, `#93b884` |
| Strade, dalle principali alle minori | `#f2c14e`, `#f6d27a`, `#fbf4e4`, `#f7efdf` |
| Ferrovie | `#8b8072` |
| Moli | `#c9c2b4` |
| Pareti delle case | `#f2e4c9`, `#ecd3b0`, `#f5ede1`, `#e7caa7`, `#ddd3c2`, `#f0d9c0` |
| Tetti delle case | `#c8694b`, `#b65c43`, `#d8d3ca`, `#a9a299`, `#cf7a55` |
| Capannoni (pareti, tetti) | `#bcb6ac`, `#a9a49c`, `#cbc4b8`; `#8f9ba4`, `#9e9186`, `#b0aba2` |
| Edifici pubblici | `#f3d8a4`, `#efc994`; tetto `#c46a4f` |
| Ruggine (stabilimento fermo) | pareti `#8f7b69`, `#7d6f65`, `#9c8774`, `#86705e`; tetti `#8a4b2c`, `#9c5a35`, `#6f5a49`, `#7d4630` |
| Terreno dei lotti: fermo, cantiere, acciaio, bosco, energia, mare | `#a59683`, `#c7a77c`, `#cfcbc3`, `#8cc46a`, `#b8d48c`, `#e6dcc6` (fascia di raccordo: a metà con `#c8b79f`) |
| Piazza di «mare e cultura» | `#f3ead6` |
| Evidenza della selezione | `#1f6fd1` |
| Legenda e strati (male, metà, bene) | `#be5c26`, `#eec45c`, `#348874` |
| Cielo | `#d6e6ee` |

## Modelli: origine e licenza

Nessun modello esterno, nessuna texture: tutto è costruito dal codice in
`apps/game/src/plastico/scene.ts` con parallelepipedi, cilindri, coni e prismi. Sono
originali e seguono la licenza del codice (AGPL-3.0). Nessun elemento è copiato da
altri giochi.

| Aspetto del lotto | Che cosa si vede | Origine |
| --- | --- | --- |
| Fermo | Gli edifici veri del reparto (sagome OpenStreetMap) in colori di ruggine, tre torri e due camini spenti, un nastro trasportatore, cumuli di minerale rossastri | Sagome: OpenStreetMap (ODbL); resto: codice |
| Cantiere | Terra smossa, recinzione arancione sui quattro lati, tre gru a torre gialle con il braccio che gira piano, cumuli di terra, strutture a metà | Codice |
| Acciaio con forni nuovi | Otto capannoni bianchi con tetti azzurri, edifici di servizio, camion, un solo camino bianco e rosso con poco fumo | Codice |
| Bosco giovane | Prato e circa 300 alberelli di altezze e verdi diversi, con un sentiero libero | Codice |
| Energia | Sei pale eoliche che girano e file di pannelli solari | Codice |
| Mare e cultura | Pavimentazione chiara, una piazza, sei edifici pubblici colorati, viali alberati; sui lati che danno sull'acqua vera, banchina aperta con bitte e barche ormeggiate fuori dal lotto. Nessuna acqua finta | Codice |

## Prestazioni

Misurate da `apps/game/scripts/verifica.ts` con Edge su questo computer, muovendo la
camera tra quattro punti della zona e leggendo le immagini al secondo degli ultimi due
secondi dopo ogni spostamento. **Il telefono di fascia media è simulato** con il
processore rallentato 4 volte, schermo di 390 × 844 px a densità 2: è un sostituto
dichiarato, non una misura su un telefono vero. La scheda grafica resta quella del
computer, quindi la misura dice soprattutto se il lavoro del processore regge. La prova
su un telefono vero la farà Michele.

| Prova | Media | Minima | Esito |
| --- | ---: | ---: | --- |
| 390 × 844 px, densità 2, processore rallentato 4× (sostituto del telefono), prima esecuzione | 40,6 | 37,8 | sopra 30 |
| 390 × 844 px, densità 2, processore rallentato 4×, seconda esecuzione | 36,6 | 34,0 | sopra 30 |
| 1280 × 900 px, densità 1, processore normale | 50,4-57,0 | 43,0-51,9 | sopra 30 |

Immagini al secondo. Le due esecuzioni a 390 px differiscono di qualche immagine: la
misura dipende dal carico del computer in quel momento. Il gioco passa da solo alla
mappa schematica sotto 20 immagini al secondo.

**Dopo la revisione.** In una nuova esecuzione il minimo a 390 px è sceso a 29. Misurata
nello stesso momento, anche `556dc09` dava gli stessi numeri (media 31,5-33,9, minima
29,0-32,1): era il computer, più carico, non il codice nuovo. Per avere margine, la
mappa d'ombra non si ridisegna più a ogni immagine: si ridisegna quando cambia l'aspetto
di un lotto e, se ci sono parti in movimento (pale, gru, fumo), ogni 12 immagini. Le
ombre degli edifici non cambiano quando la camera si muove, perché il sole è fermo.

| Prova, stesso computer e stesso momento | Media | Minima |
| --- | ---: | ---: |
| `556dc09`, 390 px, processore rallentato 4×, quattro esecuzioni | 31,5-33,9 | 29,0-32,1 |
| Dopo la revisione, ombre ridisegnate solo quando serve, quattro esecuzioni | 44,2-46,1 | 39,4-41,2 |

`verifica.ts --prestazioni` ripete la misura a 390 px quattro volte.

## Pesi

| Che cosa | Normale | Compresso (gzip) |
| --- | ---: | ---: |
| `packages/content/geo/plastico.json` | 766 kB (T11: 724 kB) | 215 kB (T11: 203 kB) |
| `packages/content/geo/lotti.json` | 2,8 kB | 0,9 kB |
| Pezzo del plastico nel gioco costruito (three.js, scena, dati) | 1.239 kB | 346 kB |
| Pezzo principale del gioco (come nel T10: +1 kB per la nuova disposizione) | 581 kB | 151 kB |

## Estendere il plastico a tutta la città

Che cosa manca, con una stima del lavoro per una persona che conosce il codice:

1. **Dati.** Scaricare il resto del territorio comunale (Paolo VI, Borgo intero,
   Città Vecchia, Tre Carrare, Solito-Corvisea, Salinella, Talsano, Lama, San Vito,
   Mar Piccolo secondo seno): circa 70 km² e 40-50 mila edifici. Il file ridotto
   salirebbe a 5-6 MB (1,5 MB compresso): va diviso in tasselli caricati secondo la
   vista. **2-3 giorni.**
2. **Tasselli e livelli di dettaglio.** Geometria per tasselli di 1 km, caricati e
   scaricati con la camera; edifici più semplici da lontano (solo volumi, senza
   ombre). **4-6 giorni.**
3. **Contorni dei quartieri** dai confini ufficiali delle circoscrizioni (dati aperti
   del Comune, con fonte) al posto dei poligoni stimati. **1 giorno.**
4. **Ombre e prestazioni** su un'area dieci volte più grande: mappa d'ombra a cascata
   o ombre solo vicino alla camera; nuova misura sul telefono. **2-3 giorni.**
5. **Luoghi riconoscibili** (ponte girevole, Castello Aragonese, concattedrale,
   lungomare): modelli semplici fatti dal codice o presi da raccolte con licenza
   libera, annotati in `docs/FONTI.md`. **3-5 giorni.**
6. **Elementi vivi**: traffico leggero, navi in Mar Grande, luci di sera. **3-4 giorni.**

In tutto **15-22 giorni di lavoro**, più il giudizio di Michele sull'aspetto dopo
ogni zona (D18: «si procede una zona alla volta»).

## Città isometrica (T12): brief di direzione artistica

Decisione D20: città isometrica nello stile dei gestionali di città di fine anni '90,
ricca di dettagli, a colori pieni, senza effetto modellino né bordi. Questo brief
segue il modello della skill `create-game-assets` (`assets/art-direction-brief.md`).
Lo stato è **provino (fase A), in attesa dell'approvazione di Michele**. Fino a quel
momento nessun elemento è approvato per la produzione (fase B).

Provino: pagina di solo sviluppo `apps/game/provino.html` (`pnpm --filter
@taranto2127/game dev`, poi `/provino.html?vista=isolato|costa|parchi|tipi`, con
`&stato=fermo|bosco` per i parchi). Schermate con `pnpm --filter @taranto2127/game
provino`. Codice in `apps/game/src/iso/` (`tipi.ts`, `texture.ts`, `citta.ts`) e
`apps/game/src/provino.ts`. La costruzione del gioco pubblicato non include il provino.

### Quadro del gioco

- **Cosa prova chi gioca.** Governa Taranto per cento anni e vede la città cambiare
  lotto per lotto: lo stabilimento che si ferma, i parchi minerali che diventano
  bosco, i Tamburi che respirano. La mappa deve far riconoscere la propria città.
- **Motore.** three.js 0.169.0, WebGL, nessuno strato sopra. Nessuna funzione
  successiva alla 0.169.
- **Piattaforme.** Browser da computer (1280 px) e telefono (390 px, densità 2).
- **Vista.** Camera ortografica con angolo fisso: azimut 45° (si guarda da sud-est
  verso nord-ovest), elevazione 30°. È la vista dimetrica 2:1 del genere: un metro
  in orizzontale sullo schermo diventa mezzo metro in verticale. In fase B si ruota
  solo a scatti di 90°, quindi quattro orientamenti, sempre con lo stesso angolo.
- **Scala.** Scala reale, in pixel per metro (ppm): nessuna esagerazione verticale
  (il plastico alzava le altezze di 2,4 volte). Ingrandimenti usati nel provino:
  isolato 4 ppm, costa 2,6 ppm, parchi 1,15 ppm, foglio dei tipi 5 ppm. A 4 ppm una
  palazzina di sei piani è alta circa 40 px sullo schermo, una campata è larga 14 px.
- **Grandezza tipica sullo schermo.** Palazzina: 60-200 px di lato. Albero: 15-30 px.
  Finestra: 5-8 px. Sotto 1,5 ppm le finestre diventano una trama: va bene, perché a
  quella distanza contano le masse e i colori.

### Sistema visivo

- **Forme.** Volumi semplici estrusi dalle sagome OpenStreetMap, con spigoli vivi.
  Nessuna forma arrotondata se non cisterne, ciminiere e chiome. Il dettaglio sta
  sui tetti (parapetti, cisterne, antenne, falde) e sulle facciate (texture), non
  nella geometria delle pareti.
- **Sagome che contano.** Il profilo dei tetti distingue i tipi: terrazza con
  parapetto bianco (palazzine), falde in coppi (case e scuole), falde in lamiera
  (capannoni), ciminiera alta con fascia (impianti). Si devono riconoscere anche a
  1,5 ppm, quando le finestre non si leggono più.
- **Valori (chiari e scuri).** Il terreno chiaro (sabbia e intonaco) fa da fondo. Le
  facciate stanno a metà. Ombre, asfalto, mare e chiome scure sono i bassi. I tetti
  piani chiari fanno da luci alte e indicano subito dove c'è città fitta.
- **Tavolozza e ruoli.**

  | Ruolo | Colori | Perché |
  | --- | --- | --- |
  | Terreno di campagna | `#cfc58f` | terra secca e prato bruciato del sud d'estate |
  | Suolo urbano | `#d9d1bd`, marciapiedi `#d3ccbf` | fondo chiaro su cui si stagliano le case |
  | Piazzali dello stabilimento | `#c8b89a` | più bruno e polveroso della città |
  | Mare | `#2f83c4`, riflesso `#9fc9ea` | blu pieno e saturo, l'elemento più forte del quadro |
  | Asfalto | `#56595f` (superstrada `#4c4f55`), segnaletica `#f4f2ea` | strade leggibili come reticolo scuro |
  | Binari | `#7d7266` | bruno ferroso, distinto dall'asfalto |
  | Intonaci delle palazzine | `#ecc779` `#e9a07f` `#f2e3bd` `#dd8f5c` `#e6cf9a` `#c9a46d` `#f0b98a` | gialli, ocra, rosa e terracotta caldi: la gamma dei quartieri popolari del sud |
  | Intonaci della Città Vecchia | `#f3e6c4` `#e9c9a3` `#d9c7a1` `#f1d6b8` `#e3d2b0` `#cdbb93` | pastelli chiari e tufo |
  | Case basse | `#f4ead2` `#efd2a2` `#e6b48b` `#f3e2b3` | chiare, quasi bianche |
  | Edifici pubblici | `#e7b76f` `#d9a06a` `#f0d79d` | ocra istituzionale |
  | Negozi | `#ece6d8` `#e3dccb` `#f3efe4`, tende `#c4473a` | neutri, con il rosso delle tende come unico accento |
  | Capannoni | `#9aa7b3` `#b7bdc2` `#8e9aa5` `#a6b1a2`, coperture `#7d8a96` `#8f9aa4` `#6f7b86` | grigi freddi: l'industria si legge come zona fredda in una città calda |
  | Impianti e ciminiere | `#b8b0a3` `#a59c8f` `#c4bcae`, fusto `#c9c2b6`, fascia `#c0392b` o `#7a7470` | cemento; la fascia rossa segna le ciminiere da lontano |
  | Tetti a terrazza | `#cfc9bd` `#d8d2c6` `#c5beb1`, parapetto `#f3efe6`, cisterne `#eef1f2`, antenne `#4f5357` | il carattere dei tetti di Taranto |
  | Coppi | `#c5623d` `#b8573a` `#cf7048` | terracotta, unico rosso caldo dei tetti |
  | Alberi | pino domestico `#3f6f3a` `#467a3e` `#365f34`; latifoglie `#5a9a3c` `#67a844` `#4f8f38` `#73b04a`; giovani `#6fae46` `#7dba50` `#5f9e3e` `#8cc25a`; tronchi `#6b4d33` | tre verdi per tre età: si legge a colpo d'occhio un bosco giovane |
  | Verde a terra | parco `#79b84e`, prato `#86c057`, bosco `#4f8f3c`, macchia `#6f9f4b`, campi `#c2c967` | prati saturi, come in una giornata di primavera |
  | Parchi minerali fermi | fondo `#a89377`; minerale di ferro `#8a3b22` `#7a3220`; carbone `#2f2b29` `#3a3431`; calcare `#a8a29a`; macchine `#9a5b35` | i cumuli rosso ruggine e neri sono il segno più riconoscibile dello stabilimento |
  | Bosco dopo la bonifica | fondo `#86bd55`, sentieri `#e2d6b3` | verde chiaro e nuovo contro il bruno dello stabilimento |

  Variazione: ogni edificio pesca il suo intonaco dalla gamma del tipo con
  `hash01(identificativo)`, mai a caso: la stessa sagoma ha sempre lo stesso colore.

- **Materiali.** `MeshLambertMaterial` per tutto ciò che è opaco (intonaco, lamiera,
  terra), `MeshPhongMaterial` con brillantezza 60 solo per il mare. Le texture delle
  facciate sono quasi bianche e moltiplicano il colore della geometria: una sola
  texture per stile serve tutti i colori.
- **Bordi e linee.** Nessun contorno disegnato, nessun effetto di linea: gli spigoli
  si leggono per differenza di luce tra le tre facce visibili (tetto chiaro, faccia
  al sole, faccia in ombra). Nessuna sfocatura, nessuna lastra sotto la città,
  nessun bordo: oltre l'area di gioco il terreno continua per 6 km in tinta unita
  e il mare resta mare, così lo schermo non mostra mai il vuoto.
- **Luce.** Una giornata di sole a metà mattina. Sole caldo `#fff3d9` da sud-ovest,
  alto (intensità 2,6); cielo diffuso `#d4e9ff` sopra e `#b8a57c` sotto (intensità
  1,5), così le facce in ombra restano leggibili e calde. Ombre portate morbide ai
  bordi (`PCFSoftShadowMap`), lunghe circa quanto l'edificio è alto. Lo sfondo del
  cielo `#bcdcf2` non si vede mai nelle viste normali.
- **Densità di dettaglio e gerarchia.** Più dettaglio dove c'è vita: Tamburi e
  Città Vecchia (balconi, cisterne, antenne, alberi nei cortili, viali alberati).
  Meno dettaglio nello stabilimento (volumi grandi, lamiera, poche ciminiere ben
  visibili). I lotti di ILSIDER hanno l'aspetto più forte del quadro, perché sono il
  centro del gioco: cumuli colorati da fermi, verde chiaro e fitto da bosco.
- **Movimento.** Nel provino nulla si muove. In fase B: rotazione a scatti di 90° con
  passaggio morbido, movimenti con fattore dipendente dal tempo trascorso; più avanti
  forse navi e traffico leggero, solo se il budget lo permette.
- **Cosa si prende dal genere.** Vista isometrica con angolo fisso, città fitta e
  leggibile, tetti e finestre in vista, viali alberati, giardini, moli, colori pieni
  e saturi, giornata di sole, edifici distinti per tipo a colpo d'occhio.
- **Cosa non si prende (esclusioni).** Niente immagini, texture, modelli, icone,
  pannelli, caratteri, nomi o loghi di SimCity o di altri giochi. Niente edifici
  riconoscibili di altri giochi, niente minimappa a rombo, niente interfaccia a
  pannelli del genere. Le immagini di riferimento di Michele non entrano nel
  repository. Niente scritte sulle insegne e sulle tende (nessun marchio, nessun
  testo da tradurre). Niente immagini generate con servizi a pagamento senza il via
  di Michele: nel provino tutto è disegnato dal codice.

### Tipi di edificio e luoghi di Taranto

Il tipo si ricava dai dati OpenStreetMap (`k`), dalla superficie della sagoma e dal
luogo (quartiere, recinto dello stabilimento): `apps/game/src/iso/tipi.ts`. Foglio di
confronto: `docs/schermate/provino-tipi-1280.png`.

| Tipo | Come si riconosce | Quando |
| --- | --- | --- |
| Palazzina dei Tamburi | 4-7 piani, tetto piano a terrazza con parapetto bianco, 1-4 cisterne e 1-3 antenne, facciata a balconi con ringhiera | sagome tra 160 e 2.500 m² fuori dalla Città Vecchia |
| Casa della Città Vecchia | 3-5 piani, terrazza, persiane verdi, pastelli chiari, edifici serrati | sagome nel quartiere Città Vecchia |
| Casa bassa | 1-3 piani, persiane; terrazza o, sulle sagome rettangolari, falde in coppi (circa 45%) | sagome sotto i 160 m² |
| Edificio pubblico | 2-4 piani, finestre a nastro, falde in coppi o tetto piano, ocra | scuole, uffici, chiese in OSM, o sagome sopra i 2.500 m² |
| Negozi | 1-2 piani, vetrine con tende rosse e bianche, tetto piano | negozi in OSM e alcune grandi sagome |
| Capannone | 10-22 m di gronda, lamiera grecata, falde in lamiera, grigio freddo | industria in OSM e sagome nello stabilimento |
| Impianto con ciminiera | volume cieco di cemento con una ciminiera alta e una fascia rossa o grigia | circa una sagoma media su cinque nel recinto dello stabilimento |
| Garage e annessi | un piano, tetto piano, intonaco grigio chiaro | sagome sotto i 40 m² o `basso` in OSM |

Come si riconosce Taranto:

- **Tamburi.** Palazzine fitte con tetti a terrazza, parapetti bianchi, cisterne e
  antenne; intonaci caldi; pini domestici nei cortili e viali alberati. Lo
  stabilimento si vede subito oltre la strada, grigio e bruno.
- **Città Vecchia.** Case strette e alte, terrazze, pastelli e tufo, poche strade.
  Nel riquadro attuale ne entrano solo due sagome: va rivista quando la zona si
  allarga.
- **Stabilimento.** Capannoni lunghi in lamiera grigia, ciminiere con la fascia,
  binari, nastri, cumuli rossi e neri dei parchi minerali.
- **Mar Piccolo.** Mare blu pieno, moli e banchine chiare, binari lungo la costa.

### Contratto tecnico

- **Texture delle facciate.** Disegnate dal codice su tela (`texture.ts`), 128 × 114
  px, un modulo di una campata (3,6 m) per un piano (3,2 m), ripetute lungo le
  pareti. Sei stili: balconi, persiane, nastro, vetrine, lamiera, cieco. Spazio
  colore sRGB (texture di colore), anisotropia 4, mipmap di three.js. Nessuna
  trasparenza. Memoria: sei texture da circa 58 kB ciascuna, con le mipmap circa
  80 kB, in tutto meno di 0,5 MB.
- **Geometria.** Le pareti di tutti gli edifici con lo stesso stile di facciata
  sono raggruppate in una sola geometria con colori per vertice; tetti in una
  geometria; cisterne, antenne e alberi ripetuti con `InstancedMesh`. Varianti solo
  da `hash01(identificativo, n)`, mai `Math.random`.
- **Coordinate.** Metri dal centro della zona; x verso est, z verso sud, y in alto.
  Base degli edifici a y = 0. Fondi dei lotti a y 0,11, sentieri a 0,13, binari dei
  parchi a 0,14, così non si mescolano con l'acqua e le strade.
- **Densità di pixel.** Al massimo 1,5 (punto di partenza della scheda), da rivedere
  con le misure in fase B.
- **Numeri del provino** (tutta la zona costruita ad alto dettaglio, misura di
  `renderer.info` a 1280 px):

  | Vista | Ordini di disegno | Triangoli |
  | --- | ---: | ---: |
  | Isolato | 23 | 742 mila |
  | Costa | 16 | 606 mila |
  | Parchi fermi | 79 | 744 mila |
  | Parchi a bosco | 38 | 977 mila |
  | Foglio dei tipi | 17 | 3,7 mila |

  Zona: 2.157 edifici (490 palazzine, 263 case, 2 della Città Vecchia, 14 pubblici,
  6 negozi, 304 capannoni, 14 impianti, 1.064 garage e annessi), 5.716 alberi
  (10.359 con il bosco). I numeri comprendono le ombre. Le macchine e i nastri dei
  parchi fermi sono ancora oggetti separati: in fase B vanno raggruppati. I budget
  per livello di dettaglio si fissano in fase B con le misure in millisecondi.

### Bersaglio visivo e approvazione

- **Bersaglio proposto:** `docs/schermate/provino-isolato-1280.png` (con la versione a
  390 px), più costa, parchi fermi, parchi a bosco e foglio dei tipi, tutti in
  `docs/schermate/provino-*.png`, catturati alla scala reale del gioco.
- **Elenco degli elementi:** `docs/grafica-elementi.json`, con origine, licenza e
  stato di ogni elemento.
- **Approvazione:** Michele, nella scheda T12 di `docs/TASKS.md`. Finché manca,
  tutti gli elementi restano «in attesa» e non si passa alla fase B.
