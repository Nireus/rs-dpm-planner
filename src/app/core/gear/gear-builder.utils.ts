import { EFFECT_REF_IDS } from '../../../game-data/conventions/mechanics';
import type { EquipmentSlot, ItemDefinition } from '../../../game-data/types';
import type { ItemInstanceConfig } from '../../../simulation-engine/models';
import type { GearBuilderState } from './gear-state';

export const SUPPORTED_GEAR_SLOTS: EquipmentSlot[] = [
  'weapon',
  'ammo',
  'head',
  'body',
  'legs',
  'hands',
  'feet',
  'ring',
  'amulet',
  'cape',
  'pocket',
];

export type GearDragSource =
  | {
      kind: 'catalog';
      definitionId: string;
    }
  | {
      kind: 'inventory';
      instanceId: string;
    }
  | {
      kind: 'equipped';
      slot: EquipmentSlot;
    };

export function getAllowedEquipmentSlots(item: ItemDefinition): EquipmentSlot[] {
  if (!item.slot || !SUPPORTED_GEAR_SLOTS.includes(item.slot)) {
    return [];
  }

  return [item.slot];
}

export function canEquipItemInSlot(item: ItemDefinition, slot: EquipmentSlot): boolean {
  return getAllowedEquipmentSlots(item).includes(slot);
}

export function canDropIntoInventory(
  source: GearDragSource | null,
  state: GearBuilderState,
): boolean {
  if (!source) {
    return false;
  }

  if (source.kind === 'catalog') {
    return true;
  }

  if (source.kind === 'equipped') {
    return Boolean(state.equipment[source.slot]);
  }

  return false;
}

export function canDropIntoEquipmentSlot(
  source: GearDragSource | null,
  targetSlot: EquipmentSlot,
  definitions: Record<string, ItemDefinition>,
  state: GearBuilderState,
): boolean {
  if (!source) {
    return false;
  }

  if (source.kind === 'catalog') {
    const definition = definitions[source.definitionId];
    return Boolean(definition && canEquipItemInSlot(definition, targetSlot));
  }

  if (source.kind === 'inventory') {
    const instance = state.inventory.find((entry) => entry.instanceId === source.instanceId);
    const definition = instance ? definitions[instance.definitionId] : null;
    return Boolean(definition && canEquipItemInSlot(definition, targetSlot));
  }

  const instance = state.equipment[source.slot];
  const definition = instance ? definitions[instance.definitionId] : null;

  if (!definition || source.slot === targetSlot) {
    return false;
  }

  return canEquipItemInSlot(definition, targetSlot);
}

export function validateGearSetup(
  equipment: Partial<Record<EquipmentSlot, ItemInstanceConfig>>,
  definitions: Record<string, ItemDefinition>,
): string[] {
  const issues: string[] = [];

  for (const slot of SUPPORTED_GEAR_SLOTS) {
    const instance = equipment[slot];

    if (!instance) {
      continue;
    }

    const definition = definitions[instance.definitionId];

    if (!definition) {
      issues.push(`Slot "${slot}" references unknown item "${instance.definitionId}".`);
      continue;
    }

    if (!canEquipItemInSlot(definition, slot)) {
      issues.push(`Item "${definition.name}" cannot be equipped in slot "${slot}".`);
    }
  }

  return issues;
}

export function formatEquipmentSlot(slot: EquipmentSlot): string {
  if (slot === 'ammo') {
    return 'Ammo';
  }

  return slot.charAt(0).toUpperCase() + slot.slice(1);
}

export function isAugmentableSlot(slot: EquipmentSlot | undefined): boolean {
  return slot === 'weapon' || slot === 'body' || slot === 'legs';
}

export function requiresImmediateItemConfiguration(item: ItemDefinition): boolean {
  return isAugmentableSlot(item.slot) || Boolean(item.configOptions?.length);
}

export function sortGearCatalogItems(items: ItemDefinition[]): ItemDefinition[] {
  return [...items].sort((left, right) => compareGearCatalogItems(left, right));
}

function compareGearCatalogItems(left: ItemDefinition, right: ItemDefinition): number {
  const categoryOrderDifference = getCatalogPriority(left) - getCatalogPriority(right);

  if (categoryOrderDifference !== 0) {
    return categoryOrderDifference;
  }

  const tierDifference = (right.tier ?? 0) - (left.tier ?? 0);

  if (tierDifference !== 0) {
    return tierDifference;
  }

  return left.name.localeCompare(right.name);
}

function getCatalogPriority(item: ItemDefinition): number {
  if (isQuiverItem(item)) {
    return 0;
  }

  if (item.category === 'jewellery') {
    return 1;
  }

  return 2;
}

function isQuiverItem(item: ItemDefinition): boolean {
  return item.effectRefs?.includes(EFFECT_REF_IDS.quiverPassive) ?? false;
}
