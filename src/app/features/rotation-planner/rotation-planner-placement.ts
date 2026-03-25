import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition } from '../../../game-data/types';
import type { PlayerStats, RotationAction, ValidationIssue } from '../../../simulation-engine/models';
import { resolveAdrenalineTimeline } from '../../../simulation-engine/resolvers/adrenaline';
import { resolveCooldownTimeline } from '../../../simulation-engine/resolvers/cooldowns';
import type { GearBuilderState } from '../gear/gear-builder.utils';
import { buildRotationPlannerSimulationConfig, type PlannerBuffStateSnapshot } from './rotation-planner-simulation';
import {
  canPlaceAbilityAtTick,
  type PlannerAbilityDropPayload,
  previewAbilityActionsWithPlacement,
} from './rotation-planner.utils';

export interface AbilityPlacementEvaluationResult {
  isPlaceable: boolean;
  issue?: ValidationIssue;
}

export function evaluateAbilityPlacement(input: {
  abilityActions: RotationAction[];
  nonGcdActions: RotationAction[];
  abilityDefinitions: Record<string, AbilityDefinition>;
  tickCount: number;
  startingAdrenaline: number;
  abilityDefinition: AbilityDefinition;
  tick: number;
  payload: PlannerAbilityDropPayload;
  catalog: GameDataCatalog;
  playerStats: PlayerStats;
  gearState: GearBuilderState;
  buffState: PlannerBuffStateSnapshot;
}): AbilityPlacementEvaluationResult {
  if (
    !canPlaceAbilityAtTick(
      input.abilityActions,
      input.abilityDefinitions,
      input.tickCount,
      input.abilityDefinition,
      input.tick,
      input.payload.actionId,
    )
  ) {
    return {
      isPlaceable: false,
    };
  }

  const preview = previewAbilityActionsWithPlacement(input.abilityActions, input.payload, input.tick);
  const simulationConfig = buildRotationPlannerSimulationConfig({
    catalog: input.catalog,
    playerStats: input.playerStats,
    gearState: input.gearState,
    buffState: input.buffState,
    rotationPlan: {
      startingAdrenaline: input.startingAdrenaline,
      tickCount: input.tickCount,
      nonGcdActions: input.nonGcdActions,
      abilityActions: preview.abilityActions,
    },
  });

  const adrenalineIssue = resolveAdrenalineTimeline(simulationConfig).validationIssues.find(
    (issue) => issue.relatedActionId === preview.targetActionId,
  );
  if (adrenalineIssue) {
    return {
      isPlaceable: false,
      issue: adrenalineIssue,
    };
  }

  const cooldownIssue = resolveCooldownTimeline(simulationConfig).validationIssues.find(
    (issue) => issue.relatedActionId === preview.targetActionId,
  );
  if (cooldownIssue) {
    return {
      isPlaceable: false,
      issue: cooldownIssue,
    };
  }

  return {
    isPlaceable: true,
  };
}
