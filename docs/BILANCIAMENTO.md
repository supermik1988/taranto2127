# Bilanciamento

Bilanciamento dei contenuti: calibrazione `0.2-stime` del T06b con le rifiniture del
T06c e i ritocchi del T10 (azioni senza limite, ventiquattro dilemmi), la causa della
spirale, i valori cambiati e il rapporto finale. In fondo, la storia dei passaggi
precedenti (T06 e T07). I valori descritti nelle sezioni T06b e T10 sono **applicati**
in `packages/content`.

## Come si rifà

```sh
pnpm balance -- --partite 1000              # tutti i bot, semi da 1 a 1000
pnpm balance -- --partite 200 --bot red     # un solo bot
pnpm balance -- --partite 1000 --uscita rapporto.md --thread 7
pnpm balance -- --partite 150 --variante prova.json  # valori modificati solo in memoria
```

Una variante è un elenco di modifiche, per esempio
`[{ "file": "parametri", "path": "economy.servicesCostPerYear", "value": 36 }]`:
il comando le applica a una copia dei contenuti, senza toccare i file.

Il rapporto dipende solo dal seme di partenza (`--seme`, di serie 1) e dal numero
di partite: è identico a ogni esecuzione, con qualunque numero di thread. Il tempo
impiegato va sull'errore standard. Il comando esce con codice 2 se qualche partita
si è interrotta per uno stato non valido del motore.

## I bot

| Bot | Che cosa fa |
| --- | --- |
| Tutto Blu | Accende le politiche con peso morale positivo che può permettersi, tiene aperti fino a tre cantieri di quartiere, riconverte un lotto ogni cinque anni alternando le quattro strade, ai dilemmi sceglie l'opzione moralmente migliore. Non salta mai una fase |
| Tutto Red | Stessi cantieri e lotti del Blu, nessuna politica, salta ogni fase di autorizzazione e di gara, ai dilemmi sceglie l'opzione moralmente peggiore |
| Casuale | Da zero a quattro azioni a caso per turno; risposte a caso |
| Una sola strada | Parametrico: porta ogni lotto fermo verso una sola strada (acciaio verde, bonifica, energia, mare e cultura), un lotto per turno; nient'altro; risposte a caso |
| Prudente sui conti | Nessuna politica a carico dei fondi propri; un'opera solo se i fondi propri superano 20 milioni e il fondo dei lavori copre l'intero cantiere, al massimo due alla volta; ai dilemmi l'opzione che costa meno |
| Nessuna azione | Non fa nulla; ai dilemmi, che vanno chiusi per avanzare, risponde sempre con la prima opzione |

## Come leggere le segnalazioni

- **Stesso esito in più del 90% delle partite:** l'esito di quel bot non dipende dal caso.
- **Cresce o cala senza limite:** tra le partite ancora in corso, la mediana va
  sempre nella stessa direzione ai turni 25, 50, 75 e 100, non rallenta nell'ultimo
  quarto (almeno tre quarti del passo del primo) e cambia di almeno un quarto.
- **Leva mai usata:** nessun bot l'ha usata in nessuna partita.
- **Leva sempre conveniente:** nelle partite del bot casuale, chi l'ha usata nei
  primi dieci anni sta meglio su tutti e quattro gli esiti (più partite al 2127, di
  almeno 5 punti; più fondi propri; più occupati; più reputazione). Si guardano solo
  i primi dieci anni perché, contando l'intera partita, chi dura di più sembra
  migliore solo perché ha fatto in tempo a usare più leve. Per un'opzione di dilemma
  il confronto è con chi ha scelto un'altra opzione dello stesso dilemma. Resta una
  correlazione, non una prova di causa.

## Bilanciamento T10 (azioni senza limite, ventiquattro dilemmi)

### Che cosa è cambiato nel gioco

1. **Nessun limite di azioni per anno.** Il motore non accetta più al massimo tre
   azioni libere: i limiti sono i fondi e la capacità di spesa degli uffici. Per i
   bot cambia poco, tranne per Tutto Red (salta tutte le fasi che trova, non più solo
   due o tre l'anno) e per il casuale (fino a quattro azioni, ora tutte accettate).
2. **Ventiquattro dilemmi invece di sei**, e una regola nuova: un dilemma ripetibile
   non torna prima degli anni indicati nei dati, e mai due volte nella stessa epoca se
   ce ne sono altri ammessi.

### Che cosa è successo, con un esperimento

Prima prova con 1.000 partite per bot, dilemmi nuovi senza ritocchi: Tutto Blu all'1%
di arrivi al 2127 (prima 57%), mare e cultura al 22% (scarto tra le strade 23 punti ma
una strada sotto il 40%). Per separare le due cause ho giocato 150 partite per bot con
il motore nuovo e due insiemi di dilemmi:

| Bot | Solo i sei dilemmi di prima | Ventiquattro dilemmi, prima dei ritocchi |
| --- | ---: | ---: |
| Tutto Blu | 59% | 1% |
| Tutto Red | **57%** | 18% |
| Casuale | 53% | 47% |
| Una sola strada: energia | 67% | 48% |
| Una sola strada: mare e cultura | 59% | 25% |

- **Il limite tolto rafforza Red**: con i soli sei dilemmi arriva al 2127 il 57% delle
  sue partite, sopra l'obiettivo (15-45%) e quanto Blu. Con i dilemmi nuovi torna nei
  limiti, perché le sue scelte nascoste vengono scoperte più spesso.
- **I dilemmi nuovi affondano Blu, ma nessuno da solo.** Togliendoli uno alla volta
  Blu resta tra lo 0 e il 5%. La causa è la diluizione: con sei dilemmi «Chi lavora
  nei nuovi posti» (150 posti stabili per l'opzione corretta) tornava di continuo; tra
  ventiquattro, e con la regola dell'epoca, arriva di rado. In più le opzioni corrette
  dei dilemmi nuovi costavano subito senza rendere mai, e alcune toglievano reddito
  medio o capacità di spesa per sempre: un danno che si somma per decenni.

### Valori cambiati

Tutti stime dichiarate, con motivazione nei dati. Il motore non è stato toccato.

| Dove | Che cosa | Prima | Dopo |
| --- | --- | --- | --- |
| `posti-nuovo-polo` | peso nell'estrazione | 2 | 3 |
| dilemmi nuovi, opzioni corrette | cali permanenti di reddito medio (−0,1/−0,3) e di capacità di spesa (−2/−3) | 9 opzioni | sostituiti da costi una tantum (−1/−2 milioni) o tolti |
| dilemmi nuovi, opzioni corrette | ritorno ritardato (1-3 anni): fiducia, appartenenza o posti di lavoro (40-250 persone) | nessuno | 18 opzioni |
| `subappalto-scogliere/chiudere-un-occhio` | vantaggio | capacità di spesa +2 per sempre | 2 milioni una volta |
| costi delle opzioni corrette di `stanze-fresche`, `case-ai-margini`, `case-vuote-isola`, `memoria-della-fabbrica`, `mareggiata-alle-borgate`, `cassa-che-finisce` | milioni | 3-5 | 2-4 |

Il ritorno ritardato è il vincolo di disegno n. 2 applicato ai dilemmi: la scelta
corretta costa subito e rende dopo, la scorretta conviene subito e costa dopo.

### Esiti su 1.000 partite per bot

| Bot | Obiettivo | Al 2127 | In dissesto | Città che si volta | Dissesto mediano | Fiducia media finale |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Tutto Blu | 40-70% | **44%** | 56% | 0% | 2043 | 43,1 |
| Tutto Red | 15-45% | **18%** | 47% | 35% | 2101 | 9,5 |
| Casuale | 30-60% | **48%** | 52% | 0% | 2047 | 40,4 |
| Una sola strada: acciaio verde | 40-80% | **52%** | 48% | 0% | 2057 | 38,1 |
| Una sola strada: bonifica | 40-80% | **53%** | 47% | 0% | 2057 | 36,7 |
| Una sola strada: energia | 40-80% | **68%** | 32% | 0% | 2064 | 36,8 |
| Una sola strada: mare e cultura | 40-80% | **49%** | 52% | 0% | 2075 | 36,2 |
| Prudente sui conti | 40-70% | **48%** | 52% | 0% | 2060 | 31,4 |
| Nessuna azione | 0-10%, dissesto 2045-2065 | **0%** | 100% | 0% | **2055** | 40,4 |

Tutti gli obiettivi di T06b sono raggiunti; scarto tra le strade 19 punti. Vincoli di
disegno: Blu fa meglio di Red negli arrivi (44% contro 18%) e nella fiducia finale
(43,1 contro 9,5); il 35% delle partite Red finisce con la città che si volta (almeno
una su venti); nessuna partita interrotta. Tutto Blu resta vicino al bordo basso del
suo obiettivo: è la cosa da guardare per prima se si aggiungono altri dilemmi.

In 1.000 partite casuali nessun dilemma torna prima del suo intervallo (test in
`packages/content/src/dilemma-interval-*.test.ts`).

## Rifiniture T06c

### Che cosa cambia

1. **Il rapporto misura anche esposizione accumulata e salute per quartiere, e i
   terreni contaminati dell'area industriale.**
2. **L'avanzo dei fondi propri si spende in servizi.** A fine anno, oltre una riserva
   di 60 milioni, l'avanzo va in servizi: ogni quartiere guadagna 0,05 punti per
   milione speso (20 milioni valgono un punto). I fondi propri non crescono più senza
   limite: nelle partite che sopravvivono si fermano alla riserva.
3. **La bonifica diventa la strada migliore su terreni ed esposizione.** Con i nuovi
   indicatori era già la migliore sui terreni, ma non sull'esposizione: energia e mare
   lasciano presto lotti quasi senza pressione sull'aria, mentre la bonifica tiene per
   anni cantieri aperti. Ho rafforzato il suo effetto sull'esposizione, senza toccare
   durate, costi o posti di lavoro.

### Valori cambiati

| File | Valore | Prima | Dopo |
| --- | --- | ---: | ---: |
| parametri.json | Riserva dei fondi propri (nuovo) | — | 60 milioni |
| parametri.json | Servizi per milione di avanzo speso (nuovo) | — | 0,05 punti |
| progetti.json | Bonifica, all'entrata in esercizio: esposizione ai Tamburi (nuovo) | — | -15 |
| progetti.json | Bonifica, all'entrata in esercizio: esposizione nell'area industriale (nuovo) | — | -12 |
| progetti.json | Bonifica, ogni anno in esercizio: esposizione ai Tamburi | -0,3 | -3,0 |
| progetti.json | Bonifica, ogni anno in esercizio: esposizione nell'area industriale | -0,4 | -3,0 |
| progetti.json | Bonifica, ogni anno in esercizio: esposizione a Paolo VI (nuovo) | — | -0,5 |

### Le quattro strade su terreni ed esposizione (1.000 partite, mediane a fine partita)

| Strada | Al 2127 | Esposizione Tamburi | Esposizione area industriale | Terreni area industriale | Salute Tamburi |
| --- | ---: | ---: | ---: | ---: | ---: |
| Acciaio verde | 48% | 64,8 | 86,6 | 88,0 | 48,4 |
| **Bonifica** | 48% | **14,8** | **38,7** | **58,0** | 49,9 |
| Energia | 67% | 29,2 | 45,5 | 88,0 | 57,8 |
| Mare e cultura | 63% | 29,2 | 45,8 | 88,0 | 57,8 |

La bonifica è la migliore sui tre indicatori di terreni ed esposizione. La salute dei
Tamburi a fine partita resta più alta con energia e mare: la salute segue l'esposizione
con anni di ritardo, e metà delle partite della bonifica finisce in dissesto prima che
l'effetto si veda. Il quadro dei punti forti e deboli delle strade è ora:

| Strada | Punto forte | Punto debole |
| --- | --- | --- |
| Acciaio verde | Lavoro industriale (la cassa integrazione scende più che con ogni altra strada) | Aria ed esposizione |
| Bonifica | Terreni ed esposizione | Lavoro e tempi |
| Energia | Conti e tempi | Lavoro |
| Mare e cultura | Occupazione | Entrate per il Comune |

### Esiti su 1.000 partite per bot

| Bot | Obiettivo | Al 2127 | In dissesto | Città che si volta | Dissesto mediano | Fiducia media finale |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Tutto Blu | 40-70% | **57%** | 43% | 0% | 2043 | 50,8 |
| Tutto Red | 15-45% | **31%** | 53% | 16% | 2096 | 12,9 |
| Casuale | 30-60% | **54%** | 47% | 0% | 2046 | 45,9 |
| Una sola strada: acciaio verde | 40-80% | **48%** | 52% | 0% | 2058 | 37,6 |
| Una sola strada: bonifica | 40-80% | **48%** | 52% | 0% | 2058 | 36,1 |
| Una sola strada: energia | 40-80% | **67%** | 34% | 0% | 2062 | 36,0 |
| Una sola strada: mare e cultura | 40-80% | **63%** | 37% | 0% | 2071 | 37,5 |
| Prudente sui conti | 40-70% | **53%** | 47% | 0% | 2058 | 37,8 |
| Nessuna azione | 0-10%, dissesto 2045-2065 | **1%** | 99% | 0% | **2055** | 39,4 |

Tutti gli obiettivi restano raggiunti; scarto tra le strade 19 punti; vincoli di
disegno rispettati (Blu meglio di Red negli arrivi e nella fiducia; 16% di partite Red
con la città che si volta). Nessuna partita interrotta.

## Bilanciamento T06b (calibrazione `0.2-stime`)

La calibrazione è del T06b; i numeri di questa sezione sono quelli del T06b. Quelli
attuali, dopo le rifiniture, sono nella sezione T06c qui sopra e nel rapporto finale.

### Esito in breve

Su 1.000 partite per bot **tutti gli obiettivi di arrivo al 2127 sono raggiunti** e
tutti i vincoli di disegno sono rispettati, con una riserva sul vincolo 4 (vedi
"Obiettivi e vincoli"). Nessuna partita interrotta.

| Bot | Obiettivo | Al 2127 | In dissesto | Città che si volta | Dissesto mediano | Fiducia media finale |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Tutto Blu | 40-70% | **57%** | 43% | 0% | 2043 | 50,8 |
| Tutto Red | 15-45% | **30%** | 44% | 26% | 2090 | 11,8 |
| Casuale | 30-60% | **53%** | 47% | 0% | 2046 | 44,8 |
| Una sola strada: acciaio verde | 40-80% | **48%** | 52% | 0% | 2058 | 36,9 |
| Una sola strada: bonifica | 40-80% | **48%** | 52% | 0% | 2058 | 35,8 |
| Una sola strada: energia | 40-80% | **67%** | 34% | 0% | 2062 | 36,0 |
| Una sola strada: mare e cultura | 40-80% | **63%** | 37% | 0% | 2071 | 37,5 |
| Prudente sui conti | 40-70% | **53%** | 47% | 0% | 2058 | 37,6 |
| Nessuna azione | 0-10%, dissesto 2045-2065 | **1%** | 99% | 0% | **2055** | 39,4 |

Scarto tra la strada migliore e la peggiore: 67 − 48 = **19 punti** (massimo 25).

### Causa della spirale

L'ipotesi del T07 era una spirale disavanzo → servizi → salute → fiducia → entrate.
L'esperimento l'ha **smentita**. Ho spento un ingranaggio per volta, sui valori del
T07, misurando 150 partite per bot (quota di partite al 2127):

| Variante | Blu | Red | Casuale | Acciaio | Bonifica | Energia | Mare | Prudente | Nessuna |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Valori del T07 | 0% | 0% | 15% | 0% | 0% | 88% | 91% | 0% | 0% |
| Servizi che non calano col disavanzo | 0% | 0% | 15% | 0% | 0% | 88% | 91% | 0% | 0% |
| Senso civico spento (sempre 1) | 0% | 0% (99% si volta) | 35% | 1% | 0% | 96% | 100% | 2% | 0% |
| Entrambi spenti | 0% | 0% (99% si volta) | 35% | 1% | 0% | 96% | 100% | 2% | 0% |
| Nessun disavanzo strutturale (servizi a 35) | 84% | 0% | 75% | 73% | 74% | 100% | 100% | 79% | 100% |

Conclusioni:

1. **Il ramo dei servizi non conta.** Fermarlo non cambia nulla: il dissesto arriva
   entro tre anni dal primo disavanzo, e la salute, che si muove del 5% l'anno verso il
   suo equilibrio, non fa in tempo a pesare sulla fiducia.
2. **La causa è il disavanzo strutturale di partenza**: servizi a 37 milioni contro
   entrate proprie di circa 35,2. Chi non crea nuove entrate va in dissesto. Toglierlo
   rende la partita impossibile da perdere, anche senza fare nulla.
3. **Il senso civico è l'amplificatore.** Quando la fiducia scende sotto quella di
   partenza toglie entrate e anticipa il dissesto. Il Red, in particolare, andava in
   dissesto per questo; senza senso civico finirebbe invece con la città che si volta.

Il disavanzo strutturale è stato **mantenuto**, perché è ciò che porta "nessuna azione"
al dissesto tra il 2045 e il 2065 (vincolo 3: la spirale resta possibile). Il
bilanciamento ha lavorato sulle vie d'uscita: entrate dei progetti, costo delle
politiche, senso civico che premia la fiducia alta.

### Valori cambiati

Ogni valore resta una stima dichiarata; la motivazione nel file è aggiornata e termina
con "Valore del bilanciamento T06b".

| File | Valore | Prima | Dopo | Perché |
| --- | --- | ---: | ---: | --- |
| partenza.json | `calibrationVersion` | 0.1-stime | 0.2-stime | Nuova calibrazione |
| progetti.json | Forno elettrico: costo annuo dei lavori | 40 | 20 | Quota pubblica locale; con 40 il fondo statale non lo finanziava mai |
| progetti.json | Forno elettrico: entrate annue in esercizio | 1,2 | 2,0 | Punto forte dei conti a regime per la strada industriale |
| progetti.json | Bonifica: fondo dei lavori | europeo | statale | Le bonifiche dei siti inquinati hanno fondi statali dedicati; i fondi europei finivano prima di bonificare sei lotti |
| progetti.json | Bonifica: costo annuo dei lavori | 18 | 10 | Sostenibile su 6-10 anni di cantiere |
| progetti.json | Bonifica: entrate annue in esercizio | — | 1,0 | Canoni delle aree restituite all'uso |
| progetti.json | Energia: entrate annue in esercizio | 1,0 | 0,3 | Canoni modesti; con 1,0 la strada vinceva quasi sempre |
| progetti.json | Mare e cultura: entrate annue in esercizio | 0,6 | 0,15 | L'indotto va soprattutto ai privati |
| progetti.json | Mare e cultura: posti stabili per lotto | 350 | 250 | Ordine di grandezza più prudente |
| progetti.json | Risanamento della Città Vecchia: entrate annue | — | 0,4 | Tributi da case e botteghe tornate abitate |
| progetti.json | Piazze e servizi a Talsano, Lama e San Vito: entrate annue | — | 0,6 | Tributi da residenti e attività attirati |
| progetti.json | Fascia verde ai Tamburi: entrate annue | — | 0,3 | Minori spese e piccoli tributi |
| progetti.json | Case della salute: assunzioni stabili | 120 | 300 | Personale sanitario per due strutture aperte tutto il giorno |
| progetti.json | Centro di ricerca sul mare: assunzioni stabili | 80 | 200 | Ricercatori, tecnici e personale |
| politiche.json | Dati sull'aria in tempo reale: costo annuo | 0,5 | 0,3 | Governare con cura non deve portare da solo al dissesto |
| politiche.json | Consulte di quartiere: costo annuo | 0,8 | 0,5 | Come sopra |
| politiche.json | Integrazione al reddito: costo annuo | 5 | 3 | Come sopra |
| politiche.json | Controlli sugli appalti: costo annuo | 1,5 | 0,8 | Come sopra |
| politiche.json | Trasporto gratuito per i giovani: costo annuo | 1 | 0,6 | Come sopra |
| citta.json | Senso civico: fattore minimo | 0,6 | 0,7 | Con fiducia zero si rende il 70% |
| citta.json | Senso civico: tetto (nuovo, può superare 1) | 1 | 1,15 | Una città con molta fiducia rende il 15% in più |
| citta.json | Senso civico: fiducia del tetto | 37 | 55,5 | Alla fiducia di partenza (circa 37) il fattore vale ancora 1 |
| citta.json | Scandalo: calo di fiducia per quartiere | 3 | 1,5 | Con 3 il Red finiva quasi sempre con la città che si volta |
| citta.json | Città che si volta: soglia di fiducia | 15 | 10 | Come sopra |
| citta.json | Città che si volta: anni consecutivi | 5 | 6 | Come sopra |

Non sono cambiati: durate delle fasi, opzioni dei dilemmi (vantaggi immediati delle
scelte scorrette compresi), entrate per occupato, costo dei servizi, trasferimenti,
cassa integrazione.

### I passi

Ogni passo misurato in memoria su 150 partite per bot (opzione `--variante`).

| Passo | Blu | Red | Casuale | Acciaio | Bonifica | Energia | Mare | Prudente | Nessuna |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Valori del T07 | 0% | 0% | 15% | 0% | 0% | 88% | 91% | 0% | 0% |
| 1. Strade più alla pari e politiche meno care, senso civico fino a 1,3 | 93% | 0% | 50% | 45% | 2% | 81% | 83% | 6% | 3% |
| 2. Bonifica sul fondo statale | | | | 45% | 47% | 81% | 83% | | |
| 3. Entrate di energia e mare più basse | | | | 45% | 47% | 57% | 66% | | |
| 4. Entrate delle opere di quartiere, senso civico 0,7-1,2 | 79% | 0% (67% si volta) | 45% | 43% | 44% | 69% | 79% | 12% | 0% |
| 5. Più posti stabili in sanità e ricerca, senso civico fino a 1,15, scandali più leggeri | 59% | 1% (75% si volta) | 51% | 45% | 49% | 77% | 84% | 50% | 0% |
| 6. Abbandono più difficile, energia e mare ancora più bassi | 59% | 31% | 52% | 46% | 49% | 67% | 79% | 57% | 0% |
| 7. Mare e cultura: 250 posti per lotto (valori finali) | 59% | 30% | 51% | 46% | 49% | 67% | 61% | 57% | 0% |

Le celle vuote sono passi misurati solo sui bot delle strade.

### Obiettivi e vincoli

| Vincolo | Esito |
| --- | --- |
| 1. Blu meglio di Red | Rispettato: 57% contro 30% al 2127; fiducia media finale 50,8 contro 11,8 |
| 2. Le scelte scorrette restano convenienti subito | Rispettato: nessun vantaggio immediato toccato; il costo arriva con scandali (82 in mediana per il Red), fiducia e senso civico |
| 3. Spirale possibile ma evitabile | Rispettato: "nessuna azione" va in dissesto nel 99% dei casi; Blu, casuale e prudente lo evitano in metà dei casi o più |
| 4. Ogni strada con un punto forte e un punto debole diversi | Rispettato con una riserva, vedi sotto |
| 5. Almeno una partita Red su venti con la città che si volta | Rispettato: 26% |
| 6. Durate e costi plausibili | Durate invariate. Cambiati solo i costi annui dei lavori di forno elettrico (40 → 20) e bonifica (18 → 10), letti come quota pubblica locale |

**Le quattro strade** (mediane a fine partita; tempi dalle durate dei dati):

| Strada | Al 2127 | Aria Tamburi | Occupati locali | Disoccupati | Fondi propri | Anni fino all'esercizio | Punto forte | Punto debole |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Acciaio verde | 48% | 60,7 | 55.300 | 14.484 | -1,3 | 8-12 | Lavoro industriale: la cassa integrazione scende più che con ogni altra strada (3.584) | Aria (la peggiore) e conti |
| Bonifica | 48% | 70,6 | 53.650 | 15.034 | -1,5 | 9-15 | Terreni ed esposizione (non misurati dal rapporto) | Lavoro (la peggiore) e tempi (i più lunghi) |
| Energia | 67% | 81,5 | 55.050 | 14.000 | 61,5 | 5-8 | Conti e tempi (la più rapida e la più solida) | Lavoro: pochi posti per lotto |
| Mare e cultura | 63% | 79,7 | 56.200 | 13.500 | 59,0 | 6-10 | Occupazione: più occupati e meno disoccupati di tutte | Entrate per il Comune basse |

**Riserva sul vincolo 4** (risolta nel T06c: la bonifica ora è la migliore su terreni ed esposizione). Nessuna strada vince su tutti gli indicatori, ma la bonifica
non è la migliore su nessuno degli indicatori che il rapporto misura. Il suo punto forte
(terreni bonificati, esposizione che cala ogni anno) è nei dati ma non nel rapporto.
L'energia invece è la migliore su tre aspetti (conti, aria, tempi) e debole solo sul
lavoro. Se l'architetto vuole che la bonifica sia visibilmente la migliore su qualcosa,
servono due cose: aggiungere al rapporto esposizione e salute, e dare alla bonifica un
vantaggio misurabile su quelle. Non l'ho fatto qui per non uscire dagli obiettivi.

**Obiettivi mancati:** nessuno.

**Segnalazioni residue**, fuori dagli obiettivi:

- **I fondi propri crescevano senza limite** nelle partite che sopravvivono (per il bot
  casuale fino a circa 1.000 milioni nel 2127). Risolto nel T06c: l'avanzo oltre la
  riserva si spende in servizi.
- **Molte leve risultano "sempre convenienti" per il bot casuale**: soprattutto le
  opere avviate nei primi dieci anni e, tra le opzioni dei dilemmi, solo quelle
  corrette (pubblicare con un piano, gara regolare, proroga motivata, spazi sicuri).
  È coerente con il vincolo 2: la correttezza costa subito e ripaga dopo.
- **"Nessuna azione" finisce in dissesto nel 99% dei casi**, come voluto.

## Rapporto finale: 1.000 partite per bot (calibrazione 0.2-stime, ritocchi T10)

1000 partite per bot, semi da 1 a 1000, contenuti veri.

### 1. Esiti

Quote calcolate sulle partite giocate fino in fondo.

| Bot | Partite | Al 2127 | In dissesto | Città che si volta | Anno mediano del dissesto |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tutto Blu | 1000 | 44% | 56% | 0% | 2043 |
| Tutto Red | 1000 | 18% | 47% | 35% | 2101 |
| Casuale | 1000 | 48% | 52% | 0% | 2047 |
| Una sola strada: green-steel | 1000 | 52% | 48% | 0% | 2057 |
| Una sola strada: remediation | 1000 | 53% | 47% | 0% | 2057 |
| Una sola strada: energy | 1000 | 68% | 32% | 0% | 2064 |
| Una sola strada: sea-culture | 1000 | 49% | 52% | 0% | 2075 |
| Prudente sui conti | 1000 | 48% | 52% | 0% | 2060 |
| Nessuna azione | 1000 | 0% | 100% | 0% | 2055 |

### 2. Valori mediani a fine partita

Fondi in milioni di euro; lavoro in persone; coscienza e reputazione da -100 a +100.

| Bot | Fondi propri | Fondo statale | Fondo europeo | Fondi privati | Occupati locali | Cassa integrati | Disoccupati | Coscienza | Reputazione | Fiducia media | Scandali |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tutto Blu | -0,1 | 0,1 | 72,0 | 0,0 | 52.740 | 6666 | 14.124 | 14,0 | 14,0 | 43,1 | 0,0 |
| Tutto Red | -2,1 | 300,0 | 0,0 | 0,0 | 57.740 | 0 | 15.590 | -39,6 | -54,6 | 9,5 | 69,0 |
| Casuale | -0,2 | 248,2 | 4,0 | 0,0 | 55.720 | 1590 | 13.379 | 4,0 | -9,3 | 40,4 | 4,0 |
| Una sola strada: green-steel | 60,0 | 300,0 | 62,0 | 0,0 | 56.608 | 0 | 15.255 | -0,4 | -15,0 | 38,1 | 4,0 |
| Una sola strada: remediation | 60,0 | 300,0 | 61,0 | 0,0 | 53.590 | 3256 | 16.170 | -0,6 | -15,4 | 36,7 | 4,0 |
| Una sola strada: energy | 53,1 | 300,0 | 54,0 | 0,0 | 54.590 | 4550 | 14.184 | -1,8 | -16,6 | 36,8 | 6,0 |
| Una sola strada: sea-culture | -0,8 | 300,0 | 0,0 | 0,0 | 54.700 | 4700 | 13.950 | -1,2 | -15,8 | 36,2 | 4,0 |
| Prudente sui conti | -0,9 | 227,9 | 9,0 | 0,0 | 54.120 | 5650 | 13.630 | -14,8 | -29,8 | 31,4 | 7,0 |
| Nessuna azione | -3,6 | 35,0 | 72,0 | 0,0 | 52.740 | 7000 | 13.810 | 6,2 | 6,2 | 40,4 | 0,0 |

Qualità dell'aria (100 = aria pulita) e fiducia, per quartiere:

| Bot | Aria Tamburi | Aria Paolo VI | Aria Città Vecchia | Aria Borgo | Aria Talsano | Aria Area ind. | Fiducia Tamburi | Fiducia Paolo VI | Fiducia Città Vecchia | Fiducia Borgo | Fiducia Talsano | Fiducia Area ind. |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tutto Blu | 61,2 | 77,2 | 80,4 | 81,7 | 84,9 | 51,9 | 39,4 | 42,2 | 41,8 | 43,7 | 44,4 | 33,3 |
| Tutto Red | 64,7 | 78,8 | 81,8 | 82,9 | 85,0 | 60,2 | 11,4 | 8,6 | 8,1 | 10,5 | 8,4 | 8,7 |
| Casuale | 60,6 | 77,2 | 80,3 | 81,7 | 84,9 | 53,6 | 36,2 | 38,3 | 38,2 | 41,3 | 42,9 | 30,8 |
| Una sola strada: green-steel | 50,0 | 74,0 | 78,5 | 80,5 | 85,0 | 38,5 | 31,9 | 35,9 | 38,0 | 39,7 | 39,8 | 28,2 |
| Una sola strada: remediation | 85,0 | 85,0 | 85,0 | 85,0 | 85,0 | 85,0 | 34,9 | 35,2 | 35,5 | 37,1 | 37,9 | 34,5 |
| Una sola strada: energy | 81,5 | 83,9 | 84,3 | 84,5 | 85,0 | 80,3 | 32,5 | 34,9 | 36,6 | 37,9 | 38,3 | 30,0 |
| Una sola strada: sea-culture | 79,7 | 83,4 | 83,6 | 84,0 | 85,0 | 75,8 | 31,6 | 34,2 | 35,8 | 37,3 | 38,2 | 29,0 |
| Prudente sui conti | 57,0 | 76,2 | 79,8 | 81,4 | 85,0 | 47,8 | 28,8 | 30,8 | 29,7 | 32,4 | 32,7 | 21,8 |
| Nessuna azione | 56,8 | 75,9 | 79,5 | 81,2 | 84,8 | 47,5 | 35,4 | 38,2 | 38,3 | 41,5 | 42,3 | 30,9 |

Esposizione accumulata (100 = massima) e salute, per quartiere, e terreni contaminati dell'area industriale:

| Bot | Esposizione Tamburi | Esposizione Paolo VI | Esposizione Città Vecchia | Esposizione Borgo | Esposizione Talsano | Esposizione Area ind. | Salute Tamburi | Salute Paolo VI | Salute Città Vecchia | Salute Borgo | Salute Talsano | Salute Area ind. | Terreni area ind. |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tutto Blu | 63,0 | 38,3 | 28,3 | 23,3 | 8,3 | 84,8 | 46,8 | 54,2 | 56,5 | 60,9 | 64,7 | 38,7 | 90,0 |
| Tutto Red | 0,0 | 0,0 | 5,0 | 0,0 | 0,0 | 0,0 | 71,2 | 69,9 | 63,5 | 67,3 | 69,3 | 64,4 | 54,0 |
| Casuale | 37,1 | 37,0 | 28,0 | 23,0 | 8,0 | 62,4 | 50,5 | 56,5 | 56,2 | 61,0 | 65,0 | 40,3 | 73,0 |
| Una sola strada: green-steel | 64,7 | 5,0 | 0,0 | 0,0 | 0,0 | 100,0 | 51,3 | 66,0 | 68,4 | 71,0 | 71,5 | 40,1 | 88,0 |
| Una sola strada: remediation | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 69,1 | 68,4 | 67,0 | 69,5 | 69,9 | 66,4 | 0,0 |
| Una sola strada: energy | 29,2 | 5,0 | 0,0 | 0,0 | 0,0 | 45,4 | 58,0 | 64,5 | 67,1 | 69,0 | 69,4 | 50,5 | 88,0 |
| Una sola strada: sea-culture | 33,6 | 9,5 | 0,0 | 0,0 | 0,0 | 50,1 | 57,2 | 62,8 | 66,0 | 68,4 | 69,2 | 48,8 | 88,0 |
| Prudente sui conti | 52,5 | 27,5 | 17,5 | 12,5 | 0,0 | 98,9 | 55,8 | 63,2 | 59,7 | 63,7 | 67,9 | 37,4 | 84,0 |
| Nessuna azione | 66,3 | 41,0 | 31,0 | 26,0 | 11,0 | 95,9 | 46,2 | 53,0 | 55,1 | 60,5 | 64,3 | 37,6 | 90,0 |

### 3. Bot con lo stesso esito in più del 90% delle partite

- **ATTENZIONE** Nessuna azione: finisce in dissesto nel 100% delle partite.

### 4. Variabili che crescono o calano senza limite

Mediane ai turni 25, 50, 75, 100 (anni 2052, 2077, 2102, 2127), tra le partite ancora in corso.

- **ATTENZIONE** Tutto Blu: fondi propri cresce senza rallentare (0,6 → 0,8 → 5,9 → 60,0).
- **ATTENZIONE** Tutto Blu: fondo europeo cala senza rallentare (72,0 → 64,0 → 14,0 → 6,0).
- **ATTENZIONE** Tutto Blu: persone formate cresce senza rallentare (4000,0 → 4400,0 → 10.400,0 → 12.684,0).
- **ATTENZIONE** Tutto Blu: coscienza cresce senza rallentare (11,8 → 20,9 → 33,5 → 46,8).
- **ATTENZIONE** Tutto Blu: reputazione cresce senza rallentare (11,8 → 20,9 → 33,5 → 46,8).
- **ATTENZIONE** Casuale: imprese dell'indotto cresce senza rallentare (350,0 → 380,0 → 430,5 → 476,4).
- **ATTENZIONE** Casuale: disoccupati cala senza rallentare (15.145,0 → 15.041,0 → 12.627,5 → 10.311,0).
- **ATTENZIONE** Casuale: emissioni cresce senza rallentare (45,0 → 54,0 → 62,0 → 70,0).
- **ATTENZIONE** Casuale: coscienza cresce senza rallentare (1,1 → 4,4 → 8,4 → 12,2).
- **ATTENZIONE** Casuale: reputazione cresce senza rallentare (-12,6 → -10,0 → -6,2 → -2,7).
- **ATTENZIONE** Una sola strada: green-steel: fondo europeo cala senza rallentare (72,0 → 64,0 → 54,0 → 45,0).
- **ATTENZIONE** Una sola strada: remediation: fondo europeo cala senza rallentare (72,0 → 66,0 → 55,0 → 47,0).
- **ATTENZIONE** Una sola strada: energy: fondi propri cresce senza rallentare (21,5 → 32,0 → 50,8 → 60,0).
- **ATTENZIONE** Una sola strada: energy: fondo europeo cala senza rallentare (72,0 → 66,0 → 58,0 → 49,0).
- **ATTENZIONE** Prudente sui conti: coscienza cala senza rallentare (-5,2 → -11,4 → -15,4 → -20,2).
- **ATTENZIONE** Prudente sui conti: reputazione cala senza rallentare (-19,2 → -26,0 → -29,8 → -35,0).

### 5. Leve mai usate o sempre convenienti

Nessuna leva è rimasta inutilizzata da tutti i bot.

Confronto nelle partite del bot casuale tra chi ha usato la leva nei primi 10 anni e chi no (per i dilemmi: chi ha scelto un'altra opzione dello stesso dilemma).

- **ATTENZIONE** progetto:lotto-acciaio-verde: sempre conveniente per il bot casuale. Con la leva (698 partite): 53% al 2127, fondi propri 60,0, occupati 58.803, reputazione -8,9. Senza (302): 37%, -1,1, 54.205, -10,3.
- **ATTENZIONE** progetto:lotto-bonifica: sempre conveniente per il bot casuale. Con la leva (726 partite): 51% al 2127, fondi propri 60,0, occupati 57.710, reputazione -8,9. Senza (274): 41%, -1,1, 54.686, -10,7.
- **ATTENZIONE** progetto:lotto-energia: sempre conveniente per il bot casuale. Con la leva (708 partite): 52% al 2127, fondi propri 60,0, occupati 57.903, reputazione -9,0. Senza (292): 41%, -1,3, 54.711, -10,1.
- **ATTENZIONE** progetto:lotto-mare-cultura: sempre conveniente per il bot casuale. Con la leva (696 partite): 52% al 2127, fondi propri 60,0, occupati 58.206, reputazione -8,6. Senza (304): 40%, -1,4, 54.566, -10,6.
- **ATTENZIONE** progetto:risanamento-citta-vecchia: sempre conveniente per il bot casuale. Con la leva (288 partite): 55% al 2127, fondi propri 60,0, occupati 58.935, reputazione -8,4. Senza (712): 46%, -0,6, 55.233, -9,7.
- **ATTENZIONE** progetto:medicina-territorio: sempre conveniente per il bot casuale. Con la leva (318 partite): 52% al 2127, fondi propri 60,0, occupati 58.306, reputazione -9,2. Senza (682): 47%, -0,5, 55.195, -9,4.
- **ATTENZIONE** progetto:centro-ricerca-mare: sempre conveniente per il bot casuale. Con la leva (276 partite): 55% al 2127, fondi propri 60,0, occupati 59.515, reputazione -7,9. Senza (724): 46%, -0,6, 55.128, -10,0.
- **ATTENZIONE** dilemma:polveri-giorni-di-vento/pubblica-con-piano: sempre conveniente per il bot casuale. Con la leva (174 partite): 49% al 2127, fondi propri -0,1, occupati 56.471, reputazione -7,0. Senza (385): 44%, -1,1, 54.948, -10,6.
- **ATTENZIONE** dilemma:affidamento-bonifica/gara-regolare: sempre conveniente per il bot casuale. Con la leva (153 partite): 57% al 2127, fondi propri 60,0, occupati 59.569, reputazione -7,3. Senza (273): 40%, -1,1, 54.710, -10,7.
- **ATTENZIONE** dilemma:rendiconto-fondi-europei/dichiarare-ritardo: sempre conveniente per il bot casuale. Con la leva (134 partite): 55% al 2127, fondi propri 60,0, occupati 59.387, reputazione -7,1. Senza (270): 45%, -1,1, 55.083, -11,5.
- **ATTENZIONE** dilemma:rendiconto-fondi-europei/chiedere-proroga: sempre conveniente per il bot casuale. Con la leva (142 partite): 60% al 2127, fondi propri 60,0, occupati 60.233, reputazione -7,1. Senza (262): 42%, -1,1, 54.974, -11,2.
- **ATTENZIONE** dilemma:scuole-giorni-di-vento/chiudere: sempre conveniente per il bot casuale. Con la leva (108 partite): 48% al 2127, fondi propri -0,1, occupati 55.618, reputazione -6,5. Senza (213): 41%, -1,2, 54.959, -10,0.
- **ATTENZIONE** dilemma:cozze-primo-seno/vietare-e-dirlo: sempre conveniente per il bot casuale. Con la leva (153 partite): 49% al 2127, fondi propri -0,1, occupati 56.060, reputazione -8,9. Senza (232): 41%, -1,4, 54.735, -11,7.
- **ATTENZIONE** dilemma:ribasso-scuole/accettare-subito: sempre conveniente per il bot casuale. Con la leva (111 partite): 49% al 2127, fondi propri -0,1, occupati 56.804, reputazione -9,7. Senza (185): 40%, -1,3, 54.720, -10,6.
- **ATTENZIONE** strada:green-steel: sempre conveniente per il bot casuale. Con la leva (577 partite): 54% al 2127, fondi propri 60,0, occupati 59.230, reputazione -8,6. Senza (423): 40%, -1,1, 54.649, -10,3.
- **ATTENZIONE** strada:energy: sempre conveniente per il bot casuale. Con la leva (598 partite): 52% al 2127, fondi propri 60,0, occupati 58.290, reputazione -8,5. Senza (402): 43%, -1,0, 55.018, -10,1.
- **ATTENZIONE** strada:sea-culture: sempre conveniente per il bot casuale. Con la leva (581 partite): 51% al 2127, fondi propri 60,0, occupati 57.689, reputazione -8,8. Senza (419): 45%, -1,1, 55.098, -9,9.

Quota di partite in cui ogni leva è stata usata, per bot:

| Leva | blu | red | casuale | strada-green-steel | strada-remediation | strada-energy | strada-sea-culture | prudente | nessuna |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| progetto:lotto-acciaio-verde | 100% | 100% | 93% | 100% | 0% | 0% | 0% | 0% | 0% |
| progetto:lotto-bonifica | 100% | 100% | 93% | 0% | 100% | 0% | 0% | 0% | 0% |
| progetto:lotto-energia | 100% | 100% | 95% | 0% | 0% | 100% | 0% | 0% | 0% |
| progetto:lotto-mare-cultura | 77% | 100% | 94% | 0% | 0% | 0% | 100% | 0% | 0% |
| progetto:risanamento-citta-vecchia | 100% | 100% | 69% | 0% | 0% | 0% | 0% | 40% | 0% |
| progetto:scuole-paolo-vi | 100% | 100% | 70% | 0% | 0% | 0% | 0% | 100% | 0% |
| progetto:medicina-territorio | 79% | 100% | 70% | 0% | 0% | 0% | 0% | 100% | 0% |
| progetto:fascia-verde-tamburi | 2% | 99% | 71% | 0% | 0% | 0% | 0% | 100% | 0% |
| progetto:banchine-logistica | 1% | 95% | 70% | 0% | 0% | 0% | 0% | 48% | 0% |
| progetto:difese-costiere | 0% | 87% | 68% | 0% | 0% | 0% | 0% | 84% | 0% |
| progetto:trasporto-rapido | 0% | 71% | 72% | 0% | 0% | 0% | 0% | 66% | 0% |
| progetto:riqualificazione-talsano | 0% | 33% | 69% | 0% | 0% | 0% | 0% | 100% | 0% |
| progetto:centro-ricerca-mare | 0% | 16% | 69% | 0% | 0% | 0% | 0% | 92% | 0% |
| politica:formazione-riconversione | 100% | 0% | 73% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:dati-aperti-aria | 100% | 0% | 70% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:consulte-quartiere | 100% | 0% | 72% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:integrazione-reddito | 100% | 0% | 72% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:sgravi-indotto | 0% | 0% | 78% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:controlli-appalti | 100% | 0% | 72% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:trasporto-giovani | 100% | 0% | 72% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:piano-caldo | 100% | 0% | 73% | 0% | 0% | 0% | 0% | 0% | 0% |
| dilemma:polveri-giorni-di-vento/pubblica-subito | 96% | 0% | 31% | 33% | 33% | 35% | 33% | 98% | 96% |
| dilemma:polveri-giorni-di-vento/pubblica-con-piano | 0% | 0% | 30% | 34% | 34% | 33% | 34% | 0% | 0% |
1000 partite per bot in 262.7 s con 7 thread
| dilemma:polveri-giorni-di-vento/rinvia | 0% | 99% | 31% | 30% | 31% | 31% | 32% | 0% | 0% |
| dilemma:affidamento-bonifica/gara-regolare | 83% | 0% | 29% | 32% | 30% | 31% | 33% | 0% | 89% |
| dilemma:affidamento-bonifica/affidamento-diretto | 0% | 100% | 29% | 32% | 32% | 35% | 30% | 98% | 0% |
| dilemma:affidamento-bonifica/studio-preliminare | 0% | 0% | 31% | 32% | 34% | 31% | 35% | 0% | 0% |
| dilemma:posti-nuovo-polo/selezione-pubblica | 80% | 0% | 55% | 61% | 65% | 71% | 73% | 98% | 93% |
| dilemma:posti-nuovo-polo/lista-segnalata | 0% | 100% | 57% | 64% | 61% | 68% | 72% | 0% | 0% |
| dilemma:posti-nuovo-polo/priorita-ex-lavoratori | 0% | 0% | 53% | 62% | 61% | 66% | 71% | 0% | 0% |
| dilemma:presidio-ai-cancelli/incontrare | 83% | 0% | 34% | 39% | 49% | 51% | 62% | 0% | 88% |
| dilemma:presidio-ai-cancelli/sgomberare | 0% | 85% | 33% | 37% | 52% | 55% | 58% | 0% | 0% |
| dilemma:presidio-ai-cancelli/lasciar-correre | 0% | 0% | 32% | 38% | 51% | 57% | 62% | 97% | 0% |
| dilemma:rendiconto-fondi-europei/dichiarare-ritardo | 79% | 0% | 31% | 60% | 57% | 68% | 21% | 0% | 86% |
| dilemma:rendiconto-fondi-europei/chiedere-proroga | 0% | 0% | 36% | 63% | 62% | 66% | 19% | 0% | 0% |
| dilemma:rendiconto-fondi-europei/spese-anticipate | 0% | 92% | 33% | 61% | 65% | 73% | 19% | 95% | 0% |
| dilemma:scuole-giorni-di-vento/chiudere | 30% | 0% | 11% | 20% | 9% | 9% | 10% | 31% | 34% |
| dilemma:scuole-giorni-di-vento/spazi-sicuri | 0% | 0% | 10% | 23% | 9% | 9% | 9% | 0% | 0% |
| dilemma:scuole-giorni-di-vento/lasciare-aperte | 0% | 30% | 12% | 20% | 10% | 9% | 8% | 0% | 0% |
| dilemma:cozze-primo-seno/vietare-e-dirlo | 81% | 0% | 31% | 33% | 29% | 32% | 33% | 0% | 86% |
| dilemma:cozze-primo-seno/spostare-impianti | 0% | 0% | 27% | 29% | 29% | 29% | 32% | 0% | 0% |
| dilemma:cozze-primo-seno/aspettare-in-silenzio | 0% | 98% | 27% | 30% | 30% | 31% | 31% | 94% | 0% |
| dilemma:ribasso-scuole/verificare | 68% | 0% | 25% | 31% | 28% | 33% | 32% | 0% | 83% |
| dilemma:ribasso-scuole/riassegnare | 0% | 0% | 21% | 29% | 31% | 30% | 33% | 0% | 0% |
| dilemma:ribasso-scuole/accettare-subito | 0% | 37% | 25% | 31% | 33% | 32% | 32% | 49% | 0% |
| dilemma:cassa-in-rosso/dirlo-in-consiglio | 75% | 0% | 21% | 12% | 12% | 16% | 17% | 0% | 65% |
| dilemma:cassa-in-rosso/piano-di-rientro | 0% | 0% | 22% | 12% | 13% | 15% | 20% | 0% | 0% |
| dilemma:cassa-in-rosso/ritardare-i-fornitori | 0% | 36% | 21% | 12% | 14% | 16% | 18% | 53% | 0% |
| dilemma:cassa-che-finisce/proroga-con-corsi | 45% | 0% | 7% | 14% | 28% | 39% | 43% | 0% | 44% |
| dilemma:cassa-che-finisce/assumere-senza-concorso | 0% | 0% | 8% | 13% | 29% | 39% | 43% | 0% | 0% |
| dilemma:cassa-che-finisce/lasciar-scadere | 0% | 3% | 8% | 15% | 28% | 35% | 44% | 78% | 0% |
| dilemma:albergo-lungomare/rispettare-il-piano | 45% | 0% | 18% | 23% | 25% | 27% | 31% | 0% | 35% |
| dilemma:albergo-lungomare/variante-con-assemblee | 0% | 0% | 18% | 24% | 22% | 25% | 28% | 0% | 0% |
| dilemma:albergo-lungomare/variante-in-giunta | 0% | 53% | 16% | 25% | 24% | 31% | 31% | 76% | 0% |
| dilemma:capannone-occupato/affidare-con-bando | 47% | 0% | 17% | 22% | 23% | 26% | 29% | 0% | 21% |
| dilemma:capannone-occupato/sgomberare-e-vendere | 0% | 98% | 16% | 21% | 19% | 28% | 29% | 71% | 0% |
| dilemma:capannone-occupato/lasciar-stare | 0% | 0% | 18% | 21% | 23% | 27% | 29% | 0% | 0% |
| dilemma:case-vuote-isola/case-alle-famiglie | 48% | 0% | 15% | 16% | 19% | 25% | 28% | 0% | 1% |
| dilemma:case-vuote-isola/vendere-con-vincoli | 0% | 0% | 15% | 18% | 21% | 26% | 28% | 0% | 0% |
| dilemma:case-vuote-isola/vendere-tutto | 0% | 95% | 17% | 16% | 17% | 27% | 28% | 61% | 0% |
| dilemma:subappalto-scogliere/fermare-e-verificare | 46% | 0% | 34% | 35% | 36% | 45% | 41% | 0% | 0% |
| dilemma:subappalto-scogliere/rescindere | 0% | 0% | 36% | 33% | 34% | 45% | 48% | 0% | 0% |
| dilemma:subappalto-scogliere/chiudere-un-occhio | 0% | 96% | 34% | 37% | 34% | 49% | 46% | 63% | 0% |
| dilemma:acqua-d-estate/turni-per-tutti | 44% | 0% | 35% | 34% | 34% | 46% | 41% | 0% | 0% |
| dilemma:acqua-d-estate/rifare-le-condotte | 0% | 0% | 35% | 35% | 36% | 45% | 43% | 0% | 0% |
| dilemma:acqua-d-estate/chiudere-in-periferia | 0% | 94% | 36% | 35% | 36% | 44% | 43% | 54% | 0% |
| dilemma:chi-vuole-partire/pubblicare-e-ascoltare | 41% | 0% | 18% | 16% | 18% | 22% | 21% | 0% | 0% |
| dilemma:chi-vuole-partire/pubblicare-dopo-la-firma | 0% | 0% | 13% | 17% | 15% | 23% | 21% | 50% | 0% |
| dilemma:chi-vuole-partire/chiuderla-in-un-cassetto | 0% | 91% | 17% | 17% | 19% | 25% | 24% | 0% | 0% |
| dilemma:stanze-fresche/stanze-in-ogni-quartiere | 44% | 0% | 36% | 34% | 35% | 43% | 39% | 0% | 0% |
| dilemma:stanze-fresche/solo-un-centro | 0% | 0% | 35% | 34% | 36% | 42% | 39% | 0% | 0% |
| dilemma:stanze-fresche/annunciare-senza-personale | 0% | 91% | 34% | 35% | 36% | 45% | 39% | 50% | 0% |
| dilemma:registro-delle-malattie/pubblicare-tutto | 42% | 0% | 10% | 17% | 9% | 23% | 19% | 47% | 0% |
| dilemma:registro-delle-malattie/pubblicare-con-medici | 0% | 0% | 8% | 16% | 6% | 23% | 22% | 0% | 0% |
| dilemma:registro-delle-malattie/solo-il-calo | 0% | 10% | 8% | 17% | 9% | 23% | 20% | 0% | 0% |
| dilemma:case-ai-margini/trasferimento-volontario | 41% | 0% | 1% | 17% | 0% | 21% | 19% | 0% | 0% |
| dilemma:case-ai-margini/trasferimento-con-ordinanza | 0% | 0% | 1% | 17% | 0% | 21% | 17% | 0% | 0% |
| dilemma:case-ai-margini/rinviare | 0% | 0% | 1% | 14% | 0% | 23% | 18% | 46% | 0% |
| dilemma:navi-in-mar-grande/valutazione-completa | 43% | 0% | 14% | 16% | 17% | 20% | 17% | 0% | 0% |
| dilemma:navi-in-mar-grande/approdo-limitato | 0% | 0% | 17% | 14% | 18% | 23% | 17% | 0% | 0% |
| dilemma:navi-in-mar-grande/dragare-subito | 0% | 66% | 17% | 18% | 17% | 23% | 18% | 47% | 0% |
| dilemma:fondi-dello-stato-avanzati/restituire | 0% | 0% | 24% | 25% | 27% | 32% | 27% | 0% | 0% |
| dilemma:fondi-dello-stato-avanzati/manutenzione-regolare | 0% | 0% | 27% | 24% | 29% | 33% | 24% | 46% | 0% |
| dilemma:fondi-dello-stato-avanzati/somma-urgenza | 0% | 61% | 27% | 27% | 23% | 32% | 26% | 0% | 0% |
| dilemma:mareggiata-alle-borgate/risarcire-e-arretrare | 42% | 0% | 17% | 17% | 18% | 23% | 19% | 0% | 0% |
| dilemma:mareggiata-alle-borgate/solo-chi-ha-titolo | 0% | 0% | 19% | 20% | 17% | 22% | 16% | 43% | 0% |
| dilemma:mareggiata-alle-borgate/sanare-e-ricostruire | 0% | 33% | 20% | 16% | 19% | 22% | 18% | 0% | 0% |
| dilemma:memoria-della-fabbrica/conservare-e-raccontare | 9% | 0% | 14% | 9% | 16% | 12% | 9% | 0% | 0% |
| dilemma:memoria-della-fabbrica/solo-archivio | 0% | 0% | 14% | 9% | 15% | 12% | 8% | 0% | 0% |
| dilemma:memoria-della-fabbrica/demolire-e-dimenticare | 0% | 30% | 16% | 10% | 16% | 13% | 10% | 42% | 0% |
| dilemma:mare-caldo/indennizzi-con-controlli | 34% | 0% | 12% | 14% | 15% | 20% | 15% | 0% | 0% |
| dilemma:mare-caldo/aiutare-a-cambiare | 0% | 0% | 11% | 15% | 15% | 20% | 16% | 0% | 0% |
| dilemma:mare-caldo/a-pioggia | 0% | 27% | 10% | 15% | 16% | 18% | 15% | 42% | 0% |
| strada:green-steel | 100% | 100% | 89% | 100% | 0% | 0% | 0% | 0% | 0% |
| strada:remediation | 100% | 100% | 89% | 0% | 100% | 0% | 0% | 0% | 0% |
| strada:energy | 100% | 100% | 90% | 0% | 0% | 100% | 0% | 0% | 0% |
| strada:sea-culture | 77% | 100% | 90% | 0% | 0% | 0% | 100% | 0% | 0% |

## Storia

I passaggi precedenti, con i numeri di allora: non valgono più per la calibrazione attuale.

### Situazione dopo il T07

Il motore ora fa reagire la città: aria, esposizione, salute, servizi, tensione e
fiducia cambiano ogni anno, gli scandali hanno conseguenze, il senso civico pesa
sulle entrate, e la città può voltarsi. **I valori dei contenuti non sono stati
toccati** in questa fase: le proposte del T06 restano in sospeso (vedi in fondo).
I nuovi coefficienti di `citta.json` sono stime dichiarate, tarate solo perché
all'inizio la città sia vicina all'equilibrio (fiducia e salute di partenza).

1.000 partite per bot, semi da 1 a 1.000: **nessuna partita interrotta** (l'errore
di arrotondamento della cassa integrazione è corretto).

#### Distanza dagli obiettivi di arrivo al 2127

| Bot | Obiettivo | Oggi | Distanza |
| --- | ---: | ---: | --- |
| Tutto Blu | 40-70% | 0% | 40 punti sotto |
| Tutto Red | 15-45% | 0% | 15 punti sotto |
| Casuale | 30-60% | 16% | 14 punti sotto |
| Una sola strada: acciaio verde | 40-80% | 1% | 39 punti sotto |
| Una sola strada: bonifica | 40-80% | 0% | 40 punti sotto |
| Una sola strada: energia | 40-80% | 84% | 4 punti sopra |
| Una sola strada: mare e cultura | 40-80% | 86% | 6 punti sopra |
| Scarto tra la strada migliore e la peggiore | al massimo 25 punti | 86 punti | 61 punti di troppo |
| Prudente sui conti | 40-70% | 0% | 40 punti sotto |
| Nessuna azione | 0-10% | 0% | dentro l'obiettivo |

Un solo obiettivo su dieci è raggiunto ("nessuna azione"). Sono vicine al bersaglio
le strade energia e mare e cultura, poco sopra il massimo.

#### Che cosa è cambiato rispetto al T06

| Bot | Al 2127, T06 | Al 2127, T07 |
| --- | ---: | ---: |
| Tutto Blu | 0% | 0% |
| Tutto Red | 100% | 0% |
| Casuale | 45% | 16% |
| Acciaio verde | 6% | 1% |
| Bonifica | 2% | 0% |
| Energia | 98% | 84% |
| Mare e cultura | 100% | 86% |
| Prudente sui conti | 55% | 0% |
| Nessuna azione | 0% | 0% |

- **La scorrettezza ora costa.** Tutto Red passa dal 100% allo 0% di partite al 2127:
  gli scandali (6 in mediana) abbassano la fiducia di quartieri e Consiglio, la
  fiducia bassa riduce il senso civico e quindi le entrate, e il dissesto arriva in
  mediana nel 2047. La richiesta R2 del T06 è soddisfatta; ora l'effetto è troppo
  forte, perché il Red non arriva mai al 2127 (obiettivo 15-45%).
- **Quasi tutti peggiorano.** Il casuale scende dal 45% al 16% e il prudente dal 55%
  allo 0%. Il disavanzo strutturale di partenza resta (proposta 1 del T06 non
  applicata). La spiegazione probabile, da verificare con un'analisi mirata: negli
  anni di disavanzo i servizi calano, la salute e poi la fiducia ne risentono, il
  senso civico scende e le entrate calano ancora. Il prudente si reggeva sulla
  truffa del rendiconto europeo, che ora, se scoperta, comporta anche una penale.
- **Il fondo statale ha un tetto.** Non cresce più senza limite: nelle partite che
  arrivano al 2127 si ferma a 300 milioni. Restano senza limite solo i fondi propri
  delle strade energia e mare e cultura.
- **L'aria migliora per tutti.** Con lo stabilimento chiuso, i Tamburi passano da 35
  a 55-82 a seconda di che cosa si fa dei lotti; il massimo arriva con le strade
  energia e mare e cultura, che lasciano lotti quasi senza pressione.
- **Nessuna città si volta.** La fiducia media non resta mai sotto 15 per cinque anni:
  il dissesto arriva sempre prima.

#### Prossimo passo suggerito

Ricalcolare le proposte del T06 sul motore nuovo prima di applicarle. La leva più
forte resta il disavanzo strutturale (costo dei servizi rispetto alle entrate di
partenza): con il T07 un disavanzo innesca anche la spirale servizi-fiducia-entrate,
quindi la soglia è ancora più netta di prima.

### Analisi e proposte del T06 (superate dal T06b)

Quanto segue è stato calcolato **prima del T07**, sul motore senza dinamica dei quartieri e senza conseguenze degli scandali. I numeri degli esperimenti non valgono più e vanno ricalcolati; le proposte restano come traccia, nessuna è stata applicata.

#### Che cosa dice il rapporto

1. **Essere corretti porta al dissesto, essere scorretti no.** Tutto Blu va in
   dissesto nel 100% delle partite, in mediana nel 2037; Tutto Red arriva al 2127 in
   praticamente tutte, con 48 scandali e reputazione -47 (mediane). La differenza non sta nelle
   scorciatoie: sta nelle politiche che il Blu paga con i fondi propri (8,8 milioni
   l'anno in tutto) e nel fatto che scandali e reputazione **non hanno alcuna
   conseguenza materiale**. Il gioco, così, insegna che la scorrettezza conviene.
2. **L'economia sta sul filo di un rasoio.** All'inizio le entrate proprie valgono
   circa 35,2 milioni l'anno e i servizi ne costano 37: senza nuovi posti di lavoro
   la città è in disavanzo strutturale. Basta abbassare i servizi a 34 milioni
   perché tutti i bot, anche "nessuna azione", arrivino al 2127. L'esito dipende più
   da questa soglia che dalle scelte.
3. **Le strade di riconversione non sono alla pari.** Una sola strada, energia o
   mare e cultura, arriva al 2127 in quasi tutte le partite; acciaio verde o
   bonifica vanno quasi sempre in dissesto. L'acciaio verde costa 40 milioni l'anno
   di lavori sul fondo statale, che nei primi anni è assorbito dalla cassa
   integrazione; la bonifica consuma i fondi europei e, finita, non dà né lavoro né
   entrate. La regola 5 dice che nessuna strada ha un peso morale: non dice che
   devono rendere uguale, ma uno squilibrio così forte suggerisce ai giocatori una
   risposta "giusta" invece di aprire il dibattito.
4. **I fondi si accumulano senza limite.** Nelle partite che sopravvivono il fondo
   statale arriva a migliaia di milioni e i fondi propri a centinaia: niente li
   spende. È un limite del motore più che dei valori.
5. **Il bot prudente si regge sulla truffa.** Sceglie sempre l'opzione che costa
   meno, e nel dilemma sui fondi europei è "rendicontare spese non fatte" (+4
   milioni). Riducendo quel vantaggio a +1, le sue partite al 2127 scendono dal 51%
   al 13%.
6. **Nessuna leva è inutilizzata.** Sono sempre convenienti, per il bot casuale, le
   tre strade energia, mare e cultura e bonifica (in parte perché i cantieri
   assumono), le banchine nel porto e il centro di ricerca sul mare.

#### Errore del motore trovato (corretto nel T07)

In 4 partite su 9.000 (tutte del bot "una sola strada: acciaio verde") il motore
produce un fondo statale negativo di -7·10⁻¹⁵, cioè un errore di arrotondamento.
Il punto è `payMandatorySpending` in `packages/sim/src/economy.ts`: il numero di
cassa integrati coperti è `floor(fondo / costo)`, ma il prodotto `coperti × costo`
in virgola mobile può superare il fondo di un'inezia (per esempio 63 / 0,009 dà
7000,000…1 e 7000 × 0,009 dà 63,000…01). Le quattro partite sono escluse dalle
statistiche e il rapporto le elenca. La correzione spetta a `sim-engineer`: questo
task non può toccare `packages/sim`.

#### Esperimenti sulle proposte

Prima di proporre, ogni modifica è stata provata in memoria, senza toccare i dati,
su 150 partite per bot (semi da 1 a 150). Quota di partite arrivate al 2127:

| Variante | Blu | Red | Casuale | Acciaio | Bonifica | Energia | Mare | Prudente | Nessuna |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Valori attuali | 0% | 100% | 42% | 3% | 1% | 97% | 100% | 51% | 0% |
| Servizi 37 → 34 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| Servizi 37 → 35,5 | 2% | 100% | 98% | 100% | 100% | 100% | 100% | 100% | 48% |
| Servizi 37 → 36 | 0% | 100% | 87% | 83% | 84% | 100% | 100% | 100% | 0% |
| Politiche sui fondi propri a metà prezzo | 0% | 100% | 68% | 3% | 1% | 97% | 100% | 51% | 0% |
| Trasferimenti 60 → 45, cassa 0,009 → 0,0075 | 0% | 95% | 21% | 1% | 1% | 79% | 100% | 2% | 0% |
| Acciaio: lavori 40 → 20, entrate 1,2 → 3; bonifica: lavori 18 → 10, entrate +1 l'anno | 0% | 100% | 57% | 44% | 46% | 97% | 100% | 51% | 0% |
| Vantaggi scorretti ridotti (spese anticipate +4 → +1, sgombero +3 → +1) | 0% | 100% | 41% | 3% | 1% | 97% | 100% | 13% | 0% |
| **Pacchetto A**: servizi 36 + politiche a metà + trasferimenti e cassa + strade + vantaggi ridotti | 13% | 100% | 90% | 88% | 97% | 99% | 100% | 29% | 0% |
| **Pacchetto B**: come A, con servizi 35,5 | 79% | 100% | 99% | 100% | 100% | 100% | 100% | 100% | 48% |

Nessuna combinazione di valori toglie al Red la certezza di arrivare al 2127: per
quello serve una regola nel motore (vedi sotto).

#### Proposte di modifica ai valori, in ordine di importanza

1. **Costo annuo dei servizi da 37 a 36 milioni** (`parametri.json`,
   `economy.servicesCostPerYear`).
   *Problema:* il disavanzo strutturale decide da solo l'esito; con 37 milioni chi
   non fa nulla va sempre in dissesto e il caso non conta.
   *Effetto atteso:* da solo, il casuale sale dal 42% all'87% di partite al 2127 e
   le strade acciaio e bonifica dal 3% e 1% a oltre l'80%. "Nessuna azione" resta
   in dissesto: tenere fermi i conti senza fare nulla non basta, ed è un messaggio
   coerente con il tema. Da usare insieme alle proposte 2 e 3, non al posto loro.
2. **Politiche a carico dei fondi propri a metà prezzo** (`politiche.json`,
   `annualCost` di dati sull'aria, consulte, integrazione al reddito, sgravi,
   controlli sugli appalti, trasporto per i giovani).
   *Problema:* le politiche corrette costano 8,8 milioni l'anno di fondi propri
   contro un disavanzo di 1,8: il Blu va in dissesto nel 100% delle partite.
   *Effetto atteso:* da sola porta il casuale dal 42% al 68%; con le proposte 1, 3,
   4 e 5 il Blu passa dallo 0% al 13% (pacchetto A).
3. **Rendere alla pari acciaio verde e bonifica** (`progetti.json`):
   forno elettrico con lavori a 20 milioni l'anno invece di 40 ed entrate a 3
   milioni l'anno invece di 1,2; bonifica con lavori a 10 milioni l'anno invece di
   18 e un'entrata annua di 1 milione in esercizio (canoni delle aree restituite).
   *Problema:* una sola strada, energia o mare porta al 2127 nel 97-100% delle
   partite, acciaio o bonifica nell'1-3%: il gioco suggerisce una risposta.
   *Effetto atteso:* da sola porta acciaio e bonifica al 44-46%; nel pacchetto A
   all'88-97%, vicino a energia e mare.
4. **Ridurre il vantaggio materiale delle opzioni scorrette più convenienti**
   (`dilemmi.json`): "rendicontare spese non fatte" da +4 a +1 milioni; "chiedere
   lo sgombero" da +3 a +1 di capacità di spesa.
   *Problema:* il bot prudente si regge su queste due scelte: la truffa è la
   strategia di chi tiene ai conti.
   *Effetto atteso:* il prudente scende dal 51% al 13% di partite al 2127; la
   scorrettezza smette di essere la scelta "prudente". Il Red non cambia (vedi la
   richiesta R2 al motore).
5. **Trasferimenti statali da 60 a 45 milioni l'anno e costo della cassa
   integrazione da 9.000 a 7.500 euro a persona** (`parametri.json`).
   *Problema:* il fondo statale cresce senza limite nelle partite che sopravvivono.
   *Effetto atteso:* il saldo annuo dello Stato a regime scende di un quarto. Con la
   sola proposta 1 il fondo statale mediano del casuale a fine partita è di circa
   2.400 milioni; con il pacchetto A, che include questa proposta, di circa 1.600. Riduce la crescita, non la elimina (vedi R3). Da
   sola peggiora tutti gli esiti (il casuale scende al 21%): non va applicata
   senza la proposta 1.
6. **Rivedere "nessuna azione" solo se il dissesto certo non è voluto.** Con i valori
   attuali e con il pacchetto A chi non fa nulla va sempre in dissesto, intorno al
   2050; con il pacchetto B in metà dei casi. È una scelta di senso più che di
   bilanciamento: decide l'architetto.

**Pacchetto consigliato per la prossima taratura: A** (proposte 1-5). Riduce tutte
le segnalazioni tranne la certezza del Red, che dipende dal motore. Il pacchetto B
è più generoso: quasi tutti i bot superano il 90% di partite al 2127, quindi
riaccende la segnalazione "stesso esito".

#### Richieste al motore (fuori da questo task)

Non sono valori dei contenuti: servono task per `sim-engineer`.

- **R1. Errore di arrotondamento nella cassa integrazione** (vedi sopra). Bloccante
  per il criterio "1.000 partite senza errori". Correzione minima: non scendere sotto
  zero nel pagamento della cassa (per esempio limitare la spesa al fondo
  disponibile).
- **R2. Conseguenze materiali di reputazione e scandali.** Oggi uno scandalo abbassa
  solo la reputazione, e la reputazione non tocca nulla. Per esempio: uno scandalo
  abbassa la fiducia nei quartieri e la pazienza del Consiglio, e una reputazione
  bassa riduce la capacità di spesa o i fondi europei concessi. Senza questo, il Red
  vince sempre.
- **R3. Un'economia che si riequilibra.** Spesa per i servizi che cresce con la
  popolazione e con l'indice dei servizi, trasferimenti statali che scendono quando
  la cassa integrazione si svuota, o un modo per spendere i fondi accumulati.
  Toglierebbe la crescita senza limite dei fondi e renderebbe meno netta la soglia
  della proposta 1.
