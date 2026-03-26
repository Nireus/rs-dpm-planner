import { describe, expect, it } from 'vitest';

import type { AbilityDefinition } from '../../../game-data/types';
import type { SimulationResult } from '../../../simulation-engine/models';
import {
  buildAbilityExplainabilitySummary,
  buildDamageModifierGroupSummaries,
  findSelectedHitBreakdown,
  getDefaultSelectedHitId,
} from './results-explainability.utils';

describe('results explainability utils', () => {
  it('builds selected ability summary with rotation share', () => {
    const result = createResult();
    const summary = buildAbilityExplainabilitySummary('rapid-fire', result, createAbilities());

    expect(summary).toEqual({
      abilityId: 'rapid-fire',
      name: 'Rapid Fire',
      totalDamage: { abilityId: 'rapid-fire', min: 100, avg: 200, max: 300 },
      percentageOfRotation: 0.4,
      hitBreakdowns: [result.explainability.damageBreakdowns[0]],
    });
  });

  it('finds the default and selected hit breakdown', () => {
    const summary = buildAbilityExplainabilitySummary('rapid-fire', createResult(), createAbilities());

    expect(getDefaultSelectedHitId(summary)).toBe('hit-1');
    expect(findSelectedHitBreakdown(summary, 'hit-1')?.hitId).toBe('hit-1');
  });

  it('builds grouped modifier summaries', () => {
    const breakdown = createResult().explainability.damageBreakdowns[0];
    const groups = buildDamageModifierGroupSummaries(breakdown);

    expect(groups).toEqual([
      {
        title: 'Base Hit',
        total: 20,
        entries: [{ sourceId: 'base-hit', label: 'Base hit damage', value: 20 }],
      },
      {
        title: 'Additive',
        total: 3,
        entries: [{ sourceId: 'flat', label: 'Flat bonus', value: 3 }],
      },
      {
        title: 'Multiplicative',
        total: 4,
        entries: [{ sourceId: 'multi', label: 'Multiplier', value: 4 }],
      },
      {
        title: 'Expected Value',
        total: 2.5,
        entries: [{ sourceId: 'crit', label: 'Crit EV', value: 2.5 }],
      },
    ]);
  });
});

function createAbilities(): Record<string, AbilityDefinition> {
  return {
    'rapid-fire': {
      id: 'rapid-fire',
      name: 'Rapid Fire',
      style: 'ranged',
      subtype: 'enhanced',
      cooldownTicks: 34,
      hitSchedule: [],
      baseDamage: { min: 0, max: 0 },
    },
  };
}

function createResult(): SimulationResult {
  return {
    isValid: true,
    validationIssues: [],
    totalDamage: { min: 200, avg: 500, max: 800 },
    damageByAbility: [
      { abilityId: 'rapid-fire', min: 100, avg: 200, max: 300 },
    ],
    damageByTick: {},
    adrenalineTimeline: [],
    buffTimeline: {},
    timelineGeneratedBuffSources: [],
    cooldownTimeline: {},
    tickStates: [],
    explainability: {
      damageBreakdowns: [
        {
          abilityId: 'rapid-fire',
          hitId: 'hit-1',
          tick: 3,
          baseDamage: { min: 10, avg: 20, max: 30 },
          additiveModifiers: [{ sourceId: 'flat', label: 'Flat bonus', value: 3 }],
          multiplicativeModifiers: [{ sourceId: 'multi', label: 'Multiplier', value: 4 }],
          expectedValueModifiers: [{ sourceId: 'crit', label: 'Crit EV', value: 2.5 }],
          finalDamage: { min: 15, avg: 29.5, max: 40 },
          percentageOfTotal: 0.059,
        },
      ],
    },
  };
}
