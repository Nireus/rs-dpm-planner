import type { EntityId } from '../../game-data/types';
import type { RotationAction, SimulationConfig, ValidationIssue } from '../models';
import { skipsPreFightCooldown } from '../timeline/pre-fight';

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

interface CooldownAdjustment {
  abilityId: EntityId;
  reductionTicks: number;
}

export function resolveCooldownTimeline(config: SimulationConfig): CooldownTimelineResult {
  const abilityActions = [...config.rotationPlan.abilityActions]
    .filter((action) => !skipsPreFightCooldown(action))
    .sort((left, right) => left.tick - right.tick);
  const groupedActions = groupAbilityActionsByTick(abilityActions);
  const tickStates: CooldownTickState[] = [];
  const cooldownTimeline: Record<number, Record<EntityId, number>> = {};
  const validationIssues: ValidationIssue[] = [];
  let activeCooldowns = new Map<EntityId, number>();
  const pendingAdjustments = new Map<number, CooldownAdjustment[]>();

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
      scheduleCooldownAdjustmentsForAction(config, result.resolvedAbilityId, action, pendingAdjustments);
    }

    const adjustmentsAtTick = pendingAdjustments.get(tick) ?? [];
    if (adjustmentsAtTick.length > 0) {
      activeCooldowns = applyCooldownAdjustments(activeCooldowns, adjustmentsAtTick, tick);
      pendingAdjustments.delete(tick);
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
  resolvedAbilityId?: EntityId;
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
    resolvedAbilityId: ability.id,
  };
}

function scheduleCooldownAdjustmentsForAction(
  config: SimulationConfig,
  resolvedAbilityId: EntityId | undefined,
  action: RotationAction,
  pendingAdjustments: Map<number, CooldownAdjustment[]>,
): void {
  if (resolvedAbilityId !== 'piercing-shot') {
    return;
  }

  const ability = config.gameData.abilities[resolvedAbilityId];
  if (!ability) {
    return;
  }

  const reductionPerHit = getPiercingShotSnipeReductionPerHit(config);

  for (const hit of ability.hitSchedule) {
    const tick = action.tick + hit.tickOffset;
    const adjustmentsAtTick = pendingAdjustments.get(tick) ?? [];
    adjustmentsAtTick.push({
      abilityId: 'snipe',
      reductionTicks: reductionPerHit,
    });
    pendingAdjustments.set(tick, adjustmentsAtTick);
  }
}

function applyCooldownAdjustments(
  cooldowns: Map<EntityId, number>,
  adjustments: CooldownAdjustment[],
  currentTick: number,
): Map<EntityId, number> {
  const next = new Map(cooldowns);

  for (const adjustment of adjustments) {
    const currentEndTick = next.get(adjustment.abilityId);
    if (currentEndTick === undefined) {
      continue;
    }

    const reducedEndTick = Math.max(currentTick, currentEndTick - adjustment.reductionTicks);
    if (reducedEndTick > currentTick) {
      next.set(adjustment.abilityId, reducedEndTick);
    } else {
      next.delete(adjustment.abilityId);
    }
  }

  return next;
}

function getPiercingShotSnipeReductionPerHit(config: SimulationConfig): number {
  const baseReduction = 4;
  const additionalReduction = Object.values(config.gearSetup.equipment)
    .flatMap((item) => config.gameData.items[item?.definitionId ?? '']?.effectRefs ?? [])
    .reduce((total, effectRef) => total + parsePiercingShotSnipeReduction(effectRef), 0);

  return baseReduction + additionalReduction;
}

function parsePiercingShotSnipeReduction(effectRef: string): number {
  const match = /^piercing-shot-snipe-reduction:\+(\d+)ticks-per-hit$/.exec(effectRef);
  if (!match) {
    return 0;
  }

  return Number.parseInt(match[1] ?? '0', 10);
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
