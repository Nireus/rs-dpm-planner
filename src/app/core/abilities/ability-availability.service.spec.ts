import { describe, expect, it } from 'vitest';

import type { AbilityDefinition, ItemDefinition } from '../../../game-data/types';
import type { AbilityAvailabilityResult } from '../../../simulation-engine/rules/ability-availability';
import { relaxAbilityAvailabilityForPalette } from './ability-availability.service';

const rangedAbility: AbilityDefinition = {
  id: 'deadshot',
  name: 'Deadshot',
  style: 'ranged',
  subtype: 'ultimate',
  cooldownTicks: 50,
  hitSchedule: [],
  baseDamage: {
    min: 1,
    max: 2,
  },
};

const bowInBackpack: ItemDefinition = {
  id: 'eldritch-crossbow',
  name: 'Eldritch crossbow',
  category: 'weapon',
  slot: 'weapon',
  combatStyleTags: ['ranged'],
};

const staffInBackpack: ItemDefinition = {
  id: 'fractured-staff-of-armadyl',
  name: 'Fractured Staff of Armadyl',
  category: 'weapon',
  slot: 'weapon',
  combatStyleTags: ['magic'],
  equipBehavior: 'two-handed',
};

const meleeMainHandInBackpack: ItemDefinition = {
  id: 'dark-shard-of-leng',
  name: 'Dark Shard of Leng',
  category: 'weapon',
  slot: 'weapon',
  combatStyleTags: ['melee'],
};

const meleeOffHandInBackpack: ItemDefinition = {
  id: 'dark-sliver-of-leng',
  name: 'Dark Sliver of Leng',
  category: 'weapon',
  slot: 'offHand',
  combatStyleTags: ['melee'],
};

describe('relaxAbilityAvailabilityForPalette', () => {
  it('treats ranged abilities as palette-available when a ranged weapon is in backpack', () => {
    const strictAvailability: AbilityAvailabilityResult = {
      abilityId: 'deadshot',
      isAvailable: false,
      issues: [
        {
          code: 'missing-tag',
          message: 'Requires an equipped ranged weapon.',
        },
      ],
    };

    expect(
      relaxAbilityAvailabilityForPalette(rangedAbility, strictAvailability, [], [bowInBackpack]),
    ).toEqual({
      abilityId: 'deadshot',
      isAvailable: true,
      issues: [],
    });
  });

  it('treats magic abilities as palette-available when a staff is in backpack', () => {
    const strictAvailability: AbilityAvailabilityResult = {
      abilityId: 'greater-concentrated-blast',
      isAvailable: false,
      issues: [
        {
          code: 'missing-tag',
          message: 'Requires an equipped magic weapon.',
        },
      ],
    };

    const magicAbility: AbilityDefinition = {
      ...rangedAbility,
      id: 'greater-concentrated-blast',
      name: 'Greater Concentrated Blast',
      style: 'magic',
      subtype: 'basic',
      requires: {
        requiredEquipmentTags: ['magic-weapon'],
      },
    };

    expect(
      relaxAbilityAvailabilityForPalette(magicAbility, strictAvailability, [], [staffInBackpack]),
    ).toEqual({
      abilityId: 'greater-concentrated-blast',
      isAvailable: true,
      issues: [],
    });
  });

  it('treats dual-wield melee abilities as palette-available when both weapons are accessible', () => {
    const strictAvailability: AbilityAvailabilityResult = {
      abilityId: 'flurry',
      isAvailable: false,
      issues: [
        {
          code: 'missing-tag',
          message: 'Requires dual-wield melee weapons.',
        },
      ],
    };

    const dualWieldAbility: AbilityDefinition = {
      id: 'flurry',
      name: 'Flurry',
      style: 'melee',
      subtype: 'enhanced',
      cooldownTicks: 34,
      hitSchedule: [],
      baseDamage: {
        min: 1,
        max: 2,
      },
      requires: {
        requiredEquipmentTags: ['melee-dual-wield'],
      },
    };

    expect(
      relaxAbilityAvailabilityForPalette(
        dualWieldAbility,
        strictAvailability,
        [],
        [meleeMainHandInBackpack, meleeOffHandInBackpack],
      ),
    ).toEqual({
      abilityId: 'flurry',
      isAvailable: true,
      issues: [],
    });
  });

  it('keeps topology requirements blocked when the accessible gear cannot satisfy them', () => {
    const strictAvailability: AbilityAvailabilityResult = {
      abilityId: 'needle-strike',
      isAvailable: false,
      issues: [
        {
          code: 'missing-tag',
          message: 'Requires dual-wield ranged weapons.',
        },
      ],
    };

    const dualWieldAbility: AbilityDefinition = {
      ...rangedAbility,
      id: 'needle-strike',
      name: 'Needle Strike',
      subtype: 'basic',
      requires: {
        requiredEquipmentTags: ['ranged-dual-wield'],
      },
    };

    expect(
      relaxAbilityAvailabilityForPalette(dualWieldAbility, strictAvailability, [], [bowInBackpack]),
    ).toEqual(strictAvailability);
  });
});
