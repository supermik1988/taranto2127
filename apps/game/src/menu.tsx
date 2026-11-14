/**
 * Menu della partita: salvataggio automatico, nuova partita con conferma, tre
 * posti per i salvataggi manuali, esporta e importa su file, link che riapre
 * la partita. Ogni salvataggio è seme più storia: rigiocato, dà lo stato identico.
 */
import { yearOfTurn, type GameState } from '@taranto2127/sim';
import { useRef, useState, type ChangeEvent } from 'react';
import { SLOTS, exportFileName, exportText, gameLink, parseSaved, readSlot, saveSlot, type SavedGame } from './engine.js';

const time = (d: Date) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('it-IT')} alle ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
};

export function GameMenu({
  state,
  lastSaved,
  onLoad,
  onNew,
  onClose,
}: {
  state: GameState;
  lastSaved: Date | null;
  onLoad: (saved: SavedGame, message: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const [confirmNew, setConfirmNew] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [, refresh] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const link = gameLink(state, typeof window === 'undefined' ? 'https://localhost/' : window.location.href);

  const download = () => {
    const blob = new Blob([exportText(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName(state);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`Partita esportata nel file ${exportFileName(state)}.`);
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (chosen === undefined) return;
    const saved = parseSaved(await chosen.text());
    if (saved === null) setMessage('Questo file non contiene una partita di TARANTO2127.');
    else onLoad(saved, `Partita importata dal file ${chosen.name}.`);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setMessage('Link copiato: aprilo per riprendere questa partita, anche su un altro dispositivo.');
    } catch {
      setMessage('Il browser non permette di copiare: tieni premuto il link qui sotto.');
    }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Partita" data-testid="menu-partita">
      <div className="sheet">
        <header className="card-head">
          <h2>Partita</h2>
          <button type="button" onClick={onClose} data-testid="menu-chiudi">Chiudi</button>
        </header>
        <p className="note">Seme {state.seed} · anno {yearOfTurn(state.turn)}</p>
        {message !== null && <p className="notice" role="status" data-testid="menu-avviso">{message}</p>}

        <h3>Salvataggio automatico</h3>
        <p data-testid="salvataggio-automatico">
          {lastSaved === null
            ? 'Il browser non permette di salvare: esporta la partita su file per non perderla.'
            : `Attivo: la partita si salva da sola a ogni scelta. Ultimo salvataggio alle ${time(lastSaved)}.`}
        </p>

        <h3>Posti di salvataggio</h3>
        <ul className="slots">
          {SLOTS.map((slot) => {
            const info = readSlot(slot);
            return (
              <li key={slot} className="slot" data-testid={`posto-${slot}`}>
                <span>
                  <strong>Posto {slot}</strong>:{' '}
                  {info === null ? 'vuoto' : `anno ${yearOfTurn(info.saved.turno)}, seme ${info.saved.seme}, salvato il ${when(info.at)}`}
                </span>
                <span className="buttons">
                  <button
                    type="button"
                    onClick={() => {
                      const ok = saveSlot(slot, state);
                      setMessage(ok ? `Partita salvata nel posto ${slot}.` : 'Il browser non permette di salvare.');
                      refresh((n) => n + 1);
                    }}
                    data-testid={`salva-${slot}`}
                  >
                    Salva qui
                  </button>
                  <button
                    type="button"
                    disabled={info === null}
                    onClick={() => info !== null && onLoad(info.saved, `Partita del posto ${slot} caricata.`)}
                    data-testid={`carica-${slot}`}
                  >
                    Carica
                  </button>
                </span>
              </li>
            );
          })}
        </ul>

        <h3>File e link</h3>
        <div className="buttons wrap">
          <button type="button" onClick={download} data-testid="esporta">Esporta su file</button>
          <button type="button" onClick={() => file.current?.click()} data-testid="importa">Importa da file</button>
          <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => void importFile(e)} data-testid="importa-file" />
          <button type="button" onClick={() => void copyLink()} data-testid="copia-link">Copia il link della partita</button>
        </div>
        <p className="note link-line">
          <a href={link} data-testid="link-menu">Link che riapre questa partita</a>
        </p>

        <h3>Nuova partita</h3>
        {confirmNew ? (
          <div className="box">
            <p>Vuoi davvero cominciare da capo? La partita in corso resta solo nei posti di salvataggio o in un file esportato.</p>
            <div className="buttons">
              <button type="button" className="primary danger" onClick={onNew} data-testid="nuova-conferma">Sì, nuova partita</button>
              <button type="button" onClick={() => setConfirmNew(false)}>No, continuo questa</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmNew(true)} data-testid="nuova-partita">Comincia una nuova partita</button>
        )}
      </div>
    </div>
  );
}
