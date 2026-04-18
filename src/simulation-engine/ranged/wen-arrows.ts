import type { AbilityDefinition, EntityId } from '../../game-data/types';
import type { SimulationConfig } from '../models';
import { projectSimulationConfigAtTick } from '../state/projected-gear-state';

export const WEN_ARROWS_EFFECT_REF = 'wen-arrows-icy-chill';
export const ICY_CHILL_BUFF_ID = 'icy-chill';
export const ICY_PRECISION_BUFF_ID = 'icy-precision';
export const WEN_ICY_CHILL_MAX_STACKS = 10;
export const WEN_ICY_CHILL_DURATION_TICKS = 50;
export const WEN_ICY_PRECISION_STACKS = 10;
export const WEN_ICY_PRECISION_DURATION_TICKS = 15;
export const WEN_ICY_PRECISION_DAMAGE_PERCENT_PER_STACK = 3;

export function hasWenArrowsEquippedAtTick(
  config: SimulationConfig,
  tick: number,
): boolean {
  const projectedConfig = projectSimulationConfigAtTick(config, tick);
  const ammoInstance = projectedConfig.gearSetup.ammoSelection ?? projectedConfig.gearSetup.equipment.ammo;
  if (!ammoInstance) {
    return false;
  }

  const definition =
    projectedConfig.gameData.items[ammoInstance.definitionId] ??
    projectedConfig.gameData.ammo[ammoInstance.definitionId];

  return definition?.effectRefs?.includes(WEN_ARROWS_EFFECT_REF) ?? false;
}

export function canWenPrecisionAffectAbility(
  ability: { style?: string; subtype?: string },
): boolean {
  return ability.style === 'ranged' &&
    (ability.subtype === 'enhanced' || ability.subtype === 'ultimate' || ability.subtype === 'special');
}

export function countIcyPrecisionStacksAtTick(
  timelineBuffs: Record<number, EntityId[]>,
  tick: number,
): number {
  return (timelineBuffs[tick] ?? []).filter((buffId) => buffId === ICY_PRECISION_BUFF_ID).length;
}

export function resolveWenIcyPrecisionDamagePercent(stacks: number): number {
  return Math.max(0, Math.trunc(stacks)) * WEN_ICY_PRECISION_DAMAGE_PERCENT_PER_STACK;
}

export function isWenStackBuildingAbility(
  ability: AbilityDefinition,
): boolean {
  return ability.style === 'ranged' && ability.subtype === 'basic';
}

export function isWenStackConsumingAbility(
  ability: AbilityDefinition,
): boolean {
  return canWenPrecisionAffectAbility(ability);
}
