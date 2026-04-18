import { describe, expect, it } from 'vitest';
import type { AbilityDefinition, EntityId } from '../../game-data/types';
import type { RotationAction } from '../models';
import {
  buildPreFightSchedule,
  canStallAbility,
  clampPreFightGapTicks,
} from './pre-fight';

describe('pre-fight scheduling', () => {
  it('derives negative prebuild ticks from action order, spans, and gap ticks', () => {
    const schedule = buildPreFightSchedule({
      preFight: {
        gapTicks: 5,
        prebuildActions: [
          { id: 'prebuild-rapid', abilityId: 'rapid-fire' },
          { id: 'prebuild-galeshot', abilityId: 'galeshot' },
        ],
        stalledAbility: null,
      },
      abilityDefinitions: {
        'rapid-fire': createAbility({ id: 'rapid-fire', isChanneled: true, channelDurationTicks: 9, lastHitOffset: 7 }),
        galeshot: createAbility({ id: 'galeshot' }),
      },
      mainAbilityActions: [createMainAction('grico', 0, 'greater-ricochet')],
    });

    expect(schedule.setupTick).toBe(-5);
    expect(schedule.prebuildActions.map((action) => [action.action.id, action.startTick, action.endTick])).toEqual([
      ['prebuild-rapid', -15, -8],
      ['prebuild-galeshot', -8, -5],
    ]);
  });

  it('targets the first main ability-lane action for stalled release', () => {
    const schedule = buildPreFightSchedule({
      preFight: {
        gapTicks: 2,
        prebuildActions: [],
        stalledAbility: { id: 'stall-galeshot', abilityId: 'galeshot' },
      },
      abilityDefinitions: {
        galeshot: createAbility({ id: 'galeshot' }),
      },
      mainAbilityActions: [
        createMainAction('first-main', 4, 'greater-ricochet'),
        createMainAction('later-main', 7, 'piercing-shot'),
      ],
    });

    expect(schedule.stalledAbility).toEqual({
      action: { id: 'stall-galeshot', abilityId: 'galeshot' },
      abilityId: 'galeshot',
      castTick: -2,
      releaseTick: 4,
      releaseTargetActionId: 'first-main',
    });
  });

  it('maps prebuild non-GCD visual ticks into the hidden gap-adjusted setup timeline', () => {
    const schedule = buildPreFightSchedule({
      preFight: {
        gapTicks: 12,
        prebuildActions: [],
        prebuildNonGcdActions: [
          {
            id: 'prebuild-gear-swap',
            tick: -6,
            lane: 'non-gcd',
            actionType: 'gear-swap',
            payload: {
              templateId: 'gear-swap',
            },
          },
          {
            id: 'stall-vuln-bomb',
            tick: -2,
            lane: 'non-gcd',
            actionType: 'vulnerability-bomb',
            payload: {
              templateId: 'vulnerability-bomb',
            },
          },
        ],
        stalledAbility: null,
      },
      abilityDefinitions: {},
      mainAbilityActions: [],
    });

    expect(schedule.prebuildNonGcdActions.map((action) => [action.action.id, action.visualTick, action.tick])).toEqual([
      ['prebuild-gear-swap', -6, -15],
      ['stall-vuln-bomb', -2, -11],
    ]);
  });

  it('rejects channelled abilities for ability stall', () => {
    expect(canStallAbility(createAbility({ id: 'galeshot' }))).toBe(true);
    expect(canStallAbility(createAbility({ id: 'rapid-fire', isChanneled: true }))).toBe(false);
  });

  it('clamps gap ticks to the supported planner range', () => {
    expect(clampPreFightGapTicks(-1)).toBe(0);
    expect(clampPreFightGapTicks(999)).toBe(600);
    expect(clampPreFightGapTicks('12')).toBe(12);
  });
});

function createMainAction(id: string, tick: number, abilityId: EntityId): RotationAction {
  return {
    id,
    tick,
    lane: 'ability',
    actionType: 'ability-use',
    payload: {
      abilityId,
    },
  };
}

function createAbility(input: {
  id: EntityId;
  isChanneled?: boolean;
  channelDurationTicks?: number;
  lastHitOffset?: number;
}): AbilityDefinition {
  return {
    id: input.id,
    name: input.id,
    style: 'ranged',
    subtype: 'basic',
    cooldownTicks: 3,
    adrenalineGain: 9,
    isChanneled: input.isChanneled,
    channelDurationTicks: input.channelDurationTicks,
    hitSchedule: [
      {
        id: `${input.id}-hit`,
        tickOffset: input.lastHitOffset ?? 0,
        damage: {
          min: 10,
          max: 10,
        },
      },
    ],
    baseDamage: {
      min: 10,
      max: 10,
    },
  };
}
