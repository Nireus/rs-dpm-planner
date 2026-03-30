import { describe, expect, it } from 'vitest';
import type { ItemDefinition } from '../../../game-data/types';
import {
  gearCatalogTabEmptyMessage,
  hasAnyItemsForGearCatalogTab,
  matchesGearCatalogTab,
} from './gear-catalog-tabs';

const makeItem = (overrides: Partial<ItemDefinition>): ItemDefinition => ({
  id: 'test-item',
  name: 'Test item',
  category: 'armor',
  combatStyleTags: ['ranged'],
  ...overrides,
});

describe('gear-catalog-tabs', () => {
  it('matches jewellery and utility items in the dedicated tab', () => {
    const ring = makeItem({
      id: 'champions-ring',
      category: 'jewellery',
      slot: 'ring',
      combatStyleTags: ['ranged'],
    });

    expect(matchesGearCatalogTab(ring, 'jewellery-utility')).toBe(true);
    expect(matchesGearCatalogTab(ring, 'ranged')).toBe(false);
  });

  it('keeps style gear in their matching style tab', () => {
    const rangedWeapon = makeItem({
      id: 'bolg',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['ranged'],
    });

    expect(matchesGearCatalogTab(rangedWeapon, 'ranged')).toBe(true);
    expect(matchesGearCatalogTab(rangedWeapon, 'melee')).toBe(false);
  });

  it('reports empty upcoming tabs correctly', () => {
    const items = [makeItem({ id: 'bolg', category: 'weapon', slot: 'weapon' })];

    expect(hasAnyItemsForGearCatalogTab(items, 'melee')).toBe(false);
    expect(gearCatalogTabEmptyMessage('melee')).toBe('Melee gear is coming soon.');
  });
});
