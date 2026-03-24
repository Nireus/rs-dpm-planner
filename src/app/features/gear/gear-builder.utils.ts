import type { EquipmentSlot, ItemDefinition } from '../../../game-data/types';
import type { ItemInstanceConfig } from '../../../simulation-engine/models';

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

export interface GearBuilderState {
  equipment: Partial<Record<EquipmentSlot, ItemInstanceConfig>>;
  inventory: ItemInstanceConfig[];
}

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
