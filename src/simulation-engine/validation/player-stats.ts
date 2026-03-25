import type { PlayerStats } from '../models';

type PlayerLevelStatKey = 'rangedLevel' | 'prayerLevel';

export interface PlayerStatRangeRule {
  key: PlayerLevelStatKey;
  min: number;
  max: number;
  required: boolean;
}

export interface PlayerStatsValidationIssue {
  field: PlayerLevelStatKey;
  message: string;
}

export const PLAYER_STAT_RANGE_RULES: PlayerStatRangeRule[] = [
  {
    key: 'rangedLevel',
    min: 1,
    max: 120,
    required: true,
  },
  {
    key: 'prayerLevel',
    min: 1,
    max: 99,
    required: false,
  },
];

export function validatePlayerStats(stats: PlayerStats): PlayerStatsValidationIssue[] {
  return PLAYER_STAT_RANGE_RULES.flatMap((rule) => {
    const value = stats[rule.key];

    if (value === undefined || value === null) {
      return rule.required
        ? [{ field: rule.key, message: `${formatStatField(rule.key)} is required.` }]
        : [];
    }

    if (!Number.isInteger(value)) {
      return [{ field: rule.key, message: `${formatStatField(rule.key)} must be a whole number.` }];
    }

    if (value < rule.min || value > rule.max) {
      return [
        {
          field: rule.key,
          message: `${formatStatField(rule.key)} must be between ${rule.min} and ${rule.max}.`,
        },
      ];
    }

    return [];
  });
}

export function sanitizePlayerStats(stats: PlayerStats): PlayerStats {
  const issues = validatePlayerStats(stats);

  if (!issues.length) {
    return stats;
  }

  const nextStats: PlayerStats = { ...stats };

  for (const rule of PLAYER_STAT_RANGE_RULES) {
    const value = nextStats[rule.key];

    if (value === undefined || value === null || !Number.isFinite(value)) {
      if (rule.required) {
        nextStats[rule.key] = rule.max as never;
      }

      continue;
    }

    const normalized = Math.max(rule.min, Math.min(rule.max, Math.round(value)));
    nextStats[rule.key] = normalized as never;
  }

  return nextStats;
}

function formatStatField(field: PlayerLevelStatKey): string {
  return field === 'rangedLevel' ? 'Ranged level' : 'Prayer level';
}
