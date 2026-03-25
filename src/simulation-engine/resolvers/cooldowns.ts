import type { EntityId } from '../../game-data/types';
import type { RotationAction, SimulationConfig, ValidationIssue } from '../models';

export interface CooldownTickState {
  tick: number;
  cooldownsAtTickStart: Record<EntityId, number>;
  cooldownsAtTickEnd: Record<EntityId, number>;
  actionsResolved: string[];
}

export interface CooldownTimelineResult {
  cooldownTimeline: Record<number, Record<EntityId, number>>;
  tickStates: CooldownTickState[];
  validationIssues: ValidationIssue[];
}

export function resolveCooldownTimeline(config: SimulationConfig): CooldownTimelineResult {
  const abilityActions = [...config.rotationPlan.abilityActions].sort((left, right) => left.tick - right.tick);
  const groupedActions = groupAbilityActionsByTick(abilityActions);
  const tickStates: CooldownTickState[] = [];
  const cooldownTimeline: Record<number, Record<EntityId, number>> = {};
  const validationIssues: ValidationIssue[] = [];
  let activeCooldowns = new Map<EntityId, number>();

  for (let tick = 0; tick < config.rotationPlan.tickCount; tick += 1) {
    activeCooldowns = pruneExpiredCooldowns(activeCooldowns, tick);

    const actionsAtTick = groupedActions.get(tick) ?? [];
    const cooldownsAtTickStart = snapshotCooldownMap(activeCooldowns);
    const actionsResolved: string[] = [];

    for (const action of actionsAtTick) {
      const result = resolveAbilityActionCooldown(config, action, activeCooldowns, tick);

      if (result.issue) {
        validationIssues.push(result.issue);
        continue;
      }

      activeCooldowns = result.nextCooldowns;
      actionsResolved.push(action.id);
    }

    const cooldownsAtTickEnd = snapshotCooldownMap(activeCooldowns);
    cooldownTimeline[tick] = cooldownsAtTickEnd;
    tickStates.push({
      tick,
      cooldownsAtTickStart,
      cooldownsAtTickEnd,
      actionsResolved,
    });
  }

  return {
    cooldownTimeline,
    tickStates,
    validationIssues,
  };
}

interface ResolveAbilityActionCooldownResult {
  nextCooldowns: Map<EntityId, number>;
  issue?: ValidationIssue;
}

function resolveAbilityActionCooldown(
  config: SimulationConfig,
  action: RotationAction,
  currentCooldowns: Map<EntityId, number>,
  tick: number,
): ResolveAbilityActionCooldownResult {
  const abilityId = readAbilityId(action);

  if (!abilityId) {
    return {
      nextCooldowns: currentCooldowns,
      issue: createCooldownIssue(action, 'ability.invalid_payload', 'Ability action is missing abilityId.'),
    };
  }

  const ability = config.gameData.abilities[abilityId];

  if (!ability) {
    return {
      nextCooldowns: currentCooldowns,
      issue: createCooldownIssue(action, 'ability.missing_definition', `Unknown ability "${abilityId}".`),
    };
  }

  const nextAvailableTick = currentCooldowns.get(ability.id) ?? 0;

  if (tick < nextAvailableTick) {
    return {
      nextCooldowns: currentCooldowns,
      issue: createCooldownIssue(
        action,
        'ability.cooldown_conflict',
        `Ability "${ability.name}" is on cooldown until tick ${nextAvailableTick}.`,
      ),
    };
  }

  const nextCooldowns = new Map(currentCooldowns);
  const cooldownEndTick = tick + Math.max(ability.cooldownTicks, 0);

  if (cooldownEndTick > tick) {
    nextCooldowns.set(ability.id, cooldownEndTick);
  } else {
    nextCooldowns.delete(ability.id);
  }

  return {
    nextCooldowns,
  };
}

function groupAbilityActionsByTick(actions: RotationAction[]): Map<number, RotationAction[]> {
  const grouped = new Map<number, RotationAction[]>();

  for (const action of actions) {
    const bucket = grouped.get(action.tick);
    if (bucket) {
      bucket.push(action);
    } else {
      grouped.set(action.tick, [action]);
    }
  }

  return grouped;
}

function pruneExpiredCooldowns(
  cooldowns: Map<EntityId, number>,
  currentTick: number,
): Map<EntityId, number> {
  const next = new Map<EntityId, number>();

  for (const [abilityId, cooldownEndTick] of cooldowns.entries()) {
    if (currentTick < cooldownEndTick) {
      next.set(abilityId, cooldownEndTick);
    }
  }

  return next;
}

function snapshotCooldownMap(cooldowns: Map<EntityId, number>): Record<EntityId, number> {
  const snapshot: Record<EntityId, number> = {};

  for (const [abilityId, cooldownEndTick] of cooldowns.entries()) {
    snapshot[abilityId] = cooldownEndTick;
  }

  return snapshot;
}

function readAbilityId(action: RotationAction): EntityId | null {
  const abilityId = action.payload['abilityId'];
  return typeof abilityId === 'string' && abilityId.length > 0 ? abilityId : null;
}

function createCooldownIssue(
  action: RotationAction,
  code: string,
  message: string,
): ValidationIssue {
  return {
    code,
    severity: 'error',
    tick: action.tick,
    relatedActionId: action.id,
    message,
  };
}
