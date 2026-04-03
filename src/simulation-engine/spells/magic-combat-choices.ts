import type { EntityId } from '../../game-data/types';
import type { CombatChoices, PlayerStats } from '../models';

const MAGIC_SPELLBOOK_IDS = ['standard', 'ancient'] as const;

const STANDARD_COMBAT_SPELL_UNLOCKS: Array<{ id: EntityId; level: number }> = [
  { id: 'air-strike', level: 1 },
  { id: 'water-strike', level: 5 },
  { id: 'earth-strike', level: 9 },
  { id: 'fire-strike', level: 13 },
  { id: 'air-bolt', level: 17 },
  { id: 'water-bolt', level: 23 },
  { id: 'earth-bolt', level: 29 },
  { id: 'fire-bolt', level: 35 },
  { id: 'air-blast', level: 41 },
  { id: 'water-blast', level: 47 },
  { id: 'earth-blast', level: 53 },
  { id: 'fire-blast', level: 59 },
  { id: 'air-wave', level: 62 },
  { id: 'water-wave', level: 65 },
  { id: 'earth-wave', level: 70 },
  { id: 'fire-wave', level: 75 },
  { id: 'air-surge', level: 81 },
  { id: 'water-surge', level: 85 },
  { id: 'earth-surge', level: 90 },
  { id: 'fire-surge', level: 95 },
];

const ANCIENT_COMBAT_SPELL_UNLOCKS: Array<{ id: EntityId; level: number }> = [
  { id: 'smoke-rush', level: 50 },
  { id: 'shadow-rush', level: 52 },
  { id: 'blood-rush', level: 56 },
  { id: 'ice-rush', level: 58 },
  { id: 'smoke-burst', level: 62 },
  { id: 'shadow-burst', level: 64 },
  { id: 'blood-burst', level: 68 },
  { id: 'ice-burst', level: 70 },
  { id: 'smoke-blitz', level: 74 },
  { id: 'shadow-blitz', level: 76 },
  { id: 'blood-blitz', level: 80 },
  { id: 'ice-blitz', level: 82 },
  { id: 'smoke-barrage', level: 86 },
  { id: 'shadow-barrage', level: 88 },
  { id: 'blood-barrage', level: 92 },
  { id: 'ice-barrage', level: 94 },
  { id: 'exsanguinate', level: 96 },
  { id: 'incite-fear', level: 98 },
];

export function normalizeCombatChoices(
  playerStats: Pick<PlayerStats, 'magicLevel'>,
  combatChoices?: Partial<CombatChoices> | null,
): CombatChoices {
  const requestedSpellbookId = combatChoices?.magic?.spellbookId;
  const spellbookId = isRecognizedSpellbookId(requestedSpellbookId)
    ? requestedSpellbookId
    : 'standard';

  return {
    magic: {
      spellbookId,
      activeSpellId: resolveActiveSpellId(
        spellbookId,
        combatChoices?.magic?.activeSpellId,
        playerStats.magicLevel,
      ),
    },
  };
}

export function isRecognizedSpellbookId(value: unknown): value is CombatChoices['magic']['spellbookId'] {
  return typeof value === 'string' && MAGIC_SPELLBOOK_IDS.includes(value as (typeof MAGIC_SPELLBOOK_IDS)[number]);
}

export function resolveDefaultCombatSpellId(
  spellbookId: CombatChoices['magic']['spellbookId'],
  magicLevel: number | undefined,
): EntityId {
  return resolveHighestUnlockedSpellId(
    spellbookId === 'ancient'
      ? ANCIENT_COMBAT_SPELL_UNLOCKS
      : STANDARD_COMBAT_SPELL_UNLOCKS,
    magicLevel,
  );
}

function resolveActiveSpellId(
  spellbookId: CombatChoices['magic']['spellbookId'],
  requestedSpellId: EntityId | undefined,
  magicLevel: number | undefined,
): EntityId {
  const unlocks = spellbookId === 'ancient'
    ? ANCIENT_COMBAT_SPELL_UNLOCKS
    : STANDARD_COMBAT_SPELL_UNLOCKS;

  if (requestedSpellId && unlocks.some((entry) => entry.id === requestedSpellId)) {
    return requestedSpellId;
  }

  return resolveHighestUnlockedSpellId(unlocks, magicLevel);
}

function resolveHighestUnlockedSpellId(
  unlocks: Array<{ id: EntityId; level: number }>,
  magicLevel: number | undefined,
): EntityId {
  const level = typeof magicLevel === 'number' && Number.isFinite(magicLevel) ? magicLevel : 99;
  let highestUnlocked = unlocks[0]?.id ?? 'air-strike';

  for (const spell of unlocks) {
    if (level >= spell.level) {
      highestUnlocked = spell.id;
    }
  }

  return highestUnlocked;
}
