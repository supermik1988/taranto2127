/**
 * REGOLE FINTE, SOLO PER I TEST.
 *
 * Durate e scenario climatico qui sotto sono inventati per esercitare il
 * motore e non vengono da alcuna fonte. Le durate vere, con fonte, arrivano
 * con la scheda T05 in packages/content.
 */
import type { PhaseDuration, TurnRules } from '../turn.js';

const fixed = (turns: number): PhaseDuration => ({ minTurns: turns, maxTurns: turns });

export const fakeRules = (): TurnRules => ({
  projects: {
    // Fasi di 1, 2, 1 e 4 anni: entra in esercizio 8 turni dopo l'avvio.
    'progetto-finto-8-anni': {
      id: 'progetto-finto-8-anni',
      phases: { design: fixed(1), permitting: fixed(2), tender: fixed(1), works: fixed(4) },
      operatingEffects: [{ target: 'districts.tamburi.greenCover', amount: 10 }],
    },
    // Durate variabili: il generatore con seme sceglie tra minimo e massimo.
    'progetto-finto-variabile': {
      id: 'progetto-finto-variabile',
      phases: {
        design: { minTurns: 1, maxTurns: 3 },
        permitting: { minTurns: 1, maxTurns: 4 },
        tender: { minTurns: 0, maxTurns: 2 },
        works: { minTurns: 2, maxTurns: 6 },
      },
      operatingEffects: [{ target: 'districts.borgo.services', amount: 5 }],
    },
    // Senza gara: la fase con durata 0 viene saltata.
    'progetto-finto-senza-gara': {
      id: 'progetto-finto-senza-gara',
      phases: { design: fixed(1), permitting: fixed(1), tender: fixed(0), works: fixed(1) },
      operatingEffects: [{ target: 'economy.averageIncome', amount: 1 }],
    },
  },
  lotConversionTurns: { 'green-steel': 3, remediation: 4, energy: 2, 'sea-culture': 5 },
  climateScenario: {
    id: 'scenario-finto',
    annualChangeByEpoch: [
      { seaLevelRiseCm: 0.5, summerHeat: 0.2, waterStress: 0.1 },
      { seaLevelRiseCm: 0.6, summerHeat: 0.2, waterStress: 0.1 },
      { seaLevelRiseCm: 0.7, summerHeat: 0.3, waterStress: 0.2 },
      { seaLevelRiseCm: 0.8, summerHeat: 0.3, waterStress: 0.2 },
      { seaLevelRiseCm: 0.9, summerHeat: 0.4, waterStress: 0.3 },
    ],
  },
});
