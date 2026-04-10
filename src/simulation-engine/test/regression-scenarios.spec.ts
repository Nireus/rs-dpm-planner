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

  it('supports the first playable Ancient magic loop with Incite Fear reducing Tsunami cost', () => {
    const staff: ItemDefinition = {
      id: 'magic-staff',
      name: 'Magic Staff',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['magic'],
      tier: 95,
      equipBehavior: 'two-handed',
      offensiveStats: {
        damageTier: 95,
        magicBonus: 110,
      },
      requirements: {
        requiredEquipmentTags: ['magic-two-handed'],
      },
    };

    const result = simulateBaseDamage(
      createScenarioConfig({
        spells: {
          'incite-fear': {
            id: 'incite-fear',
            name: 'Incite Fear',
            spellbookId: 'ancient',
            role: 'combat',
            levelRequirement: 98,
            tier: 16,
            iconPath: '/icons/wiki/incite-fear.png',
          },
        },
        combatChoices: {
          magic: {
            spellbookId: 'ancient',
            activeSpellId: 'incite-fear',
          },
        },
        abilities: {
          magic: createAbilityDefinition({
            id: 'magic',
            name: 'Magic',
            style: 'magic',
            cooldownTicks: 3,
            adrenalineGain: 8,
            requires: {
              requiredEquipmentTags: ['magic-weapon'],
            },
            hitSchedule: [{ id: 'magic-hit', tickOffset: 0, damage: { min: 95, max: 105 } }],
            baseDamage: { min: 95, max: 105 },
          }),
          tsunami: createAbilityDefinition({
            id: 'tsunami',
            name: 'Tsunami',
            style: 'magic',
            subtype: 'ultimate',
            cooldownTicks: 100,
            adrenalineCost: 60,
            requires: {
              requiredEquipmentTags: ['magic-weapon'],
            },
            hitSchedule: [{ id: 'tsunami-hit', tickOffset: 0, damage: { min: 225, max: 275 } }],
            baseDamage: { min: 225, max: 275 },
            timelineEffects: [
              {
                kind: 'apply-buff',
                buffId: 'tsunami-buff',
              },
            ],
          }),
        },
        buffs: {
          'glacial-embrace': {
            id: 'glacial-embrace',
            name: 'Glacial Embrace',
            category: 'temporary',
            sourceType: 'ability',
            durationTicks: 34,
            stackRules: {
              maxStacks: 5,
            },
          },
          'tsunami-buff': {
            id: 'tsunami-buff',
            name: 'Tsunami',
            category: 'temporary',
            sourceType: 'ability',
            durationTicks: 50,
          },
        },
        items: {
          [staff.id]: staff,
        },
        equipment: {
          weapon: {
            instanceId: 'staff-1',
            definitionId: staff.id,
          },
        },
        abilityActions: [
          createAbilityAction('magic-1', 0, 'magic'),
          createAbilityAction('magic-2', 3, 'magic'),
          createAbilityAction('magic-3', 6, 'magic'),
          createAbilityAction('magic-4', 9, 'magic'),
          createAbilityAction('magic-5', 12, 'magic'),
          createAbilityAction('tsunami-1', 15, 'tsunami'),
        ],
        startingAdrenaline: 0,
        tickCount: 20,
      }),
    );

    expect(result.isValid).toBe(true);
    expect(result.validationIssues.some((issue) => issue.code === 'ability.insufficient_adrenaline')).toBe(false);
    expect(result.buffTimeline[15].filter((buffId) => buffId === 'glacial-embrace')).toHaveLength(5);
    expect(result.buffTimeline[15]).toContain('tsunami-buff');
    expect(result.adrenalineTimeline[14]).toBe(40);
    expect(result.adrenalineTimeline[15]).toBeGreaterThanOrEqual(16);
  });

  it('supports configurable Tsunami adrenaline from magic critical hits', () => {
    const staff: ItemDefinition = {
      id: 'magic-staff',
      name: 'Magic Staff',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['magic'],
      tier: 95,
      equipBehavior: 'two-handed',
      offensiveStats: {
        damageTier: 95,
        magicBonus: 110,
      },
    };

    const createConfig = (mode?: 'deterministic-accumulator' | 'expected-value') =>
      createScenarioConfig({
        abilities: {
          tsunami: createAbilityDefinition({
            id: 'tsunami',
            name: 'Tsunami',
            style: 'magic',
            subtype: 'ultimate',
            cooldownTicks: 100,
            adrenalineCost: 100,
            requires: {
              requiredEquipmentTags: ['magic-weapon'],
            },
            hitSchedule: [{ id: 'tsunami-hit', tickOffset: 0, damage: { min: 225, max: 275 } }],
            baseDamage: { min: 225, max: 275 },
            timelineEffects: [
              {
                kind: 'apply-buff',
                buffId: 'tsunami-buff',
              },
            ],
          }),
          magic: createAbilityDefinition({
            id: 'magic',
            name: 'Magic',
            style: 'magic',
            cooldownTicks: 3,
            adrenalineGain: 8,
            requires: {
              requiredEquipmentTags: ['magic-weapon'],
            },
            effectRefs: ['critical-strike-chance:+100%'],
            hitSchedule: [{ id: 'magic-hit', tickOffset: 0, damage: { min: 95, max: 105 } }],
            baseDamage: { min: 95, max: 105 },
          }),
        },
        buffs: {
          'tsunami-buff': {
            id: 'tsunami-buff',
            name: 'Tsunami',
            category: 'temporary',
            sourceType: 'ability',
            durationTicks: 51,
            effectRefs: ['magic-critical-hit-adrenaline:+8%'],
          },
        },
        items: {
          [staff.id]: staff,
        },
        equipment: {
          weapon: {
            instanceId: 'staff-1',
            definitionId: staff.id,
          },
        },
        abilityActions: [
          createAbilityAction('tsunami-1', 0, 'tsunami'),
          createAbilityAction('magic-1', 3, 'magic'),
        ],
        startingAdrenaline: 100,
        tickCount: 8,
        simulationSettings: mode ? { criticalHitResolutionMode: mode } : undefined,
      });

    const deterministicResult = simulateBaseDamage(createConfig());
    const expectedValueResult = simulateBaseDamage(createConfig('expected-value'));

    expect(deterministicResult.isValid).toBe(true);
    expect(deterministicResult.buffTimeline[3]).toContain('tsunami-buff');
    expect(deterministicResult.adrenalineTimeline[0]).toBe(0);
    expect(deterministicResult.adrenalineTimeline[3]).toBe(16);
    expect(deterministicResult.explainability.notes).toContain(
      'Tsunami: magic critical strikes grant additional adrenaline using the Deterministic build-up crit model while the Tsunami buff is active.',
    );
    expect(expectedValueResult.isValid).toBe(true);
    expect(expectedValueResult.adrenalineTimeline[0]).toBeCloseTo(0.8);
    expect(expectedValueResult.adrenalineTimeline[3]).toBeCloseTo(16.8);
    expect(expectedValueResult.explainability.notes).toContain(
      'Tsunami: magic critical strikes grant additional adrenaline using the Expected value crit model while the Tsunami buff is active.',
    );
  });

  it('supports the first playable magic empowerment flow with Runic Charge into Dragon Breath', () => {
    const staff: ItemDefinition = {
      id: 'magic-staff',
      name: 'Magic Staff',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['magic'],
      tier: 95,
      equipBehavior: 'two-handed',
      offensiveStats: {
        damageTier: 95,
        magicBonus: 110,
      },
      requirements: {
        requiredEquipmentTags: ['magic-two-handed'],
      },
    };

    const result = simulateBaseDamage(
      createScenarioConfig({
        spells: {
          'fire-surge': {
            id: 'fire-surge',
            name: 'Fire Surge',
            spellbookId: 'standard',
            role: 'combat',
            levelRequirement: 95,
            tier: 16,
            iconPath: '/icons/wiki/fire-surge.png',
          },
        },
        combatChoices: {
          magic: {
            spellbookId: 'standard',
            activeSpellId: 'fire-surge',
          },
        },
        abilities: {
          'runic-charge': createAbilityDefinition({
            id: 'runic-charge',
            name: 'Runic Charge',
            style: 'magic',
            subtype: 'utility',
            cooldownTicks: 50,
            adrenalineGain: 0,
            requires: {
              requiredEquipmentTags: ['magic-weapon'],
            },
            hitSchedule: [],
            baseDamage: { min: 0, max: 0 },
            timelineEffects: [
              {
                kind: 'apply-buff',
                buffId: 'anima-charged',
              },
            ],
          }),
          'dragon-breath': createAbilityDefinition({
            id: 'dragon-breath',
            name: 'Dragon Breath',
            style: 'magic',
            cooldownTicks: 17,
            adrenalineGain: 8,
            requires: {
              requiredEquipmentTags: ['magic-weapon'],
            },
            hitSchedule: [{ id: 'dragon-breath-hit', tickOffset: 0, damage: { min: 150, max: 180 } }],
            baseDamage: { min: 150, max: 180 },
          }),
        },
        buffs: {
          'anima-charged': {
            id: 'anima-charged',
            name: 'Anima Charged',
            category: 'temporary',
            sourceType: 'ability',
            durationTicks: 25,
          },
        },
        items: {
          [staff.id]: staff,
        },
        equipment: {
          weapon: {
            instanceId: 'staff-1',
            definitionId: staff.id,
          },
        },
        abilityActions: [
          createAbilityAction('runic-charge-1', 0, 'runic-charge'),
          createAbilityAction('dragon-breath-1', 3, 'dragon-breath'),
        ],
        startingAdrenaline: 0,
        tickCount: 8,
      }),
    );

    expect(result.isValid).toBe(true);
    expect(result.buffTimeline[0]).toContain('anima-charged');
    expect(result.buffTimeline[3]).toContain('anima-charged');
    expect(result.buffTimeline[4]).not.toContain('anima-charged');
    const dragonBreathHits = result.explainability.damageBreakdowns.filter((entry) => entry.abilityId === 'dragon-breath');
    expect(dragonBreathHits).toHaveLength(1);
    expect(dragonBreathHits[0]?.baseDamage.min).toBeGreaterThanOrEqual(260);
    expect(dragonBreathHits[0]?.baseDamage.max).toBeGreaterThanOrEqual(310);
  });

  it('consumes Runic Charge through Sonic Wave Flow discounts', () => {
    const staff: ItemDefinition = {
      id: 'magic-staff',
      name: 'Magic Staff',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['magic'],
      tier: 95,
      equipBehavior: 'two-handed',
      offensiveStats: {
        damageTier: 95,
        magicBonus: 110,
      },
    };
    const runicCharge = createAbilityDefinition({
      id: 'runic-charge',
      name: 'Runic Charge',
      style: 'magic',
      subtype: 'utility',
      cooldownTicks: 50,
      adrenalineCost: 0,
      hitSchedule: [],
      baseDamage: { min: 0, max: 0 },
      timelineEffects: [{ kind: 'apply-buff', buffId: 'anima-charged' }],
    });
    const wildMagic = createAbilityDefinition({
      id: 'wild-magic',
      name: 'Wild Magic',
      style: 'magic',
      subtype: 'enhanced',
      cooldownTicks: 9,
      adrenalineCost: 40,
      hitSchedule: [{ id: 'wild-magic-hit', tickOffset: 0, damage: { min: 100, max: 100 } }],
      baseDamage: { min: 100, max: 100 },
    });

    for (const entry of [
      { abilityId: 'sonic-wave', flowBuffId: 'flow', damage: { min: 90, max: 110 }, expectedAdrenaline: 3 },
      { abilityId: 'greater-sonic-wave', flowBuffId: 'greater-flow', damage: { min: 115, max: 135 }, expectedAdrenaline: 7 },
    ] as const) {
      const result = simulateBaseDamage(
        createScenarioConfig({
          abilities: {
            'runic-charge': runicCharge,
            'wild-magic': wildMagic,
            [entry.abilityId]: createAbilityDefinition({
              id: entry.abilityId,
              name: entry.abilityId,
              style: 'magic',
              cooldownTicks: 25,
              adrenalineGain: 9,
              hitSchedule: [{ id: `${entry.abilityId}-hit`, tickOffset: 0, damage: entry.damage }],
              baseDamage: entry.damage,
              timelineEffects: [{ kind: 'apply-buff', buffId: entry.flowBuffId }],
            }),
          },
          buffs: {
            'anima-charged': {
              id: 'anima-charged',
              name: 'Anima Charged',
              category: 'temporary',
              sourceType: 'ability',
              durationTicks: 25,
            },
            flow: {
              id: 'flow',
              name: 'Flow',
              category: 'temporary',
              sourceType: 'ability',
              durationTicks: 15,
            },
            'greater-flow': {
              id: 'greater-flow',
              name: 'Greater Flow',
              category: 'temporary',
              sourceType: 'ability',
              durationTicks: 15,
            },
          },
          items: {
            [staff.id]: staff,
          },
          equipment: {
            weapon: {
              instanceId: 'staff-1',
              definitionId: staff.id,
            },
          },
          abilityActions: [
            createAbilityAction('runic-charge-1', 0, 'runic-charge'),
            createAbilityAction(`${entry.abilityId}-1`, 3, entry.abilityId),
            createAbilityAction('wild-magic-1', 6, 'wild-magic'),
          ],
          startingAdrenaline: 20,
          tickCount: 10,
        }),
      );

      expect(result.isValid).toBe(true);
      expect(result.buffTimeline[3]).toContain('anima-charged');
      expect(result.buffTimeline[4]).not.toContain('anima-charged');
      expect(result.buffTimeline[6]).toContain(entry.flowBuffId);
      expect(result.buffTimeline[7]).not.toContain(entry.flowBuffId);
      expect(result.adrenalineTimeline[6]).toBe(entry.expectedAdrenaline);
    }
  });

  it('consumes Runic Charge through Greater Concentrated Blast crit setup', () => {
    const staff: ItemDefinition = {
      id: 'magic-staff',
      name: 'Magic Staff',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['magic'],
      tier: 95,
      equipBehavior: 'two-handed',
      offensiveStats: {
        damageTier: 95,
        magicBonus: 110,
      },
    };
    const swapStaff: ItemDefinition = {
      ...staff,
      id: 'backup-magic-staff',
      name: 'Backup Magic Staff',
    };
    const createConfigWithRunic = (includeRunicCharge: boolean, includeWeaponSwap = false) => createScenarioConfig({
      spells: {
        'fire-surge': {
          id: 'fire-surge',
          name: 'Fire Surge',
          spellbookId: 'standard',
          role: 'combat',
          levelRequirement: 95,
          tier: 16,
        },
      },
      combatChoices: {
        magic: {
          spellbookId: 'standard',
          activeSpellId: 'fire-surge',
        },
      },
      abilities: {
        'runic-charge': createAbilityDefinition({
          id: 'runic-charge',
          name: 'Runic Charge',
          style: 'magic',
          subtype: 'utility',
          cooldownTicks: 50,
          adrenalineCost: 0,
          hitSchedule: [],
          baseDamage: { min: 0, max: 0 },
          timelineEffects: [{ kind: 'apply-buff', buffId: 'anima-charged' }],
        }),
        'greater-concentrated-blast': createAbilityDefinition({
          id: 'greater-concentrated-blast',
          name: 'Greater Concentrated Blast',
          style: 'magic',
          cooldownTicks: 9,
          adrenalineGain: 9,
          isChanneled: true,
          channelDurationTicks: 3,
          hitSchedule: [
            { id: 'gconc-hit-1', tickOffset: 0, damage: { min: 40, max: 50 } },
            { id: 'gconc-hit-2', tickOffset: 1, damage: { min: 40, max: 50 } },
            { id: 'gconc-hit-3', tickOffset: 2, damage: { min: 40, max: 50 } },
          ],
          baseDamage: { min: 120, max: 150 },
        }),
        magic: createAbilityDefinition({
          id: 'magic',
          name: 'Magic',
          style: 'magic',
          cooldownTicks: 3,
          adrenalineGain: 9,
          hitSchedule: [{ id: 'magic-hit', tickOffset: 0, damage: { min: 100, max: 100 } }],
          baseDamage: { min: 100, max: 100 },
        }),
      },
      buffs: {
        'anima-charged': {
          id: 'anima-charged',
          name: 'Anima Charged',
          category: 'temporary',
          sourceType: 'ability',
          durationTicks: 25,
        },
        'greater-concentrated-blast-critical-strike': {
          id: 'greater-concentrated-blast-critical-strike',
          name: 'Greater Concentrated Blast Critical Strike',
          category: 'temporary',
          sourceType: 'ability',
        },
      },
      items: {
        [staff.id]: staff,
        [swapStaff.id]: swapStaff,
      },
      inventoryItems: includeWeaponSwap ? [{ instanceId: 'staff-2', definitionId: swapStaff.id }] : [],
      equipment: {
        weapon: {
          instanceId: 'staff-1',
          definitionId: staff.id,
        },
      },
      nonGcdActions: includeWeaponSwap
        ? [createGearSwapAction('swap-staff-1', 5, 'staff-2', swapStaff.id, 'weapon')]
        : [],
      abilityActions: [
        ...(includeRunicCharge ? [createAbilityAction('runic-charge-1', 0, 'runic-charge')] : []),
        createAbilityAction('gconc-1', 3, 'greater-concentrated-blast'),
        createAbilityAction('magic-1', 6, 'magic'),
      ],
      startingAdrenaline: 100,
      tickCount: 10,
    });
    const baseline = simulateBaseDamage(createConfigWithRunic(false));
    const empowered = simulateBaseDamage(createConfigWithRunic(true));
    const swapped = simulateBaseDamage(createConfigWithRunic(true, true));
    const baselineMagicHit = baseline.explainability.damageBreakdowns.find((entry) => entry.abilityId === 'magic');
    const empoweredMagicHit = empowered.explainability.damageBreakdowns.find((entry) => entry.abilityId === 'magic');
    const swappedMagicHit = swapped.explainability.damageBreakdowns.find((entry) => entry.abilityId === 'magic');

    expect(empowered.isValid).toBe(true);
    expect(empowered.buffTimeline[3]).toContain('anima-charged');
    expect(empowered.buffTimeline[4]).not.toContain('anima-charged');
    expect(empowered.buffTimeline[6]).toContain('greater-concentrated-blast-critical-strike');
    expect(empowered.buffTimeline[7]).not.toContain('greater-concentrated-blast-critical-strike');
    expect(empoweredMagicHit?.finalDamage.avg).toBeGreaterThan(baselineMagicHit?.finalDamage.avg ?? 0);
    expect(swapped.buffTimeline[6]).not.toContain('greater-concentrated-blast-critical-strike');
    expect(swappedMagicHit?.finalDamage.avg ?? 0).toBeLessThan(baselineMagicHit?.finalDamage.avg ?? 0);
  });

  it('fires Lightning Surge while Instability is active and records proc efficacy', () => {
    const staff: ItemDefinition = {
      id: 'fractured-staff-of-armadyl',
      name: 'Fractured Staff of Armadyl',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['magic'],
      tier: 95,
      equipBehavior: 'two-handed',
      offensiveStats: {
        damageTier: 95,
        magicBonus: 110,
      },
    };

    const createInstabilityConfig = (mode?: 'deterministic-accumulator' | 'expected-value') =>
      createScenarioConfig({
        abilities: {
          instability: createAbilityDefinition({
            id: 'instability',
            name: 'Instability',
            style: 'magic',
            subtype: 'special',
            cooldownTicks: 100,
            adrenalineCost: 50,
            hitSchedule: [{ id: 'instability-hit', tickOffset: 0, damage: { min: 120, max: 140 } }],
            baseDamage: { min: 120, max: 140 },
            timelineEffects: [
              {
                kind: 'apply-buff',
                buffId: 'instability',
              },
            ],
          }),
          magic: createAbilityDefinition({
            id: 'magic',
            name: 'Magic',
            style: 'magic',
            cooldownTicks: 3,
            adrenalineGain: 8,
            requires: {
              requiredEquipmentTags: ['magic-weapon'],
            },
            effectRefs: ['critical-strike-chance:+100%'],
            hitSchedule: [{ id: 'magic-hit', tickOffset: 0, damage: { min: 100, max: 120 } }],
            baseDamage: { min: 100, max: 120 },
          }),
        },
        buffs: {
          instability: {
            id: 'instability',
            name: 'Instability',
            category: 'temporary',
            sourceType: 'ability',
            durationTicks: 50,
          },
        },
        items: {
          [staff.id]: staff,
        },
        equipment: {
          weapon: {
            instanceId: 'staff-1',
            definitionId: staff.id,
          },
        },
        abilityActions: [
          createAbilityAction('instability-1', 0, 'instability'),
          createAbilityAction('magic-1', 3, 'magic'),
        ],
        startingAdrenaline: 100,
        tickCount: 8,
        simulationSettings: mode ? { criticalHitResolutionMode: mode } : undefined,
      });

    const result = simulateBaseDamage(createInstabilityConfig());
    const expectedValueResult = simulateBaseDamage(createInstabilityConfig('expected-value'));
    const deterministicLightningSurge = result.explainability.damageBreakdowns.find(
      (entry) => entry.abilityId === 'lightning-surge' && entry.tick === 4,
    );
    const expectedValueOpeningSurge = expectedValueResult.explainability.damageBreakdowns.find(
      (entry) => entry.abilityId === 'lightning-surge' && entry.tick === 1,
    );

    expect(result.isValid).toBe(true);
    expect(deterministicLightningSurge?.derivedParts?.procEfficacy).toBe(1);
    expect(expectedValueResult.isValid).toBe(true);
    expect(expectedValueOpeningSurge?.derivedParts?.procEfficacy).toBeCloseTo(0.1);
  });

  it('uses Soulfire to build Essence Corruption and amplify the next Combust', () => {
    const roar: ItemDefinition = {
      id: 'roar-of-awakening',
      name: 'Roar of Awakening',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['magic'],
      tier: 95,
      offensiveStats: {
        damageTier: 95,
        magicBonus: 55,
      },
    };
    const ode: ItemDefinition = {
      id: 'ode-to-deceit',
      name: 'Ode to Deceit',
      category: 'weapon',
      slot: 'offHand',
      combatStyleTags: ['magic'],
      tier: 95,
      offensiveStats: {
        damageTier: 95,
        magicBonus: 55,
      },
    };

    const createMagicSetConfig = (includeSoulfire: boolean) =>
      createScenarioConfig({
        spells: {
          'fire-surge': {
            id: 'fire-surge',
            name: 'Fire Surge',
            spellbookId: 'standard',
            role: 'combat',
            levelRequirement: 95,
            tier: 16,
          },
        },
        combatChoices: {
          magic: {
            spellbookId: 'standard',
            activeSpellId: 'fire-surge',
          },
        },
        abilities: {
          soulfire: createAbilityDefinition({
            id: 'soulfire',
            name: 'Soulfire',
            style: 'magic',
            subtype: 'special',
            cooldownTicks: 75,
            adrenalineCost: 35,
            hitSchedule: [
              { id: 'soulfire-hit', tickOffset: 0, damage: { min: 130, max: 160 } },
              { id: 'soulfire-burn-1', tickOffset: 3, damage: { min: 170, max: 200 } },
              { id: 'soulfire-burn-2', tickOffset: 6, damage: { min: 170, max: 200 } },
              { id: 'soulfire-burn-3', tickOffset: 9, damage: { min: 170, max: 200 } },
              { id: 'soulfire-burn-4', tickOffset: 12, damage: { min: 170, max: 200 } },
              { id: 'soulfire-burn-5', tickOffset: 15, damage: { min: 170, max: 200 } },
              { id: 'soulfire-burn-6', tickOffset: 18, damage: { min: 170, max: 200 } },
            ],
            baseDamage: { min: 1150, max: 1360 },
            effectRefs: [EFFECT_REF_IDS.damageOverTime],
            timelineEffects: [
              { kind: 'apply-buff', buffId: 'soulfire' },
              { kind: 'apply-buff', buffId: 'conflagrate' },
            ],
          }),
          combust: createAbilityDefinition({
            id: 'combust',
            name: 'Combust',
            style: 'magic',
            cooldownTicks: 30,
            adrenalineGain: 9,
            requires: {
              requiredEquipmentTags: ['magic-weapon'],
            },
            hitSchedule: Array.from({ length: 10 }, (_, index) => ({
              id: `combust-hit-${index + 1}`,
              tickOffset: index * 3,
              damage: { min: 27, max: 33 },
            })),
            baseDamage: { min: 270, max: 330 },
            effectRefs: [EFFECT_REF_IDS.damageOverTime],
          }),
        },
        buffs: {
          soulfire: {
            id: 'soulfire',
            name: 'Soulfire',
            category: 'temporary',
            sourceType: 'ability',
            durationTicks: 18,
          },
          conflagrate: {
            id: 'conflagrate',
            name: 'Conflagrate',
            category: 'temporary',
            sourceType: 'ability',
            durationTicks: 25,
          },
          'essence-corruption': {
            id: 'essence-corruption',
            name: 'Essence Corruption',
            category: 'temporary',
            sourceType: 'item',
            durationTicks: 50,
            stackRules: {
              maxStacks: 100,
              refreshesDuration: true,
            },
          },
        },
        items: {
          [roar.id]: roar,
          [ode.id]: ode,
        },
        equipment: {
          weapon: {
            instanceId: 'roar-1',
            definitionId: roar.id,
          },
          offHand: {
            instanceId: 'ode-1',
            definitionId: ode.id,
          },
        },
        abilityActions: [
          ...(includeSoulfire ? [createAbilityAction('soulfire-1', 0, 'soulfire')] : []),
          createAbilityAction('combust-1', 21, 'combust'),
        ],
        startingAdrenaline: 100,
        tickCount: 55,
      });

    const baseline = simulateBaseDamage(createMagicSetConfig(false));
    const buffed = simulateBaseDamage(createMagicSetConfig(true));

    expect(buffed.isValid).toBe(true);
    expect(buffed.buffTimeline[21].filter((buffId) => buffId === 'essence-corruption')).toHaveLength(8);
    expect(buffed.explainability.damageBreakdowns.find((entry) => entry.abilityId === 'combust')?.finalDamage.avg).toBeGreaterThan(
      baseline.explainability.damageBreakdowns.find((entry) => entry.abilityId === 'combust')?.finalDamage.avg ?? 0,
    );
  });

  it('applies the Guthix staff EOF affinity debuff state', () => {
    const result = simulateBaseDamage(
      createScenarioConfig({
        abilities: {
          'guthix-staff-eof': createAbilityDefinition({
            id: 'guthix-staff-eof',
            name: 'Guthix Staff (EOF)',
            style: 'magic',
            subtype: 'special',
            cooldownTicks: 0,
            adrenalineCost: 25,
            hitSchedule: [{ id: 'guthix-hit', tickOffset: 0, damage: { min: 200, max: 240 } }],
            baseDamage: { min: 200, max: 240 },
            timelineEffects: [
              {
                kind: 'apply-buff',
                buffId: 'guthix-staff-affinity-debuff',
              },
            ],
          }),
        },
        buffs: {
          'guthix-staff-affinity-debuff': {
            id: 'guthix-staff-affinity-debuff',
            name: 'Guthix Staff Affinity Debuff',
            category: 'temporary',
            sourceType: 'ability',
            durationTicks: 100,
          },
        },
        abilityActions: [createAbilityAction('guthix-1', 0, 'guthix-staff-eof')],
        startingAdrenaline: 100,
        tickCount: 8,
      }),
    );

    expect(result.isValid).toBe(true);
    expect(result.timelineGeneratedBuffSources).toContainEqual({
      buffId: 'guthix-staff-affinity-debuff',
      sourceType: 'ability',
      sourceId: 'guthix-staff-eof',
    });
  });
});
