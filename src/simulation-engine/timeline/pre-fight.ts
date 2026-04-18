import type { AbilityDefinition, EntityId } from '../../game-data/types';
import type {
  PreFightAbilityAction,
  PreFightPlan,
  RotationAction,
  SimulationConfig,
  ValidationIssue,
} from '../models';
import { GCD_TICKS } from './base-timeline';

export const MAX_PRE_FIGHT_GAP_TICKS = 600;

export const DEFAULT_PRE_FIGHT_PLAN: PreFightPlan = {
  gapTicks: 0,
  prebuildActions: [],
  prebuildNonGcdActions: [],
  stalledAbility: null,
};

export type PreFightSimulationPhase =
  | 'prebuild'
  | 'stalled-cast'
  | 'stalled-release';

export interface ScheduledPreBuildAction {
  action: PreFightAbilityAction;
  abilityId: EntityId;
  startTick: number;
  endTick: number;
  span: number;
}

export interface ScheduledPreBuildNonGcdAction {
  action: RotationAction;
  visualTick: number;
  tick: number;
}

export interface ScheduledStalledAbility {
  action: PreFightAbilityAction;
  abilityId: EntityId;
  castTick: number;
  releaseTick: number | null;
  releaseTargetActionId: string | null;
}

export interface PreFightSchedule {
  gapTicks: number;
  setupTick: number;
  firstMainAbilityTick: number | null;
  prebuildActions: ScheduledPreBuildAction[];
  prebuildNonGcdActions: ScheduledPreBuildNonGcdAction[];
  stalledAbility: ScheduledStalledAbility | null;
}

export interface PreFightExpansion {
  config: SimulationConfig;
  offsetTicks: number;
  publicTickCount: number;
  validationIssues: ValidationIssue[];
}

export function normalizePreFightPlan(input: PreFightPlan | null | undefined): PreFightPlan {
  if (!input || typeof input !== 'object') {
    return cloneDefaultPreFightPlan();
  }

  return {
    gapTicks: clampPreFightGapTicks(input.gapTicks),
    prebuildActions: normalizePreFightAbilityActions(input.prebuildActions, 'prebuild'),
    prebuildNonGcdActions: normalizePreFightNonGcdActions(input.prebuildNonGcdActions),
    stalledAbility: normalizePreFightAbilityAction(input.stalledAbility, 'stalled') ?? null,
  };
}

export function cloneDefaultPreFightPlan(): PreFightPlan {
  return {
    gapTicks: DEFAULT_PRE_FIGHT_PLAN.gapTicks,
    prebuildActions: [],
    prebuildNonGcdActions: [],
    stalledAbility: null,
  };
}

export function clampPreFightGapTicks(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number'
    ? value
    : Number.parseInt(typeof value === 'string' ? value.trim() : '', 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_PRE_FIGHT_PLAN.gapTicks;
  }

  return Math.max(0, Math.min(MAX_PRE_FIGHT_GAP_TICKS, Math.trunc(parsed)));
}

export function hasMeaningfulPreFightPlan(plan: PreFightPlan | null | undefined): boolean {
  const normalized = normalizePreFightPlan(plan);
  return normalized.prebuildActions.length > 0 ||
    (normalized.prebuildNonGcdActions?.length ?? 0) > 0 ||
    normalized.stalledAbility !== null;
}

export function buildPreFightSchedule(input: {
  preFight: PreFightPlan | null | undefined;
  abilityDefinitions: Record<EntityId, AbilityDefinition>;
  mainAbilityActions?: RotationAction[];
}): PreFightSchedule {
  const preFight = normalizePreFightPlan(input.preFight);
  const setupTick = -preFight.gapTicks;
  const firstMainAbilityAction = [...(input.mainAbilityActions ?? [])]
    .filter((action) => action.lane === 'ability' && action.actionType === 'ability-use')
    .sort((left, right) => left.tick - right.tick || left.id.localeCompare(right.id))[0] ?? null;

  let cursorTick = setupTick;
  const scheduledPrebuildActions: ScheduledPreBuildAction[] = [];

  for (const action of [...preFight.prebuildActions].reverse()) {
    const ability = input.abilityDefinitions[action.abilityId];
    const span = ability ? getPreFightAbilityTimelineSpan(ability) : GCD_TICKS;
    const startTick = cursorTick - span;

    scheduledPrebuildActions.push({
      action,
      abilityId: action.abilityId,
      startTick,
      endTick: cursorTick,
      span,
    });

    cursorTick = startTick;
  }

  scheduledPrebuildActions.reverse();
  const scheduledPrebuildNonGcdActions = [...(preFight.prebuildNonGcdActions ?? [])]
    .map<ScheduledPreBuildNonGcdAction>((action) => ({
      action,
      visualTick: action.tick,
      tick: mapPreFightVisualTickToSimulationTick(action.tick, setupTick),
    }))
    .sort((left, right) => left.tick - right.tick || left.action.id.localeCompare(right.action.id));

  return {
    gapTicks: preFight.gapTicks,
    setupTick,
    firstMainAbilityTick: firstMainAbilityAction?.tick ?? null,
    prebuildActions: scheduledPrebuildActions,
    prebuildNonGcdActions: scheduledPrebuildNonGcdActions,
    stalledAbility: preFight.stalledAbility
      ? {
          action: preFight.stalledAbility,
          abilityId: preFight.stalledAbility.abilityId,
          castTick: setupTick,
          releaseTick: firstMainAbilityAction?.tick ?? null,
          releaseTargetActionId: firstMainAbilityAction?.id ?? null,
        }
      : null,
  };
}

export function canStallAbility(ability: AbilityDefinition | null | undefined): boolean {
  return Boolean(ability) && ability?.isChanneled !== true;
}

export function expandPreFightSimulationConfig(config: SimulationConfig): PreFightExpansion | null {
  const preFight = normalizePreFightPlan(config.rotationPlan.preFight);

  if (!hasMeaningfulPreFightPlan(preFight)) {
    return null;
  }

  const validationIssues: ValidationIssue[] = [];
  const schedule = buildPreFightSchedule({
    preFight,
    abilityDefinitions: config.gameData.abilities,
    mainAbilityActions: config.rotationPlan.abilityActions,
  });
  const scheduledTicks = [
    ...schedule.prebuildActions.map((action) => action.startTick),
    ...schedule.prebuildNonGcdActions.map((action) => action.tick),
    schedule.stalledAbility?.castTick ?? 0,
  ];
  const earliestPublicTick = Math.min(0, ...scheduledTicks);
  const offsetTicks = -earliestPublicTick;
  const shiftedMainAbilityActions = config.rotationPlan.abilityActions.map((action) =>
    shiftActionTick(action, offsetTicks),
  );
  const syntheticNonGcdActions = schedule.prebuildNonGcdActions.map((scheduledAction) =>
    createSyntheticPreFightNonGcdAction(scheduledAction.action, scheduledAction.tick + offsetTicks),
  );
  const shiftedNonGcdActions = [
    ...syntheticNonGcdActions,
    ...config.rotationPlan.nonGcdActions.map((action) =>
      shiftActionTick(action, offsetTicks),
    ),
  ].sort((left, right) => left.tick - right.tick || left.id.localeCompare(right.id));
  const syntheticAbilityActions: RotationAction[] = [];

  for (const scheduledAction of schedule.prebuildActions) {
    syntheticAbilityActions.push(createSyntheticAbilityAction({
      id: scheduledAction.action.id,
      abilityId: scheduledAction.abilityId,
      tick: scheduledAction.startTick + offsetTicks,
      phase: 'prebuild',
    }));
  }

  if (schedule.stalledAbility) {
    const stalledAbility = config.gameData.abilities[schedule.stalledAbility.abilityId];

    if (!stalledAbility) {
      validationIssues.push({
        code: 'pre_fight.stall_unknown_ability',
        severity: 'error',
        tick: schedule.stalledAbility.castTick + offsetTicks,
        relatedActionId: schedule.stalledAbility.action.id,
        message: `Stalled ability "${schedule.stalledAbility.abilityId}" is not in the ability catalog.`,
      });
    } else if (!canStallAbility(stalledAbility)) {
      validationIssues.push({
        code: 'pre_fight.stall_channelled_ability',
        severity: 'error',
        tick: schedule.stalledAbility.castTick + offsetTicks,
        relatedActionId: schedule.stalledAbility.action.id,
        message: `${stalledAbility.name} is channelled and cannot be ability stalled.`,
      });
    } else {
      syntheticAbilityActions.push(createSyntheticAbilityAction({
        id: schedule.stalledAbility.action.id,
        abilityId: schedule.stalledAbility.abilityId,
        tick: schedule.stalledAbility.castTick + offsetTicks,
        phase: 'stalled-cast',
      }));

      if (schedule.stalledAbility.releaseTick === null) {
        validationIssues.push({
          code: 'pre_fight.stall_no_release_target',
          severity: 'warning',
          tick: schedule.stalledAbility.castTick + offsetTicks,
          relatedActionId: schedule.stalledAbility.action.id,
          message: `${stalledAbility.name} is stalled, but there is no main ability to release it.`,
        });
      } else {
        syntheticAbilityActions.push(createSyntheticAbilityAction({
          id: `${schedule.stalledAbility.action.id}:release`,
          abilityId: schedule.stalledAbility.abilityId,
          tick: schedule.stalledAbility.releaseTick + offsetTicks,
          phase: 'stalled-release',
          releaseTargetActionId: schedule.stalledAbility.releaseTargetActionId ?? undefined,
        }));
      }
    }
  }

  const expandedAbilityActions = [
    ...syntheticAbilityActions,
    ...shiftedMainAbilityActions,
  ].sort(compareExpandedAbilityActions);

  return {
    config: {
      ...config,
      rotationPlan: {
        ...config.rotationPlan,
        tickCount: config.rotationPlan.tickCount + offsetTicks,
        nonGcdActions: shiftedNonGcdActions,
        abilityActions: expandedAbilityActions,
        preFight,
      },
    },
    offsetTicks,
    publicTickCount: config.rotationPlan.tickCount,
    validationIssues,
  };
}

export function readPreFightSimulationPhase(action: RotationAction): PreFightSimulationPhase | null {
  const phase = action.payload['preFightPhase'];
  return phase === 'prebuild' || phase === 'stalled-cast' || phase === 'stalled-release'
    ? phase
    : null;
}

export function isPreFightSimulationAction(action: RotationAction): boolean {
  return readPreFightSimulationPhase(action) !== null;
}

export function isPreFightPrebuildAction(action: RotationAction): boolean {
  return readPreFightSimulationPhase(action) === 'prebuild';
}

export function isStalledCastAction(action: RotationAction): boolean {
  return readPreFightSimulationPhase(action) === 'stalled-cast';
}

export function isStalledReleaseAction(action: RotationAction): boolean {
  return readPreFightSimulationPhase(action) === 'stalled-release';
}

export function skipsPreFightAdrenaline(action: RotationAction): boolean {
  return isPreFightSimulationAction(action);
}

export function skipsPreFightCooldown(action: RotationAction): boolean {
  return isStalledReleaseAction(action);
}

export function skipsPreFightHits(action: RotationAction): boolean {
  return isStalledCastAction(action);
}

export function getPreFightAbilityTimelineSpan(abilityDefinition: AbilityDefinition): number {
  const channelSpan = resolveChannelTimelineSpan(abilityDefinition);
  return Math.max(GCD_TICKS, channelSpan);
}

function normalizePreFightAbilityActions(
  actions: PreFightAbilityAction[] | undefined,
  idPrefix: string,
): PreFightAbilityAction[] {
  if (!Array.isArray(actions)) {
    return [];
  }

  return actions
    .map((action, index) => normalizePreFightAbilityAction(action, `${idPrefix}-${index + 1}`))
    .filter((action): action is PreFightAbilityAction => Boolean(action));
}

function normalizePreFightAbilityAction(
  action: PreFightAbilityAction | null | undefined,
  fallbackId: string,
): PreFightAbilityAction | null {
  if (!action || typeof action !== 'object' || typeof action.abilityId !== 'string' || !action.abilityId) {
    return null;
  }

  return {
    id: typeof action.id === 'string' && action.id ? action.id : `pre-fight-${fallbackId}-${action.abilityId}`,
    abilityId: action.abilityId,
  };
}

function normalizePreFightNonGcdActions(
  actions: RotationAction[] | undefined,
): RotationAction[] {
  if (!Array.isArray(actions)) {
    return [];
  }

  return actions
    .filter(
      (action): action is RotationAction =>
        typeof action?.id === 'string' &&
        action.id.length > 0 &&
        typeof action.tick === 'number' &&
        Number.isFinite(action.tick) &&
        action.lane === 'non-gcd' &&
        typeof action.actionType === 'string' &&
        typeof action.payload === 'object' &&
        action.payload !== null,
    )
    .map((action) => ({
      id: action.id,
      tick: Math.min(-1, Math.trunc(action.tick)),
      lane: 'non-gcd' as const,
      actionType: action.actionType,
      payload: sanitizePreFightPayload(action.payload),
    }))
    .sort((left, right) => left.tick - right.tick || left.id.localeCompare(right.id));
}

function sanitizePreFightPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) =>
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean',
    ),
  );
}

function createSyntheticAbilityAction(input: {
  id: string;
  abilityId: EntityId;
  tick: number;
  phase: PreFightSimulationPhase;
  releaseTargetActionId?: string;
}): RotationAction {
  return {
    id: input.id,
    tick: input.tick,
    lane: 'ability',
    actionType: 'ability-use',
    payload: {
      abilityId: input.abilityId,
      preFightPhase: input.phase,
      releaseTargetActionId: input.releaseTargetActionId,
    },
  };
}

function createSyntheticPreFightNonGcdAction(
  action: RotationAction,
  tick: number,
): RotationAction {
  return {
    ...action,
    tick,
    payload: {
      ...action.payload,
      preFightPhase: 'prebuild',
    },
  };
}

export function mapPreFightVisualTickToSimulationTick(visualTick: number, setupTick: number): number {
  return Math.trunc(visualTick) + setupTick + GCD_TICKS;
}

function shiftActionTick(action: RotationAction, offsetTicks: number): RotationAction {
  if (offsetTicks === 0) {
    return action;
  }

  return {
    ...action,
    tick: action.tick + offsetTicks,
  };
}

function compareExpandedAbilityActions(left: RotationAction, right: RotationAction): number {
  if (left.tick !== right.tick) {
    return left.tick - right.tick;
  }

  const priorityDelta = phasePriority(readPreFightSimulationPhase(left)) -
    phasePriority(readPreFightSimulationPhase(right));
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return left.id.localeCompare(right.id);
}

function phasePriority(phase: PreFightSimulationPhase | null): number {
  switch (phase) {
    case 'prebuild':
      return 0;
    case 'stalled-cast':
      return 1;
    case 'stalled-release':
      return 2;
    default:
      return 3;
  }
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
