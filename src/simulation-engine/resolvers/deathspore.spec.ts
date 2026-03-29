import { describe, expect, it } from 'vitest';

import type { AbilityDefinition, ItemDefinition } from '../../game-data/types';
import type { LoadedGameDataSnapshot, SimulationConfig } from '../models';
import { resolveDeathsporeTimeline } from './deathspore';

function createAbility(overrides: Partial<AbilityDefinition> = {}): AbilityDefinition {
  return {
    id: 'stack-builder',
    name: 'Stack Builder',
    style: 'ranged',
    subtype: 'basic',
    cooldownTicks: 3,
    adrenalineGain: 0,
    hitSchedule: Array.from({ length: 12 }, (_, index) => ({
      id: `stack-${index + 1}`,
      tickOffset: index,
      damage: { min: 10, max: 10 },
    })),
    baseDamage: { min: 120, max: 120 },
    ...overrides,
  };
}

function createItem(overrides: Partial<ItemDefinition> = {}): ItemDefinition {
  return {
    id: 'bolg',
    name: 'Bow of the Last Guardian',
    category: 'weapon',
    slot: 'weapon',
    combatStyleTags: ['ranged'],
    effectRefs: ['bolg-passive', 'weapon-special-access', 'weapon-special:balance-by-force'],
    requirements: {
      requiredEquipmentTags: ['two-handed-bow'],
    },
    ...overrides,
  };
}

function createConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  const gameData: LoadedGameDataSnapshot = {
    items: {
      bolg: createItem(),
      'plain-bow': createItem({
        id: 'plain-bow',
        name: 'Plain Bow',
        effectRefs: [],
      }),
      'deathspore-arrows': {
        id: 'deathspore-arrows',
        name: 'Deathspore arrows',
        category: 'ammo',
        slot: 'ammo',
        combatStyleTags: ['ranged'],
        effectRefs: ['deathspore-progress'],
      },
      'ful-arrows': {
        id: 'ful-arrows',
        name: 'Ful arrows',
        category: 'ammo',
        slot: 'ammo',
        combatStyleTags: ['ranged'],
        effectRefs: [],
      },
    },
    ammo: {},
    abilities: {
      'stack-builder': createAbility(),
      'corruption-shot': createAbility({
        id: 'corruption-shot',
        name: 'Corruption Shot',
        subtype: 'basic',
        adrenalineGain: 8,
        cooldownTicks: 25,
        hitSchedule: [
          { id: 'corruption-shot-hit-1', tickOffset: 0, damage: { min: 60, max: 80 } },
          { id: 'corruption-shot-hit-2', tickOffset: 2, damage: { min: 48, max: 64 } },
          { id: 'corruption-shot-hit-3', tickOffset: 4, damage: { min: 36, max: 48 } },
          { id: 'corruption-shot-hit-4', tickOffset: 6, damage: { min: 24, max: 32 } },
          { id: 'corruption-shot-hit-5', tickOffset: 8, damage: { min: 12, max: 16 } },
        ],
        baseDamage: { min: 180, max: 240 },
        effectRefs: ['damage-over-time', 'corruption-shot'],
      }),
      'piercing-shot': createAbility({
        id: 'piercing-shot',
        name: 'Piercing Shot',
        adrenalineGain: 9,
        hitSchedule: [
          { id: 'hit-1', tickOffset: 0, damage: { min: 45, max: 55 } },
          { id: 'hit-2', tickOffset: 1, damage: { min: 45, max: 55 } },
        ],
        baseDamage: { min: 90, max: 110 },
      }),
    },
    buffs: {},
    perks: {},
    relics: {},
    eofSpecs: {},
  };

  return {
    playerStats: {
      rangedLevel: 99,
      prayerLevel: 99,
    },
    gearSetup: {
      equipment: {
        weapon: {
          instanceId: 'weapon-1',
          definitionId: 'bolg',
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
      tickCount: 70,
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

describe('resolveDeathsporeTimeline', () => {
  it('creates Feasting Spores ready and cooldown windows after 12 ranged hits', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: 'plain-bow',
          },
          ammo: {
            instanceId: 'ammo-1',
            definitionId: 'deathspore-arrows',
          },
        },
      },
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 70,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'stack-builder-1',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: {
              abilityId: 'stack-builder',
            },
          },
        ],
      },
    });

    const result = resolveDeathsporeTimeline(config);

    expect(result.buffTimeline[10]).toEqual([]);
    expect(result.buffTimeline[11]).toEqual(['feasting-spores-ready', 'feasting-spores-cooldown']);
    expect(result.stackTimeline[10]).toBe(11);
    expect(result.stackTimeline[11]).toBe(0);
    expect(result.buffTimeline[25]).toEqual(['feasting-spores-ready', 'feasting-spores-cooldown']);
    expect(result.buffTimeline[26]).toEqual(['feasting-spores-cooldown']);
    expect(result.buffTimeline[60]).toEqual(['feasting-spores-cooldown']);
    expect(result.buffTimeline[61]).toEqual([]);
  });

  it('lets Perfect Equilibrium hits contribute to Deathspore stacks', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 40,
        nonGcdActions: [],
        abilityActions: [
          { id: 'piercing-1', tick: 0, lane: 'ability', actionType: 'ability-use', payload: { abilityId: 'piercing-shot' } },
          { id: 'piercing-2', tick: 3, lane: 'ability', actionType: 'ability-use', payload: { abilityId: 'piercing-shot' } },
          { id: 'piercing-3', tick: 6, lane: 'ability', actionType: 'ability-use', payload: { abilityId: 'piercing-shot' } },
          { id: 'piercing-4', tick: 9, lane: 'ability', actionType: 'ability-use', payload: { abilityId: 'piercing-shot' } },
          { id: 'piercing-5', tick: 12, lane: 'ability', actionType: 'ability-use', payload: { abilityId: 'piercing-shot' } },
          { id: 'piercing-6', tick: 15, lane: 'ability', actionType: 'ability-use', payload: { abilityId: 'piercing-shot' } },
        ],
      },
    });

    const result = resolveDeathsporeTimeline(config);

    expect(result.buffTimeline[14]).toEqual([]);
    expect(result.buffTimeline[15]).toEqual(['feasting-spores-ready', 'feasting-spores-cooldown']);
    expect(result.stackTimeline[14]).toBe(11);
    expect(result.stackTimeline[15]).toBe(0);
  });

  it('does not let Corruption Shot build Deathspore stacks', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: 'plain-bow',
          },
          ammo: {
            instanceId: 'ammo-1',
            definitionId: 'deathspore-arrows',
          },
        },
      },
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 20,
        nonGcdActions: [],
        abilityActions: [
          { id: 'corruption-1', tick: 0, lane: 'ability', actionType: 'ability-use', payload: { abilityId: 'corruption-shot' } },
        ],
      },
    });

    const result = resolveDeathsporeTimeline(config);

    expect(result.stackTimeline[0]).toBe(0);
    expect(result.stackTimeline[10]).toBe(0);
    expect(result.buffTimeline[10]).toEqual([]);
  });

  it('starts from configured Deathspore stacks and procs sooner', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: 'plain-bow',
          },
          ammo: {
            instanceId: 'ammo-1',
            definitionId: 'deathspore-arrows',
          },
        },
      },
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 20,
        startingStacks: {
          deathsporeStacks: 10,
        },
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'stack-builder-1',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: {
              abilityId: 'stack-builder',
            },
          },
        ],
      },
    });

    const result = resolveDeathsporeTimeline(config);

    expect(result.stackTimeline[0]).toBe(11);
    expect(result.buffTimeline[1]).toEqual(['feasting-spores-ready', 'feasting-spores-cooldown']);
    expect(result.stackTimeline[1]).toBe(0);
  });

  it('stops building Deathspore progress after arrows are swapped away', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: 'plain-bow',
          },
          ammo: {
            instanceId: 'ammo-1',
            definitionId: 'deathspore-arrows',
          },
        },
      },
      inventory: {
        items: [
          {
            instanceId: 'ammo-2',
            definitionId: 'ful-arrows',
          },
        ],
      },
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 30,
        nonGcdActions: [
          {
            id: 'swap-ammo',
            tick: 5,
            lane: 'non-gcd',
            actionType: 'gear-swap',
            payload: {
              instanceId: 'ammo-2',
              definitionId: 'ful-arrows',
              slot: 'ammo',
              label: 'Swap: Ful arrows',
            },
          },
        ],
        abilityActions: [
          {
            id: 'stack-builder-1',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: {
              abilityId: 'stack-builder',
            },
          },
        ],
      },
    });

    const result = resolveDeathsporeTimeline(config);

    expect(result.stackTimeline[4]).toBe(5);
    expect(result.stackTimeline[5]).toBe(6);
    expect(result.stackTimeline[6]).toBe(6);
    expect(result.stackTimeline[11]).toBe(6);
    expect(result.buffTimeline[11]).toEqual([]);
  });
});
