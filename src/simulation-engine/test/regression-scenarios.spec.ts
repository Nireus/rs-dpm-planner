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
            channelDurationTicks: 8,
            hitSchedule: Array.from({ length: 8 }, (_, index) => ({
              id: `rapid-hit-${index + 1}`,
              tickOffset: index,
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
      [0, 1, 2, 3, 4, 5, 6, 7],
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
          }),
        },
        buffs: {
          'balance-by-force-buff': {
            id: 'balance-by-force-buff',
            name: 'Balance by Force',
            category: 'temporary',
            sourceType: 'ability',
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
});
