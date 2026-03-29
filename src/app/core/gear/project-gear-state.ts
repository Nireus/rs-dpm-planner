import type { EquipmentSlot } from '../../../game-data/types';
import type { RotationAction } from '../../../simulation-engine/models';
import type { GearBuilderState } from './gear-state';

export function projectGearStateAtTick(
  gearState: GearBuilderState,
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
      projectedState = applyProjectedGearSwap(projectedState, action);
    }
  }

  return projectedState;
}

export function applyProjectedGearSwap(
  state: GearBuilderState,
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

  const displaced = state.equipment[slot];
  const nextInventory = state.inventory.filter((item) => item.instanceId !== instanceId);

  if (displaced) {
    nextInventory.push(displaced);
  }

  return {
    equipment: {
      ...state.equipment,
      [slot]: inventoryInstance,
    },
    inventory: nextInventory,
  };
}

function readStringPayload(action: RotationAction, key: string): string | null {
  const value = action.payload[key];
  return typeof value === 'string' && value ? value : null;
}
