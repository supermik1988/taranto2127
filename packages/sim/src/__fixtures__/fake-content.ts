/**
 * DATI FINTI, SOLO PER I TEST.
 *
 * Nessun numero qui descrive Taranto: sono valori tondi inventati per
 * esercitare il motore. I dati veri dei quartieri arrivano con la scheda T05
 * in packages/content, con fonti. Non importare questo file fuori dai test.
 */
import type { DistrictStart, InitialContent } from '../init.js';

const fakeDistrict = (overrides: Partial<DistrictStart> = {}): DistrictStart => ({
  population: { young: 1000, adult: 2000, elder: 1000 },
  airQuality: 50,
  contaminatedSoil: 50,
  cumulativeExposure: 50,
  health: 50,
  services: 50,
  greenCover: 50,
  floodRisk: 50,
  trust: 50,
  tension: 50,
  belonging: 50,
  ...overrides,
});

export const fakeContent = (): InitialContent => ({
  calibrationVersion: 'finto-0',
  districts: {
    tamburi: fakeDistrict({ airQuality: 10, contaminatedSoil: 90 }),
    'paolo-vi': fakeDistrict(),
    'citta-vecchia': fakeDistrict({ population: { young: 100, adult: 200, elder: 300 } }),
    borgo: fakeDistrict(),
    'talsano-lama-san-vito': fakeDistrict({ floodRisk: 0 }),
    'area-industriale': fakeDistrict({ population: { young: 0, adult: 0, elder: 0 } }),
  },
  labor: {
    employed: {
      steel: 100,
      remediation: 0,
      energy: 0,
      sea: 10,
      'culture-tourism': 10,
      services: 100,
      public: 50,
    },
    onWageSupport: 100,
    unemployed: 100,
    inTraining: 0,
  },
  economy: {
    funds: { own: 1000, state: 1000, 'eu-earmarked': 1000, private: 0 },
    averageIncome: 50,
    supplierFirms: 10,
    spendingCapacity: 100,
  },
  climate: { co2Emissions: 100, seaLevelRiseCm: 0, summerHeat: 50, waterStress: 50 },
  plantLots: [
    { id: 'lotto-finto-a', path: 'idle', progress: 0, remediated: false },
    { id: 'lotto-finto-b', path: 'idle', progress: 0, remediated: false },
  ],
  council: [
    { id: 'consigliere-finto-1', name: 'Consigliere di prova 1', vision: 'work-industry', trustInPlayer: 50, patience: 50 },
    { id: 'consigliere-finto-2', name: 'Consigliere di prova 2', vision: 'health-environment', trustInPlayer: 50, patience: 50 },
  ],
});
