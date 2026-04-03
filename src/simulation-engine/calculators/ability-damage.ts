import type { CombatStyle, EquipmentSlot, ItemDefinition } from '../../game-data/types';
import type { RotationAction, SimulationConfig } from '../models';
import { calculateMagicAbilityDamage } from './magic-ability-damage';
import { calculateMeleeAbilityDamage } from './melee-ability-damage';
import { calculateRangedAbilityDamage } from './ranged-ability-damage';

const SUPPORTED_ABILITY_DAMAGE_STYLES: CombatStyle[] = ['ranged', 'melee', 'magic', 'necromancy'];
type AbilityDamageSource = {
  style?: string;
};

export function calculateAbilityDamage(
  config: SimulationConfig,
  ability: AbilityDamageSource,
  action?: RotationAction | null,
): number {
  const combatStyle = resolveAbilityDamageCombatStyle(config, ability);

  switch (combatStyle) {
    case 'melee':
      return calculateMeleeAbilityDamage(config);
    case 'magic':
      return calculateMagicAbilityDamage(config, action);
    case 'ranged':
      return calculateRangedAbilityDamage(config);
    default:
      return 0;
  }
}

export function resolveAbilityDamageCombatStyle(
  config: SimulationConfig,
  ability: AbilityDamageSource,
): CombatStyle | null {
  if (isSupportedAbilityDamageStyle(ability.style)) {
    return ability.style;
  }

  return resolveEquippedWeaponCombatStyle(config);
}

function resolveEquippedWeaponCombatStyle(config: SimulationConfig): CombatStyle | null {
  const weaponDefinition = resolveEquippedDefinition(config, 'weapon');
  if (!weaponDefinition) {
    return null;
  }

  return (
    weaponDefinition.combatStyleTags.find((style) => SUPPORTED_ABILITY_DAMAGE_STYLES.includes(style)) ?? null
  );
}

function resolveEquippedDefinition(config: SimulationConfig, slot: EquipmentSlot): ItemDefinition | null {
  const equippedItem = config.gearSetup.equipment[slot];
  if (!equippedItem) {
    return null;
  }

  return config.gameData.items[equippedItem.definitionId] ?? config.gameData.ammo[equippedItem.definitionId] ?? null;
}

function isSupportedAbilityDamageStyle(style: string | undefined): style is CombatStyle {
  return style !== undefined && SUPPORTED_ABILITY_DAMAGE_STYLES.includes(style as CombatStyle);
}
