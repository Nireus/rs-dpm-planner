import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition } from '../../../game-data/types';
import type { PlayerStats, RotationAction, ValidationIssue } from '../../../simulation-engine/models';
import type { BuffSelectionState } from '../buffs/persistent-buff-config';
import type { GearBuilderState } from '../gear/gear-state';
import {
  canPlaceAbilityAtTick,
  type PlannerAbilityDropPayload,
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
  buffState: BuffSelectionState;
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

  return {
    isPlaceable: true,
  };
}
