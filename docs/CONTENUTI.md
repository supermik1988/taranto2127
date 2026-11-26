# Contenuti di gioco

I contenuti stanno in `packages/content/data/`, un file JSON per argomento, ciascuno
con il suo schema in `packages/content/schema/`. Il caricatore
(`packages/content/src/load.ts`) li valida, toglie annotazioni e testi e consegna al
motore i numeri nella forma che `packages/sim` si aspetta.

Versione di calibrazione: **`0.2-stime`** (valori ritarati dal bilanciamento T06b, vedi `docs/BILANCIAMENTO.md`). In questa versione **ogni numero è una
stima dichiarata**: nessuno viene da una fonte verificata. La verifica è il compito
della scheda T05b.

## Come è scritto un numero

Nessun numero compare da solo. Ognuno porta accanto la sua giustificazione:

```json
"airQuality": {
  "valore": 35,
  "stima": true,
  "motivazione": "Valore di partenza stimato su una scala 0-100; il metodo di lettura del dato reale è in docs/CONTENUTI.md."
}
```

Quando un dato verrà da una fonte, `stima` e `motivazione` lasceranno il posto a:

```json
"fonte": { "indirizzo": "…", "consultatoIl": "AAAA-MM-GG", "descrizione": "…" }
```

Lo schema ammette l'una o l'altra forma, mai entrambe. Un test controlla che nessun
numero ne sia privo; un altro, solo per questa versione, che non ci siano fonti.

## I file

| File | Contenuto |
| --- | --- |
| `quartieri.json` | I sei quartieri: residenti per età e dieci indici di partenza |
| `partenza.json` | Lavoro, economia e clima al 2027; i sei lotti di ILSIDER; i sei consiglieri |
| `clima.json` | Lo scenario climatico, con la variazione annua per ciascuna delle cinque epoche |
| `progetti.json` | Tredici progetti a fasi, compresi i quattro di riconversione dei lotti |
| `politiche.json` | Otto politiche, una delle quali di formazione |
| `dilemmi.json` | Sei dilemmi, con i testi e le conseguenze di ogni opzione |
| `parametri.json` | Ritmo dei dilemmi, parametri del contatore morale ed economici |
| `tutorial.json` | La partita guidata dei primi cinque anni: scelta all'avvio, seme, quindici passi (T16) |

I testi (`nome`, `descrizione`, `titolo`, `testo`, `etichetta`, `conseguenze`) restano
in italiano nei file e il caricatore li restituisce a parte, per interfaccia e voci.
Le chiavi dei dati sono quelle del motore, in inglese.

## La partita guidata (T16)

`tutorial.json` (schema `schema/tutorial.schema.json`) contiene la partita guidata dei primi
cinque anni: la scelta all'avvio, il seme e quindici passi. Il caricatore la restituisce in
`content.tutorial`, solo per l'interfaccia: il motore non la legge e il tutorial non fa
azioni al posto del giocatore (regola 1).

- **Scelta all'avvio:** «Partita guidata (consigliata la prima volta)» o «Partita libera».
  Compare solo a chi arriva per la prima volta (nessuna scelta salvata, nessuna visita già
  fatta, nessuna partita salvata o nel link) e si ricorda.
- **Seme:** 24, con stima e motivazione come ogni numero. Trovato cercando tra i primi semi
  quello per cui, con qualunque lotto e qualunque strada, il primo cantiere cambia fase alla
  fine del primo anno (il passo «cantieri» lo annuncia dopo il dilemma) e il primo dilemma
  arriva alla fine del secondo anno, mai prima (il passo «dilemma-attesa» lo annuncia dopo la
  prima Cronaca); la Cronaca ha titoli ogni anno. Lo verifica
  `apps/game/src/tutorial.test.ts`, per i sei lotti e le quattro strade.
- **Passi:** ognuno ha `id`, `testo` (al massimo due frasi, parole semplici),
  `evidenzia` (i `data-testid` dei comandi, in ordine di preferenza: si evidenzia il primo
  sullo schermo e non coperto; per esempio «Chiudi» quando una finestra copre il comando) e
  `attesa`, l'azione del giocatore che fa andare avanti il passo:

  | Attesa | Quando è fatta |
  | --- | --- |
  | `pannello` | è aperta la finestra indicata (strati, consiglio, cantieri, bilancio…) |
  | `strato` | uno strato colora i quartieri |
  | `finestra-chiusa` | nessuna finestra è aperta |
  | `lotto-aperto` | è aperta la finestra di un lotto |
  | `cantiere-avviato` | un lotto ha una strada |
  | `anno` | la partita è arrivata alla fine dell'anno indicato (numero annotato) |
  | `cronaca` | la Cronaca è aperta |
  | `dilemma-aperto`, `dilemma-risposto` | un dilemma è arrivato, oppure ha avuto risposta |
  | `vede` | il comando indicato è sullo schermo (per esempio una spiegazione) |
  | `fine` | il giocatore tocca «Fine» |

- `primaChiudi` è la frase aggiunta quando il passo deve evidenziare un pulsante di chiusura
  al posto del suo comando.
- **Controlli dei testi** (`packages/content/src/experience.test.ts`): al massimo due frasi
  e 180 caratteri per passo; nessuna parola che suggerisca una scelta giusta («conviene»,
  «meglio», «dovresti», «migliore», «sbagliato» e simili, regola 5); nessun nome reale di
  azienda né morti a punteggio (regola 8). I comandi indicati devono esistere
  nell'interfaccia (`apps/game/src/tutorial.test.ts`): sono i `data-testid` stabili che
  l'interfaccia nuova di T13 dovrà mantenere.

## Gli indici da 0 a 100

Il motore lavora con indici da 0 a 100. Per ognuno: che cosa rappresenta e come si
leggerà il dato reale che sostituirà la stima. La regola di lettura proposta è una
**trasformazione lineare tra due soglie dichiarate**: il valore reale peggiore
ragionevole vale 0, il migliore ragionevole vale 100, e le soglie scelte vanno
scritte nella fonte. Sono proposte di metodo: le confermerà T05b.

### Quartieri

| Indice | Che cosa rappresenta | Come si leggerà il dato reale |
| --- | --- | --- |
| `airQuality` | Qualità dell'aria respirata nel quartiere; 100 = aria pulita | Medie annue di PM10 e PM2,5 delle centraline della rete regionale più vicine al quartiere. 100 al valore guida dell'Organizzazione mondiale della sanità, 0 a un multiplo dichiarato del limite di legge |
| `contaminatedSoil` | Quota di suolo del quartiere con contaminazione accertata; 100 = tutto contaminato | Superficie con superamenti delle soglie di contaminazione nelle caratterizzazioni ufficiali, divisa per la superficie del quartiere |
| `cumulativeExposure` | Esposizione accumulata negli anni agli inquinanti; scende lentamente anche quando l'aria migliora | Somma pesata degli anni di esposizione stimati dagli studi di epidemiologia ambientale pubblicati, normalizzata tra il quartiere meno e quello più esposto della città |
| `health` | Condizioni di salute della popolazione residente, come indicatore aggregato | Indicatori di ricorso alle cure e di prevalenza di patologie croniche per distretto sanitario, confrontati con la media regionale. Mai un conteggio di morti trasformato in punteggio |
| `services` | Disponibilità di scuole, presidi sanitari e trasporti | Dotazione per mille residenti di posti scuola, ambulatori e corse di trasporto pubblico, rispetto agli standard urbanistici |
| `greenCover` | Copertura verde fruibile | Metri quadrati di verde pubblico per abitante, tra 0 e uno standard dichiarato |
| `floodRisk` | Esposizione ad allagamenti e mareggiate; cresce con il livello del mare | Quota di superficie in aree a pericolosità idraulica o costiera nelle mappe ufficiali di rischio |
| `trust` | Fiducia dei residenti nelle istituzioni locali | Risposte a domande di fiducia in indagini campionarie, in seguito nei questionari della ricerca (D14) |
| `tension` | Conflittualità sociale del quartiere | Frequenza di presìdi, vertenze e proteste registrate, insieme alle risposte di indagine sul clima sociale |
| `belonging` | Senso di appartenenza e voglia di restare | Saldo migratorio dei giovani adulti e risposte di indagine sull'intenzione di restare |

### Città

| Indice | Che cosa rappresenta | Come si leggerà il dato reale |
| --- | --- | --- |
| `economy.averageIncome` | Reddito medio delle famiglie | Reddito imponibile medio per contribuente, tra una soglia di povertà relativa (0) e un multiplo della media nazionale (100) |
| `climate.summerHeat` | Intensità del caldo estivo | Numero medio di notti tropicali e di giorni sopra soglia di calore, normalizzato tra il clima di fine Novecento e lo scenario più caldo considerato |
| `climate.waterStress` | Scarsità d'acqua | Rapporto tra prelievi e risorsa disponibile nel bacino di approvvigionamento |
| `climate.co2Emissions` | Emissioni della città. **Aperto verso l'alto**: 100 = livello del 2026, minimo 0 | Inventario delle emissioni comunali, diviso per quello del 2026 |

### Consiglio

| Indice | Che cosa rappresenta | Come si leggerà il dato reale |
| --- | --- | --- |
| `trustInPlayer` | Fiducia di un consigliere nel giocatore | Non ha un corrispettivo reale: è un valore di gioco. Le stime di partenza si ritareranno con le prove sul campo |
| `patience` | Pazienza di un consigliere: sotto soglia propone anche scorciatoie | Valore di gioco, come sopra |

Fuori scala 0-100: popolazioni e lavoro sono **persone**, fondi e costi **milioni di
euro**, durate **anni interi**, livello del mare **centimetri**, avanzamento dei lotti
una **quota** tra 0 e 1.

## Le stime che pesano di più

Per come è costruito il motore (non per un'analisi di sensibilità, che non è
ancora stata fatta), l'esito dipende soprattutto da quattro gruppi di numeri, da
verificare per primi in T05b:

1. `servicesCostPerYear` e `ownRevenuePerWorker`: il loro rapporto decide se la città
   parte in disavanzo strutturale. Oggi la stima dà un piccolo disavanzo (circa 1,8
   milioni l'anno senza nuovi posti di lavoro).
2. `wageSupportCostPerPerson` e `stateTransferPerYear`: decidono per quanti anni il
   fondo statale copre la cassa integrazione.
3. I costi annui dei lavori dei progetti grandi (forno elettrico, bonifica, porto).
4. Le durate delle fasi di autorizzazione.

## I sei dilemmi

| Dilemma | Opzione scorretta e il suo vantaggio | Opzione corretta e il suo prezzo |
| --- | --- | --- |
| **I dati dei giorni di vento** | Rinviare la pubblicazione (nascosta, verità): quartiere calmo e stagione turistica salva | Pubblicare subito: più tensione e un po' di reddito perso. Oppure pubblicare con una promessa verificabile sull'aria entro cinque anni |
| **Una ditta pronta a partire** | Affidamento diretto della bonifica (nascosto, legalità): trecento posti subito e terra più pulita prima | Gara regolare: tempo, costi di gara, malumore al presidio. Oppure uno studio pubblico sui terreni, che costa e rende poco nell'immediato |
| **Chi lavora nei nuovi posti** | La lista dei nomi segnalati (nascosta, legalità): posti riempiti subito e un consigliere grato | Selezione pubblica: assunzioni più lente e un consigliere scontento. Oppure precedenza a chi è in cassa: i giovani si sentono di nuovo in coda |
| **Il presidio ai cancelli** | Chiedere lo sgombero (palese, ascolto): cantieri più veloci | Incontrarli e promettere che la cassa integrazione scenderà sotto le quattromila persone entro sei anni: costa, e la promessa va mantenuta |
| **Il rendiconto dei fondi europei** | Rendicontare spese non fatte (nascosto, verità e legalità): i fondi restano e il bilancio respira | Dichiarare il ritardo: parte dei fondi revocata. Oppure chiedere una proroga, che copre solo una parte |
| **Le scuole nei giorni di vento** | Lasciare tutto com'è (palese, cura): nessuna spesa, nessuna giornata persa | Chiudere le scuole: servizi ridotti e reddito perso per le famiglie. Oppure lezioni in spazi lontani dai parchi minerali, a spese del Comune |

Nessun dilemma riguarda la scelta tra le strade di riconversione: acciaio, bonifica,
energia e mare non hanno peso morale (regola 5). Un test lo controlla.

## Le otto politiche

| Politica | Costo e fondo | Che cosa fa | Peso morale |
| --- | --- | --- | --- |
| Formazione per la riconversione | 4 M€/anno, statale | 400 persone l'anno in formazione per due anni, poi tornano disoccupate ma formate | cura, all'attivazione |
| Dati sull'aria in tempo reale | 0,3 M€/anno, propri | Fiducia in crescita ai Tamburi e a Paolo VI | verità, all'attivazione e ogni anno |
| Consulte di quartiere | 0,5 M€/anno, propri | Tensione in calo in tre quartieri | ascolto, all'attivazione e ogni anno |
| Integrazione al reddito delle famiglie in difficoltà | 3 M€/anno, propri | Reddito medio in crescita, tensione in calo | cura, all'attivazione e ogni anno |
| Sgravi alle imprese dell'indotto | 3 M€/anno, propri | Più imprese dell'indotto, 80 assunzioni l'anno nei servizi | nessuno |
| Controlli rafforzati sugli appalti | 0,8 M€/anno, propri | Nessun effetto materiale diretto | legalità, all'attivazione e ogni anno |
| Trasporto gratuito per studenti e giovani | 0,6 M€/anno, propri | Appartenenza in crescita a Paolo VI e nelle borgate | cura, all'attivazione |
| Piano contro il caldo estivo | 2 M€/anno, statale | Più verde, caldo estivo un po' attenuato | cura, all'attivazione |

## Persone e nomi

I luoghi sono reali. Imprese e sigle sono inventate (regola 6). I consiglieri non
hanno nomi di persona (decisione D17): sono indicati per delega, e la descrizione dice
soltanto quale visione difendono.

| Consigliere | Visione |
| --- | --- |
| Consigliere al lavoro e all'industria | lavoro e industria |
| Consigliere alla salute e all'ambiente | salute e ambiente |
| Consigliere al mare e alla cultura | mare e cultura |
| Consigliere al bilancio | conti pubblici |
| Consigliere ai giovani e al futuro | giovani e futuro |
| Consigliere ai quartieri e alle periferie | quartieri e periferie |
