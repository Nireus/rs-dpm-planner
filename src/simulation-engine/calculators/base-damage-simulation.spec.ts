import { describe, expect, it } from 'vitest';
import type { AbilityDefinition } from '../../game-data/types';
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
      avg: 12857,
      max: 13726,
    });
    expect(result.damageByAbility).toEqual([
      { abilityId: 'rapid-fire', min: 10424, avg: 11120, max: 11816 },
      { abilityId: 'piercing-shot', min: 1564, avg: 1737, max: 1910 },
    ]);
    expect(result.damageByTick[0]).toEqual({ min: 782, avg: 868.5, max: 955 });
    expect(result.damageByTick[1]).toEqual({ min: 782, avg: 868.5, max: 955 });
    expect(result.damageByTick[10]).toEqual({ min: 1303, avg: 1390, max: 1477 });
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
      avg: 1998,
      max: 2172,
    });
    expect(result.validationIssues.some((issue) => issue.code === 'ability.cooldown_conflict')).toBe(true);
    expect(result.explainability.damageBreakdowns).toHaveLength(1);
  });
});

function createConfig(input: {
  abilities: Record<string, AbilityDefinition>;
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
      buffs: {},
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
