# Bilanciamento

Rapporto dei bot di bilanciamento sui contenuti `0.1-stime` e proposte di
modifica ai valori. Le proposte **non sono applicate**: i valori di
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

## Rapporto di 1.000 partite per bot

1000 partite per bot, semi da 1 a 1000, contenuti veri.

### Errori del motore

**ATTENZIONE** 4 partite interrotte da uno stato non valido; sono escluse da tutte le statistiche.

- Una sola strada: green-steel: 4

Primi casi:

- strada-green-steel, seme 8, turno 20: economy.funds.state = -7.105427357601002e-15: non può essere negativo
- strada-green-steel, seme 541, turno 19: economy.funds.state = -7.105427357601002e-15: non può essere negativo
- strada-green-steel, seme 813, turno 19: economy.funds.state = -7.105427357601002e-15: non può essere negativo
- strada-green-steel, seme 856, turno 20: economy.funds.state = -7.105427357601002e-15: non può essere negativo

### 1. Esiti

Quote calcolate sulle partite giocate fino in fondo.

| Bot | Partite | Al 2127 | In dissesto | Anno mediano del dissesto |
| --- | ---: | ---: | ---: | ---: |
| Tutto Blu | 1000 | 0% | 100% | 2037 |
| Tutto Red | 1000 | 100% | 1% | 2063 |
| Casuale | 1000 | 45% | 56% | 2043 |
| Una sola strada: green-steel | 996 | 6% | 94% | 2058 |
| Una sola strada: remediation | 1000 | 2% | 98% | 2059 |
| Una sola strada: energy | 1000 | 98% | 2% | 2065 |
| Una sola strada: sea-culture | 1000 | 100% | 0% | 2069 |
| Prudente sui conti | 1000 | 55% | 45% | 2056 |
| Nessuna azione | 1000 | 0% | 100% | 2050 |

### 2. Valori mediani a fine partita

Fondi in milioni di euro; lavoro in persone; coscienza e reputazione da -100 a +100.

| Bot | Fondi propri | Fondo statale | Fondo europeo | Fondi privati | Occupati locali | Cassa integrati | Disoccupati | Coscienza | Reputazione | Scandali |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tutto Blu | -3,9 | 0,4 | 136,0 | 0,0 | 52.900 | 6270 | 13.430 | 6,7 | 6,7 | 0,0 |
| Tutto Red | 486,3 | 3968,4 | 3,0 | 0,0 | 57.680 | 0 | 15.720 | -32,0 | -47,0 | 48,0 |
| Casuale | -0,8 | 118,3 | 5,0 | 0,0 | 54.200 | 4180 | 13.392 | 2,3 | -5,9 | 2,0 |
| Una sola strada: green-steel | -4,1 | 9,3 | 72,0 | 0,0 | 52.900 | 6516 | 14.034 | -2,6 | -16,4 | 1,0 |
| Una sola strada: remediation | -3,8 | 135,3 | 6,0 | 0,0 | 53.000 | 6500 | 13.850 | -2,8 | -16,8 | 1,0 |
| Una sola strada: energy | 465,9 | 1295,4 | 28,0 | 0,0 | 55.200 | 4200 | 14.000 | -6,9 | -21,8 | 12,0 |
| Una sola strada: sea-culture | 262,5 | 1822,6 | 2,0 | 0,0 | 57.000 | 3550 | 12.900 | -4,2 | -19,2 | 9,0 |
| Prudente sui conti | 233,0 | 129,8 | 43,0 | 0,0 | 54.500 | 6100 | 12.800 | -4,4 | -19,0 | 10,5 |
| Nessuna azione | -5,9 | 50,0 | 64,0 | 0,0 | 52.550 | 7000 | 13.850 | 3,8 | 3,8 | 0,0 |

Qualità dell'aria (100 = aria pulita) e fiducia, per quartiere:

| Bot | Aria Tamburi | Aria Paolo VI | Aria Città Vecchia | Aria Borgo | Aria Talsano | Aria Area ind. | Fiducia Tamburi | Fiducia Paolo VI | Fiducia Città Vecchia | Fiducia Borgo | Fiducia Talsano | Fiducia Area ind. |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tutto Blu | 35,0 | 50,0 | 55,0 | 60,0 | 70,0 | 20,0 | 29,8 | 29,2 | 30,0 | 40,0 | 45,0 | 15,0 |
| Tutto Red | 34,0 | 50,0 | 55,0 | 60,0 | 70,0 | 20,0 | 12,0 | 28,0 | 30,0 | 40,0 | 45,0 | 15,0 |
| Casuale | 35,0 | 50,0 | 55,0 | 60,0 | 70,0 | 20,0 | 27,0 | 28,0 | 30,0 | 40,0 | 45,0 | 15,0 |
| Una sola strada: green-steel | 35,0 | 50,0 | 55,0 | 60,0 | 70,0 | 20,0 | 21,0 | 25,0 | 30,0 | 40,0 | 45,0 | 15,0 |
| Una sola strada: remediation | 35,0 | 50,0 | 55,0 | 60,0 | 70,0 | 20,0 | 21,0 | 25,0 | 30,0 | 40,0 | 45,0 | 15,0 |
| Una sola strada: energy | 35,0 | 50,0 | 55,0 | 60,0 | 70,0 | 20,0 | 20,0 | 25,0 | 30,0 | 40,0 | 45,0 | 15,0 |
| Una sola strada: sea-culture | 35,0 | 50,0 | 55,0 | 60,0 | 70,0 | 20,0 | 17,0 | 25,0 | 30,0 | 40,0 | 45,0 | 15,0 |
| Prudente sui conti | 38,0 | 50,0 | 55,0 | 60,0 | 70,0 | 20,0 | 28,0 | 28,0 | 30,0 | 40,0 | 45,0 | 15,0 |
| Nessuna azione | 35,0 | 50,0 | 55,0 | 60,0 | 70,0 | 20,0 | 28,0 | 25,0 | 30,0 | 40,0 | 45,0 | 15,0 |

### 3. Bot con lo stesso esito in più del 90% delle partite

- **ATTENZIONE** Tutto Blu: finisce in dissesto nel 100% delle partite.
- **ATTENZIONE** Tutto Red: arriva al 2127 nel 100% delle partite.
- **ATTENZIONE** Una sola strada: green-steel: finisce in dissesto nel 94% delle partite.
- **ATTENZIONE** Una sola strada: remediation: finisce in dissesto nel 98% delle partite.
- **ATTENZIONE** Una sola strada: energy: arriva al 2127 nel 98% delle partite.
- **ATTENZIONE** Una sola strada: sea-culture: arriva al 2127 nel 100% delle partite.
- **ATTENZIONE** Nessuna azione: finisce in dissesto nel 100% delle partite.

### 4. Variabili che crescono o calano senza limite

Mediane ai turni 25, 50, 75, 100 (anni 2052, 2077, 2102, 2127), tra le partite ancora in corso.

- **ATTENZIONE** Tutto Red: fondi propri cresce senza rallentare (37,6 → 168,5 → 328,0 → 486,4).
- **ATTENZIONE** Tutto Red: fondo statale cresce senza rallentare (18,0 → 973,6 → 2471,3 → 3971,3).
- **ATTENZIONE** Casuale: fondi propri cresce senza rallentare (3,2 → 21,3 → 148,3 → 430,7).
- **ATTENZIONE** Casuale: fondo statale cresce senza rallentare (56,5 → 681,3 → 1610,5 → 2527,9).
- **ATTENZIONE** Casuale: imprese dell'indotto cresce senza rallentare (350,0 → 374,0 → 422,0 → 464,0).
- **ATTENZIONE** Casuale: disoccupati cala senza rallentare (14.840,0 → 14.650,0 → 11.880,0 → 9140,0).
- **ATTENZIONE** Casuale: emissioni cresce senza rallentare (42,0 → 49,0 → 59,0 → 65,0).
- **ATTENZIONE** Casuale: coscienza cresce senza rallentare (-2,0 → 1,7 → 6,0 → 9,7).
- **ATTENZIONE** Casuale: reputazione cresce senza rallentare (-15,9 → -12,7 → -8,1 → -5,3).
- **ATTENZIONE** Una sola strada: energy: fondi propri cresce senza rallentare (55,7 → 178,9 → 317,4 → 467,3).
- **ATTENZIONE** Una sola strada: energy: fondo statale cresce senza rallentare (8,5 → 293,2 → 751,9 → 1305,1).
- **ATTENZIONE** Una sola strada: energy: fondo europeo cala senza rallentare (72,0 → 64,0 → 44,0 → 28,0).
- **ATTENZIONE** Una sola strada: sea-culture: fondi propri cresce senza rallentare (56,7 → 105,5 → 174,5 → 262,5).
- **ATTENZIONE** Una sola strada: sea-culture: fondo statale cresce senza rallentare (272,6 → 595,3 → 1113,6 → 1824,5).
- **ATTENZIONE** Prudente sui conti: fondi propri cresce senza rallentare (6,6 → 19,9 → 103,6 → 270,9).
- **ATTENZIONE** Prudente sui conti: fondo statale cresce senza rallentare (32,4 → 61,8 → 99,6 → 243,0).

### 5. Leve mai usate o sempre convenienti

Nessuna leva è rimasta inutilizzata da tutti i bot.

Confronto nelle partite del bot casuale tra chi ha usato la leva nei primi 10 anni e chi no (per i dilemmi: chi ha scelto un'altra opzione dello stesso dilemma).

- **ATTENZIONE** progetto:lotto-bonifica: sempre conveniente per il bot casuale. Con la leva (711 partite): 47% al 2127, fondi propri -0,5, occupati 54.520, reputazione -5,8. Senza (289): 39%, -1,5, 53.680, -5,9.
- **ATTENZIONE** progetto:lotto-energia: sempre conveniente per il bot casuale. Con la leva (692 partite): 49% al 2127, fondi propri -0,1, occupati 55.120, reputazione -5,5. Senza (308): 33%, -2,1, 53.650, -8,5.
- **ATTENZIONE** progetto:lotto-mare-cultura: sempre conveniente per il bot casuale. Con la leva (681 partite): 52% al 2127, fondi propri 66,6, occupati 59.440, reputazione -5,6. Senza (319): 29%, -2,0, 53.520, -7,1.
- **ATTENZIONE** progetto:banchine-logistica: sempre conveniente per il bot casuale. Con la leva (251 partite): 53% al 2127, fondi propri 135,6, occupati 59.800, reputazione -5,5. Senza (749): 42%, -1,0, 53.990, -6,3.
- **ATTENZIONE** progetto:centro-ricerca-mare: sempre conveniente per il bot casuale. Con la leva (262 partite): 57% al 2127, fondi propri 337,5, occupati 60.940, reputazione -4,7. Senza (738): 40%, -1,3, 53.910, -6,9.
- **ATTENZIONE** strada:remediation: sempre conveniente per il bot casuale. Con la leva (577 partite): 48% al 2127, fondi propri -0,4, occupati 54.810, reputazione -5,6. Senza (423): 40%, -1,3, 53.780, -6,3.
- **ATTENZIONE** strada:energy: sempre conveniente per il bot casuale. Con la leva (580 partite): 49% al 2127, fondi propri -0,2, occupati 54.915, reputazione -5,5. Senza (420): 39%, -1,6, 53.720, -6,6.
- **ATTENZIONE** strada:sea-culture: sempre conveniente per il bot casuale. Con la leva (570 partite): 51% al 2127, fondi propri 57,1, occupati 58.460, reputazione -5,5. Senza (430): 37%, -1,5, 53.720, -7,1.

Quota di partite in cui ogni leva è stata usata, per bot:

| Leva | blu | red | casuale | strada-green-steel | strada-remediation | strada-energy | strada-sea-culture | prudente | nessuna |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| progetto:lotto-acciaio-verde | 100% | 100% | 90% | 100% | 0% | 0% | 0% | 0% | 0% |
| progetto:lotto-bonifica | 100% | 100% | 91% | 0% | 100% | 0% | 0% | 0% | 0% |
| progetto:lotto-energia | 24% | 100% | 90% | 0% | 0% | 100% | 0% | 0% | 0% |
| progetto:lotto-mare-cultura | 0% | 100% | 89% | 0% | 0% | 0% | 100% | 0% | 0% |
| progetto:risanamento-citta-vecchia | 100% | 100% | 66% | 0% | 0% | 0% | 0% | 35% | 0% |
| progetto:scuole-paolo-vi | 100% | 100% | 65% | 0% | 0% | 0% | 0% | 100% | 0% |
| progetto:medicina-territorio | 53% | 95% | 65% | 0% | 0% | 0% | 0% | 100% | 0% |
| progetto:fascia-verde-tamburi | 0% | 86% | 66% | 0% | 0% | 0% | 0% | 100% | 0% |
| progetto:banchine-logistica | 0% | 83% | 62% | 0% | 0% | 0% | 0% | 54% | 0% |
| progetto:difese-costiere | 0% | 81% | 63% | 0% | 0% | 0% | 0% | 77% | 0% |
| progetto:trasporto-rapido | 0% | 81% | 66% | 0% | 0% | 0% | 0% | 56% | 0% |
| progetto:riqualificazione-talsano | 0% | 35% | 65% | 0% | 0% | 0% | 0% | 100% | 0% |
| progetto:centro-ricerca-mare | 0% | 35% | 63% | 0% | 0% | 0% | 0% | 93% | 0% |
| politica:formazione-riconversione | 100% | 0% | 65% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:dati-aperti-aria | 100% | 0% | 67% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:consulte-quartiere | 100% | 0% | 68% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:integrazione-reddito | 100% | 0% | 69% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:sgravi-indotto | 0% | 0% | 70% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:controlli-appalti | 100% | 0% | 67% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:trasporto-giovani | 100% | 0% | 68% | 0% | 0% | 0% | 0% | 0% | 0% |
| politica:piano-caldo | 80% | 0% | 67% | 0% | 0% | 0% | 0% | 0% | 0% |
| dilemma:polveri-giorni-di-vento/pubblica-subito | 60% | 0% | 30% | 34% | 33% | 35% | 33% | 98% | 93% |
| dilemma:polveri-giorni-di-vento/pubblica-con-piano | 0% | 0% | 29% | 34% | 32% | 33% | 34% | 0% | 0% |
| dilemma:polveri-giorni-di-vento/rinvia | 0% | 99% | 29% | 29% | 32% | 31% | 32% | 0% | 0% |
| dilemma:affidamento-bonifica/gara-regolare | 49% | 0% | 27% | 30% | 29% | 32% | 33% | 0% | 82% |
| dilemma:affidamento-bonifica/affidamento-diretto | 0% | 100% | 27% | 30% | 32% | 33% | 32% | 92% | 0% |
| dilemma:affidamento-bonifica/studio-preliminare | 0% | 0% | 29% | 31% | 32% | 34% | 36% | 0% | 0% |
| dilemma:posti-nuovo-polo/selezione-pubblica | 34% | 0% | 61% | 58% | 65% | 95% | 100% | 94% | 80% |
| dilemma:posti-nuovo-polo/lista-segnalata | 0% | 100% | 58% | 53% | 65% | 95% | 100% | 0% | 0% |
| dilemma:posti-nuovo-polo/priorita-ex-lavoratori | 0% | 0% | 61% | 58% | 64% | 96% | 100% | 0% | 0% |
| dilemma:presidio-ai-cancelli/incontrare | 49% | 0% | 53% | 61% | 71% | 81% | 89% | 0% | 88% |
| dilemma:presidio-ai-cancelli/sgomberare | 0% | 96% | 46% | 64% | 69% | 80% | 89% | 0% | 0% |
| dilemma:presidio-ai-cancelli/lasciar-correre | 0% | 0% | 48% | 60% | 70% | 81% | 89% | 98% | 0% |
| dilemma:rendiconto-fondi-europei/dichiarare-ritardo | 49% | 0% | 40% | 60% | 42% | 98% | 32% | 0% | 85% |
| dilemma:rendiconto-fondi-europei/chiedere-proroga | 0% | 0% | 37% | 63% | 44% | 98% | 25% | 0% | 0% |
| dilemma:rendiconto-fondi-europei/spese-anticipate | 0% | 82% | 34% | 57% | 35% | 97% | 26% | 90% | 0% |
| dilemma:scuole-giorni-di-vento/chiudere | 49% | 0% | 27% | 29% | 30% | 35% | 33% | 97% | 82% |
| dilemma:scuole-giorni-di-vento/spazi-sicuri | 0% | 0% | 26% | 30% | 30% | 31% | 35% | 0% | 0% |
| dilemma:scuole-giorni-di-vento/lasciare-aperte | 0% | 100% | 31% | 31% | 33% | 34% | 33% | 0% | 0% |
| strada:green-steel | 100% | 100% | 83% | 100% | 0% | 0% | 0% | 0% | 0% |
| strada:remediation | 100% | 100% | 84% | 0% | 100% | 0% | 0% | 0% | 0% |
| strada:energy | 24% | 100% | 85% | 0% | 0% | 100% | 0% | 0% | 0% |
| strada:sea-culture | 0% | 100% | 84% | 0% | 0% | 0% | 100% | 0% | 0% |

## Che cosa dice il rapporto

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

## Errore del motore trovato

In 4 partite su 9.000 (tutte del bot "una sola strada: acciaio verde") il motore
produce un fondo statale negativo di -7·10⁻¹⁵, cioè un errore di arrotondamento.
Il punto è `payMandatorySpending` in `packages/sim/src/economy.ts`: il numero di
cassa integrati coperti è `floor(fondo / costo)`, ma il prodotto `coperti × costo`
in virgola mobile può superare il fondo di un'inezia (per esempio 63 / 0,009 dà
7000,000…1 e 7000 × 0,009 dà 63,000…01). Le quattro partite sono escluse dalle
statistiche e il rapporto le elenca. La correzione spetta a `sim-engineer`: questo
task non può toccare `packages/sim`.

## Esperimenti sulle proposte

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

## Proposte di modifica ai valori, in ordine di importanza

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

## Richieste al motore (fuori da questo task)

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
