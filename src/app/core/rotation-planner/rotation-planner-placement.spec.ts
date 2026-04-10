import { describe, expect, it } from 'vitest';

import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition, ItemDefinition } from '../../../game-data/types';
import { canPlaceAbilityOnPlannerLane, evaluateAbilityPlacement } from './rotation-planner-placement';

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

const RUNIC_CHARGE: AbilityDefinition = {
  id: 'runic-charge',
  name: 'Runic Charge',
  style: 'magic',
  subtype: 'utility',
  cooldownTicks: 50,
  adrenalineCost: 0,
  requires: {
    levelRequirements: {
      magic: 26,
    },
  },
  hitSchedule: [],
  baseDamage: {
    min: 0,
    max: 0,
  },
  plannerPlacement: {
    allowedLanes: ['non-gcd'],
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
    [RUNIC_CHARGE.id]: RUNIC_CHARGE,
  },
  buffs: {},
  perks: {},
  relics: {},
  eofSpecs: {},
};

describe('evaluateAbilityPlacement', () => {
  it('resolves planner lanes from ability data with utility defaults', () => {
    expect(canPlaceAbilityOnPlannerLane(DEADSHOT, 'ability')).toBe(true);
    expect(canPlaceAbilityOnPlannerLane(DEADSHOT, 'non-gcd')).toBe(false);
    expect(canPlaceAbilityOnPlannerLane(DEATHS_SWIFTNESS, 'non-gcd')).toBe(false);

    const utilityAbility: AbilityDefinition = {
      ...RUNIC_CHARGE,
      id: 'utility-default',
      plannerPlacement: undefined,
    };

    expect(canPlaceAbilityOnPlannerLane(utilityAbility, 'ability')).toBe(true);
    expect(canPlaceAbilityOnPlannerLane(utilityAbility, 'non-gcd')).toBe(true);
    expect(canPlaceAbilityOnPlannerLane(RUNIC_CHARGE, 'ability')).toBe(false);
    expect(canPlaceAbilityOnPlannerLane(RUNIC_CHARGE, 'non-gcd')).toBe(true);
  });

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

  it('blocks Runic Charge placement on the ability lane', () => {
    const result = evaluateAbilityPlacement({
      abilityActions: [],
      nonGcdActions: [],
      abilityDefinitions: CATALOG.abilities,
      tickCount: 30,
      startingAdrenaline: 100,
      abilityDefinition: RUNIC_CHARGE,
      tick: 3,
      payload: {
        sourceType: 'catalog',
        abilityId: 'runic-charge',
      },
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
        magicLevel: 99,
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
        code: 'ability.invalid_lane',
        severity: 'error',
        tick: 3,
        message: 'Runic Charge can only be placed on the non-GCD lane.',
      },
    });
  });
});
