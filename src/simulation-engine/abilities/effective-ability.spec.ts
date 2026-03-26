import { describe, expect, it } from 'vitest';

import type { AbilityDefinition, EofSpecDefinition, ItemDefinition } from '../../game-data/types';
import type { LoadedGameDataSnapshot, RotationAction, SimulationConfig } from '../models';
import { resolveEffectiveAbilityDefinition } from './effective-ability';

function createAbility(overrides: Partial<AbilityDefinition> = {}): AbilityDefinition {
  return {
    id: 'essence-of-finality',
    name: 'Essence of Finality',
    style: 'constitution',
    subtype: 'special',
    cooldownTicks: 0,
    hitSchedule: [],
    baseDamage: { min: 0, max: 0 },
    ...overrides,
  };
}

function createItem(overrides: Partial<ItemDefinition> = {}): ItemDefinition {
  return {
    id: 'essence-of-finality',
    name: 'Essence of Finality amulet',
    category: 'jewellery',
    slot: 'amulet',
    combatStyleTags: ['ranged'],
    configOptions: [
      {
        id: 'stored-special',
        label: 'Stored special',
        type: 'select',
        defaultValue: 'dark-bow',
        options: ['dark-bow', 'none'],
      },
    ],
    ...overrides,
  };
}

function createConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  const gameData: LoadedGameDataSnapshot = {
    items: {
      'essence-of-finality': createItem(),
      'ring-of-vigour': createItem({
        id: 'ring-of-vigour',
        name: 'Ring of vigour',
        category: 'jewellery',
        slot: 'ring',
        effectRefs: ['vigour-passive'],
      }),
    },
    ammo: {},
    abilities: {
      'essence-of-finality': createAbility(),
      deadshot: createAbility({
        id: 'deadshot',
        name: 'Deadshot',
        style: 'ranged',
        subtype: 'ultimate',
        cooldownTicks: 50,
        adrenalineCost: 60,
        hitSchedule: [
          { id: 'deadshot-hit-1', tickOffset: 0, damage: { min: 105, max: 125 } },
          { id: 'deadshot-hit-2', tickOffset: 0, damage: { min: 105, max: 125 } },
          { id: 'deadshot-hit-3', tickOffset: 0, damage: { min: 105, max: 125 } },
          { id: 'deadshot-hit-4', tickOffset: 0, damage: { min: 105, max: 125 } },
        ],
        baseDamage: { min: 420, max: 500 },
      }),
    },
    buffs: {},
    perks: {},
    relics: {},
    eofSpecs: {
      'dark-bow-eof': {
        id: 'dark-bow-eof',
        name: 'Dark Bow (EOF)',
        weaponOrigin: 'dark-bow',
        adrenalineCost: 65,
        hitSchedule: [
          {
            id: 'dark-bow-eof-hit-1',
            tickOffset: 0,
            damage: { min: 190, max: 230 },
          },
          {
            id: 'dark-bow-eof-hit-2',
            tickOffset: 0,
            damage: { min: 190, max: 230 },
          },
        ],
        baseDamage: { min: 380, max: 460 },
        effectRefs: ['eof-dark-bow-spec'],
      } satisfies EofSpecDefinition,
    },
  };

  return {
    playerStats: {
      rangedLevel: 99,
    },
    gearSetup: {
      equipment: {
        amulet: {
          instanceId: 'eof-1',
          definitionId: 'essence-of-finality',
        },
      },
    },
    inventory: {
      items: [],
    },
    persistentBuffConfig: {},
    rotationPlan: {
      startingAdrenaline: 100,
      tickCount: 10,
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

describe('resolveEffectiveAbilityDefinition', () => {
  it('maps Essence of Finality to the stored Dark Bow special', () => {
    const config = createConfig();
    const action: RotationAction = {
      id: 'eof-1',
      tick: 0,
      lane: 'ability',
      actionType: 'ability-use',
      payload: {
        abilityId: 'essence-of-finality',
      },
    };

    const result = resolveEffectiveAbilityDefinition(config, action);

    expect(result).toMatchObject({
      id: 'dark-bow-eof',
      name: 'Dark Bow (EOF)',
      style: 'ranged',
      subtype: 'special',
      adrenalineCost: 65,
      baseDamage: { min: 380, max: 460 },
    });
    expect(result?.hitSchedule).toHaveLength(2);
    expect(result?.hitSchedule[0]?.damage).toEqual({ min: 190, max: 230 });
    expect(result?.effectRefs).toContain('eof-dark-bow-spec');
  });

  it('reduces EOF special adrenaline cost with Ring of vigour', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          amulet: {
            instanceId: 'eof-1',
            definitionId: 'essence-of-finality',
          },
          ring: {
            instanceId: 'ring-1',
            definitionId: 'ring-of-vigour',
          },
        },
      },
    });
    const action: RotationAction = {
      id: 'eof-1',
      tick: 0,
      lane: 'ability',
      actionType: 'ability-use',
      payload: {
        abilityId: 'essence-of-finality',
      },
    };

    const result = resolveEffectiveAbilityDefinition(config, action);

    expect(result?.adrenalineCost).toBe(58.5);
  });

  it('upgrades Deadshot when an Igneous cape is equipped', () => {
    const config = createConfig({
      gameData: {
        ...createConfig().gameData,
        items: {
          ...createConfig().gameData.items,
          'igneous-kal-xil': createItem({
            id: 'igneous-kal-xil',
            name: 'Igneous Kal-Xil',
            category: 'armor',
            slot: 'cape',
            effectRefs: ['igneous-kal-xil-passive'],
          }),
        },
      },
      gearSetup: {
        equipment: {
          amulet: {
            instanceId: 'eof-1',
            definitionId: 'essence-of-finality',
          },
          cape: {
            instanceId: 'cape-1',
            definitionId: 'igneous-kal-xil',
          },
        },
      },
    });
    const action: RotationAction = {
      id: 'deadshot-1',
      tick: 0,
      lane: 'ability',
      actionType: 'ability-use',
      payload: {
        abilityId: 'deadshot',
      },
    };

    const result = resolveEffectiveAbilityDefinition(config, action);

    expect(result).toMatchObject({
      id: 'deadshot',
      adrenalineCost: 60,
      baseDamage: { min: 440, max: 600 },
    });
    expect(result?.hitSchedule).toHaveLength(8);
    expect(result?.hitSchedule[0]?.damage).toEqual({ min: 55, max: 75 });
    expect(result?.hitSchedule[7]?.tickOffset).toBe(0);
  });
});
