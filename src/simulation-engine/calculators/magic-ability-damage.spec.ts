import { describe, expect, it } from 'vitest';

import type { ItemDefinition, SpellDefinition } from '../../game-data/types';
import type { SimulationConfig } from '../models';
import { calculateMagicAbilityDamage } from './magic-ability-damage';
import { calculateScaledCombatLevel } from './ranged-ability-damage';

describe('magic ability damage', () => {
  it('uses the live main-hand magic formula with spell tier and magic bonus', () => {
    const result = calculateMagicAbilityDamage(
      createConfig({
        magicLevel: 99,
        activeSpellId: 'fire-surge',
        items: {
          weapon: createItem('weapon', 'weapon', { damageTier: 95 }),
          ring: createItem('ring', 'ring', { magicBonus: 17.3 }),
          amulet: createItem('amulet', 'amulet', { magicBonus: 46.3 }),
        },
      }),
    );

    const scaledLevel = calculateScaledCombatLevel(99);
    const magicBonus = 17.3 + 46.3;
    const expected =
      Math.floor(2.5 * scaledLevel) +
      Math.floor(9.6 * 95 + magicBonus);

    expect(result).toBe(expected);
  });

  it('uses the live dual-wield magic formula with separate off-hand contribution', () => {
    const result = calculateMagicAbilityDamage(
      createConfig({
        magicLevel: 99,
        activeSpellId: 'fire-surge',
        items: {
          weapon: createItem('wand', 'weapon', { damageTier: 95 }),
          offHand: createItem('orb', 'offHand', { damageTier: 95 }),
          ring: createItem('ring', 'ring', { magicBonus: 17.3 }),
        },
      }),
    );

    const scaledLevel = calculateScaledCombatLevel(99);
    const magicBonus = 17.3;
    const mainHandContribution =
      Math.floor(2.5 * scaledLevel) +
      Math.floor(9.6 * 95 + magicBonus);
    const offHandContribution = Math.floor(
      0.5 * (
        Math.floor(2.5 * scaledLevel) +
        Math.floor(9.6 * 95 + magicBonus)
      ),
    );

    expect(result).toBe(mainHandContribution + offHandContribution);
  });

  it('uses the live two-handed magic formula with the selected spell tier', () => {
    const result = calculateMagicAbilityDamage(
      createConfig({
        magicLevel: 99,
        activeSpellId: 'incite-fear',
        items: {
          weapon: createItem('staff', 'weapon', { damageTier: 95 }, 'two-handed'),
          ring: createItem('ring', 'ring', { magicBonus: 17.3 }),
        },
      }),
    );

    const scaledLevel = calculateScaledCombatLevel(99);
    const magicBonus = 17.3;
    const effectiveTier = 95;
    const mainHandContribution =
      Math.floor(2.5 * scaledLevel) +
      Math.floor(9.6 * effectiveTier + magicBonus);
    const expected =
      mainHandContribution +
      Math.floor(1.25 * scaledLevel) +
      Math.floor(14.4 * effectiveTier + 1.5 * magicBonus);

    expect(result).toBe(expected);
  });
});

function createConfig(input: {
  magicLevel: number;
  activeSpellId: string;
  items: Partial<Record<'weapon' | 'offHand' | 'ring' | 'amulet', ItemDefinition>>;
}): SimulationConfig {
  return {
    playerStats: {
      rangedLevel: 99,
      magicLevel: input.magicLevel,
      prayerLevel: 99,
    },
    combatChoices: {
      magic: {
        spellbookId: input.activeSpellId === 'incite-fear' ? 'ancient' : 'standard',
        activeSpellId: input.activeSpellId,
      },
    },
    gearSetup: {
      equipment: {
        weapon: {
          instanceId: 'weapon-1',
          definitionId: input.items.weapon?.id ?? 'weapon',
        },
        ...(input.items.offHand
          ? {
              offHand: {
                instanceId: 'off-hand-1',
                definitionId: input.items.offHand.id,
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
      items: Object.fromEntries(
        Object.values(input.items)
          .filter((item): item is ItemDefinition => Boolean(item))
          .map((item) => [item.id, item]),
      ),
      ammo: {},
      spells: {
        'fire-surge': createSpell('fire-surge', 'Fire Surge', 'standard', 95),
        'incite-fear': createSpell('incite-fear', 'Incite Fear', 'ancient', 98),
      },
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

function createItem(
  id: string,
  slot: NonNullable<ItemDefinition['slot']>,
  offensiveStats: NonNullable<ItemDefinition['offensiveStats']>,
  equipBehavior?: string,
): ItemDefinition {
  return {
    id,
    name: id,
    category: slot === 'weapon' || slot === 'offHand' ? 'weapon' : 'jewellery',
    slot,
    combatStyleTags: ['magic'],
    offensiveStats,
    ...(equipBehavior ? { equipBehavior } : {}),
  };
}

function createSpell(
  id: string,
  name: string,
  spellbookId: SpellDefinition['spellbookId'],
  tier: number,
): SpellDefinition {
  return {
    id,
    name,
    spellbookId,
    role: 'combat',
    levelRequirement: tier,
    tier,
  };
}
