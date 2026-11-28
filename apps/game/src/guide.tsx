/**
 * Guida al gioco: termini spiegati al tocco, visita guidata, pagina «Come si
 * gioca». Tutti i testi vengono da packages/content (guida.json).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { content } from './engine.js';

const guide = content.guide;

/** Sostituisce i segnaposti {nome} di un testo. */
export const fill = (text: string, values: Record<string, string | number>): string =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));

// ---------- Termini spiegati al tocco ----------

const TipContext = createContext<(id: string) => void>(() => {});
/** Il termine di cui è aperta la spiegazione (la partita guidata lo guarda), o null. */
const TipApertoContext = createContext<string | null>(null);
export const useTipAperto = (): string | null => useContext(TipApertoContext);

/** Un termine tecnico: toccandolo, la spiegazione compare in basso. */
export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const show = useContext(TipContext);
  const entry = guide.glossary[id];
  if (entry === undefined) return <>{children}</>;
  return (
    <button
      type="button"
      className="term"
      onClick={(event) => {
        event.stopPropagation();
        show(id);
      }}
      aria-label={`${entry.termine}: che cosa vuol dire`}
      data-testid={`termine-${id}`}
    >
      {children ?? entry.termine}
    </button>
  );
}

/** Contenitore che mostra la spiegazione del termine toccato. */
export function TipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<string | null>(null);
  const entry = tip === null ? undefined : guide.glossary[tip];
  return (
    <TipContext.Provider value={setTip}>
      <TipApertoContext.Provider value={entry === undefined ? null : tip}>{children}</TipApertoContext.Provider>
      {entry !== undefined && (
        <div className="tip" role="dialog" aria-label={entry.termine} data-testid="spiegazione">
          <div>
            <strong>{entry.termine}</strong>
            <p>{entry.spiegazione}</p>
          </div>
          <button type="button" onClick={() => setTip(null)} data-testid="spiegazione-chiudi">Ok</button>
        </div>
      )}
    </TipContext.Provider>
  );
}

// ---------- Visita guidata ----------

/**
 * Otto passi, ognuno legato a un elemento della pagina (attributo data-tour):
 * l'elemento si porta in vista e si evidenzia. Si può saltare in ogni momento.
 */
export function Tour({ onEnd, onStep }: { onEnd: (completed: boolean) => void; onStep?: (target: string) => void }) {
  const [index, setIndex] = useState(0);
  const step = guide.tour[index]!;
  const last = index === guide.tour.length - 1;

  useEffect(() => {
    onStep?.(step.bersaglio);
    const target = document.querySelector(`[data-tour="${step.bersaglio}"]`);
    if (target === null) return;
    target.classList.add('tour-target');
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return () => target.classList.remove('tour-target');
  }, [step.bersaglio, onStep]);

  return (
    <div className="tour" role="dialog" aria-modal="false" aria-label="Visita guidata" data-testid="visita">
      <p className="kicker">Visita guidata · {index + 1} di {guide.tour.length}</p>
      <h2>{step.titolo}</h2>
      <p>{step.testo}</p>
      <div className="buttons">
        {index > 0 && <button type="button" onClick={() => setIndex(index - 1)}>Indietro</button>}
        {last ? (
          <button type="button" className="primary" onClick={() => onEnd(true)} data-testid="visita-fine">Comincia a giocare</button>
        ) : (
          <button type="button" className="primary" onClick={() => setIndex(index + 1)} data-testid="visita-avanti">Avanti</button>
        )}
        {!last && <button type="button" onClick={() => onEnd(false)} data-testid="visita-salta">Salta la visita</button>}
      </div>
    </div>
  );
}

// ---------- Aiuto: come si gioca e glossario ----------

export function HowToPlay() {
  return (
    <div data-testid="come-si-gioca">
      {guide.howTo.map((section) => (
        <section key={section.titolo} className="howto">
          <h3>{section.titolo}</h3>
          {section.paragrafi.map((p, i) => <p key={i}>{p}</p>)}
        </section>
      ))}
      <section className="howto">
        <h3>Le parole del gioco</h3>
        <dl className="glossary">
          {Object.entries(guide.glossary).map(([id, entry]) => (
            <div key={id}>
              <dt>{entry.termine}</dt>
              <dd>{entry.spiegazione}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

/** Il pannello del pulsante «?»: rivedere la visita o leggere come si gioca. */
export function HelpSheet({ onTour, onClose, onTutorial }: { onTour: () => void; onClose: () => void; onTutorial?: () => void }) {
  const [page, setPage] = useState(false);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Aiuto" data-testid="aiuto-pannello">
      <div className="sheet">
        <header className="card-head">
          <h2>{page ? 'Come si gioca' : 'Aiuto'}</h2>
          <button type="button" onClick={onClose} data-testid="aiuto-chiudi">Chiudi</button>
        </header>
        {page ? (
          <>
            <HowToPlay />
            <div className="buttons">
              <button type="button" onClick={() => setPage(false)}>Indietro</button>
            </div>
          </>
        ) : (
          <div className="buttons column">
            {onTutorial !== undefined && (
              <button type="button" className="primary" onClick={onTutorial} data-testid="aiuto-tutorial">Riprendi la partita guidata</button>
            )}
            <button type="button" className={onTutorial === undefined ? 'primary' : ''} onClick={onTour} data-testid="aiuto-visita">Rivedi la visita guidata</button>
            <button type="button" onClick={() => setPage(true)} data-testid="aiuto-come-si-gioca">Come si gioca: tutte le funzioni</button>
          </div>
        )}
      </div>
    </div>
  );
}
