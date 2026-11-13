import { describe, expect, it } from 'vitest';
import { fakeContent } from './__fixtures__/fake-content.js';
import { applyDeltas } from './effects.js';
import { createInitialState } from './init.js';
import { FREE, INDEX, MORAL, NON_NEGATIVE, SHARE, boundsFor } from './limits.js';
import { TOTAL_TURNS } from './state.js';
import { validateState } from './validate.js';

describe('tabella dei limiti', () => {
  it.each([
    ['turn', [0, TOTAL_TURNS]],
    ['districts.tamburi.health', INDEX],
    ['districts.tamburi.population.elder', NON_NEGATIVE],
    ['labor.employed.steel', NON_NEGATIVE],
    ['economy.averageIncome', INDEX],
    ['economy.funds.own', FREE],
    ['economy.funds.state', NON_NEGATIVE],
    ['climate.co2Emissions', NON_NEGATIVE],
    ['climate.seaLevelRiseCm', FREE],
    ['climate.summerHeat', INDEX],
    ['moral.conscience', MORAL],
    ['moral.byDimension.care', MORAL],
    ['council.3.patience', INDEX],
    ['plantLots.2.progress', SHARE],
    ['council.0.electedInEpoch', FREE],
  ] as const)('%s', (path, bounds) => {
    expect(boundsFor(path)).toEqual(bounds);
  });

  it('effetti e validazione usano gli stessi limiti: un effetto che sfora resta valido', () => {
    const paths = [
      'districts.borgo.trust',
      'districts.borgo.population.young',
      'labor.unemployed',
      'economy.funds.private',
      'climate.waterStress',
      'climate.co2Emissions',
      'moral.reputation',
      'moral.byDimension.word',
      'council.0.trustInPlayer',
      'plantLots.0.progress',
    ];
    for (const amount of [1e9, -1e9]) {
      const state = applyDeltas(
        createInitialState(1, fakeContent()),
        paths.map((target) => ({ target, amount })),
      );
      expect(validateState(state).errors).toEqual([]);
    }
  });
});
