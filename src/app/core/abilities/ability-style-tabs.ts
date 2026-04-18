import {
  COMBAT_STYLE_ORDER,
  combatStyleLabel,
  combatStyleThemeClass,
} from '../../../game-data/conventions/combat-styles';
import type { AbilityDefinition, AbilitySubtype, CombatStyle } from '../../../game-data/types';

export interface AbilityStyleTabDefinition {
  id: CombatStyle;
  label: string;
  themeClass: string;
  iconPath?: string;
  iconTint?: 'default' | 'white';
}

export interface GroupedAbilitySubtype<TAbility extends { subtype: AbilitySubtype; name: string }> {
  key: AbilitySubtype;
  label: string;
  abilities: TAbility[];
}

const ABILITY_SUBTYPE_ORDER: AbilitySubtype[] = ['basic', 'enhanced', 'ultimate', 'special', 'utility', 'other'];

const ABILITY_STYLE_ICON_PATHS: Partial<Record<CombatStyle, string>> = {
  ranged: '/icons/wiki/ranged-icon.png',
  melee: '/icons/wiki/attack-icon.png',
  magic: '/icons/wiki/magic-icon.png',
  necromancy: '/icons/wiki/necromancy-icon.png',
  constitution: '/icons/wiki/constitution-icon.png',
};

export const ABILITY_STYLE_TABS: AbilityStyleTabDefinition[] = COMBAT_STYLE_ORDER.map((style) => ({
  id: style,
  label: combatStyleLabel(style),
  themeClass: combatStyleThemeClass(style),
  iconPath: ABILITY_STYLE_ICON_PATHS[style],
  iconTint: style === 'constitution' ? 'white' : 'default',
}));

export function filterAbilitiesByStyle<TAbility extends { style: CombatStyle }>(
  abilities: readonly TAbility[],
  style: CombatStyle,
): TAbility[] {
  return abilities.filter((ability) => ability.style === style);
}

export function hasAnyAbilitiesForStyle<TAbility extends { style: CombatStyle }>(
  abilities: readonly TAbility[],
  style: CombatStyle,
): boolean {
  return abilities.some((ability) => ability.style === style);
}

export function groupAbilitiesBySubtype<TAbility extends { subtype: AbilitySubtype; name: string }>(
  abilities: readonly TAbility[],
): GroupedAbilitySubtype<TAbility>[] {
  const grouped = new Map<AbilitySubtype, GroupedAbilitySubtype<TAbility>>();

  for (const ability of abilities) {
    const group = grouped.get(ability.subtype) ?? {
      key: ability.subtype,
      label: displayAbilitySubtypeLabel(ability.subtype),
      abilities: [],
    };

    group.abilities.push(ability);
    grouped.set(ability.subtype, group);
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      abilities: [...group.abilities].sort((left, right) => left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => ABILITY_SUBTYPE_ORDER.indexOf(left.key) - ABILITY_SUBTYPE_ORDER.indexOf(right.key));
}

export function displayAbilitySubtypeLabel(subtype: AbilitySubtype | string): string {
  switch (subtype) {
    case 'basic':
      return 'Basic';
    case 'enhanced':
      return 'Enhanced';
    case 'ultimate':
      return 'Ultimate';
    case 'special':
      return 'Special';
    case 'utility':
      return 'Utility';
    default:
      return subtype === 'other' ? 'Utility' : subtype;
  }
}

export function abilityStyleEmptyMessage(style: CombatStyle): string {
  switch (style) {
    case 'melee':
      return 'Melee abilities are coming soon.';
    case 'necromancy':
      return 'Necromancy abilities are coming soon.';
    case 'constitution':
      return 'No loaded Constitution abilities match the current search.';
    case 'ranged':
    case 'magic':
    default:
      return 'No loaded abilities match the current search.';
  }
}

export function styleTabThemeClass(style: CombatStyle): string {
  return combatStyleThemeClass(style);
}
