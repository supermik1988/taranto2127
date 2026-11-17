# Consegne per l'architetto di TARANTO2127

Questo file è il passaggio di consegne all'architetto che lavora dentro
Antigravity. Leggilo per intero prima di fare qualsiasi cosa, poi leggi
`CLAUDE.md`, `docs/DECISIONI.md`, `docs/TASKS.md`, `docs/BILANCIAMENTO.md` e
`docs/CONTENUTI.md`. Tienilo aggiornato: quando una decisione cambia, cambia
anche qui.

Stato descritto: 15 novembre 2026, mattina.

## 1. Il tuo ruolo

Sei l'architetto dell'applicazione. Dirigi le modifiche e il flusso di lavoro;
Michele è il direttore del progetto e ha l'ultima parola su visione, contenuti
e aspetto.

- **Decidi tu:** architettura, ordine dei task, criteri di accettazione,
  bilanciamento, scelte tecniche, punti aperti lasciati dagli agenti.
- **Decide Michele:** tutto ciò che riguarda cosa il gioco dice e come appare
  (testi, tono, grafica, nomi, pubblico), i costi, i rapporti con l'esterno.
  Su questi punti proponi con una raccomandazione chiara e aspetta la risposta.
- **Non scrivere tu il codice dei task.** Scrivi la scheda, affidala a un
  agente esecutore, rivedi il risultato. Chi scrive non approva il proprio
  lavoro. Le correzioni minime emerse in revisione (una riga, un testo) puoi
  farle direttamente.

Come parlare con Michele: in italiano, in stile divulgativo, senza gergo.
Non è un programmatore: spiega il perché di ogni scelta e ogni termine
tecnico che usi. Comincia sempre dalla conclusione. Verifica sempre il lavoro
prima di dichiararlo fatto, e di' con chiarezza cosa hai verificato tu e cosa
ti è stato solo riferito.

## 2. Il metodo, da non cambiare

Ha retto per venti task senza una regressione. Per ogni task:

1. **Scheda.** Aggiungila a `docs/TASKS.md`: ruolo dell'agente, ramo, file
   che può toccare, cosa fare, e un elenco "Fatto quando" di criteri
   verificabili. Ogni autorizzazione fuori dai file della scheda va scritta.
2. **Esecuzione.** Un agente esecutore, su un ramo `task/Txx-nome`. Un solo
   agente per volta sulle stesse cartelle.
3. **Regole per l'esecutore:**
   - ogni criterio "Fatto quando" ha un test;
   - prova inversa: introduce un errore per volta e verifica che un test
     cada; se un errore passa inosservato, rafforza i test;
   - invia a GitHub solo dopo il verde su un clone pulito;
   - non unisce a `main`;
   - modifica `packages/sim/src/state.ts` solo se autorizzato, ed elenca ogni
     modifica;
   - resoconto finale in tre parti: cosa ho fatto, cosa ho verificato, cosa
     resta aperto (comprese le scelte sue da confermare).
4. **Revisione, fatta da te su un clone pulito del ramo:**
   - `corepack pnpm install --frozen-lockfile`, `corepack pnpm typecheck`,
     `corepack pnpm test`; se il task tocca valori o motore anche
     `corepack pnpm balance -- --partite 200`;
   - `git diff` rispetto a `main` sui file che la scheda non autorizzava;
   - leggi il codice dei punti delicati;
   - per l'interfaccia apri le schermate in `docs/schermate/` una per una e,
     potendo, prova il gioco nel browser a 390 e a 1280 px.
5. **Decisioni.** Rispondi a ogni punto aperto del resoconto: confermato,
   da correggere, rinviato (e a quale task).
6. **Unione.** Dopo le correzioni e un nuovo verde, unisci in `main` e
   controlla che la procedura "Pubblica il gioco" di GitHub arrivi in fondo.
7. **Resoconto a Michele:** cosa hai verificato, cosa cambia per chi gioca,
   cosa gli chiedi di guardare o decidere.

Quando un criterio contraddice un vincolo di progetto, non scegliere in
silenzio: spiega il conflitto. Quando un agente smentisce una tua ipotesi con
un esperimento, ha ragione l'esperimento.

## 3. Il progetto in breve

TARANTO2127 è un gestionale cittadino, civico e open source. Il giocatore è
la coscienza di Taranto e la accompagna per cento anni, dal 2027 al 2127,
dopo la chiusura dello stabilimento siderurgico ILSIDER (nome inventato,
ispirato a fatti reali del novembre 2026). Scopo: far discutere la
cittadinanza e, in prospettiva, diventare uno studio di ricerca sulle
simulazioni sociali.

- Repository pubblico: `supermik1988/taranto2127`. Cartella locale:
  `D:\NEW FILE\TARANTO2127`.
- Gioco online: https://supermik1988.github.io/taranto2127/ (si aggiorna a
  ogni invio su `main`).
- Licenze: AGPL-3.0 per il codice, CC BY-SA 4.0 per i contenuti.
- Tecnica: monorepo pnpm, TypeScript rigoroso, Vitest. Il motore gira nel
  browser senza server.

| Cartella | Contenuto |
| --- | --- |
| `packages/sim` | Motore: stato, turno annuale, progetti a fasi, economia, lavoro, morale, dilemmi, politiche, dinamica dei quartieri, spiegazioni |
| `packages/content` | Tutti i numeri e i testi, in JSON con schema; ogni numero è una stima dichiarata o ha una fonte |
| `packages/agents` | Consiglio a regole (sei consiglieri) |
| `packages/voices` | Vuoto: voci con modello linguistico, tappa futura |
| `tools/balance` | Bot che giocano migliaia di partite |
| `tools/play` | Partita dal terminale |
| `apps/game` | Interfaccia web (Vite, React) |

## 4. Decisioni di Michele

| # | Decisione |
| --- | --- |
| D1-D2 | Titolo TARANTO2127; 100 anni, 2027-2127; un turno è un anno; 5 epoche da 20 anni |
| D3 | Pubblico: la cittadinanza; il gioco deve creare dibattito |
| D4 | Stabilimento con nome inventato: ILSIDER |
| D5 | Il giocatore è la coscienza della città |
| D6 | Contatore morale Red/Blu, i colori della bandiera cittadina |
| D7 | Niente coppia "buono e cattivo": voci dei cittadini e un Consiglio di sei consiglieri AI con visioni diverse |
| D8 | Desktop e mobile |
| D9 | Costi di sviluppo e strumenti a carico di Michele |
| D10-D11 | Sessione di almeno un'ora; costruzioni e decisioni con tempi realistici |
| D12 | Esperimento sociale innovativo che possa diventare studio di ricerca |
| D13 | Gli strumenti li sceglie l'architetto |
| D14 | Calibrazione in due tempi: prima stime dichiarate e dati pubblici, poi interviste e partner accademico |
| D15-D16 | Open source, repository pubblico |
| D17 | Consiglieri indicati per delega, senza nomi di persona |
| D18 | Grafica: plastico 3D della città, effetto modellino, luce morbida, colori pieni. Mappa a tutto schermo che si ingrandisce, comandi ai bordi, finestre al tocco |
| D19 | Lo sviluppo prosegue interamente dentro Antigravity, con l'architetto lì |

Aggiungi D18 e D19 a `docs/DECISIONI.md` se mancano.

## 5. Principi da non tradire

1. **Il contatore misura come si governa, mai quale futuro si sceglie.**
   Nessuna strada di riconversione (acciaio verde, bonifica, energia, mare e
   cultura) ha un peso morale. Le dimensioni sono cinque: verità, parola,
   cura, legalità, ascolto.
2. **La scorrettezza conviene subito e costa dopo.** Coscienza (reale) e
   reputazione (ciò che i cittadini credono) sono due numeri; lo scarto
   alimenta gli scandali. Le scelte nascoste non si rivelano mai prima.
3. **Nessuna strada è la migliore su tutto.** Ognuna ha un punto forte e uno
   debole diversi.
4. **Solo il motore modifica lo stato.** L'interfaccia lo legge e gli manda
   azioni. Un modello linguistico, quando arriverà, darà solo parole.
5. **Determinismo.** Stesso seme e stessa storia danno la stessa partita.
   Vietati `Math.random` e `Date.now` in `sim` e `agents`.
6. **Tutti i numeri nei dati**, mai nel codice. Mai fonti inventate.
7. **Tempi realistici.** Ogni opera attraversa progettazione, autorizzazioni,
   gara, lavori, esercizio. Nessun effetto istantaneo.
8. **Rispetto.** Il tema tocca malattie e lutti veri. Tono sobrio; luoghi
   reali; persone, sigle, aziende e stabilimento inventati; nessuna morte o
   malattia come punteggio.
9. **Prima il telefono.** Ogni schermata funziona a 360 px, in verticale.
10. **Ispirazione, non copia.** Nessun modello, immagine, insegna o elemento
    di interfaccia preso da altri giochi. Materiale originale o con licenza
    libera compatibile, annotata.

## 6. Stato dei lavori

| Task | Contenuto | Stato |
| --- | --- | --- |
| T01-T08 | Motore completo, contenuti con stime, bilanciamento, partita dal terminale | In `main` |
| T09, T09b | Prototipo web: mappa schematica, grafici, spiegazioni, cantieri, Consiglio, Cronaca, dilemmi, finale, pubblicazione | In `main` |
| T10 | Tempo che scorre e si ferma da solo, niente limite di azioni, visita guidata, bilancio, grafici per telefono, 24 dilemmi, menu della partita | In `main` dal 15 novembre, con le due correzioni; pubblicato |
| T11 | Plastico 3D di una zona e nuova disposizione | In `main` dal 17 novembre, con le correzioni chieste da Michele; pubblicato |
| T11b | Prove più veloci; lotto «Banchine» sul Mar Grande | Scheda pronta, ramo `task/T11b-rifiniture` |

Ultimo `main` verificato: `9940e43` (T11). Su clone pulito: 451 test in `pnpm test`
(62 s, eslint compreso: oltre il limite, da sistemare in T11b), 41 in
`pnpm test:lungo`; verifica nel browser riuscita; plastico a 51 immagini al
secondo sul telefono simulato; procedura «Pubblica il gioco» arrivata in fondo.

Nota sui ruoli: l'esecutore lavora in contemporanea nella stessa cartella.
L'architetto non cambia ramo lì: rivede su un clone pulito. In T10 l'esecutore ha
unito e inviato `main` da solo, prima della fine della revisione; la scheda T11
lo vieta espressamente.

Obiettivi di bilanciamento, su 1.000 partite per bot (arrivo al 2127):
Blu 40-70%; Red 15-45%; casuale 30-60%; ognuna delle quattro strade 40-80%
con non più di 25 punti tra migliore e peggiore; prudente 40-70%; nessuna
azione 0-10% con dissesto mediano tra 2045 e 2065. Vincoli: Blu meglio di
Red; le scelte scorrette restano convenienti subito; almeno una partita Red
su venti finisce con la città che si volta. Chi non fa nulla va in dissesto:
è voluto. Dopo T10: Blu 44%, Red 18%, casuale 48%, strade 49-68%.
Blu è vicino al limite basso: è il primo numero da ricontrollare.

## 7. Prossimi passi, in ordine

### 7.1 Chiudere T10 — fatto il 15 novembre 2026 (`main` a `d184e08`)

Due correzioni sullo stesso ramo, poi verde su clone pulito, unione in
`main`, controllo della pubblicazione:

1. Spostare le prove da 1.000 partite in un comando a parte
   (`pnpm test:lungo`), eseguito nella procedura di GitHub ma non da
   `pnpm test`, che deve restare sotto il minuto.
2. Riga dei motivi di fermata: il motivo principale più "e altri N", con
   l'elenco completo al tocco.

### 7.2 T11, "Plastico di una zona e nuova disposizione" — fatto il 17 novembre 2026 (`main` a `9940e43`)

Ramo `task/T11-plastico`. File: `apps/game/`, `packages/content/geo/`,
`docs/GRAFICA.md`.

1. **Dati geografici.** Scaricare da OpenStreetMap, una volta sola, la zona
   dei Tamburi, dell'area industriale e del tratto di Mar Piccolo adiacente:
   costa, strade principali, sagome degli edifici, aree verdi. Salvare nel
   repository un file ridotto, con l'attribuzione richiesta. Il gioco non
   scarica nulla durante la partita.
2. **Scena 3D nel browser.** Terreno, mare, strade ed edifici come volumi
   ricavati dalle sagome, con altezze plausibili, tetti e colori variati in
   modo ripetibile. Luce di giorno sereno, ombre leggere, effetto modellino
   con sfocatura ai bordi. Camera che si sposta, ruota e ingrandisce con
   mouse e dita.
3. **ILSIDER.** I sei lotti nella posizione reale dello stabilimento, con un
   aspetto diverso per stato: fermo (impianti spenti, ruggine), in lavori
   (gru, recinzioni), acciaio verde (capannoni nuovi, un camino con poco
   fumo), bonifica conclusa (bosco giovane), energia (pale che girano,
   pannelli), mare e cultura (banchine aperte, edifici pubblici).
4. **Strati.** Un comando accende sopra il plastico il colore
   dell'indicatore scelto (aria, salute, fiducia, tensione), con legenda e
   valore numerico.
5. **Disposizione.** Mappa a tutto schermo. In alto anno, fondi e barra
   Red/Blu; in basso i comandi del tempo; su un lato Consiglio, cantieri,
   bilancio, grafici, strati. Toccare un quartiere, un lotto o un pulsante
   apre una finestra sopra la mappa, che si chiude con un tocco fuori. Su
   telefono le finestre salgono dal basso.
6. **Prestazioni.** Almeno 30 immagini al secondo su un telefono di fascia
   media, misurate. Se il dispositivo non regge il 3D, si usa la mappa
   schematica attuale.
7. **Accessibilità.** Ogni informazione della mappa resta raggiungibile da un
   elenco testuale.
8. **`docs/GRAFICA.md`:** scelte tecniche, tavolozza, origine e licenza di
   ogni modello, cosa manca per estendere il plastico a tutta la città.

Fatto quando: la zona si riconosce confrontandola con la cartografia; ogni
stato di lotto ha un aspetto distinto e cambia durante una partita da
copione; toccare un lotto apre la sua finestra; lo strato dell'aria mostra il
valore corretto; nessun errore in console; schermate a 390 e 1280 px,
compresa una per ogni stato di lotto; il resto del gioco funziona.

**Prima di approvare T11 mostra le schermate a Michele.** Sull'aspetto il
giudizio è suo. Ha mandato come riferimento immagini di un gestionale
cittadino in 3D: l'atmosfera è raggiungibile, il dettaglio di ogni edificio
no, e gli è già stato detto. Si procede una zona alla volta.

### 7.3 Dopo, nell'ordine che ritieni giusto

- **Politiche e bilancio (rilievo di Michele: "statiche").** Sostituire gli
  interruttori con due livelli: un bilancio annuale per settore (sanità,
  scuola, trasporti, ambiente, sostegno al reddito) con resa decrescente, e
  ordinanze a tempo che scadono e si rinnovano, alcune richieste da
  consiglieri o cittadini, alcune legate a un'epoca. Tocca il motore e
  richiede un nuovo bilanciamento. Nello stesso task: far pagare ai fondi
  europei i lavori di bonifica, oggi fermi per mancanza di soldi mentre 80
  milioni europei restano inutilizzati.
- **T05b, fonti.** Sostituire le stime con dati pubblici, cominciando dai
  fondi di partenza: Michele ha chiesto su cosa si basano, e la risposta
  onesta è "su nulla di reale, per ora". Ogni fonte va aperta e letta da te.
- **Estendere il plastico** a tutta la città, poi luoghi simbolo e movimento.
- **Cittadini (tappa M2).** Circa 2.000 agenti a regole, generazioni con
  memoria ereditata, nascite, partenze e rientri, proteste, fazioni. Tutte
  le loro decisioni passano da un'unica interfaccia, così il "cervello" è
  sostituibile: regole di serie; modello decisionale e modello linguistico
  solo come bracci sperimentali dello studio. Qui entra anche il rinnovo del
  Consiglio a ogni epoca, previsto e non ancora fatto.
- **Consenso e archivio anonimo delle partite.** Da costruire prima di
  qualunque raccolta di dati: una partita raccolta senza consenso valido non
  potrà mai entrare in uno studio.
- **Voci** con modello linguistico e frasi pregenerate di riserva, con tetto
  di spesa.
- **Prova sul campo** con cittadini e partner accademico.

## 8. Cose note da tenere d'occhio

- La popolazione è ferma: nessuna nascita, morte o migrazione.
- Trattative con le fazioni e risposte alle proteste sono azioni registrate
  senza effetti. Le promesse a testo libero restano aperte.
- Va verificato che livello del mare e caldo abbiano conseguenze sui
  quartieri e non siano solo numeri che salgono.
- Quando il bot onesto fallisce lo fa presto, quello scorretto tardi. È
  realistico, ma va osservato con giocatori veri.
- In `docs/TASKS.md` le schede originarie su cervello intercambiabile e
  consenso avevano numeri poi riusati: controlla e rinumera.
- Nella riga dei valori del quartiere "Esposizione" si tronca a 1280 px.
- La procedura di pubblicazione usa strumenti che GitHub sta dismettendo:
  funziona, andrà aggiornata.
- Il documento di architettura online su Claude è alla prima stesura e non
  fa più fede: fanno fede questo file e `docs/DECISIONI.md`.

## 9. Cosa ha detto Michele dopo la prima partita

Lo ha giocato dal telefono e lo ha trovato poco intuitivo. T10 risponde a
quasi tutto; restano aperti grafica (T11) e politiche (7.3). Dopo ogni
rilascio chiedigli sempre le stesse quattro cose: dove si è sentito perso,
su quale scelta ha esitato, quando si è annoiato, se la mappa gli sembra
Taranto. Le sue risposte valgono più dei bot: i bot dicono se i numeri
tornano, non se il gioco si capisce.

Domande ancora aperte con lui: se preferisce "Consigliere al bilancio" o
"all'amministrazione pubblica"; chi può essere il partner accademico e chi
ospita le prime prove con i cittadini.

## 10. Strumenti

- **Higgsfield** (collegato all'account di Michele): utile per bozzetti,
  trailer e, forse, modelli 3D dei luoghi simbolo. Prima di usare nel gioco
  qualcosa che produce, verificare che la licenza sia compatibile con un
  progetto aperto. Ogni generazione costa crediti a Michele: chiedi prima.
- **Chiavi e segreti** solo nel file `.env`, mai nel repository.
