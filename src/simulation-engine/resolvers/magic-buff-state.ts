import type { EntityId } from '../../game-data/types';
import type { RotationAction, TimelineGeneratedBuffSource } from '../models';
import { markBuffRange } from './ability-timeline-effects';

export interface PendingMagicBuff {
  percent: number;
  buffId: EntityId;
  expiresAtTick: number;
}

export interface MarkPendingMagicBuffInput {
  buffTimeline: Record<number, EntityId[]>;
  timelineGeneratedBuffSources: TimelineGeneratedBuffSource[];
  buffId: EntityId;
  sourceId: EntityId;
  percent: number;
  startTick: number;
  endTick: number;
  tickCount: number;
}

export function isPendingBuffActive(buff: PendingMagicBuff | null, tick: number): buff is PendingMagicBuff {
  return Boolean(buff && tick <= buff.expiresAtTick);
}

export function markPendingMagicBuff(input: MarkPendingMagicBuffInput): PendingMagicBuff {
  markBuffRange(input.buffTimeline, input.buffId, input.startTick, input.endTick, input.tickCount);
  appendTimelineGeneratedBuffSourceOnce(input.timelineGeneratedBuffSources, {
    buffId: input.buffId,
    sourceType: 'ability',
    sourceId: input.sourceId,
  });

  return {
    percent: input.percent,
    buffId: input.buffId,
    expiresAtTick: input.endTick,
  };
}

export function consumePendingBuff(
  buffTimeline: Record<number, EntityId[]>,
  buffId: EntityId | undefined,
  actionTick: number,
  tickCount: number,
): void {
  if (!buffId) {
    return;
  }

  clearBuffRange(buffTimeline, buffId, actionTick + 1, tickCount);
}

export function resolvePendingMagicCritBuffEndTick(
  nonGcdActions: readonly RotationAction[],
  actionTick: number,
  tickCount: number,
): number {
  const mainHandSwapTick = [...nonGcdActions]
    .filter((action) => action.actionType === 'gear-swap' && action.tick >= actionTick)
    .map((action) => ({
      tick: action.tick,
      slot: readStringPayload(action, 'slot'),
    }))
    .find((entry) => entry.slot === 'weapon')?.tick;

  return Math.min(tickCount - 1, mainHandSwapTick ?? tickCount - 1);
}

function clearBuffRange(
  buffTimeline: Record<number, EntityId[]>,
  buffId: EntityId,
  startTick: number,
  tickCount: number,
): void {
  for (let tick = startTick; tick < tickCount; tick += 1) {
    buffTimeline[tick] = buffTimeline[tick].filter((existing) => existing !== buffId);
  }
}

function readStringPayload(action: RotationAction, key: string): string | null {
  const value = action.payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function appendTimelineGeneratedBuffSourceOnce(
  timelineGeneratedBuffSources: TimelineGeneratedBuffSource[],
  entry: TimelineGeneratedBuffSource,
): void {
  if (timelineGeneratedBuffSources.some((existing) => existing.buffId === entry.buffId)) {
    return;
  }

  timelineGeneratedBuffSources.push(entry);
}
