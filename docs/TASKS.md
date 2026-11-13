# Schede dei task — tappe M0 e M1

Ogni scheda si passa così com'è a un agente. Un agente lavora solo sui file
elencati. Ordine: T01, poi T02, poi T03 e T05 in parallelo, poi T04, poi T06.

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
- **Dipende da:** T03
- **File:** `packages/sim/src/moral.ts`, test.
- **Cosa fare:** aggiornare coscienza e reputazione dalle scelte, per dimensione.
  Un atto nascosto abbassa solo la coscienza e finisce in `hiddenActs`. A ogni
  turno, probabilità di scandalo crescente con lo scarto tra reputazione e
  coscienza; lo scandalo porta la reputazione sotto la coscienza. Le promesse
  scadute diventano `broken` e pesano sulla dimensione "parola".
- **Fatto quando:** un test dimostra che nessuna azione `convert-lot` muove il
  contatore (regola 5 di CLAUDE.md); saltare una fase di un progetto registra un
  atto nascosto sulla dimensione "legalità"; con dieci atti nascosti lo scandalo avviene
  entro 20 turni in almeno il 95% di 1.000 semi.

## T05 — Dati dei sei quartieri e durate dei progetti

- **Agenti:** `content-designer` scrive, `fact-checker` verifica
- **Dipende da:** T01
- **File:** `packages/content/districts.json`, `packages/content/projects.json`,
  `packages/content/schema/`, `docs/FONTI.md`.
- **Cosa fare:** schema JSON dei quartieri e valori di partenza al 2027. Ogni
  valore reale ha un campo `fonte` con indirizzo e data di consultazione (ISTAT,
  ARPA Puglia, studi epidemiologici pubblici). Dove manca un dato, usare una
  stima marcata `"stima": true` con la motivazione. In `projects.json`, le
  prime dieci definizioni di progetto con la durata minima e massima di ogni
  fase, ricavate da casi reali comparabili in Italia o in Europa.
- **Fatto quando:** i file passano la validazione dello schema; `fact-checker`
  ha aperto ogni fonte e firmato `docs/FONTI.md`; nessun valore è senza `fonte` o `stima`.

## T06 — Bot di bilanciamento

- **Agente:** `balance-tester`
- **Dipende da:** T04
- **File:** `tools/balance/`.
- **Cosa fare:** comando `pnpm balance -- --partite N` che fa giocare quattro
  bot (tutto Blu, tutto Red, casuale, "una sola strada") e stampa per ciascuno
  la distribuzione dei finali e gli indicatori medi al 2127.
- **Fatto quando:** 1.000 partite terminano senza errori in meno di due minuti;
  il rapporto segnala in rosso ogni strategia che ottiene lo stesso finale in
  più del 90% dei casi.

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
