import type { AbilityDefinition, EntityId } from '../../../game-data/types';
import type { RotationAction } from '../../../simulation-engine/models';
import { GCD_TICKS } from '../../../simulation-engine/timeline';

export interface PlannerAbilityDropPayload {
  sourceType: 'catalog' | 'timeline';
  abilityId: EntityId;
  actionId?: string;
}

export interface PlannerNonGcdTemplate {
  id: string;
  label: string;
  shortLabel: string;
  iconPath?: string;
  actionType: Extract<RotationAction['actionType'], 'adrenaline-potion' | 'gear-swap' | 'ammo-swap' | 'vulnerability-bomb'>;
}

export interface PlannerNonGcdDropPayload {
  sourceType: 'catalog' | 'timeline';
  templateId: string;
  actionId?: string;
}

export interface PlannerAbilityGapControl {
  tick: number;
  shiftTicks: number;
  shiftFromTick: number;
}

export function isAbilityPlacementTick(
  abilityActions: RotationAction[],
  abilityDefinitions: Record<EntityId, AbilityDefinition>,
  tickCount: number,
  tick: number,
): boolean {
  return buildAbilityPlacementTicks(abilityActions, abilityDefinitions, tickCount).includes(tick);
}

export function snapTickToAbilityWindowStart(
  abilityActions: RotationAction[],
  abilityDefinitions: Record<EntityId, AbilityDefinition>,
  tickCount: number,
  tick: number,
): number {
  const placementTicks = buildAbilityPlacementTicks(abilityActions, abilityDefinitions, tickCount)
    .filter((placementTick) => placementTick <= tick);

  return placementTicks.at(-1) ?? 0;
}

export function buildAbilityPlacementTicks(
  abilityActions: RotationAction[],
  abilityDefinitions: Record<EntityId, AbilityDefinition>,
  tickCount: number,
): number[] {
  const orderedActions = [...abilityActions]
    .filter((action) => action.lane === 'ability')
    .sort(comparePlannerActions);
  const placementTicks: number[] = [];
  let nextWindowStart = 0;

  for (const action of orderedActions) {
    while (nextWindowStart < action.tick && nextWindowStart < tickCount) {
      placementTicks.push(nextWindowStart);
      nextWindowStart += GCD_TICKS;
    }

    if (action.tick < tickCount) {
      placementTicks.push(action.tick);
    }

    const definition = resolveAbilityDefinition(action, abilityDefinitions);
    const span = definition ? getAbilityTimelineSpan(definition) : GCD_TICKS;
    nextWindowStart = action.tick + span;
  }

  while (nextWindowStart < tickCount) {
    placementTicks.push(nextWindowStart);
    nextWindowStart += GCD_TICKS;
  }

  return [...new Set(placementTicks)].sort((left, right) => left - right);
}

export function canPlaceAbilityAtTick(
  abilityActions: RotationAction[],
  abilityDefinitions: Record<EntityId, AbilityDefinition>,
  tickCount: number,
  abilityDefinition: AbilityDefinition,
  tick: number,
  draggedActionId?: string,
): boolean {
  const snappedTick = snapTickToAbilityWindowStart(
    abilityActions,
    abilityDefinitions,
    tickCount,
    tick,
  );

  if (!isAbilityPlacementTick(abilityActions, abilityDefinitions, tickCount, snappedTick)) {
    return false;
  }

  return buildShiftedAbilityActions({
    abilityActions,
    abilityDefinitions,
    payload: {
      sourceType: draggedActionId ? 'timeline' : 'catalog',
      abilityId: abilityDefinition.id,
      actionId: draggedActionId,
    },
    tick: snappedTick,
    tickCount,
  }) !== null;
}

export function upsertAbilityAction(
  abilityActions: RotationAction[],
  abilityDefinitions: Record<EntityId, AbilityDefinition>,
  payload: PlannerAbilityDropPayload,
  tick: number,
): RotationAction[] {
  return (
    buildShiftedAbilityActions({
      abilityActions,
      abilityDefinitions,
      payload,
      tick,
      tickCount: Number.POSITIVE_INFINITY,
    }) ?? abilityActions
  );
}

export function previewAbilityActionsWithPlacement(
  abilityActions: RotationAction[],
  abilityDefinitions: Record<EntityId, AbilityDefinition>,
  payload: PlannerAbilityDropPayload,
  tick: number,
): {
  abilityActions: RotationAction[];
  targetActionId: string;
} {
  const targetActionId = payload.sourceType === 'timeline' && payload.actionId
    ? payload.actionId
    : '__planner-preview-placement__';

  return {
    abilityActions:
      buildShiftedAbilityActions({
        abilityActions,
        abilityDefinitions,
        payload:
          payload.sourceType === 'timeline' && payload.actionId
            ? payload
            : {
                sourceType: 'catalog',
                abilityId: payload.abilityId,
                actionId: targetActionId,
              },
        tick,
        tickCount: Number.POSITIVE_INFINITY,
        forceActionId: targetActionId,
      }) ?? abilityActions,
    targetActionId,
  };
}

export function removeAbilityAction(
  abilityActions: RotationAction[],
  actionId: string,
): RotationAction[] {
  return abilityActions.filter((action) => action.id !== actionId);
}

export function upsertNonGcdAction(
  nonGcdActions: RotationAction[],
  template: PlannerNonGcdTemplate,
  tick: number,
  payload?: PlannerNonGcdDropPayload,
): RotationAction[] {
  if (payload?.sourceType === 'timeline' && payload.actionId) {
    return nonGcdActions
      .map((action) =>
        action.id === payload.actionId
          ? {
              ...action,
              tick,
            }
          : action,
      )
      .sort(comparePlannerActions);
  }

  const nextActionId = createNonGcdActionId(template.id, tick, nonGcdActions);

  return [
    ...nonGcdActions,
    {
      id: nextActionId,
      tick,
      lane: 'non-gcd',
      actionType: template.actionType,
      payload: {
        templateId: template.id,
        label: template.label,
        shortLabel: template.shortLabel,
        iconPath: template.iconPath,
      },
    } satisfies RotationAction,
  ].sort(comparePlannerActions);
}

export function updateNonGcdActionPayload(
  nonGcdActions: RotationAction[],
  actionId: string,
  payloadUpdate: Record<string, unknown>,
): RotationAction[] {
  return nonGcdActions.map((action) =>
    action.id === actionId
      ? {
          ...action,
          payload: {
            ...action.payload,
            ...payloadUpdate,
          },
        }
      : action,
  );
}

export function removeNonGcdAction(
  nonGcdActions: RotationAction[],
  actionId: string,
): RotationAction[] {
  return nonGcdActions.filter((action) => action.id !== actionId);
}

export function getNonGcdActionsAtTick(
  nonGcdActions: RotationAction[],
  tick: number,
): RotationAction[] {
  return nonGcdActions.filter((action) => action.tick === tick).sort(comparePlannerActions);
}

export function getAbilityTimelineSpan(abilityDefinition: AbilityDefinition): number {
  const channelSpan = resolveChannelTimelineSpan(abilityDefinition);

  return Math.max(GCD_TICKS, channelSpan);
}

export function buildAbilityGapControls(
  abilityActions: RotationAction[],
  abilityDefinitions: Record<EntityId, AbilityDefinition>,
): PlannerAbilityGapControl[] {
  const orderedActions = [...abilityActions]
    .filter((action) => action.lane === 'ability')
    .sort(comparePlannerActions);
  const controls: PlannerAbilityGapControl[] = [];
  let previousEndTick = 0;

  for (const action of orderedActions) {
    const definition = resolveAbilityDefinition(action, abilityDefinitions);
    const span = definition ? getAbilityTimelineSpan(definition) : GCD_TICKS;

    if (action.tick > previousEndTick) {
      const shiftTicks = action.tick - previousEndTick;
      const tick = action.tick - 1;

      if (shiftTicks >= GCD_TICKS) {
        controls.push({
          tick,
          shiftTicks,
          shiftFromTick: action.tick,
        });
      }
    }

    previousEndTick = Math.max(previousEndTick, action.tick + span);
  }

  return controls;
}

export function collapseAbilityGap(
  abilityActions: RotationAction[],
  control: PlannerAbilityGapControl,
): RotationAction[] {
  return abilityActions
    .map((action) =>
      action.tick >= control.shiftFromTick
        ? {
            ...action,
            tick: action.tick - control.shiftTicks,
          }
        : action,
    )
    .sort(comparePlannerActions);
}

function resolveChannelTimelineSpan(abilityDefinition: AbilityDefinition): number {
  if (!abilityDefinition.isChanneled) {
    return abilityDefinition.channelDurationTicks ?? 0;
  }

  const lastHitOffset = abilityDefinition.hitSchedule.reduce(
    (latestTick, hit) => Math.max(latestTick, hit.tickOffset),
    0,
  );

  if (lastHitOffset > 0) {
    return lastHitOffset;
  }

  return Math.max((abilityDefinition.channelDurationTicks ?? 0) - 1, 0);
}

function buildShiftedAbilityActions(input: {
  abilityActions: RotationAction[];
  abilityDefinitions: Record<EntityId, AbilityDefinition>;
  payload: PlannerAbilityDropPayload;
  tick: number;
  tickCount: number;
  forceActionId?: string;
}): RotationAction[] | null {
  const targetActionId = input.forceActionId ?? input.payload.actionId;
  const existingActions = input.abilityActions.filter((action) => action.id !== input.payload.actionId);
  const boundedTickCount = Number.isFinite(input.tickCount)
    ? input.tickCount
    : Math.max(
        input.tick + GCD_TICKS + 1,
        ...existingActions.map((action) => {
          const definition = resolveAbilityDefinition(action, input.abilityDefinitions);
          const span = definition ? getAbilityTimelineSpan(definition) : GCD_TICKS;
          return action.tick + span + GCD_TICKS;
        }),
      );
  const snappedTick = snapTickToAbilityWindowStart(
    existingActions,
    input.abilityDefinitions,
    boundedTickCount,
    input.tick,
  );
  const insertedAction = createAbilityPlacementAction(
    input.payload.abilityId,
    snappedTick,
    existingActions,
    targetActionId,
  );
  const insertionActionId = input.payload.sourceType === 'timeline'
    ? (targetActionId ?? input.payload.actionId)
    : insertedAction.id;

  const actions = input.payload.sourceType === 'timeline' && input.payload.actionId
    ? input.abilityActions.map((action) =>
        action.id === input.payload.actionId
          ? {
              ...action,
              tick: snappedTick,
            }
          : action,
      )
    : [...existingActions, insertedAction];

  if (!insertionActionId || !actions.some((action) => action.id === insertionActionId)) {
    return null;
  }

  const orderedActions = [...actions].sort((left, right) => {
    if (left.id === insertionActionId && right.id !== insertionActionId) {
      return left.tick === right.tick ? -1 : left.tick - right.tick;
    }

    if (right.id === insertionActionId && left.id !== insertionActionId) {
      return left.tick === right.tick ? 1 : left.tick - right.tick;
    }

    return comparePlannerActions(left, right);
  });

  let previousEndTick = 0;

  const shiftedActions = orderedActions.map((action) => {
    const definition = resolveAbilityDefinition(action, input.abilityDefinitions);
    const span = definition ? getAbilityTimelineSpan(definition) : GCD_TICKS;
    const shiftedTick = Math.max(action.tick, previousEndTick);

    previousEndTick = shiftedTick + span;

    return {
      ...action,
      tick: shiftedTick,
    };
  });

  if (shiftedActions.some((action) => {
    const definition = resolveAbilityDefinition(action, input.abilityDefinitions);
    const span = definition ? getAbilityTimelineSpan(definition) : GCD_TICKS;
    return action.tick + span > input.tickCount;
  })) {
    return null;
  }

  return shiftedActions.sort(comparePlannerActions);
}

function createAbilityPlacementAction(
  abilityId: EntityId,
  tick: number,
  abilityActions: RotationAction[],
  forcedActionId?: string,
): RotationAction {
  return {
    id: forcedActionId ?? createAbilityActionId(abilityId, tick, abilityActions),
    tick,
    lane: 'ability',
    actionType: 'ability-use',
    payload: {
      abilityId,
    },
  } satisfies RotationAction;
}

export function getAbilitySegment(
  action: RotationAction,
  abilityDefinition: AbilityDefinition,
  tick: number,
): 'single' | 'start' | 'middle' | 'end' | null {
  const span = getAbilityTimelineSpan(abilityDefinition);
  const offset = tick - action.tick;

  if (offset < 0 || offset >= span) {
    return null;
  }

  if (span === 1) {
    return 'single';
  }

  if (offset === 0) {
    return 'start';
  }

  if (offset === span - 1) {
    return 'end';
  }

  return 'middle';
}

function createAbilityActionId(
  abilityId: EntityId,
  tick: number,
  abilityActions: RotationAction[],
): string {
  let suffix = abilityActions.filter((action) => action.payload['abilityId'] === abilityId).length + 1;
  let candidate = `ability-${abilityId}-${tick}-${suffix}`;

  while (abilityActions.some((action) => action.id === candidate)) {
    suffix += 1;
    candidate = `ability-${abilityId}-${tick}-${suffix}`;
  }

  return candidate;
}

function createNonGcdActionId(
  templateId: string,
  tick: number,
  nonGcdActions: RotationAction[],
): string {
  let suffix = nonGcdActions.filter((action) => action.payload['templateId'] === templateId).length + 1;
  let candidate = `non-gcd-${templateId}-${tick}-${suffix}`;

  while (nonGcdActions.some((action) => action.id === candidate)) {
    suffix += 1;
    candidate = `non-gcd-${templateId}-${tick}-${suffix}`;
  }

  return candidate;
}

function resolveAbilityDefinition(
  action: RotationAction,
  abilityDefinitions: Record<EntityId, AbilityDefinition>,
): AbilityDefinition | null {
  const abilityId = action.payload['abilityId'];

  if (typeof abilityId !== 'string') {
    return null;
  }

  return abilityDefinitions[abilityId] ?? null;
}

function comparePlannerActions(left: RotationAction, right: RotationAction): number {
  if (left.tick !== right.tick) {
    return left.tick - right.tick;
  }

  return left.id.localeCompare(right.id);
}
