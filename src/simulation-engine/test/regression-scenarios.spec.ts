import { describe, expect, it } from 'vitest';
import { EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type { ItemDefinition } from '../../game-data/types';
import { simulateBaseDamage } from '../calculators';
import {
  createAbilityAction,
  createAbilityDefinition,
  createFulArrowsItem,
  createGearSwapAction,
  createScenarioConfig,
} from './scenario-test-helpers';

describe('simulation regression scenarios', () => {
  it('simulates a simple bow rotation end to end', () => {
    const result = simulateBaseDamage(
      createScenarioConfig({
        abilities: {
          ranged: createAbilityDefinition({
            id: 'ranged',
            name: 'Ranged',
            cooldownTicks: 3,
            adrenalineGain: 9,
            hitSchedule: [{ id: 'ranged-hit', tickOffset: 0, damage: { min: 90, max: 110 } }],
            baseDamage: { min: 90, max: 110 },
          }),
          'piercing-shot': createAbilityDefinition({
            id: 'piercing-shot',
            name: 'Piercing Shot',
            cooldownTicks: 5,
            adrenalineGain: 9,
            hitSchedule: [{ id: 'piercing-hit', tickOffset: 0, damage: { min: 90, max: 110 } }],
            baseDamage: { min: 90, max: 110 },
          }),
        },
        abilityActions: [
          createAbilityAction('action-ranged', 0, 'ranged'),
          createAbilityAction('action-piercing', 3, 'piercing-shot'),
        ],
        startingAdrenaline: 100,
        tickCount: 10,
      }),
    );

    expect(result.isValid).toBe(true);
    expect(result.totalDamage.avg).toBeGreaterThan(0);
    expect(result.damageByAbility.map((entry) => entry.abilityId)).toEqual(['ranged', 'piercing-shot']);
  });

  it('keeps an ammo swap flow alive in the actual damage math', () => {
    const result = simulateBaseDamage(
      createScenarioConfig({
        abilities: {
          'piercing-shot': createAbilityDefinition({
            id: 'piercing-shot',
            name: 'Piercing Shot',
            cooldownTicks: 5,
            adrenalineGain: 9,
            hitSchedule: [{ id: 'piercing-hit', tickOffset: 0, damage: { min: 90, max: 110 } }],
            baseDamage: { min: 90, max: 110 },
          }),
        },
        items: {
          'ful-arrows': createFulArrowsItem(),
        },
        inventoryItems: [
          {
            instanceId: 'ammo-ful',
            definitionId: 'ful-arrows',
          },
        ],
        nonGcdActions: [createGearSwapAction('swap-ful', 0, 'ammo-ful', 'ful-arrows', 'ammo')],
        abilityActions: [createAbilityAction('action-piercing', 3, 'piercing-shot')],
        startingAdrenaline: 100,
        tickCount: 8,
      }),
    );

    expect(result.isValid).toBe(true);
    expect(result.explainability.damageBreakdowns[0]?.multiplicativeModifiers.map((entry) => entry.sourceId)).toContain(
      EFFECT_REF_IDS.fulArrowsHeat,
    );
  });

  it('keeps channel ability hit flow spread across the real channel window', () => {
    const result = simulateBaseDamage(
      createScenarioConfig({
        abilities: {
          'rapid-fire': createAbilityDefinition({
            id: 'rapid-fire',
            name: 'Rapid Fire',
            subtype: 'other',
            cooldownTicks: 34,
            adrenalineCost: 25,
            isChanneled: true,
            channelDurationTicks: 9,
            hitSchedule: Array.from({ length: 8 }, (_, index) => ({
              id: `rapid-hit-${index + 1}`,
              tickOffset: index + 1,
              damage: { min: 75, max: 85 },
            })),
            baseDamage: { min: 600, max: 680 },
          }),
        },
        abilityActions: [createAbilityAction('action-rapid', 0, 'rapid-fire')],
        startingAdrenaline: 100,
        tickCount: 12,
      }),
    );

    expect(result.isValid).toBe(true);
    expect(result.explainability.damageBreakdowns).toHaveLength(8);
    expect([...new Set(result.explainability.damageBreakdowns.map((entry) => entry.tick))]).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
  });

  it('catches an adrenaline edge case and surfaces the invalid cast clearly', () => {
    const result = simulateBaseDamage(
      createScenarioConfig({
        abilities: {
          deadshot: createAbilityDefinition({
            id: 'deadshot',
            name: 'Deadshot',
            subtype: 'ultimate',
            cooldownTicks: 50,
            adrenalineCost: 60,
            hitSchedule: [{ id: 'deadshot-hit', tickOffset: 0, damage: { min: 105, max: 125 } }],
            baseDamage: { min: 105, max: 125 },
          }),
        },
        abilityActions: [createAbilityAction('action-deadshot', 0, 'deadshot')],
        startingAdrenaline: 0,
        tickCount: 6,
      }),
    );

    expect(result.isValid).toBe(false);
    expect(result.validationIssues.some((issue) => issue.code === 'ability.insufficient_adrenaline')).toBe(true);
    expect(result.validationIssues.some((issue) => issue.relatedActionId === 'action-deadshot')).toBe(true);
    expect(result.explainability.damageBreakdowns.some((entry) => entry.abilityId === 'deadshot')).toBe(true);
  });

  it('catches a cooldown violation and only resolves the first legal cast', () => {
    const result = simulateBaseDamage(
      createScenarioConfig({
        abilities: {
          'piercing-shot': createAbilityDefinition({
            id: 'piercing-shot',
            name: 'Piercing Shot',
            cooldownTicks: 5,
            adrenalineGain: 9,
            hitSchedule: [{ id: 'piercing-hit', tickOffset: 0, damage: { min: 90, max: 110 } }],
            baseDamage: { min: 90, max: 110 },
          }),
        },
        abilityActions: [
          createAbilityAction('action-piercing-1', 0, 'piercing-shot'),
          createAbilityAction('action-piercing-2', 3, 'piercing-shot'),
        ],
        startingAdrenaline: 100,
        tickCount: 10,
      }),
    );

    expect(result.isValid).toBe(false);
    expect(result.validationIssues.some((issue) => issue.code === 'ability.cooldown_conflict')).toBe(true);
    expect(result.explainability.damageBreakdowns).toHaveLength(1);
  });

  it('keeps a deterministic BoLG special interaction stable', () => {
    const bolg: ItemDefinition = {
      id: 'bolg',
      name: 'Bow of the Last Guardian',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['ranged'],
      specialAbilityId: 'balance-by-force',
      effectRefs: [
        EFFECT_REF_IDS.bolgPassive,
        EFFECT_REF_IDS.weaponSpecialAccess,
        EFFECT_REF_IDS.weaponSpecialBalanceByForce,
      ],
    };

    const result = simulateBaseDamage(
      createScenarioConfig({
        abilities: {
          'setup-shot': createAbilityDefinition({
            id: 'setup-shot',
            name: 'Setup Shot',
            cooldownTicks: 3,
            adrenalineGain: 9,
            hitSchedule: [
              { id: 'setup-1', tickOffset: 0, damage: { min: 10, max: 10 } },
              { id: 'setup-2', tickOffset: 1, damage: { min: 10, max: 10 } },
              { id: 'setup-3', tickOffset: 2, damage: { min: 10, max: 10 } },
            ],
            baseDamage: { min: 30, max: 30 },
          }),
          'weapon-special-attack': createAbilityDefinition({
            id: 'weapon-special-attack',
            name: 'Special Attack',
            style: 'constitution',
            subtype: 'special',
            cooldownTicks: 0,
            adrenalineCost: 0,
            adrenalineGain: 0,
            hitSchedule: [],
            baseDamage: { min: 0, max: 0 },
            specialDispatch: {
              source: 'equipped-weapon',
            },
          }),
          'balance-by-force': createAbilityDefinition({
            id: 'balance-by-force',
            name: 'Balance by Force',
            subtype: 'special',
            cooldownTicks: 0,
            adrenalineCost: 30,
            adrenalineGain: 0,
            hitSchedule: [{ id: 'balance-by-force-hit', tickOffset: 0, damage: { min: 235, max: 255 } }],
            baseDamage: { min: 235, max: 255 },
            timelineEffects: [
              {
                kind: 'apply-buff',
                buffId: 'balance-by-force-buff',
              },
            ],
            displayHints: {
              hiddenFromUi: true,
            },
          }),
        },
        buffs: {
          'balance-by-force-buff': {
            id: 'balance-by-force-buff',
            name: 'Balance by Force',
            category: 'temporary',
            sourceType: 'ability',
            durationTicks: 50,
            effectRefs: ['perfect-equilibrium-threshold:4'],
          },
        },
        items: {
          bolg,
        },
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: 'bolg',
          },
        },
        abilityActions: [
          createAbilityAction('setup-1', 0, 'setup-shot'),
          createAbilityAction('special', 3, 'weapon-special-attack'),
        ],
        startingAdrenaline: 100,
        tickCount: 10,
      }),
    );

    expect(result.buffTimeline[3]).toContain('balance-by-force-buff');
    expect(
      result.explainability.damageBreakdowns.some(
        (entry) => entry.abilityId === 'perfect-equilibrium' && entry.tick === 3,
      ),
    ).toBe(true);
  });

  it('keeps expected-value crit buff interactions stable', () => {
    const baselineConfig = createScenarioConfig({
      abilities: {
        'piercing-shot': createAbilityDefinition({
          id: 'piercing-shot',
          name: 'Piercing Shot',
          cooldownTicks: 5,
          adrenalineGain: 9,
          hitSchedule: [{ id: 'piercing-hit', tickOffset: 0, damage: { min: 90, max: 110 } }],
          baseDamage: { min: 90, max: 110 },
        }),
      },
      abilityActions: [createAbilityAction('action-piercing', 0, 'piercing-shot')],
      startingAdrenaline: 100,
      tickCount: 6,
    });

    const buffedConfig = createScenarioConfig({
      abilities: baselineConfig.gameData.abilities,
      buffs: {
        'eclipsed-soul': {
          id: 'eclipsed-soul',
          name: 'Eclipsed Soul',
          category: 'miscellaneous',
          sourceType: 'player-config',
          effectRefs: ['critical-strike-chance:+6%'],
        },
      },
      persistentBuffConfig: {
        buffIds: ['eclipsed-soul'],
      },
      abilityActions: baselineConfig.rotationPlan.abilityActions,
      startingAdrenaline: 100,
      tickCount: 6,
    });

    const baselineResult = simulateBaseDamage(baselineConfig);
    const buffedResult = simulateBaseDamage(buffedConfig);
    const buffedBreakdown = buffedResult.explainability.damageBreakdowns[0];

    expect(buffedBreakdown?.expectedValueModifiers.map((entry) => entry.sourceId)).toContain(
      'critical-strike-chance-bonus',
    );
    expect(buffedResult.totalDamage.min).toBe(baselineResult.totalDamage.min);
    expect(buffedResult.totalDamage.max).toBe(baselineResult.totalDamage.max);
    expect(buffedResult.totalDamage.avg).toBeGreaterThan(baselineResult.totalDamage.avg);
  });

  it('supports a first playable two-handed melee rotation with Berserk buffed damage', () => {
    const twoHander: ItemDefinition = {
      id: 'masterwork-2h-sword',
      name: 'Masterwork 2h Sword',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['melee'],
      tier: 99,
      equipBehavior: 'two-handed',
      offensiveStats: {
        damageTier: 99,
        meleeBonus: 125,
      },
    };

    const hurricane = createAbilityDefinition({
      id: 'hurricane',
      name: 'Hurricane',
      style: 'melee',
      subtype: 'enhanced',
      cooldownTicks: 34,
      adrenalineCost: 25,
      requires: {
        requiredEquipmentTags: ['melee-two-handed'],
      },
      hitSchedule: [
        { id: 'hurricane-hit-1', tickOffset: 0, damage: { min: 135, max: 165 } },
        { id: 'hurricane-hit-2', tickOffset: 1, damage: { min: 155, max: 185 } },
      ],
      baseDamage: { min: 290, max: 350 },
    });
    const overpower = createAbilityDefinition({
      id: 'overpower',
      name: 'Overpower',
      style: 'melee',
      subtype: 'ultimate',
      cooldownTicks: 50,
      adrenalineCost: 60,
      requires: {
        requiredEquipmentTags: ['melee-weapon'],
      },
      hitSchedule: [{ id: 'overpower-hit', tickOffset: 3, damage: { min: 520, max: 570 } }],
      baseDamage: { min: 520, max: 570 },
    });

    const unbuffedResult = simulateBaseDamage(
      createScenarioConfig({
        abilities: {
          hurricane,
          overpower,
        },
        items: {
          [twoHander.id]: twoHander,
        },
        equipment: {
          weapon: {
            instanceId: 'twohander-1',
            definitionId: twoHander.id,
          },
        },
        abilityActions: [
          createAbilityAction('hurricane-action', 0, 'hurricane'),
          createAbilityAction('overpower-action', 3, 'overpower'),
        ],
        startingAdrenaline: 100,
        tickCount: 10,
      }),
    );

    const buffedResult = simulateBaseDamage(
      createScenarioConfig({
        abilities: {
          hurricane,
          overpower,
          berserk: createAbilityDefinition({
            id: 'berserk',
            name: 'Berserk',
            style: 'melee',
            subtype: 'ultimate',
            cooldownTicks: 100,
            adrenalineCost: 0,
            requires: {
              requiredEquipmentTags: ['melee-weapon'],
            },
            hitSchedule: [],
            baseDamage: { min: 0, max: 0 },
            timelineEffects: [
              {
                kind: 'apply-buff',
                buffId: 'berserk-buff',
              },
            ],
            stackEffects: [
              {
                buffId: 'bloodlust',
                operation: 'add',
                stacks: 2,
              },
            ],
          }),
        },
        buffs: {
          'berserk-buff': {
            id: 'berserk-buff',
            name: 'Berserk',
            category: 'temporary',
            sourceType: 'ability',
            durationTicks: 33,
            effectRefs: ['melee-damage-multiplier:+75%'],
          },
        },
        items: {
          [twoHander.id]: twoHander,
        },
        equipment: {
          weapon: {
            instanceId: 'twohander-1',
            definitionId: twoHander.id,
          },
        },
        abilityActions: [
          createAbilityAction('berserk-action', 0, 'berserk'),
          createAbilityAction('hurricane-action', 3, 'hurricane'),
          createAbilityAction('overpower-action', 6, 'overpower'),
        ],
        startingAdrenaline: 100,
        tickCount: 12,
      }),
    );

    expect(unbuffedResult.isValid).toBe(true);
    expect(buffedResult.isValid).toBe(true);
    expect(buffedResult.buffTimeline[3]).toContain('berserk-buff');
    expect(
      buffedResult.explainability.damageBreakdowns
        .filter((entry) => entry.abilityId === 'hurricane' || entry.abilityId === 'overpower')
        .every((entry) =>
          entry.multiplicativeModifiers.some((modifier) => modifier.sourceId === 'melee-damage-multiplier:+75%'),
        ),
    ).toBe(true);
    expect(buffedResult.totalDamage.avg).toBeGreaterThan(unbuffedResult.totalDamage.avg);
  });

  it('supports a first playable dual-wield melee rotation with bleed and channel hits', () => {
    const mainHand: ItemDefinition = {
      id: 'abyssal-scourge',
      name: 'Abyssal scourge',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['melee'],
      tier: 95,
      offensiveStats: {
        damageTier: 95,
        meleeBonus: 98,
      },
    };
    const offHand: ItemDefinition = {
      id: 'dark-sliver-of-leng',
      name: 'Dark Sliver of Leng',
      category: 'weapon',
      slot: 'offHand',
      combatStyleTags: ['melee'],
      tier: 95,
      offensiveStats: {
        damageTier: 95,
        meleeBonus: 49,
      },
    };

    const result = simulateBaseDamage(
      createScenarioConfig({
        abilities: {
          fury: createAbilityDefinition({
            id: 'fury',
            name: 'Fury',
            style: 'melee',
            cooldownTicks: 25,
            adrenalineGain: 9,
            requires: {
              requiredEquipmentTags: ['melee-weapon'],
            },
            hitSchedule: [{ id: 'fury-hit', tickOffset: 0, damage: { min: 110, max: 130 } }],
            baseDamage: { min: 110, max: 130 },
          }),
          dismember: createAbilityDefinition({
            id: 'dismember',
            name: 'Dismember',
            style: 'melee',
            subtype: 'enhanced',
            cooldownTicks: 40,
            requires: {
              requiredEquipmentTags: ['melee-weapon'],
            },
            hitSchedule: Array.from({ length: 8 }, (_, index) => ({
              id: `dismember-hit-${index + 1}`,
              tickOffset: index * 2,
              damage: { min: 25, max: 31 },
            })),
            baseDamage: { min: 200, max: 248 },
            effectRefs: [EFFECT_REF_IDS.damageOverTime],
          }),
          assault: createAbilityDefinition({
            id: 'assault',
            name: 'Assault',
            style: 'melee',
            subtype: 'enhanced',
            cooldownTicks: 10,
            adrenalineCost: 25,
            requires: {
              requiredEquipmentTags: ['melee-weapon'],
            },
            isChanneled: true,
            channelDurationTicks: 8,
            hitSchedule: [
              { id: 'assault-hit-1', tickOffset: 1, damage: { min: 130, max: 150 } },
              { id: 'assault-hit-2', tickOffset: 3, damage: { min: 130, max: 150 } },
              { id: 'assault-hit-3', tickOffset: 5, damage: { min: 130, max: 150 } },
              { id: 'assault-hit-4', tickOffset: 7, damage: { min: 130, max: 150 } },
            ],
            baseDamage: { min: 520, max: 600 },
          }),
        },
        items: {
          [mainHand.id]: mainHand,
          [offHand.id]: offHand,
        },
        equipment: {
          weapon: {
            instanceId: 'mainhand-1',
            definitionId: mainHand.id,
          },
          offHand: {
            instanceId: 'offhand-1',
            definitionId: offHand.id,
          },
        },
        abilityActions: [
          createAbilityAction('fury-action', 0, 'fury'),
          createAbilityAction('dismember-action', 3, 'dismember'),
          createAbilityAction('assault-action', 6, 'assault'),
        ],
        startingAdrenaline: 100,
        tickCount: 20,
      }),
    );

    expect(result.isValid).toBe(true);
    expect(result.damageByAbility.map((entry) => entry.abilityId)).toEqual(['assault', 'dismember', 'fury']);
    expect(result.explainability.damageBreakdowns.filter((entry) => entry.abilityId === 'dismember')).toHaveLength(8);
    expect(result.explainability.damageBreakdowns.filter((entry) => entry.abilityId === 'assault')).toHaveLength(4);
    expect(result.totalDamage.avg).toBeGreaterThan(0);
  });

  it('keeps first-pass melee gear synergies stable across bleed, crit, adrenaline, and Berserk extension', () => {
    const weapon: ItemDefinition = {
      id: 'abyssal-scourge',
      name: 'Abyssal scourge',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['melee'],
      tier: 95,
      offensiveStats: {
        damageTier: 95,
        meleeBonus: 98,
      },
      effectRefs: ['abyssal-parasite'],
    };
    const offHand: ItemDefinition = {
      id: 'dark-sliver-of-leng',
      name: 'Dark Sliver of Leng',
      category: 'weapon',
      slot: 'offHand',
      combatStyleTags: ['melee'],
      tier: 95,
      offensiveStats: {
        damageTier: 95,
        meleeBonus: 49,
      },
    };

    const baseline = simulateBaseDamage(
      createScenarioConfig({
        abilities: {
          berserk: createAbilityDefinition({
            id: 'berserk',
            name: 'Berserk',
            style: 'melee',
            subtype: 'ultimate',
            cooldownTicks: 100,
            adrenalineCost: 0,
            hitSchedule: [],
            baseDamage: { min: 0, max: 0 },
            timelineEffects: [
              {
                kind: 'apply-buff',
                buffId: 'berserk-buff',
              },
            ],
            stackEffects: [
              {
                buffId: 'bloodlust',
                operation: 'add',
                stacks: 2,
              },
            ],
          }),
          rend: createAbilityDefinition({
            id: 'rend',
            name: 'Rend',
            style: 'melee',
            cooldownTicks: 17,
            adrenalineGain: 9,
            requires: {
              requiredEquipmentTags: ['melee-weapon'],
            },
            hitSchedule: [{ id: 'rend-hit', tickOffset: 0, damage: { min: 135, max: 165 } }],
            baseDamage: { min: 135, max: 165 },
          }),
          fury: createAbilityDefinition({
            id: 'fury',
            name: 'Fury',
            style: 'melee',
            cooldownTicks: 25,
            adrenalineGain: 9,
            requires: {
              requiredEquipmentTags: ['melee-weapon'],
            },
            hitSchedule: [{ id: 'fury-hit', tickOffset: 0, damage: { min: 110, max: 130 } }],
            baseDamage: { min: 110, max: 130 },
          }),
          dismember: createAbilityDefinition({
            id: 'dismember',
            name: 'Dismember',
            style: 'melee',
            subtype: 'enhanced',
            cooldownTicks: 40,
            requires: {
              requiredEquipmentTags: ['melee-weapon'],
            },
            hitSchedule: Array.from({ length: 8 }, (_, index) => ({
              id: `dismember-hit-${index + 1}`,
              tickOffset: index * 2,
              damage: { min: 25, max: 31 },
            })),
            baseDamage: { min: 200, max: 248 },
            effectRefs: [EFFECT_REF_IDS.damageOverTime],
          }),
          overpower: createAbilityDefinition({
            id: 'overpower',
            name: 'Overpower',
            style: 'melee',
            subtype: 'ultimate',
            cooldownTicks: 50,
            adrenalineCost: 0,
            requires: {
              requiredEquipmentTags: ['melee-weapon'],
            },
            hitSchedule: [{ id: 'overpower-hit', tickOffset: 3, damage: { min: 520, max: 570 } }],
            baseDamage: { min: 520, max: 570 },
          }),
        },
        buffs: {
          'berserk-buff': {
            id: 'berserk-buff',
            name: 'Berserk',
            category: 'temporary',
            sourceType: 'ability',
            durationTicks: 33,
            effectRefs: ['melee-damage-multiplier:+75%'],
          },
        },
        items: {
          [weapon.id]: weapon,
          [offHand.id]: offHand,
        },
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: weapon.id,
          },
          offHand: {
            instanceId: 'offhand-1',
            definitionId: offHand.id,
          },
        },
        abilityActions: [
          createAbilityAction('berserk-action', 0, 'berserk'),
          createAbilityAction('rend-action', 3, 'rend'),
          createAbilityAction('dismember-action', 6, 'dismember'),
          createAbilityAction('fury-action', 9, 'fury'),
          createAbilityAction('overpower-action', 40, 'overpower'),
        ],
        startingAdrenaline: 0,
        tickCount: 50,
      }),
    );

    const buffed = simulateBaseDamage(
      createScenarioConfig({
        abilities: baseline.damageByAbility.length >= 0 ? {
          berserk: createAbilityDefinition({
            id: 'berserk',
            name: 'Berserk',
            style: 'melee',
            subtype: 'ultimate',
            cooldownTicks: 100,
            adrenalineCost: 0,
            hitSchedule: [],
            baseDamage: { min: 0, max: 0 },
            timelineEffects: [
              {
                kind: 'apply-buff',
                buffId: 'berserk-buff',
              },
            ],
            stackEffects: [
              {
                buffId: 'bloodlust',
                operation: 'add',
                stacks: 2,
              },
            ],
          }),
          rend: createAbilityDefinition({
            id: 'rend',
            name: 'Rend',
            style: 'melee',
            cooldownTicks: 17,
            adrenalineGain: 9,
            requires: {
              requiredEquipmentTags: ['melee-weapon'],
            },
            hitSchedule: [{ id: 'rend-hit', tickOffset: 0, damage: { min: 135, max: 165 } }],
            baseDamage: { min: 135, max: 165 },
          }),
          fury: createAbilityDefinition({
            id: 'fury',
            name: 'Fury',
            style: 'melee',
            cooldownTicks: 25,
            adrenalineGain: 9,
            requires: {
              requiredEquipmentTags: ['melee-weapon'],
            },
            hitSchedule: [{ id: 'fury-hit', tickOffset: 0, damage: { min: 110, max: 130 } }],
            baseDamage: { min: 110, max: 130 },
          }),
          dismember: createAbilityDefinition({
            id: 'dismember',
            name: 'Dismember',
            style: 'melee',
            subtype: 'enhanced',
            cooldownTicks: 40,
            requires: {
              requiredEquipmentTags: ['melee-weapon'],
            },
            hitSchedule: Array.from({ length: 8 }, (_, index) => ({
              id: `dismember-hit-${index + 1}`,
              tickOffset: index * 2,
              damage: { min: 25, max: 31 },
            })),
            baseDamage: { min: 200, max: 248 },
            effectRefs: [EFFECT_REF_IDS.damageOverTime],
          }),
          overpower: createAbilityDefinition({
            id: 'overpower',
            name: 'Overpower',
            style: 'melee',
            subtype: 'ultimate',
            cooldownTicks: 50,
            adrenalineCost: 0,
            requires: {
              requiredEquipmentTags: ['melee-weapon'],
            },
            hitSchedule: [{ id: 'overpower-hit', tickOffset: 3, damage: { min: 520, max: 570 } }],
            baseDamage: { min: 520, max: 570 },
          }),
        } : {},
        buffs: {
          'berserk-buff': {
            id: 'berserk-buff',
            name: 'Berserk',
            category: 'temporary',
            sourceType: 'ability',
            durationTicks: 33,
            effectRefs: ['melee-damage-multiplier:+75%'],
          },
        },
        items: {
          [weapon.id]: weapon,
          [offHand.id]: offHand,
          'champions-ring': {
            id: 'champions-ring',
            name: "Champion's ring",
            category: 'jewellery',
            slot: 'ring',
            combatStyleTags: ['melee'],
            effectRefs: ['crimson-strikes'],
          },
          'jaws-of-the-abyss': {
            id: 'jaws-of-the-abyss',
            name: 'Jaws of the Abyss',
            category: 'armor',
            slot: 'head',
            combatStyleTags: ['melee'],
            effectRefs: ['jaws-of-the-abyss-passive', 'vestments-of-havoc-set'],
          },
          'gloves-of-passage': {
            id: 'gloves-of-passage',
            name: 'Gloves of passage',
            category: 'armor',
            slot: 'hands',
            combatStyleTags: ['melee'],
            effectRefs: ['enduring-ruin'],
          },
          'vestments-body': {
            id: 'vestments-body',
            name: 'Vestments body',
            category: 'armor',
            slot: 'body',
            combatStyleTags: ['melee'],
            effectRefs: ['vestments-of-havoc-set'],
          },
          'vestments-legs': {
            id: 'vestments-legs',
            name: 'Vestments legs',
            category: 'armor',
            slot: 'legs',
            combatStyleTags: ['melee'],
            effectRefs: ['vestments-of-havoc-set'],
          },
          'enchantment-of-heroism': {
            id: 'enchantment-of-heroism',
            name: 'Enchantment of heroism',
            category: 'other',
            combatStyleTags: ['melee'],
            effectRefs: ['enchantment-of-heroism'],
          },
        },
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: weapon.id,
          },
          offHand: {
            instanceId: 'offhand-1',
            definitionId: offHand.id,
          },
          ring: {
            instanceId: 'ring-1',
            definitionId: 'champions-ring',
          },
          head: {
            instanceId: 'head-1',
            definitionId: 'jaws-of-the-abyss',
          },
          hands: {
            instanceId: 'hands-1',
            definitionId: 'gloves-of-passage',
          },
          body: {
            instanceId: 'body-1',
            definitionId: 'vestments-body',
          },
          legs: {
            instanceId: 'legs-1',
            definitionId: 'vestments-legs',
          },
        },
        inventoryItems: [
          {
            instanceId: 'heroism-1',
            definitionId: 'enchantment-of-heroism',
          },
        ],
        abilityActions: [
          createAbilityAction('berserk-action', 0, 'berserk'),
          createAbilityAction('rend-action', 3, 'rend'),
          createAbilityAction('dismember-action', 6, 'dismember'),
          createAbilityAction('fury-action', 9, 'fury'),
          createAbilityAction('overpower-action', 40, 'overpower'),
        ],
        startingAdrenaline: 0,
        tickCount: 50,
      }),
    );

    expect(buffed.isValid).toBe(true);
    expect(buffed.totalDamage.avg).toBeGreaterThan(baseline.totalDamage.avg);
    expect(buffed.adrenalineTimeline[9]).toBeGreaterThan(baseline.adrenalineTimeline[9]);
    expect(
      buffed.explainability.damageBreakdowns.some(
        (entry) =>
          entry.abilityId === 'dismember' &&
          entry.multiplicativeModifiers.some((modifier) => modifier.sourceId === 'corrupted-wounds'),
      ),
    ).toBe(true);
    expect(
      buffed.explainability.damageBreakdowns.some(
        (entry) =>
          entry.abilityId === 'fury' &&
          entry.expectedValueModifiers.some((modifier) => modifier.sourceId === 'critical-strike-chance-bonus'),
      ),
    ).toBe(true);
    expect(buffed.totalDamage.avg - baseline.totalDamage.avg).toBeGreaterThan(0);
  });

  it('keeps Meteor Strike buff behavior stable in the playable melee loop', () => {
    const twoHander: ItemDefinition = {
      id: 'masterwork-2h-sword',
      name: 'Masterwork 2h Sword',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['melee'],
      tier: 99,
      equipBehavior: 'two-handed',
      offensiveStats: {
        damageTier: 99,
        meleeBonus: 125,
      },
    };

    const result = simulateBaseDamage(
      createScenarioConfig({
        abilities: {
          'meteor-strike': createAbilityDefinition({
            id: 'meteor-strike',
            name: 'Meteor Strike',
            style: 'melee',
            subtype: 'ultimate',
            cooldownTicks: 100,
            adrenalineCost: 60,
            requires: {
              requiredEquipmentTags: ['melee-weapon'],
            },
            hitSchedule: [{ id: 'meteor-strike-hit-1', tickOffset: 0, damage: { min: 220, max: 250 } }],
            baseDamage: { min: 220, max: 250 },
            timelineEffects: [
              {
                kind: 'apply-buff',
                buffId: 'meteor-strike-buff',
              },
              {
                kind: 'grant-adrenaline',
                amount: 4.5,
                timing: 'per-tick-window',
                durationTicks: 50,
                requiresWeaponStyle: 'melee',
              },
            ],
          }),
          attack: createAbilityDefinition({
            id: 'attack',
            name: 'Attack',
            style: 'melee',
            subtype: 'basic',
            cooldownTicks: 3,
            adrenalineGain: 9,
            requires: {
              requiredEquipmentTags: ['melee-weapon'],
            },
            hitSchedule: [{ id: 'attack-hit-1', tickOffset: 0, damage: { min: 110, max: 130 } }],
            baseDamage: { min: 110, max: 130 },
          }),
        },
        buffs: {
          'meteor-strike-buff': {
            id: 'meteor-strike-buff',
            name: 'Meteor Strike',
            category: 'temporary',
            sourceType: 'ability',
            durationTicks: 50,
            effectRefs: ['basic-adrenaline:+50%'],
          },
        },
        items: {
          [twoHander.id]: twoHander,
        },
        equipment: {
          weapon: {
            instanceId: 'twohander-1',
            definitionId: twoHander.id,
          },
        },
        abilityActions: [
          createAbilityAction('meteor-action', 0, 'meteor-strike'),
          createAbilityAction('attack-action', 1, 'attack'),
        ],
        startingAdrenaline: 100,
        tickCount: 4,
      }),
    );

    expect(result.isValid).toBe(true);
    expect(result.buffTimeline[0]).toContain('meteor-strike-buff');
    expect(result.buffTimeline[3]).toContain('meteor-strike-buff');
    expect(result.timelineGeneratedBuffSources).toContainEqual({
      buffId: 'meteor-strike-buff',
      sourceType: 'ability',
      sourceId: 'meteor-strike',
    });
    expect(result.adrenalineTimeline).toEqual([44.5, 62.5, 67, 71.5]);
  });
});
