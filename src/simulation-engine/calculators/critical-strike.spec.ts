import { describe, expect, it } from 'vitest';

import type { AbilityDefinition } from '../../game-data/types';
import type { LoadedGameDataSnapshot, SimulationConfig } from '../models';
import { applyExpectedValueCriticalStrike } from './critical-strike';

function createAbility(overrides: Partial<AbilityDefinition> = {}): AbilityDefinition {
  return {
    id: 'basic-shot',
    name: 'Basic Shot',
    style: 'ranged',
    subtype: 'basic',
    cooldownTicks: 3,
    hitSchedule: [],
    baseDamage: {
      min: 100,
      max: 100,
    },
    ...overrides,
  };
}

function createConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  const gameData: LoadedGameDataSnapshot = {
    items: {
      bolg: {
        id: 'bolg',
        name: 'Bow of the Last Guardian',
        category: 'weapon',
        slot: 'weapon',
        combatStyleTags: ['ranged'],
        requirements: {
          requiredEquipmentTags: ['two-handed-bow'],
        },
      },
      'stalkers-ring': {
        id: 'stalkers-ring',
        name: "Stalker's ring",
        category: 'jewellery',
        slot: 'ring',
        combatStyleTags: ['ranged'],
        effectRefs: ['critical-strike-chance:+3%:bow-only'],
      },
      'deathspore-arrows': {
        id: 'deathspore-arrows',
        name: 'Deathspore arrows',
        category: 'ammo',
        slot: 'ammo',
        combatStyleTags: ['ranged'],
        effectRefs: ['deathspore-progress'],
      },
    },
    ammo: {},
    abilities: {},
    buffs: {
      'dracolich-infusion': {
        id: 'dracolich-infusion',
        name: 'Dracolich infusion',
        category: 'temporary',
        sourceType: 'item',
        effectRefs: ['ranged-critical-strike-chance:+20%'],
      },
    },
    perks: {},
    relics: {},
    eofSpecs: {},
  };

  return {
    playerStats: {
      rangedLevel: 99,
    },
    gearSetup: {
      equipment: {
        weapon: {
          instanceId: 'weapon-1',
          definitionId: 'bolg',
        },
        ring: {
          instanceId: 'ring-1',
          definitionId: 'stalkers-ring',
        },
        ammo: {
          instanceId: 'ammo-1',
          definitionId: 'deathspore-arrows',
        },
      },
    },
    inventory: {
      items: [],
    },
    persistentBuffConfig: {},
    rotationPlan: {
      startingAdrenaline: 100,
      tickCount: 20,
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

describe('applyExpectedValueCriticalStrike', () => {
  it('applies base critical strike expected value from ranged level', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: 'bolg',
          },
        },
      },
    });

    const result = applyExpectedValueCriticalStrike(
      config,
      createAbility(),
      { min: 100, avg: 100, max: 100 },
      0,
      {},
    );

    expect(result.finalDamage).toEqual({
      min: 100,
      avg: 105,
      max: 150,
    });
  });

  it('applies active crit chance bonuses from gear and generated buffs', () => {
    const config = createConfig();

    const result = applyExpectedValueCriticalStrike(
      config,
      createAbility(),
      { min: 100, avg: 100, max: 100 },
      8,
      {
        8: ['dracolich-infusion'],
      },
    );

    expect(result.finalDamage.avg).toBe(116.5);
  });

  it('does not apply critical strikes to damage-over-time abilities', () => {
    const config = createConfig();

    const result = applyExpectedValueCriticalStrike(
      config,
      createAbility({
        effectRefs: ['damage-over-time'],
      }),
      { min: 100, avg: 100, max: 100 },
      0,
      {},
    );

    expect(result.finalDamage).toEqual({
      min: 100,
      avg: 100,
      max: 100,
    });
  });
});
