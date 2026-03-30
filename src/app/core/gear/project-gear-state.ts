import type { EquipmentSlot, ItemDefinition } from '../../../game-data/types';
import { applyEquipmentPlacement } from '../../../simulation-engine/gear/equipment-topology';
import type { RotationAction } from '../../../simulation-engine/models';
import type { GearBuilderState } from './gear-state';

export function projectGearStateAtTick(
  gearState: GearBuilderState,
  definitions: Record<string, ItemDefinition>,
  nonGcdActions: RotationAction[],
  tick: number,
): GearBuilderState {
  let projectedState: GearBuilderState = {
    equipment: { ...gearState.equipment },
    inventory: [...gearState.inventory],
  };

  for (const action of [...nonGcdActions].sort((left, right) => left.tick - right.tick)) {
    if (action.tick >= tick) {
      break;
    }

    if (action.actionType === 'gear-swap') {
      projectedState = applyProjectedGearSwap(projectedState, definitions, action);
    }
  }

  return projectedState;
}

export function applyProjectedGearSwap(
  state: GearBuilderState,
  definitions: Record<string, ItemDefinition>,
  action: RotationAction,
): GearBuilderState {
  const instanceId = readStringPayload(action, 'instanceId');
  const slot = readStringPayload(action, 'slot') as EquipmentSlot | null;

  if (!instanceId || !slot) {
    return state;
  }

  const inventoryInstance = state.inventory.find((item) => item.instanceId === instanceId);
  if (!inventoryInstance) {
    return state;
  }

  return applyEquipmentPlacement(state, inventoryInstance, slot, definitions);
}

function readStringPayload(action: RotationAction, key: string): string | null {
  const value = action.payload[key];
  return typeof value === 'string' && value ? value : null;
}
