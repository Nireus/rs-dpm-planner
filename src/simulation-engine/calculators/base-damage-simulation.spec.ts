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
          channelDurationTicks: 8,
          hitSchedule: Array.from({ length: 8 }, (_, index) => ({
            id: `rapid-${index + 1}`,
            tickOffset: index,
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
      min: 11988,
      avg: 13499.86,
      max: 20589,
    });
    expect(result.damageByAbility.map((entry) => [entry.abilityId, entry.avg])).toEqual([
      ['rapid-fire', 11676],
      ['piercing-shot', 1823.86],
    ]);
    expect(result.damageByTick[0]?.avg).toBe(911.93);
    expect(result.damageByTick[1]?.avg).toBe(911.93);
    expect(result.damageByTick[10]?.avg).toBe(1459.5);
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
      min: 1824,
      avg: 2097.9,
      max: 3258,
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
      min: 2607,
      avg: 2737.35,
      max: 3910.5,
    });
    expect(result.damageByAbility.map((entry) => [entry.abilityId, entry.avg])).toEqual([
      ['piercing-shot', 2737.35],
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
        value: 347.6,
      },
    ]);
    expect(piercingBreakdowns[1].additiveModifiers).toEqual([
      {
        sourceId: 'ranged-hit-flat-bonus-ability-damage:+20%:cast-snapshot',
        label: 'Ranged hit bonus +20% ability damage',
        value: 347.6,
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
          effectRefs: ['searing-winds'],
        }),
        'rapid-fire': createAbilityDefinition({
          id: 'rapid-fire',
          name: 'Rapid Fire',
          cooldownTicks: 34,
          adrenalineCost: 25,
          isChanneled: true,
          channelDurationTicks: 8,
          hitSchedule: Array.from({ length: 8 }, (_, index) => ({
            id: `rapid-${index + 1}`,
            tickOffset: index,
            damage: { min: 75, max: 85 },
          })),
          baseDamage: { min: 600, max: 680 },
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
      value: 278.08,
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
          adrenalineCost: 15,
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
});

function createConfig(input: {
  abilities: Record<string, AbilityDefinition>;
  buffs?: Record<string, BuffDefinition>;
  abilityActions: SimulationConfig['rotationPlan']['abilityActions'];
  startingAdrenaline: number;
  tickCount: number;
}): SimulationConfig {
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
      },
    },
    inventory: {
      items: [],
    },
    persistentBuffConfig: {},
    rotationPlan: {
      startingAdrenaline: input.startingAdrenaline,
      tickCount: input.tickCount,
      nonGcdActions: [],
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
          tier: 95,
          offensiveStats: {
            damageTier: 95,
          },
        },
      },
      ammo: {},
      abilities: input.abilities,
      buffs: input.buffs ?? {},
      perks: {},
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
