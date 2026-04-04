import { describe, expect, it } from 'vitest';

import { resolveConfiguredItemDefinition } from './configured-equipment-definition';
import type { SimulationConfig } from '../models';

function createConfig(): SimulationConfig {
  return {
    playerStats: {
      rangedLevel: 99,
      magicLevel: 99,
      prayerLevel: 99,
    },
    combatChoices: {
      magic: {
        spellbookId: 'standard',
        activeSpellId: 'fire-surge',
      },
    },
    gearSetup: {
      equipment: {},
    },
    inventory: {
      items: [],
    },
    persistentBuffConfig: {},
    rotationPlan: {
      startingAdrenaline: 100,
      tickCount: 30,
      nonGcdActions: [],
      abilityActions: [],
    },
    gameData: {
      items: {
        'fractured-staff-of-armadyl': {
          id: 'fractured-staff-of-armadyl',
          name: 'Fractured Staff of Armadyl',
          category: 'weapon',
          slot: 'weapon',
          combatStyleTags: ['magic'],
          tier: 95,
          offensiveStats: {
            damageTier: 95,
            accuracyTier: 95,
          },
          equipBehavior: 'two-handed',
        },
      },
      ammo: {},
      spells: {
        'fire-surge': {
          id: 'fire-surge',
          name: 'Fire Surge',
          spellbookId: 'standard',
          role: 'combat',
          levelRequirement: 95,
          tier: 95,
        },
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

describe('resolveConfiguredItemDefinition', () => {
  it('applies the Genesis upgrade to Fractured Staff of Armadyl', () => {
    const config = createConfig();
    config.inventory.items = [
      {
        instanceId: 'fsoa-1',
        definitionId: 'fractured-staff-of-armadyl',
        configValues: {
          'genesis-enchanted': true,
        },
      },
    ];

    const resolved = resolveConfiguredItemDefinition(config, config.inventory.items[0]);

    expect(resolved?.offensiveStats?.['damageTier']).toBe(100);
    expect(resolved?.offensiveStats?.['accuracyTier']).toBe(100);
  });

  it('shares the Genesis upgrade across Roar of Awakening and Ode to Deceit', () => {
    const config = createConfig();
    config.gameData.items['roar-of-awakening'] = {
      id: 'roar-of-awakening',
      name: 'Roar of Awakening',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['magic'],
      tier: 95,
      offensiveStats: {
        damageTier: 95,
        accuracyTier: 95,
      },
    };
    config.gameData.items['ode-to-deceit'] = {
      id: 'ode-to-deceit',
      name: 'Ode to Deceit',
      category: 'weapon',
      slot: 'offHand',
      combatStyleTags: ['magic'],
      tier: 95,
      offensiveStats: {
        damageTier: 95,
        accuracyTier: 95,
      },
    };
    config.inventory.items = [
      {
        instanceId: 'roar-1',
        definitionId: 'roar-of-awakening',
        configValues: {
          'genesis-enchanted': true,
        },
      },
      {
        instanceId: 'ode-1',
        definitionId: 'ode-to-deceit',
      },
    ];

    const resolvedRoar = resolveConfiguredItemDefinition(config, config.inventory.items[0]);
    const resolvedOde = resolveConfiguredItemDefinition(config, config.inventory.items[1]);

    expect(resolvedRoar?.offensiveStats?.['damageTier']).toBe(100);
    expect(resolvedRoar?.offensiveStats?.['accuracyTier']).toBe(100);
    expect(resolvedOde?.offensiveStats?.['damageTier']).toBe(100);
    expect(resolvedOde?.offensiveStats?.['accuracyTier']).toBe(100);
  });
});
