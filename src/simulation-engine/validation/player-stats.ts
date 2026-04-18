import type { PlayerStats } from '../models';

export type PlayerLevelStatKey =
  | 'attackLevel'
  | 'strengthLevel'
  | 'defenceLevel'
  | 'rangedLevel'
  | 'magicLevel'
  | 'necromancyLevel'
  | 'prayerLevel';

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

export const DEFAULT_PLAYER_LEVELS: Record<PlayerLevelStatKey, number> = {
  attackLevel: 120,
  strengthLevel: 120,
  defenceLevel: 99,
  rangedLevel: 120,
  magicLevel: 120,
  necromancyLevel: 99,
  prayerLevel: 99,
};

export const PLAYER_STAT_RANGE_RULES: PlayerStatRangeRule[] = [
  {
    key: 'attackLevel',
    min: 1,
    max: 120,
    required: true,
  },
  {
    key: 'strengthLevel',
    min: 1,
    max: 120,
    required: true,
  },
  {
    key: 'defenceLevel',
    min: 1,
    max: 120,
    required: true,
  },
  {
    key: 'rangedLevel',
    min: 1,
    max: 120,
    required: true,
  },
  {
    key: 'magicLevel',
    min: 1,
    max: 120,
    required: true,
  },
  {
    key: 'necromancyLevel',
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
      nextStats[rule.key] = DEFAULT_PLAYER_LEVELS[rule.key] as never;

      continue;
    }

    const normalized = Math.max(rule.min, Math.min(rule.max, Math.round(value)));
    nextStats[rule.key] = normalized as never;
  }

  return nextStats;
}

function formatStatField(field: PlayerLevelStatKey): string {
  switch (field) {
    case 'attackLevel':
      return 'Attack level';
    case 'strengthLevel':
      return 'Strength level';
    case 'defenceLevel':
      return 'Defence level';
    case 'rangedLevel':
      return 'Ranged level';
    case 'magicLevel':
      return 'Magic level';
    case 'necromancyLevel':
      return 'Necromancy level';
    case 'prayerLevel':
      return 'Prayer level';
  }
}
