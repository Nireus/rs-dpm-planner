import { describe, expect, it } from 'vitest';

import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition } from '../../../game-data/types';
import type { GearBuilderState } from '../../core/gear/gear-state';
import { evaluateAbilityPlacement } from './rotation-planner-placement';

const BASIC_ABILITY: AbilityDefinition = {
  id: 'basic-shot',
  name: 'Basic Shot',
  style: 'ranged',
  subtype: 'basic',
  cooldownTicks: 5,
  adrenalineGain: 9,
  hitSchedule: [],
  baseDamage: {
    min: 90,
    max: 110,
  },
};

const ULTIMATE_ABILITY: AbilityDefinition = {
  id: 'ultimate-shot',
  name: 'Ultimate Shot',
  style: 'ranged',
  subtype: 'ultimate',
  cooldownTicks: 50,
  adrenalineCost: 60,
  hitSchedule: [],
  baseDamage: {
    min: 400,
    max: 500,
  },
};

const CATALOG: GameDataCatalog = {
  items: {},
  ammo: {},
  abilities: {
    [BASIC_ABILITY.id]: BASIC_ABILITY,
    [ULTIMATE_ABILITY.id]: ULTIMATE_ABILITY,
  },
  buffs: {},
  perks: {},
  relics: {},
  eofSpecs: {},
};

const EMPTY_GEAR_STATE: GearBuilderState = {
  equipment: {},
  inventory: [],
};

describe('rotation planner placement', () => {
  it('allows placement even when the target ability would later validate as on cooldown', () => {
    const result = evaluateAbilityPlacement({
      abilityActions: [
        {
          id: 'existing-basic',
          tick: 0,
          lane: 'ability',
          actionType: 'ability-use',
          payload: {
            abilityId: BASIC_ABILITY.id,
          },
        },
      ],
      nonGcdActions: [],
      abilityDefinitions: CATALOG.abilities,
      tickCount: 18,
      startingAdrenaline: 0,
      abilityDefinition: BASIC_ABILITY,
      tick: 3,
      payload: {
        sourceType: 'catalog',
        abilityId: BASIC_ABILITY.id,
      },
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
      },
      gearState: EMPTY_GEAR_STATE,
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
    });

    expect(result.isPlaceable).toBe(true);
    expect(result.issue).toBeUndefined();
  });

  it('allows placement even when the target ability would later validate as lacking adrenaline', () => {
    const result = evaluateAbilityPlacement({
      abilityActions: [],
      nonGcdActions: [],
      abilityDefinitions: CATALOG.abilities,
      tickCount: 18,
      startingAdrenaline: 0,
      abilityDefinition: ULTIMATE_ABILITY,
      tick: 0,
      payload: {
        sourceType: 'catalog',
        abilityId: ULTIMATE_ABILITY.id,
      },
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
      },
      gearState: EMPTY_GEAR_STATE,
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
    });

    expect(result.isPlaceable).toBe(true);
    expect(result.issue).toBeUndefined();
  });

  it('allows placement when cooldown and adrenaline requirements are satisfied', () => {
    const result = evaluateAbilityPlacement({
      abilityActions: [
        {
          id: 'existing-basic',
          tick: 0,
          lane: 'ability',
          actionType: 'ability-use',
          payload: {
            abilityId: BASIC_ABILITY.id,
          },
        },
      ],
      nonGcdActions: [],
      abilityDefinitions: CATALOG.abilities,
      tickCount: 18,
      startingAdrenaline: 60,
      abilityDefinition: ULTIMATE_ABILITY,
      tick: 6,
      payload: {
        sourceType: 'catalog',
        abilityId: ULTIMATE_ABILITY.id,
      },
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
      },
      gearState: EMPTY_GEAR_STATE,
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
    });

    expect(result.isPlaceable).toBe(true);
    expect(result.issue).toBeUndefined();
  });
});
