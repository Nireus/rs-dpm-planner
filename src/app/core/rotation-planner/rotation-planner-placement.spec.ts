import { describe, expect, it } from 'vitest';

import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition, ItemDefinition } from '../../../game-data/types';
import { evaluateAbilityPlacement } from './rotation-planner-placement';

const DEADSHOT: AbilityDefinition = {
  id: 'deadshot',
  name: 'Deadshot',
  style: 'ranged',
  subtype: 'ultimate',
  cooldownTicks: 50,
  adrenalineGain: -60,
  hitSchedule: [
    {
      id: 'deadshot-hit-1',
      tickOffset: 0,
      damage: {
        min: 105,
        max: 125,
      },
    },
  ],
  baseDamage: {
    min: 420,
    max: 500,
  },
};

const DEATHS_SWIFTNESS: AbilityDefinition = {
  id: 'deaths-swiftness',
  name: "Death's Swiftness",
  style: 'ranged',
  subtype: 'ultimate',
  cooldownTicks: 50,
  adrenalineGain: -60,
  hitSchedule: [],
  baseDamage: {
    min: 0,
    max: 0,
  },
};

const BOW: ItemDefinition = {
  id: 'bow-of-the-last-guardian',
  name: 'Bow of the Last Guardian',
  category: 'weapon',
  slot: 'weapon',
  combatStyleTags: ['ranged'],
};

const CATALOG: GameDataCatalog = {
  items: {
    [BOW.id]: BOW,
  },
  ammo: {},
  spells: {},
  abilities: {
    [DEADSHOT.id]: DEADSHOT,
    [DEATHS_SWIFTNESS.id]: DEATHS_SWIFTNESS,
  },
  buffs: {},
  perks: {},
  relics: {},
  eofSpecs: {},
};

describe('evaluateAbilityPlacement', () => {
  it('allows structurally valid placement even if the later rotation may become invalid', () => {
    const result = evaluateAbilityPlacement({
      abilityActions: [
        {
          id: 'deadshot-1',
          tick: 3,
          lane: 'ability',
          actionType: 'ability-use',
          payload: {
            abilityId: 'deadshot',
          },
        },
      ],
      nonGcdActions: [
        {
          id: 'deaths-swiftness-1',
          tick: 0,
          lane: 'non-gcd',
          actionType: 'ability-use',
          payload: {
            abilityId: 'deaths-swiftness',
          },
        },
      ],
      abilityDefinitions: CATALOG.abilities,
      tickCount: 30,
      startingAdrenaline: 100,
      abilityDefinition: DEADSHOT,
      tick: 3,
      payload: {
        sourceType: 'timeline',
        actionId: 'deadshot-1',
        abilityId: 'deadshot',
      },
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
      },
      gearState: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: BOW.id,
          },
        },
        inventory: [],
      },
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
    });

    expect(result).toEqual({
      isPlaceable: true,
    });
  });

  it('blocks ranged ability placement when no ranged weapon is equipped', () => {
    const result = evaluateAbilityPlacement({
      abilityActions: [],
      nonGcdActions: [],
      abilityDefinitions: CATALOG.abilities,
      tickCount: 30,
      startingAdrenaline: 100,
      abilityDefinition: DEADSHOT,
      tick: 3,
      payload: {
        sourceType: 'catalog',
        abilityId: 'deadshot',
      },
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
      },
      gearState: {
        equipment: {},
        inventory: [],
      },
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
    });

    expect(result).toEqual({
      isPlaceable: false,
      issue: {
        code: 'ability.unavailable',
        severity: 'error',
        tick: 3,
        message: 'Requires an equipped ranged weapon.',
      },
    });
  });
});
