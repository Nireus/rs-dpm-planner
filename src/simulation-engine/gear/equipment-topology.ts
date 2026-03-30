import type { EquipmentSlot, ItemDefinition } from '../../game-data/types';
import type { ItemInstanceConfig } from '../models';

export interface EquipmentTopologyState {
  equipment: Partial<Record<EquipmentSlot, ItemInstanceConfig>>;
  inventory: ItemInstanceConfig[];
}

export function isTwoHandedItem(definition: ItemDefinition | null | undefined): boolean {
  return definition?.category === 'weapon' && definition.equipBehavior === 'two-handed';
}

export function canEquipItemInEquipmentTopology(
  item: ItemDefinition,
  targetSlot: EquipmentSlot,
  _equipment: Partial<Record<EquipmentSlot, ItemInstanceConfig>>,
  _definitions: Record<string, ItemDefinition>,
): boolean {
  if (!item.slot || item.slot !== targetSlot) {
    return false;
  }

  return true;
}

export function applyEquipmentPlacement(
  state: EquipmentTopologyState,
  itemInstance: ItemInstanceConfig,
  targetSlot: EquipmentSlot,
  definitions: Record<string, ItemDefinition>,
  sourceSlot?: EquipmentSlot,
): EquipmentTopologyState {
  const itemDefinition = definitions[itemInstance.definitionId];
  if (
    !itemDefinition ||
    !canEquipItemInEquipmentTopology(itemDefinition, targetSlot, state.equipment, definitions)
  ) {
    return state;
  }

  const nextEquipment = { ...state.equipment };
  const nextInventory = state.inventory.filter((entry) => entry.instanceId !== itemInstance.instanceId);

  if (sourceSlot) {
    delete nextEquipment[sourceSlot];
  }

  const displacedTarget = nextEquipment[targetSlot];
  if (displacedTarget && displacedTarget.instanceId !== itemInstance.instanceId) {
    nextInventory.push(displacedTarget);
  }

  if (targetSlot === 'offHand') {
    const displacedMainHand = nextEquipment.weapon;
    const displacedMainHandDefinition = displacedMainHand
      ? definitions[displacedMainHand.definitionId] ?? null
      : null;

    if (
      displacedMainHand &&
      isTwoHandedItem(displacedMainHandDefinition) &&
      displacedMainHand.instanceId !== itemInstance.instanceId
    ) {
      nextInventory.push(displacedMainHand);
      delete nextEquipment.weapon;
    }
  }

  nextEquipment[targetSlot] = itemInstance;

  return {
    equipment: nextEquipment,
    inventory: nextInventory,
  };
}
