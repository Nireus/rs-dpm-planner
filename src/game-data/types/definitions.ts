import type {
  AbilitySubtype,
  AmmoType,
  BuffCategory,
  BuffSourceType,
  CombatStyle,
  ConfigOptionDefinition,
  DamageRange,
  EffectRef,
  EntityId,
  EquipmentSlot,
  HitDefinition,
  ItemCategory,
  RequirementSet,
  StackRules,
  StatModifierMap,
} from './common';

export interface ItemDefinition {
  id: EntityId;
  name: string;
  category: ItemCategory;
  slot?: EquipmentSlot;
  iconPath?: string;
  hoverSummary?: string;
  detailLines?: string[];
  combatStyleTags: CombatStyle[];
  tier?: number;
  offensiveStats?: StatModifierMap;
  requirements?: RequirementSet;
  effectRefs?: EffectRef[];
  configOptions?: ConfigOptionDefinition[];
  inventoryOnlyBehavior?: string;
  equipBehavior?: string;
  implementationNotes?: string;
}

export interface AmmoDefinition {
  id: EntityId;
  name: string;
  ammoType: AmmoType;
  offensiveStats?: StatModifierMap;
  effectRefs?: EffectRef[];
  requirements?: RequirementSet;
  implementationNotes?: string;
}

export interface AbilityDefinition {
  id: EntityId;
  name: string;
  style: CombatStyle;
  subtype: AbilitySubtype;
  cooldownTicks: number;
  adrenalineCost?: number;
  adrenalineGain?: number;
  requires?: RequirementSet;
  isChanneled?: boolean;
  channelDurationTicks?: number;
  hitSchedule: HitDefinition[];
  baseDamage: DamageRange;
  effectRefs?: EffectRef[];
  description?: string;
}

export interface BuffDefinition {
  id: EntityId;
  name: string;
  category: BuffCategory;
  sourceType: BuffSourceType;
  durationTicks?: number;
  isPermanent?: boolean;
  stackRules?: StackRules;
  effectRefs?: EffectRef[];
  displayPriority?: number;
}

export interface PerkDefinition {
  id: EntityId;
  name: string;
  effectRefs?: EffectRef[];
  configOptions?: ConfigOptionDefinition[];
  description?: string;
}

export interface RelicDefinition {
  id: EntityId;
  name: string;
  effectRefs?: EffectRef[];
  description?: string;
}

export interface EofSpecDefinition {
  id: EntityId;
  name: string;
  weaponOrigin: EntityId;
  adrenalineCost: number;
  hitSchedule: HitDefinition[];
  baseDamage: DamageRange;
  effectRefs?: EffectRef[];
}
