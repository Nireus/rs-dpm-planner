import { EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type { AbilityDefinition } from '../../game-data/types';
import type { SimulationConfig } from '../models';

export function applyAdrenalineCostModifiers(
  config: SimulationConfig,
  ability: AbilityDefinition,
): AbilityDefinition {
  const adrenalineCost = ability.adrenalineCost;
  if (adrenalineCost === undefined) {
    return ability;
  }

  if (ability.subtype === 'ultimate') {
    if (!hasVigourLikePassive(config)) {
      return ability;
    }

    return {
      ...ability,
      adrenalineCost: Math.max(0, adrenalineCost - 10),
    };
  }

  if (ability.subtype === 'special' && hasVigourLikePassive(config)) {
    return {
      ...ability,
      adrenalineCost: Math.round(adrenalineCost * 90 * 100) / 10000,
    };
  }

  return ability;
}

function hasVigourLikePassive(config: SimulationConfig): boolean {
  const ringInstance = config.gearSetup.equipment.ring;
  const ringDefinition = ringInstance ? config.gameData.items[ringInstance.definitionId] : null;
  const ringProvidesPassive =
    ringDefinition?.effectRefs?.includes(EFFECT_REF_IDS.vigourPassive) ?? false;
  const activeBuffIds = config.persistentBuffConfig.buffIds ?? [];
  const buffProvidesPassive = activeBuffIds.some((buffId) =>
    config.gameData.buffs[buffId]?.effectRefs?.includes(EFFECT_REF_IDS.vigourPassive),
  );

  return ringProvidesPassive || buffProvidesPassive;
}
