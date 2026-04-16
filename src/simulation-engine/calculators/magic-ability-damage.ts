import type { EquipmentSlot, SpellDefinition } from '../../game-data/types';
import type { RotationAction, SimulationConfig } from '../models';
import { resolveConfiguredEquipmentDefinition } from '../gear/configured-equipment-definition';
import { calculateScaledCombatLevel } from './ranged-ability-damage';
import { resolveActiveMagicSpellDefinition, resolveMagicSpellDefinitionForAction } from '../spells/selected-spell';
import { calculatePersistentOffensiveStatBonus } from './offensive-stat-bonuses';

export function calculateMagicAbilityDamage(config: SimulationConfig, action?: RotationAction | null): number {
  const magicLevel = config.playerStats.magicLevel ?? 0;
  const spell = action
    ? resolveMagicSpellDefinitionForAction(config, action)
    : resolveActiveMagicSpellDefinition(config);
  return calculateMagicAbilityDamageForSpell(config, magicLevel, spell);
}

function calculateMagicAbilityDamageForSpell(
  config: SimulationConfig,
  magicLevel: number,
  spell: SpellDefinition | null,
): number {
  const mainHand = resolveEquippedDefinition(config, 'weapon');

  if (!mainHand || !spell) {
    return 0;
  }

  const spellTier = Math.max(0, Math.trunc(spell.tier));
  const meleeBonus = calculateMagicBonus(config);
  const scaledLevel = calculateScaledCombatLevel(magicLevel);
  const mainHandTier = Math.min(readDamageTier(mainHand), spellTier);
  const mainHandContribution =
    Math.floor(2.5 * scaledLevel) +
    Math.floor(9.6 * mainHandTier + meleeBonus);

  if (mainHand.equipBehavior === 'two-handed') {
    return roundDamageValue(
      mainHandContribution +
      Math.floor(1.25 * scaledLevel) +
      Math.floor(14.4 * mainHandTier + 1.5 * meleeBonus),
    );
  }

  const offHand = resolveEquippedDefinition(config, 'offHand');
  if (!offHand) {
    return roundDamageValue(mainHandContribution);
  }

  const offHandTier = Math.min(readDamageTier(offHand), spellTier);
  const offHandContribution = Math.floor(
    0.5 * (
      Math.floor(2.5 * scaledLevel) +
      Math.floor(9.6 * offHandTier + meleeBonus)
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

function calculateMagicBonus(config: SimulationConfig): number {
  return Object.values(config.gearSetup.equipment).reduce((total, instance) => {
    if (!instance) {
      return total;
    }

    const definition = config.gameData.items[instance.definitionId];
    return total + (definition?.offensiveStats?.['magicBonus'] ?? 0);
  }, calculatePersistentOffensiveStatBonus(config, 'magic'));
}

function roundDamageValue(value: number): number {
  return Math.round(value * 100) / 100;
}
