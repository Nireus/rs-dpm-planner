import type { BuffDefinition, EntityId } from '../../../game-data/types';
import type { AbilityDefinition } from '../../../game-data/types';
import type { TimelineGeneratedBuffSource } from '../../../simulation-engine/models';

export interface PlannerBuffLaneBar {
  buffId: EntityId;
  name: string;
  iconPath?: string;
  isWarning?: boolean;
  themeClass?: string;
  startTick: number;
  endTick: number;
  span: number;
  row: number;
  stackPeak: number;
}

interface BuildPlannerBuffLaneBarsInput {
  tickCount: number;
  buffTimeline: Record<number, EntityId[]>;
  buffDefinitions: Record<EntityId, BuffDefinition>;
  timelineGeneratedBuffSources?: TimelineGeneratedBuffSource[];
  abilityDefinitions?: Record<EntityId, AbilityDefinition>;
}

interface PendingBuffRun {
  startTick: number;
  endTick: number;
  stackPeak: number;
}

export function buildPlannerBuffLaneBars(
  input: BuildPlannerBuffLaneBarsInput,
): PlannerBuffLaneBar[] {
  const buffIds = collectTimelineBuffIds(input.tickCount, input.buffTimeline, input.buffDefinitions);
  const segments = buffIds.flatMap((buffId) =>
    buildSegmentsForBuff(buffId, input.tickCount, input.buffTimeline),
  );

  const lastEndTickByRow: number[] = [];

  return segments
    .sort((left, right) =>
      left.startTick - right.startTick ||
      left.endTick - right.endTick ||
      compareBuffRowPriority(left.buffId, right.buffId) ||
      left.buffId.localeCompare(right.buffId),
    )
    .map((segment) => {
      let row = 0;

      while (lastEndTickByRow[row] !== undefined && lastEndTickByRow[row] >= segment.startTick) {
        row += 1;
      }

      lastEndTickByRow[row] = segment.endTick;

      const definition = input.buffDefinitions[segment.buffId];

      return {
        buffId: segment.buffId,
        name: definition?.name ?? segment.buffId,
        iconPath: definition?.iconPath,
        isWarning: isWarningLikeBuff(definition),
        themeClass: resolveBuffThemeClass(segment.buffId, input.timelineGeneratedBuffSources, input.abilityDefinitions),
        startTick: segment.startTick,
        endTick: segment.endTick,
        span: segment.endTick - segment.startTick + 1,
        row,
        stackPeak: segment.stackPeak,
      };
    });
}

export function shortLabelForBuffBar(name: string): string {
  const parts = name
    .split(/\s+/)
    .filter((part) => Boolean(part) && !['of', 'the'].includes(part.toLowerCase()))
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

function collectTimelineBuffIds(
  tickCount: number,
  buffTimeline: Record<number, EntityId[]>,
  buffDefinitions: Record<EntityId, BuffDefinition>,
): EntityId[] {
  const ids = new Set<EntityId>();

  for (let tick = 0; tick < tickCount; tick += 1) {
    for (const buffId of buffTimeline[tick] ?? []) {
      if (isCooldownLikeBuff(buffDefinitions[buffId]) || buffId === 'bloodlust') {
        continue;
      }

      ids.add(buffId);
    }
  }

  return [...ids];
}

function isCooldownLikeBuff(definition: BuffDefinition | undefined): boolean {
  return definition?.effectRefs?.some((effectRef) => effectRef.endsWith('-cooldown')) ?? false;
}

function isWarningLikeBuff(definition: BuffDefinition | undefined): boolean {
  return definition?.effectRefs?.includes('equilibrium-lock') ?? false;
}

function resolveBuffThemeClass(
  buffId: EntityId,
  timelineGeneratedBuffSources?: TimelineGeneratedBuffSource[],
  abilityDefinitions?: Record<EntityId, AbilityDefinition>,
): string | undefined {
  const source = timelineGeneratedBuffSources?.find((entry) => entry.buffId === buffId && entry.sourceType === 'ability');
  if (!source?.sourceId) {
    return undefined;
  }

  const style = abilityDefinitions?.[source.sourceId]?.style;
  return style ? `style-${style}` : undefined;
}

function buildSegmentsForBuff(
  buffId: EntityId,
  tickCount: number,
  buffTimeline: Record<number, EntityId[]>,
): Array<PendingBuffRun & { buffId: EntityId }> {
  const segments: Array<PendingBuffRun & { buffId: EntityId }> = [];
  let activeRun: PendingBuffRun | null = null;

  for (let tick = 0; tick < tickCount; tick += 1) {
    const count = (buffTimeline[tick] ?? []).filter((entry) => entry === buffId).length;

    if (count > 0) {
      if (!activeRun) {
        activeRun = {
          startTick: tick,
          endTick: tick,
          stackPeak: count,
        };
      } else {
        activeRun.endTick = tick;
        activeRun.stackPeak = Math.max(activeRun.stackPeak, count);
      }

      continue;
    }

    if (activeRun) {
      segments.push({
        buffId,
        ...activeRun,
      });
      activeRun = null;
    }
  }

  if (activeRun) {
    segments.push({
      buffId,
      ...activeRun,
    });
  }

  return segments;
}

function compareBuffRowPriority(leftBuffId: EntityId, rightBuffId: EntityId): number {
  const priority = (buffId: EntityId): number => {
    if (buffId === 'vulnerability') {
      return 0;
    }

    if (buffId === 'vulnerability-bomb-area') {
      return 1;
    }

    return 10;
  };

  return priority(leftBuffId) - priority(rightBuffId);
}
