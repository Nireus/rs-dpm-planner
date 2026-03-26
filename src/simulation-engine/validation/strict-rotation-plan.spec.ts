import { describe, expect, it } from 'vitest';

import type { AbilityDefinition, ItemDefinition } from '../../game-data/types';
import type {
  LoadedGameDataSnapshot,
  SimulationConfig,
} from '../models';
import { validateStrictRotationPlan } from './strict-rotation-plan';

function createAbility(overrides: Partial<AbilityDefinition> = {}): AbilityDefinition {
  return {
    id: 'test-shot',
    name: 'Test Shot',
    style: 'ranged',
    subtype: 'basic',
    cooldownTicks: 10,
    adrenalineGain: 9,
    requires: {
      requiredEquipmentTags: ['ranged-weapon'],
    },
    hitSchedule: [
      {
        id: 'test-shot-hit',
        tickOffset: 0,
        damage: {
          min: 100,
          max: 120,
        },
      },
    ],
    baseDamage: {
      min: 100,
      max: 120,
    },
    ...overrides,
  };
}

function createWeapon(overrides: Partial<ItemDefinition> = {}): ItemDefinition {
  return {
    id: 'test-bow',
    name: 'Test Bow',
    category: 'weapon',
    slot: 'weapon',
    combatStyleTags: ['ranged'],
    equipBehavior: 'two-handed',
    ...overrides,
  };
}

function createArmor(overrides: Partial<ItemDefinition> = {}): ItemDefinition {
  return {
    id: 'test-body',
    name: 'Test Body',
    category: 'armor',
    slot: 'body',
    combatStyleTags: ['ranged'],
    ...overrides,
  };
}

function createConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  const weapon = createWeapon();
  const armor = createArmor();
  const abilities: Record<string, AbilityDefinition> = {
    'test-shot': createAbility(),
    'costly-shot': createAbility({
      id: 'costly-shot',
      name: 'Costly Shot',
      cooldownTicks: 0,
      adrenalineGain: 0,
      adrenalineCost: 60,
    }),
    'channel-shot': createAbility({
      id: 'channel-shot',
      name: 'Channel Shot',
      cooldownTicks: 0,
      isChanneled: true,
      channelDurationTicks: 4,
    }),
    'weapon-special-attack': createAbility({
      id: 'weapon-special-attack',
      name: 'Weapon Special Attack',
      style: 'constitution',
      subtype: 'special',
      cooldownTicks: 0,
      adrenalineGain: 0,
      hitSchedule: [],
      baseDamage: { min: 0, max: 0 },
      requires: {
        requiredEquipmentTags: ['equipped-effect:weapon-special-access'],
      },
    }),
  };

  const gameData: LoadedGameDataSnapshot = {
    items: {
      [weapon.id]: weapon,
      [armor.id]: armor,
    },
    ammo: {},
    abilities,
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
          instanceId: 'weapon-instance',
          definitionId: weapon.id,
        },
      },
    },
    inventory: {
      items: [
        {
          instanceId: 'body-instance',
          definitionId: armor.id,
        },
      ],
    },
    persistentBuffConfig: {},
    rotationPlan: {
      startingAdrenaline: 50,
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

describe('validateStrictRotationPlan', () => {
  it('reports action placement outside timeline bounds', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 50,
        tickCount: 5,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'late-shot',
            tick: 5,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'test-shot' },
          },
        ],
      },
    });

    const issues = validateStrictRotationPlan(config);

    expect(issues.some((issue) => issue.code === 'timeline.out_of_bounds')).toBe(true);
  });

  it('reports ability cooldown conflicts', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 50,
        tickCount: 20,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'shot-1',
            tick: 1,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'test-shot' },
          },
          {
            id: 'shot-2',
            tick: 5,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'test-shot' },
          },
        ],
      },
    });

    const issues = validateStrictRotationPlan(config);

    expect(issues.some((issue) => issue.code === 'ability.cooldown_conflict')).toBe(true);
  });

  it('reports missing required gear for abilities', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {},
      },
      rotationPlan: {
        startingAdrenaline: 50,
        tickCount: 20,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'shot-without-weapon',
            tick: 1,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'test-shot' },
          },
        ],
      },
    });

    const issues = validateStrictRotationPlan(config);

    expect(issues.some((issue) => issue.code === 'ability.unavailable')).toBe(true);
  });

  it('reports invalid ability overlap on the same tick', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 50,
        tickCount: 20,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'shot-a',
            tick: 2,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'test-shot' },
          },
          {
            id: 'shot-b',
            tick: 2,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'costly-shot' },
          },
        ],
      },
    });

    const issues = validateStrictRotationPlan(config);

    expect(issues.some((issue) => issue.code === 'timeline.ability_overlap')).toBe(true);
  });

  it('reports invalid slot or equip state for swap actions', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 50,
        tickCount: 20,
        nonGcdActions: [
          {
            id: 'bad-swap',
            tick: 1,
            lane: 'non-gcd',
            actionType: 'gear-swap',
            payload: {
              definitionId: 'test-body',
              slot: 'weapon',
            },
          },
        ],
        abilityActions: [],
      },
    });

    const issues = validateStrictRotationPlan(config);

    expect(issues.some((issue) => issue.code === 'action.invalid_slot')).toBe(true);
  });

  it('resolves the equipped BoLG special without raising a stale strict-validation adrenaline issue', () => {
    const config = createConfig({
      gameData: {
        items: {
          'test-bow': createWeapon({
            effectRefs: ['weapon-special-access', 'weapon-special:balance-by-force'],
          }),
          'test-body': createArmor(),
        },
        ammo: {},
        abilities: {
          'test-shot': createAbility(),
          'costly-shot': createAbility({
            id: 'costly-shot',
            name: 'Costly Shot',
            cooldownTicks: 0,
            adrenalineGain: 0,
            adrenalineCost: 60,
          }),
          'channel-shot': createAbility({
            id: 'channel-shot',
            name: 'Channel Shot',
            cooldownTicks: 0,
            isChanneled: true,
            channelDurationTicks: 4,
          }),
          'weapon-special-attack': createAbility({
            id: 'weapon-special-attack',
            name: 'Weapon Special Attack',
            style: 'constitution',
            subtype: 'special',
            cooldownTicks: 0,
            adrenalineGain: 0,
            hitSchedule: [],
            baseDamage: { min: 0, max: 0 },
            requires: {
              requiredEquipmentTags: ['equipped-effect:weapon-special-access'],
            },
          }),
        },
        buffs: {},
        perks: {},
        relics: {},
        eofSpecs: {},
      },
      rotationPlan: {
        startingAdrenaline: 20,
        tickCount: 10,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'bolg-special',
            tick: 1,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'weapon-special-attack' },
          },
        ],
      },
    });

    const issues = validateStrictRotationPlan(config);

    expect(issues.some((issue) => issue.code === 'ability.insufficient_adrenaline')).toBe(false);
  });
});
