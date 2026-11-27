# Grafica: la città isometrica

Dal T12 (D20) la mappa è una città isometrica nello stile dei gestionali di città di
fine anni '90: vista fissa con rotazione a scatti di 90°, colori pieni, giornata di
sole, niente effetto modellino né bordi. Dal T12c l'aspetto è «illustrato»: tre fasce
di luce nette, contorni scuri sottili, colori pieni, città che si muove. La zona è quella del T11: i Tamburi, lo
stabilimento ILSIDER e il primo seno del Mar Piccolo, con un pezzo di Mar Grande, del
porto, della Città Vecchia e del Borgo.

- Brief di direzione artistica (fase A, approvato): sezione «Città isometrica (T12):
  brief di direzione artistica».
- Com'è fatta la città nel gioco, livelli di dettaglio, budget e misure (fase B):
  sezione «Città isometrica (T12, fase B): com'è fatta».
- Elenco degli elementi grafici con origine, licenza e approvazione:
  `docs/grafica-elementi.json`.
- La disposizione dei comandi resta quella del T11 (qui sotto), con in più i pulsanti
  della vista a sinistra.
- Partita guidata dei primi cinque anni, scelta all'avvio (T16): sezione «Partita guidata (T16)».
- Tutta la mappa sul telefono, area libera dai comandi e distanza massima (T12e): sezione
  «Tutta la mappa sul telefono (T12e)».
- Compatibilità con i browser, avvio a prova di dati vecchi, messaggio di guasto (T12d):
  sezione «Compatibilità e avvio (T12d): mai più pagina bianca».
- Aspetto illustrato (T12c): sistema visivo, edifici a parti, vita della città, prove e
  misure: sezione «Aspetto illustrato (T12c): sistema visivo». Vale sopra le sezioni di
  T12 dove dicono cose diverse (tavolozza, luce, mare, livelli).

## Disposizione

- In alto: anno ed epoca, le tre casse (un tocco apre il bilancio), capacità degli
  uffici (solo su schermo largo), barre di coscienza e reputazione, «?» e «Partita».
- In basso: i comandi del tempo e la riga delle fermate.
- Sul lato destro: Consiglio, Cantieri, Bilancio, Grafici, Politiche, Strati, Elenco.
- Le finestre si aprono sopra la mappa e si chiudono con un tocco fuori o con
  «Chiudi». Sul telefono salgono dal basso (al massimo il 78% dell'altezza); sullo
  schermo largo stanno a destra, accanto ai pulsanti, che restano attivi.
- A sinistra, sopra l'attribuzione di OpenStreetMap (T12): «+» e «−» per avvicinare e
  allontanare, «⟳» per ruotare la vista di un quarto di giro.

## Partita guidata (T16)

- **All'avvio**, chi arriva per la prima volta sceglie tra «Partita guidata (consigliata la
  prima volta)» e «Partita libera» (`tutorial.tsx`, `SceltaPartita`; il fuoco va sul primo
  pulsante). La visita guidata di T08 non si apre più da sola: resta in «?», «Rivedi la visita
  guidata».
- **Un passo alla volta** (`tutorial.tsx`, `Tutorial`): un riquadro giallo di 3 pixel attorno
  al comando da toccare e il resto scurito al 45% (un'ombra che non blocca i tocchi); un
  fumetto con «Partita guidata · passo N di 15» e, sulla stessa riga, «Esci dal tutorial»,
  poi il testo. Il fumetto va sotto il comando se ci sta per intero, altrimenti sopra, altrimenti
  dalla parte più larga (il testo scorre); non copre mai il comando. Nel dilemma il fumetto
  entra nella finestra, tra le opzioni e «Scegli questa opzione», e scorre con il contenuto:
  non copre nessuna opzione, e lì l'ombra non c'è (il dilemma è già in primo piano). Un comando
  in fondo a una finestra che scorre viene portato in vista. Il comando evidenziato è il primo dell'elenco del passo che è sullo schermo
  e non è coperto da altro: sul telefono, se una finestra copre il pulsante, si evidenzia
  «Chiudi» e il fumetto aggiunge «Prima chiudi la finestra aperta: il comando che serve è
  sotto».
- **Avanti solo facendo:** il passo cambia quando il giocatore ha fatto l'azione, controllata
  a ogni cambio dello stato e ogni 300 ms per ciò che sta solo nella pagina; mai a tempo.
  L'avanzamento porta con sé il passo da cui parte, così due controlli dello stesso passo non
  ne fanno saltare uno.
- **Facoltativa:** «Esci dal tutorial» in ogni passo; da «?» si riprende dal passo in cui si
  era, anche dopo una ricarica (il punto è salvato nel browser, `taranto2127:tutorial`). Alla
  fine del quinto anno «Fine» chiude la guida e la partita continua.
- **Accessibilità:** il fumetto è una finestra non modale con `aria-live`, letta dai lettori di
  schermo; il fuoco da tastiera va sul comando evidenziato; nessuna animazione né transizione;
  funziona a 360 px in verticale e con la mappa schematica (dove lo strato è sempre acceso e
  il passo «strato» si salta da solo).
- **Identificativi nuovi:** `scelta-partita`, `scelta-guidata`, `scelta-libera`, `tutorial`
  (con `data-passo` e `data-bersaglio`), `tutorial-evidenza`, `tutorial-esci`, `tutorial-fine`,
  `tutorial-prima-chiudi`, `aiuto-tutorial`; nella finestra del lotto `strade-lotto` e
  `strada-<strada>`.
- **Prove nel browser** (`scripts/verifica.ts --t16`, anche nella verifica completa): una
  partita da copione completa il tutorial a 360, 390 e 1280 px, con la città 3D e con la mappa
  schematica; a ogni passo il comando è sullo schermo, in cima, non coperto dal fumetto, con
  il fuoco se può riceverlo (non se è disabilitato), senza animazioni; il fumetto si vede per
  intero e non copre le opzioni di un dilemma; alla fine la partita è al 2032. Uscita e ripresa
  da «?», anche dopo una ricarica. Schermate di ogni passo a 390 px:
  `docs/schermate/t16-passo-NN-<passo>-390.png`, e la scelta all'avvio `t16-scelta-390.png`.

## Tutta la mappa sul telefono (T12e)

Sul telefono di Michele (Android, verticale), anche allontanando al massimo, alcune parti
della zona non si vedevano: alla distanza massima di T12 (0,3 pixel per metro) la zona non
entrava nella larghezza dello schermo, e il limite dello spostamento non teneva conto dei
comandi sopra la mappa, quindi i bordi della zona restavano sotto i comandi.

- **Area libera** (`plastico/Plastico.tsx`, `areaLiberaDa`): la tela meno i comandi che la
  coprono, cioè barra in alto (`.hud-top`), comandi del tempo (`.timebar`), colonna dei
  pulsanti (`.rail`), pulsanti di ingrandimento (`.map-controls`) e finestre aperte
  (`.map-window`). Un comando largo almeno metà della tela toglie spazio in alto o in basso,
  gli altri a sinistra o a destra, secondo da che parte stanno. La scena la rilegge a ogni
  cambio di dimensione e ogni dieci immagini, quindi segue le finestre che si aprono e si
  chiudono e il telefono che ruota. Dentro l'area libera si tiene un margine di 8 pixel
  (`MARGINE_PX`), uguale a ogni ingrandimento.
- **Distanza massima** (`iso/vista.ts`, `ppmDistanzaMassima`), non più fissa, con la
  correzione decisa da Michele dopo la revisione del primo invio (`9f95381`, in cui sul
  telefono la zona entrava tutta ma diventava un rombo minuscolo in mezzo a un prato finto):
  - **area libera più alta che larga** (telefono in verticale): l'ingrandimento più piccolo
    a cui la zona riempie in larghezza l'area libera e almeno il 70% dell'area libera cade
    sopra la zona, con il centro della zona al centro dell'area libera (il calcolo cerca il
    74%, per non stare sul filo). La copertura è geometrica: il quadrilatero della zona sullo
    schermo ritagliato con il rettangolo libero. I lati che restano fuori si raggiungono
    trascinando. Misurata: 0,085 px/m a 360 px, 0,099 a 390, 0,108 sul telefono lungo
    1080×2340 (nel primo invio circa 0,02), zona larga 924-1177 px su un'area libera di
    212-264 px, copertura 72%;
  - **area libera più larga che alta** (computer, telefono in orizzontale): l'ingrandimento a
    cui la zona entra tutta, con il 4% d'aria, come nel primo invio (0,098 px/m a 1280 px).
  - Al più 0,3 pixel per metro, come in T12.
- **Limite dello spostamento** (`limitaCentro`): calcolato sugli assi dello schermo e
  sull'area libera. Ogni estremo della zona può arrivare al bordo dell'area libera, e lì la
  vista si ferma; su un asse in cui la zona è più piccola dell'area libera, la zona resta al
  centro dell'area libera. Il margine di 250 m della vista di T12 è stato tolto: da vicino
  valeva centinaia di pixel e nascondeva i vertici sotto i comandi.
- **Oltre la zona:** da così lontano la vista copre decine di chilometri verso l'orizzonte.
  Il terreno e il mare oltre la zona arrivano a 60 km (erano 6), e la camera si allontana
  quanto serve perché nulla resti dietro di lei o oltre il piano di fondo: gli angoli dello
  schermo non mostrano mai lo sfondo, anche alla distanza massima.

**Prove.** In `vista.test.ts`: sugli schermi larghi alla distanza massima i quattro vertici
nell'area libera; sul telefono in verticale la zona riempie in larghezza e copre almeno il 70%
(tre telefoni, quattro orientamenti); la copertura geometrica su casi noti; spingendo verso ciascun bordo il vertice di quel lato entra
nell'area libera e la vista si ferma; arresto esatto al bordo efficace; un'area libera
assurda non blocca la vista. Nel browser (`scripts/verifica.ts --t12e`, anche nella verifica
completa): a 360, 390, 1280 px e 1080×2340 (412×892 a densità 2,625), nei quattro
orientamenti, i vertici alla distanza massima e dopo 48 spinte per schermo stanno nell'area
libera e, con un controllo indipendente dal gioco, sotto nessun comando misurato nel DOM;
l'area libera segue la finestra «Elenco»; angoli dello schermo anche a 1e-4 px/m. Sul
telefono in verticale, alla distanza massima, la prova misura dal DOM l'area libera e
controlla che la zona la riempia in larghezza e ne copra almeno il 70%; a 1280 px che la
zona entri tutta.
Schermate alla distanza massima, quattro orientamenti, quattro schermi:
`docs/schermate/t12e-prima-*` (T12, da `main` `9694485`), `t12e-primo-invio-*` (primo invio,
prima della correzione) e `t12e-dopo-*` (dopo la correzione).

## Compatibilità e avvio (T12d): mai più pagina bianca

Il 26 novembre 2026, sul telefono Android di Michele, il gioco pubblicato restava bianco,
anche con `?mappa=schematica`. **Causa** (trovata dall'architetto): il salvataggio
automatico conserva seme e mosse e all'avvio le rigioca con il motore e i dati di oggi;
una partita salvata con una versione precedente conteneva la risposta a un dilemma che oggi
non è più aperto, il motore lanciava «nessun dilemma aperto» dentro l'inizializzazione di
React e la pagina restava vuota. Lo stesso valeva per il link di una partita e per i posti.

### Avvio a prova di dati vecchi

- All'avvio (`engine.ts`, `avvioSicuro`) la partita del link o quella salvata nel browser si
  riapre con `apriPartita`. Se non si può (rigiocarla fallisce, o è stata fatta con dati di
  gioco diversi), **non si apre**: compare l'avviso «Questa partita è stata salvata con una
  versione precedente del gioco e non si può riaprire», parte una partita nuova e la vecchia
  si conserva da parte (`taranto2127:partita:vecchia`) finché il giocatore non la cancella
  con il pulsante «Cancella la partita vecchia» accanto all'avviso. Mai un'eccezione verso
  React.
- Un posto di salvataggio o un file che non si possono riaprire danno lo stesso avviso; la
  partita in corso resta aperta.
- **Versioni nel salvataggio:** ogni salvataggio registra `versioneGioco` (il commit da cui
  è compilato il gioco, impostato da `vite.config.ts`) e `versioneDati` (impronta FNV-1a
  delle regole e dei contenuti iniziali). Se `versioneDati` non è quella di oggi la partita
  non si rigioca nemmeno: con dati diversi le stesse mosse darebbero un'altra partita. I
  salvataggi più vecchi, senza versione, si provano a rigiocare.

### Se qualcosa si rompe lo stesso

- **Sentinella** in `index.html`: script classico in sintassi vecchia (niente `let`,
  `const`, frecce), eseguito prima di tutto. Registra gli errori della pagina e le promesse
  rifiutate; se dopo 10 secondi il gioco non ha detto di essere partito
  (`window.__taranto2127Avviato`), mostra il messaggio «Il gioco non è riuscito a partire»
  con l'errore, il nome e la versione del browser e i pulsanti «Riprova» (ricarica) e
  «Riparti da zero» (cancella dall'archivio del browser le sole chiavi `taranto2127:` e
  ricarica senza parametri). Stili scritti nella pagina: funziona anche se il resto non si
  carica. Senza script attivi, un messaggio `<noscript>`.
- **Contenitore degli errori di React** (`errori.tsx`, `Riserva`): attorno al gioco mostra
  lo stesso messaggio con gli stessi pulsanti; attorno alla città 3D fa ripiegare sulla mappa
  schematica, senza fermare il gioco. Anche un errore nel ciclo delle immagini della città
  ripiega sulla mappa schematica.

### Browser minimi e bersaglio

| | |
| --- | --- |
| Browser minimi | Chrome e Chrome per Android 87 (novembre 2020), Samsung Internet 14 (2021), Edge 88, Firefox 78, Safari e Safari per iOS 15 (2021) |
| Bersaglio di compilazione (`vite.config.ts`, da `src/bersaglio.ts`) | `es2020`, `chrome87`, `edge88`, `firefox78`, `safari15`: la sintassi più recente viene tradotta |

Funzioni più recenti dei browser minimi usate dal motore e dai contenuti, coperte da un
sostituto in `src/compat.ts` (caricato per primo in `main.tsx`, installato solo se il
browser non ha la funzione vera):

| Funzione | Da quando c'è | Usi oggi |
| --- | --- | --- |
| `structuredClone` | Chrome 98, Safari 15.4 | 16, nel motore e nei contenuti |
| `Object.hasOwn` | Chrome 93, Safari 15.4 | 9 |
| `Array.prototype.at` (e `.at` di stringhe e array tipizzati) | Chrome 92, Safari 15.4 | 6 |

Il **controllo automatico** della pagina compilata (`scripts/verifica.ts`, `--t12d` e nella
verifica completa) ricompila ogni file JavaScript della pagina due volte, con il bersaglio
dichiarato e senza limiti: se i due risultati differiscono c'è sintassi oltre il bersaglio.
Poi cerca le funzioni recenti dell'elenco `RECENTI` (`src/bersaglio.ts`: anche `findLast`,
`toSorted`, `Object.groupBy`, `Promise.withResolvers`, `crypto.randomUUID`,
`requestIdleCallback` e altre): ognuna trovata deve avere un sostituto.

### Prove nel browser (`--t12d`)

- La partita della scheda (risposta a `dilemma-di-una-versione-vecchia`) nell'archivio, nel
  link e nel posto 1: il gioco parte con l'avviso e una partita nuova (anno 2027); la
  vecchia è conservata e il pulsante la cancella.
- Un browser senza `structuredClone`, `Object.hasOwn` e `.at()` (tolti prima che la pagina
  parta): il gioco parte, in 3D e con la mappa schematica, senza errori.
- Guasti di prova voluti, scritti nell'archivio del browser alla chiave
  `taranto2127:prova-guasto` (così «Riparti da zero» li toglie davvero): `modulo` (errore
  prima di React: la sentinella), `avvio` (errore dentro React: il contenitore), `citta`
  (errore nel ciclo delle immagini della città) e `citta-disegno` (errore nel disegno della
  città): nei primi due casi il messaggio, negli altri la mappa schematica.
- «Riparti da zero» dal messaggio: le chiavi del gioco spariscono e il gioco riparte.

## Aspetto illustrato (T12c): sistema visivo

Michele, guardando la fase B di T12, aveva indicato quattro difetti: edifici a scatola,
aspetto da modellino, città ferma, colori spenti. Nella fase A di T12c il sistema visivo
è stato provato su un campione in due varianti; Michele ha scelto la **variante 1,
«illustrata»** (24 novembre 2026, campione in `3060f45`). Nella fase B è diventato
l'aspetto di tutta la zona e **l'unico**: la variante 2, il parametro `?aspetto=` e
l'aspetto di T12 sono stati tolti; resta la mappa schematica di riserva. La mappa, la
vista, la rotazione e i livelli di dettaglio non cambiano.

Skill seguite: `create-game-assets` (sistema per assi con valori osservabili, bersaglio
approvato prima del catalogo, giudizio a tre distanze, elenco degli elementi con origine
e licenza), `threejs-materials-lighting` (spazio colore sRGB, nessuna curva dei toni,
intensità tarate perché il colore pieno arrivi allo schermo; verificato a pixel),
`performance-optimization` (budget, tre giri, media e 95° percentile; ciò che si muove è
ripetuto e aggiornato in blocco).

### Codice

| File | Che cosa |
| --- | --- |
| `apps/game/src/iso/aspetto.ts` | Il sistema visivo: tavolozza con i ruoli, luce, fasce, curva dei contorni, soglia dei balconi in rilievo |
| `apps/game/src/iso/catalogo.ts` | Edifici a parti: corpo, piano terra, balconi, coronamento, tetto; chiese, palazzi del centro |
| `apps/game/src/iso/tipi.ts` | Tipi di edificio, regole (con le stime) e varianti ripetibili dall'identificativo |
| `apps/game/src/iso/vita.ts` | La vita della città: lettura dal motore (`vitaDaStato`) e cose che si muovono (`Vita`) |
| `apps/game/src/iso/scena.ts` | Materiali a fasce, contorni secondo l'ingrandimento, balconi in rilievo, «riduci animazioni», sonde per le prove |
| `apps/game/src/iso/texture.ts` | Facciate a colori pieni e piatti (nove stili) |

### Valori

| Asse | Valore |
| --- | --- |
| Luce diretta | sole `#fff8ec`, intensità 1,95, da sud-ovest alto (direzione di T12) |
| Luce diffusa | emisfero: cielo `#f2f6ff`, suolo `#d8c8a8`, intensità 1,25 |
| Fasce | **tre fasce nette** sulle facce, senza sfumature tra l'una e l'altra (`MeshToonMaterial`): in ombra 0,50, di fianco 0,74, al sole 1,0. Nella fase A la fascia in ombra era 0,30: da lontano i Tamburi diventavano una massa scura |
| Colore al sole | tetto al sole: (1,25 · cielo + 1,95 · sole) / π ≈ 0,92-0,98 del colore scritto, senza curva dei toni; verificato a pixel (sotto) |
| Ombre portate | a bordo netto (PCF), mappa 4096 px all'alto e 2048 al medio, nessuna al basso |
| Contorni | `#2b2530`, un pixel, su spigoli verticali (dove la parete gira più di 25°), gronde, colmi, cornicioni, tende, ciminiere, serbatoi, nastri, strutture dei lotti; una riga sola per balcone (il bordo della ringhiera) |
| Contorni e distanza | opacità che sale in modo continuo (curva *smoothstep*) da 0 a 0,9 tra 1 e 3 pixel per metro: da lontano spariscono, da vicino sono pieni, nessuno scatto (approvazione, punto 2). Sotto l'opacità 0,06 (circa 1,25 px/m) le linee non si disegnano affatto: una riga di un pixel al 6% non si distingue |
| Mare | luce diffusa con la mappa delle onde, **nessun riflesso speculare**: uguale nei quattro orientamenti (prova sotto); fascia chiara `#46b3cf` sotto costa che sfuma nel mare in 40 m |

**Tavolozza con i ruoli** (`aspetto.ts`, `TAVOLOZZA`; suolo in `texture.ts`, mare e strade
in `suolo.ts`, chiome in `edifici.ts`): è quella approvata nella fase A, con in più i colori
dello stabilimento e dei lotti.

| Ruolo | Colori |
| --- | --- |
| Intonaci delle palazzine | `#f2c46d`, `#ec9b6c`, `#f6dfb2`, `#dc7b52`, `#f7ead0`, `#eab09a`, `#f0a95e`, `#e6c98d`, `#a9c9dc` |
| Case basse | `#fbf3e1`, `#f6d9a8`, `#f3c3a4`, `#fae7b8`, `#d9e6c4` |
| Città Vecchia | `#f6e7c6`, `#f1cfa8`, `#f7dcc0`, `#efe0b6`, `#e6d3ae`, `#f4c9a8` |
| Palazzi del centro | `#f0d9a8`, `#e8c48e`, `#f3e3c3`, `#e6b48f`, `#f5ead3`, `#dfa77f`; zoccolo `#c9a27c` |
| Scuole e uffici, chiese | `#f0c987`, `#e9a77a`, `#f4dfb4`, `#cfe0c4`; chiese `#f3e6c8`, `#efdcb4`, `#f6efe0` |
| Calce, cornicioni | `#fbf6ec`, `#fff4dc` |
| Terrazze, coppi | `#e3c9a5`, `#d9b893`, `#cfd3d6`; coppi `#d0582f`, `#c24c2b`, `#dd6c3c` |
| Capannoni | lamiere `#5f8fb8`, `#8db3cc`, `#d4dde2`, `#6ba59a`, `#b6c7d1`, `#a85a32`, `#c0703c`; tetti `#6f8798`, `#8a9fab`, `#5b7385`; gronde `#f2efe6`, `#d63a2a`, `#2f6f9f`, `#f0b429` |
| Impianti fermi (lotti) | lamiere `#9c5a3a`, `#8a5a44`, `#a8673f`, `#7f5e4c`, `#94603f`; tetti `#7d4630`, `#6f5a49`, `#8a4b2c` |
| Stabilimento | serbatoi `#f4f5f2`, `#e6e9ea`, `#d7dcdf`, `#c9744a`, `#f0e6d2` con la fascia rossa o blu; ciminiere `#e6e0d6` con la fascia `#d63a2a`; nastri `#c08a4e` su cavalletti `#6d5a4a`; tubi `#9aa4ab`, `#c6633a`, `#e2b83e` |
| Verde | prato `#86c051`, campi sportivi `#5fbf4a`, bosco `#4f9a3c`, chiome da `#245a2e` a `#8fd25e` |
| Acqua | mare `#1f66b0`, bacini `#1d5f8e`, fascia sotto costa `#46b3cf`, schiuma `#f2fbff` |
| Asfalto e pietra | asfalto `#4f5663`, superstrada `#454b57`; cortili `#f3e6cf`, piazze `#f5d6a0`, marciapiedi `#e2d4ba` |
| Accenti | tende `#d9442c`, `#2f7fbf`, `#2e9d5b`, `#f0b429`; panni `#e94f4f`, `#3a8fd8`, `#f4c842`, `#7bc46a`, `#f08fb0`, bianco |

### Edifici a parti

Dieci tipi (`tipi.ts`, `catalogo.ts`), ciascuno con due o più varianti scelte
dall'identificativo della sagoma (prova in `tipi.test.ts`; foglio delle varianti in
`docs/schermate/foglio-varianti-*.png`):

| Tipo | Parti e varianti |
| --- | --- |
| Palazzina dei Tamburi | persiane; balconi a ogni piano sui quattro lati più lunghi, con panni stesi su un balcone su tre; cornicione 0,35 m; terrazza con parapetto di calce, cisterne, antenne, 0-2 parabole; negozi con tende al piano terra in 4 casi su 10 (stima) |
| Casa bassa | terrazzo in cotto con parapetto e, a volte, pergolato con il verde; oppure tetto a falde in coppi |
| Casa della Città Vecchia | pastelli chiari, persiane, terrazza, con o senza cornicione |
| Palazzo del centro (Borgo) | zoccolo bugnato con il marcapiano, finestre con il timpano dipinto, cornicione di 0,7-1,1 m; con o senza balconcini, con o senza negozi |
| Scuola o edificio pubblico | finestre a nastro; tetto piano con cornicione o a falde in coppi |
| Chiesa | navata con tetto in coppi, finestre ad arco dipinte; campanile con la cella chiara e la cuspide, oppure cupola su tamburo |
| Negozi | vetrine e insegna senza scritte, tende a righe, cornicione |
| Capannone | lamiera grecata a colori pieni con finestre a nastro, portone e porta pedonale dipinti; gronda colorata; falde con lucernari o tetto piano |
| Impianto | volume di cemento chiaro con ciminiera bianca e fascia rossa |
| Garage e annessi | muro chiaro, tetto piano con parapetto basso |

Stime dichiarate (OpenStreetMap qui non lo dice): **chiese** = un edificio pubblico su
quattro tra 250 e 2.500 m² (sei nella zona); **palazzi del centro** = gli edifici del
Borgo sopra i 160 m²; negozi al piano terra nel 40% delle palazzine dai tre piani in su
(confermato da Michele). Nessun edificio identificabile come reale è ricostruito in
dettaglio.

**Balconi** (approvazione, punto 3): in rilievo (solette, ringhiere, panni) solo al
livello alto e da 2 pixel per metro in su; altrimenti sono dipinti nella facciata
«balconi» (portafinestra, soletta chiara, ringhiera scura), che al loro posto mostra la
facciata con le persiane quando il rilievo è acceso. In rilievo si disegnano solo le
facce che si vedono (6 triangoli per balcone).

### Stabilimento e lotti

Capannoni, ciminiere, serbatoi, nastri, tubazioni e lotti hanno lo stesso trattamento delle
case (approvazione, punto 4): tavolozza nuova, tre fasce di luce, contorni, facciate
industriali dipinte. Gli impianti fermi dei lotti hanno lamiere e tetti arrugginiti della
tavolozza. Il **cantiere** su un lotto grande non è più un piazzale vuoto: oltre alla
recinzione, alle strutture a metà e alle gru, tutta l'area è divisa in celle di circa
110 m e in ognuna c'è un pezzo di cantiere scelto in modo ripetibile (scavi con le
scarpate e la recinzione, cumuli di terra e ghiaia, baracche con il bagno chimico, mezzi,
cataste di tubi e blocchi, recinti di stoccaggio).

### Vita della città

| Che cosa | Da dove viene | Quanto |
| --- | --- | --- |
| Fumo | dalle ciminiere dello stabilimento fuori dai lotti (dipendono dal lotto più vicino: stima) e dal camino dell'aspetto «acciaio» | per lotto, quanto produce: addetti all'acciaio del motore diviso 1.500 per lotto in produzione (stima), da 0,25 a 1; **un lotto fermo, in cantiere, a bosco, a energia o a mare non fuma**; fino a 8 sbuffi per camino |
| Auto | sulle strade principali (classi 1-3), una ogni 120 m circa, 11-20 m/s, corsia di destra | fino a 320, in proporzione alla popolazione del motore rispetto all'avvio (da 0,3 a 1,5); solo al livello alto |
| Treni | due convogli di sette vagoni sui binari più lunghi | solo al livello alto |
| Barche | dai moli verso il largo e ritorno, con una sosta | fino a 40, secondo gli addetti al mare e alla cultura rispetto all'avvio e ai lotti «mare e cultura» |
| Persone | nelle piazze, su piccoli giri | fino a 360, come il traffico; solo al livello alto e da vicino |
| Gabbiani | cerchi larghi sul mare vicino ai moli, a 18-43 m | 30, solo al livello alto |

Tutto è ripetuto in blocco (una geometria per tipo, aggiornata una volta per immagine),
senza ombre portate. Sotto 1,2 pixel per metro auto, persone e gabbiani non si
aggiornano. **«Riduci animazioni»** (preferenza del sistema): nulla si muove, né la vita
né le onde, le gru e le pale dei lotti. **Livello basso:** resta solo il fumo.

### Livelli di dettaglio, aggiornati

| Livello | Densità | Ombre | Dettagli piccoli | Balconi in rilievo | Vita |
| --- | --- | --- | --- | --- | --- |
| alto | 1,5 | 4096 | sì | da 2 px/m | tutta |
| medio | 1,0 (era 1,1) | 2048 | sì | no (dipinti) | barche e fumo |
| basso | 1 | no | no | no | solo il fumo |

### Prove e misure

Verifica nel browser (Edge, Intel HD 630), 25 novembre 2026, `scripts/verifica.ts`
completa, verde. Le prove dell'aspetto sono anche da sole con `--t12c`.

| Prova | Risultato | Soglia |
| --- | --- | --- |
| Colori della tavolozza allo schermo (14 colori, rettangoli al sole col materiale della città) | scarto massimo 9 su 255 per canale, a 390 e 1280 px | 14 (circa 5%) |
| Contorni da lontano: luminosità dei Tamburi a 0,45 / 0,9 / 1,6 px/m | 157,2 / 160,6 / 144,1 a 390 px; 156,5 / 158,9 / 146,0 a 1280 px | non sotto la variante 2 di oltre il 10% (variante 2: 145,6 / 148,0 / 136,4 e 144,2 / 145,4 / 139,9, misurate prima di toglierla) |
| Mare nei quattro orientamenti | 82,3 in tutti e quattro (scarto 0%) | 5% |
| «Riduci animazioni» | 516 oggetti della vita accesi, due immagini a 1,5 s identiche; senza, diverse | nulla si muove |
| Contrasto dello strato dell'aria sui Tamburi | 42,36 | almeno 40 |
| Angoli dello schermo | mai lo sfondo, 240 viste | come T12 |

**Prestazioni** (tre giri, media e 95° percentile, ms):

| Caso | Media | 95° percentile | Soglia |
| --- | --- | --- | --- |
| 390 px, CPU 4×, automatico | 18,8-19,1 | 23,6-25,2 (scende al medio) | 33 |
| 390 px, CPU 4×, medio | 19,2-19,3 | 25,3-26,3 | 26,4 |
| 1280 px, alto | 18,4-18,8 | 20,9-21,8 | 33 |
| 390 px, CPU 10× | scende da solo al medio (al livello alto 387 ms) | | discesa |

Il margine al livello medio è stretto e il computer di verifica oggi era carico (altre
finestre aperte): in altre esecuzioni della giornata lo stesso caso ha dato 21,3-24,0 e
una volta 25,1-27,9. Nella stessa sessione `main` (T12) ha dato 21,6-24,5: dopo i tagli
al livello medio (sotto) il ramo e T12 sono pari entro il rumore. Per arrivarci, al
livello medio: densità di pixel 1,0 invece di 1,1 (il basso scende a 0,9), antenne e
parabole spente, la vita ridotta al fumo, le parti degli edifici nella geometria dei
tetti, i contorni non disegnati sotto l'opacità 0,06.

**Budget** (1280 px; tra parentesi T12):

| Livello | Ordini, avvio / vicino | Triangoli, avvio / vicino |
| --- | --- | --- |
| alto | 79 (73) / 65 (56): +8% / +16% | 589 mila (513) / 616 mila (461) |
| medio | 67 (64) / 57 (53): +5% / +8% | 536 mila (463) / 506 mila (439) |
| basso | 61 (58) / 52 (48): +5% / +8% | 436 mila (362) / 411 mila (344) |

Ordini di disegno entro il 20% di T12 a ogni livello. Memoria delle texture 1,77 MB
(1,61 in T12: due stili di facciata in più). Città intera con tutto acceso: circa 1,45
milioni di triangoli (budget delle prove 1,5 milioni) e 250 mila segmenti di contorno.

**Prove unitarie nuove:** `aspetto.test.ts` (contorni senza scatti, una sola città,
balconi a parte, stesso aspetto a ogni avvio, mare e fascia rivolti in alto, fascia verso
il mare e senza stencil), `vita.test.ts` (fumo che cambia con lo stato del lotto in una
partita da copione, lotto mai toccato senza fumo, traffico dalla popolazione, dt = 0 senza
movimento, livello basso con il solo fumo), `tipi.test.ts` (dieci tipi, otto o più nella
zona, ognuno con due o più varianti; chiese con campanile e con cupola).


### Fase A (storia)

Il campione in due varianti (`3060f45`) è descritto nel resoconto della fase A; le sue
schermate restano in `docs/schermate/campione-*` (com'è oggi, variante 1, variante 2, sei
inquadrature, 390 e 1280 px). Le schermate «prima» di questa fase sono
`docs/schermate/prima-*` (aspetto di T12, quattro orientamenti, sei aspetti dei lotti),
fatte prima di togliere l'aspetto di T12; le «dopo», dalle stesse inquadrature, sono
`docs/schermate/dopo-*`.

## Città isometrica (T12): brief di direzione artistica

Decisione D20: città isometrica nello stile dei gestionali di città di fine anni '90,
ricca di dettagli, a colori pieni, senza effetto modellino né bordi. Questo brief
segue il modello della skill `create-game-assets` (`assets/art-direction-brief.md`).
**Approvato da Michele il 24 novembre 2026** (scheda T12, «Approvazione della fase
A»), tavolozze comprese, con quattro correzioni per la fase B: niente terreno vuoto,
stabilimento dettagliato come le case, mare vivo e costa vera, marciapiedi e alberi
anche sulle strade secondarie. Come sono state fatte: sezione «Città isometrica (T12,
fase B): com'è fatta».

Il provino della fase A era una pagina di solo sviluppo (`apps/game/provino.html`):
nella fase B è stata tolta, perché la città è nel gioco e le schermate le fa la
verifica nel browser. Le sue schermate restano in `docs/schermate/provino-*.png`.

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
- **Approvazione:** Michele, nella scheda T12 di `docs/TASKS.md`: fase A approvata il
  24 novembre 2026. Gli elementi nuovi o cambiati nella fase B sono «in attesa» in
  `docs/grafica-elementi.json` fino alla revisione della fase B.

## Città isometrica (T12, fase B): com'è fatta

La città isometrica prende il posto del plastico nel gioco: stessa interfaccia per
finestre, strato, tocco, evidenza della selezione, «Elenco», visita guidata e
attribuzione; la mappa schematica resta la riserva. Il provino della fase A (pagina
di solo sviluppo) non c'è più: le schermate le fa la verifica nel browser.

### Codice

| File | Che cosa |
| --- | --- |
| `apps/game/src/iso/vista.ts` | Camera ortografica, quattro orientamenti, movimenti morbidi, limiti della vista. Puro, provato in `vista.test.ts` |
| `apps/game/src/iso/livelli.ts` | Livelli di dettaglio e regolatore che scende da solo. Puro, provato in `livelli.test.ts` |
| `apps/game/src/iso/scena.ts` | Renderer, luce, ombre adattate alla vista, tocco e dita, strato, evidenza, sonde per la verifica |
| `apps/game/src/iso/citta.ts` | Montaggio della città intera |
| `apps/game/src/iso/tipi.ts`, `edifici.ts` | Tipi di edificio, varianti, pareti per stile di facciata, tetti, dettagli, alberi |
| `apps/game/src/iso/suolo.ts`, `griglia.ts` | Copertura del suolo, mare, costa, moli, strade; griglia di occupazione a 2 m |
| `apps/game/src/iso/impianti.ts` | Serbatoi, ciminiere, nastri, torri, tubazioni dello stabilimento |
| `apps/game/src/iso/lotti.ts` | I sei aspetti dei lotti di ILSIDER |
| `apps/game/src/iso/texture.ts`, `geo3.ts` | Texture disegnate dal codice; costruttore di geometrie unite |
| `packages/content/geo/suolo.json` | Dati nuovi da OpenStreetMap (64 kB): usi del suolo, parcheggi, piazze, spiagge, costa, vie di servizio, nastri, serbatoi, ciminiere (`docs/FONTI.md`) |

Skill seguite (scelte dall'architetto con il `router`): `create-game-assets` per brief
ed elenco degli elementi; `threejs-scene-setup` e `threejs-materials-lighting` per
scena, ombre adattate alla vista, spazio colore sRGB delle texture e densità di pixel;
`camera-systems` per `1 − exp(−k·dt)` e per limitare la vista invece del centro;
`performance-optimization` per i budget in millisecondi con media e 95° percentile.
Nessuna funzione di three.js successiva alla 0.169.

### Vista e comandi

- Camera ortografica, elevazione 30°, azimut 45° più un multiplo di 90°: quattro
  orientamenti. Il pulsante «⟳» ruota di un quarto di giro con un passaggio morbido.
- Ci si sposta trascinando (un dito o il mouse), si ingrandisce con la rotella, con
  due dita o con «+» e «−», da 0,3 a 8 pixel per metro. Rotella e dita tengono fermo
  il punto sotto la mano.
- La vista è limitata: la sua impronta a terra resta dentro la zona più 250 m, a ogni
  ingrandimento e orientamento. Se la vista è più grande della zona, resta centrata.
- Oltre la zona il terreno (erba) e il mare continuano per 6 km: gli angoli dello
  schermo non mostrano mai lo sfondo. Niente sfocatura, niente lastra, niente bordi.
- Sotto 1,2 pixel per metro si spengono cisterne, antenne, lucernari, auto, barche e
  massi (sarebbero meno di un pixel); sotto 0,8 anche cespugli e uliveti.

### Copertura del suolo (correzione 1): dati e stime

Ogni punto della zona ha una copertura. Ordine di disegno, dall'alto: verde di
OpenStreetMap, aree dei dati, stime, tipo di zona, fondo. I fondi scrivono la
profondità dall'alto verso il basso (ogni pixel si calcola una volta); il mare si
disegna prima e segna i suoi pixel nello stencil, così può stare 0,9 m sotto la terra.

| Dove | Da dove viene | Copertura |
| --- | --- | --- |
| Tutta la zona (fondo) | stima | erba mediterranea con cespugli disegnati e cespugli veri sparsi |
| Stabilimento e aree industriali | stima | piazzale di cemento; su celle irregolari di circa 120 m: 20% terra battuta, 22% erba secca con cespugli |
| Quartieri | stima | cortili lastricati; giardini di forma libera (raggio 6-12 m) dove c'è spazio libero tra case e strade, con 1-3 alberi |
| Campagna e periferia | stima | appezzamenti irregolari di circa 150 m: 30% campi a file, 12% uliveti in file di 14 m, il resto erba con cespugli |
| Parcheggi, piazze, usi del suolo, spiagge, scogli, campi sportivi, verde | dati (`suolo.json`, `plastico.json`) | parcheggio con auto negli stalli, lastricato, cortile, ghiaia, terra, sabbia, roccia, campo, erba, sottobosco, campi |

Prova: `citta.test.ts` campiona la zona ogni 40 m. Nessun punto di terra è scoperto,
nessuna copertura supera metà della terra, e stabilimento, quartieri e campagna hanno
almeno tre coperture diverse ciascuno.

### Stabilimento (correzione 2)

- Capannoni con la facciata industriale su tutta l'altezza (zoccolo, lamiera
  grecata, nastro di finestre sotto la gronda, portone, colature di ruggine) e file
  di lucernari sui tetti; otto colori, dai grigi freddi alla ruggine.
- Dai dati: 431 serbatoi e silos (cilindri con cupola bassa e fascia), 20 ciminiere
  con l'altezza vera quando c'è, 9 nastri trasportatori su cavalletti, torri.
- Stima: rastrelliere di tre tubazioni su portali ogni 12 m lungo una via di servizio
  interna su tre (58 tratti). OpenStreetMap non ha le tubazioni in vista della zona.

### Mare e costa (correzione 3)

- Il mare sta 0,9 m sotto la terra: lungo ogni riva c'è una sponda. Onde con una mappa
  delle normali disegnata dal codice che scorre nel tempo, riflessi leggeri (lucentezza
  40, riflesso `#4a6880`: si vedono in ogni orientamento senza accecare controsole).
- Tipo di riva: spiaggia vicino alle spiagge dei dati (sabbia che entra in acqua,
  schiuma); banchina di cemento nello stabilimento, nelle aree industriali e portuali,
  nei quartieri e vicino ai moli; altrove scogliera con massi e schiuma (stima).
- Moli di cemento un metro sopra l'acqua; barche ormeggiate lungo i moli e le banchine
  dei bacini. I bacini e i canali (sotto 1 km²) sono più scuri del mare aperto
  (`#2a6f98`): con sponde, massi e barche sembrano darsene, non piscine.

### Strade (correzione 4)

Marciapiedi su tutte le strade principali e, nei quartieri, anche sulle secondarie;
filari sulle principali e su una strada secondaria su due dei quartieri, dove c'è
spazio (a 2,8 m dal bordo, mai sopra case, acqua, binari o altre strade). Vie di
servizio dello stabilimento in asfalto chiaro, binari con massicciata e due rotaie.

### Lotti

Al più 12 ordini di disegno per aspetto (i parchi fermi del provino ne facevano 79).
Gli edifici di OpenStreetMap dentro i lotti non si disegnano negli aspetti nuovi; da
fermi, i lotti diversi dai parchi minerali mostrano i loro edifici veri arrugginiti
più le strutture del reparto messe dove c'è spazio, perché l'aspetto «fermo» è lo
stabilimento di oggi (scelta da confermare, vedi il resoconto del T12).

### Strato

Con uno strato acceso, pareti, tetti e alberi di ogni quartiere prendono il colore
pieno della legenda; il terreno del quartiere si copre quasi del tutto e un velo
trasparente al 42% passa sopra anche a edifici e alberi; fuori dai quartieri tutto si
attenua. Il rilievo resta leggibile per la luce e le finestre. Con gli intonaci caldi
della città nuova una tinta più leggera cambiava i Tamburi di 33 (soglia del T11: 40);
così il contrasto misurato è 42,8.

### Tavolozza aggiunta nella fase B

| Ruolo | Colori |
| --- | --- |
| Suolo (colore medio delle texture) | erba `#9cb75e`, cortile `#ddd4c2`, piazzale `#c9bfae`, parcheggio `#6a6d72`, sabbia `#e8d6a6`, roccia `#a19a8c`, ghiaia `#8d8377`, terra `#b49a78`, lastricato `#e6dccb`, campi `#c8c46e`, sottobosco `#5f9447`, campo `#6fae4c` |
| Mare | aperto `#2f83c4`, bacini `#2a6f98`, schiuma `#e8f3f7` |
| Rive | banchina `#cfc8ba`, scogliera `#8f887b`, moli `#d8d1c3` |
| Strade | vie di servizio `#6b6c6e`, rotaie `#4a4440` (il resto come nella fase A) |
| Capannoni | in più `#c9cfd4`, `#7f97ad`, `#a8826a`, `#b9a48b`; lucernari `#bcd3e0` |
| Ruggine dei reparti fermi | pareti `#8f6a52` `#7d6656` `#9c6f4f` `#86705e`, tetti `#7d4630` `#6f5a49` `#8a4b2c` |
| Alberi nuovi | ulivo `#7d9160` `#8a9b6a` `#72875a`, cipresso `#2f5530` `#36603a`, cespuglio `#4f7f36` `#5c8c3e` `#6b9846` |

### Livelli di dettaglio

| Livello | Densità di pixel (massima) | Ombre | Dettagli piccoli | Cespugli e uliveti | Alberi dei parchi | Onde |
| --- | ---: | --- | --- | --- | --- | --- |
| Alto | 1,5 | sì, mappa 4096 | sì | sì | sì | sì |
| Medio | 1,1 | sì, mappa 2048 | sì | no | sì | sì |
| Basso | 1 | no | no | no | no (restano viali e lotti) | no |

In automatico si parte dall'alto. Il gioco misura il tempo di ogni immagine: su una
finestra di 90 immagini (dopo 30 di riscaldamento), se il 95° percentile supera 33 ms
scende di un livello. Al livello basso, sotto 20 immagini al secondo di media, torna
la mappa schematica con il motivo. In «Strati» si sceglie Automatico, Alto, Medio o
Basso (la scelta resta nel browser); scelto a mano, il livello non cambia da solo.
Le ombre usano una camera adattata alla vista e si ridisegnano solo quando la vista si
sposta di un quarto, cambia ingrandimento di più del 20% o ruota.

### Budget e misure

Budget dichiarati, per immagine, sulla vista d'avvio e da vicino (4 pixel per metro),
città intera costruita:

| Livello | Ordini di disegno (budget / misurati) | Triangoli (budget / misurati) | Memoria texture |
| --- | --- | --- | --- |
| Alto | 90 / 73 all'avvio, 56 da vicino | 700 mila / 513 mila, 461 mila | 2 MB / 1,61 MB |
| Medio | 80 / 64, 53 | 550 mila / 463 mila, 439 mila | 2 MB / 1,61 MB |
| Basso | 70 / 58, 48 | 450 mila / 362 mila, 344 mila | 2 MB / 1,61 MB |

Tutta la città, con ogni cosa accesa, sta sotto 1,5 milioni di triangoli in al più
140 mesh (`citta.test.ts`); se ne disegna solo una parte: gli alberi sono divisi in
riquadri di 2 km che la camera scarta fuori dallo schermo, e gli oggetti piccoli si
spengono da lontano. La memoria delle texture è quella delle tele disegnate dal codice
con le mipmap (sette facciate, dodici suoli, le onde); le mappe d'ombra a parte
(4096² al livello alto).

Tempi delle immagini, misurati da `verifica.ts --prestazioni` con Edge su questo
computer (scheda grafica Intel HD 630), sulla stessa scena: vista d'avvio, poi
Tamburi, altoforni, banchine e Città Vecchia, 2,5 s ciascuno, in tre giri. Il telefono
è simulato (processore rallentato 4 volte, 390 × 844 px, densità 2): è un sostituto
dichiarato, la scheda grafica resta quella del computer.

| Caso | Media | 95° percentile | Livello | Soglia |
| --- | ---: | ---: | --- | ---: |
| 390 px, processore 4×, livello scelto da solo | 16,9-17,2 ms | 22,2-23,6 ms | alto | 33 ms |
| 390 px, processore 4×, livello medio | 17,7-17,8 ms | 20,0-20,7 ms | medio | 26,4 ms (20% di margine) |
| 1280 px, densità 1, livello alto | 17,6 ms | 18,2-18,3 ms | alto | 33 ms |

Tre giri per caso, nella verifica completa finale. In un'esecuzione precedente, con il
computer più carico, a 390 px il gioco era sceso da solo al livello medio (95°
percentile 23,2-26,5 ms al medio; al medio forzato 22,5-23,9 ms): la scelta
automatica dipende anche dal carico del momento, ed è giusto così.

Le medie vicine a 16,7 ms sono il limite delle 60 immagini al secondo dello schermo.
Con il processore rallentato 10 volte, in automatico, il gioco scende da solo al
livello medio (95° percentile all'alto: tra 65 e 101 ms nelle esecuzioni).

Come si è arrivati qui: la prima versione stava a 43-50 ms all'alto. Quattro interventi:
fondi del terreno disegnati dall'alto verso il basso con la profondità (prima si
calcolava ogni strato, ombre comprese, per ogni pixel), ombre PCF invece di PCF morbide,
vegetazione con meno triangoli e divisa in riquadri, niente oggetti nuovi a ogni
immagine nel ciclo di disegno (meno pause per la raccolta della memoria).

### Pesi

| Che cosa | Normale | Compresso (gzip) |
| --- | ---: | ---: |
| `packages/content/geo/plastico.json` (non cambiato) | 766 kB | 215 kB |
| `packages/content/geo/suolo.json` (nuovo) | 64 kB | 23 kB |
| Pezzo della città nel gioco costruito (three.js, codice, dati) | 1.333 kB (T11: 1.239) | 385 kB (T11: 346) |
| Pezzo principale del gioco | 584 kB (T11: 581) | 153 kB (T11: 151) |

## Il plastico del T11 (sostituito nel T12)

Quello che segue descrive il plastico del T11 (D18), che la città isometrica ha
sostituito: resta come storia delle scelte e delle misure di allora. Non vale più per
il gioco: scena, effetto modellino, esagerazione verticale e tavolozza sono cambiati.

### Scelte tecniche

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

### Tavolozza

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

### Modelli: origine e licenza

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

### Prestazioni

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

### Pesi

| Che cosa | Normale | Compresso (gzip) |
| --- | ---: | ---: |
| `packages/content/geo/plastico.json` | 766 kB (T11: 724 kB) | 215 kB (T11: 203 kB) |
| `packages/content/geo/lotti.json` | 2,8 kB | 0,9 kB |
| Pezzo del plastico nel gioco costruito (three.js, scena, dati) | 1.239 kB | 346 kB |
| Pezzo principale del gioco (come nel T10: +1 kB per la nuova disposizione) | 581 kB | 151 kB |

### Estendere il plastico a tutta la città

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
