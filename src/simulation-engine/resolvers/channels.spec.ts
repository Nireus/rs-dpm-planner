import { describe, expect, it } from 'vitest';
import type { AbilityDefinition } from '../../game-data/types';
import type { SimulationConfig } from '../models';
import { resolveChannelTimeline } from './channels';

describe('resolveChannelTimeline', () => {
  it('tracks active channel occupancy for multi-hit channels', () => {
    const config = createConfig({
      abilities: {
        'rapid-fire': createAbilityDefinition({
          id: 'rapid-fire',
          name: 'Rapid Fire',
          cooldownTicks: 34,
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
      abilityActions: [createAbilityAction('rapid-1', 3, 'rapid-fire')],
      tickCount: 20,
    });

    const result = resolveChannelTimeline(config);

    expect(result.tickStates[2].activeChannel).toBeUndefined();
    expect(result.tickStates[3].activeChannel).toEqual({
      sourceActionId: 'rapid-1',
      abilityId: 'rapid-fire',
      remainingTicks: 9,
    });
    expect(result.tickStates[11].activeChannel).toEqual({
      sourceActionId: 'rapid-1',
      abilityId: 'rapid-fire',
      remainingTicks: 1,
    });
    expect(result.tickStates[12].activeChannel).toBeUndefined();
  });

  it('supports completion-only channels such as snipe', () => {
    const config = createConfig({
      abilities: {
        snipe: createAbilityDefinition({
          id: 'snipe',
          name: 'Snipe',
          cooldownTicks: 100,
          isChanneled: true,
          channelDurationTicks: 3,
          hitSchedule: [
            {
              id: 'snipe-hit',
              tickOffset: 3,
              damage: { min: 300, max: 360 },
            },
          ],
          baseDamage: { min: 300, max: 360 },
        }),
      },
      abilityActions: [createAbilityAction('snipe-1', 5, 'snipe')],
      tickCount: 12,
    });

    const result = resolveChannelTimeline(config);

    expect(result.tickStates[5].activeChannel?.remainingTicks).toBe(3);
    expect(result.tickStates[6].activeChannel?.remainingTicks).toBe(2);
    expect(result.tickStates[7].activeChannel?.remainingTicks).toBe(1);
    expect(result.tickStates[8].activeChannel).toBeUndefined();
  });

  it('skips blocked channel actions', () => {
    const config = createConfig({
      abilities: {
        snipe: createAbilityDefinition({
          id: 'snipe',
          name: 'Snipe',
          cooldownTicks: 100,
          isChanneled: true,
          channelDurationTicks: 3,
          hitSchedule: [],
          baseDamage: { min: 300, max: 360 },
        }),
      },
      abilityActions: [createAbilityAction('snipe-1', 2, 'snipe')],
      tickCount: 10,
    });

    const result = resolveChannelTimeline(config, new Set(['snipe-1']));

    expect(result.tickStates.every((tick) => !tick.activeChannel)).toBe(true);
  });
});

function createConfig(input: {
  abilities: Record<string, AbilityDefinition>;
  abilityActions: SimulationConfig['rotationPlan']['abilityActions'];
  tickCount: number;
}): SimulationConfig {
  return {
    playerStats: {
      rangedLevel: 99,
      prayerLevel: 99,
    },
    gearSetup: {
      equipment: {},
    },
    inventory: {
      items: [],
    },
    persistentBuffConfig: {},
    rotationPlan: {
      startingAdrenaline: 100,
      tickCount: input.tickCount,
      nonGcdActions: [],
      abilityActions: input.abilityActions,
    },
    gameData: {
      items: {},
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
