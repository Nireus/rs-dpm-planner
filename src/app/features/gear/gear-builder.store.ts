import { computed, inject, Injectable, signal } from '@angular/core';
import type { EquipmentSlot, ItemDefinition } from '../../../game-data/types';
import type { ItemInstanceConfig } from '../../../simulation-engine/models';
import { GameDataStoreService } from '../../core/game-data/game-data-store.service';
import {
  canEquipItemInSlot,
  formatEquipmentSlot,
  SUPPORTED_GEAR_SLOTS,
  type GearBuilderState,
} from './gear-builder.utils';

export interface EquippedSlotViewModel {
  slot: EquipmentSlot;
  label: string;
  instance: ItemInstanceConfig | null;
  definition: ItemDefinition | null;
}

export interface InventoryEntryViewModel {
  instance: ItemInstanceConfig;
  definition: ItemDefinition | null;
  allowedSlots: EquipmentSlot[];
  primarySlot: EquipmentSlot | null;
}

export interface ResolvedItemInstanceViewModel {
  instance: ItemInstanceConfig;
  definition: ItemDefinition | null;
  locationLabel: string;
}

@Injectable({
  providedIn: 'root',
})
export class GearBuilderStore {
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly state = signal<GearBuilderState>({
    equipment: {},
    inventory: [],
  });

  private nextInstanceId = 1;

  readonly equipmentSlots = SUPPORTED_GEAR_SLOTS;
  readonly snapshot = this.state.asReadonly();
  readonly availableItems = computed(() =>
    Object.values(this.gameDataStore.snapshot().catalog?.items ?? {}).sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
  );

  readonly equippedSlots = computed<EquippedSlotViewModel[]>(() => {
    const definitions = this.gameDataStore.snapshot().catalog?.items ?? {};
    const equipment = this.state().equipment;

    return this.equipmentSlots.map((slot) => {
      const instance = equipment[slot] ?? null;

      return {
        slot,
        label: formatEquipmentSlot(slot),
        instance,
        definition: instance ? definitions[instance.definitionId] ?? null : null,
      };
    });
  });

  readonly inventoryEntries = computed<InventoryEntryViewModel[]>(() => {
    const definitions = this.gameDataStore.snapshot().catalog?.items ?? {};

    return this.state().inventory.map((instance) => {
      const definition = definitions[instance.definitionId] ?? null;

      return {
        instance,
        definition,
        allowedSlots: definition?.slot ? [definition.slot] : [],
        primarySlot: definition?.slot ?? null,
      };
    });
  });

  equipDefinition(definitionId: string, slot?: EquipmentSlot): boolean {
    const definition = this.findDefinition(definitionId);
    const targetSlot = slot ?? definition?.slot;

    if (!definition || !targetSlot || !canEquipItemInSlot(definition, targetSlot)) {
      return false;
    }

    this.state.update((current) => {
      const previous = current.equipment[targetSlot];
      const inventory = previous ? [...current.inventory, previous] : [...current.inventory];

      return {
        equipment: {
          ...current.equipment,
          [targetSlot]: this.createInstance(definition),
        },
        inventory,
      };
    });

    return true;
  }

  clearSlot(slot: EquipmentSlot): void {
    this.state.update((current) => {
      const existing = current.equipment[slot];

      if (!existing) {
        return current;
      }

      const nextEquipment = { ...current.equipment };
      delete nextEquipment[slot];

      return {
        equipment: nextEquipment,
        inventory: [...current.inventory, existing],
      };
    });
  }

  addToInventory(definitionId: string): boolean {
    const definition = this.findDefinition(definitionId);

    if (!definition) {
      return false;
    }

    this.state.update((current) => ({
      equipment: current.equipment,
      inventory: [...current.inventory, this.createInstance(definition)],
    }));

    return true;
  }

  removeFromInventory(instanceId: string): void {
    this.state.update((current) => ({
      equipment: current.equipment,
      inventory: current.inventory.filter((instance) => instance.instanceId !== instanceId),
    }));
  }

  equipInventoryItem(instanceId: string, slot: EquipmentSlot): boolean {
    const current = this.state();
    const instance = current.inventory.find((entry) => entry.instanceId === instanceId);

    if (!instance) {
      return false;
    }

    const definition = this.findDefinition(instance.definitionId);

    if (!definition || !canEquipItemInSlot(definition, slot)) {
      return false;
    }

    this.state.update((latest) => {
      const currentEquipped = latest.equipment[slot];
      const nextInventory = latest.inventory.filter((entry) => entry.instanceId !== instanceId);

      if (currentEquipped) {
        nextInventory.push(currentEquipped);
      }

      return {
        equipment: {
          ...latest.equipment,
          [slot]: instance,
        },
        inventory: nextInventory,
      };
    });

    return true;
  }

  moveEquippedItem(sourceSlot: EquipmentSlot, targetSlot: EquipmentSlot): boolean {
    if (sourceSlot === targetSlot) {
      return false;
    }

    const current = this.state();
    const sourceInstance = current.equipment[sourceSlot];

    if (!sourceInstance) {
      return false;
    }

    const definition = this.findDefinition(sourceInstance.definitionId);

    if (!definition || !canEquipItemInSlot(definition, targetSlot)) {
      return false;
    }

    this.state.update((latest) => {
      const activeSource = latest.equipment[sourceSlot];

      if (!activeSource) {
        return latest;
      }

      const nextEquipment = { ...latest.equipment };
      const displaced = nextEquipment[targetSlot];

      delete nextEquipment[sourceSlot];
      nextEquipment[targetSlot] = activeSource;

      return {
        equipment: nextEquipment,
        inventory: displaced ? [...latest.inventory, displaced] : [...latest.inventory],
      };
    });

    return true;
  }

  resolveInstance(instanceId: string): ResolvedItemInstanceViewModel | null {
    const definitions = this.gameDataStore.snapshot().catalog?.items ?? {};
    const current = this.state();

    for (const slot of this.equipmentSlots) {
      const instance = current.equipment[slot];

      if (instance?.instanceId === instanceId) {
        return {
          instance,
          definition: definitions[instance.definitionId] ?? null,
          locationLabel: `Equipped in ${formatEquipmentSlot(slot)}`,
        };
      }
    }

    const inventoryInstance = current.inventory.find((entry) => entry.instanceId === instanceId);

    if (!inventoryInstance) {
      return null;
    }

    return {
      instance: inventoryInstance,
      definition: definitions[inventoryInstance.definitionId] ?? null,
      locationLabel: 'In backpack',
    };
  }

  updateInstancePerk(instanceId: string, perkIndex: number, perkId: string): void {
    this.updateInstance(instanceId, (instance) => {
      const nextPerks = [...(instance.perkIds ?? [])];
      const normalizedPerk = perkId.trim();

      if (normalizedPerk) {
        nextPerks[perkIndex] = normalizedPerk;
      } else {
        nextPerks.splice(perkIndex, 1);
      }

      return {
        ...instance,
        perkIds: nextPerks.filter(Boolean),
      };
    });
  }

  updateInstanceConfigValue(
    instanceId: string,
    optionId: string,
    value: boolean | number | string,
  ): void {
    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      configValues: {
        ...(instance.configValues ?? {}),
        [optionId]: value,
      },
    }));
  }

  private findDefinition(definitionId: string): ItemDefinition | null {
    return this.gameDataStore.snapshot().catalog?.items[definitionId] ?? null;
  }

  private createInstance(definition: ItemDefinition): ItemInstanceConfig {
    const instanceNumber = this.nextInstanceId;
    this.nextInstanceId += 1;

    return {
      instanceId: `gear-item-${instanceNumber}`,
      definitionId: definition.id,
    };
  }

  private updateInstance(
    instanceId: string,
    updater: (instance: ItemInstanceConfig) => ItemInstanceConfig,
  ): void {
    this.state.update((current) => {
      let changed = false;
      const nextEquipment: Partial<Record<EquipmentSlot, ItemInstanceConfig>> = {
        ...current.equipment,
      };

      for (const slot of this.equipmentSlots) {
        const instance = current.equipment[slot];

        if (instance?.instanceId === instanceId) {
          nextEquipment[slot] = updater(instance);
          changed = true;
        }
      }

      const nextInventory = current.inventory.map((instance) => {
        if (instance.instanceId !== instanceId) {
          return instance;
        }

        changed = true;
        return updater(instance);
      });

      if (!changed) {
        return current;
      }

      return {
        equipment: nextEquipment,
        inventory: nextInventory,
      };
    });
  }
}
