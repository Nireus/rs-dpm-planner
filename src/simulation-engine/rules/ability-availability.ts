import type { AbilityDefinition, ItemDefinition } from '../../game-data/types';
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
  const issues: AbilityAvailabilityIssue[] = [];
  const availableTags = collectAvailabilityTags(context);

  for (const [stat, requiredValue] of Object.entries(ability.requires?.levelRequirements ?? {})) {
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

  for (const tag of ability.requires?.requiredEquipmentTags ?? []) {
    if (!availableTags.has(tag)) {
      issues.push({
        code: 'missing-tag',
        message: formatRequiredTag(tag),
      });
    }
  }

  for (const tag of ability.requires?.blockedEquipmentTags ?? []) {
    if (availableTags.has(tag)) {
      issues.push({
        code: 'blocked-tag',
        message: `${formatBlockedTag(tag)} blocks this ability.`,
      });
    }
  }

  return {
    abilityId: ability.id,
    isAvailable: issues.length === 0,
    issues,
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

  const eofInstance = context.equippedInstances?.find((instance) => instance.definitionId === 'essence-of-finality');
  const storedSpecial = eofInstance?.configValues?.['stored-special'];

  if (typeof storedSpecial === 'string' && storedSpecial !== 'none') {
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

    if (item.category === 'weapon') {
      tags.add(`${style}-weapon`);
    }
  }

  for (const effectRef of item.effectRefs ?? []) {
    tags.add(effectRef);
  }

  if (item.category === 'weapon' && item.equipBehavior === 'two-handed') {
    tags.add('ranged-two-handed');
  }
}

function resolvePlayerStat(playerStats: PlayerStats, stat: string): number {
  if (stat === 'ranged') {
    return playerStats.rangedLevel;
  }

  if (stat === 'prayer') {
    return playerStats.prayerLevel ?? 1;
  }

  return playerStats.combatStats?.[stat] ?? 0;
}

function formatStatName(stat: string): string {
  return stat.charAt(0).toUpperCase() + stat.slice(1);
}

function formatRequiredTag(tag: string): string {
  switch (tag) {
    case 'ranged-weapon':
      return 'Requires an equipped ranged weapon.';
    case 'prototype-inventory-ability':
      return 'Requires the prototype item in backpack or equipped gear.';
    case 'ranged-two-handed':
      return 'Requires a two-handed ranged weapon.';
    case 'ranged-dual-wield':
      return 'Requires dual-wield ranged weapons.';
    case 'igneous-deadshot-upgrade':
      return 'Requires Igneous Kal-Xil or Igneous Kal-Zuk.';
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
