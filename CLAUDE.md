# TARANTO2127 — regole per gli agenti

Leggi questo file e `docs/DECISIONI.md` prima di toccare qualsiasi cosa.

## Cos'è

Gestionale cittadino a turni, nel browser, desktop e mobile. Il giocatore è la
coscienza di Taranto e accompagna la città per 100 anni (2027-2127) dopo la
chiusura dello stabilimento siderurgico ILSIDER (nome inventato). Un contatore
morale Red/Blu misura *come* il giocatore governa, mai *quale* futuro sceglie.
Pubblico: la cittadinanza. Scopo: far nascere dibattito.

## Moduli e confini

| Cartella            | Contenuto                                              | Chi ci lavora        |
| ------------------- | ------------------------------------------------------ | -------------------- |
| `packages/sim`      | stato, turno, regole, effetti ritardati, morale        | `sim-engineer`       |
| `packages/agents`   | cittadini a regole, generazioni, proteste, consiglio   | `citizen-engineer`   |
| `packages/content`  | quartieri, leve, dilemmi, archetipi, coefficienti      | `content-designer`   |
| `packages/voices`   | contesto, formato, filtro, frasi di riserva            | `voice-engineer`     |
| `apps/server`       | passaggio verso il modello linguistico, cache, tetto   | `voice-engineer`     |
| `tools/balance`     | bot che giocano partite senza grafica                  | `balance-tester`     |
| `apps/game`         | interfaccia (React + PixiJS)                           | Antigravity          |

Un agente modifica solo le proprie cartelle. Se serve altro, apre una richiesta.

## Regole che non si discutono

1. **Solo `packages/sim` modifica lo stato della città.** Interfaccia e voci lo leggono.
2. **Il modello linguistico produce solo testo.** Non decide numeri, esiti, accordi.
3. **Determinismo.** Stesso seme e stesse azioni danno la stessa partita. Vietati
   `Math.random()` e `Date.now()` in `sim` e `agents`: usa il generatore in `sim/rng`.
4. **I numeri stanno nei dati.** Coefficienti e soglie in `packages/content`, non nel codice.
5. **Il contatore morale non giudica le strade di riconversione.** Nessuna leva
   (acciaio, bonifica, energia, mare) ha un peso morale in sé. Lo hanno solo le
   cinque dimensioni: verità, parola, cura, legalità, ascolto.
6. **Tutto inventato tranne i luoghi.** Quartieri e geografia reali; persone,
   sigle, aziende e stabilimento inventati. Mai nominare persone reali.
7. **Ogni dato reale ha una fonte** annotata nel campo `fonte` del file di dati.
8. **Tono.** Il tema tocca malattie e lutti veri: sobrio, mai morti "a punteggio".
9. **Prima il tocco.** Ogni schermata deve funzionare a 360 px di larghezza, in verticale.
10. **Tempi realistici.** Un turno è un anno. Ogni progetto attraversa fasi con
    durate prese dai dati e documentate da una fonte. Nessun effetto istantaneo.
11. **Il contratto** tra motore e interfaccia è `packages/sim/src/state.ts`. Si
    cambia solo con l'approvazione dell'architetto.

## Lavorare

- Un ramo per task (`task/T03-ciclo-turno`), unione solo con test verdi.
- Comandi: `pnpm install`, `pnpm test` (sotto il minuto), `pnpm test:lungo` (prove lunghe,
  eseguite anche da GitHub), `pnpm typecheck`, `pnpm balance -- --partite 1000`.
- Ogni task ha una scheda in `docs/TASKS.md`: non uscire dai file elencati lì.
- Testi di gioco e documentazione in italiano; nomi nel codice in inglese.
- Le chiavi stanno solo in `.env`, che Git ignora. Mai una chiave nel codice o in un commit.
- A fine task: cosa hai fatto, cosa hai verificato, cosa resta aperto. Niente altro.
