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
      snipe: createAbility({
        id: 'snipe',
        name: 'Snipe',
        cooldownTicks: 100,
      }),
      'piercing-shot': createAbility({
        id: 'piercing-shot',
        name: 'Piercing Shot',
        cooldownTicks: 5,
        hitSchedule: [
          {
            id: 'piercing-shot-hit-1',
            tickOffset: 0,
            damage: {
              min: 45,
              max: 55,
            },
          },
          {
            id: 'piercing-shot-hit-2',
            tickOffset: 1,
            damage: {
              min: 45,
              max: 55,
            },
          },
        ],
      }),
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

  it('reduces snipe cooldown by 2.4s per piercing shot hit', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 12,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'snipe-1',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'snipe' },
          },
          {
            id: 'piercing-1',
            tick: 10,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'piercing-shot' },
          },
        ],
      },
    });

    const result = resolveCooldownTimeline(config);

    expect(result.cooldownTimeline[9]).toEqual({
      snipe: 100,
    });
    expect(result.cooldownTimeline[10]).toEqual({
      'piercing-shot': 15,
      snipe: 96,
    });
    expect(result.cooldownTimeline[11]).toEqual({
      'piercing-shot': 15,
      snipe: 92,
    });
  });

  it('applies extra piercing shot snipe reduction when fleeting boots are equipped', () => {
    const config = createConfig({
      gameData: {
        items: {
          'fleeting-boots': {
            id: 'fleeting-boots',
            name: 'Fleeting boots',
            category: 'armor',
            slot: 'feet',
            combatStyleTags: ['ranged'],
            effectRefs: ['piercing-shot-snipe-reduction:+2ticks-per-hit'],
          },
        },
        ammo: {},
        abilities: {
          'basic-shot': createAbility(),
          snipe: createAbility({
            id: 'snipe',
            name: 'Snipe',
            cooldownTicks: 100,
          }),
          'piercing-shot': createAbility({
            id: 'piercing-shot',
            name: 'Piercing Shot',
            cooldownTicks: 5,
            hitSchedule: [
              {
                id: 'piercing-shot-hit-1',
                tickOffset: 0,
                damage: {
                  min: 45,
                  max: 55,
                },
              },
              {
                id: 'piercing-shot-hit-2',
                tickOffset: 1,
                damage: {
                  min: 45,
                  max: 55,
                },
              },
            ],
          }),
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
      },
      gearSetup: {
        equipment: {
          feet: {
            instanceId: 'fleeting-boots-1',
            definitionId: 'fleeting-boots',
          },
        },
      },
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 12,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'snipe-1',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'snipe' },
          },
          {
            id: 'piercing-1',
            tick: 10,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'piercing-shot' },
          },
        ],
      },
    });

    const result = resolveCooldownTimeline(config);

    expect(result.cooldownTimeline[10]).toEqual({
      'piercing-shot': 15,
      snipe: 94,
    });
    expect(result.cooldownTimeline[11]).toEqual({
      'piercing-shot': 15,
      snipe: 88,
    });
  });
});
