import { describe, expect, it } from 'vitest';

import type { ItemDefinition } from '../../game-data/types';
import type { SimulationConfig } from '../models';
import { calculateMeleeAbilityDamage } from './melee-ability-damage';
import { calculateScaledCombatLevel } from './ranged-ability-damage';

describe('melee ability damage', () => {
  it('uses the live main-hand melee formula with Strength scaling and melee bonus', () => {
    const result = calculateMeleeAbilityDamage(
      createConfig({
        strengthLevel: 99,
        items: {
          weapon: createItem('weapon', 'weapon', { damageTier: 95 }),
          ring: createItem('ring', 'ring', { meleeBonus: 17.3 }),
          amulet: createItem('amulet', 'amulet', { meleeBonus: 46.3 }),
          body: createItem('body', 'body', { meleeBonus: 37.5 }),
        },
      }),
    );

    const scaledLevel = calculateScaledCombatLevel(99);
    const meleeBonus = 17.3 + 46.3 + 37.5;
    const expected =
      Math.floor(2.5 * scaledLevel) +
      Math.floor(9.6 * 95 + meleeBonus);

    expect(result).toBe(expected);
  });

  it('uses the live dual-wield melee formula with separate off-hand contribution', () => {
    const result = calculateMeleeAbilityDamage(
      createConfig({
        strengthLevel: 99,
        items: {
          weapon: createItem('main-hand', 'weapon', { damageTier: 95 }),
          offHand: createItem('off-hand', 'offHand', { damageTier: 95 }),
          ring: createItem('ring', 'ring', { meleeBonus: 17.3 }),
          amulet: createItem('amulet', 'amulet', { meleeBonus: 46.3 }),
        },
      }),
    );

    const scaledLevel = calculateScaledCombatLevel(99);
    const meleeBonus = 17.3 + 46.3;
    const mainHandContribution =
      Math.floor(2.5 * scaledLevel) +
      Math.floor(9.6 * 95 + meleeBonus);
    const offHandContribution = Math.floor(
      0.5 * (
        Math.floor(2.5 * scaledLevel) +
        Math.floor(9.6 * 95 + meleeBonus)
      ),
    );

    expect(result).toBe(mainHandContribution + offHandContribution);
  });

  it('uses the live two-handed melee formula with the extra two-handed term', () => {
    const result = calculateMeleeAbilityDamage(
      createConfig({
        strengthLevel: 99,
        items: {
          weapon: createItem('two-hand', 'weapon', { damageTier: 95 }, 'two-handed'),
          ring: createItem('ring', 'ring', { meleeBonus: 17.3 }),
          amulet: createItem('amulet', 'amulet', { meleeBonus: 46.3 }),
        },
      }),
    );

    const scaledLevel = calculateScaledCombatLevel(99);
    const meleeBonus = 17.3 + 46.3;
    const expected =
      Math.floor(2.5 * scaledLevel) +
      Math.floor(1.25 * scaledLevel) +
      Math.floor(9.6 * 95 + meleeBonus) +
      Math.floor(4.8 * 95 + 0.5 * meleeBonus);

    expect(result).toBe(expected);
  });

  it('caps melee weapon scaling by Strength level for low-level players', () => {
    const result = calculateMeleeAbilityDamage(
      createConfig({
        strengthLevel: 80,
        items: {
          weapon: createItem('weapon', 'weapon', { damageTier: 95 }),
        },
      }),
    );

    const scaledLevel = calculateScaledCombatLevel(80);
    const expected =
      Math.floor(2.5 * scaledLevel) +
      Math.floor(9.6 * 80);

    expect(result).toBe(expected);
  });

  it('treats a Genesis-enchanted Ek-ZekKil as tier 100 for two-handed melee damage', () => {
    const result = calculateMeleeAbilityDamage(
      createConfig({
        strengthLevel: 99,
        items: {
          weapon: createItem(
            'ek-zekkil',
            'weapon',
            { damageTier: 95, accuracyTier: 95 },
            'two-handed',
            { 'genesis-enchanted': true },
          ),
          ring: createItem('ring', 'ring', { meleeBonus: 17.3 }),
          amulet: createItem('amulet', 'amulet', { meleeBonus: 46.3 }),
        },
      }),
    );

    const scaledLevel = calculateScaledCombatLevel(99);
    const meleeBonus = 17.3 + 46.3;
    const expected =
      Math.floor(2.5 * scaledLevel) +
      Math.floor(1.25 * scaledLevel) +
      Math.floor(9.6 * 99 + meleeBonus) +
      Math.floor(4.8 * 100 + 0.5 * meleeBonus);

    expect(result).toBe(expected);
  });

  it('applies one Genesis unlock to both Leng weapons when dual-wielding', () => {
    const result = calculateMeleeAbilityDamage(
      createConfig({
        strengthLevel: 99,
        items: {
          weapon: createItem('dark-shard-of-leng', 'weapon', { damageTier: 95, accuracyTier: 95 }),
          offHand: createItem(
            'dark-sliver-of-leng',
            'offHand',
            { damageTier: 95, accuracyTier: 95 },
            undefined,
            { 'genesis-enchanted': true },
          ),
          ring: createItem('ring', 'ring', { meleeBonus: 17.3 }),
        },
      }),
    );

    const scaledLevel = calculateScaledCombatLevel(99);
    const meleeBonus = 17.3;
    const mainHandContribution =
      Math.floor(2.5 * scaledLevel) +
      Math.floor(9.6 * 99 + meleeBonus);
    const offHandContribution = Math.floor(
      0.5 * (
        Math.floor(2.5 * scaledLevel) +
        Math.floor(9.6 * 99 + meleeBonus)
      ),
    );

    expect(result).toBe(mainHandContribution + offHandContribution);
  });
});

function createConfig(input: {
  strengthLevel: number;
  items: Partial<Record<'weapon' | 'offHand' | 'ring' | 'amulet' | 'body', ItemDefinition>>;
}): SimulationConfig {
  const weaponConfigValues = buildConfigValues(input.items.weapon);
  const offHandConfigValues = buildConfigValues(input.items.offHand);

  return {
    playerStats: {
      rangedLevel: 99,
      strengthLevel: input.strengthLevel,
      prayerLevel: 99,
    },
    gearSetup: {
      equipment: {
        weapon: {
          instanceId: 'weapon-1',
          definitionId: input.items.weapon?.id ?? 'weapon',
          ...(weaponConfigValues ? { configValues: weaponConfigValues } : {}),
        },
        ...(input.items.offHand
          ? {
              offHand: {
                instanceId: 'off-hand-1',
                definitionId: input.items.offHand.id,
                ...(offHandConfigValues ? { configValues: offHandConfigValues } : {}),
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
    persistentBuffConfig: {},
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
      buffs: {},
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
  equipBehavior?: string,
  configValues?: Record<string, boolean | number | string>,
): ItemDefinition {
  const category =
    slot === 'weapon' || slot === 'offHand'
      ? 'weapon'
      : slot === 'ring' || slot === 'amulet'
        ? 'jewellery'
        : 'armor';

  return {
    id,
    name: id,
    category,
    slot,
    combatStyleTags: ['melee'],
    offensiveStats,
    equipBehavior,
    configOptions: configValues
      ? Object.entries(configValues).map(([optionId, defaultValue]) => ({
          id: optionId,
          label: optionId,
          type: 'boolean' as const,
          defaultValue,
        }))
      : undefined,
  };
}
