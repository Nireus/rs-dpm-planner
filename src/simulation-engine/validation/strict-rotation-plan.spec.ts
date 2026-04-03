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

function createOffHand(overrides: Partial<ItemDefinition> = {}): ItemDefinition {
  return {
    id: 'test-off-hand',
    name: 'Test Off-hand',
    category: 'weapon',
    slot: 'offHand',
    combatStyleTags: ['melee'],
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
    fury: createAbility({
      id: 'fury',
      name: 'Fury',
      style: 'melee',
      subtype: 'basic',
      cooldownTicks: 6,
      requires: {
        requiredEquipmentTags: ['melee-dual-wield'],
      },
    }),
  };

  const gameData: LoadedGameDataSnapshot = {
    items: {
      [weapon.id]: weapon,
      [armor.id]: armor,
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
      'water-surge': {
        id: 'water-surge',
        name: 'Water Surge',
        spellbookId: 'standard',
        role: 'combat',
        levelRequirement: 85,
        tier: 85,
      },
      'incite-fear': {
        id: 'incite-fear',
        name: 'Incite Fear',
        spellbookId: 'ancient',
        role: 'combat',
        levelRequirement: 98,
        tier: 98,
      },
      'vulnerability-spell': {
        id: 'vulnerability-spell',
        name: 'Vulnerability',
        spellbookId: 'standard',
        role: 'utility',
        levelRequirement: 66,
        tier: 0,
      },
    },
    abilities,
    buffs: {},
    perks: {},
    relics: {},
    eofSpecs: {},
  };

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

  it('allows off-hand gear swaps while a two-handed weapon is equipped', () => {
    const offHand = createOffHand();
    const config = createConfig({
      gameData: {
        ...createConfig().gameData,
        items: {
          ...createConfig().gameData.items,
          [offHand.id]: offHand,
        },
      },
      inventory: {
        items: [
          {
            instanceId: 'off-hand-instance',
            definitionId: offHand.id,
          },
        ],
      },
      rotationPlan: {
        startingAdrenaline: 50,
        tickCount: 20,
        nonGcdActions: [
          {
            id: 'bad-off-hand-swap',
            tick: 1,
            lane: 'non-gcd',
            actionType: 'gear-swap',
            payload: {
              instanceId: 'off-hand-instance',
              definitionId: offHand.id,
              slot: 'offHand',
            },
          },
        ],
        abilityActions: [],
      },
    });

    const issues = validateStrictRotationPlan(config);

    expect(
      issues.some(
        (issue) =>
          issue.relatedActionId === 'bad-off-hand-swap' &&
          issue.code === 'action.invalid_slot',
      ),
    ).toBe(false);
  });

  it('uses projected melee weapon topology when validating later ability availability', () => {
    const meleeMainHand = createWeapon({
      id: 'abyssal-scourge',
      name: 'Abyssal scourge',
      combatStyleTags: ['melee'],
      equipBehavior: undefined,
    });
    const meleeOffHand = createOffHand({
      id: 'dark-sliver-of-leng',
      name: 'Dark Sliver of Leng',
      combatStyleTags: ['melee'],
    });
    const config = createConfig({
      gameData: {
        ...createConfig().gameData,
        items: {
          'abyssal-scourge': meleeMainHand,
          'test-body': createArmor(),
          'dark-sliver-of-leng': meleeOffHand,
        },
        ammo: {},
        abilities: {
          ...createConfig().gameData.abilities,
          'test-shot': createAbility({
            id: 'test-shot',
            name: 'Test Shot',
            style: 'melee',
            requires: {
              requiredEquipmentTags: ['melee-dual-wield'],
            },
          }),
        },
        buffs: {},
        perks: {},
        relics: {},
        eofSpecs: {},
      },
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'main-hand-instance',
            definitionId: 'abyssal-scourge',
          },
        },
      },
      inventory: {
        items: [
          {
            instanceId: 'off-hand-instance',
            definitionId: 'dark-sliver-of-leng',
          },
        ],
      },
      rotationPlan: {
        startingAdrenaline: 50,
        tickCount: 20,
        nonGcdActions: [
          {
            id: 'equip-off-hand',
            tick: 1,
            lane: 'non-gcd',
            actionType: 'gear-swap',
            payload: {
              instanceId: 'off-hand-instance',
              definitionId: 'dark-sliver-of-leng',
              slot: 'offHand',
            },
          },
        ],
        abilityActions: [
          {
            id: 'use-fury',
            tick: 2,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'test-shot' },
          },
        ],
      },
    });

    const issues = validateStrictRotationPlan(config);

    expect(
      issues.some(
        (issue) => issue.relatedActionId === 'use-fury' && issue.code === 'ability.unavailable',
      ),
    ).toBe(false);
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

  it('allows an ability immediately after assault finishes on its live hit-timing window', () => {
    const config = createConfig({
      gameData: {
        ...createConfig().gameData,
        items: {
          'test-bow': createWeapon({
            id: 'test-melee-weapon',
            name: 'Test Melee Weapon',
            combatStyleTags: ['melee'],
            equipBehavior: undefined,
          }),
          'test-body': createArmor(),
        },
        abilities: {
          ...createConfig().gameData.abilities,
          assault: createAbility({
            id: 'assault',
            name: 'Assault',
            style: 'melee',
            subtype: 'enhanced',
            adrenalineCost: 25,
            cooldownTicks: 10,
            isChanneled: true,
            channelDurationTicks: 8,
            requires: {
              requiredEquipmentTags: ['melee-weapon'],
            },
            hitSchedule: [
              { id: 'assault-hit-1', tickOffset: 1, damage: { min: 130, max: 150 } },
              { id: 'assault-hit-2', tickOffset: 3, damage: { min: 130, max: 150 } },
              { id: 'assault-hit-3', tickOffset: 5, damage: { min: 130, max: 150 } },
              { id: 'assault-hit-4', tickOffset: 7, damage: { min: 130, max: 150 } },
            ],
            baseDamage: { min: 520, max: 600 },
          }),
          followup: createAbility({
            id: 'followup',
            name: 'Followup',
            style: 'melee',
            subtype: 'basic',
            cooldownTicks: 3,
            adrenalineGain: 9,
            requires: {
              requiredEquipmentTags: ['melee-weapon'],
            },
          }),
        },
      },
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'weapon-instance',
            definitionId: 'test-melee-weapon',
          },
        },
      },
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 30,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'assault-1',
            tick: 9,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'assault' },
          },
          {
            id: 'followup-1',
            tick: 16,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'followup' },
          },
        ],
      },
    });

    const issues = validateStrictRotationPlan(config);

    expect(
      issues.some(
        (issue) => issue.relatedActionId === 'followup-1' && issue.code === 'ability.channel_conflict',
      ),
    ).toBe(false);
  });

  it('reports spell swaps during an active channel with the shared swap warning', () => {
    const config = createConfig({
      gameData: {
        ...createConfig().gameData,
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
      },
      rotationPlan: {
        startingAdrenaline: 50,
        tickCount: 20,
        nonGcdActions: [
          {
            id: 'swap-spell',
            tick: 2,
            lane: 'non-gcd',
            actionType: 'spell-swap',
            payload: {
              spellId: 'fire-surge',
            },
          },
        ],
        abilityActions: [
          {
            id: 'channel-1',
            tick: 1,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'channel-shot' },
          },
        ],
      },
    });

    const issues = validateStrictRotationPlan(config);

    expect(
      issues.find((issue) => issue.relatedActionId === 'swap-spell' && issue.code === 'action.channel_conflict')
        ?.message,
    ).toBe('Gear, ammo, and spell swaps during an active channel are not supported in strict mode.');
  });

  it('rejects spell swaps that try to use a spell from a different spellbook', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 50,
        tickCount: 20,
        nonGcdActions: [
          {
            id: 'bad-spell-swap',
            tick: 2,
            lane: 'non-gcd',
            actionType: 'spell-swap',
            payload: {
              spellId: 'incite-fear',
            },
          },
        ],
        abilityActions: [],
      },
    });

    const issues = validateStrictRotationPlan(config);

    expect(
      issues.find((issue) => issue.relatedActionId === 'bad-spell-swap' && issue.code === 'action.invalid_payload')
        ?.message,
    ).toBe('Spell "Incite Fear" does not belong to the selected standard spellbook.');
  });

  it('rejects spell swaps that try to use a utility spell', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 50,
        tickCount: 20,
        nonGcdActions: [
          {
            id: 'utility-spell-swap',
            tick: 2,
            lane: 'non-gcd',
            actionType: 'spell-swap',
            payload: {
              spellId: 'vulnerability-spell',
            },
          },
        ],
        abilityActions: [],
      },
    });

    const issues = validateStrictRotationPlan(config);

    expect(
      issues.find((issue) => issue.relatedActionId === 'utility-spell-swap' && issue.code === 'action.invalid_payload')
        ?.message,
    ).toBe('Spell swap only supports combat spells. "Vulnerability" is a utility spell.');
  });
});
