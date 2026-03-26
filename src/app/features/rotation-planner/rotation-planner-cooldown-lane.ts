import type { AbilityDefinition, EntityId } from '../../../game-data/types';

export interface PlannerCooldownLaneBar {
  abilityId: EntityId;
  name: string;
  iconPath?: string;
  startTick: number;
  endTick: number;
  span: number;
  row: number;
}

interface BuildPlannerCooldownLaneBarsInput {
  tickCount: number;
  cooldownTimeline: Record<number, Record<EntityId, number>>;
  abilityDefinitions: Record<EntityId, AbilityDefinition>;
}

interface PendingCooldownRun {
  startTick: number;
  endTick: number;
}

export function buildPlannerCooldownLaneBars(
  input: BuildPlannerCooldownLaneBarsInput,
): PlannerCooldownLaneBar[] {
  const abilityIds = collectTimelineAbilityIds(input.tickCount, input.cooldownTimeline);
  const segments = abilityIds.flatMap((abilityId) =>
    buildSegmentsForCooldown(abilityId, input.tickCount, input.cooldownTimeline),
  );

  const lastEndTickByRow: number[] = [];

  return segments
    .sort((left, right) =>
      left.startTick - right.startTick ||
      left.endTick - right.endTick ||
      left.abilityId.localeCompare(right.abilityId),
    )
    .map((segment) => {
      let row = 0;

      while (lastEndTickByRow[row] !== undefined && lastEndTickByRow[row] >= segment.startTick) {
        row += 1;
      }

      lastEndTickByRow[row] = segment.endTick;

      const definition = input.abilityDefinitions[segment.abilityId];

      return {
        abilityId: segment.abilityId,
        name: definition?.name ?? segment.abilityId,
        iconPath: definition?.iconPath,
        startTick: segment.startTick,
        endTick: segment.endTick,
        span: segment.endTick - segment.startTick + 1,
        row,
      };
    });
}

function collectTimelineAbilityIds(
  tickCount: number,
  cooldownTimeline: Record<number, Record<EntityId, number>>,
): EntityId[] {
  const ids = new Set<EntityId>();

  for (let tick = 0; tick < tickCount; tick += 1) {
    for (const abilityId of Object.keys(cooldownTimeline[tick] ?? {})) {
      ids.add(abilityId);
    }
  }

  return [...ids];
}

function buildSegmentsForCooldown(
  abilityId: EntityId,
  tickCount: number,
  cooldownTimeline: Record<number, Record<EntityId, number>>,
): Array<PendingCooldownRun & { abilityId: EntityId }> {
  const segments: Array<PendingCooldownRun & { abilityId: EntityId }> = [];
  let activeRun: PendingCooldownRun | null = null;

  for (let tick = 0; tick < tickCount; tick += 1) {
    const cooldownEndTick = cooldownTimeline[tick]?.[abilityId];
    const isActive = typeof cooldownEndTick === 'number' && tick < cooldownEndTick;

    if (isActive) {
      if (!activeRun) {
        activeRun = {
          startTick: tick,
          endTick: tick,
        };
      } else {
        activeRun.endTick = tick;
      }

      continue;
    }

    if (activeRun) {
      segments.push({
        abilityId,
        ...activeRun,
      });
      activeRun = null;
    }
  }

  if (activeRun) {
    segments.push({
      abilityId,
      ...activeRun,
    });
  }

  return segments;
}
