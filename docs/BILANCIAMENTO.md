# Bilanciamento

Bilanciamento dei contenuti: calibrazione `0.2-stime` del T06b, con la causa della
spirale, i valori cambiati e il rapporto finale. In fondo, la storia dei passaggi
precedenti (T06 e T07). I valori descritti nella sezione T06b sono **applicati**
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

## Bilanciamento T06b (calibrazione `0.2-stime`)

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

**Riserva sul vincolo 4.** Nessuna strada vince su tutti gli indicatori, ma la bonifica
non è la migliore su nessuno degli indicatori che il rapporto misura. Il suo punto forte
(terreni bonificati, esposizione che cala ogni anno) è nei dati ma non nel rapporto.
L'energia invece è la migliore su tre aspetti (conti, aria, tempi) e debole solo sul
lavoro. Se l'architetto vuole che la bonifica sia visibilmente la migliore su qualcosa,
servono due cose: aggiungere al rapporto esposizione e salute, e dare alla bonifica un
vantaggio misurabile su quelle. Non l'ho fatto qui per non uscire dagli obiettivi.

**Obiettivi mancati:** nessuno.

**Segnalazioni residue**, fuori dagli obiettivi:

- **I fondi propri crescono senza limite** nelle partite che sopravvivono (per il bot
  casuale fino a circa 1.000 milioni nel 2127). Il motore non ha ancora un modo di
  spendere gli avanzi: è la richiesta R3 del T06, non coperta da questo task.
- **Molte leve risultano "sempre convenienti" per il bot casuale**: soprattutto le
  opere avviate nei primi dieci anni e, tra le opzioni dei dilemmi, solo quelle
  corrette (pubblicare con un piano, gara regolare, proroga motivata, spazi sicuri).
  È coerente con il vincolo 2: la correttezza costa subito e ripaga dopo.
- **"Nessuna azione" finisce in dissesto nel 99% dei casi**, come voluto.

## Rapporto finale: 1.000 partite per bot (calibrazione 0.2-stime)

1000 partite per bot, semi da 1 a 1000, contenuti veri.

### 1. Esiti

Quote calcolate sulle partite giocate fino in fondo.

| Bot | Partite | Al 2127 | In dissesto | Città che si volta | Anno mediano del dissesto |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tutto Blu | 1000 | 57% | 43% | 0% | 2043 |
| Tutto Red | 1000 | 30% | 44% | 26% | 2090 |
| Casuale | 1000 | 53% | 47% | 0% | 2046 |
| Una sola strada: green-steel | 1000 | 48% | 52% | 0% | 2058 |
| Una sola strada: remediation | 1000 | 48% | 52% | 0% | 2058 |
| Una sola strada: energy | 1000 | 67% | 34% | 0% | 2062 |
| Una sola strada: sea-culture | 1000 | 63% | 37% | 0% | 2071 |
| Prudente sui conti | 1000 | 53% | 47% | 0% | 2057.5 |
| Nessuna azione | 1000 | 1% | 99% | 0% | 2055 |

### 2. Valori mediani a fine partita

Fondi in milioni di euro; lavoro in persone; coscienza e reputazione da -100 a +100.

| Bot | Fondi propri | Fondo statale | Fondo europeo | Fondi privati | Occupati locali | Cassa integrati | Disoccupati | Coscienza | Reputazione | Fiducia media | Scandali |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tutto Blu | 16,5 | 0,1 | 8,0 | 0,0 | 53.750 | 6666 | 12.984 | 27,8 | 27,8 | 50,8 | 0,0 |
| Tutto Red | 4,2 | 300,0 | 0,0 | 0,0 | 57.695 | 0 | 15.640 | -30,2 | -45,2 | 11,8 | 82,0 |
| Casuale | 494,7 | 300,0 | 4,0 | 0,0 | 59.570 | 300 | 12.906 | 4,5 | -7,9 | 44,8 | 8,0 |
| Una sola strada: green-steel | -1,3 | 19,1 | 40,0 | 0,0 | 55.300 | 3584 | 14.484 | -1,8 | -16,4 | 36,9 | 4,0 |
| Una sola strada: remediation | -1,5 | 9,4 | 42,0 | 0,0 | 53.650 | 4808 | 15.034 | -2,4 | -16,8 | 35,8 | 4,0 |
| Una sola strada: energy | 61,5 | 300,0 | 8,0 | 0,0 | 55.050 | 4350 | 14.000 | -4,6 | -19,2 | 36,0 | 9,0 |
| Una sola strada: sea-culture | 59,0 | 300,0 | 2,0 | 0,0 | 56.200 | 3950 | 13.500 | -3,8 | -18,7 | 37,5 | 6,0 |
| Prudente sui conti | 248,2 | 118,4 | 2,0 | 0,0 | 55.250 | 6250 | 11.900 | -2,2 | -16,8 | 37,6 | 5,0 |
| Nessuna azione | -3,9 | 35,0 | 64,0 | 0,0 | 52.700 | 7000 | 13.700 | 4,0 | 4,0 | 39,4 | 0,0 |

Qualità dell'aria (100 = aria pulita) e fiducia, per quartiere:

| Bot | Aria Tamburi | Aria Paolo VI | Aria Città Vecchia | Aria Borgo | Aria Talsano | Aria Area ind. | Fiducia Tamburi | Fiducia Paolo VI | Fiducia Città Vecchia | Fiducia Borgo | Fiducia Talsano | Fiducia Area ind. |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tutto Blu | 60,8 | 77,0 | 80,3 | 81,7 | 85,0 | 51,5 | 49,1 | 51,1 | 50,3 | 50,9 | 51,3 | 42,3 |
| Tutto Red | 64,7 | 78,8 | 81,8 | 82,9 | 85,0 | 60,4 | 9,1 | 11,4 | 11,1 | 12,0 | 12,9 | 4,8 |
| Casuale | 61,1 | 77,5 | 80,4 | 81,8 | 85,0 | 54,3 | 44,8 | 45,1 | 43,4 | 44,2 | 44,6 | 37,5 |
| Una sola strada: green-steel | 60,7 | 77,5 | 80,3 | 81,6 | 85,0 | 55,0 | 31,0 | 35,6 | 36,7 | 38,1 | 38,8 | 27,1 |
| Una sola strada: remediation | 70,6 | 80,1 | 82,1 | 82,9 | 85,0 | 63,0 | 33,1 | 33,6 | 34,7 | 36,3 | 37,4 | 30,7 |
| Una sola strada: energy | 81,5 | 83,9 | 84,3 | 84,5 | 85,0 | 80,3 | 31,8 | 34,5 | 35,8 | 36,9 | 37,5 | 28,9 |
| Una sola strada: sea-culture | 79,7 | 83,4 | 83,6 | 84,0 | 85,0 | 75,8 | 33,6 | 36,3 | 37,6 | 38,4 | 38,8 | 30,6 |
| Prudente sui conti | 57,0 | 76,2 | 79,8 | 81,4 | 85,0 | 47,8 | 35,2 | 38,2 | 37,0 | 37,8 | 38,4 | 25,9 |
| Nessuna azione | 56,8 | 75,9 | 79,5 | 81,2 | 84,8 | 47,5 | 34,4 | 36,4 | 37,2 | 40,2 | 41,9 | 30,5 |

### 3. Bot con lo stesso esito in più del 90% delle partite

- **ATTENZIONE** Nessuna azione: finisce in dissesto nel 99% delle partite.

### 4. Variabili che crescono o calano senza limite

Mediane ai turni 25, 50, 75, 100 (anni 2052, 2077, 2102, 2127), tra le partite ancora in corso.

- **ATTENZIONE** Tutto Blu: fondi propri cresce senza rallentare (0,6 → 0,7 → 1,0 → 60,5).
- **ATTENZIONE** Tutto Blu: coscienza cresce senza rallentare (10,2 → 15,1 → 25,7 → 33,4).
- **ATTENZIONE** Tutto Blu: reputazione cresce senza rallentare (10,2 → 15,1 → 25,7 → 33,4).
- **ATTENZIONE** Casuale: fondi propri cresce senza rallentare (5,3 → 104,4 → 421,8 → 995,9).
- **ATTENZIONE** Casuale: imprese dell'indotto cresce senza rallentare (350,0 → 385,0 → 432,9 → 478,9).
- **ATTENZIONE** Casuale: disoccupati cala senza rallentare (15.054,0 → 14.565,0 → 12.019,5 → 9672,5).
- **ATTENZIONE** Casuale: emissioni cresce senza rallentare (45,0 → 54,0 → 63,0 → 71,0).
- **ATTENZIONE** Casuale: coscienza cresce senza rallentare (0,6 → 4,7 → 9,1 → 12,9).
- **ATTENZIONE** Casuale: reputazione cresce senza rallentare (-13,2 → -9,7 → -5,2 → -2,1).
- **ATTENZIONE** Una sola strada: green-steel: fondi propri cresce senza rallentare (15,9 → 425,3 → 747,3 → 1092,1).
- **ATTENZIONE** Una sola strada: remediation: fondi propri cresce senza rallentare (14,4 → 84,0 → 194,9 → 325,5).
- **ATTENZIONE** Una sola strada: remediation: fondo europeo cala senza rallentare (70,0 → 52,0 → 26,0 → 4,0).
- **ATTENZIONE** Una sola strada: energy: fondi propri cresce senza rallentare (22,5 → 31,6 → 53,4 → 91,4).
- **ATTENZIONE** Una sola strada: energy: fondo europeo cala senza rallentare (70,0 → 52,0 → 26,0 → 4,0).
- **ATTENZIONE** Prudente sui conti: fondi propri cresce senza rallentare (16,6 → 33,2 → 148,5 → 383,1).
- **ATTENZIONE** Prudente sui conti: fondo statale cresce senza rallentare (29,9 → 76,9 → 146,5 → 274,6).

### 5. Leve mai usate o sempre convenienti

Nessuna leva è rimasta inutilizzata da tutti i bot.

Confronto nelle partite del bot casuale tra chi ha usato la leva nei primi 10 anni e chi no (per i dilemmi: chi ha scelto un'altra opzione dello stesso dilemma).

- **ATTENZIONE** progetto:lotto-acciaio-verde: sempre conveniente per il bot casuale. Con la leva (686 partite): 58% al 2127, fondi propri 689,6, occupati 60.484, reputazione -6,9. Senza (314): 43%, -1,1, 54.584, -10,0.
- **ATTENZIONE** progetto:lotto-bonifica: sempre conveniente per il bot casuale. Con la leva (711 partite): 57% al 2127, fondi propri 632,3, occupati 60.040, reputazione -6,8. Senza (289): 45%, -0,9, 55.050, -10,0.
- **ATTENZIONE** progetto:lotto-energia: sempre conveniente per il bot casuale. Con la leva (693 partite): 56% al 2127, fondi propri 611,2, occupati 60.181, reputazione -7,3. Senza (307): 49%, -0,2, 55.980, -9,4.
- **ATTENZIONE** progetto:lotto-mare-cultura: sempre conveniente per il bot casuale. Con la leva (681 partite): 57% al 2127, fondi propri 633,2, occupati 60.420, reputazione -6,9. Senza (319): 45%, -0,8, 54.800, -8,9.
- **ATTENZIONE** progetto:risanamento-citta-vecchia: sempre conveniente per il bot casuale. Con la leva (277 partite): 61% al 2127, fondi propri 714,3, occupati 60.962, reputazione -6,6. Senza (723): 50%, 272,1, 58.201, -8,4.
- **ATTENZIONE** progetto:medicina-territorio: sempre conveniente per il bot casuale. Con la leva (309 partite): 62% al 2127, fondi propri 685,9, occupati 61.294, reputazione -5,9. Senza (691): 50%, -0,0, 56.650, -8,5.
- **ATTENZIONE** progetto:centro-ricerca-mare: sempre conveniente per il bot casuale. Con la leva (262 partite): 63% al 2127, fondi propri 877,6, occupati 61.549, reputazione -5,9. Senza (738): 50%, -0,0, 57.074, -9,0.
- **ATTENZIONE** dilemma:polveri-giorni-di-vento/pubblica-con-piano: sempre conveniente per il bot casuale. Con la leva (194 partite): 62% al 2127, fondi propri 764,8, occupati 61.033, reputazione -4,8. Senza (400): 47%, -0,3, 55.623, -10,0.
- **ATTENZIONE** dilemma:affidamento-bonifica/gara-regolare: sempre conveniente per il bot casuale. Con la leva (169 partite): 58% al 2127, fondi propri 670,0, occupati 60.419, reputazione -6,6. Senza (321): 50%, 294,3, 58.190, -8,9.
- **ATTENZIONE** dilemma:rendiconto-fondi-europei/chiedere-proroga: sempre conveniente per il bot casuale. Con la leva (196 partite): 55% al 2127, fondi propri 499,6, occupati 59.410, reputazione -6,6. Senza (288): 44%, -0,8, 55.025, -12,3.
- **ATTENZIONE** dilemma:scuole-giorni-di-vento/spazi-sicuri: sempre conveniente per il bot casuale. Con la leva (103 partite): 57% al 2127, fondi propri 632,3, occupati 59.921, reputazione -5,0. Senza (257): 47%, -0,5, 55.720, -9,1.
- **ATTENZIONE** strada:green-steel: sempre conveniente per il bot casuale. Con la leva (562 partite): 58% al 2127, fondi propri 692,3, occupati 60.807, reputazione -6,7. Senza (438): 47%, -0,5, 55.195, -9,1.
- **ATTENZIONE** strada:remediation: sempre conveniente per il bot casuale. Con la leva (577 partite): 58% al 2127, fondi propri 636,9, occupati 60.210, reputazione -6,7. Senza (423): 48%, -0,4, 55.310, -9,4.
- **ATTENZIONE** strada:sea-culture: sempre conveniente per il bot casuale. Con la leva (570 partite): 57% al 2127, fondi propri 632,9, occupati 60.397, reputazione -6,8. Senza (430): 49%, -0,1, 56.141, -8,5.

Quota di partite in cui ogni leva è stata usata, per bot:

| Leva | blu | red | casuale | strada-green-steel | strada-remediation | strada-energy | strada-sea-culture | prudente | nessuna |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| progetto:lotto-acciaio-verde | 100% | 100% | 93% | 100% | 0% | 0% | 0% | 0% | 0% |
| progetto:lotto-bonifica | 100% | 100% | 93% | 0% | 100% | 0% | 0% | 0% | 0% |
| progetto:lotto-energia | 100% | 99% | 94% | 0% | 0% | 100% | 0% | 0% | 0% |
| progetto:lotto-mare-cultura | 82% | 96% | 93% | 0% | 0% | 0% | 100% | 0% | 0% |
| progetto:risanamento-citta-vecchia | 100% | 100% | 71% | 0% | 0% | 0% | 0% | 41% | 0% |
| progetto:scuole-paolo-vi | 100% | 100% | 72% | 0% | 0% | 0% | 0% | 100% | 0% |
| progetto:medicina-territorio | 79% | 100% | 70% | 0% | 0% | 0% | 0% | 100% | 0% |
| progetto:fascia-verde-tamburi | 0% | 99% | 72% | 0% | 0% | 0% | 0% | 100% | 0% |
| progetto:banchine-logistica | 0% | 94% | 70% | 0% | 0% | 0% | 0% | 51% | 0% |
| progetto:difese-costiere | 0% | 85% | 70% | 0% | 0% | 0% | 0% | 81% | 0% |
| progetto:trasporto-rapido | 0% | 70% | 73% | 0% | 0% | 0% | 0% | 67% | 0% |
| progetto:riqualificazione-talsano | 0% | 35% | 69% | 0% | 0% | 0% | 0% | 100% | 0% |
| progetto:centro-ricerca-mare | 0% | 18% | 69% | 0% | 0% | 0% | 0% | 88% | 0% |
| politica:formazione-riconversione | 100% | 0% | 73% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:dati-aperti-aria | 100% | 0% | 73% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:consulte-quartiere | 100% | 0% | 73% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:integrazione-reddito | 100% | 0% | 72% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:sgravi-indotto | 0% | 0% | 79% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:controlli-appalti | 100% | 0% | 73% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:trasporto-giovani | 100% | 0% | 73% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:piano-caldo | 100% | 0% | 74% | 0% | 0% | 0% | 0% | 0% | 0% |
| dilemma:polveri-giorni-di-vento/pubblica-subito | 98% | 0% | 32% | 34% | 34% | 35% | 34% | 98% | 97% |
| dilemma:polveri-giorni-di-vento/pubblica-con-piano | 0% | 0% | 31% | 35% | 33% | 32% | 33% | 0% | 0% |
| dilemma:polveri-giorni-di-vento/rinvia | 0% | 99% | 30% | 29% | 31% | 32% | 32% | 0% | 0% |
| dilemma:affidamento-bonifica/gara-regolare | 90% | 0% | 28% | 32% | 30% | 33% | 33% | 0% | 89% |
| dilemma:affidamento-bonifica/affidamento-diretto | 0% | 100% | 30% | 32% | 34% | 33% | 32% | 97% | 0% |
| dilemma:affidamento-bonifica/studio-preliminare | 0% | 0% | 32% | 32% | 32% | 33% | 35% | 0% | 0% |
| dilemma:posti-nuovo-polo/selezione-pubblica | 79% | 0% | 69% | 78% | 75% | 86% | 92% | 95% | 89% |
| dilemma:posti-nuovo-polo/lista-segnalata | 0% | 100% | 69% | 70% | 73% | 85% | 94% | 0% | 0% |
| dilemma:posti-nuovo-polo/priorita-ex-lavoratori | 0% | 0% | 70% | 76% | 74% | 84% | 92% | 0% | 0% |
| dilemma:presidio-ai-cancelli/incontrare | 97% | 0% | 54% | 54% | 71% | 79% | 88% | 0% | 95% |
| dilemma:presidio-ai-cancelli/sgomberare | 0% | 83% | 51% | 58% | 73% | 79% | 88% | 0% | 0% |
| dilemma:presidio-ai-cancelli/lasciar-correre | 0% | 0% | 50% | 52% | 72% | 78% | 88% | 97% | 0% |
| dilemma:rendiconto-fondi-europei/dichiarare-ritardo | 87% | 0% | 51% | 80% | 77% | 88% | 28% | 0% | 91% |
| dilemma:rendiconto-fondi-europei/chiedere-proroga | 0% | 0% | 51% | 78% | 79% | 87% | 26% | 0% | 0% |
| dilemma:rendiconto-fondi-europei/spese-anticipate | 0% | 92% | 51% | 82% | 85% | 94% | 27% | 95% | 0% |
| dilemma:scuole-giorni-di-vento/chiudere | 34% | 0% | 12% | 18% | 9% | 10% | 11% | 35% | 38% |
| dilemma:scuole-giorni-di-vento/spazi-sicuri | 0% | 0% | 10% | 23% | 10% | 10% | 10% | 0% | 0% |
| dilemma:scuole-giorni-di-vento/lasciare-aperte | 0% | 34% | 13% | 23% | 11% | 11% | 9% | 0% | 0% |
| strada:green-steel | 100% | 100% | 88% | 100% | 0% | 0% | 0% | 0% | 0% |
| strada:remediation | 100% | 100% | 89% | 0% | 100% | 0% | 0% | 0% | 0% |
| strada:energy | 100% | 99% | 90% | 0% | 0% | 100% | 0% | 0% | 0% |
| strada:sea-culture | 82% | 96% | 89% | 0% | 0% | 0% | 100% | 0% | 0% |

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
