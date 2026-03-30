import type { ItemDefinition } from '../../../game-data/types';

export type GearCatalogTabId =
  | 'melee'
  | 'ranged'
  | 'magic'
  | 'necromancy'
  | 'jewellery-utility';

export type GearCatalogTabDefinition = {
  id: GearCatalogTabId;
  label: string;
};

const UTILITY_SLOTS = new Set(['ring', 'amulet', 'cape', 'pocket']);
export const GEAR_CATALOG_TABS: GearCatalogTabDefinition[] = [
  { id: 'melee', label: 'Melee' },
  { id: 'ranged', label: 'Ranged' },
  { id: 'magic', label: 'Magic' },
  { id: 'necromancy', label: 'Necromancy' },
  { id: 'jewellery-utility', label: 'Jewellery + Utility' },
];

export function matchesGearCatalogTab(item: ItemDefinition, tabId: GearCatalogTabId): boolean {
  if (tabId === 'jewellery-utility') {
    return isJewelleryOrUtilityItem(item);
  }

  return !isJewelleryOrUtilityItem(item) && item.combatStyleTags.includes(tabId);
}

export function hasAnyItemsForGearCatalogTab(
  items: readonly ItemDefinition[],
  tabId: GearCatalogTabId,
): boolean {
  return items.some((item) => matchesGearCatalogTab(item, tabId));
}

export function gearCatalogTabEmptyMessage(tabId: GearCatalogTabId): string {
  switch (tabId) {
    case 'melee':
      return 'Melee gear is coming soon.';
    case 'magic':
      return 'Magic gear is coming soon.';
    case 'necromancy':
      return 'Necromancy gear is coming soon.';
    case 'jewellery-utility':
      return 'Jewellery and utility gear definitions are coming soon.';
    case 'ranged':
    default:
      return 'No loaded item definitions match the current search.';
  }
}

function isJewelleryOrUtilityItem(item: ItemDefinition): boolean {
  if (item.category === 'jewellery' || item.category === 'pocket') {
    return true;
  }

  return item.slot !== undefined && UTILITY_SLOTS.has(item.slot);
}
