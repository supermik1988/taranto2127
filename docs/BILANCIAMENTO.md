# Bilanciamento

Rapporto dei bot di bilanciamento sui contenuti `0.1-stime`, aggiornato al motore
del T07, e proposte di modifica ai valori. Le proposte **non sono applicate**: i valori di
`packages/content` restano quelli attuali finché l'architetto non decide.

## Come si rifà

```sh
pnpm balance -- --partite 1000              # tutti i bot, semi da 1 a 1000
pnpm balance -- --partite 200 --bot red     # un solo bot
pnpm balance -- --partite 1000 --uscita rapporto.md --thread 7
```

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

## Situazione dopo il T07

Il motore ora fa reagire la città: aria, esposizione, salute, servizi, tensione e
fiducia cambiano ogni anno, gli scandali hanno conseguenze, il senso civico pesa
sulle entrate, e la città può voltarsi. **I valori dei contenuti non sono stati
toccati** in questa fase: le proposte del T06 restano in sospeso (vedi in fondo).
I nuovi coefficienti di `citta.json` sono stime dichiarate, tarate solo perché
all'inizio la città sia vicina all'equilibrio (fiducia e salute di partenza).

1.000 partite per bot, semi da 1 a 1.000: **nessuna partita interrotta** (l'errore
di arrotondamento della cassa integrazione è corretto).

### Distanza dagli obiettivi di arrivo al 2127

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

### Che cosa è cambiato rispetto al T06

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

### Prossimo passo suggerito

Ricalcolare le proposte del T06 sul motore nuovo prima di applicarle. La leva più
forte resta il disavanzo strutturale (costo dei servizi rispetto alle entrate di
partenza): con il T07 un disavanzo innesca anche la spirale servizi-fiducia-entrate,
quindi la soglia è ancora più netta di prima.

## Rapporto di 1.000 partite per bot (motore del T07)

1000 partite per bot, semi da 1 a 1000, contenuti veri.

### 1. Esiti

Quote calcolate sulle partite giocate fino in fondo.

| Bot | Partite | Al 2127 | In dissesto | Città che si volta | Anno mediano del dissesto |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tutto Blu | 1000 | 0% | 100% | 0% | 2037 |
| Tutto Red | 1000 | 0% | 100% | 0% | 2047 |
| Casuale | 1000 | 16% | 85% | 0% | 2044 |
| Una sola strada: green-steel | 1000 | 1% | 100% | 0% | 2053 |
| Una sola strada: remediation | 1000 | 0% | 100% | 0% | 2054 |
| Una sola strada: energy | 1000 | 84% | 16% | 0% | 2058 |
| Una sola strada: sea-culture | 1000 | 86% | 14% | 0% | 2074 |
| Prudente sui conti | 1000 | 0% | 100% | 0% | 2050 |
| Nessuna azione | 1000 | 0% | 100% | 0% | 2050 |

### 2. Valori mediani a fine partita

Fondi in milioni di euro; lavoro in persone; coscienza e reputazione da -100 a +100.

| Bot | Fondi propri | Fondo statale | Fondo europeo | Fondi privati | Occupati locali | Cassa integrati | Disoccupati | Coscienza | Reputazione | Scandali |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tutto Blu | -3,9 | 0,4 | 134,0 | 0,0 | 52.900 | 6270 | 13.430 | 6,7 | 6,7 | 0,0 |
| Tutto Red | -13,5 | 28,4 | 4,0 | 0,0 | 54.370 | 3386 | 15.490 | -24,2 | -38,5 | 6,0 |
| Casuale | -3,5 | 57,3 | 32,0 | 0,0 | 53.700 | 4950 | 14.129 | 0,4 | -12,9 | 1,0 |
| Una sola strada: green-steel | -6,6 | 7,7 | 68,0 | 0,0 | 52.850 | 6600 | 14.000 | -1,4 | -15,4 | 1,0 |
| Una sola strada: remediation | -6,7 | 134,0 | 2,0 | 0,0 | 52.950 | 6600 | 13.850 | -1,7 | -15,8 | 1,0 |
| Una sola strada: energy | 261,8 | 300,0 | 0,0 | 0,0 | 55.350 | 4108 | 14.000 | -4,8 | -19,7 | 10,0 |
| Una sola strada: sea-culture | 152,1 | 300,0 | 2,0 | 0,0 | 56.950 | 3600 | 12.900 | -3,8 | -18,6 | 9,0 |
| Prudente sui conti | -8,1 | 42,5 | 60,0 | 0,0 | 53.050 | 6670 | 13.680 | -3,0 | -17,6 | 2,0 |
| Nessuna azione | -5,6 | 50,0 | 64,0 | 0,0 | 52.700 | 7000 | 13.700 | 3,6 | 3,6 | 0,0 |

Qualità dell'aria (100 = aria pulita) e fiducia, per quartiere:

| Bot | Aria Tamburi | Aria Paolo VI | Aria Città Vecchia | Aria Borgo | Aria Talsano | Aria Area ind. | Fiducia Tamburi | Fiducia Paolo VI | Fiducia Città Vecchia | Fiducia Borgo | Fiducia Talsano | Fiducia Area ind. |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tutto Blu | 55,0 | 71,7 | 75,3 | 77,4 | 82,0 | 44,4 | 34,0 | 36,1 | 35,2 | 40,8 | 43,7 | 26,9 |
| Tutto Red | 62,3 | 77,2 | 79,9 | 81,4 | 84,4 | 54,5 | 12,6 | 19,2 | 19,0 | 22,8 | 24,9 | 12,3 |
| Casuale | 57,3 | 75,4 | 78,8 | 80,5 | 84,2 | 48,4 | 30,1 | 32,2 | 32,4 | 36,6 | 38,9 | 25,5 |
| Una sola strada: green-steel | 63,4 | 77,9 | 80,7 | 82,0 | 84,8 | 56,3 | 28,0 | 31,3 | 32,1 | 35,2 | 37,1 | 25,7 |
| Una sola strada: remediation | 63,7 | 78,1 | 80,8 | 82,1 | 84,8 | 56,7 | 28,0 | 31,2 | 32,0 | 35,2 | 37,0 | 25,7 |
| Una sola strada: energy | 81,5 | 83,9 | 84,3 | 84,5 | 85,0 | 80,3 | 29,4 | 32,1 | 33,4 | 34,5 | 35,1 | 26,5 |
| Una sola strada: sea-culture | 79,7 | 83,4 | 83,6 | 84,0 | 85,0 | 75,8 | 32,0 | 34,6 | 35,9 | 36,7 | 37,2 | 29,0 |
| Prudente sui conti | 56,7 | 75,6 | 79,2 | 80,9 | 84,6 | 47,1 | 28,4 | 31,0 | 29,8 | 33,5 | 35,6 | 23,2 |
| Nessuna azione | 56,5 | 75,6 | 79,2 | 80,9 | 84,6 | 47,1 | 34,0 | 35,8 | 36,6 | 39,9 | 41,8 | 30,0 |

### 3. Bot con lo stesso esito in più del 90% delle partite

- **ATTENZIONE** Tutto Blu: finisce in dissesto nel 100% delle partite.
- **ATTENZIONE** Tutto Red: finisce in dissesto nel 100% delle partite.
- **ATTENZIONE** Una sola strada: green-steel: finisce in dissesto nel 100% delle partite.
- **ATTENZIONE** Una sola strada: remediation: finisce in dissesto nel 100% delle partite.
- **ATTENZIONE** Prudente sui conti: finisce in dissesto nel 100% delle partite.
- **ATTENZIONE** Nessuna azione: finisce in dissesto nel 100% delle partite.

### 4. Variabili che crescono o calano senza limite

Mediane ai turni 25, 50, 75, 100 (anni 2052, 2077, 2102, 2127), tra le partite ancora in corso.

- **ATTENZIONE** Una sola strada: energy: fondi propri cresce senza rallentare (44,8 → 120,0 → 196,1 → 285,3).
- **ATTENZIONE** Una sola strada: sea-culture: fondi propri cresce senza rallentare (48,4 → 70,8 → 110,2 → 171,0).

### 5. Leve mai usate o sempre convenienti

Nessuna leva è rimasta inutilizzata da tutti i bot.

Confronto nelle partite del bot casuale tra chi ha usato la leva nei primi 10 anni e chi no (per i dilemmi: chi ha scelto un'altra opzione dello stesso dilemma).

- **ATTENZIONE** progetto:lotto-bonifica: sempre conveniente per il bot casuale. Con la leva (711 partite): 17% al 2127, fondi propri -3,4, occupati 53.790, reputazione -12,9. Senza (289): 11%, -3,9, 53.490, -13,0.
- **ATTENZIONE** progetto:lotto-energia: sempre conveniente per il bot casuale. Con la leva (692 partite): 18% al 2127, fondi propri -3,2, occupati 53.820, reputazione -12,8. Senza (308): 9%, -4,1, 53.495, -13,4.
- **ATTENZIONE** progetto:trasporto-rapido: sempre conveniente per il bot casuale. Con la leva (298 partite): 19% al 2127, fondi propri -3,3, occupati 53.820, reputazione -12,8. Senza (702): 14%, -3,5, 53.660, -12,9.
- **ATTENZIONE** progetto:centro-ricerca-mare: sempre conveniente per il bot casuale. Con la leva (262 partite): 24% al 2127, fondi propri -2,8, occupati 53.828, reputazione -11,9. Senza (738): 12%, -3,8, 53.670, -13,0.
- **ATTENZIONE** dilemma:affidamento-bonifica/gara-regolare: sempre conveniente per il bot casuale. Con la leva (168 partite): 19% al 2127, fondi propri -2,9, occupati 53.810, reputazione -11,8. Senza (321): 10%, -4,1, 53.700, -14,0.
- **ATTENZIONE** dilemma:rendiconto-fondi-europei/chiedere-proroga: sempre conveniente per il bot casuale. Con la leva (195 partite): 16% al 2127, fondi propri -3,3, occupati 53.730, reputazione -11,6. Senza (287): 10%, -4,1, 53.650, -14,2.
- **ATTENZIONE** strada:energy: sempre conveniente per il bot casuale. Con la leva (580 partite): 18% al 2127, fondi propri -3,2, occupati 53.830, reputazione -12,8. Senza (420): 12%, -3,8, 53.550, -13,2.

Quota di partite in cui ogni leva è stata usata, per bot:

| Leva | blu | red | casuale | strada-green-steel | strada-remediation | strada-energy | strada-sea-culture | prudente | nessuna |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| progetto:lotto-acciaio-verde | 100% | 100% | 86% | 100% | 0% | 0% | 0% | 0% | 0% |
| progetto:lotto-bonifica | 100% | 100% | 87% | 0% | 100% | 0% | 0% | 0% | 0% |
| progetto:lotto-energia | 25% | 99% | 86% | 0% | 0% | 100% | 0% | 0% | 0% |
| progetto:lotto-mare-cultura | 0% | 91% | 85% | 0% | 0% | 0% | 100% | 0% | 0% |
| progetto:risanamento-citta-vecchia | 100% | 100% | 50% | 0% | 0% | 0% | 0% | 0% | 0% |
| progetto:scuole-paolo-vi | 100% | 100% | 51% | 0% | 0% | 0% | 0% | 97% | 0% |
| progetto:medicina-territorio | 53% | 89% | 52% | 0% | 0% | 0% | 0% | 100% | 0% |
| progetto:fascia-verde-tamburi | 0% | 55% | 51% | 0% | 0% | 0% | 0% | 100% | 0% |
| progetto:banchine-logistica | 0% | 24% | 49% | 0% | 0% | 0% | 0% | 0% | 0% |
| progetto:difese-costiere | 0% | 6% | 49% | 0% | 0% | 0% | 0% | 35% | 0% |
| progetto:trasporto-rapido | 0% | 1% | 52% | 0% | 0% | 0% | 0% | 5% | 0% |
| progetto:riqualificazione-talsano | 0% | 0% | 50% | 0% | 0% | 0% | 0% | 100% | 0% |
| progetto:centro-ricerca-mare | 0% | 0% | 48% | 0% | 0% | 0% | 0% | 63% | 0% |
| politica:formazione-riconversione | 100% | 0% | 51% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:dati-aperti-aria | 100% | 0% | 53% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:consulte-quartiere | 100% | 0% | 52% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:integrazione-reddito | 100% | 0% | 52% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:sgravi-indotto | 0% | 0% | 54% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:controlli-appalti | 100% | 0% | 51% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:trasporto-giovani | 100% | 0% | 51% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:piano-caldo | 80% | 0% | 53% | 0% | 0% | 0% | 0% | 0% | 0% |
| dilemma:polveri-giorni-di-vento/pubblica-subito | 61% | 0% | 30% | 33% | 33% | 35% | 34% | 91% | 94% |
| dilemma:polveri-giorni-di-vento/pubblica-con-piano | 0% | 0% | 28% | 33% | 33% | 32% | 33% | 0% | 0% |
| dilemma:polveri-giorni-di-vento/rinvia | 0% | 87% | 27% | 28% | 31% | 32% | 32% | 0% | 0% |
| dilemma:affidamento-bonifica/gara-regolare | 51% | 0% | 25% | 30% | 28% | 33% | 33% | 0% | 83% |
| dilemma:affidamento-bonifica/affidamento-diretto | 0% | 80% | 25% | 29% | 33% | 33% | 32% | 84% | 0% |
| dilemma:affidamento-bonifica/studio-preliminare | 0% | 0% | 28% | 29% | 31% | 33% | 35% | 0% | 0% |
| dilemma:posti-nuovo-polo/selezione-pubblica | 36% | 0% | 43% | 50% | 58% | 91% | 97% | 80% | 84% |
| dilemma:posti-nuovo-polo/lista-segnalata | 0% | 77% | 43% | 47% | 63% | 90% | 98% | 0% | 0% |
| dilemma:posti-nuovo-polo/priorita-ex-lavoratori | 0% | 0% | 44% | 51% | 58% | 90% | 97% | 0% | 0% |
| dilemma:presidio-ai-cancelli/incontrare | 51% | 0% | 45% | 53% | 60% | 80% | 90% | 0% | 89% |
| dilemma:presidio-ai-cancelli/sgomberare | 0% | 82% | 40% | 59% | 65% | 80% | 89% | 0% | 0% |
| dilemma:presidio-ai-cancelli/lasciar-correre | 0% | 0% | 42% | 55% | 64% | 80% | 89% | 86% | 0% |
| dilemma:rendiconto-fondi-europei/dichiarare-ritardo | 50% | 0% | 36% | 54% | 39% | 92% | 28% | 0% | 86% |
| dilemma:rendiconto-fondi-europei/chiedere-proroga | 0% | 0% | 35% | 55% | 36% | 90% | 26% | 0% | 0% |
| dilemma:rendiconto-fondi-europei/spese-anticipate | 0% | 78% | 34% | 54% | 36% | 96% | 27% | 87% | 0% |
| dilemma:scuole-giorni-di-vento/chiudere | 34% | 0% | 12% | 9% | 9% | 10% | 11% | 35% | 38% |
| dilemma:scuole-giorni-di-vento/spazi-sicuri | 0% | 0% | 10% | 12% | 10% | 10% | 10% | 0% | 0% |
| dilemma:scuole-giorni-di-vento/lasciare-aperte | 0% | 30% | 13% | 12% | 11% | 11% | 9% | 0% | 0% |
| strada:green-steel | 100% | 100% | 78% | 100% | 0% | 0% | 0% | 0% | 0% |
| strada:remediation | 100% | 100% | 79% | 0% | 100% | 0% | 0% | 0% | 0% |
| strada:energy | 25% | 99% | 78% | 0% | 0% | 100% | 0% | 0% | 0% |
| strada:sea-culture | 0% | 91% | 77% | 0% | 0% | 0% | 100% | 0% | 0% |

## Analisi e proposte del T06 (in sospeso)

Quanto segue è stato calcolato **prima del T07**, sul motore senza dinamica dei quartieri e senza conseguenze degli scandali. I numeri degli esperimenti non valgono più e vanno ricalcolati; le proposte restano come traccia, nessuna è stata applicata.

### Che cosa dice il rapporto

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

### Errore del motore trovato (corretto nel T07)

In 4 partite su 9.000 (tutte del bot "una sola strada: acciaio verde") il motore
produce un fondo statale negativo di -7·10⁻¹⁵, cioè un errore di arrotondamento.
Il punto è `payMandatorySpending` in `packages/sim/src/economy.ts`: il numero di
cassa integrati coperti è `floor(fondo / costo)`, ma il prodotto `coperti × costo`
in virgola mobile può superare il fondo di un'inezia (per esempio 63 / 0,009 dà
7000,000…1 e 7000 × 0,009 dà 63,000…01). Le quattro partite sono escluse dalle
statistiche e il rapporto le elenca. La correzione spetta a `sim-engineer`: questo
task non può toccare `packages/sim`.

### Esperimenti sulle proposte

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

### Proposte di modifica ai valori, in ordine di importanza

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

### Richieste al motore (fuori da questo task)

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
