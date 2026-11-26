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
  Massimo 3 azioni libere per turno (limite tolto dal T10).
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
     "chiudi l'anno" e "avanza fino al prossimo evento"; azioni libere sempre visibili (comandi del tempo sostituiti dal T10).
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

---

## T10 — Esperienza di gioco

- **Agente:** `sim-engineer` per motore e interfaccia, `content-designer` per
  dilemmi e testi, `balance-tester` per il bilanciamento (su decisione di Michele,
  dopo la prima partita dal telefono: «gioco poco intuitivo»).
- **Dipende da:** T09
- **Ramo:** `task/T10-esperienza`
- **File:** `apps/game/`; in `packages/sim` turno, dilemmi, una funzione pura per
  i motivi di fermata, una per la previsione del bilancio e la capacità degli
  uffici, `state.ts` e `CLAUDE.md` solo dove citano il limite di tre azioni
  (autorizzato da Michele); `tools/play/` dove usa quel limite; in
  `packages/content` dilemmi, guida (visita guidata, «Come si gioca», glossario,
  bilancio, motivi di fermata) con i loro schemi; `tools/balance/`,
  `docs/BILANCIAMENTO.md`, `docs/schermate/`. Regola 9 sempre valida: prima il telefono.
- **Cosa fare:**
  1. *Tempo.* Al posto di «Chiudi l'anno» e «Avanza fino al prossimo evento»:
     avvia, pausa, tre velocità, e «un anno avanti» in pausa. La partita parte in
     pausa. Il tempo si ferma da solo, con una riga che dice perché, quando:
     arriva un dilemma, finisce una fase di un progetto, scoppia uno scandalo,
     scade una promessa, cambia l'epoca, i conti vanno in disavanzo, finisce la partita.
  2. *Azioni libere.* Il motore non limita più le azioni per anno: restano i
     limiti di fondi e capacità di spesa. Nell'interfaccia la capacità di spesa si
     chiama «capacità degli uffici» e mostra quanta ne resta nell'anno. Poi
     (`balance-tester`) 1.000 partite per bot; se gli obiettivi di T06b non
     reggono, si ritoccano i valori e si documenta.
  3. *Visita guidata.* Al primo avvio, otto passi che si possono saltare:
     obiettivo, mappa e colori, perché di un quartiere, lotti di ILSIDER e strade,
     Consiglio, tempo, bilancio, barra Red/Blu. Si riapre dal pulsante «?». Una
     pagina «Come si gioca» con tutte le funzioni. Ogni termine tecnico ha una
     spiegazione al tocco. Testi in `packages/content`.
  4. *Bilancio.* Pannello con «Cassa della città», «Fondi dello Stato», «Fondi
     europei», ognuno con una riga su cosa può pagare; entrate e uscite
     dell'ultimo anno voce per voce; previsione dell'anno in corso; avviso di
     disavanzo con gli anni che mancano al dissesto; scadenze delle rate europee;
     una nota che dichiara le cifre stime in attesa di verifica.
  5. *Grafici su telefono.* Scala verticale adattata ai valori, con margine; un
     quartiere in evidenza, gli altri attenuati, più la media cittadina; nomi solo
     nella legenda sotto, con la variazione dal 2027 col segno; con meno di cinque
     anni di dati un messaggio al posto del grafico; un mini andamento nella scheda
     del quartiere.
  6. *Dilemmi.* Motore: un dilemma ripetibile non torna prima degli anni indicati
     nei dati, e mai due volte nella stessa epoca se ne esistono altri ammessi.
     Contenuti (`content-designer`): ventiquattro dilemmi, distribuiti sulle cinque
     epoche e sui temi (aria e salute, lavoro, appalti, fondi, quartieri, mare,
     clima, giovani), con condizioni legate allo stato della città; stesse regole
     di tono e struttura dei primi sei; valori come stime dichiarate.
  7. *Partita.* Menu con stato del salvataggio automatico e ora dell'ultimo
     salvataggio, nuova partita con conferma, tre posti per salvataggi manuali,
     esporta e importa su file, link che riapre la partita.
- **Fatto quando:** la partita da copione arriva al finale con i nuovi comandi del
  tempo, a 390 e 1280 px, senza errori in console; il tempo si ferma per ognuno dei
  motivi elencati (test); salvare in un posto, cominciare una partita nuova e
  ricaricare riporta lo stato identico; esportare e importare dà lo stesso stato;
  in 1.000 partite casuali nessun dilemma torna prima dell'intervallo; i
  ventiquattro dilemmi passano i controlli di contenuto; la visita guidata si
  completa e si salta; a 360 px nessuno scorrimento orizzontale; schermate
  aggiornate in `docs/schermate/`.

---

## T11 — Plastico di una zona e nuova disposizione

- **Agente:** `sim-engineer` (interfaccia, su decisione di Michele)
- **Dipende da:** T10
- **Ramo:** `task/T11-plastico`
- **File:** `apps/game/`, `packages/content/geo/`, `docs/GRAFICA.md`; inoltre
  `docs/FONTI.md` (licenze), `docs/TASKS.md`, `docs/schermate/`.
- **Stile:** plastico 3D della città, effetto modellino, luce morbida, colori pieni.
  Mappa a tutto schermo, comandi ai bordi, finestre al tocco. Nessun modello,
  insegna o elemento d'interfaccia copiato da altri giochi: tutto originale o con
  licenza libera compatibile, annotata in `docs/FONTI.md`.
- **Cosa fare:**
  1. *Dati geografici.* Da OpenStreetMap, una volta sola: Tamburi, area industriale e
     tratto di Mar Piccolo adiacente (costa, strade principali, sagome degli edifici,
     aree verdi). Nel repository un file ridotto e semplificato, con l'attribuzione
     richiesta dalla licenza. Il gioco non scarica nulla durante la partita.
  2. *Scena 3D nel browser.* Terreno, mare, strade, edifici come volumi dalle sagome,
     con altezze plausibili, tetti e colori variati in modo ripetibile. Luce di giorno
     sereno, ombre leggere, effetto modellino con sfocatura ai bordi. Camera che si
     sposta, ruota e ingrandisce con mouse e dita, entro limiti sensati.
  3. *ILSIDER.* I sei lotti nella posizione reale dello stabilimento, con un aspetto per
     stato: fermo (impianti spenti, ruggine), lavori (gru, recinzioni), acciaio verde
     (capannoni nuovi, camino con poco fumo), bonifica conclusa (bosco giovane), energia
     (pale che girano, pannelli), mare e cultura (banchine aperte, edifici pubblici).
  4. *Strati.* Un comando colora il plastico secondo l'indicatore scelto (aria, salute,
     fiducia, tensione), con legenda e valore numerico.
  5. *Disposizione.* Mappa a tutto schermo. In alto anno, fondi, barra Red/Blu; in basso
     i comandi del tempo; su un lato Consiglio, cantieri, bilancio, grafici, strati.
     Toccare un quartiere, un lotto o un pulsante apre una finestra sopra la mappa, che
     si chiude con un tocco fuori. Su telefono le finestre salgono dal basso.
  6. *Prestazioni.* Almeno 30 immagini al secondo su un telefono di fascia media:
     misurare e scrivere il risultato. Se il dispositivo non regge il 3D, la mappa
     schematica attuale.
  7. *Accessibilità.* Ogni informazione della mappa raggiungibile da un elenco testuale.
  8. `docs/GRAFICA.md`: scelte tecniche, tavolozza, origine e licenza di ogni modello,
     cosa manca per estendere il plastico a tutta la città, con una stima del lavoro.
- **Fatto quando:** la zona si riconosce confrontandola con la cartografia (costa, strade
  principali, posizione dello stabilimento rispetto ai Tamburi); ogni stato di lotto ha
  un aspetto distinto e cambia durante una partita da copione; toccare un lotto apre la
  sua finestra; lo strato dell'aria colora la zona con il valore corretto; nessun errore
  in console; schermate a 390 e 1280 px in `docs/schermate/`, compresa una per ogni
  stato di lotto; il resto del gioco continua a funzionare.

### Integrazioni dell'architetto (15 novembre 2026)

- **Scelte tecniche (decise dall'architetto).**
  - Motore 3D: `three` (licenza MIT), con versione esatta in `package.json`, senza
    altri strati sopra (niente react-three-fiber). Nuove dipendenze solo con licenza
    compatibile con AGPL, annotate in `docs/FONTI.md`.
  - Il codice 3D e `plastico.json` si caricano **solo** quando si mostra il plastico
    (caricamento separato). Così la prima schermata non diventa più lenta e la mappa
    schematica di riserva funziona anche senza il 3D.
  - Colori e altezze «ripetibili» vuol dire ricavati dall'identificativo della sagoma
    con una funzione fissa: niente `Math.random`, nemmeno nell'interfaccia.
  - Le posizioni dei sei lotti stanno in `packages/content/geo/`, ciascuna con la nota
    `stima` e la motivazione (regole 4 e 7). Lo stato del lotto lo legge l'interfaccia
    dal motore (regola 1). `packages/sim` e `state.ts` **non** si toccano.
  - L'attribuzione OpenStreetMap si vede anche nel gioco, in un angolo della mappa:
    la licenza ODbL la richiede dove la mappa viene mostrata, non solo nei documenti.
- **Correzione ereditata da T10.** La riga delle fermate oggi si legge «… «titolo».
  e altri 2», con un punto di troppo prima di «e». Va sistemata nella nuova disposizione.
- **Fatto quando, in aggiunta:**
  - forzando la mappa schematica (ad esempio con un parametro nell'indirizzo) il gioco
    funziona da capo a fondo: c'è un test;
  - prestazioni: misura con il browser automatico a 390 px e processore rallentato di
    4 volte, come stand-in del telefono di fascia media, dichiarata come tale in
    `docs/GRAFICA.md`; la prova su un telefono vero la farà Michele;
  - la visita guidata funziona nella nuova disposizione e indica gli elementi giusti;
  - a 360 px nessuno scorrimento orizzontale; `apps/game/scripts/verifica.ts` passa;
  - `pnpm test` resta sotto il minuto; `pnpm test:lungo` resta verde;
  - nel resoconto: peso del file dei dati e del codice 3D (normale e compresso).
- **Regole per l'esecutore (dal metodo, valgono sempre):**
  - ogni criterio «Fatto quando» ha un test, e per ciascuno la prova inversa: un
    errore introdotto apposta deve far cadere un test;
  - invio a GitHub del **solo ramo `task/T11-plastico`**, dopo il verde su un clone
    pulito;
  - **l'esecutore non unisce a `main` e non invia `main`.** L'unione la fa
    l'architetto dopo la revisione (in T10 è successo il contrario: non ripeterlo);
  - non cambiare ramo né salvare commit sui file dell'architetto (`docs/ARCHITETTO.md`,
    `docs/DECISIONI.md`): la cartella è condivisa;
  - resoconto finale in tre parti: cosa ho fatto, cosa ho verificato, cosa resta
    aperto (comprese le scelte da confermare).
- **Prima dell'approvazione** l'architetto mostra le schermate a Michele: sull'aspetto
  il giudizio è suo.

### Correzioni dopo la revisione (15 novembre 2026)

Revisione dell'architetto su clone pulito di `556dc09`: tutto verde. Michele ha
guardato le schermate: la zona gli sembra Taranto. Prima dell'unione servono le
correzioni qui sotto, sullo stesso ramo e con gli stessi file e le stesse regole.

1. *Strati più decisi sul telefono (decisione di Michele).* Oggi a 390 px la tinta
   sugli edifici e sul terreno dei quartieri quasi non si vede. Va resa netta, con gli
   stessi colori della legenda, senza coprire la forma degli edifici.
2. *Lotti aderenti al terreno (decisione di Michele).* Niente piastre rialzate e
   squadrate: il fondo di ogni lotto sta alla quota del terreno e i bordi sono meno
   netti (raccordo, bordo irregolare o sfumato: la scelta tecnica è dell'esecutore,
   da spiegare in `docs/GRAFICA.md`). Il lotto deve restare riconoscibile e toccabile.
3. *«Mare e cultura» senza vasca.* Su un lotto che tocca la costa vera: banchine aperte
   sul mare vero ed edifici pubblici, nessuno specchio d'acqua finto dentro il lotto.
   Su un lotto interno: edifici pubblici, piazze e verde, anche qui senza acqua finta.
   Nel resoconto: quali lotti toccano la costa.
4. *Si vede che cosa hai toccato (decisione dell'architetto).* Il lotto o il quartiere
   aperto in una finestra resta evidenziato sul plastico. Sul telefono la camera lo
   sposta nella parte di schermo che la finestra lascia libera.
5. *Invariati (decisione di Michele):* altezza esagerata 2,4 volte e sfocatura ai bordi.

- **Fatto quando:**
  - strato dell'aria a 390 px: la differenza di colore tra strato acceso e spento,
    misurata sui pixel dei Tamburi, supera una soglia dichiarata nel resoconto ed è
    almeno il doppio di quella di `556dc09`: c'è un test;
  - nessun lotto ha il fondo sopra la quota del terreno: c'è un test sui dati della scena;
  - «mare e cultura» non produce superfici d'acqua dentro i lotti: c'è un test;
  - aprendo un lotto a 390 px, il lotto è evidenziato e sta nella parte visibile
    sopra la finestra: c'è un test nella verifica nel browser;
  - schermate rifatte: ogni stato di lotto a 390 e 1280 px, `strato-aria-390`,
    `lotto-finestra-390`;
  - tutto il resto della scheda T11 resta verde, compresi `pnpm test` sotto il
    minuto, `pnpm test:lungo` e la verifica nel browser; prova inversa per ogni
    criterio nuovo.
- **Regole:** come sopra. Invio del solo ramo `task/T11-plastico`; niente unione né
  invio di `main`; resoconto in tre parti. L'architetto rivede e mostra di nuovo
  le schermate a Michele prima di unire.

---

## T11b — Prove più veloci e lotto «Banchine» sul Mar Grande

- **Agente:** `balance-tester` per le prove, `sim-engineer` (interfaccia) per il lotto.
- **Dipende da:** T11 (in `main` a `9940e43`).
- **Ramo:** `task/T11b-rifiniture` (già creato dall'architetto con questa scheda).
- **File:** `package.json` (solo gli script `test` e `test:lungo`),
  `vitest.lungo.config.ts`, i file di prova esistenti (`*.test.ts`, da cui si
  possono ricavare file `*.lungo.ts`), `packages/content/geo/lotti.json` (solo
  `lotto-banchine`), `apps/game/` (prove e scena del plastico),
  `docs/GRAFICA.md`, `docs/schermate/`. Non si toccano `packages/sim/src` e
  i valori di bilanciamento.
- **Perché:** su clone pulito `pnpm test` dura 62 secondi (limite: un minuto).
  Le prove più lente esistevano già: bilanciamento 22 s, morale 16, città 15,
  dilemmi e politiche 13, contenuti 10, partita da terminale 9; il lint
  aggiunge circa 17 s prima delle prove. Il lotto «Banchine» oggi si affaccia
  su un canale largo circa 20 m: Michele ha chiesto che «mare e cultura» si
  affacci sul mare vero.
- **Cosa fare:**
  1. *Prove.* Spostare in `pnpm test:lungo` le prove che giocano molte partite
     intere (bilanciamento a più thread, partite complete da terminale e simili).
     In `pnpm test` resta per ognuna una versione breve che controlla lo stesso
     comportamento su poche partite. Nessuna prova sparisce: il totale tra i
     due comandi non scende. Allargare `vitest.lungo.config.ts` a `tools/` se
     serve. Valutare `eslint --cache` con il file di cache dentro
     `node_modules/.cache/` (senza toccare `.gitignore`).
  2. *Lotto «Banchine».* Spostarlo sul fronte dello stabilimento sul Mar Grande,
     accanto ai grandi moli del porto visibili nel plastico, in modo che almeno
     un lato tocchi il mare aperto e non un canale. Aggiornare la motivazione
     della stima. L'aspetto «mare e cultura» resta quello approvato (piazza,
     edifici pubblici, viali, banchine solo sui lati sull'acqua).
- **Fatto quando:**
  - `pnpm test` dura al massimo 45 secondi su un clone pulito, a computer il più
    possibile scarico; nel resoconto i tempi prima e dopo, misurati nello stesso
    momento;
  - il numero di prove di `pnpm test` più `pnpm test:lungo` non è inferiore a
    451 + 41; ogni prova spostata ha la sua versione breve in `pnpm test`;
  - `pnpm test:lungo` è verde, e la procedura di GitHub lo esegue ancora;
  - un test verifica che il lotto «Banchine» tocchi il mare aperto (non un corso
    d'acqua o un canale) e resti dentro il contorno dello stabilimento;
  - schermate rifatte: `lotto-mare-390`, `lotto-mare-1280`, `mappa-1280`;
  - verifica nel browser riuscita; prova inversa per ogni criterio nuovo.
- **Regole:** come T11. Invio del solo ramo `task/T11b-rifiniture` dopo il verde
  su clone pulito; niente unione né invio di `main`; non toccare `CLAUDE.md`,
  `docs/ARCHITETTO.md`, `docs/DECISIONI.md`; resoconto in tre parti.
  L'architetto rivede e mostra a Michele la schermata del lotto prima di unire.

---

## T12 — Città isometrica

- **Agente:** `sim-engineer` (interfaccia), su decisione di Michele (D20).
- **Dipende da:** T11b (in `main` a `8416d42`).
- **Ramo:** `task/T12-isometrica` (già creato dall'architetto con questa scheda).
- **File:** `apps/game/`, `packages/content/geo/` (solo se servono dati nuovi sugli
  edifici, con `stima` e motivazione), `docs/GRAFICA.md`, `docs/FONTI.md`,
  `docs/schermate/`. Il motore (`packages/sim`) non si tocca.
- **Perché:** Michele vuole una città nello stile dei gestionali di città di fine
  anni '90 (suoi riferimenti: schermate di SimCity 3000), non un plastico con i
  bordi. Decisione D20 in `docs/DECISIONI.md`.
- **Ispirazione, non copia (vincolante).** Si prende lo stile del genere: vista
  isometrica, città fitta, tetti, finestre, viali alberati, giardini, moli, colori
  pieni e saturi, giornata di sole. Non si prende nulla di SimCity né di altri giochi:
  niente immagini, texture, edifici riconoscibili, icone, pannelli, minimappa a
  rombo, nomi o loghi. Le immagini di riferimento di Michele non entrano nel
  repository. Tutto è generato dal codice o disegnato per noi; ogni file esterno ha
  origine e licenza in `docs/FONTI.md`. Nessuna immagine generata con servizi a
  pagamento senza il via di Michele.
- **Skill da leggere prima di cominciare** (scelte dall'architetto con il `router`;
  file `~/.claude/skills/<nome>/SKILL.md`, da aprire a mano se lavori fuori da
  Claude Code):
  - `create-game-assets`: brief di direzione artistica (modello in
    `assets/art-direction-brief.md`), elenco degli elementi grafici (modello in
    `assets/asset-manifest.json`), approvazione di un solo bersaglio visivo prima
    della produzione;
  - `threejs-scene-setup`, `threejs-materials-lighting`: scena, luce, ombre, spazio
    colore delle texture, densità di pixel;
  - `camera-systems`: limiti della vista e movimenti morbidi;
  - `performance-optimization`: misure in millisecondi, budget, ordini di disegno.
  Le skill sono scritte per three.js r187; noi usiamo 0.169. Non usare funzioni
  introdotte dopo la 0.169 (ad esempio `THREE.Timer`, r183). Si aggiorna three.js
  solo se una funzione indispensabile lo richiede, con versione esatta e motivo
  nel resoconto come «mia scelta da confermare».

### Fase A — Provino di stile (ci si ferma qui fino al via di Michele)

1. Un isolato dei Tamburi, un tratto di costa del Mar Piccolo e il lotto «Parchi
   minerali» in due stati (fermo, bosco), nel nuovo stile e alla scala reale del gioco.
2. In `docs/GRAFICA.md` il brief di direzione artistica, sul modello della skill:
   vista e angolo, tavolozza con il ruolo di ogni colore, luce, densità di dettaglio,
   trattamento dei bordi, tipi di edificio previsti e come si riconoscono i luoghi di
   Taranto (palazzine dei Tamburi con tetti piani e terrazze, Città Vecchia fitta,
   capannoni e ciminiere dello stabilimento), cosa si prende dal genere e cosa no.
3. `docs/grafica-elementi.json`: l'elenco degli elementi grafici (tipi di edificio,
   tetti, alberi, texture disegnate dal codice, aspetti dei lotti) con origine,
   licenza e stato di approvazione, sul modello della skill.
4. Schermate a 390 e 1280 px in `docs/schermate/provino-*.png`, più un foglio di
   confronto con tutti i tipi di edificio affiancati. Invio del ramo e resoconto.
   **Non si passa alla fase B senza l'approvazione di Michele scritta in questa scheda.**

### Approvazione della fase A (24 novembre 2026)

**Michele approva il provino** (`1771f69`, revisione dell'architetto su clone pulito:
455 prove verdi, 56 lunghe, prova inversa a campione caduta, provino fuori dalla
costruzione). Tavolozze confermate così come sono.

Scelte dell'esecutore confermate: vista dimetrica a 30° (2:1); altezze reali senza
esagerazione; regole dei tipi di edificio come stime dichiarate; edifici OSM nascosti
dentro i lotti; provino come pagina di solo sviluppo; foglio dei tipi solo a 1280 px;
nomi dei campi del modello della skill. Rinviata all'estensione della mappa: la Città
Vecchia (oggi due sagome).

Correzioni da fare in fase B, oltre ai punti qui sotto:

1. *Niente terreno vuoto.* Ogni area ha una copertura: piazzali di cemento e asfalto
   nello stabilimento, erba e cespugli sui terreni liberi, parcheggi, cortili. Si
   ricava dai dati OSM dove ci sono; altrove dal tipo di zona, come stima dichiarata.
2. *Stabilimento dettagliato come le case.* Pareti con texture, tetti con lucernari,
   tubazioni, serbatoi, nastri: non più scatole grigie lisce.
3. *Mare vivo e costa vera.* Onde e riflessi visibili; lungo la riva spiaggia, scogli e
   moli secondo i dati; i bacini sulla costa non devono sembrare piscine.
4. *Strade.* Marciapiedi e alberi anche sulle strade secondarie, dove è realistico.

Per ciascuna correzione: una schermata a 390 e 1280 px e un test dove è misurabile
(ad esempio: nessuna area dentro la zona resta con il colore di base del terreno).
I macchinari separati dei parchi (oggi 79 ordini di disegno) vanno raggruppati.

### Fase B — Tutta la zona

1. *Vista.* Telecamera ortografica isometrica con angolo fisso. Ci si sposta e si
   ingrandisce (dita, rotella, pulsanti); si ruota solo a scatti di 90° (quattro
   orientamenti), con un pulsante e un passaggio morbido. I movimenti morbidi usano
   un fattore che dipende dal tempo trascorso (`1 - exp(-k·dt)`), non un valore fisso
   per immagine. Si limita la vista, non solo il centro, tenendo conto
   dell'ingrandimento. Niente sfocatura, niente lastra, niente bordi: oltre la zona
   il terreno o il mare continuano in forma semplice invece di finire nel vuoto.
2. *Edifici.* Generati dal codice dalle sagome OpenStreetMap, con dettaglio: tetti
   piani con terrazze, cisterne e antenne, o tetti a falde secondo il tipo; finestre
   e balconi con texture disegnate dal codice (spazio colore sRGB); capannoni,
   ciminiere e nastri nello stabilimento. Varianti ricavate dall'identificativo della
   sagoma (ripetibili). Almeno sei tipi di edificio distinti. Geometrie raggruppate
   o ripetute in modo efficiente: migliaia di edifici non devono diventare migliaia
   di ordini di disegno.
3. *Strade e verde.* Asfalto con segnaletica e marciapiedi, filari lungo le strade
   principali, parchi con alberi, binari, moli con barche. Mare con riflessi leggeri.
4. *Lotti di ILSIDER.* I sei aspetti per stato, rifatti nello stesso stile.
5. *Livelli di dettaglio.* Alto, medio, basso. Il gioco misura il tempo di ogni
   immagine e scende di livello da solo quando supera il budget; sotto le 20 immagini
   al secondo anche al livello basso torna la mappa schematica, come oggi. Il livello
   si può scegliere a mano da «Strati». Densità di pixel limitata (punto di partenza
   1,5) e rivista con le misure.
6. *Tutto il resto resta:* strati, finestre al tocco, evidenza della selezione,
   «Elenco», visita guidata, attribuzione OpenStreetMap, riserva schematica.

### Fatto quando (fase B)

- la telecamera è ortografica e il suo angolo non cambia spostando o ingrandendo; la
  rotazione dà solo quattro orientamenti: c'è un test;
- nessun effetto di sfocatura né base della scena; a ogni ingrandimento e in ogni
  orientamento i quattro angoli dello schermo mostrano terreno o mare, mai lo sfondo:
  c'è un test nella verifica nel browser;
- almeno sei tipi di edificio, ciascuno con un aspetto distinto; altezze, colori e
  varianti dipendono solo dall'identificativo: ci sono test;
- prestazioni, misurate sulla stessa scena in tre giri, in millisecondi (media e 95°
  percentile): nel telefono simulato (390 px, processore rallentato 4 volte, densità
  2) il 95° percentile resta sotto i 33 ms al livello scelto da solo, con almeno il
  20% di margine al livello medio; a 1280 px al livello alto sotto i 33 ms. Con il
  processore rallentato il gioco scende di livello da solo: c'è un test;
- budget dichiarati in `docs/GRAFICA.md` e misurati nel resoconto: ordini di disegno
  per immagine, triangoli, memoria delle texture, per ogni livello;
- `docs/grafica-elementi.json` completo: ogni elemento ha origine, licenza e
  approvazione;
- restano verdi tutti i criteri di T11 e T11b (riconoscibilità della zona, lotti,
  strati, finestre, 360 px, mappa schematica forzata, visita guidata), `pnpm test`
  sotto i 45 secondi, `pnpm test:lungo`, verifica nel browser senza errori;
- schermate a 390 e 1280 px: vista d'insieme in due orientamenti, ogni stato di
  lotto, strato dell'aria, una finestra aperta, il livello basso;
- nel resoconto: peso del codice e dei dati (normale e compresso).

### Regole

Come T11. Prova inversa per ogni criterio, con un controllo che richiede almeno una
prova fallita davvero. Invio del solo ramo `task/T12-isometrica` dopo il verde su
clone pulito; niente unione né invio di `main`; non toccare `CLAUDE.md`,
`docs/ARCHITETTO.md`, `docs/DECISIONI.md`. Ogni scelta fuori scheda va dichiarata nel
resoconto come «mia scelta da confermare», mai attribuita ad altri. Resoconto in tre
parti. L'architetto rivede e mostra le schermate a Michele prima di approvare
ciascuna fase.

---

## T12c — Città isometrica: aspetto illustrato, edifici, colori, vita

- **Agente:** `sim-engineer` (grafica).
- **Dipende da:** T12 unito in `main` (fatto il 24 novembre 2026, `68289f1`). T13 parte
  dopo questo task: stessi file.
- **Ramo:** `task/T12c-aspetto`.
- **File:** `apps/game/src/iso/`, `apps/game/scripts/verifica.ts`, `docs/GRAFICA.md`,
  `docs/grafica-elementi.json`, `docs/FONTI.md`, `docs/schermate/`. Il motore e i dati
  di `packages/content` non si toccano, salvo leggere dallo stato del motore ciò che
  serve alla vita della città (vedi punto 4).
- **Perché:** Michele, guardando la fase B di T12, non è soddisfatto della grafica e
  indica quattro difetti: (1) gli edifici sono scatole; (2) sembra un modellino 3D,
  non una città «disegnata» come nei gestionali di fine anni '90; (3) la città è
  ferma, senza vita; (4) i colori sono spenti, troppo beige e grigio. La mappa resta
  la stessa (dati, vista, rotazione, livelli di dettaglio): cambia come è disegnata.
- **Ispirazione, non copia (vincolante, come T12).** Nessuna immagine, texture,
  edificio, icona o palette presa da SimCity o da altri giochi. Le immagini di
  riferimento di Michele (`reference_grafica_sitoweb/`, fuori dal repository) si
  possono guardare, non ricalcare né copiare nel progetto. Niente immagini da
  satellite. Tutto disegnato dal codice.
- **Skill da leggere** (`~/.claude/skills/<nome>/SKILL.md`): `create-game-assets`
  (in particolare `references/art-direction.md`: definire un sistema visivo con
  valori osservabili, approvare **un campione** alla scala del gioco prima di
  produrre tutto, giudicarlo a tre distanze), `threejs-materials-lighting` (luce,
  spazio colore, curva dei toni: verificare che i colori pieni non vengano
  sbiaditi dal rendering), `performance-optimization` (le auto e le barche in
  movimento vanno disegnate in blocco, non una per una). three.js resta 0.169.

- **Cosa fare, in due fasi.**

  **Fase A — Campione (ci si ferma fino al via di Michele).**
  1. *Sistema visivo scritto* in `docs/GRAFICA.md`, con valori e non aggettivi:
     palette con i ruoli (intonaci, tetti, verde, acqua, asfalto, terreno, ruggine,
     accenti), luce (direzione, colore, quante fasce di ombra), bordi (con o senza
     contorno, di che spessore e colore), densità del dettaglio a ciascun
     ingrandimento, cosa si muove e quanto.
  2. *Un campione nel gioco vero*, alla scala vera, su un pezzo di mappa che
     contenga tutto: un isolato dei Tamburi, il bordo dello stabilimento con due
     ciminiere e un nastro, un tratto di costa con un molo. **Due varianti** dello
     stesso campione, perché Michele scelga la direzione:
     - **variante 1, «illustrata»:** ombre a poche fasce nette, contorni scuri sottili
       sugli spigoli, colori pieni e piatti;
     - **variante 2, «pre-disegnata»:** ombre morbide e ombre di contatto alla base
       degli edifici, facciate con molto dettaglio dipinto, nessun contorno.
     Entrambe con gli edifici nuovi (punto 2 della fase B) e la palette nuova.
  3. *Schermate*, a 390 e 1280 px, dalle stesse inquadrature per: com'è oggi
     (`68289f1`), variante 1 e variante 2. Più una vista da lontano e una da vicino,
     così il campione si giudica alle tre distanze.
  4. Misure di prestazione del campione come in T12, per ciascuna variante.

  **Fase B — Tutta la zona, nella variante scelta da Michele.**
  1. *Aspetto:* il sistema visivo approvato applicato a terreno, edifici, stabilimento,
     mare, lotti e cantieri. I colori della palette devono arrivare sullo schermo come
     sono scritti (verifica a pixel su campioni noti, con margine dichiarato).
  2. *Edifici con carattere:* un catalogo di tipi riconoscibili, ciascuno composto da
     parti (corpo, tetto, coronamento, balconi, piano terra), con varianti scelte in
     modo ripetibile dall'identificativo dell'edificio. Almeno: palazzina
     residenziale a più piani con balconi e stenditoi; casa bassa con terrazzo;
     edificio del centro con cornicioni; scuola o edificio pubblico; chiesa;
     negozi al piano terra con tende; capannone; tetti piani con serbatoi
     dell'acqua, antenne e parabole, e qualche tetto a falde. La tipologia si
     ricava da ciò che OpenStreetMap dice dell'edificio (uso, altezza, piani,
     superficie); dove non lo dice è una stima dichiarata in `docs/GRAFICA.md`.
     Nessun edificio identificabile come reale è ricostruito in dettaglio.
  3. *Colori:* meno beige e meno grigio. Cortili e piazze distinti dall'asfalto,
     verde più vivo, mare più profondo con la fascia più chiara sotto costa,
     intonaci in toni caldi variati. Lo strato dei dati (T11) deve restare leggibile:
     contrasto dello strato dell'aria non sotto 40, come oggi.
  4. *Vita:* auto che percorrono le strade principali, treni sui binari, barche che
     entrano ed escono dai moli, fumo dalle ciminiere, qualche persona nelle piazze,
     gabbiani sul mare. **Ciò che racconta lo stato della città lo legge dal motore,
     non lo inventa:** il fumo dipende da quanto producono gli impianti nel lotto;
     il traffico e le barche dalla popolazione e dalle attività del porto e del lotto
     «mare e cultura»; un lotto fermo non fuma. Tutto il movimento si ferma con
     «riduci animazioni»; al livello di dettaglio basso resta il minimo.
  5. *Limiti di T12 da chiudere:* il cantiere su un lotto grande non deve sembrare un
     piazzale vuoto (recinzioni, baracche, mezzi, cumuli, scavi distribuiti su tutta
     l'area); i riflessi del mare uguali nei quattro orientamenti.
- **Fatto quando (fase B):** schermate prima/dopo dalle stesse inquadrature di T12,
  a 390 e 1280 px, nei quattro orientamenti e per ogni aspetto dei lotti; almeno otto
  tipi di edificio distinti, ciascuno con due o più varianti (prova e foglio delle
  varianti in `docs/schermate/`); i colori della palette arrivano allo schermo
  (prova nel browser); il fumo cambia con lo stato del lotto in una partita da
  copione (prova); con «riduci animazioni» nulla si muove (prova); stesso edificio,
  stesso aspetto a ogni avvio (prova); prestazioni con le stesse soglie di T12
  (95° percentile sotto 33 ms a 390 px con processore rallentato 4×, discesa
  automatica di livello funzionante) e ordini di disegno non oltre il 20% di T12;
  contrasto dello strato dell'aria almeno 40; tutti gli elementi nuovi nell'elenco
  degli elementi grafici con origine e licenza; `pnpm test` sotto i 45 secondi,
  `pnpm test:lungo` e verifica nel browser verdi.
- **Approvazione della fase A (24 novembre 2026).** Michele sceglie la **variante 1,
  «illustrata»** (campione in `3060f45`). Per la fase B:
  1. *Una sola città:* la variante 1 diventa l'aspetto di tutta la zona e
     l'unico. Si tolgono la variante 2, il parametro `?aspetto=` e l'aspetto di
     T12; resta la mappa schematica di riserva.
  2. *Contorni che si alleggeriscono con la distanza:* da media distanza i Tamburi
     non devono diventare una massa scura. Spessore o intensità del contorno
     scendono gradualmente con l'ingrandimento, fino a sparire da lontano, senza
     scatti visibili. Prova nel browser: alla vista d'insieme la luminosità media
     di un riquadro dei Tamburi non scende sotto quella della variante 2 di oltre
     il 10%.
  3. *Prestazioni:* al livello medio i balconi sono dipinti nella facciata, in
     rilievo solo al livello alto e da vicino (proposta dell'esecutore, accettata).
     Le soglie restano quelle della scheda, compreso il margine del 20% al livello
     medio.
  4. *Stabilimento:* nel campione è quasi uguale a prima. Capannoni, ciminiere,
     serbatoi, nastri e lotti ricevono lo stesso trattamento delle case: tavolozza
     nuova, tre fasce di luce, contorni, dettaglio sulle facciate.
  5. *Scelte dell'esecutore accettate:* i valori del sistema visivo scritti in
     `docs/GRAFICA.md` come punto di partenza; negozi al piano terra nel 40% delle
     palazzine come stima; una riga di contorno per balcone; soglie di dettaglio
     dichiarate. Restano da fare tutti i punti rinviati nel resoconto (chiese,
     scuole, centro con cornicioni, vita della città, riflessi del mare, cantiere
     grande, verifica a pixel dei colori, contrasto dello strato dell'aria).
- **Regole:** come T12. Solo il ramo del task; non unire né inviare `main`; non
  toccare `CLAUDE.md`, `docs/ARCHITETTO.md`, `docs/DECISIONI.md`, `docs/TASKS.md`;
  scelte fuori scheda dichiarate come «mia scelta da confermare»; almeno tre prove
  inverse descritte nel resoconto. **Michele approva la variante dopo la fase A e
  l'aspetto finale prima dell'unione:** l'architetto gli mostra le schermate.

---

## T13 — Interfaccia gestionale

- **Agente:** `sim-engineer` (interfaccia), su decisione di Michele (D23).
- **Dipende da:** T12c unito in `main`. Non si avvia prima: stessi file.
- **Ramo:** `task/T13-interfaccia`.
- **File:** `apps/game/` (esclusa la scena della mappa, salvo gli agganci),
  `packages/content/data/guida.json` e il suo schema (testi della visita guidata che
  cambiano), `docs/GRAFICA.md`, `docs/grafica-elementi.json`, `docs/FONTI.md`,
  `docs/schermate/`. Il motore non si tocca.
- **Perché:** Michele vuole un'interfaccia da gestionale di città, più vicina ai suoi
  riferimenti (schermate di SimCity 3000 e SimCity BuildIt), al posto dei pulsanti
  di testo attuali.
- **Ispirazione, non copia (vincolante).** Dal genere si prendono le funzioni: barra
  di stato sempre visibile, notizie che scorrono, pannello di comandi a icone,
  minimappa, finestre con cornice coerente. Non si prende l'aspetto di nessun gioco:
  niente pannelli blu arrotondati, icone, colori, caratteri o disposizioni riconoscibili
  di SimCity o di altri. Icone disegnate per noi in SVG, con origine e licenza
  nell'elenco degli elementi grafici. Il linguaggio visivo nasce dalla mappa
  isometrica e dai colori della città (rosso e blu della bandiera, sabbia, mare).
- **Skill da leggere** (`~/.claude/skills/<nome>/SKILL.md`): `game-ui-ux` (ancore e
  contenitori, una sola regola di scala, zona sicura dei telefoni, finestre a pila,
  navigazione da tastiera, prove a più dimensioni) e `create-game-assets` (brief,
  elenco degli elementi, un bersaglio visivo approvato prima della produzione).
- **Cosa fare, in due fasi.**

  **Fase A — Provino (ci si ferma fino al via di Michele).** Tre schermate statiche
  dell'interfaccia sopra la mappa vera, a 390 e 1280 px: gioco in corso, finestra del
  Consiglio aperta, dilemma. Più un foglio con tutte le icone. Brief dell'interfaccia
  in `docs/GRAFICA.md`.

  **Fase B — Interfaccia completa.**
  1. *Barra di stato:* anno ed epoca, le tre casse, popolazione, barra Red/Blu,
     comandi del tempo. Su telefono compatta, con il dettaglio al tocco.
  2. *Notizie:* i titoli della Cronaca scorrono in una striscia; al tocco si apre la
     Cronaca. Il movimento si ferma se il sistema chiede meno animazioni.
  3. *Pannello dei comandi* a icone con etichetta (Consiglio, Cantieri, Bilancio,
     Grafici, Politiche, Strati, Elenco, Partita, Aiuto). Su telefono si apre e chiude.
  4. *Minimappa* della zona, ricavata dai dati della mappa: mostra dove si sta
     guardando; toccandola ci si sposta.
  5. *Finestre* con una cornice comune; a pila, risponde solo quella in cima; si
     chiudono con un tocco fuori o con Esc. Su telefono salgono dal basso.
  6. *Spazio per i consiglieri:* nella finestra del Consiglio e nei dilemmi c'è il
     posto per un ritratto (T14); fino ad allora un segnaposto neutro.
- **Fatto quando (fase B):** ogni funzione di oggi resta raggiungibile; a 360, 390,
  1280 px e su un telefono lungo (1080×2340) nessun elemento tagliato o sovrapposto e
  nessuno scorrimento orizzontale (schermate e test); rispetto della zona sicura;
  ogni finestra si apre e si chiude da tastiera e il fuoco resta dentro la finestra
  aperta (test); la minimappa sposta la vista (test); la striscia delle notizie si
  ferma con «riduci animazioni» (test); visita guidata aggiornata e completa; tutte
  le icone nell'elenco degli elementi con origine e licenza; `pnpm test` sotto i 45
  secondi, `pnpm test:lungo` e verifica nel browser verdi.
- **Regole:** come T12. L'architetto mostra le schermate a Michele prima di approvare
  ciascuna fase.

---

## T14 — I consiglieri come personaggi

- **Agenti:** `content-designer` per nomi, biografie e testi; `sim-engineer`
  (interfaccia) per i ritratti. Su decisione di Michele (D21, D22).
- **Dipende da:** T13 unito in `main`.
- **Ramo:** `task/T14-consiglieri`.
- **File:** `packages/content/data/` (file dei consiglieri e suo schema),
  `apps/game/` (ritratti e loro uso), `docs/CONTENUTI.md`, `docs/GRAFICA.md`,
  `docs/grafica-elementi.json`, `docs/schermate/`. Le regole con cui i consiglieri
  decidono (`packages/agents`) **non** cambiano: cambia come si presentano.
- **Perché:** Michele vuole consiglieri che siano personaggi, con volto e nome, non
  deleghe anonime.
- **Cosa fare, in due fasi.**

  **Fase A — Proposta (ci si ferma fino al via di Michele).**
  1. Sei personaggi **inventati** per la prima epoca, uno per delega. Per ciascuno:
     nome e cognome, età, mestiere prima della politica, quartiere, un legame con la
     storia della città, cosa gli sta a cuore, un difetto, un modo di parlare, due
     frasi d'esempio. Equilibrio tra donne e uomini e tra generazioni.
  2. Controllo dei nomi: comuni e credibili a Taranto, mai di persone pubbliche note
     (politici, sindacalisti, dirigenti, giornalisti, vittime); il controllo fatto va
     descritto nel resoconto. Nessun riferimento a sigle, partiti o aziende reali.
  3. Tono sobrio (regola 8): nessun personaggio è una macchietta, nessuno è «il
     buono»; chiunque può proporre una scorciatoia quando la sua causa è alle strette.
  4. Un ritratto di prova per due personaggi, nelle quattro espressioni.

  **Fase B — Realizzazione.**
  1. *Ritratti illustrati dal codice* (SVG generato da parametri: forma del viso,
     capelli, carnagione, abiti, occhiali, età), nello stile della mappa. Nessuna
     immagine esterna, nessun servizio a pagamento. Lo stesso personaggio è sempre
     uguale (parametri fissi nei dati).
  2. *Espressioni:* neutra, soddisfatta, preoccupata, contrariata, scelte dallo stato
     del personaggio nel motore (fiducia verso il giocatore, andamento della sua
     causa). L'interfaccia legge, non decide.
  3. *Uso:* finestra del Consiglio, consigli dell'anno, commenti ai dilemmi, Cronaca.
     Nei testi il consigliere parla in prima persona con il suo stile.
  4. *Epoche successive:* il rinnovo del Consiglio è nel motore e non è ancora fatto
     (tappa M2). Qui si prepara solo il formato dei dati perché ogni epoca possa avere
     i suoi sei personaggi.
- **Fatto quando:** sei personaggi nei dati, validati dallo schema; ogni ritratto
  nelle quattro espressioni, a 390 e 1280 px; l'espressione cambia con lo stato in
  una partita da copione (test); stesso personaggio, stesso disegno (test); i testi
  passano i controlli di contenuto; nessun nome coincide con l'elenco di controllo
  del resoconto; `pnpm test` sotto i 45 secondi, `pnpm test:lungo` e verifica nel
  browser verdi.
- **Regole:** come T12. **Nomi, biografie e ritratti li approva Michele** prima della
  fase B e prima dell'unione: sono contenuti, il giudizio è suo.

---

## T12d — Mai più pagina bianca (urgente)

- **Agente:** `sim-engineer` (interfaccia).
- **Dipende da:** niente. Ha la precedenza su ogni altro lavoro.
- **Ramo:** `task/T12d-pagina-bianca`.
- **File:** `apps/game/index.html`, `apps/game/src/` (avvio e gestione degli errori),
  `apps/game/vite.config.ts`, `apps/game/scripts/verifica.ts`, `docs/GRAFICA.md`.
- **Perché:** il 26 novembre 2026, sul telefono Android di Michele, sia
  `https://supermik1988.github.io/taranto2127/` sia `?mappa=schematica` mostrano una
  pagina completamente bianca. Sul telefono simulato (Pixel 7, Edge) il gioco parte in 2
  secondi senza errori, anche con il processore rallentato 4× e con un salvataggio non
  valido nell'archivio del browser. Oggi, se qualcosa si rompe all'avvio, il giocatore non
  vede nulla e nessuno può capire perché.
- **Causa trovata dall'architetto (26 novembre).** In incognito il gioco funziona anche sul
  telefono di Michele. Il salvataggio automatico conserva seme e mosse; all'avvio
  `startingGame` → `restoreGame` le rigioca con il motore e i contenuti di oggi. Una partita
  salvata con una versione precedente contiene una risposta a un dilemma che oggi, con lo
  stesso seme, non è più aperto: il motore lancia `ActionError` («nessun dilemma aperto: non si
  può rispondere a …») dentro l'inizializzazione di React e la pagina resta bianca. Riprodotto
  sul sito pubblicato (`9cd63f9`) mettendo nell'archivio del browser una partita con
  `{ kind: 'answer-dilemma', dilemmaId: 'dilemma-di-una-versione-vecchia', optionId: 'a' }`.
  Lo stesso vale per il link di una partita (`#partita=`) e per i posti di salvataggio.
- **Cosa fare.**
  1. *Sentinella nella pagina:* in `index.html` un piccolo script classico (non modulo,
     sintassi vecchia, compatibile anche con browser di dieci anni fa) registra gli errori
     della pagina e, se dopo 10 secondi il gioco non è partito, mostra un messaggio leggibile
     in italiano: cosa è successo, il testo dell'errore se c'è, il nome e la versione del
     browser, e due pulsanti: «Riprova» e «Riparti da zero» (cancella i dati del gioco salvati
     nel browser e ricarica). Senza script attivi, un messaggio `<noscript>`.
  2. *Errori dentro il gioco:* un contenitore che intercetta gli errori di React mostra lo
     stesso messaggio, con gli stessi pulsanti, invece della pagina vuota. Un errore nella
     città 3D fa ripiegare sulla mappa schematica, senza fermare il gioco.
  3. *Compatibilità dichiarata:* scegliere e scrivere in `vite.config.ts` il bersaglio di
     compilazione, con i browser minimi supportati (almeno Chrome per Android e Samsung
     Internet degli ultimi quattro anni, Safari iOS 15). Le funzioni recenti usate senza
     traduzione (oggi per esempio `structuredClone`, `Object.hasOwn`, `Array.prototype.at`)
     vanno tolte o sostituite se non coperte da quei browser. Elenco in `docs/GRAFICA.md`.
  4. *Avvio a prova di dati vecchi (la causa vera):* se rigiocare un salvataggio, un link o un
     posto fallisce, la partita non si apre, il giocatore vede un avviso chiaro («Questa
     partita è stata salvata con una versione precedente del gioco e non si può riaprire»)
     e parte una partita nuova; il salvataggio vecchio si conserva da parte finché il
     giocatore non lo cancella. Il salvataggio registra anche la versione del gioco e dei
     dati con cui è stato fatto, così l'incompatibilità si riconosce prima di rigiocare.
- **Fatto quando:** nella verifica nel browser, (0) con la partita salvata descritta sopra
  nell'archivio, nel link e in un posto, il gioco parte con l'avviso e una partita nuova; (a) un errore lanciato apposta all'avvio
  mostra il messaggio e non una pagina bianca; (b) un errore lanciato apposta nella città 3D
  fa comparire la mappa schematica; (c) «Riparti da zero» svuota i dati del gioco e il gioco
  riparte; (d) la pagina compilata non contiene sintassi né funzioni fuori dal bersaglio
  dichiarato (controllo automatico); `pnpm test` sotto i 45 secondi, `pnpm test:lungo` e
  verifica nel browser verdi; almeno tre prove inverse descritte nel resoconto.
- **Regole:** come sempre. Solo il ramo del task; non unire né inviare `main`; non toccare
  `CLAUDE.md`, `docs/ARCHITETTO.md`, `docs/DECISIONI.md`, `docs/TASKS.md`; scelte fuori
  scheda dichiarate come «mia scelta da confermare».

---

## T12e — Tutta la mappa sul telefono

- **Agente:** `sim-engineer` (interfaccia).
- **Dipende da:** T12d unito in `main`.
- **Ramo:** `task/T12e-mappa-telefono`.
- **File:** `apps/game/src/iso/vista.ts` e i suoi test, `apps/game/src/iso/scena.ts`,
  `apps/game/src/plastico/`, `apps/game/src/layout.tsx` e lo stile, `apps/game/scripts/verifica.ts`,
  `docs/GRAFICA.md`, `docs/schermate/`.
- **Perché:** sul telefono di Michele (Android, verticale), anche allontanando la mappa al
  massimo, alcune parti della zona non si vedono. Riprodotto dall'architetto il 26 novembre su
  telefono simulato: (1) alla distanza massima la zona non entra nella larghezza dello schermo
  verticale; (2) il limite dello spostamento non tiene conto dei comandi sopra la mappa (barra in
  alto, comandi del tempo in basso, colonna dei pulsanti a destra, pulsanti di ingrandimento a
  sinistra), quindi i bordi della zona restano nascosti sotto i comandi e non si possono portare
  in vista.
- **Skill da leggere:** `camera-systems` (limiti della vista, zone morte), `game-ui-ux`
  (zona sicura, area libera dai comandi).
- **Cosa fare.**
  1. Calcolare l'*area libera* della mappa: la tela meno i rettangoli dei comandi che la coprono,
     ricalcolata quando la finestra cambia, quando un pannello si apre o si chiude e quando il
     telefono ruota.
  2. Alla distanza massima, l'intera zona entra nell'area libera in ogni orientamento della
     mappa e a ogni larghezza (360, 390, 1280 px e telefono lungo 1080×2340).
  3. Il limite dello spostamento si calcola sull'area libera: ogni punto della zona si può
     portare dentro l'area libera, nessuno resta per forza sotto un comando.
  4. Restano valide le prove di T12: gli angoli dello schermo non mostrano mai lo sfondo (oltre la
     zona continuano terreno e mare).
- **Fatto quando:** prova nel browser a 360, 390, 1280 px e 1080×2340, nei quattro
  orientamenti: alla distanza massima i quattro vertici della zona cadono dentro l'area libera;
  spingendo la vista verso ciascun bordo, il vertice di quel lato si porta nell'area libera;
  schermate prima/dopo alla distanza massima; `pnpm test` sotto i 45 secondi, `pnpm test:lungo` e
  verifica nel browser verdi; almeno due prove inverse descritte.
- **Correzione dopo la revisione (26 novembre 2026, decisa da Michele).** Il primo invio
  (`9f95381`) rispetta il punto 2 alla lettera, ma sul telefono in verticale la zona, vista di
  sbieco, diventa un rombo largo e basso: per farla entrare tutta la città si riduce a un rombo
  minuscolo in mezzo a un prato finto con una striscia di mare dritta. Michele sceglie la via di
  mezzo. Il punto 2 diventa:
  - alla distanza massima la zona *riempie in larghezza* l'area libera: la larghezza del suo
    ingombro sullo schermo è almeno quella dell'area libera, in ogni orientamento della mappa;
    se a quella distanza la zona entra già tutta (schermi larghi, come il computer), si usa la
    distanza a cui entra tutta, con il 4% d'aria;
  - alla distanza massima almeno il 70% dell'area libera cade sopra la zona (calcolo
    geometrico, a 360, 390 px e 1080×2340 nei quattro orientamenti);
  - i lati che restano fuori si raggiungono trascinando: restano validi i punti 1, 3 e 4 e le
    prove delle spinte verso i bordi;
  - schermate nuove alla distanza massima, prima e dopo la correzione, alle stesse quattro
    larghezze e nei quattro orientamenti.
  Il resto del primo invio è accettato, comprese le scelte da confermare (margine di 8 pixel,
  terreno fino a 60 km, comandi riconosciuti dalle classi, rimozione di `startingGame`).
- **Regole:** come sempre.

---

## T16 — Partita guidata (tutorial dei primi cinque anni)

- **Agenti:** `sim-engineer` (interfaccia) e `content-designer` (testi). Su proposta di Michele
  del 26 novembre 2026: chi non conosce il gioco non sa cosa fare, anche con la visita guidata.
- **Dipende da:** T12e unito in `main`.
- **Ramo:** `task/T16-partita-guidata`.
- **File:** `apps/game/` (interfaccia del tutorial), `packages/content/data/tutorial.json` e il
  suo schema (nuovi), `packages/content/data/guida.json` se cambia il ruolo della visita,
  `docs/CONTENUTI.md`, `docs/GRAFICA.md`, `docs/schermate/`. Il motore non si tocca: il tutorial
  legge lo stato e aspetta le azioni del giocatore, non ne fa al suo posto (regola 1).
- **Skill da leggere:** `game-ui-ux` (fuoco da tastiera, finestre a pila, evidenziazione,
  accessibilità, prove a più larghezze).
- **Cosa fare.**
  1. *Scelta all'avvio:* «Partita guidata (consigliata la prima volta)» oppure «Partita
     libera». La scelta si ricorda; la visita guidata di oggi non si apre più da sola e resta
     consultabile dal pulsante «?».
  2. *Seme fisso:* la partita guidata usa un seme scelto e documentato perché nei primi cinque
     anni succeda ciò che il tutorial insegna (per esempio un dilemma entro il secondo o terzo
     anno, una notizia nella Cronaca, un cantiere che passa di fase). Una prova verifica che con
     quel seme gli eventi arrivino davvero quando il tutorial li annuncia.
  3. *Un passo alla volta, facendo:* ogni passo ha un testo breve (al massimo due frasi, parole
     semplici), evidenzia il comando da toccare e scurisce il resto, e va avanti solo quando il
     giocatore ha fatto l'azione (non a tempo). Traccia indicativa, da rifinire: guardare la città
     e gli strati; aprire il Consiglio e leggere un consiglio; scegliere un lotto e avviare il
     primo cantiere; guardare il bilancio; far passare un anno e leggere la Cronaca; rispondere al
     primo dilemma e vedere il contatore Red/Blu; capire le fasi di un cantiere; seguire i
     cantieri aperti; arrivare alla fine del quinto anno. Il tutorial non suggerisce mai la
     scelta "giusta": spiega cosa si può fare e dove guardare le conseguenze (regola 5).
  4. *Sempre facoltativo:* «Esci dal tutorial» in ogni passo; si riprende da «?» dal punto in cui
     si era. Alla fine del quinto anno la partita continua normalmente.
  5. *Testi nei dati:* in `tutorial.json` con schema, in italiano, tono sobrio (regola 8). Ogni
     passo indica il comando da evidenziare con l'identificativo stabile già usato dalle prove
     (`data-testid`), così l'interfaccia nuova di T13 dovrà solo mantenerli.
  6. *Accessibilità:* testo letto dai lettori di schermo, fuoco da tastiera sul comando
     evidenziato, nessuna animazione con «riduci animazioni», funziona a 360 px in verticale e
     anche con la mappa schematica.
- **Fatto quando:** una partita da copione completa il tutorial a 360, 390 e 1280 px, con la città
  3D e con la mappa schematica; uscire e riprendere funziona (prova); ogni passo trova il suo
  comando sullo schermo e non lo copre (prova); con il seme fisso gli eventi annunciati arrivano
  (prova); i testi passano i controlli di contenuto; `pnpm test` sotto i 45 secondi,
  `pnpm test:lungo` e verifica nel browser verdi; almeno tre prove inverse descritte. **Michele
  approva testi e schermate prima dell'unione.**
- **Regole:** come sempre.
