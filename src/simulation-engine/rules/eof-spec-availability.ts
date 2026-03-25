import type { EofSpecDefinition, ItemDefinition } from '../../game-data/types';
import type { ItemInstanceConfig, PlayerStats } from '../models';
import { collectAvailabilityTags } from './ability-availability';

export interface EofSpecAvailabilityIssue {
  code: 'missing-level' | 'missing-tag' | 'blocked-tag';
  message: string;
}

export interface EofSpecAvailabilityResult {
  eofSpecId: string;
  isAvailable: boolean;
  issues: EofSpecAvailabilityIssue[];
}

export interface EofSpecAvailabilityContext {
  playerStats: PlayerStats;
  equippedItems: ItemDefinition[];
  inventoryItems: ItemDefinition[];
  equippedInstances?: ItemInstanceConfig[];
}

export function evaluateEofSpecAvailability(
  eofSpec: EofSpecDefinition,
  context: EofSpecAvailabilityContext,
): EofSpecAvailabilityResult {
  const issues: EofSpecAvailabilityIssue[] = [];
  const availableTags = collectAvailabilityTags(context);

  for (const [stat, requiredValue] of Object.entries(eofSpec.requires?.levelRequirements ?? {})) {
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

  for (const tag of eofSpec.requires?.requiredEquipmentTags ?? []) {
    if (!availableTags.has(tag)) {
      issues.push({
        code: 'missing-tag',
        message: formatRequiredTag(tag),
      });
    }
  }

  for (const tag of eofSpec.requires?.blockedEquipmentTags ?? []) {
    if (availableTags.has(tag)) {
      issues.push({
        code: 'blocked-tag',
        message: `${formatBlockedTag(tag)} blocks this EOF special.`,
      });
    }
  }

  return {
    eofSpecId: eofSpec.id,
    isAvailable: issues.length === 0,
    issues,
  };
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
  if (tag.startsWith('eof-special:')) {
    const storedSpecial = tag.replace('eof-special:', '').replace(/-/g, ' ');
    return `Requires Essence of Finality storing ${storedSpecial}.`;
  }

  return `Requires ${tag}.`;
}

function formatBlockedTag(tag: string): string {
  if (tag.startsWith('slot:')) {
    return `${tag.replace('slot:', '').replace(/-/g, ' ')} slot gear`;
  }

  return tag.replace(/-/g, ' ');
}
