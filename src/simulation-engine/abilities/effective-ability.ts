import type { AbilityDefinition, EntityId } from '../../game-data/types';
import type { RotationAction, SimulationConfig } from '../models';
import { applyAdrenalineCostModifiers } from './effective-ability.costs';
import {
  DEADSHOT_ABILITY_ID,
  ESSENCE_OF_FINALITY_ABILITY_ID,
  RANGED_ABILITY_ID,
  SPLIT_SOUL_ABILITY_ID,
  WEAPON_SPECIAL_ATTACK_ABILITY_ID,
} from './effective-ability.constants';
import {
  resolveEffectiveDeadshotDefinition,
  resolveEffectiveEofAbilityDefinition,
  resolveEffectiveRangedBasicDefinition,
  resolveEffectiveWeaponSpecialDefinition,
} from './effective-ability.overrides';
import { projectSimulationConfigAtTick } from '../state/projected-gear-state';

export {
  BALANCE_BY_FORCE_ABILITY_ID,
  DEADSHOT_ABILITY_ID,
  ESSENCE_OF_FINALITY_ABILITY_ID,
  RANGED_ABILITY_ID,
  SPLIT_SOUL_ABILITY_ID,
  SHADOWFALL_ABILITY_ID,
  WEAPON_SPECIAL_ATTACK_ABILITY_ID,
} from './effective-ability.constants';

export function resolveEffectiveAbilityDefinition(
  config: SimulationConfig,
  action: RotationAction | null,
): AbilityDefinition | null {
  const projectedConfig = projectSimulationConfigForAction(config, action);
  const abilityId = readAbilityId(action);
  if (!abilityId) {
    return null;
  }

  const baseAbility = projectedConfig.gameData.abilities[abilityId];
  if (!baseAbility) {
    return null;
  }

  if (abilityId === ESSENCE_OF_FINALITY_ABILITY_ID) {
    return applyAdrenalineCostModifiers(
      projectedConfig,
      resolveEffectiveEofAbilityDefinition(projectedConfig, baseAbility),
    );
  }

  if (abilityId === RANGED_ABILITY_ID) {
    return applyAdrenalineCostModifiers(
      projectedConfig,
      resolveEffectiveRangedBasicDefinition(projectedConfig, baseAbility),
    );
  }

  if (abilityId === DEADSHOT_ABILITY_ID) {
    return applyAdrenalineCostModifiers(
      projectedConfig,
      resolveEffectiveDeadshotDefinition(projectedConfig, baseAbility),
    );
  }

  if (abilityId === WEAPON_SPECIAL_ATTACK_ABILITY_ID) {
    return applyAdrenalineCostModifiers(
      projectedConfig,
      resolveEffectiveWeaponSpecialDefinition(projectedConfig, baseAbility),
    );
  }

  return applyAdrenalineCostModifiers(projectedConfig, baseAbility);
}

function readAbilityId(action: RotationAction | null): EntityId | null {
  const abilityId = action?.payload['abilityId'];
  return typeof abilityId === 'string' && abilityId.length > 0 ? abilityId : null;
}

function projectSimulationConfigForAction(
  config: SimulationConfig,
  action: RotationAction | null,
): SimulationConfig {
  if (!action) {
    return config;
  }

  return projectSimulationConfigAtTick(config, action.tick);
}
