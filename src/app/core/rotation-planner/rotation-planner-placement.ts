import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition, AbilityPlannerLane } from '../../../game-data/types';
import type { ItemInstanceConfig } from '../../../simulation-engine/models';
import type { PlayerStats, RotationAction, ValidationIssue } from '../../../simulation-engine/models';
import { evaluateAbilityAvailability } from '../../../simulation-engine/rules/ability-availability';
import type { BuffSelectionState } from '../buffs/persistent-buff-config';
import type { GearBuilderState } from '../gear/gear-state';
import { projectGearStateAtTick } from '../gear/project-gear-state';
import {
  canPlaceAbilityAtTick,
  type PlannerAbilityDropPayload,
} from './rotation-planner.utils';

export interface AbilityPlacementEvaluationResult {
  isPlaceable: boolean;
  issue?: ValidationIssue;
}

function isItemInstance(value: ItemInstanceConfig | undefined): value is ItemInstanceConfig {
  return Boolean(value);
}

export function canPlaceAbilityOnPlannerLane(
  abilityDefinition: AbilityDefinition,
  lane: AbilityPlannerLane,
): boolean {
  const allowedLanes = abilityDefinition.plannerPlacement?.allowedLanes;
  if (allowedLanes?.length) {
    return allowedLanes.includes(lane);
  }

  return lane === 'ability' || abilityDefinition.subtype === 'utility';
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
  if (!canPlaceAbilityOnPlannerLane(input.abilityDefinition, 'ability')) {
    return {
      isPlaceable: false,
      issue: {
        code: 'ability.invalid_lane',
        severity: 'error',
        tick: input.tick,
        message: `${input.abilityDefinition.name} can only be placed on the non-GCD lane.`,
      },
    };
  }

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

  const projectedGearState = projectGearStateAtTick(
    input.gearState,
    input.catalog.items,
    input.nonGcdActions,
    input.tick,
  );
  const equippedInstances = Object.values(projectedGearState.equipment).filter(isItemInstance);
  const availability = evaluateAbilityAvailability(input.abilityDefinition, {
    playerStats: input.playerStats,
    equippedItems: equippedInstances
      .map((item) => input.catalog.items[item.definitionId])
      .filter((item): item is NonNullable<typeof input.catalog.items[string]> => Boolean(item)),
    inventoryItems: projectedGearState.inventory
      .map((item) => input.catalog.items[item.definitionId])
      .filter((item): item is NonNullable<typeof input.catalog.items[string]> => Boolean(item)),
    equippedInstances,
  });

  if (!availability.isAvailable) {
    return {
      isPlaceable: false,
      issue: {
        code: 'ability.unavailable',
        severity: 'error',
        tick: input.tick,
        message: availability.issues[0]?.message ?? `${input.abilityDefinition.name} is not available.`,
      },
    };
  }

  return {
    isPlaceable: true,
  };
}
