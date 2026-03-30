import { describe, expect, it } from 'vitest';
import type { AbilityDefinition } from '../../../game-data/types';
import {
  abilityStyleEmptyMessage,
  displayAbilitySubtypeLabel,
  filterAbilitiesByStyle,
  groupAbilitiesBySubtype,
  hasAnyAbilitiesForStyle,
  styleTabThemeClass,
} from './ability-style-tabs';

const makeAbility = (overrides: Partial<AbilityDefinition>): AbilityDefinition => ({
  id: 'test-ability',
  name: 'Test Ability',
  style: 'ranged',
  subtype: 'basic',
  cooldownTicks: 0,
  hitSchedule: [],
  baseDamage: { min: 0, max: 0 },
  ...overrides,
});

describe('ability-style-tabs', () => {
  it('filters abilities by selected style', () => {
    const abilities = [
      makeAbility({ id: 'piercing-shot', style: 'ranged' }),
      makeAbility({ id: 'fury', style: 'melee' }),
    ];

    expect(filterAbilitiesByStyle(abilities, 'melee').map((ability) => ability.id)).toEqual(['fury']);
    expect(hasAnyAbilitiesForStyle(abilities, 'magic')).toBe(false);
  });

  it('groups abilities by subtype in planner/browser order', () => {
    const abilities = [
      makeAbility({ id: 'deadshot', name: 'Deadshot', subtype: 'ultimate' }),
      makeAbility({ id: 'piercing-shot', name: 'Piercing Shot', subtype: 'basic' }),
      makeAbility({ id: 'rapid-fire', name: 'Rapid Fire', subtype: 'enhanced' }),
    ];

    expect(groupAbilitiesBySubtype(abilities).map((group) => group.key)).toEqual([
      'basic',
      'enhanced',
      'ultimate',
    ]);
  });

  it('uses utility copy for other subtype and coming-soon copy for empty future styles', () => {
    expect(displayAbilitySubtypeLabel('other')).toBe('Utility');
    expect(abilityStyleEmptyMessage('melee')).toBe('Melee abilities are coming soon.');
    expect(styleTabThemeClass('magic')).toBe('style-magic');
  });
});
