# Registro delle decisioni

Decisioni prese da Michele il 13 novembre 2026. Dove questo file e il documento
di architettura (GDD) non coincidono, vale questo file.

| #   | Decisione                | Scelta                                                                                   |
| --- | ------------------------ | ---------------------------------------------------------------------------------------- |
| D1  | Titolo                   | **TARANTO2127** (sostituisce Red&Blue)                                                   |
| D2  | Durata                   | 100 anni, dal 2027 al 2127                                                               |
| D3  | Pubblico                 | La cittadinanza in generale. Il gioco deve creare dibattito                              |
| D4  | Stabilimento             | Nome inventato: **ILSIDER**                                                              |
| D5  | Giocatore                | La coscienza della città: resta mentre sindaci e generazioni passano                     |
| D6  | Contatore morale         | Resta Red/Blu: sono anche i colori della bandiera della città                            |
| D7  | Consiglieri Mare/Ruggine | Eliminati. Al loro posto voci dei cittadini e un Consiglio di consiglieri AI             |
| D8  | Piattaforme              | Desktop e mobile                                                                         |
| D9  | Costi                    | Sviluppo e strumenti a carico di Michele                                                 |
| D10 | Durata di una sessione   | Almeno un'ora                                                                            |
| D11 | Tempi                    | Costruzioni e decisioni hanno tempistiche realistiche                                    |
| D12 | Ambizione                | Esperimento sociale, innovativo, che possa diventare uno studio di ricerca               |
| D13 | Strumenti                | Li sceglie l'architetto: Higgsfield e Jev erano ipotesi, non vincoli                     |
| D14 | Calibrazione             | In due tempi: prima dati pubblici, in seguito interviste e partner accademico            |
| D15 | Open source              | Codice AGPL-3.0, contenuti CC BY-SA 4.0                                                  |
| D16 | Repository               | Pubblico su GitHub: `supermik1988/taranto2127`                                           |
| D17 | Consiglieri              | Indicati per delega, senza nomi di persona                                               |
| D18 | Grafica                  | Plastico 3D della città, effetto modellino, luce morbida, colori pieni. Mappa a tutto schermo che si ingrandisce, comandi ai bordi, finestre al tocco. Sostituisce «Grafica e strumenti creativi» qui sotto per la mappa |
| D19 | Ambiente di sviluppo     | Lo sviluppo prosegue interamente dentro Antigravity, con l'architetto lì. Passaggio di consegne in `docs/ARCHITETTO.md` |
| D20 | Stile della mappa        | (24 novembre 2026) Città isometrica nello stile dei gestionali di città di fine anni '90, ricca di dettagli e a colori pieni, senza effetto modellino né bordi. Ispirata al genere, nessun elemento copiato da giochi esistenti. Vista fissa con rotazione a scatti di 90°; si parte dalla zona già fatta (Tamburi, stabilimento, Mar Piccolo) e poi si estende; dettaglio ricco, ridotto da solo sui dispositivi lenti. Sostituisce l'effetto modellino di D18 |
| D21 | Consiglieri              | (24 novembre 2026) Personaggi inventati con volto, nome, età, mestiere e una storia legata a Taranto. Mai persone reali. Sostituisce D17 |
| D22 | Ritratti                 | (24 novembre 2026) Ritratti dei consiglieri illustrati dal codice, nello stile della mappa, con più espressioni. Niente immagini esterne né servizi a pagamento |
| D23 | Interfaccia              | (24 novembre 2026) Interfaccia da gestionale di città (barra di stato, notizie che scorrono, comandi a icone, minimappa), ispirata al genere senza copiare nessun gioco. Si fa dopo la mappa isometrica (T12) |
| D24 | Grafica premium          | (25 novembre 2026) Città in 3D moderno, liscio e pulito, a colori vivi, come i gestionali per telefono di oggi: ispirata al genere, nessun elemento copiato. Gli edifici diventano un catalogo di modelli 3D tipici di Taranto, generati con l'intelligenza artificiale (Higgsfield) e controllati uno per uno, collocati sulle piante vere della mappa. Ogni generazione si fa solo dopo che Michele ha approvato il costo in crediti. Le foto di riferimento dei luoghi servono a descriverli a parole e non si caricano nei generatori. Origine, licenza e uso dell'IA di ogni modello registrati e dichiarati nei crediti. Sostituisce, per la grafica di gioco, «Grafica e strumenti creativi» (D13) e lo stile illustrato di T12c |

## Cosa ne discende

### Struttura del tempo (D2, D10, D11)

- **100 turni da 1 anno.** Il turno annuale è la grana minima per rendere
  credibile un cantiere di quattro anni o una bonifica di quindici.
- 5 epoche da 20 anni (20 turni ciascuna), circa una generazione l'una:
  2027-2046, 2047-2066, 2067-2086, 2087-2106, 2107-2127.
- Durata: un'epoca occupa circa mezz'ora, la partita completa due o tre ore.
  Una sessione tipo copre due epoche, quindi almeno un'ora. Il salvataggio è
  automatico, ma il gioco non è pensato per partite da pochi minuti.
- A ogni cambio d'epoca: ritratto intermedio della città e rinnovo del Consiglio.
- I cittadini nascono, invecchiano, muoiono. I figli ereditano una parte della
  memoria dei genitori (promesse mantenute o tradite).
- Il clima diventa una pressione lenta: livello dei due mari, caldo estivo, acqua.
  Sono scenari dichiarati, non previsioni.
- Oltre il 2050 il gioco non inventa tecnologie miracolose: le leve future sono
  versioni più mature di quelle già note.

### Tempi realistici (D11)

- Ogni costruzione, bonifica o riforma è un **progetto a fasi**: progettazione,
  autorizzazioni, gara, lavori, esercizio. Nessun effetto prima dell'esercizio,
  tranne i posti di lavoro del cantiere durante i lavori.
- Le durate di ogni fase stanno nei dati e vengono da casi reali comparabili,
  con fonte. Le raccoglie `fact-checker`: nessuna durata viene inventata.
- I ritardi sono parte del gioco: ricorsi, fondi che non arrivano, proteste e
  uffici saturi allungano le fasi. Investire nella capacità amministrativa li riduce.
- Anche le decisioni hanno tempi: un'ordinanza vale dall'anno dopo, un accordo
  con una fazione richiede uno o più anni di trattativa, i fondi europei
  arrivano a rate e scadono se non spesi.
- **Saltare una fase è la scorciatoia Red per eccellenza**: affidare senza gara,
  aprire senza autorizzazione. Si guadagnano anni veri e si accumula un rischio vero.
- Poiché quasi nulla si completa in un turno, il giocatore gestisce un
  portafoglio di cantieri aperti. Non ogni anno porta un dilemma: negli anni
  tranquilli il turno dura pochi secondi, in quelli di crisi diversi minuti.

Ordini di grandezza già emersi dalle fonti, da verificare prima dell'uso:
sostituzione degli altiforni con forni elettrici in 4-8 anni; grande bonifica
dell'area in 10-15 anni.

### Il Consiglio (D7)

- 6 consiglieri AI, ognuno con una visione: lavoro e industria, salute e ambiente,
  mare e cultura, conti pubblici, giovani e futuro, quartieri e periferie.
- A ogni turno ciascuno dà un consiglio in base a due cose: l'andamento della
  città e la propria visione. Non sono "il buono" e "il cattivo": chiunque di loro
  può proporre una scorciatoia Red quando la sua causa è alle strette.
- Ogni consigliere ha un livello di fiducia verso il giocatore, che sale se viene
  ascoltato e i fatti gli danno ragione.
- A ogni epoca il Consiglio si rinnova e la sua composizione riflette l'umore dei
  cittadini: una città arrabbiata elegge consiglieri più radicali.
- I dilemmi sono commentati anche dalle voci dei cittadini toccati, da due lati.

### Dibattito pubblico (D3)

- Ritratto finale condivisibile con un link (seme + elenco delle scelte).
- Confronto anonimo con le scelte degli altri giocatori su ogni dilemma.
- Modalità serata pubblica: una sala vota ogni dilemma dal telefono.

### Desktop e mobile (D8)

- Applicazione web installabile, pensata prima per il tocco e per lo schermo verticale.
- Telefono: un quartiere per volta, pannelli a scorrimento dal basso.
- Desktop: mappa isometrica intera con pannelli laterali.
- Salvataggio automatico a ogni turno, per riprendere una partita lunga.

### Costi (D9)

- Base gratuita: frasi pregenerate per voci e consiglieri.
- Modello linguistico dal vivo solo nei momenti chiave (cambio d'epoca,
  negoziati, proteste), con tetto di spesa per partita e tetto mensile globale.
- Superato il tetto mensile il gioco passa da solo alla modalità pregenerata.

### Cervello dei cittadini (D13, scelta dell'architetto)

- **Di serie: regole calibrate su dati e interviste reali.** Turni istantanei,
  costo zero per partita, funziona senza rete e su telefono, partita ripetibile.
- **Il realismo viene dalla calibrazione, non dal modello.** I pesi di ogni
  archetipo (quanto conta il lavoro, la salute, il restare) si ricavano da
  questionari e interviste a residenti di Taranto, con consenso.
- **Cervello intercambiabile.** Tutte le decisioni dei cittadini passano da
  un'unica interfaccia `DecisionProvider`. Tre implementazioni: regole (di
  serie), modello decisionale tipo Jev (sperimentale), modello linguistico
  (sperimentale). Le due sperimentali servono allo studio, non al gioco pubblico.
- Ogni decisione presa da un provider non deterministico viene registrata nel
  salvataggio, così la partita resta rigiocabile identica.
- **Parole:** libreria di frasi pregenerate e riviste da una persona; modello
  linguistico dal vivo solo nei momenti chiave.

### Calibrazione in due tempi (D14)

- **Ora:** i pesi degli archetipi si ricavano da dati pubblici (statistiche
  ufficiali, indagini e sondaggi già pubblicati, studi su Taranto). Dove il dato
  manca si usa una stima dichiarata, marcata `"stima": true` con la motivazione.
- **In seguito:** questionari e interviste a residenti, con un partner
  accademico. I nuovi pesi sostituiscono le stime senza toccare il codice,
  perché stanno tutti nei file di dati.
- Ogni file di dati porta una versione di calibrazione, registrata in ogni
  partita: si saprà sempre con quali pesi è stata giocata.
- **Non rinviabile:** consenso e archivio anonimo (scheda T08) si costruiscono
  subito. Una partita raccolta senza consenso valido non potrà mai entrare in uno studio.

### Grafica e strumenti creativi (D13)

> Superato da D24 per la grafica di gioco: i modelli degli edifici possono essere generati
> con l'intelligenza artificiale. Resta valido per bozzetti, trailer e video.

- Mappa e interfaccia disegnate dal codice in stile vettoriale: leggere,
  nitide su ogni schermo, coerenti, modificabili dagli agenti.
- Higgsfield fuori dal gioco: bozzetti, trailer, video di lancio. Non per la
  grafica di gioco.

### Esperienza di gioco (proposte dell'architetto)

- **La Cronaca.** Ogni anno una prima pagina di giornale locale racconta le
  conseguenze delle scelte: è il modo più leggibile di mostrare causa ed effetto.
- **Il secolo in un minuto.** A fine epoca e a fine partita, la città scorre
  accelerata dal 2027 in poi.
- **E se invece.** A fine epoca si può riaprire una scelta passata e vedere il
  ramo alternativo, senza perdere la partita principale.

### Ricerca (D12)

- Tre domande di studio: (1) davanti allo stesso dilemma, cittadini simulati e
  giocatori reali scelgono allo stesso modo? (2) giocare cambia le opinioni
  sulla riconversione? (3) regole, modello decisionale e modello linguistico:
  quale produce dinamiche più credibili, e a quale costo?
- Requisiti da rispettare fin dal primo codice: consenso esplicito e
  facoltativo, nessun dato personale, archivio anonimo delle partite, ipotesi
  dichiarate prima di guardare i dati, codice e dati aperti.
- Serve un partner accademico che firmi il protocollo prima della prova sul campo.

## Ancora da decidere

- Nomi e volti dei sei consiglieri della prima epoca: deciso il principio (D21, D22); i personaggi li propone T14 e li approva Michele.
- Soglia del tetto di spesa mensile per le voci AI.
- Chi ospita le prime prove sul campo.
- Quale università o gruppo di ricerca coinvolgere.
