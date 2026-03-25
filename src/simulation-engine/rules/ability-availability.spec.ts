import { describe, expect, it } from 'vitest';
import type { AbilityDefinition, ItemDefinition } from '../../game-data/types';
import type { ItemInstanceConfig, PlayerStats } from '../models';
import { collectAvailabilityTags, evaluateAbilityAvailability } from './ability-availability';

const rangedWeapon: ItemDefinition = {
  id: 'sample-bow',
  name: 'Sample Bow',
  category: 'weapon',
  slot: 'weapon',
  combatStyleTags: ['ranged'],
};

const specialWeapon: ItemDefinition = {
  id: 'special-bow',
  name: 'Special Bow',
  category: 'weapon',
  slot: 'weapon',
  combatStyleTags: ['ranged'],
  effectRefs: ['weapon-special-access', 'weapon-special:sample'],
};

const eofAmulet: ItemDefinition = {
  id: 'essence-of-finality',
  name: 'Essence of Finality amulet',
  category: 'jewellery',
  slot: 'amulet',
  combatStyleTags: ['ranged'],
  effectRefs: ['eof-special-access'],
};

const prototypeItem: ItemDefinition = {
  id: 'ranged-mechanic-prototype',
  name: 'Prototype Item',
  category: 'other',
  combatStyleTags: ['ranged'],
  effectRefs: ['prototype-inventory-ability'],
};

const baseStats: PlayerStats = {
  rangedLevel: 99,
  prayerLevel: 95,
};

describe('evaluateAbilityAvailability', () => {
  it('allows abilities when levels and required tags are satisfied', () => {
    const ability: AbilityDefinition = {
      id: 'rapid-fire',
      name: 'Rapid Fire',
      style: 'ranged',
      subtype: 'enhanced',
      cooldownTicks: 17,
      hitSchedule: [],
      baseDamage: { min: 1, max: 2 },
      requires: {
        levelRequirements: { ranged: 37 },
        requiredEquipmentTags: ['ranged-weapon'],
      },
    };

    expect(
      evaluateAbilityAvailability(ability, {
        playerStats: baseStats,
        equippedItems: [rangedWeapon],
        inventoryItems: [],
      }),
    ).toEqual({
      abilityId: 'rapid-fire',
      isAvailable: true,
      issues: [],
    });
  });

  it('reports missing levels and weapon tags', () => {
    const ability: AbilityDefinition = {
      id: 'snipe',
      name: 'Snipe',
      style: 'ranged',
      subtype: 'basic',
      cooldownTicks: 10,
      hitSchedule: [],
      baseDamage: { min: 1, max: 2 },
      requires: {
        levelRequirements: { ranged: 95 },
        requiredEquipmentTags: ['ranged-weapon'],
      },
    };

    expect(
      evaluateAbilityAvailability(ability, {
        playerStats: { rangedLevel: 80 },
        equippedItems: [],
        inventoryItems: [],
      }),
    ).toEqual({
      abilityId: 'snipe',
      isAvailable: false,
      issues: [
        { code: 'missing-level', message: 'Ranged 95 required.' },
        { code: 'missing-tag', message: 'Requires an equipped ranged weapon.' },
      ],
    });
  });

  it('supports inventory-enabled requirement tags', () => {
    const ability: AbilityDefinition = {
      id: 'prototype-shot',
      name: 'Prototype Shot',
      style: 'ranged',
      subtype: 'other',
      cooldownTicks: 6,
      hitSchedule: [],
      baseDamage: { min: 1, max: 2 },
      requires: {
        requiredEquipmentTags: ['prototype-inventory-ability'],
      },
    };

    expect(
      evaluateAbilityAvailability(ability, {
        playerStats: baseStats,
        equippedItems: [],
        inventoryItems: [prototypeItem],
      }).isAvailable,
    ).toBe(true);
  });

  it('supports EOF stored special access tags', () => {
    const ability: AbilityDefinition = {
      id: 'essence-of-finality',
      name: 'Essence of Finality',
      style: 'constitution',
      subtype: 'special',
      cooldownTicks: 0,
      hitSchedule: [],
      baseDamage: { min: 0, max: 0 },
      requires: {
        requiredEquipmentTags: ['equipped-effect:eof-special-access', 'eof-stored-special-configured'],
      },
    };

    const eofInstance: ItemInstanceConfig = {
      instanceId: 'eof-1',
      definitionId: 'essence-of-finality',
      configValues: {
        'stored-special': 'seren-godbow',
      },
    };

    expect(
      collectAvailabilityTags({
        playerStats: baseStats,
        equippedItems: [eofAmulet],
        inventoryItems: [],
        equippedInstances: [eofInstance],
      }).has('eof-special:seren-godbow'),
    ).toBe(true);

    expect(
      evaluateAbilityAvailability(ability, {
        playerStats: baseStats,
        equippedItems: [eofAmulet],
        inventoryItems: [],
        equippedInstances: [eofInstance],
      }).isAvailable,
    ).toBe(true);
  });

  it('supports generic weapon special access tags', () => {
    const ability: AbilityDefinition = {
      id: 'weapon-special-attack',
      name: 'Weapon Special Attack',
      style: 'constitution',
      subtype: 'special',
      cooldownTicks: 0,
      hitSchedule: [],
      baseDamage: { min: 0, max: 0 },
      requires: {
        requiredEquipmentTags: ['equipped-effect:weapon-special-access'],
      },
    };

    expect(
      evaluateAbilityAvailability(ability, {
        playerStats: baseStats,
        equippedItems: [specialWeapon],
        inventoryItems: [],
      }).isAvailable,
    ).toBe(true);
  });
});
