import { CONFIG_OPTION_IDS, EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type { AbilityDefinition } from '../../game-data/types';
import { resolveEffectiveAbilityDefinition } from '../abilities/effective-ability';
import type { ItemInstanceConfig, RotationAction, SimulationConfig } from '../models';
import { projectSimulationConfigAtTick } from '../state/projected-gear-state';

const REND_ABILITY_ID = 'rend';
const CHAMPIONS_RING_ID = 'champions-ring';
const ENCHANTMENT_OF_HEROISM_ID = 'enchantment-of-heroism';
const ENDURING_RUIN_WINDOW_TICKS = 10;
const CORRUPTED_WOUNDS_DURATION_TICKS = 17;
const HEROISM_EQUIP_TIME_TICKS = 15;
const AGONY_EQUIP_TIME_TICKS = 15;
const ABYSSAL_PARASITE_DURATION_TICKS = 15;

export function countActiveTrackedBleeds(config: SimulationConfig, tick: number): number {
  return countActiveAbilityBleeds(config, tick) + (hasActiveAbyssalParasiteBleed(config, tick) ? 1 : 0);
}

export function hasChampionRingEquipped(config: SimulationConfig, tick: number): boolean {
  const ring = projectSimulationConfigAtTick(config, tick).gearSetup.equipment.ring;
  return ring?.definitionId === CHAMPIONS_RING_ID;
}

export function hasHeroismChampionRingBonus(config: SimulationConfig, tick: number): boolean {
  if (!hasChampionRingEquipped(config, tick) || !hasHeroismUnlocked(config)) {
    return false;
  }

  if (tick < HEROISM_EQUIP_TIME_TICKS) {
    return false;
  }

  const previousRing = projectSimulationConfigAtTick(config, tick - HEROISM_EQUIP_TIME_TICKS).gearSetup.equipment.ring;
  return previousRing?.definitionId === CHAMPIONS_RING_ID;
}

export function hasJawsOfTheAbyssEquipped(config: SimulationConfig, tick: number): boolean {
  return hasEquippedEffectAtTick(config, tick, EFFECT_REF_IDS.jawsOfTheAbyssPassive);
}

export function getVestmentsOfHavocPieceCount(config: SimulationConfig, tick: number): number {
  const projectedConfig = projectSimulationConfigAtTick(config, tick);
  return Object.values(projectedConfig.gearSetup.equipment).reduce((count, instance) => {
    if (!instance) {
      return count;
    }

    const definition = projectedConfig.gameData.items[instance.definitionId];
    return definition?.effectRefs?.includes(EFFECT_REF_IDS.vestmentsOfHavocSet) ? count + 1 : count;
  }, 0);
}

export function getEnduringRuinNextAttackBonus(config: SimulationConfig, castTick: number): number {
  const rendAction = findMostRecentRendAction(config, castTick, ENDURING_RUIN_WINDOW_TICKS);
  if (!rendAction || !hasEquippedEffectAtTick(config, rendAction.tick, EFFECT_REF_IDS.glovesOfPassagePassive)) {
    return 0;
  }

  return hasAgonyEnhancedGlovesBonus(config, rendAction.tick) ? 0.16 : 0.1;
}

export function getCorruptedWoundsBleedBonus(config: SimulationConfig, hitTick: number): number {
  const rendAction = findMostRecentRendAction(config, hitTick, CORRUPTED_WOUNDS_DURATION_TICKS);
  if (!rendAction || !hasEquippedEffectAtTick(config, rendAction.tick, EFFECT_REF_IDS.glovesOfPassagePassive)) {
    return 0;
  }

  return hasAgonyEnhancedGlovesBonus(config, rendAction.tick) ? 0.25 : 0.2;
}

function countActiveAbilityBleeds(config: SimulationConfig, tick: number): number {
  return getAbilityActionsThroughTick(config, tick).reduce((count, action) => {
    const ability = resolveEffectiveAbilityDefinition(config, action);
    if (!ability || !isTrackedBleedAbility(ability)) {
      return count;
    }

    const firstHitTick = action.tick + Math.min(...ability.hitSchedule.map((hit) => hit.tickOffset));
    const lastHitTick = action.tick + Math.max(...ability.hitSchedule.map((hit) => hit.tickOffset));
    return tick >= firstHitTick && tick <= lastHitTick ? count + 1 : count;
  }, 0);
}

function hasActiveAbyssalParasiteBleed(config: SimulationConfig, tick: number): boolean {
  for (const action of getAbilityActionsThroughTick(config, tick)) {
    const ability = resolveEffectiveAbilityDefinition(config, action);
    if (!ability || ability.style !== 'melee') {
      continue;
    }

    for (const hit of ability.hitSchedule) {
      if ((hit.damage.min ?? 0) <= 0 && (hit.damage.max ?? 0) <= 0) {
        continue;
      }

      const hitTick = action.tick + hit.tickOffset;
      if (
        hitTick <= tick &&
        tick <= hitTick + ABYSSAL_PARASITE_DURATION_TICKS &&
        hasEquippedEffectAtTick(config, hitTick, EFFECT_REF_IDS.abyssalParasite)
      ) {
        return true;
      }
    }
  }

  return false;
}

function findMostRecentRendAction(
  config: SimulationConfig,
  tick: number,
  windowTicks: number,
): RotationAction | null {
  const actions = getAbilityActionsThroughTick(config, tick).filter((action) => action.tick < tick);

  for (let index = actions.length - 1; index >= 0; index -= 1) {
    const action = actions[index];
    const ability = resolveEffectiveAbilityDefinition(config, action);
    if (!ability || ability.id !== REND_ABILITY_ID) {
      continue;
    }

    if (tick > action.tick + windowTicks) {
      return null;
    }

    const interveningDamagingAction = actions.slice(index + 1).some((laterAction) => {
      const laterAbility = resolveEffectiveAbilityDefinition(config, laterAction);
      return laterAbility ? isDamagingAbility(laterAbility) : false;
    });

    return interveningDamagingAction ? null : action;
  }

  return null;
}

function hasHeroismUnlocked(config: SimulationConfig): boolean {
  if (config.inventory.items.some((item) => item.definitionId === ENCHANTMENT_OF_HEROISM_ID)) {
    return true;
  }

  return Object.values(config.gearSetup.equipment).some((instance) => {
    if (!instance) {
      return false;
    }

    return config.gameData.items[instance.definitionId]?.effectRefs?.includes(EFFECT_REF_IDS.enchantmentOfHeroism) ?? false;
  });
}

function hasEquippedEffectAtTick(
  config: SimulationConfig,
  tick: number,
  effectRef: string,
): boolean {
  const projectedConfig = projectSimulationConfigAtTick(config, tick);
  return Object.values(projectedConfig.gearSetup.equipment).some((instance) => {
    if (!instance) {
      return false;
    }

    return projectedConfig.gameData.items[instance.definitionId]?.effectRefs?.includes(effectRef) ?? false;
  });
}

function hasAgonyEnhancedGlovesBonus(config: SimulationConfig, tick: number): boolean {
  const currentHands = projectSimulationConfigAtTick(config, tick).gearSetup.equipment.hands;
  const previousHands =
    tick >= AGONY_EQUIP_TIME_TICKS
      ? projectSimulationConfigAtTick(config, tick - AGONY_EQUIP_TIME_TICKS).gearSetup.equipment.hands
      : null;

  return isAgonyEnhancedGloves(currentHands) && isSameEquippedItem(currentHands, previousHands);
}

function isAgonyEnhancedGloves(instance: ItemInstanceConfig | null | undefined): instance is ItemInstanceConfig {
  return instance?.definitionId === 'enhanced-gloves-of-passage' &&
    instance.configValues?.[CONFIG_OPTION_IDS.enhancedGlovesOfPassageAgonyEnchanted] === true;
}

function isSameEquippedItem(
  current: ItemInstanceConfig | null | undefined,
  previous: ItemInstanceConfig | null | undefined,
): boolean {
  return Boolean(current && previous && current.instanceId === previous.instanceId);
}

function isTrackedBleedAbility(ability: AbilityDefinition): boolean {
  return ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime) ?? false;
}

function isDamagingAbility(ability: AbilityDefinition): boolean {
  return ability.hitSchedule.some((hit) => (hit.damage.min ?? 0) > 0 || (hit.damage.max ?? 0) > 0);
}

function getAbilityActionsThroughTick(config: SimulationConfig, tick: number): RotationAction[] {
  return [...config.rotationPlan.abilityActions]
    .filter((action) => action.tick <= tick)
    .sort((left, right) => left.tick - right.tick);
}
