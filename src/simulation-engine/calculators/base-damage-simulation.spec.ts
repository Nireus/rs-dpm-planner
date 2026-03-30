import { describe, expect, it } from 'vitest';
import { EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type { AbilityDefinition, BuffDefinition } from '../../game-data/types';
import type { SimulationConfig } from '../models';
import { simulateBaseDamage } from './base-damage-simulation';

describe('simulateBaseDamage', () => {
  it('returns total, per-ability, and per-tick damage for a simple valid rotation', () => {
    const config = createConfig({
      abilityActions: [
        createAbilityAction('action-piercing', 0, 'piercing-shot'),
        createAbilityAction('action-rapid', 3, 'rapid-fire'),
      ],
      abilities: {
        'piercing-shot': createAbilityDefinition({
          id: 'piercing-shot',
          name: 'Piercing Shot',
          cooldownTicks: 3,
          adrenalineGain: 9,
          hitSchedule: [
            { id: 'hit-1', tickOffset: 0, damage: { min: 45, max: 55 } },
            { id: 'hit-2', tickOffset: 1, damage: { min: 45, max: 55 } },
          ],
          baseDamage: { min: 90, max: 110 },
        }),
        'rapid-fire': createAbilityDefinition({
          id: 'rapid-fire',
          name: 'Rapid Fire',
          cooldownTicks: 34,
          adrenalineCost: 25,
          isChanneled: true,
          channelDurationTicks: 9,
          hitSchedule: Array.from({ length: 8 }, (_, index) => ({
            id: `rapid-${index + 1}`,
            tickOffset: index + 1,
            damage: { min: 75, max: 85 },
          })),
          baseDamage: { min: 600, max: 680 },
        }),
      },
      startingAdrenaline: 100,
      tickCount: 20,
    });

    const result = simulateBaseDamage(config);

    expect(result.isValid).toBe(true);
    expect(result.totalDamage).toEqual({
      min: 12170,
      avg: 13703.56,
      max: 20898,
    });
    expect(result.damageByAbility.map((entry) => [entry.abilityId, entry.avg])).toEqual([
      ['rapid-fire', 11852.4],
      ['piercing-shot', 1851.16],
    ]);
    expect(result.damageByTick[0]?.avg).toBe(925.58);
    expect(result.damageByTick[1]?.avg).toBe(925.58);
    expect(result.damageByTick[10]?.avg).toBe(1481.55);
    expect(result.explainability.damageBreakdowns).toHaveLength(10);
  });

  it('skips damage from ability actions blocked by validation', () => {
    const config = createConfig({
      abilityActions: [
        createAbilityAction('deadshot-1', 0, 'deadshot'),
        createAbilityAction('deadshot-2', 10, 'deadshot'),
      ],
      abilities: {
        deadshot: createAbilityDefinition({
          id: 'deadshot',
          name: 'Deadshot',
          cooldownTicks: 50,
          adrenalineCost: 60,
          hitSchedule: [
            { id: 'deadshot-hit', tickOffset: 0, damage: { min: 105, max: 125 } },
          ],
          baseDamage: { min: 105, max: 125 },
        }),
      },
      startingAdrenaline: 100,
      tickCount: 30,
    });

    const result = simulateBaseDamage(config);

    expect(result.isValid).toBe(false);
    expect(result.totalDamage).toEqual({
      min: 1852,
      avg: 2129.93,
      max: 3307.5,
    });
    expect(result.validationIssues.some((issue) => issue.code === 'ability.cooldown_conflict')).toBe(true);
    expect(result.explainability.damageBreakdowns).toHaveLength(1);
  });

  it("applies Death's Swiftness as a same-tick ranged damage buff with no direct hit", () => {
    const config = createConfig({
      abilityActions: [
        createAbilityAction('action-swiftness', 0, 'deaths-swiftness'),
        createAbilityAction('action-piercing', 3, 'piercing-shot'),
      ],
      abilities: {
        'deaths-swiftness': createAbilityDefinition({
          id: 'deaths-swiftness',
          name: "Death's Swiftness",
          subtype: 'ultimate',
          cooldownTicks: 100,
          adrenalineCost: 100,
          hitSchedule: [],
          baseDamage: { min: 0, max: 0 },
          timelineEffects: [
            {
              kind: 'apply-buff',
              buffId: 'deaths-swiftness-buff',
            },
          ],
        }),
        'piercing-shot': createAbilityDefinition({
          id: 'piercing-shot',
          name: 'Piercing Shot',
          cooldownTicks: 3,
          adrenalineGain: 9,
          hitSchedule: [
            { id: 'hit-1', tickOffset: 0, damage: { min: 100, max: 100 } },
          ],
          baseDamage: { min: 100, max: 100 },
        }),
      },
      buffs: {
        'deaths-swiftness-buff': {
          id: 'deaths-swiftness-buff',
          name: "Death's Swiftness",
          category: 'temporary',
          sourceType: 'ability',
          effectRefs: ['ranged-damage-multiplier:+50%'],
        },
      },
      startingAdrenaline: 100,
      tickCount: 10,
    });

    const result = simulateBaseDamage(config);

    expect(result.totalDamage).toEqual({
      min: 2646,
      avg: 2778.3,
      max: 3969,
    });
    expect(result.damageByAbility.map((entry) => [entry.abilityId, entry.avg])).toEqual([
      ['piercing-shot', 2778.3],
    ]);
    expect(result.buffTimeline[0]).toEqual(['deaths-swiftness-buff']);
    expect(result.buffTimeline[9]).toEqual(['deaths-swiftness-buff']);
  });

  it('applies Searing Winds as a cast-snapshot flat damage bonus to the full ability', () => {
    const config = createConfig({
      abilityActions: [
        createAbilityAction('action-galeshot', 0, 'galeshot'),
        createAbilityAction('action-piercing', 9, 'piercing-shot'),
      ],
      abilities: {
        galeshot: createAbilityDefinition({
          id: 'galeshot',
          name: 'Galeshot',
          cooldownTicks: 34,
          adrenalineGain: 9,
          hitSchedule: [
            { id: 'galeshot-hit', tickOffset: 0, damage: { min: 100, max: 120 } },
          ],
          baseDamage: { min: 100, max: 120 },
          timelineEffects: [
            {
              kind: 'apply-buff',
              buffId: 'searing-winds',
            },
          ],
          effectRefs: ['searing-winds'],
        }),
        'piercing-shot': createAbilityDefinition({
          id: 'piercing-shot',
          name: 'Piercing Shot',
          cooldownTicks: 3,
          adrenalineGain: 9,
          hitSchedule: [
            { id: 'hit-1', tickOffset: 0, damage: { min: 45, max: 55 } },
            { id: 'hit-2', tickOffset: 1, damage: { min: 45, max: 55 } },
          ],
          baseDamage: { min: 90, max: 110 },
        }),
      },
      buffs: {
        'searing-winds': {
          id: 'searing-winds',
          name: 'Searing Winds',
          category: 'temporary',
          sourceType: 'ability',
          effectRefs: ['ranged-hit-flat-bonus-ability-damage:+20%:cast-snapshot'],
        },
      },
      startingAdrenaline: 100,
      tickCount: 14,
    });

    const result = simulateBaseDamage(config);
    const piercingBreakdowns = result.explainability.damageBreakdowns.filter(
      (entry) => entry.abilityId === 'piercing-shot',
    );

    expect(result.buffTimeline[9]).toEqual(['searing-winds']);
    expect(result.buffTimeline[10]).toEqual([]);
    expect(piercingBreakdowns).toHaveLength(2);
    expect(piercingBreakdowns[0].additiveModifiers).toEqual([
      {
        sourceId: 'ranged-hit-flat-bonus-ability-damage:+20%:cast-snapshot',
        label: 'Ranged hit bonus +20% ability damage',
        value: 352.8,
      },
    ]);
    expect(piercingBreakdowns[1].additiveModifiers).toEqual([
      {
        sourceId: 'ranged-hit-flat-bonus-ability-damage:+20%:cast-snapshot',
        label: 'Ranged hit bonus +20% ability damage',
        value: 352.8,
      },
    ]);
  });

  it('does not let Galeshot benefit from the Searing Winds buff it creates', () => {
    const config = createConfig({
      abilityActions: [createAbilityAction('action-galeshot', 0, 'galeshot')],
      abilities: {
        galeshot: createAbilityDefinition({
          id: 'galeshot',
          name: 'Galeshot',
          cooldownTicks: 34,
          adrenalineGain: 9,
          hitSchedule: [
            { id: 'galeshot-hit', tickOffset: 0, damage: { min: 100, max: 120 } },
          ],
          baseDamage: { min: 100, max: 120 },
          timelineEffects: [
            {
              kind: 'apply-buff',
              buffId: 'searing-winds',
            },
          ],
          effectRefs: ['searing-winds'],
        }),
      },
      buffs: {
        'searing-winds': {
          id: 'searing-winds',
          name: 'Searing Winds',
          category: 'temporary',
          sourceType: 'ability',
          effectRefs: ['ranged-hit-flat-bonus-ability-damage:+20%:cast-snapshot'],
        },
      },
      startingAdrenaline: 100,
      tickCount: 12,
    });

    const result = simulateBaseDamage(config);
    const galeshotBreakdown = result.explainability.damageBreakdowns[0];

    expect(galeshotBreakdown.additiveModifiers).toEqual([]);
  });

  it('lets Rapid Fire and three later GCD starts benefit from Searing Winds in planner timing', () => {
    const config = createConfig({
      abilityActions: [
        createAbilityAction('action-galeshot', 0, 'galeshot'),
        createAbilityAction('action-rapid', 3, 'rapid-fire'),
        createAbilityAction('action-piercing-1', 12, 'piercing-shot'),
        createAbilityAction('action-piercing-2', 15, 'piercing-shot'),
        createAbilityAction('action-piercing-3', 18, 'piercing-shot'),
      ],
      abilities: {
        galeshot: createAbilityDefinition({
          id: 'galeshot',
          name: 'Galeshot',
          cooldownTicks: 34,
          adrenalineGain: 9,
          hitSchedule: [
            { id: 'galeshot-hit', tickOffset: 0, damage: { min: 100, max: 120 } },
          ],
          baseDamage: { min: 100, max: 120 },
          timelineEffects: [
            {
              kind: 'apply-buff',
              buffId: 'searing-winds',
            },
          ],
          effectRefs: ['searing-winds'],
        }),
        'rapid-fire': createAbilityDefinition({
          id: 'rapid-fire',
          name: 'Rapid Fire',
          cooldownTicks: 34,
          adrenalineCost: 25,
          isChanneled: true,
          channelDurationTicks: 9,
          hitSchedule: Array.from({ length: 8 }, (_, index) => ({
            id: `rapid-${index + 1}`,
            tickOffset: index + 1,
            damage: { min: 75, max: 85 },
          })),
          baseDamage: { min: 600, max: 680 },
          timelineEffects: [
            {
              kind: 'extend-buff',
              buffId: 'searing-winds',
              requiresActive: true,
              durationFromAbility: 'max-hit-count-or-channel-duration',
              bonusTicks: 1,
            },
          ],
          effectRefs: ['rapid-fire-channel'],
        }),
        'piercing-shot': createAbilityDefinition({
          id: 'piercing-shot',
          name: 'Piercing Shot',
          cooldownTicks: 3,
          adrenalineGain: 9,
          hitSchedule: [
            { id: 'hit-1', tickOffset: 0, damage: { min: 45, max: 55 } },
            { id: 'hit-2', tickOffset: 1, damage: { min: 45, max: 55 } },
          ],
          baseDamage: { min: 90, max: 110 },
        }),
      },
      buffs: {
        'searing-winds': {
          id: 'searing-winds',
          name: 'Searing Winds',
          category: 'temporary',
          sourceType: 'ability',
          effectRefs: ['ranged-hit-flat-bonus-ability-damage:+20%:cast-snapshot'],
        },
      },
      startingAdrenaline: 100,
      tickCount: 24,
    });

    const result = simulateBaseDamage(config);
    const piercingBreakdowns = result.explainability.damageBreakdowns.filter(
      (entry) => entry.abilityId === 'piercing-shot',
    );
    const rapidFireBreakdowns = result.explainability.damageBreakdowns.filter(
      (entry) => entry.abilityId === 'rapid-fire',
    );

    expect(result.buffTimeline[18]).toEqual(['searing-winds']);
    expect(rapidFireBreakdowns.every((entry) => entry.additiveModifiers.length === 1)).toBe(true);
    expect(piercingBreakdowns).toHaveLength(6);
    expect(piercingBreakdowns.every((entry) => entry.additiveModifiers.length === 1)).toBe(true);
  });

  it('fires Perfect Equilibrium on every 8th qualifying hit with Bow of the Last Guardian equipped', () => {
    const config = createConfig({
      abilityActions: [
        createAbilityAction('action-piercing-1', 0, 'piercing-shot'),
        createAbilityAction('action-piercing-2', 3, 'piercing-shot'),
        createAbilityAction('action-piercing-3', 6, 'piercing-shot'),
        createAbilityAction('action-piercing-4', 9, 'piercing-shot'),
      ],
      abilities: {
        'piercing-shot': createAbilityDefinition({
          id: 'piercing-shot',
          name: 'Piercing Shot',
          cooldownTicks: 3,
          adrenalineGain: 9,
          hitSchedule: [
            { id: 'hit-1', tickOffset: 0, damage: { min: 45, max: 55 } },
            { id: 'hit-2', tickOffset: 1, damage: { min: 45, max: 55 } },
          ],
          baseDamage: { min: 90, max: 110 },
        }),
      },
      startingAdrenaline: 100,
      tickCount: 16,
    });
    config.gameData.items['bolg'] = {
      ...config.gameData.items['bolg'],
      effectRefs: ['bolg-passive'],
    };

    const result = simulateBaseDamage(config);
    const passiveSummary = result.damageByAbility.find((entry) => entry.abilityId === 'perfect-equilibrium');
    const passiveBreakdown = result.explainability.damageBreakdowns.find(
      (entry) => entry.abilityId === 'perfect-equilibrium',
    );

    expect(passiveSummary).toBeTruthy();
    expect(passiveBreakdown?.tick).toBe(10);
    expect(result.damageByTick[10].avg).toBeGreaterThan(result.damageByTick[9].avg);
    expect(result.tickStates[10]?.hitsResolvingThisTick.some((hit) => hit.id.includes('perfect-equilibrium'))).toBe(true);
  });

  it('starts Bow of the Last Guardian from configured passive stacks', () => {
    const config = createConfig({
      abilityActions: [
        createAbilityAction('action-piercing-1', 0, 'piercing-shot'),
      ],
      abilities: {
        'piercing-shot': createAbilityDefinition({
          id: 'piercing-shot',
          name: 'Piercing Shot',
          cooldownTicks: 3,
          adrenalineGain: 9,
          hitSchedule: [
            { id: 'hit-1', tickOffset: 0, damage: { min: 45, max: 55 } },
            { id: 'hit-2', tickOffset: 1, damage: { min: 45, max: 55 } },
          ],
          baseDamage: { min: 90, max: 110 },
        }),
      },
      startingAdrenaline: 100,
      tickCount: 8,
    });
    config.rotationPlan.startingStacks = {
      perfectEquilibriumStacks: 6,
    };
    config.gameData.items['bolg'] = {
      ...config.gameData.items['bolg'],
      effectRefs: ['bolg-passive'],
    };

    const result = simulateBaseDamage(config);
    const passiveBreakdown = result.explainability.damageBreakdowns.find(
      (entry) => entry.abilityId === 'perfect-equilibrium',
    );

    expect(passiveBreakdown?.tick).toBe(1);
  });

  it('models Ricochet as three single-target hits across two ticks', () => {
    const config = createConfig({
      abilityActions: [createAbilityAction('action-ricochet', 0, 'ricochet')],
      abilities: {
        ricochet: createAbilityDefinition({
          id: 'ricochet',
          name: 'Ricochet',
          cooldownTicks: 17,
          adrenalineGain: 9,
          hitSchedule: [
            { id: 'hit-1', tickOffset: 0, damage: { min: 75, max: 85 } },
            { id: 'hit-2', tickOffset: 1, damage: { min: 15, max: 20 } },
            { id: 'hit-3', tickOffset: 1, damage: { min: 15, max: 20 } },
          ],
          baseDamage: { min: 105, max: 125 },
        }),
      },
      startingAdrenaline: 100,
      tickCount: 5,
    });

    const result = simulateBaseDamage(config);

    expect(result.explainability.damageBreakdowns).toHaveLength(3);
    expect(result.explainability.damageBreakdowns.map((entry) => entry.tick)).toEqual([0, 1, 1]);
  });

  it('applies Caroming as flat per-hit damage on Greater Ricochet', () => {
    const config = createConfig({
      abilityActions: [createAbilityAction('action-grico', 0, 'greater-ricochet')],
      abilities: {
        'greater-ricochet': createAbilityDefinition({
          id: 'greater-ricochet',
          name: 'Greater Ricochet',
          cooldownTicks: 17,
          adrenalineGain: 9,
          hitSchedule: [
            { id: 'hit-1', tickOffset: 0, damage: { min: 75, max: 85 } },
            { id: 'hit-2', tickOffset: 1, damage: { min: 15, max: 20 } },
            { id: 'hit-3', tickOffset: 1, damage: { min: 15, max: 20 } },
            { id: 'hit-4', tickOffset: 1, damage: { min: 4, max: 6 } },
            { id: 'hit-5', tickOffset: 1, damage: { min: 4, max: 6 } },
            { id: 'hit-6', tickOffset: 1, damage: { min: 4, max: 6 } },
            { id: 'hit-7', tickOffset: 1, damage: { min: 4, max: 6 } },
          ],
          baseDamage: { min: 121, max: 149 },
        }),
      },
      startingAdrenaline: 100,
      tickCount: 5,
    });
    config.gearSetup.equipment.weapon = {
      instanceId: 'weapon-1',
      definitionId: 'bolg',
      configuredPerks: [
        {
          socketIndex: 0,
          perkId: 'caroming',
          rank: 4,
        },
      ],
    };

    const result = simulateBaseDamage(config);
    const gricoBreakdowns = result.explainability.damageBreakdowns.filter(
      (entry) => entry.abilityId === 'greater-ricochet',
    );

    expect(gricoBreakdowns).toHaveLength(7);
    expect(gricoBreakdowns.every((entry) => entry.additiveModifiers.length === 1)).toBe(true);
    expect(gricoBreakdowns[0]?.additiveModifiers[0]).toEqual({
      sourceId: 'perk:caroming:4',
      label: 'Caroming 4 +16% ability damage',
      value: 282.24,
    });
  });

  it('lets Balance by Force lower Perfect Equilibrium to 4 stacks and trigger from its own hit', () => {
    const config = createConfig({
      abilityActions: [
        createAbilityAction('action-setup', 0, 'setup-shot'),
        createAbilityAction('action-bolg-special', 3, 'weapon-special-attack'),
      ],
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
          name: 'Weapon Special Attack',
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
      startingAdrenaline: 100,
      tickCount: 10,
    });
    config.gameData.items['bolg'] = {
      ...config.gameData.items['bolg'],
      effectRefs: ['bolg-passive', 'weapon-special-access', 'weapon-special:balance-by-force'],
    };

    const result = simulateBaseDamage(config);
    const specialSummary = result.damageByAbility.find((entry) => entry.abilityId === 'balance-by-force');
    const passiveSummary = result.damageByAbility.find((entry) => entry.abilityId === 'perfect-equilibrium');
    const passiveBreakdown = result.explainability.damageBreakdowns.find(
      (entry) => entry.abilityId === 'perfect-equilibrium',
    );

    expect(result.buffTimeline[3]).toEqual(['balance-by-force-buff']);
    expect(specialSummary).toBeTruthy();
    expect(passiveSummary).toBeTruthy();
    expect(passiveBreakdown?.tick).toBe(3);
    expect(passiveBreakdown?.baseDamage.max).toBeLessThan(5000);
  });

  it('lets Perfect Equilibrium inherit guaranteed crit from Shadow Tendrils', () => {
    const config = createConfig({
      abilityActions: [
        createAbilityAction('action-setup-1', 0, 'setup-shot'),
        createAbilityAction('action-setup-2', 3, 'setup-shot'),
        createAbilityAction('action-setup-3', 6, 'setup-shot'),
        createAbilityAction('action-shadow-tendrils', 9, 'shadow-tendrils'),
      ],
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
        'shadow-tendrils': createAbilityDefinition({
          id: 'shadow-tendrils',
          name: 'Shadow Tendrils',
          subtype: 'enhanced',
          cooldownTicks: 75,
          adrenalineCost: 0,
          hitSchedule: [
            { id: 'shadow-tendrils-hit', tickOffset: 0, damage: { min: 200, max: 270 } },
          ],
          baseDamage: { min: 200, max: 270 },
          effectRefs: ['critical-strike-chance:+100%', 'shadow-tendrils'],
        }),
      },
      startingAdrenaline: 100,
      tickCount: 16,
    });
    config.gameData.items['bolg'] = {
      ...config.gameData.items['bolg'],
      effectRefs: ['bolg-passive'],
    };

    const result = simulateBaseDamage(config);
    const passiveBreakdown = result.explainability.damageBreakdowns.find(
      (entry) => entry.abilityId === 'perfect-equilibrium',
    );

    expect(passiveBreakdown).toBeTruthy();
    expect(passiveBreakdown?.tick).toBe(7);
    expect((passiveBreakdown?.expectedValueModifiers.length ?? 0) > 0).toBe(true);
    expect((passiveBreakdown?.finalDamage.avg ?? 0)).toBeGreaterThan(passiveBreakdown?.baseDamage.avg ?? 0);
  });

  it('applies Ful arrows to non-bleed ranged ability damage', () => {
    const baselineConfig = createConfig({
      abilities: {
        'piercing-shot': createAbilityDefinition({
          id: 'piercing-shot',
          name: 'Piercing Shot',
          subtype: 'basic',
          cooldownTicks: 5,
          adrenalineGain: 9,
          hitSchedule: [{ id: 'piercing-shot-hit-1', tickOffset: 0, damage: { min: 90, max: 110 } }],
          baseDamage: { min: 90, max: 110 },
        }),
      },
      abilityActions: [createAbilityAction('action-piercing', 0, 'piercing-shot')],
      startingAdrenaline: 100,
      tickCount: 6,
    });

    const fulConfig = createConfig({
      abilities: baselineConfig.gameData.abilities,
      abilityActions: baselineConfig.rotationPlan.abilityActions,
      startingAdrenaline: 100,
      tickCount: 6,
    });
    fulConfig.gameData.items['ful-arrows'] = {
      id: 'ful-arrows',
      name: 'Ful arrows',
      category: 'ammo',
      slot: 'ammo',
      combatStyleTags: ['ranged'],
      effectRefs: ['ful-arrows-heat'],
    };
    fulConfig.gearSetup.equipment.ammo = {
      instanceId: 'ammo-1',
      definitionId: 'ful-arrows',
    };
    fulConfig.gearSetup.ammoSelection = fulConfig.gearSetup.equipment.ammo;

    const baselineResult = simulateBaseDamage(baselineConfig);
    const fulResult = simulateBaseDamage(fulConfig);
    const fulBreakdown = fulResult.explainability.damageBreakdowns[0];

    expect(fulBreakdown?.multiplicativeModifiers.map((entry) => entry.sourceId)).toContain('ful-arrows-heat');
    expect(fulResult.totalDamage.avg).toBeGreaterThan(baselineResult.totalDamage.avg);
    expect(fulResult.totalDamage.avg).toBeCloseTo(baselineResult.totalDamage.avg * 1.15, 1);
  });

  it('does not apply Ful arrows to bleed-tagged damage', () => {
    const baselineConfig = createConfig({
      abilities: {
        'corruption-shot': createAbilityDefinition({
          id: 'corruption-shot',
          name: 'Corruption Shot',
          subtype: 'enhanced',
          cooldownTicks: 25,
          adrenalineCost: 15,
          hitSchedule: [{ id: 'corruption-shot-hit-1', tickOffset: 0, damage: { min: 100, max: 100 } }],
          baseDamage: { min: 100, max: 100 },
          effectRefs: ['damage-over-time'],
        }),
      },
      abilityActions: [createAbilityAction('action-corruption', 0, 'corruption-shot')],
      startingAdrenaline: 100,
      tickCount: 6,
    });

    const fulConfig = createConfig({
      abilities: baselineConfig.gameData.abilities,
      abilityActions: baselineConfig.rotationPlan.abilityActions,
      startingAdrenaline: 100,
      tickCount: 6,
    });
    fulConfig.gameData.items['ful-arrows'] = {
      id: 'ful-arrows',
      name: 'Ful arrows',
      category: 'ammo',
      slot: 'ammo',
      combatStyleTags: ['ranged'],
      effectRefs: ['ful-arrows-heat'],
    };
    fulConfig.gearSetup.equipment.ammo = {
      instanceId: 'ammo-1',
      definitionId: 'ful-arrows',
    };
    fulConfig.gearSetup.ammoSelection = fulConfig.gearSetup.equipment.ammo;

    const baselineResult = simulateBaseDamage(baselineConfig);
    const fulResult = simulateBaseDamage(fulConfig);
    const fulBreakdown = fulResult.explainability.damageBreakdowns[0];

    expect(fulBreakdown?.multiplicativeModifiers.map((entry) => entry.sourceId)).not.toContain('ful-arrows-heat');
    expect(fulResult.totalDamage.avg).toBeCloseTo(baselineResult.totalDamage.avg, 2);
  });

  it("does not apply Death's Swiftness or Searing Winds to Corruption Shot", () => {
    const config = createConfig({
      abilities: {
        'deaths-swiftness': createAbilityDefinition({
          id: 'deaths-swiftness',
          name: "Death's Swiftness",
          subtype: 'ultimate',
          cooldownTicks: 100,
          adrenalineCost: 100,
          hitSchedule: [],
          baseDamage: { min: 0, max: 0 },
          timelineEffects: [
            {
              kind: 'apply-buff',
              buffId: 'deaths-swiftness-buff',
            },
          ],
        }),
        galeshot: createAbilityDefinition({
          id: 'galeshot',
          name: 'Galeshot',
          cooldownTicks: 34,
          adrenalineGain: 9,
          hitSchedule: [
            { id: 'galeshot-hit', tickOffset: 0, damage: { min: 90, max: 110 } },
          ],
          baseDamage: { min: 90, max: 110 },
          timelineEffects: [
            {
              kind: 'apply-buff',
              buffId: 'searing-winds',
            },
          ],
          effectRefs: ['searing-winds'],
        }),
        'corruption-shot': createAbilityDefinition({
          id: 'corruption-shot',
          name: 'Corruption Shot',
          subtype: 'basic',
          cooldownTicks: 25,
          adrenalineGain: 8,
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
      },
      buffs: {
        'deaths-swiftness-buff': {
          id: 'deaths-swiftness-buff',
          name: "Death's Swiftness",
          category: 'temporary',
          sourceType: 'ability',
          effectRefs: ['ranged-damage-multiplier:+50%'],
        },
        'searing-winds': {
          id: 'searing-winds',
          name: 'Searing Winds',
          category: 'temporary',
          sourceType: 'ability',
          effectRefs: ['ranged-hit-flat-bonus-ability-damage:+20%:cast-snapshot'],
        },
      },
      abilityActions: [
        createAbilityAction('action-swiftness', 0, 'deaths-swiftness'),
        createAbilityAction('action-galeshot', 3, 'galeshot'),
        createAbilityAction('action-corruption', 6, 'corruption-shot'),
      ],
      startingAdrenaline: 100,
      tickCount: 20,
    });

    const result = simulateBaseDamage(config);
    const corruptionBreakdowns = result.explainability.damageBreakdowns.filter(
      (entry) => entry.abilityId === 'corruption-shot',
    );

    expect(corruptionBreakdowns).toHaveLength(5);
    expect(corruptionBreakdowns.every((entry) => entry.additiveModifiers.length === 0)).toBe(true);
    expect(corruptionBreakdowns.every((entry) => entry.multiplicativeModifiers.length === 0)).toBe(true);
    expect(corruptionBreakdowns.every((entry) => entry.expectedValueModifiers.length === 0)).toBe(true);
  });

  it('applies Ful arrows to all modern Deadshot hits', () => {
    const baselineConfig = createConfig({
      abilities: {
        deadshot: createAbilityDefinition({
          id: 'deadshot',
          name: 'Deadshot',
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
      abilityActions: [createAbilityAction('action-deadshot', 0, 'deadshot')],
      startingAdrenaline: 100,
      tickCount: 6,
    });

    const fulConfig = createConfig({
      abilities: baselineConfig.gameData.abilities,
      abilityActions: baselineConfig.rotationPlan.abilityActions,
      startingAdrenaline: 100,
      tickCount: 6,
    });
    fulConfig.gameData.items['ful-arrows'] = {
      id: 'ful-arrows',
      name: 'Ful arrows',
      category: 'ammo',
      slot: 'ammo',
      combatStyleTags: ['ranged'],
      effectRefs: [EFFECT_REF_IDS.fulArrowsHeat],
    };
    fulConfig.gearSetup.equipment.ammo = {
      instanceId: 'ammo-1',
      definitionId: 'ful-arrows',
    };
    fulConfig.gearSetup.ammoSelection = fulConfig.gearSetup.equipment.ammo;

    const baselineResult = simulateBaseDamage(baselineConfig);
    const fulResult = simulateBaseDamage(fulConfig);
    const fulBreakdowns = fulResult.explainability.damageBreakdowns.filter((entry) => entry.abilityId === 'deadshot');

    expect(fulBreakdowns).toHaveLength(4);
    expect(
      fulBreakdowns.every((entry) => entry.multiplicativeModifiers.some((modifier) => modifier.sourceId === EFFECT_REF_IDS.fulArrowsHeat)),
    ).toBe(true);
    expect(fulResult.totalDamage.avg).toBeCloseTo(baselineResult.totalDamage.avg * 1.15, 1);
  });

  it('applies Ful arrows after a timeline gear swap equips them', () => {
    const config = createConfig({
      abilities: {
        'piercing-shot': createAbilityDefinition({
          id: 'piercing-shot',
          name: 'Piercing Shot',
          subtype: 'basic',
          cooldownTicks: 5,
          adrenalineGain: 9,
          hitSchedule: [{ id: 'piercing-shot-hit-1', tickOffset: 0, damage: { min: 90, max: 110 } }],
          baseDamage: { min: 90, max: 110 },
        }),
      },
      abilityActions: [createAbilityAction('action-piercing', 3, 'piercing-shot')],
      startingAdrenaline: 100,
      tickCount: 8,
    });

    config.gameData.items['ful-arrows'] = {
      id: 'ful-arrows',
      name: 'Ful arrows',
      category: 'ammo',
      slot: 'ammo',
      combatStyleTags: ['ranged'],
      effectRefs: [EFFECT_REF_IDS.fulArrowsHeat],
    };
    config.inventory.items = [
      {
        instanceId: 'ammo-ful',
        definitionId: 'ful-arrows',
      },
    ];
    config.rotationPlan.nonGcdActions = [
      {
        id: 'swap-ful',
        tick: 0,
        lane: 'non-gcd',
        actionType: 'gear-swap',
        payload: {
          templateId: 'gear-swap',
          instanceId: 'ammo-ful',
          definitionId: 'ful-arrows',
          slot: 'ammo',
        },
      },
    ];

    const result = simulateBaseDamage(config);
    const breakdown = result.explainability.damageBreakdowns[0];

    expect(breakdown?.multiplicativeModifiers.map((entry) => entry.sourceId)).toContain(EFFECT_REF_IDS.fulArrowsHeat);
  });

  it("multiplies Ful arrows and Death's Swiftness together", () => {
    const baselineConfig = createConfig({
      abilities: {
        'deaths-swiftness': createAbilityDefinition({
          id: 'deaths-swiftness',
          name: "Death's Swiftness",
          subtype: 'ultimate',
          cooldownTicks: 100,
          adrenalineCost: 100,
          hitSchedule: [],
          baseDamage: { min: 0, max: 0 },
          timelineEffects: [
            {
              kind: 'apply-buff',
              buffId: 'deaths-swiftness-buff',
            },
          ],
        }),
        'piercing-shot': createAbilityDefinition({
          id: 'piercing-shot',
          name: 'Piercing Shot',
          subtype: 'basic',
          cooldownTicks: 5,
          adrenalineGain: 9,
          hitSchedule: [{ id: 'piercing-shot-hit-1', tickOffset: 0, damage: { min: 90, max: 110 } }],
          baseDamage: { min: 90, max: 110 },
        }),
      },
      buffs: {
        'deaths-swiftness-buff': {
          id: 'deaths-swiftness-buff',
          name: "Death's Swiftness",
          category: 'temporary',
          sourceType: 'ability',
          effectRefs: ['ranged-damage-multiplier:+50%'],
        },
      },
      abilityActions: [
        createAbilityAction('action-swiftness', 0, 'deaths-swiftness'),
        createAbilityAction('action-piercing', 3, 'piercing-shot'),
      ],
      startingAdrenaline: 100,
      tickCount: 8,
    });

    const fulConfig = createConfig({
      abilities: baselineConfig.gameData.abilities,
      buffs: baselineConfig.gameData.buffs,
      abilityActions: baselineConfig.rotationPlan.abilityActions,
      startingAdrenaline: 100,
      tickCount: 8,
    });
    fulConfig.gameData.items['ful-arrows'] = {
      id: 'ful-arrows',
      name: 'Ful arrows',
      category: 'ammo',
      slot: 'ammo',
      combatStyleTags: ['ranged'],
      effectRefs: [EFFECT_REF_IDS.fulArrowsHeat],
    };
    fulConfig.gearSetup.equipment.ammo = {
      instanceId: 'ammo-1',
      definitionId: 'ful-arrows',
    };
    fulConfig.gearSetup.ammoSelection = fulConfig.gearSetup.equipment.ammo;

    const baselineResult = simulateBaseDamage(baselineConfig);
    const fulResult = simulateBaseDamage(fulConfig);
    const fulBreakdown = fulResult.explainability.damageBreakdowns.find((entry) => entry.abilityId === 'piercing-shot');

    expect(fulBreakdown?.multiplicativeModifiers.map((entry) => entry.sourceId)).toEqual(
      expect.arrayContaining([EFFECT_REF_IDS.fulArrowsHeat, 'ranged-damage-multiplier:+50%']),
    );
    expect(fulResult.totalDamage.avg).toBeCloseTo(baselineResult.totalDamage.avg * 1.15, 1);
  });

  it("applies flat added damage after Death's Swiftness instead of multiplying the flat bonus", () => {
    const createSearingConfig = (includeDeathsSwiftness: boolean) =>
      createConfig({
        abilities: {
          ...(includeDeathsSwiftness
            ? {
                'deaths-swiftness': createAbilityDefinition({
                  id: 'deaths-swiftness',
                  name: "Death's Swiftness",
                  subtype: 'ultimate',
                  cooldownTicks: 100,
                  adrenalineCost: 100,
                  hitSchedule: [],
                  baseDamage: { min: 0, max: 0 },
                  timelineEffects: [
                    {
                      kind: 'apply-buff',
                      buffId: 'deaths-swiftness-buff',
                    },
                  ],
                }),
              }
            : {}),
          galeshot: createAbilityDefinition({
            id: 'galeshot',
            name: 'Galeshot',
            cooldownTicks: 34,
            adrenalineGain: 9,
            hitSchedule: [{ id: 'galeshot-hit', tickOffset: 0, damage: { min: 90, max: 110 } }],
            baseDamage: { min: 90, max: 110 },
            timelineEffects: [
              {
                kind: 'apply-buff',
                buffId: 'searing-winds',
              },
            ],
            effectRefs: ['searing-winds'],
          }),
          'piercing-shot': createAbilityDefinition({
            id: 'piercing-shot',
            name: 'Piercing Shot',
            subtype: 'basic',
            cooldownTicks: 5,
            adrenalineGain: 9,
            hitSchedule: [{ id: 'piercing-shot-hit-1', tickOffset: 0, damage: { min: 90, max: 110 } }],
            baseDamage: { min: 90, max: 110 },
          }),
        },
        buffs: {
          ...(includeDeathsSwiftness
            ? {
                'deaths-swiftness-buff': {
                  id: 'deaths-swiftness-buff',
                  name: "Death's Swiftness",
                  category: 'temporary',
                  sourceType: 'ability',
                  effectRefs: ['ranged-damage-multiplier:+50%'],
                },
              }
            : {}),
          'searing-winds': {
            id: 'searing-winds',
            name: 'Searing Winds',
            category: 'temporary',
            sourceType: 'ability',
            effectRefs: ['ranged-hit-flat-bonus-ability-damage:+20%:cast-snapshot'],
          },
        },
        abilityActions: [
          ...(includeDeathsSwiftness ? [createAbilityAction('action-swiftness', 0, 'deaths-swiftness')] : []),
          createAbilityAction('action-galeshot', includeDeathsSwiftness ? 3 : 0, 'galeshot'),
          createAbilityAction('action-piercing', includeDeathsSwiftness ? 6 : 3, 'piercing-shot'),
        ],
        startingAdrenaline: 100,
        tickCount: 12,
      });

    const baselineResult = simulateBaseDamage(createSearingConfig(false));
    const swiftnessResult = simulateBaseDamage(createSearingConfig(true));
    const baselineBreakdown = baselineResult.explainability.damageBreakdowns.find((entry) => entry.abilityId === 'piercing-shot');
    const swiftnessBreakdown = swiftnessResult.explainability.damageBreakdowns.find((entry) => entry.abilityId === 'piercing-shot');

    expect(baselineBreakdown).toBeTruthy();
    expect(swiftnessBreakdown).toBeTruthy();

    const baseAverage = baselineBreakdown!.baseDamage.avg;
    const additiveAverage = baselineBreakdown!.additiveModifiers.reduce((sum, entry) => sum + entry.value, 0);
    const baselineExpectedValue = baselineBreakdown!.expectedValueModifiers.reduce((sum, entry) => sum + entry.value, 0);
    const swiftnessExpectedValue = swiftnessBreakdown!.expectedValueModifiers.reduce((sum, entry) => sum + entry.value, 0);
    const observedDelta =
      swiftnessBreakdown!.finalDamage.avg - baselineBreakdown!.finalDamage.avg - (swiftnessExpectedValue - baselineExpectedValue);

    expect(swiftnessBreakdown!.multiplicativeModifiers.map((entry) => entry.sourceId)).toContain('ranged-damage-multiplier:+50%');
    expect(observedDelta).toBeCloseTo(baseAverage * 0.5, 2);
    expect(observedDelta).not.toBeCloseTo((baseAverage + additiveAverage) * 0.5, 2);
  });

  it('applies Ful arrows to the ability-damage portion of Perfect Equilibrium', () => {
    const baselineConfig = createConfig({
      abilityActions: [
        createAbilityAction('action-piercing-1', 0, 'piercing-shot'),
        createAbilityAction('action-piercing-2', 3, 'piercing-shot'),
        createAbilityAction('action-piercing-3', 6, 'piercing-shot'),
        createAbilityAction('action-piercing-4', 9, 'piercing-shot'),
      ],
      abilities: {
        'piercing-shot': createAbilityDefinition({
          id: 'piercing-shot',
          name: 'Piercing Shot',
          cooldownTicks: 3,
          adrenalineGain: 9,
          hitSchedule: [
            { id: 'hit-1', tickOffset: 0, damage: { min: 45, max: 55 } },
            { id: 'hit-2', tickOffset: 1, damage: { min: 45, max: 55 } },
          ],
          baseDamage: { min: 90, max: 110 },
        }),
      },
      startingAdrenaline: 100,
      tickCount: 16,
    });
    baselineConfig.gameData.items['bolg'] = {
      ...baselineConfig.gameData.items['bolg'],
      effectRefs: [EFFECT_REF_IDS.bolgPassive],
    };

    const fulConfig = createConfig({
      abilities: baselineConfig.gameData.abilities,
      abilityActions: baselineConfig.rotationPlan.abilityActions,
      startingAdrenaline: 100,
      tickCount: 16,
    });
    fulConfig.gameData.items['bolg'] = {
      ...baselineConfig.gameData.items['bolg'],
      effectRefs: [EFFECT_REF_IDS.bolgPassive],
    };
    fulConfig.gameData.items['ful-arrows'] = {
      id: 'ful-arrows',
      name: 'Ful arrows',
      category: 'ammo',
      slot: 'ammo',
      combatStyleTags: ['ranged'],
      effectRefs: [EFFECT_REF_IDS.fulArrowsHeat],
    };
    fulConfig.gearSetup.equipment.ammo = {
      instanceId: 'ammo-1',
      definitionId: 'ful-arrows',
    };
    fulConfig.gearSetup.ammoSelection = fulConfig.gearSetup.equipment.ammo;

    const baselineResult = simulateBaseDamage(baselineConfig);
    const fulResult = simulateBaseDamage(fulConfig);
    const baselinePassive = baselineResult.explainability.damageBreakdowns.find(
      (entry) => entry.abilityId === 'perfect-equilibrium',
    );
    const fulPassive = fulResult.explainability.damageBreakdowns.find(
      (entry) => entry.abilityId === 'perfect-equilibrium',
    );

    expect(baselinePassive).toBeTruthy();
    expect(fulPassive).toBeTruthy();
    expect(fulPassive!.baseDamage).toEqual(baselinePassive!.baseDamage);
    expect(fulPassive!.multiplicativeModifiers.map((entry) => entry.sourceId)).toContain(EFFECT_REF_IDS.fulArrowsHeat);
  });

  it("applies Death's Swiftness to Perfect Equilibrium once, not twice", () => {
    const createPerfectEquilibriumConfig = (includeDeathsSwiftness: boolean) =>
      createConfig({
        abilities: {
          ...(includeDeathsSwiftness
            ? {
                'deaths-swiftness': createAbilityDefinition({
                  id: 'deaths-swiftness',
                  name: "Death's Swiftness",
                  subtype: 'ultimate',
                  cooldownTicks: 100,
                  adrenalineCost: 100,
                  hitSchedule: [],
                  baseDamage: { min: 0, max: 0 },
                  timelineEffects: [
                    {
                      kind: 'apply-buff',
                      buffId: 'deaths-swiftness-buff',
                    },
                  ],
                }),
              }
            : {}),
          'piercing-shot': createAbilityDefinition({
            id: 'piercing-shot',
            name: 'Piercing Shot',
            cooldownTicks: 3,
            adrenalineGain: 9,
            hitSchedule: [
              { id: 'hit-1', tickOffset: 0, damage: { min: 45, max: 55 } },
              { id: 'hit-2', tickOffset: 1, damage: { min: 45, max: 55 } },
            ],
            baseDamage: { min: 90, max: 110 },
          }),
        },
        buffs: includeDeathsSwiftness
          ? {
              'deaths-swiftness-buff': {
                id: 'deaths-swiftness-buff',
                name: "Death's Swiftness",
                category: 'temporary',
                sourceType: 'ability',
                effectRefs: ['ranged-damage-multiplier:+50%'],
              },
            }
          : {},
        abilityActions: [
          ...(includeDeathsSwiftness ? [createAbilityAction('action-swiftness', 0, 'deaths-swiftness')] : []),
          createAbilityAction('action-piercing-1', includeDeathsSwiftness ? 3 : 0, 'piercing-shot'),
          createAbilityAction('action-piercing-2', includeDeathsSwiftness ? 6 : 3, 'piercing-shot'),
          createAbilityAction('action-piercing-3', includeDeathsSwiftness ? 9 : 6, 'piercing-shot'),
          createAbilityAction('action-piercing-4', includeDeathsSwiftness ? 12 : 9, 'piercing-shot'),
        ],
        startingAdrenaline: 100,
        tickCount: 20,
      });

    const swiftnessConfig = createPerfectEquilibriumConfig(true);
    const baselineConfig = createPerfectEquilibriumConfig(false);
    baselineConfig.gameData.items['bolg'] = {
      ...baselineConfig.gameData.items['bolg'],
      effectRefs: [EFFECT_REF_IDS.bolgPassive],
    };
    swiftnessConfig.gameData.items['bolg'] = {
      ...swiftnessConfig.gameData.items['bolg'],
      effectRefs: [EFFECT_REF_IDS.bolgPassive],
    };

    const baselineResult = simulateBaseDamage(baselineConfig);
    const swiftnessResult = simulateBaseDamage(swiftnessConfig);
    const baselinePassive = baselineResult.explainability.damageBreakdowns.find(
      (entry) => entry.abilityId === 'perfect-equilibrium',
    );
    const swiftnessPassive = swiftnessResult.explainability.damageBreakdowns.find(
      (entry) => entry.abilityId === 'perfect-equilibrium',
    );

    expect(baselinePassive).toBeTruthy();
    expect(swiftnessPassive).toBeTruthy();
    expect(swiftnessPassive!.baseDamage).toEqual(baselinePassive!.baseDamage);
    expect(swiftnessPassive!.multiplicativeModifiers.map((entry) => entry.sourceId)).toContain('ranged-damage-multiplier:+50%');
    expect(swiftnessPassive!.finalDamage.avg).toBeCloseTo(baselinePassive!.finalDamage.avg * 1.5, 1);
  });

  it('applies Precise to the base damage range before later modifiers', () => {
    const baselineConfig = createConfig({
      abilities: {
        ranged: createAbilityDefinition({
          id: 'ranged',
          name: 'Ranged',
          cooldownTicks: 0,
          adrenalineGain: 8,
          hitSchedule: [{ id: 'ranged-hit', tickOffset: 0, damage: { min: 95, max: 105 } }],
          baseDamage: { min: 95, max: 105 },
        }),
      },
      abilityActions: [createAbilityAction('action-ranged', 0, 'ranged')],
      startingAdrenaline: 0,
      tickCount: 3,
    });
    const preciseConfig = createConfig({
      abilities: baselineConfig.gameData.abilities,
      abilityActions: baselineConfig.rotationPlan.abilityActions,
      startingAdrenaline: 0,
      tickCount: 3,
      perks: {
        precise: {
          id: 'precise',
          name: 'Precise',
          effectRefs: ['precise'],
        },
      },
      weaponConfiguredPerks: [{ socketIndex: 0, perkId: 'precise', rank: 6 }],
    });

    const baselineResult = simulateBaseDamage(baselineConfig);
    const preciseResult = simulateBaseDamage(preciseConfig);
    const baselineHit = baselineResult.explainability.damageBreakdowns[0];
    const preciseHit = preciseResult.explainability.damageBreakdowns[0];

    expect(preciseHit.baseDamage.max).toBe(baselineHit.baseDamage.max);
    expect(preciseHit.baseDamage.min).toBeGreaterThan(baselineHit.baseDamage.min);
    expect(preciseHit.finalDamage.avg).toBeGreaterThan(baselineHit.finalDamage.avg);
  });

  it('applies Dragon Slayer only when the matching conditional buff is active', () => {
    const createSlayerConfig = (active: boolean) =>
      createConfig({
        abilities: {
          ranged: createAbilityDefinition({
            id: 'ranged',
            name: 'Ranged',
            cooldownTicks: 0,
            adrenalineGain: 8,
            hitSchedule: [{ id: 'ranged-hit', tickOffset: 0, damage: { min: 95, max: 105 } }],
            baseDamage: { min: 95, max: 105 },
          }),
        },
        buffs: active
          ? {
              'dragon-slayer-active': {
                id: 'dragon-slayer-active',
                name: 'Dragon Slayer active',
                category: 'passive',
                sourceType: 'perk',
                isPermanent: true,
                effectRefs: ['dragon-slayer-active'],
              },
            }
          : {},
        abilityActions: [createAbilityAction('action-ranged', 0, 'ranged')],
        startingAdrenaline: 0,
        tickCount: 3,
        activeBuffIds: active ? ['dragon-slayer-active'] : [],
        perks: {
          'dragon-slayer': {
            id: 'dragon-slayer',
            name: 'Dragon Slayer',
            effectRefs: ['dragon-slayer'],
          },
        },
        weaponConfiguredPerks: [{ socketIndex: 0, perkId: 'dragon-slayer', rank: 1 }],
      });

    const inactiveResult = simulateBaseDamage(createSlayerConfig(false));
    const activeResult = simulateBaseDamage(createSlayerConfig(true));

    expect(activeResult.totalDamage.avg).toBeCloseTo(inactiveResult.totalDamage.avg * 1.07, 2);
  });

  it('applies Ultimatums as a multiplicative damage increase to ultimate abilities', () => {
    const createUltimatumsConfig = (withPerk: boolean) =>
      createConfig({
        abilities: {
          unload: createAbilityDefinition({
            id: 'unload',
            name: 'Unload',
            subtype: 'ultimate',
            cooldownTicks: 60,
            adrenalineCost: 100,
            hitSchedule: [{ id: 'unload-hit', tickOffset: 0, damage: { min: 120, max: 240 } }],
            baseDamage: { min: 120, max: 240 },
          }),
        },
        abilityActions: [createAbilityAction('action-unload', 0, 'unload')],
        startingAdrenaline: 100,
        tickCount: 4,
        perks: withPerk
          ? {
              ultimatums: {
                id: 'ultimatums',
                name: 'Ultimatums',
                effectRefs: [EFFECT_REF_IDS.ultimatums],
              },
            }
          : {},
        weaponConfiguredPerks: withPerk
          ? [{ socketIndex: 0, perkId: 'ultimatums', rank: 4 }]
          : undefined,
      });

    const baselineResult = simulateBaseDamage(createUltimatumsConfig(false));
    const perkResult = simulateBaseDamage(createUltimatumsConfig(true));
    const perkBreakdown = perkResult.explainability.damageBreakdowns[0];

    expect(perkBreakdown?.multiplicativeModifiers.map((entry) => entry.sourceId)).toContain(
      EFFECT_REF_IDS.ultimatums,
    );
    expect(perkResult.totalDamage.avg).toBeCloseTo(baselineResult.totalDamage.avg * 1.07, 2);
  });

  it('applies Equilibrium damage while equipped and prevents crits completely', () => {
    const createEquilibriumConfig = (withPerk: boolean) =>
      createConfig({
        abilities: {
          ranged: createAbilityDefinition({
            id: 'ranged',
            name: 'Ranged',
            cooldownTicks: 0,
            adrenalineGain: 8,
            hitSchedule: [{ id: 'ranged-hit', tickOffset: 0, damage: { min: 100, max: 100 } }],
            baseDamage: { min: 100, max: 100 },
            effectRefs: ['critical-strike-chance:+100%'],
          }),
        },
        abilityActions: [createAbilityAction('action-ranged', 0, 'ranged')],
        startingAdrenaline: 0,
        tickCount: 3,
        perks: withPerk
          ? {
              equilibrium: {
                id: 'equilibrium',
                name: 'Equilibrium',
                effectRefs: [EFFECT_REF_IDS.equilibrium],
              },
            }
          : {},
        weaponConfiguredPerks: withPerk
          ? [{ socketIndex: 0, perkId: 'equilibrium', rank: 4 }]
          : undefined,
      });

    const baselineResult = simulateBaseDamage(createEquilibriumConfig(false));
    const perkResult = simulateBaseDamage(createEquilibriumConfig(true));
    const perkBreakdown = perkResult.explainability.damageBreakdowns[0];

    expect(perkBreakdown?.multiplicativeModifiers.map((entry) => entry.sourceId)).toContain(
      EFFECT_REF_IDS.equilibrium,
    );
    expect(perkBreakdown?.expectedValueModifiers).toEqual([]);
    expect(perkResult.totalDamage.avg).toBeLessThan(baselineResult.totalDamage.avg);
    expect(perkBreakdown?.finalDamage.avg).toBeCloseTo((perkBreakdown?.baseDamage.avg ?? 0) * 1.14, 2);
  });

  it('keeps the Equilibrium anti-crit cooldown after a gear swap removes the perk', () => {
    const config = createConfig({
      abilities: {
        ranged: createAbilityDefinition({
          id: 'ranged',
          name: 'Ranged',
          cooldownTicks: 0,
          adrenalineGain: 8,
          hitSchedule: [{ id: 'ranged-hit', tickOffset: 0, damage: { min: 100, max: 100 } }],
          baseDamage: { min: 100, max: 100 },
          effectRefs: ['critical-strike-chance:+100%'],
        }),
      },
      buffs: {
        'equilibrium-cooldown': {
          id: 'equilibrium-cooldown',
          name: 'Equilibrium cooldown',
          category: 'temporary',
          sourceType: 'perk',
          effectRefs: [EFFECT_REF_IDS.equilibriumCooldown],
        },
      },
      abilityActions: [createAbilityAction('action-ranged', 1, 'ranged')],
      startingAdrenaline: 0,
      tickCount: 6,
      perks: {
        equilibrium: {
          id: 'equilibrium',
          name: 'Equilibrium',
          effectRefs: [EFFECT_REF_IDS.equilibrium],
        },
      },
      weaponConfiguredPerks: [{ socketIndex: 0, perkId: 'equilibrium', rank: 4 }],
    });

    config.inventory.items = [
      {
        instanceId: 'weapon-2',
        definitionId: 'bolg',
      },
    ];
    config.rotationPlan.nonGcdActions = [
      {
        id: 'swap-weapon',
        tick: 0,
        lane: 'non-gcd',
        actionType: 'gear-swap',
        payload: {
          instanceId: 'weapon-2',
          slot: 'weapon',
        },
      },
    ];

    const result = simulateBaseDamage(config);
    const breakdown = result.explainability.damageBreakdowns[0];

    expect(result.buffTimeline[1]).toContain('equilibrium-cooldown');
    expect(breakdown?.multiplicativeModifiers.map((entry) => entry.sourceId)).not.toContain(
      EFFECT_REF_IDS.equilibrium,
    );
    expect(breakdown?.expectedValueModifiers).toEqual([]);
    expect(result.totalDamage.avg).toBe(breakdown?.baseDamage.avg);
  });

  it('triggers Aftershock after 50,000 qualifying weapon damage with no carry-over', () => {
    const config = createConfig({
      abilities: {
        ranged: createAbilityDefinition({
          id: 'ranged',
          name: 'Ranged',
          cooldownTicks: 0,
          adrenalineGain: 8,
          hitSchedule: [{ id: 'ranged-hit', tickOffset: 0, damage: { min: 1000, max: 1000 } }],
          baseDamage: { min: 1000, max: 1000 },
        }),
      },
      abilityActions: [
        createAbilityAction('action-ranged-1', 0, 'ranged'),
        createAbilityAction('action-ranged-2', 3, 'ranged'),
        createAbilityAction('action-ranged-3', 6, 'ranged'),
      ],
      startingAdrenaline: 0,
      tickCount: 10,
      perks: {
        aftershock: {
          id: 'aftershock',
          name: 'Aftershock',
          effectRefs: [EFFECT_REF_IDS.aftershock],
        },
      },
      weaponConfiguredPerks: [{ socketIndex: 0, perkId: 'aftershock', rank: 4 }],
    });

    const result = simulateBaseDamage(config);
    const aftershockHits = result.explainability.damageBreakdowns.filter((entry) => entry.abilityId === 'aftershock');

    expect(aftershockHits).toHaveLength(1);
    expect(aftershockHits[0]?.tick).toBe(6);
    expect(aftershockHits[0]?.expectedValueModifiers).toEqual([]);
    expect(aftershockHits[0]?.baseDamage).toEqual({
      min: 1693.44,
      avg: 2243.81,
      max: 2794.18,
    });
  });

  it('lets Perfect Equilibrium contribute to Aftershock charge but excludes Crackling', () => {
    const config = createConfig({
      abilities: {
        'piercing-shot': createAbilityDefinition({
          id: 'piercing-shot',
          name: 'Piercing Shot',
          cooldownTicks: 3,
          adrenalineGain: 8,
          hitSchedule: [
            { id: 'hit-1', tickOffset: 0, damage: { min: 390, max: 390 } },
            { id: 'hit-2', tickOffset: 1, damage: { min: 390, max: 390 } },
          ],
          baseDamage: { min: 780, max: 780 },
        }),
      },
      abilityActions: [
        createAbilityAction('action-ranged-1', 0, 'piercing-shot'),
        createAbilityAction('action-ranged-2', 3, 'piercing-shot'),
        createAbilityAction('action-ranged-3', 6, 'piercing-shot'),
        createAbilityAction('action-ranged-4', 9, 'piercing-shot'),
      ],
      startingAdrenaline: 0,
      tickCount: 14,
      perks: {
        aftershock: {
          id: 'aftershock',
          name: 'Aftershock',
          effectRefs: [EFFECT_REF_IDS.aftershock],
        },
        crackling: {
          id: 'crackling',
          name: 'Crackling',
          effectRefs: [EFFECT_REF_IDS.crackling],
        },
      },
      weaponConfiguredPerks: [
        { socketIndex: 0, perkId: 'aftershock', rank: 4 },
        { socketIndex: 1, perkId: 'crackling', rank: 4 },
      ],
    });
    config.gameData.items['bolg'] = {
      ...config.gameData.items['bolg'],
      effectRefs: [EFFECT_REF_IDS.bolgPassive],
    };

    const result = simulateBaseDamage(config);
    const aftershockHits = result.explainability.damageBreakdowns.filter((entry) => entry.abilityId === 'aftershock');
    const cracklingHits = result.explainability.damageBreakdowns.filter((entry) => entry.abilityId === 'crackling');
    const perfectEquilibriumHit = result.explainability.damageBreakdowns.find(
      (entry) => entry.abilityId === 'perfect-equilibrium',
    );

    expect(perfectEquilibriumHit).toBeTruthy();
    expect(cracklingHits).toHaveLength(1);
    expect(aftershockHits).toHaveLength(1);
    expect(aftershockHits[0]?.tick).toBe(9);
  });

  it('resets Aftershock stored damage when swapping to a weapon without the perk', () => {
    const config = createConfig({
      abilities: {
        ranged: createAbilityDefinition({
          id: 'ranged',
          name: 'Ranged',
          cooldownTicks: 0,
          adrenalineGain: 8,
          hitSchedule: [{ id: 'ranged-hit', tickOffset: 0, damage: { min: 100, max: 100 } }],
          baseDamage: { min: 100, max: 100 },
        }),
      },
      abilityActions: [
        createAbilityAction('action-ranged-1', 0, 'ranged'),
        createAbilityAction('action-ranged-2', 3, 'ranged'),
        createAbilityAction('action-ranged-3', 6, 'ranged'),
      ],
      startingAdrenaline: 0,
      tickCount: 10,
      perks: {
        aftershock: {
          id: 'aftershock',
          name: 'Aftershock',
          effectRefs: [EFFECT_REF_IDS.aftershock],
        },
      },
      weaponConfiguredPerks: [{ socketIndex: 0, perkId: 'aftershock', rank: 4 }],
    });
    config.inventory.items = [
      {
        instanceId: 'weapon-2',
        definitionId: 'bolg',
      },
    ];
    config.rotationPlan.nonGcdActions = [
      {
        id: 'swap-weapon',
        tick: 1,
        lane: 'non-gcd',
        actionType: 'gear-swap',
        payload: {
          instanceId: 'weapon-2',
          slot: 'weapon',
        },
      },
    ];

    const result = simulateBaseDamage(config);
    const aftershockHits = result.explainability.damageBreakdowns.filter((entry) => entry.abilityId === 'aftershock');

    expect(aftershockHits).toHaveLength(0);
  });

  it('triggers Crackling on the next qualifying hit and respects its cooldown', () => {
    const config = createConfig({
      abilities: {
        ranged: createAbilityDefinition({
          id: 'ranged',
          name: 'Ranged',
          cooldownTicks: 0,
          adrenalineGain: 8,
          hitSchedule: [{ id: 'ranged-hit', tickOffset: 0, damage: { min: 95, max: 105 } }],
          baseDamage: { min: 95, max: 105 },
        }),
      },
      abilityActions: [
        createAbilityAction('action-ranged-1', 0, 'ranged'),
        createAbilityAction('action-ranged-2', 3, 'ranged'),
      ],
      startingAdrenaline: 0,
      tickCount: 8,
      perks: {
        crackling: {
          id: 'crackling',
          name: 'Crackling',
          effectRefs: ['crackling'],
        },
      },
      weaponConfiguredPerks: [{ socketIndex: 0, perkId: 'crackling', rank: 4 }],
    });

    const result = simulateBaseDamage(config);
    const cracklingHits = result.explainability.damageBreakdowns.filter((entry) => entry.abilityId === 'crackling');

    expect(cracklingHits).toHaveLength(1);
    expect(cracklingHits[0]?.tick).toBe(0);
  });

  it('applies Vulnerability Bomb only after the delayed area appears', () => {
    const createVulnerabilityConfig = (withBomb: boolean) =>
      createConfig({
        abilities: {
          'piercing-shot': createAbilityDefinition({
            id: 'piercing-shot',
            name: 'Piercing Shot',
            cooldownTicks: 3,
            adrenalineGain: 9,
            hitSchedule: [{ id: 'hit-1', tickOffset: 0, damage: { min: 100, max: 100 } }],
            baseDamage: { min: 100, max: 100 },
          }),
        },
        buffs: {
          'vulnerability-bomb-area': {
            id: 'vulnerability-bomb-area',
            name: 'Area',
            category: 'temporary',
            sourceType: 'item',
            effectRefs: [],
          },
          vulnerability: {
            id: 'vulnerability',
            name: 'Debuff',
            category: 'temporary',
            sourceType: 'item',
            effectRefs: ['target-damage-taken:+10%'],
          },
        },
        abilityActions: [createAbilityAction('action-piercing', 4, 'piercing-shot')],
        startingAdrenaline: 100,
        tickCount: 12,
      });

    const baselineConfig = createVulnerabilityConfig(false);
    const bombConfig = createVulnerabilityConfig(true);
    bombConfig.rotationPlan.nonGcdActions = [
      {
        id: 'bomb-1',
        tick: 0,
        lane: 'non-gcd',
        actionType: 'vulnerability-bomb',
        payload: {
          label: 'Vulnerability Bomb',
        },
      },
    ];

    const baselineResult = simulateBaseDamage(baselineConfig);
    const bombResult = simulateBaseDamage(bombConfig);

    expect(bombResult.totalDamage.avg).toBeCloseTo(baselineResult.totalDamage.avg * 1.1, 2);
    expect(bombResult.buffTimeline[4]).toContain('vulnerability');
    expect(bombResult.buffTimeline[4]).toContain('vulnerability-bomb-area');
  });

  it('adds Split Soul damage on the same tick as the source hit', () => {
    const config = createConfig({
      items: {
        'eldritch-crossbow': {
          id: 'eldritch-crossbow',
          name: 'Eldritch crossbow',
          category: 'weapon',
          slot: 'weapon',
          combatStyleTags: ['ranged'],
          specialAbilityId: 'split-soul',
          tier: 92,
          offensiveStats: {
            damageTier: 92,
          },
          effectRefs: ['weapon-special-access', 'weapon-special:split-soul'],
        },
      },
      equipment: {
        weapon: {
          instanceId: 'ecb-1',
          definitionId: 'eldritch-crossbow',
        },
      },
      abilities: {
        'weapon-special-attack': createAbilityDefinition({
          id: 'weapon-special-attack',
          name: 'Special Attack',
          style: 'constitution',
          subtype: 'special',
          cooldownTicks: 0,
          adrenalineCost: 25,
          hitSchedule: [],
          baseDamage: { min: 0, max: 0 },
          specialDispatch: {
            source: 'equipped-weapon',
          },
        }),
        'piercing-shot': createAbilityDefinition({
          id: 'piercing-shot',
          name: 'Piercing Shot',
          cooldownTicks: 3,
          adrenalineGain: 9,
          hitSchedule: [
            { id: 'hit-1', tickOffset: 0, damage: { min: 100, max: 100 } },
          ],
          baseDamage: { min: 100, max: 100 },
        }),
      },
      buffs: {
        'split-soul': {
          id: 'split-soul',
          name: 'Split Soul',
          category: 'temporary',
          sourceType: 'ability',
          durationTicks: 25,
        },
      },
      abilityActions: [
        createAbilityAction('ecb-spec', 0, 'weapon-special-attack'),
        createAbilityAction('piercing-1', 1, 'piercing-shot'),
      ],
      startingAdrenaline: 100,
      tickCount: 8,
    });

    const result = simulateBaseDamage(config);
    const splitSoulBreakdown = result.explainability.damageBreakdowns.find(
      (entry) => entry.abilityId === 'split-soul',
    );
    const piercingBreakdown = result.explainability.damageBreakdowns.find(
      (entry) => entry.abilityId === 'piercing-shot',
    );

    expect(piercingBreakdown?.tick).toBe(1);
    expect(splitSoulBreakdown?.tick).toBe(1);
    expect(splitSoulBreakdown?.finalDamage.min).toBeCloseTo(
      calculateExpectedSplitSoulDamage(piercingBreakdown?.finalDamage.min ?? 0),
      2,
    );
    expect(splitSoulBreakdown?.finalDamage.avg).toBeCloseTo(
      calculateExpectedSplitSoulDamage(piercingBreakdown?.finalDamage.avg ?? 0),
      2,
    );
    expect(splitSoulBreakdown?.finalDamage.max).toBeCloseTo(
      calculateExpectedSplitSoulDamage(piercingBreakdown?.finalDamage.max ?? 0),
      2,
    );
  });

  it('applies the average Amulet of Souls boost to Split Soul damage', () => {
    const createSplitSoulConfig = (definitionId?: string) =>
      createConfig({
        items: {
          'eldritch-crossbow': {
            id: 'eldritch-crossbow',
            name: 'Eldritch crossbow',
            category: 'weapon',
            slot: 'weapon',
            combatStyleTags: ['ranged'],
            specialAbilityId: 'split-soul',
            tier: 92,
            offensiveStats: {
              damageTier: 92,
            },
            effectRefs: ['weapon-special-access', 'weapon-special:split-soul'],
          },
          'amulet-of-souls': {
            id: 'amulet-of-souls',
            name: 'Amulet of souls',
            category: 'jewellery',
            slot: 'amulet',
            combatStyleTags: ['ranged'],
            effectRefs: ['amulet-of-souls-passive'],
          },
          'essence-of-finality': {
            id: 'essence-of-finality',
            name: 'Essence of Finality amulet',
            category: 'jewellery',
            slot: 'amulet',
            combatStyleTags: ['ranged'],
            effectRefs: ['amulet-of-souls-passive', 'eof-special-access'],
          },
        },
        equipment: {
          weapon: {
            instanceId: 'ecb-1',
            definitionId: 'eldritch-crossbow',
          },
          ...(definitionId
            ? {
                amulet: {
                  instanceId: 'amulet-1',
                  definitionId,
                },
              }
            : {}),
        },
        abilities: {
          'weapon-special-attack': createAbilityDefinition({
            id: 'weapon-special-attack',
            name: 'Special Attack',
            style: 'constitution',
            subtype: 'special',
            cooldownTicks: 0,
            adrenalineCost: 25,
            hitSchedule: [],
            baseDamage: { min: 0, max: 0 },
            specialDispatch: {
              source: 'equipped-weapon',
            },
          }),
          ranged: createAbilityDefinition({
            id: 'ranged',
            name: 'Ranged',
            cooldownTicks: 3,
            adrenalineGain: 9,
            hitSchedule: [{ id: 'ranged-hit', tickOffset: 0, damage: { min: 100, max: 100 } }],
            baseDamage: { min: 100, max: 100 },
          }),
        },
        buffs: {
          'split-soul': {
            id: 'split-soul',
            name: 'Split Soul',
            category: 'temporary',
            sourceType: 'ability',
            durationTicks: 25,
          },
        },
        abilityActions: [
          createAbilityAction('ecb-spec', 0, 'weapon-special-attack'),
          createAbilityAction('ranged-1', 1, 'ranged'),
        ],
        startingAdrenaline: 100,
        tickCount: 8,
      });

    const baseline = simulateBaseDamage(createSplitSoulConfig());
    const withAos = simulateBaseDamage(createSplitSoulConfig('amulet-of-souls'));
    const withEof = simulateBaseDamage(createSplitSoulConfig('essence-of-finality'));

    const baselineSplitSoul = baseline.damageByAbility.find((entry) => entry.abilityId === 'split-soul');
    const aosSplitSoul = withAos.damageByAbility.find((entry) => entry.abilityId === 'split-soul');
    const eofSplitSoul = withEof.damageByAbility.find((entry) => entry.abilityId === 'split-soul');

    expect(aosSplitSoul?.avg).toBeCloseTo((baselineSplitSoul?.avg ?? 0) * 1.1875, 2);
    expect(eofSplitSoul?.avg).toBeCloseTo((baselineSplitSoul?.avg ?? 0) * 1.1875, 2);
  });
});

function createConfig(input: {
  abilities: Record<string, AbilityDefinition>;
  buffs?: Record<string, BuffDefinition>;
  items?: SimulationConfig['gameData']['items'];
  perks?: SimulationConfig['gameData']['perks'];
  abilityActions: SimulationConfig['rotationPlan']['abilityActions'];
  nonGcdActions?: SimulationConfig['rotationPlan']['nonGcdActions'];
  activeBuffIds?: string[];
  startingAdrenaline: number;
  tickCount: number;
  weaponConfiguredPerks?: NonNullable<SimulationConfig['gearSetup']['equipment']['weapon']>['configuredPerks'];
  equipment?: SimulationConfig['gearSetup']['equipment'];
  inventoryItems?: SimulationConfig['inventory']['items'];
}): SimulationConfig {
  return {
    playerStats: {
      rangedLevel: 99,
      prayerLevel: 99,
    },
    gearSetup: {
      equipment: input.equipment ?? {
        weapon: {
          instanceId: 'weapon-1',
          definitionId: 'bolg',
          configuredPerks: input.weaponConfiguredPerks,
        },
      },
    },
    inventory: {
      items: input.inventoryItems ?? [],
    },
    persistentBuffConfig: {
      buffIds: input.activeBuffIds ?? [],
    },
    rotationPlan: {
      startingAdrenaline: input.startingAdrenaline,
      tickCount: input.tickCount,
      nonGcdActions: input.nonGcdActions ?? [],
      abilityActions: input.abilityActions,
    },
    gameData: {
      items: {
        bolg: {
          id: 'bolg',
          name: 'Bow of the Last Guardian',
          category: 'weapon',
          slot: 'weapon',
          combatStyleTags: ['ranged'],
          specialAbilityId: 'balance-by-force',
          tier: 95,
          offensiveStats: {
            damageTier: 95,
          },
        },
        ...(input.items ?? {}),
      },
      ammo: {},
      abilities: {
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
        'split-soul': createAbilityDefinition({
          id: 'split-soul',
          name: 'Split Soul',
          subtype: 'special',
          cooldownTicks: 0,
          adrenalineCost: 25,
          adrenalineGain: 0,
          hitSchedule: [],
          baseDamage: { min: 0, max: 0 },
          timelineEffects: [
            {
              kind: 'apply-buff',
              buffId: 'split-soul',
              endsOnWeaponSwap: true,
            },
          ],
          displayHints: {
            hiddenFromUi: true,
          },
        }),
        ...input.abilities,
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
        'deaths-swiftness-buff': {
          id: 'deaths-swiftness-buff',
          name: "Death's Swiftness",
          category: 'temporary',
          sourceType: 'ability',
          durationTicks: 63,
          effectRefs: ['ranged-damage-multiplier:+50%'],
        },
        'searing-winds': {
          id: 'searing-winds',
          name: 'Searing Winds',
          category: 'temporary',
          sourceType: 'ability',
          durationTicks: 10,
          effectRefs: ['ranged-hit-flat-bonus-ability-damage:+20%:cast-snapshot'],
        },
        'shadow-imbued': {
          id: 'shadow-imbued',
          name: 'Shadow Imbued',
          category: 'temporary',
          sourceType: 'ability',
          durationTicks: 50,
          effectRefs: ['ranged-hit-adrenaline:+5%'],
        },
        'split-soul': {
          id: 'split-soul',
          name: 'Split Soul',
          category: 'temporary',
          sourceType: 'ability',
          durationTicks: 25,
        },
        'berserk-buff': {
          id: 'berserk-buff',
          name: 'Berserk',
          category: 'temporary',
          sourceType: 'ability',
          durationTicks: 33,
          effectRefs: ['melee-damage-multiplier:+75%'],
        },
        'meteor-strike-buff': {
          id: 'meteor-strike-buff',
          name: 'Meteor Strike',
          category: 'temporary',
          sourceType: 'ability',
          durationTicks: 50,
          effectRefs: ['basic-adrenaline:+50%'],
        },
        ...mergeTestBuffs(input.buffs ?? {}),
      },
      perks: input.perks ?? {},
      relics: {},
      eofSpecs: {},
    },
    modeFlags: {
      strictValidation: true,
    },
  };
}

function createAbilityAction(id: string, tick: number, abilityId: string) {
  return {
    id,
    tick,
    lane: 'ability' as const,
    actionType: 'ability-use' as const,
    payload: {
      abilityId,
    },
  };
}

function createAbilityDefinition(
  input: Omit<AbilityDefinition, 'style' | 'subtype'> & Pick<Partial<AbilityDefinition>, 'style' | 'subtype'>,
): AbilityDefinition {
  return {
    style: 'ranged',
    subtype: 'basic',
    ...input,
  };
}

function calculateExpectedSplitSoulDamage(sourceDamage: number): number {
  const firstBracket = Math.min(sourceDamage, 2000) * 0.1;
  const secondBracket = Math.min(Math.max(sourceDamage - 2000, 0), 2000) * 0.05;
  const thirdBracket = Math.max(sourceDamage - 4000, 0) * 0.0125;

  return Math.round((firstBracket + secondBracket + thirdBracket) * 4 * 100) / 100;
}

function mergeTestBuffs(
  overrides: Record<string, BuffDefinition>,
): Record<string, BuffDefinition> {
  const defaults: Record<string, Partial<BuffDefinition>> = {
    'balance-by-force-buff': {
      durationTicks: 50,
    },
    'deaths-swiftness-buff': {
      durationTicks: 63,
    },
    'searing-winds': {
      durationTicks: 10,
    },
    'shadow-imbued': {
      durationTicks: 50,
    },
    'split-soul': {
      durationTicks: 25,
    },
    'berserk-buff': {
      durationTicks: 33,
    },
    'meteor-strike-buff': {
      durationTicks: 50,
    },
  };

  return Object.fromEntries(
    Object.entries(overrides).map(([buffId, definition]) => [
      buffId,
      {
        ...(defaults[buffId] ?? {}),
        ...definition,
      },
    ]),
  );
}
