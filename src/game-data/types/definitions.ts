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
  SpellRole,
  SpellbookId,
  StackRules,
  StatModifierMap,
} from './common';

export interface AbilityDisplayHints {
  hitTickMode?: 'cast' | 'resolved';
  hitCountLabel?: string;
  damageRangeLabel?: string;
  hitScheduleSummary?: string;
  hoverSummary?: string;
  hiddenFromUi?: boolean;
}

export interface AbilitySpecialDispatch {
  source: 'equipped-weapon' | 'equipped-eof';
}

export interface AbilityTimelineEffectDurationBonus {
  requiredEquippedEffect: EffectRef;
  minCount?: number;
  bonusTicks: number;
}

export interface AbilityApplyBuffTimelineEffect {
  kind: 'apply-buff';
  buffId: EntityId;
  startTickOffset?: number;
  durationTicks?: number;
  endsOnWeaponSwap?: boolean;
  conditionalDurationBonuses?: AbilityTimelineEffectDurationBonus[];
}

export interface AbilityExtendBuffTimelineEffect {
  kind: 'extend-buff';
  buffId: EntityId;
  requiresActive?: boolean;
  durationTicks?: number;
  durationFromAbility?: 'hit-count' | 'channel-duration' | 'max-hit-count-or-channel-duration';
  bonusTicks?: number;
}

export interface AbilityGrantAdrenalineTimelineEffect {
  kind: 'grant-adrenaline';
  amount: number;
  timing: 'per-tick-window';
  startTickOffset?: number;
  durationTicks?: number;
  durationFromAbility?: 'channel-duration';
  requiresWeaponStyle?: CombatStyle;
}

export type AbilityTimelineEffect =
  | AbilityApplyBuffTimelineEffect
  | AbilityExtendBuffTimelineEffect
  | AbilityGrantAdrenalineTimelineEffect;

export interface AbilityStackEffect {
  buffId: EntityId;
  operation: 'add' | 'spend';
  stacks: number;
}

export interface AbilityVariantDefinition {
  id: EntityId;
  priority?: number;
  when?: RequirementSet;
  name?: string;
  iconPath?: string;
  hoverSummary?: string;
  detailLines?: string[];
  wikiUrl?: string;
  style?: CombatStyle;
  subtype?: AbilitySubtype;
  cooldownTicks?: number;
  adrenalineCost?: number;
  adrenalineGain?: number;
  requires?: RequirementSet;
  isChanneled?: boolean;
  channelDurationTicks?: number;
  hitSchedule?: HitDefinition[];
  baseDamage?: DamageRange;
  effectRefs?: EffectRef[];
  description?: string;
  timelineEffects?: AbilityTimelineEffect[];
  stackEffects?: AbilityStackEffect[];
  displayHints?: AbilityDisplayHints;
}

export interface ItemDefinition {
  id: EntityId;
  name: string;
  category: ItemCategory;
  slot?: EquipmentSlot;
  iconPath?: string;
  wikiUrl?: string;
  dyeVariantIconPaths?: Partial<Record<string, string>>;
  hoverSummary?: string;
  detailLines?: string[];
  combatStyleTags: CombatStyle[];
  tier?: number;
  offensiveStats?: StatModifierMap;
  requirements?: RequirementSet;
  effectRefs?: EffectRef[];
  specialAbilityId?: EntityId;
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

export interface SpellDefinition {
  id: EntityId;
  name: string;
  spellbookId: SpellbookId;
  role: SpellRole;
  levelRequirement: number;
  tier: number;
  iconPath?: string;
  wikiUrl?: string;
  effectRefs?: EffectRef[];
  hoverSummary?: string;
  detailLines?: string[];
  description?: string;
  timelineEffects?: AbilityTimelineEffect[];
}

export interface AbilityDefinition {
  id: EntityId;
  name: string;
  iconPath?: string;
  hoverSummary?: string;
  detailLines?: string[];
  wikiUrl?: string;
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
  specialDispatch?: AbilitySpecialDispatch;
  variants?: AbilityVariantDefinition[];
  timelineEffects?: AbilityTimelineEffect[];
  stackEffects?: AbilityStackEffect[];
  displayHints?: AbilityDisplayHints;
  description?: string;
}

export interface BuffDefinition {
  id: EntityId;
  name: string;
  iconPath?: string;
  variantNames?: string[];
  wikiUrl?: string;
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
  iconPath?: string;
  wikiUrl?: string;
  maxRank?: number;
  shortCode?: string;
  effectRefs?: EffectRef[];
  configOptions?: ConfigOptionDefinition[];
  description?: string;
}

export interface RelicDefinition {
  id: EntityId;
  name: string;
  iconPath?: string;
  wikiUrl?: string;
  monolithEnergy?: number;
  effectRefs?: EffectRef[];
  description?: string;
}

export interface EofSpecDefinition {
  id: EntityId;
  name: string;
  iconPath?: string;
  hoverSummary?: string;
  detailLines?: string[];
  wikiUrl?: string;
  weaponOrigin: EntityId;
  abilityId: EntityId;
  requires?: RequirementSet;
  effectRefs?: EffectRef[];
  description?: string;
}
