import type { CombatStyle } from '../types';

export interface CombatStyleMetadata {
  id: CombatStyle;
  label: string;
  themeClass: string;
}

export const COMBAT_STYLE_ORDER: CombatStyle[] = [
  'ranged',
  'melee',
  'magic',
  'necromancy',
  'constitution',
] as const;

export const COMBAT_STYLE_METADATA: Record<CombatStyle, CombatStyleMetadata> = {
  ranged: {
    id: 'ranged',
    label: 'Ranged',
    themeClass: 'style-ranged',
  },
  melee: {
    id: 'melee',
    label: 'Melee',
    themeClass: 'style-melee',
  },
  magic: {
    id: 'magic',
    label: 'Magic',
    themeClass: 'style-magic',
  },
  necromancy: {
    id: 'necromancy',
    label: 'Necromancy',
    themeClass: 'style-necromancy',
  },
  constitution: {
    id: 'constitution',
    label: 'Constitution',
    themeClass: 'style-constitution',
  },
};

export function isRecognizedCombatStyle(value: string): value is CombatStyle {
  return value in COMBAT_STYLE_METADATA;
}

export function combatStyleLabel(style: string): string {
  return isRecognizedCombatStyle(style) ? COMBAT_STYLE_METADATA[style].label : style;
}

export function combatStyleThemeClass(style: string): string {
  return isRecognizedCombatStyle(style) ? COMBAT_STYLE_METADATA[style].themeClass : '';
}
