import type { EntityId } from '../../game-data/types';
import type { RotationAction, SimulationConfig, ValidationIssue } from '../models';

export const MIN_ADRENALINE = 0;
export const MAX_ADRENALINE = 100;

export interface AdrenalineTickState {
  tick: number;
  valueAtTickStart: number;
  valueAtTickEnd: number;
  actionsResolved: string[];
}

export interface AdrenalineTimelineResult {
  startingAdrenaline: number;
  adrenalineTimeline: number[];
  tickStates: AdrenalineTickState[];
  validationIssues: ValidationIssue[];
}

export function resolveAdrenalineTimeline(config: SimulationConfig): AdrenalineTimelineResult {
  const abilityActions = [...config.rotationPlan.abilityActions].sort((left, right) => left.tick - right.tick);
  const validationIssues: ValidationIssue[] = [];
  const tickStates: AdrenalineTickState[] = [];
  const adrenalineTimeline: number[] = [];
  const groupedActions = groupAbilityActionsByTick(abilityActions);
  let currentAdrenaline = clampAdrenaline(config.rotationPlan.startingAdrenaline);

  if (currentAdrenaline !== config.rotationPlan.startingAdrenaline) {
    validationIssues.push({
      code: 'adrenaline.starting_out_of_bounds',
      severity: 'warning',
      tick: 0,
      message: `Starting adrenaline ${config.rotationPlan.startingAdrenaline}% was clamped to ${currentAdrenaline}%.`,
    });
  }

  for (let tick = 0; tick < config.rotationPlan.tickCount; tick += 1) {
    const actionsAtTick = groupedActions.get(tick) ?? [];
    const valueAtTickStart = currentAdrenaline;
    const actionsResolved: string[] = [];

    for (const action of actionsAtTick) {
      const result = resolveAbilityActionAdrenaline(config, action, currentAdrenaline);

      if (result.issue) {
        validationIssues.push(result.issue);
        continue;
      }

      currentAdrenaline = result.nextAdrenaline;
      actionsResolved.push(action.id);
    }

    adrenalineTimeline.push(currentAdrenaline);
    tickStates.push({
      tick,
      valueAtTickStart,
      valueAtTickEnd: currentAdrenaline,
      actionsResolved,
    });
  }

  return {
    startingAdrenaline: currentAdrenalineForTimeline(config.rotationPlan.startingAdrenaline),
    adrenalineTimeline,
    tickStates,
    validationIssues,
  };
}

interface ResolveAbilityActionAdrenalineResult {
  nextAdrenaline: number;
  issue?: ValidationIssue;
}

function resolveAbilityActionAdrenaline(
  config: SimulationConfig,
  action: RotationAction,
  currentAdrenaline: number,
): ResolveAbilityActionAdrenalineResult {
  const abilityId = readAbilityId(action);

  if (!abilityId) {
    return {
      nextAdrenaline: currentAdrenaline,
      issue: createAdrenalineIssue(
        action,
        'ability.invalid_payload',
        'Ability action is missing abilityId.',
      ),
    };
  }

  const ability = config.gameData.abilities[abilityId];

  if (!ability) {
    return {
      nextAdrenaline: currentAdrenaline,
      issue: createAdrenalineIssue(
        action,
        'ability.missing_definition',
        `Unknown ability "${abilityId}".`,
      ),
    };
  }

  const adrenalineCost = Math.max(ability.adrenalineCost ?? 0, 0);
  const adrenalineGain = Math.max(ability.adrenalineGain ?? 0, 0);

  if (adrenalineCost > currentAdrenaline) {
    return {
      nextAdrenaline: currentAdrenaline,
      issue: createAdrenalineIssue(
        action,
        'ability.insufficient_adrenaline',
        `Ability "${ability.name}" requires ${adrenalineCost}% adrenaline but only ${currentAdrenaline}% is available.`,
      ),
    };
  }

  return {
    nextAdrenaline: clampAdrenaline(currentAdrenaline - adrenalineCost + adrenalineGain),
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

function currentAdrenalineForTimeline(startingAdrenaline: number): number {
  return clampAdrenaline(startingAdrenaline);
}

function clampAdrenaline(value: number): number {
  return Math.max(MIN_ADRENALINE, Math.min(MAX_ADRENALINE, value));
}

function readAbilityId(action: RotationAction): EntityId | null {
  const abilityId = action.payload['abilityId'];
  return typeof abilityId === 'string' && abilityId.length > 0 ? abilityId : null;
}

function createAdrenalineIssue(
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
