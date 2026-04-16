import { describe, expect, it } from 'vitest';

import type { ItemDefinition } from '../../game-data/types';
import type { SimulationConfig } from '../models';
import { calculateRangedAbilityDamage, calculateScaledCombatLevel } from './ranged-ability-damage';

describe('ranged ability damage', () => {
  it('uses the post-2-March-2026 scaled level formula', () => {
    expect(calculateScaledCombatLevel(1)).toBeCloseTo(1.273952, 6);
    expect(calculateScaledCombatLevel(50)).toBeCloseTo(58.015666, 6);
    expect(calculateScaledCombatLevel(99)).toBeCloseTo(105.924803, 6);
    expect(calculateScaledCombatLevel(145)).toBeCloseTo(145, 6);
  });

  it('uses raw summed ranged bonuses instead of truncating each item contribution', () => {
    const result = calculateRangedAbilityDamage(
      createConfig({
        rangedLevel: 99,
        items: {
          weapon: createItem('weapon', 'weapon', { damageTier: 95 }),
          ammo: createItem('ammo', 'ammo', { damageTier: 95 }),
          ring: createItem('ring', 'ring', { rangedBonus: 16.8 }),
          amulet: createItem('amulet', 'amulet', { rangedBonus: 30.4 }),
          body: createItem('body', 'body', { rangedBonus: 36.8 }),
        },
      }),
    );

    expect(result).toBe(1890);
  });

  it('uses the lower of weapon tier and ammo tier when ammo is equipped', () => {
    const result = calculateRangedAbilityDamage(
      createConfig({
        rangedLevel: 99,
        items: {
          weapon: createItem('weapon', 'weapon', { damageTier: 95 }),
          ammo: createItem('ammo', 'ammo', { damageTier: 92 }),
          ring: createItem('ring', 'ring', { rangedBonus: 16.8 }),
          amulet: createItem('amulet', 'amulet', { rangedBonus: 56 }),
        },
      }),
    );

    expect(result).toBe(1828);
  });

  it('falls back to weapon tier when ranged ammo is not equipped', () => {
    const result = calculateRangedAbilityDamage(
      createConfig({
        rangedLevel: 99,
        items: {
          weapon: createItem('weapon', 'weapon', { damageTier: 95 }),
          ring: createItem('ring', 'ring', { rangedBonus: 16.8 }),
          amulet: createItem('amulet', 'amulet', { rangedBonus: 56 }),
        },
      }),
    );

    expect(result).toBe(1872);
  });

  it('treats Genesis-enchanted Bow of the Last Guardian as tier 100 damage when ammo does not cap it', () => {
    const result = calculateRangedAbilityDamage(
      createConfig({
        rangedLevel: 99,
        items: {
          weapon: createItem('bolg', 'weapon', { damageTier: 95, accuracyTier: 95 }, undefined, {
            'genesis-enchanted': true,
          }),
          ring: createItem('ring', 'ring', { rangedBonus: 16.8 }),
          amulet: createItem('amulet', 'amulet', { rangedBonus: 56 }),
        },
      }),
    );

    const scaledLevel = calculateScaledCombatLevel(99);
    const rangedBonus = 16.8 + 56;
    const expected =
      Math.floor(2.5 * scaledLevel) +
      Math.floor(1.25 * scaledLevel) +
      Math.floor(9.6 * 100 + rangedBonus) +
      Math.floor(4.8 * 100 + 0.5 * rangedBonus);

    expect(result).toBe(expected);
  });

  it('applies Reaper Crew ranged offensive stat bonus from persistent buffs', () => {
    const withoutReaperCrew = calculateRangedAbilityDamage(
      createConfig({
        rangedLevel: 99,
        items: {
          weapon: createItem('weapon', 'weapon', { damageTier: 95 }),
        },
      }),
    );
    const withReaperCrew = calculateRangedAbilityDamage(
      createConfig({
        rangedLevel: 99,
        items: {
          weapon: createItem('weapon', 'weapon', { damageTier: 95 }),
        },
        activeBuffIds: ['reaper-crew'],
      }),
    );

    expect(withReaperCrew).toBeGreaterThan(withoutReaperCrew);
    expect(withReaperCrew - withoutReaperCrew).toBe(18);
  });
});

function createConfig(input: {
  rangedLevel: number;
  items: Partial<Record<'weapon' | 'ammo' | 'ring' | 'amulet' | 'body', ItemDefinition>>;
  activeBuffIds?: string[];
}): SimulationConfig {
  const weaponConfigValues = buildConfigValues(input.items.weapon);

  return {
    playerStats: {
      rangedLevel: input.rangedLevel,
      prayerLevel: 99,
    },
    gearSetup: {
      equipment: {
        weapon: {
          instanceId: 'weapon-1',
          definitionId: input.items.weapon?.id ?? 'weapon',
          ...(weaponConfigValues ? { configValues: weaponConfigValues } : {}),
        },
        ...(input.items.ammo
          ? {
              ammo: {
                instanceId: 'ammo-1',
                definitionId: input.items.ammo.id,
              },
            }
          : {}),
        ...(input.items.ring
          ? {
              ring: {
                instanceId: 'ring-1',
                definitionId: input.items.ring.id,
              },
            }
          : {}),
        ...(input.items.amulet
          ? {
              amulet: {
                instanceId: 'amulet-1',
                definitionId: input.items.amulet.id,
              },
            }
          : {}),
        ...(input.items.body
          ? {
              body: {
                instanceId: 'body-1',
                definitionId: input.items.body.id,
              },
            }
          : {}),
      },
    },
    inventory: {
      items: [],
    },
    persistentBuffConfig: {
      buffIds: input.activeBuffIds ?? [],
    },
    rotationPlan: {
      startingAdrenaline: 0,
      tickCount: 1,
      nonGcdActions: [],
      abilityActions: [],
    },
    gameData: {
      items: Object.fromEntries(Object.values(input.items).filter(Boolean).map((item) => [item.id, item])),
      ammo: {},
      abilities: {},
      buffs: {
        'reaper-crew': {
          id: 'reaper-crew',
          name: 'Reaper Crew',
          category: 'miscellaneous',
          sourceType: 'player-config',
          effectRefs: ['offensive-stat-bonus:ranged:+12'],
        },
      },
      perks: {},
      relics: {},
      eofSpecs: {},
    },
    modeFlags: {
      strictValidation: true,
    },
  };
}

function buildConfigValues(
  item?: Pick<ItemDefinition, 'configOptions'>,
): Record<string, string | number | boolean> | undefined {
  if (!item?.configOptions?.length) {
    return undefined;
  }

  return Object.fromEntries(
    item.configOptions.map((option) => [option.id, option.defaultValue ?? false]),
  ) as Record<string, string | number | boolean>;
}

function createItem(
  id: string,
  slot: ItemDefinition['slot'],
  offensiveStats: NonNullable<ItemDefinition['offensiveStats']>,
  configOptions?: ItemDefinition['configOptions'],
  configValues?: Record<string, boolean | number | string>,
): ItemDefinition {
  const category =
    slot === 'ammo'
      ? 'ammo'
      : slot === 'weapon'
        ? 'weapon'
        : slot === 'ring' || slot === 'amulet'
          ? 'jewellery'
          : 'armor';

  return {
    id,
    name: id,
    category,
    slot,
    combatStyleTags: ['ranged'],
    offensiveStats,
    configOptions: configOptions ?? (
      configValues
        ? Object.entries(configValues).map(([optionId, defaultValue]) => ({
            id: optionId,
            label: optionId,
            type: 'boolean' as const,
            defaultValue,
          }))
        : undefined
    ),
  };
}
