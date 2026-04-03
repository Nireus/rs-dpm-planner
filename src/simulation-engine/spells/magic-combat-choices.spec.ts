import { describe, expect, it } from 'vitest';

import { normalizeCombatChoices, resolveDefaultCombatSpellId } from './magic-combat-choices';

describe('magic combat choices', () => {
  it('defaults to the highest unlocked standard combat spell', () => {
    expect(normalizeCombatChoices({ magicLevel: 99 })).toEqual({
      magic: {
        spellbookId: 'standard',
        activeSpellId: 'fire-surge',
      },
    });
  });

  it('falls back to the highest unlocked ancient spell when no valid ancient spell is selected', () => {
    expect(
      normalizeCombatChoices(
        { magicLevel: 97 },
        {
          magic: {
            spellbookId: 'ancient',
            activeSpellId: 'fire-surge',
          },
        },
      ),
    ).toEqual({
      magic: {
        spellbookId: 'ancient',
        activeSpellId: 'exsanguinate',
      },
    });
  });

  it('preserves a recognized requested spell within the selected spellbook', () => {
    expect(
      normalizeCombatChoices(
        { magicLevel: 99 },
        {
          magic: {
            spellbookId: 'standard',
            activeSpellId: 'water-surge',
          },
        },
      ),
    ).toEqual({
      magic: {
        spellbookId: 'standard',
        activeSpellId: 'water-surge',
      },
    });
  });

  it('resolves default spell ids from unlock thresholds', () => {
    expect(resolveDefaultCombatSpellId('standard', 70)).toBe('earth-wave');
    expect(resolveDefaultCombatSpellId('ancient', 82)).toBe('ice-blitz');
  });
});
