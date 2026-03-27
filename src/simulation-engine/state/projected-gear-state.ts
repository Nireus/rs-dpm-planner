import type { RotationAction, SimulationConfig } from '../models';

export function projectSimulationConfigAtTick(
  config: SimulationConfig,
  tick: number,
): SimulationConfig {
  const relevantSwaps = [...config.rotationPlan.nonGcdActions]
    .filter((entry) => entry.actionType === 'gear-swap' && entry.tick < tick)
    .sort((left, right) => left.tick - right.tick);

  if (!relevantSwaps.length) {
    return config;
  }

  let projectedEquipment = { ...config.gearSetup.equipment };
  let projectedInventory = [...config.inventory.items];

  for (const swap of relevantSwaps) {
    const instanceId = readStringPayload(swap, 'instanceId');
    const slot = readStringPayload(swap, 'slot');
    if (!instanceId || !slot) {
      continue;
    }

    const inventoryInstance = projectedInventory.find((item) => item.instanceId === instanceId);
    if (!inventoryInstance) {
      continue;
    }

    const displaced = projectedEquipment[slot as keyof typeof projectedEquipment];
    projectedInventory = projectedInventory.filter((item) => item.instanceId !== instanceId);
    if (displaced) {
      projectedInventory.push(displaced);
    }

    projectedEquipment = {
      ...projectedEquipment,
      [slot]: inventoryInstance,
    };
  }

  return {
    ...config,
    gearSetup: {
      ...config.gearSetup,
      equipment: projectedEquipment,
      ammoSelection: resolveProjectedAmmoSelection(config, projectedEquipment),
    },
    inventory: {
      ...config.inventory,
      items: projectedInventory,
    },
  };
}

function resolveProjectedAmmoSelection(
  config: SimulationConfig,
  projectedEquipment: SimulationConfig['gearSetup']['equipment'],
): SimulationConfig['gearSetup']['ammoSelection'] {
  const ammoSlot = projectedEquipment.ammo;
  if (!ammoSlot) {
    return undefined;
  }

  if (config.gearSetup.ammoSelection?.instanceId === ammoSlot.instanceId) {
    return config.gearSetup.ammoSelection;
  }

  return ammoSlot;
}

function readStringPayload(action: RotationAction, key: string): string | null {
  const value = action.payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
