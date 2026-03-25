import { describe, expect, it } from 'vitest';

import type { AbilityDefinition } from '../../game-data/types';
import type { LoadedGameDataSnapshot, SimulationConfig } from '../models';
import { resolveCooldownTimeline } from './cooldowns';

function createAbility(overrides: Partial<AbilityDefinition> = {}): AbilityDefinition {
  return {
    id: 'basic-shot',
    name: 'Basic Shot',
    style: 'ranged',
    subtype: 'basic',
    cooldownTicks: 5,
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
      'zero-cd': createAbility({
        id: 'zero-cd',
        name: 'Zero Cooldown',
        cooldownTicks: 0,
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
      tickCount: 10,
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

describe('resolveCooldownTimeline', () => {
  it('tracks cooldown state per tick after ability use', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 8,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'basic-1',
            tick: 1,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'basic-shot' },
          },
        ],
      },
    });

    const result = resolveCooldownTimeline(config);

    expect(result.tickStates[1]).toMatchObject({
      cooldownsAtTickStart: {},
      cooldownsAtTickEnd: {
        'basic-shot': 6,
      },
      actionsResolved: ['basic-1'],
    });
    expect(result.cooldownTimeline[5]).toEqual({
      'basic-shot': 6,
    });
    expect(result.cooldownTimeline[6]).toEqual({});
    expect(result.validationIssues).toEqual([]);
  });

  it('rejects reuse before cooldown expires', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 8,
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
            id: 'basic-2',
            tick: 4,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'basic-shot' },
          },
        ],
      },
    });

    const result = resolveCooldownTimeline(config);

    expect(result.validationIssues).toHaveLength(1);
    expect(result.validationIssues[0]).toMatchObject({
      code: 'ability.cooldown_conflict',
      tick: 4,
      relatedActionId: 'basic-2',
    });
    expect(result.tickStates[4].actionsResolved).toEqual([]);
  });

  it('does not persist zero-cooldown abilities in the map', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 4,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'instant-repeat',
            tick: 1,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'zero-cd' },
          },
        ],
      },
    });

    const result = resolveCooldownTimeline(config);

    expect(result.cooldownTimeline[1]).toEqual({});
    expect(result.validationIssues).toEqual([]);
  });

  it('reports missing ability definitions cleanly', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 4,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'unknown',
            tick: 1,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'does-not-exist' },
          },
        ],
      },
    });

    const result = resolveCooldownTimeline(config);

    expect(result.validationIssues).toHaveLength(1);
    expect(result.validationIssues[0]).toMatchObject({
      code: 'ability.missing_definition',
      tick: 1,
      relatedActionId: 'unknown',
    });
  });
});
