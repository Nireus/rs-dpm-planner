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
        options: ['dark-bow', 'gloomfire-bow', 'eldritch-crossbow', 'none'],
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
      'perk-host-armor': createItem({
        id: 'perk-host-armor',
        name: 'Perk Host Armor',
        category: 'armor',
        slot: 'body',
      }),
      'gloomfire-bow': createItem({
        id: 'gloomfire-bow',
        name: 'Gloomfire bow',
        category: 'weapon',
        slot: 'weapon',
        specialAbilityId: 'shadowfall',
        effectRefs: ['gloomfire-darkfang', 'weapon-special-access', 'weapon-special:shadowfall'],
      }),
      'eldritch-crossbow': createItem({
        id: 'eldritch-crossbow',
        name: 'Eldritch crossbow',
        category: 'weapon',
        slot: 'weapon',
        specialAbilityId: 'split-soul',
        effectRefs: ['weapon-special-access', 'weapon-special:split-soul'],
      }),
      'masterwork-spear-of-annihilation': createItem({
        id: 'masterwork-spear-of-annihilation',
        name: 'Masterwork Spear of Annihilation',
        category: 'weapon',
        slot: 'weapon',
        combatStyleTags: ['melee'],
        effectRefs: ['masterwork-spear-of-annihilation-passive'],
      }),
      'melee-main-hand': createItem({
        id: 'melee-main-hand',
        name: 'Melee Main-hand',
        category: 'weapon',
        slot: 'weapon',
        combatStyleTags: ['melee'],
      }),
      'melee-off-hand': createItem({
        id: 'melee-off-hand',
        name: 'Melee Off-hand',
        category: 'weapon',
        slot: 'offHand',
        combatStyleTags: ['melee'],
      }),
      'melee-two-handed': createItem({
        id: 'melee-two-handed',
        name: 'Melee Two-handed',
        category: 'weapon',
        slot: 'weapon',
        combatStyleTags: ['melee'],
        equipBehavior: 'two-handed',
      }),
    },
    ammo: {},
    abilities: {
      'essence-of-finality': createAbility({
        specialDispatch: {
          source: 'equipped-eof',
        },
      }),
      'weapon-special-attack': createAbility({
        id: 'weapon-special-attack',
        name: 'Special Attack',
        style: 'constitution',
        subtype: 'special',
        cooldownTicks: 0,
        hitSchedule: [],
        baseDamage: { min: 0, max: 0 },
        specialDispatch: {
          source: 'equipped-weapon',
        },
      }),
      'dark-bow-eof': createAbility({
        id: 'dark-bow-eof',
        name: 'Dark Bow (EOF)',
        style: 'ranged',
        subtype: 'special',
        cooldownTicks: 0,
        adrenalineCost: 65,
        adrenalineGain: 0,
        hitSchedule: [
          { id: 'dark-bow-eof-hit-1', tickOffset: 0, damage: { min: 190, max: 230 } },
          { id: 'dark-bow-eof-hit-2', tickOffset: 0, damage: { min: 190, max: 230 } },
        ],
        baseDamage: { min: 380, max: 460 },
        effectRefs: ['eof-dark-bow-spec'],
      }),
      'gloomfire-bow-eof': createAbility({
        id: 'gloomfire-bow-eof',
        name: 'Gloomfire Bow (EOF)',
        style: 'ranged',
        subtype: 'special',
        cooldownTicks: 0,
        adrenalineCost: 65,
        adrenalineGain: 0,
        hitSchedule: [
          { id: 'gloomfire-bow-eof-hit-1', tickOffset: 0, damage: { min: 85, max: 105 } },
          { id: 'gloomfire-bow-eof-hit-2', tickOffset: 0, damage: { min: 85, max: 105 } },
          { id: 'gloomfire-bow-eof-hit-3', tickOffset: 0, damage: { min: 255, max: 295 } },
        ],
        baseDamage: { min: 425, max: 505 },
        effectRefs: ['eof-gloomfire-bow-spec'],
      }),
      'eldritch-crossbow-eof': createAbility({
        id: 'eldritch-crossbow-eof',
        name: 'Eldritch Crossbow (EOF)',
        style: 'ranged',
        subtype: 'special',
        cooldownTicks: 0,
        adrenalineCost: 25,
        adrenalineGain: 0,
        hitSchedule: [],
        baseDamage: { min: 0, max: 0 },
        effectRefs: ['eof-eldritch-crossbow-spec', 'weapon-special:split-soul'],
      }),
      shadowfall: createAbility({
        id: 'shadowfall',
        name: 'Shadowfall',
        style: 'ranged',
        subtype: 'special',
        cooldownTicks: 0,
        adrenalineCost: 65,
        adrenalineGain: 0,
        hitSchedule: [
          { id: 'shadowfall-hit-1', tickOffset: 0, damage: { min: 85, max: 105 } },
          { id: 'shadowfall-hit-2', tickOffset: 0, damage: { min: 85, max: 105 } },
          { id: 'shadowfall-hit-3', tickOffset: 0, damage: { min: 255, max: 295 } },
        ],
        baseDamage: { min: 425, max: 505 },
        effectRefs: ['weapon-special:shadowfall'],
      }),
      'split-soul': createAbility({
        id: 'split-soul',
        name: 'Split Soul',
        style: 'ranged',
        subtype: 'special',
        cooldownTicks: 0,
        adrenalineCost: 25,
        adrenalineGain: 0,
        hitSchedule: [],
        baseDamage: { min: 0, max: 0 },
        effectRefs: ['weapon-special:split-soul'],
      }),
      ranged: createAbility({
        id: 'ranged',
        name: 'Ranged',
        style: 'ranged',
        subtype: 'basic',
        cooldownTicks: 3,
        adrenalineGain: 9,
        hitSchedule: [{ id: 'ranged-hit', tickOffset: 0, damage: { min: 90, max: 110 } }],
        baseDamage: { min: 90, max: 110 },
        variants: [
          {
            id: 'ranged',
            when: {
              requiredEquipmentTags: ['equipped-effect:gloomfire-darkfang'],
            },
            hitSchedule: [
              { id: 'ranged-darkfang-hit-1', tickOffset: 0, damage: { min: 45, max: 55 } },
              { id: 'ranged-darkfang-hit-2', tickOffset: 0, damage: { min: 45, max: 55 } },
            ],
            baseDamage: { min: 90, max: 110 },
            effectRefs: ['gloomfire-darkfang'],
          },
        ],
      }),
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
        variants: [
          {
            id: 'deadshot',
            when: {
              requiredEquipmentTags: ['equipped-effect:igneous-kal-xil-passive'],
            },
            hitSchedule: Array.from({ length: 8 }, (_, index) => ({
              id: `deadshot-igneous-hit-${index + 1}`,
              tickOffset: 0,
              damage: { min: 55, max: 75 },
            })),
            baseDamage: { min: 440, max: 600 },
          },
        ],
      }),
      dismember: createAbility({
        id: 'dismember',
        name: 'Dismember',
        style: 'melee',
        subtype: 'enhanced',
        cooldownTicks: 40,
        hitSchedule: Array.from({ length: 8 }, (_, index) => ({
          id: `dismember-hit-${index + 1}`,
          tickOffset: index * 2,
          damage: { min: 25, max: 31 },
        })),
        baseDamage: { min: 200, max: 248 },
        effectRefs: ['damage-over-time'],
        variants: [
          {
            id: 'dismember',
            when: {
              requiredEquipmentTags: ['equipped-effect:masterwork-spear-of-annihilation-passive'],
            },
            hitSchedule: [
              ...Array.from({ length: 8 }, (_, index) => ({
                id: `dismember-hit-${index + 1}`,
                tickOffset: index * 2,
                damage: { min: 25, max: 31 },
              })),
              ...Array.from({ length: 4 }, (_, index) => ({
                id: `dismember-extended-hit-${index + 1}`,
                tickOffset: 16 + index * 2,
                damage: { min: 25, max: 31 },
              })),
            ],
            baseDamage: { min: 300, max: 372 },
          },
        ],
      }),
      'adaptive-strike': createAbility({
        id: 'adaptive-strike',
        name: 'Adaptive Strike',
        style: 'melee',
        subtype: 'basic',
        cooldownTicks: 9,
        adrenalineGain: 12,
        hitSchedule: [{ id: 'adaptive-strike-hit-1', tickOffset: 0, damage: { min: 120, max: 140 } }],
        baseDamage: { min: 120, max: 140 },
        variants: [
          {
            id: 'adaptive-strike',
            when: {
              requiredEquipmentTags: ['melee-dual-wield'],
            },
            hitSchedule: [
              { id: 'adaptive-strike-dual-wield-hit-1', tickOffset: 0, damage: { min: 60, max: 75 } },
              { id: 'adaptive-strike-dual-wield-hit-2', tickOffset: 0, damage: { min: 60, max: 75 } },
            ],
            baseDamage: { min: 120, max: 150 },
          },
        ],
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
        abilityId: 'dark-bow-eof',
        effectRefs: ['eof-dark-bow-spec'],
      } satisfies EofSpecDefinition,
      'gloomfire-bow-eof': {
        id: 'gloomfire-bow-eof',
        name: 'Gloomfire Bow (EOF)',
        weaponOrigin: 'gloomfire-bow',
        abilityId: 'gloomfire-bow-eof',
        effectRefs: ['eof-gloomfire-bow-spec'],
      } satisfies EofSpecDefinition,
      'eldritch-crossbow-eof': {
        id: 'eldritch-crossbow-eof',
        name: 'Eldritch Crossbow (EOF)',
        weaponOrigin: 'eldritch-crossbow',
        abilityId: 'eldritch-crossbow-eof',
        effectRefs: ['eof-eldritch-crossbow-spec'],
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

  it('maps Gloomfire Bow EOF special when stored in Essence of Finality', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          amulet: {
            instanceId: 'eof-1',
            definitionId: 'essence-of-finality',
            configValues: {
              'stored-special': 'gloomfire-bow',
            },
          },
        },
      },
    });
    const action: RotationAction = {
      id: 'eof-gloomfire-1',
      tick: 0,
      lane: 'ability',
      actionType: 'ability-use',
      payload: {
        abilityId: 'essence-of-finality',
      },
    };

    const result = resolveEffectiveAbilityDefinition(config, action);

    expect(result).toMatchObject({
      id: 'gloomfire-bow-eof',
      name: 'Gloomfire Bow (EOF)',
      adrenalineCost: 65,
      baseDamage: { min: 425, max: 505 },
    });
    expect(result?.hitSchedule).toHaveLength(3);
    expect(result?.effectRefs).toContain('eof-gloomfire-bow-spec');
  });

  it('uses the swapped Essence of Finality stored special for later timeline casts', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          amulet: {
            instanceId: 'eof-dark-bow-equipped',
            definitionId: 'essence-of-finality',
            configValues: {
              'stored-special': 'dark-bow',
            },
          },
        },
      },
      inventory: {
        items: [
          {
            instanceId: 'eof-gloomfire-backpack',
            definitionId: 'essence-of-finality',
            configValues: {
              'stored-special': 'gloomfire-bow',
            },
          },
        ],
      },
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 12,
        nonGcdActions: [
          {
            id: 'swap-eof',
            tick: 2,
            lane: 'non-gcd',
            actionType: 'gear-swap',
            payload: {
              instanceId: 'eof-gloomfire-backpack',
              slot: 'amulet',
            },
          },
        ],
        abilityActions: [],
      },
    });
    const action: RotationAction = {
      id: 'eof-after-swap',
      tick: 3,
      lane: 'ability',
      actionType: 'ability-use',
      payload: {
        abilityId: 'essence-of-finality',
      },
    };

    const result = resolveEffectiveAbilityDefinition(config, action);

    expect(result?.id).toBe('gloomfire-bow-eof');
    expect(result?.effectRefs).toContain('eof-gloomfire-bow-spec');
  });

  it('turns the base ranged ability into Darkfang hits with Gloomfire Bow equipped', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'gloomfire-1',
            definitionId: 'gloomfire-bow',
          },
        },
      } as SimulationConfig['gearSetup'],
    });
    const action: RotationAction = {
      id: 'ranged-1',
      tick: 0,
      lane: 'ability',
      actionType: 'ability-use',
      payload: {
        abilityId: 'ranged',
      },
    };

    const result = resolveEffectiveAbilityDefinition(config, action);

    expect(result?.hitSchedule).toEqual([
      { id: 'ranged-darkfang-hit-1', tickOffset: 0, damage: { min: 45, max: 55 } },
      { id: 'ranged-darkfang-hit-2', tickOffset: 0, damage: { min: 45, max: 55 } },
    ]);
  });

  it('maps wielded Gloomfire Bow special attack to Shadowfall', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'gloomfire-1',
            definitionId: 'gloomfire-bow',
          },
        },
      } as SimulationConfig['gearSetup'],
    });
    const action: RotationAction = {
      id: 'spec-1',
      tick: 0,
      lane: 'ability',
      actionType: 'ability-use',
      payload: {
        abilityId: 'weapon-special-attack',
      },
    };

    const result = resolveEffectiveAbilityDefinition(config, action);

    expect(result).toMatchObject({
      id: 'shadowfall',
      name: 'Shadowfall',
      adrenalineCost: 65,
      baseDamage: { min: 425, max: 505 },
    });
    expect(result?.hitSchedule).toHaveLength(3);
  });

  it('maps wielded Eldritch crossbow special attack to Split Soul', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'ecb-1',
            definitionId: 'eldritch-crossbow',
          },
        },
      } as SimulationConfig['gearSetup'],
    });
    const action: RotationAction = {
      id: 'spec-ecb-1',
      tick: 0,
      lane: 'ability',
      actionType: 'ability-use',
      payload: {
        abilityId: 'weapon-special-attack',
      },
    };

    const result = resolveEffectiveAbilityDefinition(config, action);

    expect(result).toMatchObject({
      id: 'split-soul',
      name: 'Split Soul',
      adrenalineCost: 25,
      baseDamage: { min: 0, max: 0 },
    });
    expect(result?.hitSchedule).toEqual([]);
  });

  it('maps Eldritch crossbow EOF special when stored in Essence of Finality', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          amulet: {
            instanceId: 'eof-ecb-1',
            definitionId: 'essence-of-finality',
            configValues: {
              'stored-special': 'eldritch-crossbow',
            },
          },
        },
      },
    });
    const action: RotationAction = {
      id: 'eof-ecb-cast',
      tick: 0,
      lane: 'ability',
      actionType: 'ability-use',
      payload: {
        abilityId: 'essence-of-finality',
      },
    };

    const result = resolveEffectiveAbilityDefinition(config, action);

    expect(result).toMatchObject({
      id: 'eldritch-crossbow-eof',
      name: 'Eldritch Crossbow (EOF)',
      adrenalineCost: 25,
      baseDamage: { min: 0, max: 0 },
    });
    expect(result?.hitSchedule).toEqual([]);
    expect(result?.effectRefs).toContain('weapon-special:split-soul');
  });

  it('extends melee bleed hit counts with Masterwork Spear of Annihilation equipped', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'msoa-1',
            definitionId: 'masterwork-spear-of-annihilation',
          },
        },
      } as SimulationConfig['gearSetup'],
    });
    const action: RotationAction = {
      id: 'dismember-1',
      tick: 0,
      lane: 'ability',
      actionType: 'ability-use',
      payload: {
        abilityId: 'dismember',
      },
    };

    const result = resolveEffectiveAbilityDefinition(config, action);

    expect(result?.hitSchedule).toHaveLength(12);
    expect(result?.hitSchedule[11]?.tickOffset).toBe(22);
    expect(result?.baseDamage).toEqual({ min: 300, max: 372 });
  });

  it('turns Adaptive Strike into a two-hit ability while dual-wielding melee weapons', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'melee-main-1',
            definitionId: 'melee-main-hand',
          },
          offHand: {
            instanceId: 'melee-off-1',
            definitionId: 'melee-off-hand',
          },
        },
      } as SimulationConfig['gearSetup'],
    });
    const action: RotationAction = {
      id: 'adaptive-strike-1',
      tick: 0,
      lane: 'ability',
      actionType: 'ability-use',
      payload: {
        abilityId: 'adaptive-strike',
      },
    };

    const result = resolveEffectiveAbilityDefinition(config, action);

    expect(result?.hitSchedule).toEqual([
      { id: 'adaptive-strike-dual-wield-hit-1', tickOffset: 0, damage: { min: 60, max: 75 } },
      { id: 'adaptive-strike-dual-wield-hit-2', tickOffset: 0, damage: { min: 60, max: 75 } },
    ]);
    expect(result?.baseDamage).toEqual({ min: 120, max: 150 });
  });

  it('keeps Adaptive Strike as a single hit when using a two-handed melee weapon', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'melee-2h-1',
            definitionId: 'melee-two-handed',
          },
        },
      } as SimulationConfig['gearSetup'],
    });
    const action: RotationAction = {
      id: 'adaptive-strike-2h',
      tick: 0,
      lane: 'ability',
      actionType: 'ability-use',
      payload: {
        abilityId: 'adaptive-strike',
      },
    };

    const result = resolveEffectiveAbilityDefinition(config, action);

    expect(result?.hitSchedule).toEqual([
      { id: 'adaptive-strike-hit-1', tickOffset: 0, damage: { min: 120, max: 140 } },
    ]);
    expect(result?.baseDamage).toEqual({ min: 120, max: 140 });
  });
});
