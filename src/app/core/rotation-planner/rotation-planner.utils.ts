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
  actionType: Extract<RotationAction['actionType'], 'gear-swap' | 'ammo-swap' | 'vulnerability-bomb'>;
}

export interface PlannerNonGcdDropPayload {
  sourceType: 'catalog' | 'timeline';
  templateId: string;
  actionId?: string;
}

export function isAbilityPlacementTick(tick: number): boolean {
  return tick % GCD_TICKS === 0;
}

export function snapTickToAbilityWindowStart(tick: number): number {
  return Math.floor(tick / GCD_TICKS) * GCD_TICKS;
}

export function canPlaceAbilityAtTick(
  abilityActions: RotationAction[],
  abilityDefinitions: Record<EntityId, AbilityDefinition>,
  tickCount: number,
  abilityDefinition: AbilityDefinition,
  tick: number,
  draggedActionId?: string,
): boolean {
  const snappedTick = snapTickToAbilityWindowStart(tick);

  if (!isAbilityPlacementTick(snappedTick)) {
    return false;
  }

  const targetSpan = getAbilityTimelineSpan(abilityDefinition);

  if (snappedTick + targetSpan > tickCount) {
    return false;
  }

  return !abilityActions.some((action) => {
    if (action.id === draggedActionId) {
      return false;
    }

    const existingDefinition = resolveAbilityDefinition(action, abilityDefinitions);
    if (!existingDefinition) {
      return action.tick === snappedTick;
    }

    return rangesOverlap(
      snappedTick,
      snappedTick + targetSpan,
      action.tick,
      action.tick + getAbilityTimelineSpan(existingDefinition),
    );
  });
}

export function upsertAbilityAction(
  abilityActions: RotationAction[],
  payload: PlannerAbilityDropPayload,
  tick: number,
): RotationAction[] {
  if (payload.sourceType === 'timeline' && payload.actionId) {
    return abilityActions.map((action) =>
      action.id === payload.actionId
        ? {
            ...action,
            tick,
          }
        : action,
    );
  }

  const nextActionId = createAbilityActionId(payload.abilityId, tick, abilityActions);

  return [
    ...abilityActions,
    {
      id: nextActionId,
      tick,
      lane: 'ability' as const,
      actionType: 'ability-use' as const,
      payload: {
        abilityId: payload.abilityId,
      },
    } satisfies RotationAction,
  ].sort((left, right) => left.tick - right.tick);
}

export function previewAbilityActionsWithPlacement(
  abilityActions: RotationAction[],
  payload: PlannerAbilityDropPayload,
  tick: number,
): {
  abilityActions: RotationAction[];
  targetActionId: string;
} {
  if (payload.sourceType === 'timeline' && payload.actionId) {
    return {
      abilityActions: abilityActions.map((action) =>
        action.id === payload.actionId
          ? {
              ...action,
              tick,
            }
          : action,
      ),
      targetActionId: payload.actionId,
    };
  }

  const targetActionId = '__planner-preview-placement__';

  return {
    abilityActions: [
      ...abilityActions,
      {
        id: targetActionId,
        tick,
        lane: 'ability' as const,
        actionType: 'ability-use' as const,
        payload: {
          abilityId: payload.abilityId,
        },
      } satisfies RotationAction,
    ].sort((left, right) => left.tick - right.tick),
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

function resolveChannelTimelineSpan(abilityDefinition: AbilityDefinition): number {
  if (!abilityDefinition.isChanneled) {
    return abilityDefinition.channelDurationTicks ?? 0;
  }

  return abilityDefinition.channelDurationTicks ?? 0;
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

function rangesOverlap(
  startA: number,
  endAExclusive: number,
  startB: number,
  endBExclusive: number,
): boolean {
  return startA < endBExclusive && startB < endAExclusive;
}

function comparePlannerActions(left: RotationAction, right: RotationAction): number {
  if (left.tick !== right.tick) {
    return left.tick - right.tick;
  }

  return left.id.localeCompare(right.id);
}
