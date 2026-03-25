import { describe, expect, it } from 'vitest';

import type { RotationPlan } from '../models';
import {
  buildBaseTimeline,
  createEmptyTimeline,
  insertActionIntoTimeline,
  insertDerivedBuffIntoTimeline,
  isTickInBounds,
  type DerivedBuffTimelineEntry,
} from './base-timeline';

function createRotationPlan(): RotationPlan {
  return {
    startingAdrenaline: 35,
    tickCount: 12,
    nonGcdActions: [
      {
        id: 'swap-ammo',
        tick: 1,
        lane: 'non-gcd',
        actionType: 'ammo-swap',
        payload: { ammoId: 'deathspore-arrows' },
      },
    ],
    abilityActions: [
      {
        id: 'rapid-fire',
        tick: 3,
        lane: 'ability',
        actionType: 'ability-use',
        payload: { abilityId: 'rapid-fire' },
      },
    ],
  };
}

describe('base timeline', () => {
  it('creates a tick bucket for every tick in the plan', () => {
    const timeline = createEmptyTimeline(createRotationPlan());

    expect(timeline.startingAdrenaline).toBe(35);
    expect(timeline.tickCount).toBe(12);
    expect(timeline.gcdTicks).toBe(3);
    expect(timeline.ticks).toHaveLength(12);
    expect(timeline.ticks[0]).toEqual({
      tickIndex: 0,
      nonGcdActions: [],
      abilityActions: [],
      derivedBuffEntries: [],
    });
  });

  it('inserts actions and derived buff entries into the correct ticks', () => {
    const derivedBuffEntry: DerivedBuffTimelineEntry = {
      id: 'deathspore-focus-window',
      tick: 4,
      buffId: 'deathspore-focus',
      sourceType: 'item',
      sourceId: 'deathspore-arrows',
    };

    const result = buildBaseTimeline({
      rotationPlan: createRotationPlan(),
      derivedBuffEntries: [derivedBuffEntry],
    });

    expect(result.validationIssues).toEqual([]);
    expect(result.timeline.ticks[1].nonGcdActions.map((action) => action.id)).toEqual(['swap-ammo']);
    expect(result.timeline.ticks[3].abilityActions.map((action) => action.id)).toEqual(['rapid-fire']);
    expect(result.timeline.ticks[4].derivedBuffEntries).toEqual([derivedBuffEntry]);
  });

  it('reports action bounds violations', () => {
    const timeline = createEmptyTimeline(createRotationPlan());

    const issue = insertActionIntoTimeline(timeline, {
      id: 'bad-action',
      tick: 12,
      lane: 'ability',
      actionType: 'ability-use',
      payload: { abilityId: 'snipe' },
    });

    expect(issue).toMatchObject({
      code: 'timeline.out_of_bounds',
      severity: 'error',
      tick: 12,
      relatedActionId: 'bad-action',
    });
    expect(issue?.message).toContain('Lane: ability');
  });

  it('reports derived buff bounds violations', () => {
    const timeline = createEmptyTimeline(createRotationPlan());

    const issue = insertDerivedBuffIntoTimeline(timeline, {
      id: 'late-buff',
      tick: -1,
      buffId: 'deathspore-focus',
      sourceType: 'event',
    });

    expect(issue).toMatchObject({
      code: 'timeline.out_of_bounds',
      severity: 'error',
      tick: -1,
    });
    expect(issue?.message).toContain('Lane: buff');
  });

  it('checks tick bounds using integer tick indexing', () => {
    expect(isTickInBounds(0, 12)).toBe(true);
    expect(isTickInBounds(11, 12)).toBe(true);
    expect(isTickInBounds(12, 12)).toBe(false);
    expect(isTickInBounds(-1, 12)).toBe(false);
    expect(isTickInBounds(2.5, 12)).toBe(false);
  });
});
