import type { EntityId } from '../../game-data/types';
import type { RotationAction, RotationActionLane, RotationPlan } from '../models';
import type { ValidationIssue } from '../models';

export const GCD_TICKS = 3;

export type TimelineLaneKey = RotationActionLane | 'buff';

export interface DerivedBuffTimelineEntry {
  id: string;
  tick: number;
  buffId: EntityId;
  sourceType: 'ability' | 'item' | 'event';
  sourceId?: EntityId;
}

export interface TimelineTickBucket {
  tickIndex: number;
  nonGcdActions: RotationAction[];
  abilityActions: RotationAction[];
  derivedBuffEntries: DerivedBuffTimelineEntry[];
}

export interface BaseTimelineModel {
  startingAdrenaline: number;
  tickCount: number;
  gcdTicks: number;
  ticks: TimelineTickBucket[];
}

export interface BuildBaseTimelineInput {
  rotationPlan: RotationPlan;
  derivedBuffEntries?: DerivedBuffTimelineEntry[];
}

export interface BuildBaseTimelineResult {
  timeline: BaseTimelineModel;
  validationIssues: ValidationIssue[];
}

export function createEmptyTimeline(rotationPlan: RotationPlan): BaseTimelineModel {
  return {
    startingAdrenaline: rotationPlan.startingAdrenaline,
    tickCount: rotationPlan.tickCount,
    gcdTicks: GCD_TICKS,
    ticks: Array.from({ length: rotationPlan.tickCount }, (_, tickIndex) => ({
      tickIndex,
      nonGcdActions: [],
      abilityActions: [],
      derivedBuffEntries: [],
    })),
  };
}

export function isTickInBounds(tick: number, tickCount: number): boolean {
  return Number.isInteger(tick) && tick >= 0 && tick < tickCount;
}

export function buildBaseTimeline(input: BuildBaseTimelineInput): BuildBaseTimelineResult {
  const timeline = createEmptyTimeline(input.rotationPlan);
  const validationIssues: ValidationIssue[] = [];

  for (const action of input.rotationPlan.nonGcdActions) {
    const issue = insertActionIntoTimeline(timeline, action);
    if (issue) {
      validationIssues.push(issue);
    }
  }

  for (const action of input.rotationPlan.abilityActions) {
    const issue = insertActionIntoTimeline(timeline, action);
    if (issue) {
      validationIssues.push(issue);
    }
  }

  for (const entry of input.derivedBuffEntries ?? []) {
    const issue = insertDerivedBuffIntoTimeline(timeline, entry);
    if (issue) {
      validationIssues.push(issue);
    }
  }

  return { timeline, validationIssues };
}

export function insertActionIntoTimeline(
  timeline: BaseTimelineModel,
  action: RotationAction,
): ValidationIssue | undefined {
  if (!isTickInBounds(action.tick, timeline.tickCount)) {
    return createOutOfBoundsIssue({
      tick: action.tick,
      lane: action.lane,
      relatedActionId: action.id,
      message: `Action "${action.id}" is outside timeline bounds.`,
    });
  }

  const bucket = timeline.ticks[action.tick];
  getActionLane(bucket, action.lane).push(action);

  return undefined;
}

export function insertDerivedBuffIntoTimeline(
  timeline: BaseTimelineModel,
  entry: DerivedBuffTimelineEntry,
): ValidationIssue | undefined {
  if (!isTickInBounds(entry.tick, timeline.tickCount)) {
    return createOutOfBoundsIssue({
      tick: entry.tick,
      lane: 'buff',
      message: `Derived buff entry "${entry.id}" is outside timeline bounds.`,
    });
  }

  timeline.ticks[entry.tick].derivedBuffEntries.push(entry);
  return undefined;
}

function getActionLane(bucket: TimelineTickBucket, lane: RotationActionLane): RotationAction[] {
  return lane === 'non-gcd' ? bucket.nonGcdActions : bucket.abilityActions;
}

function createOutOfBoundsIssue(input: {
  tick: number;
  lane: TimelineLaneKey;
  message: string;
  relatedActionId?: string;
}): ValidationIssue {
  return {
    code: 'timeline.out_of_bounds',
    severity: 'error',
    tick: input.tick,
    relatedActionId: input.relatedActionId,
    message: `${input.message} Lane: ${input.lane}.`,
  };
}
