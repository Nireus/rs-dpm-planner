export type EntityId = string;
export type EffectRef = string;
export type RequirementTag = string;
export type CombatStyle = 'ranged' | 'melee' | 'magic' | 'necromancy' | 'constitution';
export type SpellbookId = 'standard' | 'ancient';
export type SpellRole = 'combat' | 'utility';

export type ItemCategory =
  | 'weapon'
  | 'ammo'
  | 'armor'
  | 'jewellery'
  | 'pocket'
  | 'consumable'
  | 'other';

export type EquipmentSlot =
  | 'weapon'
  | 'offHand'
  | 'ammo'
  | 'head'
  | 'body'
  | 'legs'
  | 'hands'
  | 'feet'
  | 'ring'
  | 'amulet'
  | 'cape'
  | 'pocket';

export type AbilitySubtype = 'basic' | 'enhanced' | 'ultimate' | 'special' | 'utility' | 'other';

export type AmmoType = 'arrow';

export type BuffCategory =
  | 'prayer'
  | 'potion'
  | 'summon'
  | 'temporary'
  | 'passive'
  | 'miscellaneous'
  | 'set-effect'
  | 'other';

export type BuffSourceType = 'ability' | 'item' | 'perk' | 'relic' | 'player-config' | 'other';

export type DamageRange = {
  min: number;
  max: number;
};

export type HitDefinition = {
  id: string;
  tickOffset: number;
  damage: DamageRange;
  tags?: string[];
};

export type StatModifierMap = Record<string, number>;

export type RequirementSet = {
  levelRequirements?: Partial<Record<string, number>>;
  requiredEquipmentTags?: RequirementTag[];
  blockedEquipmentTags?: RequirementTag[];
  requiredBuffs?: EntityId[];
  notes?: string[];
};

export type ConfigOptionDefinition = {
  id: string;
  label: string;
  type: 'boolean' | 'number' | 'select';
  defaultValue?: boolean | number | string;
  options?: string[];
};

export type StackRules = {
  maxStacks?: number;
  refreshesDuration?: boolean;
  consumesOnTrigger?: boolean;
  conditionalModifiers?: Array<{
    whenBuffActive: EntityId;
    maxStacks?: number;
    gainMultiplier?: number;
  }>;
};
