import type { EquipmentSlot } from '../../game-data/types';
import type { SimulationConfig } from '../models';
import { resolveConfiguredEquipmentDefinition } from '../gear/configured-equipment-definition';
import { calculateScaledCombatLevel } from './ranged-ability-damage';

export function calculateMeleeAbilityDamage(config: SimulationConfig): number {
  const strengthLevel = config.playerStats.strengthLevel ?? 0;
  const mainHand = resolveEquippedDefinition(config, 'weapon');

  if (!mainHand) {
    return 0;
  }

  const mainHandTier = readDamageTier(mainHand);
  const mainHandScalingTier = Math.min(mainHandTier, strengthLevel);
  const meleeBonus = calculateMeleeBonus(config);
  const scaledLevel = calculateScaledCombatLevel(strengthLevel);
  const mainHandContribution =
    Math.floor(2.5 * scaledLevel) +
    Math.floor(9.6 * mainHandScalingTier + meleeBonus);

  if (mainHand.equipBehavior === 'two-handed') {
    return roundDamageValue(
      mainHandContribution +
      Math.floor(1.25 * scaledLevel) +
      Math.floor(4.8 * mainHandTier + 0.5 * meleeBonus),
    );
  }

  const offHand = resolveEquippedDefinition(config, 'offHand');
  if (!offHand) {
    return roundDamageValue(mainHandContribution);
  }

  const offHandTier = readDamageTier(offHand);
  const offHandScalingTier = Math.min(offHandTier, strengthLevel);
  const offHandContribution = Math.floor(
    0.5 * (
      Math.floor(2.5 * scaledLevel) +
      Math.floor(9.6 * offHandScalingTier + meleeBonus)
    ),
  );

  return roundDamageValue(mainHandContribution + offHandContribution);
}

function resolveEquippedDefinition(
  config: SimulationConfig,
  slot: EquipmentSlot,
): { offensiveStats?: Record<string, number>; tier?: number; equipBehavior?: string } | null {
  return resolveConfiguredEquipmentDefinition(config, slot);
}

function readDamageTier(definition: { offensiveStats?: Record<string, number>; tier?: number }): number {
  return Math.max(
    0,
    Math.trunc(definition.offensiveStats?.['damageTier'] ?? definition.tier ?? 0),
  );
}

function calculateMeleeBonus(config: SimulationConfig): number {
  return Object.values(config.gearSetup.equipment).reduce((total, instance) => {
    if (!instance) {
      return total;
    }

    const definition = config.gameData.items[instance.definitionId];
    return total + (definition?.offensiveStats?.['meleeBonus'] ?? 0);
  }, 0);
}

function roundDamageValue(value: number): number {
  return Math.round(value * 100) / 100;
}
