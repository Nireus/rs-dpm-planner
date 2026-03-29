import type { AbilityDefinition, BuffDefinition, EntityId } from '../../../game-data/types';

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
  buffTimeline?: Record<number, EntityId[]>;
  buffDefinitions?: Record<EntityId, BuffDefinition>;
}

interface PendingCooldownRun {
  startTick: number;
  endTick: number;
}

export function buildPlannerCooldownLaneBars(
  input: BuildPlannerCooldownLaneBarsInput,
): PlannerCooldownLaneBar[] {
  const abilitySegments = collectTimelineAbilityIds(input.tickCount, input.cooldownTimeline).flatMap((abilityId) =>
    buildSegmentsForCooldown(abilityId, input.tickCount, input.cooldownTimeline),
  );
  const generatedCooldownSegments =
    input.buffTimeline && input.buffDefinitions
      ? collectTimelineCooldownBuffIds(input.tickCount, input.buffTimeline, input.buffDefinitions).flatMap((buffId) =>
          buildSegmentsForGeneratedCooldown(buffId, input.tickCount, input.buffTimeline!),
        )
      : [];
  const segments = [...abilitySegments, ...generatedCooldownSegments];

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

      const abilityDefinition = input.abilityDefinitions[segment.abilityId];
      const buffDefinition = input.buffDefinitions?.[segment.abilityId];

      return {
        abilityId: segment.abilityId,
        name: abilityDefinition?.name ?? buffDefinition?.name ?? segment.abilityId,
        iconPath: abilityDefinition?.iconPath ?? buffDefinition?.iconPath,
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

function collectTimelineCooldownBuffIds(
  tickCount: number,
  buffTimeline: Record<number, EntityId[]>,
  buffDefinitions: Record<EntityId, BuffDefinition>,
): EntityId[] {
  const ids = new Set<EntityId>();

  for (let tick = 0; tick < tickCount; tick += 1) {
    for (const buffId of buffTimeline[tick] ?? []) {
      if (isCooldownLikeBuff(buffDefinitions[buffId])) {
        ids.add(buffId);
      }
    }
  }

  return [...ids];
}

function buildSegmentsForGeneratedCooldown(
  buffId: EntityId,
  tickCount: number,
  buffTimeline: Record<number, EntityId[]>,
): Array<PendingCooldownRun & { abilityId: EntityId }> {
  const segments: Array<PendingCooldownRun & { abilityId: EntityId }> = [];
  let activeRun: PendingCooldownRun | null = null;

  for (let tick = 0; tick < tickCount; tick += 1) {
    const isActive = (buffTimeline[tick] ?? []).includes(buffId);

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
        abilityId: buffId,
        ...activeRun,
      });
      activeRun = null;
    }
  }

  if (activeRun) {
    segments.push({
      abilityId: buffId,
      ...activeRun,
    });
  }

  return segments;
}

function isCooldownLikeBuff(definition: BuffDefinition | undefined): boolean {
  return definition?.effectRefs?.some((effectRef) => effectRef.endsWith('-cooldown')) ?? false;
}
