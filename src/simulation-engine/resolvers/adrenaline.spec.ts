import { describe, expect, it } from 'vitest';

import type { AbilityDefinition } from '../../game-data/types';
import type { LoadedGameDataSnapshot, SimulationConfig } from '../models';
import { MAX_ADRENALINE, resolveAdrenalineTimeline } from './adrenaline';

function createAbility(overrides: Partial<AbilityDefinition> = {}): AbilityDefinition {
  return {
    id: 'basic-shot',
    name: 'Basic Shot',
    style: 'ranged',
    subtype: 'basic',
    cooldownTicks: 3,
    adrenalineGain: 9,
    hitSchedule: [
      {
        id: 'basic-shot-hit',
        tickOffset: 0,
        damage: {
          min: 90,
          max: 110,
        },
      },
    ],
    baseDamage: {
      min: 90,
      max: 110,
    },
    ...overrides,
  };
}

function createConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  const gameData: LoadedGameDataSnapshot = {
    items: {},
    ammo: {},
    abilities: {
      'basic-shot': createAbility(),
      'enhanced-shot': createAbility({
        id: 'enhanced-shot',
        name: 'Enhanced Shot',
        subtype: 'enhanced',
        adrenalineGain: 0,
        adrenalineCost: 25,
      }),
      'huge-basic': createAbility({
        id: 'huge-basic',
        name: 'Huge Basic',
        adrenalineGain: 15,
      }),
    },
    buffs: {},
    perks: {},
    relics: {},
    eofSpecs: {},
  };

  return {
    playerStats: {
      rangedLevel: 99,
    },
    gearSetup: {
      equipment: {},
    },
    inventory: {
      items: [],
    },
    persistentBuffConfig: {},
    rotationPlan: {
      startingAdrenaline: 0,
      tickCount: 8,
      nonGcdActions: [],
      abilityActions: [],
    },
    gameData,
    modeFlags: {
      strictValidation: true,
    },
    ...overrides,
  };
}

describe('resolveAdrenalineTimeline', () => {
  it('supports starting adrenaline and applies gains/costs per tick', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 25,
        tickCount: 6,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'basic-1',
            tick: 1,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'basic-shot' },
          },
          {
            id: 'enhanced-1',
            tick: 4,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'enhanced-shot' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.startingAdrenaline).toBe(25);
    expect(result.adrenalineTimeline).toEqual([25, 34, 34, 34, 9, 9]);
    expect(result.tickStates[1]).toMatchObject({
      valueAtTickStart: 25,
      valueAtTickEnd: 34,
      actionsResolved: ['basic-1'],
    });
    expect(result.tickStates[4]).toMatchObject({
      valueAtTickStart: 34,
      valueAtTickEnd: 9,
      actionsResolved: ['enhanced-1'],
    });
    expect(result.validationIssues).toEqual([]);
  });

  it('prevents invalid ability use when adrenaline is insufficient', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 10,
        tickCount: 4,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'enhanced-too-early',
            tick: 1,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'enhanced-shot' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.adrenalineTimeline).toEqual([10, 10, 10, 10]);
    expect(result.validationIssues).toHaveLength(1);
    expect(result.validationIssues[0]).toMatchObject({
      code: 'ability.insufficient_adrenaline',
      tick: 1,
      relatedActionId: 'enhanced-too-early',
    });
  });

  it('clamps adrenaline at the 100 cap', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 95,
        tickCount: 3,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'overflow-basic',
            tick: 1,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'huge-basic' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.adrenalineTimeline).toEqual([95, MAX_ADRENALINE, MAX_ADRENALINE]);
    expect(result.validationIssues).toEqual([]);
  });

  it('clamps invalid starting adrenaline into the allowed range', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: -15,
        tickCount: 2,
        nonGcdActions: [],
        abilityActions: [],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.startingAdrenaline).toBe(0);
    expect(result.adrenalineTimeline).toEqual([0, 0]);
    expect(result.validationIssues).toHaveLength(1);
    expect(result.validationIssues[0]).toMatchObject({
      code: 'adrenaline.starting_out_of_bounds',
      severity: 'warning',
    });
  });
});
