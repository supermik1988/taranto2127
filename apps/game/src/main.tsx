// Prima di tutto: i sostituti delle funzioni recenti (T12d). I moduli si eseguono nell'ordine degli import.
import './compat.js';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { Riserva, guastoDiProva } from './errori.js';
import './styles.css';

// Guasto di prova prima che React parta: lo deve raccogliere la sentinella di index.html.
if (guastoDiProva() === 'modulo') throw new Error('guasto di prova prima dell’avvio');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Riserva>
      <App />
    </Riserva>
  </StrictMode>,
);
