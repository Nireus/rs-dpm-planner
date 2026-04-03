import type {
  AbilityDefinition,
  AmmoDefinition,
  BuffDefinition,
  EffectRef,
  EntityId,
  EquipmentSlot,
  EofSpecDefinition,
  ItemDefinition,
  PerkDefinition,
  RelicDefinition,
  SpellDefinition,
  SpellbookId,
} from '../../game-data/types';
import type { StartingStackState } from './starting-stacks';

export interface ItemInstanceConfig {
  instanceId: string;
  definitionId: EntityId;
  perkIds?: EntityId[];
  configuredPerks?: Array<{
    socketIndex: number;
    perkId: EntityId;
    rank?: number;
  }>;
  configValues?: Record<string, boolean | number | string>;
  effectRefs?: EffectRef[];
}

export interface PlayerStats {
  attackLevel?: number;
  strengthLevel?: number;
  defenceLevel?: number;
  rangedLevel: number;
  magicLevel?: number;
  necromancyLevel?: number;
  prayerLevel?: number;
  combatStats?: Record<string, number>;
  toggles?: Record<string, boolean>;
}

export interface GearSetup {
  equipment: Partial<Record<EquipmentSlot, ItemInstanceConfig>>;
  ammoSelection?: ItemInstanceConfig;
}

export interface InventoryState {
  items: ItemInstanceConfig[];
  enabledMechanicFlags?: Record<string, boolean>;
}

export interface PersistentBuffConfig {
  prayerIds?: EntityId[];
  potionIds?: EntityId[];
  relicIds?: EntityId[];
  buffIds?: EntityId[];
  pocketEffectItemIds?: EntityId[];
}

export interface MagicCombatChoices {
  spellbookId: SpellbookId;
  activeSpellId: EntityId;
}

export interface CombatChoices {
  magic: MagicCombatChoices;
}

export interface TimelineGeneratedBuffSource {
  buffId: EntityId;
  sourceType: 'ability' | 'item' | 'event';
  sourceId?: EntityId;
}

export type RotationActionType =
  | 'ability-use'
  | 'adrenaline-potion'
  | 'ammo-swap'
  | 'gear-swap'
  | 'spell-swap'
  | 'vulnerability-bomb'
  | 'eof-special'
  | 'other';

export type RotationActionLane = 'non-gcd' | 'ability';

export interface RotationAction {
  id: string;
  tick: number;
  lane: RotationActionLane;
  actionType: RotationActionType;
  payload: Record<string, unknown>;
}

export interface RotationPlan {
  startingAdrenaline: number;
  tickCount: number;
  startingStacks?: StartingStackState;
  nonGcdActions: RotationAction[];
  abilityActions: RotationAction[];
}

export interface LoadedGameDataSnapshot {
  items: Record<EntityId, ItemDefinition>;
  ammo: Record<EntityId, AmmoDefinition>;
  spells?: Record<EntityId, SpellDefinition>;
  abilities: Record<EntityId, AbilityDefinition>;
  buffs: Record<EntityId, BuffDefinition>;
  perks: Record<EntityId, PerkDefinition>;
  relics: Record<EntityId, RelicDefinition>;
  eofSpecs: Record<EntityId, EofSpecDefinition>;
}

export interface SimulationModeFlags {
  strictValidation: boolean;
}

export interface SimulationConfig {
  playerStats: PlayerStats;
  combatChoices?: CombatChoices;
  gearSetup: GearSetup;
  inventory: InventoryState;
  persistentBuffConfig: PersistentBuffConfig;
  rotationPlan: RotationPlan;
  gameData: LoadedGameDataSnapshot;
  modeFlags: SimulationModeFlags;
}
