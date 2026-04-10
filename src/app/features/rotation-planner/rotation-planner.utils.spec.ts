import { describe, expect, it } from 'vitest';

import type { AbilityDefinition } from '../../../game-data/types';
import type { RotationAction } from '../../../simulation-engine/models';
import {
  buildAbilityPlacementTicks,
  buildAbilityGapControls,
  collapseAbilityGap,
  canPlaceAbilityAtTick,
  getNonGcdActionsAtTick,
  getAbilitySegment,
  getAbilityTimelineSpan,
  isAbilityPlacementTick,
  previewAbilityActionsWithPlacement,
  removeNonGcdAction,
  removeAbilityAction,
  type PlannerNonGcdTemplate,
  snapTickToAbilityWindowStart,
  upsertNonGcdAbilityAction,
  upsertNonGcdAction,
  upsertAbilityAction,
} from './rotation-planner.utils';

const BASIC_ABILITY: AbilityDefinition = {
  id: 'rapid-fire',
  name: 'Rapid Fire',
  style: 'ranged',
  subtype: 'enhanced',
  cooldownTicks: 34,
  adrenalineCost: 25,
  hitSchedule: [],
  baseDamage: {
    min: 0,
    max: 0,
  },
};

const CHANNELED_ABILITY: AbilityDefinition = {
  ...BASIC_ABILITY,
  id: 'rapid-fire-channel',
  name: 'Rapid Fire Channel',
  isChanneled: true,
  channelDurationTicks: 9,
};

const COMPLETION_CHANNEL_ABILITY: AbilityDefinition = {
  ...BASIC_ABILITY,
  id: 'snipe',
  name: 'Snipe',
  isChanneled: true,
  channelDurationTicks: 3,
  hitSchedule: [
    {
      id: 'snipe-hit',
      tickOffset: 3,
      damage: {
        min: 300,
        max: 360,
      },
    },
  ],
  baseDamage: {
    min: 300,
    max: 360,
  },
};

const ABILITY_DEFINITIONS: Record<string, AbilityDefinition> = {
  [BASIC_ABILITY.id]: BASIC_ABILITY,
  [CHANNELED_ABILITY.id]: CHANNELED_ABILITY,
  [COMPLETION_CHANNEL_ABILITY.id]: COMPLETION_CHANNEL_ABILITY,
};

const NON_GCD_TEMPLATE: PlannerNonGcdTemplate = {
  id: 'vulnerability-bomb',
  label: 'Vulnerability Bomb',
  shortLabel: 'Vuln',
  actionType: 'vulnerability-bomb',
};

function createAbilityAction(id: string, tick: number, abilityId = 'rapid-fire'): RotationAction {
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

describe('rotation planner utils', () => {
  it('recognizes GCD-aligned ability ticks', () => {
    expect(isAbilityPlacementTick([], ABILITY_DEFINITIONS, 12, 0)).toBe(true);
    expect(isAbilityPlacementTick([], ABILITY_DEFINITIONS, 12, 3)).toBe(true);
    expect(isAbilityPlacementTick([], ABILITY_DEFINITIONS, 12, 4)).toBe(false);
  });

  it('snaps any tick inside a gcd window to that window start', () => {
    expect(snapTickToAbilityWindowStart([], ABILITY_DEFINITIONS, 12, 0)).toBe(0);
    expect(snapTickToAbilityWindowStart([], ABILITY_DEFINITIONS, 12, 1)).toBe(0);
    expect(snapTickToAbilityWindowStart([], ABILITY_DEFINITIONS, 12, 2)).toBe(0);
    expect(snapTickToAbilityWindowStart([], ABILITY_DEFINITIONS, 12, 5)).toBe(3);
  });

  it('blocks illegal ability placement on non-GCD ticks', () => {
    expect(canPlaceAbilityAtTick([], ABILITY_DEFINITIONS, 30, BASIC_ABILITY, 1)).toBe(true);
    expect(canPlaceAbilityAtTick([], ABILITY_DEFINITIONS, 30, BASIC_ABILITY, 2)).toBe(true);
  });

  it('allows ability placement into occupied ticks by shifting later actions to the right', () => {
    const actions = [createAbilityAction('existing', 6)];

    expect(canPlaceAbilityAtTick(actions, ABILITY_DEFINITIONS, 30, BASIC_ABILITY, 6)).toBe(true);
    expect(canPlaceAbilityAtTick(actions, ABILITY_DEFINITIONS, 30, BASIC_ABILITY, 7)).toBe(true);
  });

  it('allows moving an existing action back onto its own tick', () => {
    const actions = [createAbilityAction('existing', 6)];

    expect(canPlaceAbilityAtTick(actions, ABILITY_DEFINITIONS, 30, BASIC_ABILITY, 6, 'existing')).toBe(true);
  });

  it('shifts overlapping placements to the next valid space when room exists', () => {
    const actions = [createAbilityAction('existing', 6, 'rapid-fire-channel')];

    expect(canPlaceAbilityAtTick(actions, ABILITY_DEFINITIONS, 30, BASIC_ABILITY, 12)).toBe(true);
    expect(canPlaceAbilityAtTick(actions, ABILITY_DEFINITIONS, 30, BASIC_ABILITY, 15)).toBe(true);
    expect(canPlaceAbilityAtTick(actions, ABILITY_DEFINITIONS, 30, BASIC_ABILITY, 18)).toBe(true);
  });

  it('blocks placements that would exceed timeline bounds', () => {
    expect(canPlaceAbilityAtTick([], ABILITY_DEFINITIONS, 10, CHANNELED_ABILITY, 3)).toBe(false);
  });

  it('calculates timeline span from gcd or channel duration', () => {
    expect(getAbilityTimelineSpan(BASIC_ABILITY)).toBe(3);
    expect(getAbilityTimelineSpan(CHANNELED_ABILITY)).toBe(8);
    expect(getAbilityTimelineSpan(COMPLETION_CHANNEL_ABILITY)).toBe(3);
  });

  it('returns ability segment positions for occupied ticks', () => {
    const action = createAbilityAction('existing', 6, 'rapid-fire-channel');

    expect(getAbilitySegment(action, CHANNELED_ABILITY, 6)).toBe('start');
    expect(getAbilitySegment(action, CHANNELED_ABILITY, 9)).toBe('middle');
    expect(getAbilitySegment(action, CHANNELED_ABILITY, 13)).toBe('end');
    expect(getAbilitySegment(action, CHANNELED_ABILITY, 14)).toBeNull();
  });

  it('tracks post-channel placement windows from the real finish tick', () => {
    const assaultAbility: AbilityDefinition = {
      ...BASIC_ABILITY,
      id: 'assault',
      name: 'Assault',
      style: 'melee',
      isChanneled: true,
      channelDurationTicks: 8,
      hitSchedule: [
        { id: 'assault-hit-1', tickOffset: 1, damage: { min: 130, max: 150 } },
        { id: 'assault-hit-2', tickOffset: 3, damage: { min: 130, max: 150 } },
        { id: 'assault-hit-3', tickOffset: 5, damage: { min: 130, max: 150 } },
        { id: 'assault-hit-4', tickOffset: 7, damage: { min: 130, max: 150 } },
      ],
      baseDamage: {
        min: 520,
        max: 600,
      },
    };
    const abilityDefinitions = {
      ...ABILITY_DEFINITIONS,
      assault: assaultAbility,
    };
    const actions = [createAbilityAction('assault-action', 0, 'assault')];

    expect(getAbilityTimelineSpan(assaultAbility)).toBe(7);
    expect(buildAbilityPlacementTicks(actions, abilityDefinitions, 18)).toEqual([0, 7, 10, 13, 16]);
    expect(snapTickToAbilityWindowStart(actions, abilityDefinitions, 18, 8)).toBe(7);
    expect(isAbilityPlacementTick(actions, abilityDefinitions, 18, 7)).toBe(true);
    expect(isAbilityPlacementTick(actions, abilityDefinitions, 18, 9)).toBe(false);
  });

  it('adds a new ability action for catalog drops', () => {
    const actions = upsertAbilityAction(
      [],
      ABILITY_DEFINITIONS,
      {
        sourceType: 'catalog',
        abilityId: 'rapid-fire',
      },
      9,
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      tick: 9,
      lane: 'ability',
      actionType: 'ability-use',
      payload: {
        abilityId: 'rapid-fire',
      },
    });
  });

  it('moves an existing action for timeline drags', () => {
    const actions = upsertAbilityAction(
      [createAbilityAction('existing', 6)],
      ABILITY_DEFINITIONS,
      {
        sourceType: 'timeline',
        abilityId: 'rapid-fire',
        actionId: 'existing',
      },
      12,
    );

    expect(actions).toEqual([createAbilityAction('existing', 12)]);
  });

  it('inserts a new ability and pushes occupied abilities to the right', () => {
    const actions = upsertAbilityAction(
      [createAbilityAction('existing', 6), createAbilityAction('later', 9)],
      ABILITY_DEFINITIONS,
      {
        sourceType: 'catalog',
        abilityId: 'rapid-fire',
      },
      6,
    );

    expect(actions).toEqual([
      expect.objectContaining({ tick: 6, payload: { abilityId: 'rapid-fire' } }),
      createAbilityAction('existing', 9),
      createAbilityAction('later', 12),
    ]);
  });

  it('creates a preview action id for catalog placement validation', () => {
    const preview = previewAbilityActionsWithPlacement(
      [createAbilityAction('existing', 6)],
      ABILITY_DEFINITIONS,
      {
        sourceType: 'catalog',
        abilityId: 'rapid-fire',
      },
      12,
    );

    expect(preview.targetActionId).toBe('__planner-preview-placement__');
    expect(preview.abilityActions).toContainEqual(
      expect.objectContaining({
        id: '__planner-preview-placement__',
        tick: 12,
      }),
    );
  });

  it('builds a collapse control on the right edge of an empty ability gap', () => {
    const controls = buildAbilityGapControls(
      [createAbilityAction('one', 0), createAbilityAction('two', 9)],
      ABILITY_DEFINITIONS,
    );

    expect(controls).toEqual([
      {
        tick: 8,
        shiftTicks: 6,
        shiftFromTick: 9,
      },
    ]);
  });

  it('collapses an empty gap by shifting later abilities left', () => {
    const actions = collapseAbilityGap(
      [createAbilityAction('one', 0), createAbilityAction('two', 9), createAbilityAction('three', 12)],
      {
        tick: 8,
        shiftTicks: 6,
        shiftFromTick: 9,
      },
    );

    expect(actions).toEqual([
      createAbilityAction('one', 0),
      createAbilityAction('two', 3),
      createAbilityAction('three', 6),
    ]);
  });

  it('allows stacking multiple non-gcd actions on the same tick', () => {
    const first = upsertNonGcdAction([], NON_GCD_TEMPLATE, 6);
    const second = upsertNonGcdAction(first, {
      ...NON_GCD_TEMPLATE,
      id: 'gear-swap',
      label: 'Gear Swap',
      shortLabel: 'Gear',
      actionType: 'gear-swap',
    }, 6);

    expect(getNonGcdActionsAtTick(second, 6)).toHaveLength(2);
  });

  it('moves a non-gcd action to another tick', () => {
    const actions = upsertNonGcdAction(
      [
        {
          id: 'non-gcd-vulnerability-bomb-6-1',
          tick: 6,
          lane: 'non-gcd',
          actionType: 'vulnerability-bomb',
          payload: {
            templateId: 'vulnerability-bomb',
            label: 'Vulnerability Bomb',
            shortLabel: 'Vuln',
          },
        },
      ],
      NON_GCD_TEMPLATE,
      9,
      {
        sourceType: 'timeline',
        templateId: 'vulnerability-bomb',
        actionId: 'non-gcd-vulnerability-bomb-6-1',
      },
    );

    expect(getNonGcdActionsAtTick(actions, 6)).toHaveLength(0);
    expect(getNonGcdActionsAtTick(actions, 9)).toHaveLength(1);
  });

  it('adds a utility ability onto the non-gcd lane', () => {
    const surge: AbilityDefinition = {
      id: 'surge',
      name: 'Surge',
      style: 'magic',
      subtype: 'utility',
      cooldownTicks: 17,
      hitSchedule: [],
      baseDamage: {
        min: 0,
        max: 0,
      },
    };

    const actions = upsertNonGcdAbilityAction([], surge, 6);

    expect(actions).toEqual([
      {
        id: 'non-gcd-ability-surge-6-1',
        tick: 6,
        lane: 'non-gcd',
        actionType: 'ability-use',
        payload: {
          templateId: 'ability-use',
          abilityId: 'surge',
          label: 'Surge',
          shortLabel: 'S',
          iconPath: undefined,
        },
      },
    ]);
  });

  it('adds Runic Charge onto the non-gcd lane', () => {
    const runicCharge: AbilityDefinition = {
      id: 'runic-charge',
      name: 'Runic Charge',
      style: 'magic',
      subtype: 'utility',
      cooldownTicks: 50,
      hitSchedule: [],
      baseDamage: {
        min: 0,
        max: 0,
      },
      plannerPlacement: {
        allowedLanes: ['non-gcd'],
      },
    };

    const actions = upsertNonGcdAbilityAction([], runicCharge, 6);

    expect(actions).toEqual([
      {
        id: 'non-gcd-ability-runic-charge-6-1',
        tick: 6,
        lane: 'non-gcd',
        actionType: 'ability-use',
        payload: {
          templateId: 'ability-use',
          abilityId: 'runic-charge',
          label: 'Runic Charge',
          shortLabel: 'RC',
          iconPath: undefined,
        },
      },
    ]);
  });

  it('removes non-gcd actions by id', () => {
    const actions = removeNonGcdAction(
      [
        {
          id: 'non-gcd-vulnerability-bomb-6-1',
          tick: 6,
          lane: 'non-gcd',
          actionType: 'vulnerability-bomb',
          payload: {
            templateId: 'vulnerability-bomb',
            label: 'Vulnerability Bomb',
            shortLabel: 'Vuln',
          },
        },
      ],
      'non-gcd-vulnerability-bomb-6-1',
    );

    expect(actions).toHaveLength(0);
  });

  it('removes ability actions by id', () => {
    const actions = removeAbilityAction(
      [createAbilityAction('one', 3), createAbilityAction('two', 6, 'snipe')],
      'one',
    );

    expect(actions).toEqual([createAbilityAction('two', 6, 'snipe')]);
  });
});
