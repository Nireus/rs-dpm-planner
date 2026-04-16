import type { EquipmentSlot } from '../../game-data/types';
import type { SimulationConfig } from '../models';
import { resolveConfiguredEquipmentDefinition } from '../gear/configured-equipment-definition';
import { collectHighestEquippedPerkRank } from '../perks/equipped-perks';
import { calculatePersistentOffensiveStatBonus } from './offensive-stat-bonuses';

const RANGED_LEVEL_SCALING_DENOMINATOR = Math.log(1.6);

export function calculateRangedAbilityDamage(config: SimulationConfig): number {
  const rangedLevel = config.playerStats.rangedLevel;
  const weapon = resolveEquippedDefinition(config, 'weapon');

  if (!weapon) {
    return 0;
  }

  const weaponTier = readDamageTier(weapon);
  const ammoTier = readAmmoTier(config);
  const rangedBonus = calculateRangedBonus(config);
  const tierForRangedScaling = ammoTier > 0 ? Math.min(weaponTier, ammoTier) : weaponTier;
  const scaledLevel = calculateScaledCombatLevel(rangedLevel);
  const baseAbilityDamage = (
    Math.floor(2.5 * scaledLevel) +
    Math.floor(1.25 * scaledLevel) +
    Math.floor(9.6 * tierForRangedScaling + rangedBonus) +
    Math.floor(4.8 * tierForRangedScaling + 0.5 * rangedBonus)
  );
  const eruptiveRank = collectHighestEquippedPerkRank(config, 'eruptive');
  const eruptiveMultiplier = 1 + eruptiveRank * 0.005;

  return roundDamageValue(baseAbilityDamage * eruptiveMultiplier);
}

export function calculateScaledCombatLevel(level: number): number {
  if (level <= 0) {
    return 0;
  }

  return (145 * Math.log(1 + (0.6 * level) / 145)) / RANGED_LEVEL_SCALING_DENOMINATOR;
}

function resolveEquippedDefinition(
  config: SimulationConfig,
  slot: EquipmentSlot,
): { offensiveStats?: Record<string, number> } | null {
  return resolveConfiguredEquipmentDefinition(config, slot);
}

function readAmmoTier(config: SimulationConfig): number {
  const ammoInstance = config.gearSetup.ammoSelection ?? config.gearSetup.equipment.ammo;
  if (!ammoInstance) {
    return 0;
  }

  const ammoDefinition =
    config.gameData.ammo[ammoInstance.definitionId] ??
    config.gameData.items[ammoInstance.definitionId];

  return ammoDefinition ? readDamageTier(ammoDefinition) : 0;
}

function readDamageTier(definition: { offensiveStats?: Record<string, number>; tier?: number }): number {
  return Math.max(
    0,
    Math.trunc(definition.offensiveStats?.['damageTier'] ?? definition.tier ?? 0),
  );
}

function calculateRangedBonus(config: SimulationConfig): number {
  return Object.values(config.gearSetup.equipment).reduce((total, instance) => {
    if (!instance) {
      return total;
    }

    const definition = config.gameData.items[instance.definitionId];
    return total + (definition?.offensiveStats?.['rangedBonus'] ?? 0);
  }, calculatePersistentOffensiveStatBonus(config, 'ranged'));
}

function roundDamageValue(value: number): number {
  return Math.round(value * 100) / 100;
}
