import {
  collectEquippedStyleTopologyTags,
  formatStyleTopologyRequirementTag,
} from '../../game-data/conventions/equipment-requirement-tags';
import { CONFIG_OPTION_IDS, REQUIREMENT_TAGS } from '../../game-data/conventions/mechanics';
import type { AbilityDefinition, ItemDefinition, RequirementSet } from '../../game-data/types';
import { isTwoHandedItem } from '../gear/equipment-topology';
import type { PlayerStats } from '../models';
import type { ItemInstanceConfig } from '../models';

export interface AbilityAvailabilityIssue {
  code: 'missing-level' | 'missing-tag' | 'blocked-tag';
  message: string;
}

export interface AbilityAvailabilityResult {
  abilityId: string;
  isAvailable: boolean;
  issues: AbilityAvailabilityIssue[];
}

export interface AbilityAvailabilityContext {
  playerStats: PlayerStats;
  equippedItems: ItemDefinition[];
  inventoryItems: ItemDefinition[];
  equippedInstances?: ItemInstanceConfig[];
}

export function evaluateAbilityAvailability(
  ability: AbilityDefinition,
  context: AbilityAvailabilityContext,
): AbilityAvailabilityResult {
  const issues = evaluateRequirementSet(resolveAbilityRequirementSet(ability), context);

  return {
    abilityId: ability.id,
    isAvailable: issues.length === 0,
    issues,
  };
}

export function evaluateRequirementSet(
  requirements: RequirementSet | undefined,
  context: AbilityAvailabilityContext,
): AbilityAvailabilityIssue[] {
  const issues: AbilityAvailabilityIssue[] = [];
  const availableTags = collectAvailabilityTags(context);

  for (const [stat, requiredValue] of Object.entries(requirements?.levelRequirements ?? {})) {
    if (typeof requiredValue !== 'number') {
      continue;
    }

    const currentValue = resolvePlayerStat(context.playerStats, stat);

    if (currentValue < requiredValue) {
      issues.push({
        code: 'missing-level',
        message: `${formatStatName(stat)} ${requiredValue} required.`,
      });
    }
  }

  for (const tag of requirements?.requiredEquipmentTags ?? []) {
    if (!availableTags.has(tag)) {
      issues.push({
        code: 'missing-tag',
        message: formatRequiredTag(tag),
      });
    }
  }

  for (const tag of requirements?.blockedEquipmentTags ?? []) {
    if (availableTags.has(tag)) {
      issues.push({
        code: 'blocked-tag',
        message: `${formatBlockedTag(tag)} blocks this ability.`,
      });
    }
  }

  return issues;
}

export function requirementSetMatches(
  requirements: RequirementSet | undefined,
  context: AbilityAvailabilityContext,
): boolean {
  return evaluateRequirementSet(requirements, context).length === 0;
}

function resolveAbilityRequirementSet(ability: AbilityDefinition): RequirementSet | undefined {
  const requiredEquipmentTags = ability.requires?.requiredEquipmentTags;
  if (requiredEquipmentTags?.length) {
    return ability.requires;
  }

  const implicitWeaponRequirementTag = resolveImplicitWeaponRequirementTag(ability);
  if (!implicitWeaponRequirementTag) {
    return ability.requires;
  }

  return {
    ...ability.requires,
    requiredEquipmentTags: [implicitWeaponRequirementTag],
  };
}

export function collectAvailabilityTags(context: AbilityAvailabilityContext): Set<string> {
  const tags = new Set<string>();

  for (const item of context.equippedItems) {
    addDefinitionTags(tags, item, 'equipped');
  }

  for (const item of context.inventoryItems) {
    addDefinitionTags(tags, item, 'inventory');
  }

  for (const tag of collectEquippedStyleTopologyTags(context.equippedItems, isTwoHandedItem)) {
    tags.add(tag);
  }

  const eofItem = context.equippedItems.find((item) => item.id === 'essence-of-finality');
  const eofInstance = context.equippedInstances?.find((instance) => instance.definitionId === 'essence-of-finality');
  const storedSpecial = resolveStringConfigValue(
    eofItem,
    eofInstance,
    CONFIG_OPTION_IDS.storedSpecial,
  );

  if (storedSpecial && storedSpecial !== 'none') {
    tags.add(REQUIREMENT_TAGS.eofStoredSpecialConfigured);
    tags.add(`eof-special:${storedSpecial}`);
  }

  return tags;
}

function addDefinitionTags(tags: Set<string>, item: ItemDefinition, source: 'equipped' | 'inventory'): void {
  tags.add(`item:${item.id}`);
  tags.add(`${source}:${item.id}`);

  if (item.slot) {
    tags.add(`slot:${item.slot}`);
    tags.add(`${source}-slot:${item.slot}`);
  }

  for (const style of item.combatStyleTags) {
    tags.add(`${style}-item`);
  }

  for (const effectRef of item.effectRefs ?? []) {
    tags.add(effectRef);
    tags.add(`${source}-effect:${effectRef}`);
  }
}

function resolvePlayerStat(playerStats: PlayerStats, stat: string): number {
  switch (stat) {
    case 'attack':
      return playerStats.attackLevel ?? 0;
    case 'strength':
      return playerStats.strengthLevel ?? 0;
    case 'defence':
      return playerStats.defenceLevel ?? 0;
    case 'ranged':
      return playerStats.rangedLevel;
    case 'magic':
      return playerStats.magicLevel ?? 0;
    case 'necromancy':
      return playerStats.necromancyLevel ?? 0;
    case 'prayer':
      return playerStats.prayerLevel ?? 1;
    default:
      return playerStats.combatStats?.[stat] ?? 0;
  }
}

function formatStatName(stat: string): string {
  return stat.charAt(0).toUpperCase() + stat.slice(1);
}

function formatRequiredTag(tag: string): string {
  const styleRequirementMessage = formatStyleTopologyRequirementTag(tag);
  if (styleRequirementMessage) {
    return styleRequirementMessage;
  }

  switch (tag) {
    case 'prototype-inventory-ability':
      return 'Requires the prototype item in backpack or equipped gear.';
    case REQUIREMENT_TAGS.equippedWeaponSpecialAccess:
      return 'Requires an equipped weapon with a special attack.';
    case REQUIREMENT_TAGS.equippedEofSpecialAccess:
      return 'Requires an equipped Essence of Finality amulet.';
    case 'weapon-special-access':
      return 'Requires an equipped weapon with a special attack.';
    case 'eof-special-access':
      return 'Requires an equipped Essence of Finality amulet.';
    case REQUIREMENT_TAGS.eofStoredSpecialConfigured:
      return 'Requires a stored special attack in the equipped Essence of Finality.';
    default:
      if (tag.startsWith('eof-special:')) {
        const storedSpecial = tag.replace('eof-special:', '').replace(/-/g, ' ');
        return `Requires Essence of Finality storing ${storedSpecial}.`;
      }

      return `Requires ${tag}.`;
  }
}

function formatBlockedTag(tag: string): string {
  if (tag.startsWith('slot:')) {
    return `${tag.replace('slot:', '').replace(/-/g, ' ')} slot gear`;
  }

  return tag.replace(/-/g, ' ');
}

function resolveImplicitWeaponRequirementTag(ability: AbilityDefinition): string | null {
  if (ability.subtype === 'special') {
    return null;
  }

  switch (ability.style) {
    case 'melee':
    case 'ranged':
    case 'magic':
      return `${ability.style}-weapon`;
    default:
      return null;
  }
}

function resolveStringConfigValue(
  item: ItemDefinition | undefined,
  instance: ItemInstanceConfig | undefined,
  optionId: string,
): string | null {
  const explicitValue = instance?.configValues?.[optionId];

  if (typeof explicitValue === 'string') {
    return explicitValue;
  }

  const defaultValue = item?.configOptions?.find((option) => option.id === optionId)?.defaultValue;
  return typeof defaultValue === 'string' ? defaultValue : null;
}
