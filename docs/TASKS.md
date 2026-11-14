# Schede dei task — tappe M0 e M1

Ogni scheda si passa così com'è a un agente. Un agente lavora solo sui file
elencati. Ordine: T01, poi T02, poi T03 e T05a in parallelo, poi T04, poi T06.

---

## T01 — Struttura del progetto

- **Agente:** `sim-engineer` (Claude Code)
- **Obiettivo:** creare il repository vuoto ma funzionante.
- **File:** radice del progetto, `packages/*/package.json`, configurazioni.
- **Cosa fare:** monorepo pnpm con TypeScript in modalità `strict` e Vitest.
  Creare i pacchetti `sim`, `agents`, `content`, `voices`, `tools/balance`,
  ciascuno con un test di esempio. Copiare `CLAUDE.md`, `docs/` e
  `packages/sim/src/state.ts` forniti dall'architetto senza modificarli. Non
  toccare `LICENSE`, `LICENSE-CONTENUTI`, `LICENZE.md`, `.gitignore`. Indicare
  `"license": "AGPL-3.0-only"` in ogni `package.json`.
- **Fatto quando:** `pnpm install && pnpm typecheck && pnpm test` passano da un
  clone pulito; `git status` non mostra mai un file `.env`; una regola di lint vieta `Math.random` e `Date.now` in `sim` e `agents`.

## T02 — Stato iniziale e validazione

- **Agente:** `sim-engineer`
- **Dipende da:** T01
- **File:** `packages/sim/src/init.ts`, `packages/sim/src/validate.ts`, test.
- **Cosa fare:** `createInitialState(seed, content)` costruisce un `GameState`
  dai file di dati. `validateState(state)` controlla che gli indici stiano tra 0
  e 100, le popolazioni non siano negative, la coscienza stia tra -100 e +100.
- **Fatto quando:** lo stato iniziale passa la validazione; un test per ogni
  regola di validazione fallisce se la regola viene violata.

## T03 — Ciclo del turno ed effetti ritardati

- **Agente:** `sim-engineer`
- **Dipende da:** T02
- **File:** `packages/sim/src/turn.ts`, `rng.ts`, `effects.ts`, test.
- **Cosa fare:** generatore casuale con seme (`rng.ts`). `applyAction(state,
  action)` e `advanceTurn(state)` sono funzioni pure: restituiscono un nuovo
  stato. `advanceTurn` applica gli effetti in scadenza, fa avanzare i lotti di
  ILSIDER e le fasi dei progetti (`projects`), aggiorna il clima secondo lo
  scenario, chiude la partita al turno 100. Un progetto passa alla fase
  successiva solo quando `turnsLeftInPhase` arriva a zero; i ritardi lo allungano.
  Massimo 3 azioni libere per turno.
- **Fatto quando:** stesso seme e stessa storia producono uno stato identico
  byte per byte (test); un effetto con ritardo di 5 turni compare esattamente al
  turno previsto; un progetto con fasi di 1, 2, 1 e 4 anni entra in esercizio
  esattamente 8 turni dopo l'avvio e non produce effetti prima; 100 turni senza azioni
  terminano con `ended-2127`.

## T04 — Contatore morale

- **Agente:** `sim-engineer`
- **Dipende da:** T03c
- **File:** `packages/sim/src/moral.ts`, `turn.ts`, test; `state.ts` solo per
  le aggiunte indispensabili, elencate nel resoconto. Numeri dai dati (regola 4).
- **Cosa fare:**
  1. *Dilemmi dai dati.* `rules.dilemmas`: ogni opzione ha effetti immediati,
     effetti ritardati, pesi morali per dimensione (verità, parola, cura,
     legalità, ascolto), un indicatore "nascosta" e una eventuale promessa.
     `answer-dilemma` applica l'opzione scelta. Opzione inesistente: errore.
  2. *Coscienza e reputazione.* Un atto palese muove entrambe. Un atto nascosto
     muove solo la coscienza e finisce in `hiddenActs`. La coscienza è la media
     pesata delle cinque dimensioni, con pesi dai dati.
  3. *Scandalo.* A ogni turno, per ogni atto nascosto, probabilità di scoperta
     dai dati, crescente con lo scarto tra reputazione e coscienza. Quando un
     atto viene scoperto esce da `hiddenActs` e la reputazione scende sotto la
     coscienza di una quantità presa dai dati. Estrazione con `rngFor`.
  4. *Scorciatoia.* Nuova azione `shortcut-phase { projectId }`: salta la fase
     in corso se è `permitting` o `tender`, segna `shortcutTaken` e registra un
     atto nascosto sulla dimensione legalità. Conta come azione libera.
  5. *Promesse.* Una promessa nata da un dilemma può avere una condizione
     `{ target, comparator, value }`. Alla scadenza: condizione vera = `kept`,
     falsa = `broken`. Entrambe muovono la dimensione parola, in modo palese.
     Le promesse a testo libero senza condizione restano `open`: le valuteranno
     le voci in un task successivo.
  6. *Regola 5 di CLAUDE.md.* Nessuna azione `convert-lot` o `start-project`
     muove il contatore, qualunque strada o progetto si scelga.
- **Fatto quando:** un test dimostra il punto 6 su tutte le strade; un atto
  nascosto lascia ferma la reputazione; con dieci atti nascosti lo scandalo
  arriva entro 20 turni in almeno il 95% di 1.000 semi, con i dati di prova;
  dopo uno scandalo la reputazione è sotto la coscienza; saltare una fase fa
  guadagnare esattamente gli anni di quella fase; una promessa con condizione
  diventa `kept` o `broken` nel turno di scadenza; stessa partita identica a
  parità di seme e storia; stato sempre valido in 100 turni di gioco casuale.

## T05a — Contenuti di gioco con stime dichiarate

- **Agente:** `content-designer`
- **Dipende da:** T04b
- **File:** `packages/content/`, `docs/CONTENUTI.md`. Non si modifica `packages/sim`.
- **Cosa fare:**
  1. *Schema e caricatore.* I contenuti stanno in file JSON in
     `packages/content`, con uno schema validato. Un caricatore restituisce
     `InitialContent` e `TurnRules` esattamente nella forma che `packages/sim`
     si aspetta.
  2. Ogni valore numerico porta accanto `"stima": true` e una riga di
     motivazione, oppure una `"fonte"`. In T05a sono ammesse solo stime: non si
     inventano fonti, indirizzi o citazioni. `calibrationVersion: "0.1-stime"`.
  3. *Contenuti minimi:* i sei quartieri; lavoro, economia e clima di partenza;
     scenario climatico per le cinque epoche; sei lotti di ILSIDER; sei
     consiglieri con nomi inventati, uno per visione; almeno dodici progetti,
     compresi quelli delle quattro strade dei lotti; otto politiche, di cui una
     di formazione; sei dilemmi; parametri morali ed economici.
  4. Testi in italiano, tono sobrio (regola 8). Luoghi reali; persone, sigle,
     aziende e stabilimento inventati (regola 6). Nessuna morte o malattia usata
     come punteggio. Ogni dilemma ha almeno un'opzione scorretta con un
     vantaggio vero e un'opzione corretta con un prezzo vero. Nessuna strada di
     riconversione è presentata come giusta o sbagliata in sé (regola 5).
  5. Durate dei progetti plausibili e in anni interi, con minimo e massimo per
     fase. Sono stime: le verificherà T05b su casi reali.
  6. `docs/CONTENUTI.md`: per ogni indice da 0 a 100, cosa rappresenta e come si
     leggerà il dato reale che lo sostituirà.
- **Fatto quando:** i file passano lo schema; lo stato iniziale costruito dai
  contenuti veri passa `validateState`; 100 turni di gioco casuale su 20 semi
  con i contenuti veri restano validi, con forza lavoro costante; almeno una
  partita casuale su 20 arriva al 2127 e almeno una finisce in dissesto, oppure
  il resoconto spiega perché no; nessun valore numerico è privo di `stima` o
  `fonte` (test); la stessa partita è identica a parità di seme e storia.

## T05b — Verifica delle fonti

- **Agenti:** `fact-checker`, con `content-designer` per le correzioni
- **Dipende da:** T05a
- **Stato:** scheda da scrivere dopo T05a, quando sarà chiaro quali stime
  pesano di più sull'andamento delle partite.
- **Traccia:** sostituire le stime con dati reali dotati di `fonte` (indirizzo
  e data di consultazione), a partire dai quartieri (ISTAT, ARPA Puglia, studi
  epidemiologici pubblici) e dalle durate delle fasi dei progetti (casi reali
  comparabili in Italia o in Europa); `docs/FONTI.md` firmato da chi ha aperto
  ogni fonte.

## T06 — Bot di bilanciamento

- **Agente:** `balance-tester`
- **Dipende da:** T05c
- **File:** `tools/balance/`, `docs/BILANCIAMENTO.md`. Non si modificano
  `packages/sim` né i valori in `packages/content`: si propone, non si cambia.
- **Cosa fare:**
  1. Comando `pnpm balance -- --partite N` che gioca N partite per ciascun bot
     con i contenuti veri e stampa un rapporto.
  2. Sei bot: tutto Blu; tutto Red; casuale; una sola strada per ciascuna delle
     quattro (acciaio verde, bonifica, energia, mare e cultura), anche come un
     unico bot parametrico; prudente sui conti; nessuna azione.
  3. Per ogni bot: quota di partite arrivate al 2127 e in dissesto, anno mediano
     del dissesto, e al termine i valori mediani di fondi, occupati locali, cassa
     integrati, disoccupati, coscienza, reputazione, qualità dell'aria e fiducia
     per quartiere, numero di scandali.
  4. Segnalare in evidenza: ogni bot con lo stesso esito in più del 90% delle
     partite; ogni variabile che cresce o cala senza limite; ogni leva (progetto,
     politica, opzione di dilemma) mai usata o sempre conveniente.
  5. `docs/BILANCIAMENTO.md`: il rapporto di 1.000 partite per bot e un elenco
     ordinato di proposte di modifica ai valori, ognuna con il problema che
     risolve e l'effetto atteso.
- **Fatto quando:** 1.000 partite per bot terminano senza errori; il rapporto è
  identico a parità di seme; il test del comando gira su poche partite in pochi
  secondi; il rapporto contiene i cinque gruppi di informazioni sopra.

---

## T07 — Interfaccia delle decisioni e cervello a regole

- **Agente:** `citizen-engineer`
- **Dipende da:** T03
- **File:** `packages/agents/src/decision/`.
- **Cosa fare:** interfaccia `DecisionProvider` con un solo metodo: riceve un
  soggetto (gruppo di cittadini o consigliere), il suo stato e un elenco chiuso
  di opzioni; restituisce una probabilità per opzione. La scelta finale la
  estrae sempre il motore con il generatore a seme. Implementare `RulesProvider`.
  Predisporre, senza implementarli, i due provider sperimentali.
- **Fatto quando:** il motore non importa mai un provider concreto; con
  `RulesProvider` la partita resta identica a parità di seme; un provider finto
  non deterministico produce una partita rigiocabile identica grazie a
  `recordedDecisions` (test).

## T08 — Consenso e archivio anonimo delle partite

- **Agente:** `voice-engineer` per il server, architetto per lo schema
- **Dipende da:** T03
- **File:** `apps/server/src/research/`, `docs/RICERCA.md`.
- **Cosa fare:** schema del record di partita donata: seme, versione dei dati,
  storia delle azioni, risposte ai dilemmi, finale, eventuali risposte ai
  questionari prima e dopo. Nessun nome, indirizzo di rete, posizione o
  identificativo del dispositivo. Il record parte solo se `researchConsent` è vero.
- **Fatto quando:** un test dimostra che senza consenso non parte alcuna
  richiesta; il record ricevuto basta a rigiocare la partita; `docs/RICERCA.md`
  elenca ogni campo raccolto e il motivo.

---

## T03b — Economia e cantieri dei progetti

- **Agente:** `sim-engineer`
- **Dipende da:** T03
- **File:** `packages/sim/src/turn.ts`, `effects.ts`, `limits.ts`, `index.ts`,
  `state.ts` (solo aggiunte indispensabili, elencate nel resoconto), test e dati
  di prova in `packages/sim/src/__fixtures__/`.
- **Cosa fare:**
  1. *Lotti come progetti.* `convert-lot` avvia un progetto legato al lotto,
     con la definizione indicata in `rules` per ciascuna strada. Sparisce
     `lotConversionTurns`. `lot.progress` è la quota di anni trascorsi sul
     totale previsto; `remediated` diventa vero quando un progetto di bonifica
     entra in esercizio. Cambiare strada annulla il progetto in corso sul lotto.
  2. *Costi.* Ogni fase ha nei dati un costo annuo e un tipo di fondo. A ogni
     turno il costo si scala dal fondo, entro `economy.spendingCapacity`
     complessiva del turno.
  3. *Ritardi deterministici.* Se fondi o capacità di spesa non bastano, la
     fase non avanza in quel turno e `delayTurns` cresce di 1. I progetti si
     servono in ordine di avvio. `delayProject` resta interno al motore e non
     si esporta.
  4. *Lavoro di cantiere.* Durante la fase `works` il progetto aggiunge
     occupati al settore indicato nei dati, e li toglie quando la fase finisce.
  5. *Effetti di esercizio.* Due elenchi nei dati: una volta sola all'entrata
     in esercizio, e ricorrenti ogni anno finché il progetto è in esercizio.
- **Fatto quando:** un progetto senza fondi resta fermo e accumula ritardo, e
  riparte quando i fondi tornano; con capacità di spesa per un solo progetto,
  due progetti avanzano uno alla volta in ordine di avvio; gli occupati di
  cantiere compaiono solo durante `works`; un effetto ricorrente si applica ogni
  anno e mai prima dell'esercizio; la partita resta identica a parità di seme e
  storia; 100 turni di gioco casuale lasciano lo stato sempre valido.

---

## T03c — Lavoro ed entrate

- **Agente:** `sim-engineer`
- **Dipende da:** T03b
- **File:** `packages/sim/src/turn.ts`, `init.ts`, `index.ts`, `state.ts` (solo
  aggiunte indispensabili, elencate nel resoconto), test e dati di prova in
  `packages/sim/src/__fixtures__/`. Tutti i numeri vengono da `rules`.
- **Cosa fare:**
  1. *Lavoro come bilancio chiuso.* La forza lavoro è la somma di occupati,
     cassa integrati, disoccupati e persone in formazione, e cambia solo per
     regole esplicite. Un cantiere assume prima dai cassa integrati, poi dai
     disoccupati. Se non bastano, la parte mancante viene da fuori città: la
     fase avanza lo stesso, ma quei posti non entrano negli occupati locali. A
     fine lavori gli assunti locali tornano disoccupati.
  2. *Cantiere fermo.* Negli anni in cui la fase `works` non avanza per
     mancanza di fondi o capacità, i suoi assunti locali passano in cassa
     integrazione e rientrano quando il cantiere riparte.
  3. *Entrate annuali.* Nei dati: entrate proprie proporzionali a occupati
     locali e reddito medio; trasferimenti statali annui; rate dei fondi europei
     con anno di arrivo e anno di scadenza. La parte di una rata non spesa alla
     scadenza viene tolta dal fondo.
  4. *Spese obbligate annuali.* Nei dati: costo annuo per cassa integrato, dal
     fondo statale; costo annuo dei servizi, dai fondi propri. Le spese
     obbligate possono portare i fondi propri in disavanzo. Se il fondo statale
     non copre la cassa, la parte scoperta dei cassa integrati diventa
     disoccupata.
  5. *Dissesto.* Dopo un numero di anni consecutivi di disavanzo dei fondi
     propri, preso dai dati, la partita termina con `ended-bankrupt`.
  6. *Ordine nel turno:* entrate, spese obbligate, progetti, clima, effetti.
- **Fatto quando:** la forza lavoro totale resta costante in 100 turni di gioco
  casuale; un cantiere con 30 posti e 10 persone disponibili ne assume 10 e
  avanza comunque; un cantiere fermo sposta i suoi assunti in cassa e li
  riprende alla ripartenza; meno occupati locali producono meno entrate proprie
  l'anno dopo; una rata europea non spesa scade nell'anno previsto; il
  disavanzo prolungato chiude la partita con `ended-bankrupt`; stessa partita
  identica a parità di seme e storia; stato sempre valido.

---

## T04b — Dilemmi in arrivo e politiche

- **Agente:** `sim-engineer`
- **Dipende da:** T04
- **File:** `packages/sim/src/turn.ts`, `moral.ts`, `init.ts`, `index.ts`,
  `state.ts` (solo aggiunte indispensabili, elencate nel resoconto), test e dati
  di prova in `packages/sim/src/__fixtures__/`. Numeri dai dati (regola 4).
- **Cosa fare:**
  1. *Arrivo dei dilemmi.* Ogni dilemma ha nei dati: condizioni di comparsa
     sullo stato (come `PromiseCondition`, tutte da soddisfare), primo e ultimo
     turno ammesso, peso di estrazione, e se è ripetibile. All'apertura di ogni
     turno il motore decide con `rngFor` se arriva un dilemma (probabilità annua
     dai dati) e quale, tra quelli ammessi. Al massimo uno aperto.
  2. *Dilemma aperto.* Sta nello stato. `advanceTurn` rifiuta di avanzare
     finché non ha risposta. `answer-dilemma` vale solo per il dilemma aperto e
     lo chiude. Un dilemma non ripetibile non torna più.
  3. *Politiche.* Ogni politica ha nei dati: costo annuo e fondo, effetti
     ricorrenti (variazioni e spostamenti di lavoro) finché è attiva, anni
     minimi prima di poterla spegnere, ed eventuali pesi morali palesi
     all'attivazione. Vale dal turno dopo l'attivazione (regola 10). Se in un
     anno il fondo non basta, in quell'anno la politica non produce effetti. Le
     politiche si pagano dopo le spese obbligate e prima dei progetti.
  4. *Formazione.* Una politica può spostare persone da disoccupati a
     `inTraining` e, dopo un numero di anni dai dati, da `inTraining` a
     disoccupati "formati". Per ora si registra solo quante persone formate ci
     sono: l'uso arriva con i cittadini.
- **Fatto quando:** con probabilità annua 1 arriva un dilemma a ogni turno in cui
  ce n'è uno ammesso; una condizione falsa lo esclude; con un dilemma aperto
  `advanceTurn` dà errore; un dilemma non ripetibile non torna in 100 turni; una
  politica attiva al turno T produce il primo effetto al turno T+1; senza fondi
  resta attiva ma senza effetti; non si spegne prima degli anni minimi; la forza
  lavoro resta costante; stessa partita identica a parità di seme e storia;
  stato sempre valido in 100 turni di gioco casuale su 5 semi.

---

## T07 — La città reagisce

- **Agenti:** `sim-engineer`, poi `balance-tester` sullo stesso ramo
- **Dipende da:** T06
- **File:** `packages/sim/src/` (moduli del turno, `state.ts` solo per le aggiunte
  indispensabili, elencate nel resoconto), `packages/content/` (nuovi coefficienti
  come stime dichiarate), `tools/balance/`, `docs/BILANCIAMENTO.md`. Tutti i
  coefficienti dai dati (regola 4).
- **Cosa fare:**
  - **A. Correzioni.** (1) Nessun fondo scende sotto zero per errori di virgola
    mobile, nella cassa integrazione e negli altri pagamenti. (2) A fine anno la
    parte del fondo statale oltre un tetto di riporto, dai dati, torna allo Stato.
  - **B. Dinamica dei quartieri, ogni anno.** (3) Aria: ogni lotto di ILSIDER
    esercita una pressione sui quartieri vicini secondo il suo stato (fermo e non
    bonificato, in lavori, in esercizio per ciascuna strada, bonificato), con pesi
    per quartiere; l'aria si avvicina, di una quota annua, al valore pulito meno la
    somma delle pressioni. (4) Esposizione accumulata: cresce con l'aria sotto una
    soglia, cala lentamente sopra. (5) Salute: si avvicina a un valore che dipende
    da esposizione e servizi. (6) Servizi: calano negli anni di disavanzo dei fondi
    propri, risalgono lentamente negli anni in attivo. (7) Tensione: si avvicina a
    un valore che cresce con cassa integrati e disoccupati e con la fiducia bassa.
    (8) Fiducia: si avvicina a un valore che dipende da reputazione, salute e
    lavoro; una promessa tradita la abbassa subito nel quartiere a cui era rivolta,
    una mantenuta la alza.
  - **C. Conseguenze della morale.** (9) Uno scandalo abbassa subito la fiducia di
    tutti i quartieri e dei consiglieri; se l'atto era una scorciatoia, il progetto
    torna all'inizio della fase saltata e resta fermo per anni dai dati; se era
    un'opzione di dilemma, i dati possono indicare una penale. (10) Senso civico:
    effetti positivi ricorrenti di politiche e progetti ed entrate proprie
    moltiplicati per un fattore tra un minimo e 1, che cresce con la fiducia media.
    (11) Città che si volta: fiducia media sotto soglia per anni consecutivi, dai
    dati, chiude la partita con `ended-abandoned`.
  - **D. Bilanciamento** (`balance-tester`): 1.000 partite per bot, tabella degli
    esiti e delle mediane in `docs/BILANCIAMENTO.md`, distanza dagli obiettivi di
    arrivo al 2127 (Blu 40-70%, Red 15-45%, casuale 30-60%, ogni strada 40-80% con
    non più di 25 punti tra migliore e peggiore, prudente 40-70%, nessuna azione
    0-10%). Nessun valore modificato in questa fase.
- **Fatto quando:** con tutti i lotti fermi l'aria dei Tamburi migliora fino a un
  tetto, e dopo la bonifica dei parchi minerali lo supera; l'esposizione comincia a
  calare dopo l'aria e la salute a migliorare dopo l'esposizione; uno scandalo su
  una scorciatoia rimanda indietro il progetto; meno fiducia produce meno entrate
  proprie l'anno dopo; la fiducia sotto soglia per gli anni previsti chiude la
  partita con `ended-abandoned`; il fondo statale non supera il tetto; 1.000
  partite per bot senza alcuna interruzione; stessa partita identica a parità di
  seme e storia; stato sempre valido.

---

## T06b — Bilanciamento

- **Agente:** `balance-tester`
- **Dipende da:** T07
- **File:** valori in `packages/content/` (ogni valore cambiato resta una stima
  dichiarata, con motivazione aggiornata; `calibrationVersion` diventa
  `"0.2-stime"`), `tools/balance/`, `docs/BILANCIAMENTO.md`. Logica di
  `packages/sim` invariata, con una sola eccezione: il tetto del fattore di senso
  civico diventa un valore dei dati e può superare 1.
- **Obiettivi** (arrivo al 2127, 1.000 partite per bot): Blu 40-70%; Red 15-45%;
  casuale 30-60%; ognuna delle quattro strade 40-80%, con non più di 25 punti tra
  la migliore e la peggiore; prudente 40-70%; nessuna azione 0-10%, con dissesto
  mediano tra il 2045 e il 2065.
- **Vincoli di disegno**, da rispettare anche a costo di mancare un obiettivo:
  1. Blu fa meglio di Red, sia negli arrivi al 2127 sia nella fiducia media finale.
  2. Le scelte scorrette restano convenienti nell'immediato; il costo arriva dopo,
     con scandali e fiducia.
  3. La spirale disavanzo-servizi-fiducia-entrate resta possibile, ma evitabile con
     scelte sensate.
  4. Nessuna strada è migliore su tutti gli indicatori: ognuna ha un punto forte e
     un punto debole diversi (lavoro, conti, aria, tempi).
  5. Almeno una partita su venti del bot Red finisce con la città che si volta.
  6. Durate e costi dei progetti restano plausibili.
- **Metodo:** verificare prima la causa della spirale con un esperimento; poi
  procedere per passi, misurando ogni modifica in memoria su 150 partite per bot
  prima di applicarla; fermarsi agli obiettivi o a un conflitto tra obiettivo e
  vincolo, da spiegare all'architetto.
- **Fatto quando:** `docs/BILANCIAMENTO.md` riporta la causa della spirale,
  l'elenco dei valori cambiati con prima e dopo, la tabella finale degli esiti su
  1.000 partite e gli obiettivi mancati.

---

## T08 — Partita dal terminale

- **Agente:** `sim-engineer` per il comando, `citizen-engineer` per il Consiglio
- **Dipende da:** T06c
- **File:** `tools/play/`, `packages/agents/src/council/`; testi della Cronaca e
  pesi del Consiglio in `packages/content/`. Nessuna dipendenza nuova per
  l'interfaccia: solo Node. Deve funzionare nel terminale di Windows.
- **Cosa fare:**
  1. Comando `pnpm play`, con `--seme N` e `--carica file`. Una partita si salva
     come seme più storia e si ricarica con `replay`.
  2. Schermata dell'anno, in italiano e in poche righe: anno ed epoca; fondi;
     lavoro; una riga per quartiere con aria, salute, fiducia, tensione e una
     freccia rispetto all'anno prima; coscienza e reputazione come barra da Red a
     Blu; progetti in corso con fase, anni mancanti e ritardi; politiche attive.
  3. La Cronaca: fino a tre titoli sull'anno appena chiuso, scelti da regole sui
     cambiamenti più forti. Testi in `packages/content`, tono sobrio.
  4. Il Consiglio: in `packages/agents`, una funzione pura che dato lo stato
     restituisce per ciascuno dei sei consiglieri l'azione che propone e il
     motivo, secondo la sua visione e l'andamento della città; con poca pazienza
     può proporre una scorciatoia. Regole deterministiche, pesi dai dati. Nel
     terminale, `c` mostra i sei consigli.
  5. Azioni dal menu: avviare un progetto, destinare un lotto, accendere o
     spegnere una politica, saltare una fase, rispondere al dilemma aperto. Ogni
     scelta mostra prima costo, durata prevista ed effetti dichiarati. Le scelte
     nascoste sono marcate come tali solo dopo, mai prima.
  6. Avanzare: `a` chiude l'anno; `aa` avanza fino al prossimo dilemma, alla fine
     di una fase o a un cambio d'epoca, al massimo 10 anni.
  7. Fine partita: il ritratto di Taranto nell'anno finale, con la famiglia di
     finale, gli indicatori iniziali e finali affiancati e la riga di comando per
     rigiocare lo stesso seme.
- **Fatto quando:** una partita pilotata da un copione di comandi arriva alla
  fine e produce il ritratto; salvare e ricaricare dà lo stesso stato; il
  consiglio è identico a parità di stato; ogni consigliere propone azioni coerenti
  con la sua visione (test); nessuna scelta nascosta è rivelata prima della scelta
  (test); le schermate stanno in 100 colonne.

---

## T09 — Prototipo grafico nel browser

- **Agente:** `sim-engineer` (anticipa il lavoro di interfaccia, su decisione dell'architetto)
- **Dipende da:** T08
- **File:** `apps/game/`, `.github/workflows/`, una funzione pura di spiegazione in
  `packages/sim` (`explainDistrict`) con i suoi testi in `packages/content`.
- **Cosa fare:**
  1. *Tecnica.* Vite, React, TypeScript; il motore gira nel browser, senza server.
     Stato dell'interfaccia separato dallo stato di gioco, che cambia solo con
     `applyAction` e `advanceTurn`. Salvataggio automatico nel browser come seme
     più storia. Regola 9: ogni schermata funziona a 360 px, in verticale, con il tocco.
  2. *Mappa* vettoriale schematica ma riconoscibile di Taranto (Mar Grande, Mar
     Piccolo, Città Vecchia con i due ponti, Borgo, Tamburi, Paolo VI, borgate a
     sud, area industriale con i sei lotti). Quartieri colorati secondo
     l'indicatore scelto, con legenda e numero; lotti con colore e sigla secondo
     strada e fase; toccare un'area apre la sua scheda.
  3. *Tempo.* Barra con anno, epoca, fondi, coscienza e reputazione; pulsanti
     "chiudi l'anno" e "avanza fino al prossimo evento"; azioni libere sempre visibili.
  4. *Grafici* dal 2027 all'anno corrente, con i cambi d'epoca.
  5. *Il perché.* `explainDistrict(state, rules, id)`: per aria, esposizione,
     salute, servizi, tensione e fiducia, il valore di arrivo e i fattori con il
     loro peso; la scheda del quartiere li mostra in frasi semplici.
  6. *Cantieri* come barre a fasi, con anni mancanti, ritardi e motivo del fermo;
     scheda del progetto prima di avviarlo.
  7. *Consiglio* come sei schede; *Cronaca* come prima pagina a ogni chiusura
     d'anno; *dilemma* come carta a tutto schermo. Le scelte nascoste non sono mai
     segnalate prima della scelta.
  8. *Finale:* ritratto con indicatori iniziali e finali, famiglia di finale, link
     che riapre la stessa partita.
  9. *Aspetto:* sobrio, rosso e blu come accenti, testo scuro su fondo chiaro,
     niente immagini generate, testo di almeno 16 px.
  10. *Pubblicazione* automatica su GitHub Pages sotto `/taranto2127/` a ogni invio su main.
  11. *Verifica visiva* con un browser automatico: partita da copione e schermate
      in `docs/schermate/` a 390 px e 1280 px.
- **Fatto quando:** la partita da copione arriva al finale nel browser automatico
  senza errori in console; ricaricare la pagina riprende la stessa partita; a 360
  px nessuna schermata scorre in orizzontale; `explainDistrict` è pura e i suoi
  fattori sommati danno il valore di arrivo (test); nessuna scelta nascosta
  rivelata prima (test); le schermate sono nel repository.
