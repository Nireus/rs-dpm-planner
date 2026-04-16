import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { EquipmentSlot, ItemDefinition } from '../../../game-data/types';
import { CONFIG_OPTION_IDS } from '../../../game-data/conventions/mechanics';
import { findGenesisUnlockGroup } from '../../../simulation-engine/gear/configured-equipment-definition';
import type { ItemInstanceConfig } from '../../../simulation-engine/models';
import { GameDataStoreService } from '../game-data/game-data-store.service';
import type { GearBuilderState } from './gear-state';
import { WorkspaceRepositoryService } from '../workspace/workspace-repository.service';
import type { GearBuilderWorkspaceState } from '../workspace/workspace.models';
import { applyMagicBisPresetToGearState } from './magic-bis-preset';
import { applyMeleeBisPresetToGearState } from './melee-bis-preset';
import { applyRangedBisPresetToGearState } from './ranged-bis-preset';
import {
  applyGearBuilderPlacement,
  canEquipItemInSlot,
  formatEquipmentSlot,
  sortGearCatalogItems,
  SUPPORTED_GEAR_SLOTS,
} from './gear-builder.utils';

const DEFAULT_GEAR_BUILDER_STATE: GearBuilderState = {
  equipment: {},
  inventory: [],
};

const HIDDEN_GEAR_CATALOG_ITEM_IDS = new Set(['bakriminel-bolts']);

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
  locationKind: 'equipment' | 'inventory';
  slot?: EquipmentSlot;
}

@Injectable({
  providedIn: 'root',
})
export class GearBuilderStore {
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly workspaceRepository = inject(WorkspaceRepositoryService);
  private readonly initialState = this.workspaceRepository.readGearBuilderState();
  private readonly state = signal<GearBuilderState>(this.initialState.gearState);
  private readonly nextInstanceIdValue = signal(this.initialState.nextInstanceId);

  readonly equipmentSlots = SUPPORTED_GEAR_SLOTS;
  readonly snapshot = this.state.asReadonly();
  readonly availableItems = computed(() =>
    sortGearCatalogItems(
      Object.values(this.gameDataStore.snapshot().catalog?.items ?? {}).filter(
        (item) => !HIDDEN_GEAR_CATALOG_ITEM_IDS.has(item.id),
      ),
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

  constructor() {
    effect(() => {
      this.workspaceRepository.updateGearBuilderState(this.state(), this.nextInstanceIdValue());
    });
  }

  equipDefinition(definitionId: string, slot?: EquipmentSlot): string | null {
    const definition = this.findDefinition(definitionId);
    const targetSlot = slot ?? definition?.slot;
    const definitions = this.gameDataStore.snapshot().catalog?.items ?? {};

    if (!definition || !targetSlot || !canEquipItemInSlot(definition, targetSlot)) {
      return null;
    }

    const nextInstance = this.createInstance(definition);

    this.state.update((current) => {
      return applyGearBuilderPlacement(current, nextInstance, targetSlot, definitions);
    });

    return nextInstance.instanceId;
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

  addToInventory(definitionId: string): string | null {
    const definition = this.findDefinition(definitionId);

    if (!definition) {
      return null;
    }

    const nextInstance = this.createInstance(definition);

    this.state.update((current) => ({
      equipment: current.equipment,
      inventory: [...current.inventory, nextInstance],
    }));

    return nextInstance.instanceId;
  }

  removeFromInventory(instanceId: string): void {
    this.state.update((current) => ({
      equipment: current.equipment,
      inventory: current.inventory.filter((instance) => instance.instanceId !== instanceId),
    }));
  }

  equipInventoryItem(instanceId: string, slot: EquipmentSlot): string | null {
    const current = this.state();
    const definitions = this.gameDataStore.snapshot().catalog?.items ?? {};
    const instance = current.inventory.find((entry) => entry.instanceId === instanceId);

    if (!instance) {
      return null;
    }

    const definition = this.findDefinition(instance.definitionId);

    if (!definition || !canEquipItemInSlot(definition, slot)) {
      return null;
    }

    this.state.update((latest) => applyGearBuilderPlacement(latest, instance, slot, definitions));

    return instance.instanceId;
  }

  moveEquippedItem(sourceSlot: EquipmentSlot, targetSlot: EquipmentSlot): string | null {
    if (sourceSlot === targetSlot) {
      return null;
    }

    const current = this.state();
    const definitions = this.gameDataStore.snapshot().catalog?.items ?? {};
    const sourceInstance = current.equipment[sourceSlot];

    if (!sourceInstance) {
      return null;
    }

    const definition = this.findDefinition(sourceInstance.definitionId);

    if (!definition || !canEquipItemInSlot(definition, targetSlot)) {
      return null;
    }

    this.state.update((latest) => {
      const activeSource = latest.equipment[sourceSlot];
      if (!activeSource) {
        return latest;
      }

      return applyGearBuilderPlacement(latest, activeSource, targetSlot, definitions, sourceSlot);
    });

    return sourceInstance.instanceId;
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
          locationKind: 'equipment',
          slot,
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
      locationKind: 'inventory',
    };
  }

  updatePerkSocket(instanceId: string, socketIndex: number, perkIds: string[]): void {
    this.updateInstance(instanceId, (instance) => {
      const preservedPerks = (instance.configuredPerks ?? []).filter(
        (perk) => perk.socketIndex !== socketIndex,
      );
      const existingRanks = new Map(
        (instance.configuredPerks ?? [])
          .filter((perk) => perk.socketIndex === socketIndex)
          .map((perk) => [perk.perkId, perk.rank]),
      );
      const nextConfigured = [
        ...preservedPerks,
        ...perkIds.slice(0, 2).map((perkId) => ({
          socketIndex,
          perkId,
          rank: existingRanks.get(perkId),
        })),
      ];

      return {
        ...instance,
        configuredPerks: nextConfigured,
        perkIds: nextConfigured.map((perk) => perk.perkId),
      };
    });
  }

  updatePerkRank(instanceId: string, socketIndex: number, perkId: string, rank: number): void {
    this.updateInstance(instanceId, (instance) => {
      const nextConfigured = (instance.configuredPerks ?? []).map((perk) =>
        perk.socketIndex === socketIndex && perk.perkId === perkId
          ? {
              ...perk,
              rank,
            }
          : perk,
      );

      return {
        ...instance,
        configuredPerks: nextConfigured,
      };
    });
  }

  updateInstanceConfigValue(
    instanceId: string,
    optionId: string,
    value: boolean | number | string,
  ): void {
    if (optionId === CONFIG_OPTION_IDS.genesisEnchanted && typeof value === 'boolean') {
      this.state.update((current) => syncGenesisConfigAcrossUnlockGroup(current, instanceId, value));
      return;
    }

    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      configValues: {
        ...(instance.configValues ?? {}),
        [optionId]: value,
      },
    }));
  }

  reset(): void {
    this.state.set(DEFAULT_GEAR_BUILDER_STATE);
    this.nextInstanceIdValue.set(1);
    this.workspaceRepository.updateGearBuilderState(DEFAULT_GEAR_BUILDER_STATE, 1);
  }

  loadWorkspaceState(state: GearBuilderWorkspaceState): void {
    this.state.set({
      equipment: state.gearState.equipment ?? {},
      inventory: state.gearState.inventory ?? [],
    });
    this.nextInstanceIdValue.set(Math.max(1, Math.trunc(state.nextInstanceId)));
  }

  applyRangedBestInSlotPreset(removeCurrentGear: boolean): void {
    const result = applyRangedBisPresetToGearState(
      this.state(),
      this.nextInstanceIdValue(),
      { removeCurrentGear },
    );

    this.state.set(result.state);
    this.nextInstanceIdValue.set(result.nextInstanceId);
    this.workspaceRepository.updateGearBuilderState(result.state, result.nextInstanceId);
  }

  applyMagicBestInSlotPreset(removeCurrentGear: boolean): void {
    const result = applyMagicBisPresetToGearState(
      this.state(),
      this.nextInstanceIdValue(),
      { removeCurrentGear },
    );

    this.state.set(result.state);
    this.nextInstanceIdValue.set(result.nextInstanceId);
    this.workspaceRepository.updateGearBuilderState(result.state, result.nextInstanceId);
  }

  applyMeleeBestInSlotPreset(removeCurrentGear: boolean): void {
    const result = applyMeleeBisPresetToGearState(
      this.state(),
      this.nextInstanceIdValue(),
      { removeCurrentGear },
    );

    this.state.set(result.state);
    this.nextInstanceIdValue.set(result.nextInstanceId);
    this.workspaceRepository.updateGearBuilderState(result.state, result.nextInstanceId);
  }

  private findDefinition(definitionId: string): ItemDefinition | null {
    return this.gameDataStore.snapshot().catalog?.items[definitionId] ?? null;
  }

  private createInstance(definition: ItemDefinition): ItemInstanceConfig {
    const instanceNumber = this.nextInstanceIdValue();
    this.nextInstanceIdValue.set(instanceNumber + 1);

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

export function syncGenesisConfigAcrossUnlockGroup(
  state: GearBuilderState,
  sourceInstanceId: string,
  enabled: boolean,
): GearBuilderState {
  const sourceInstance = [
    ...Object.values(state.equipment).filter((instance): instance is ItemInstanceConfig => Boolean(instance)),
    ...state.inventory,
  ].find((instance) => instance.instanceId === sourceInstanceId);

  if (!sourceInstance) {
    return state;
  }

  const unlockGroup = findGenesisUnlockGroup(sourceInstance.definitionId);
  if (!unlockGroup) {
    return applyConfigValueToSingleInstance(state, sourceInstanceId, CONFIG_OPTION_IDS.genesisEnchanted, enabled);
  }

  let changed = false;
  const nextEquipment: Partial<Record<EquipmentSlot, ItemInstanceConfig>> = { ...state.equipment };

  for (const slot of SUPPORTED_GEAR_SLOTS) {
    const instance = state.equipment[slot];
    if (!instance || !unlockGroup.includes(instance.definitionId)) {
      continue;
    }

    nextEquipment[slot] = withGenesisConfigValue(instance, enabled);
    changed = true;
  }

  const nextInventory = state.inventory.map((instance) => {
    if (!unlockGroup.includes(instance.definitionId)) {
      return instance;
    }

    changed = true;
    return withGenesisConfigValue(instance, enabled);
  });

  if (!changed) {
    return state;
  }

  return {
    equipment: nextEquipment,
    inventory: nextInventory,
  };
}

function applyConfigValueToSingleInstance(
  state: GearBuilderState,
  instanceId: string,
  optionId: string,
  value: boolean | number | string,
): GearBuilderState {
  let changed = false;
  const nextEquipment: Partial<Record<EquipmentSlot, ItemInstanceConfig>> = { ...state.equipment };

  for (const slot of SUPPORTED_GEAR_SLOTS) {
    const instance = state.equipment[slot];
    if (instance?.instanceId !== instanceId) {
      continue;
    }

    nextEquipment[slot] = {
      ...instance,
      configValues: {
        ...(instance.configValues ?? {}),
        [optionId]: value,
      },
    };
    changed = true;
  }

  const nextInventory = state.inventory.map((instance) => {
    if (instance.instanceId !== instanceId) {
      return instance;
    }

    changed = true;
    return {
      ...instance,
      configValues: {
        ...(instance.configValues ?? {}),
        [optionId]: value,
      },
    };
  });

  if (!changed) {
    return state;
  }

  return {
    equipment: nextEquipment,
    inventory: nextInventory,
  };
}

function withGenesisConfigValue(instance: ItemInstanceConfig, enabled: boolean): ItemInstanceConfig {
  return {
    ...instance,
    configValues: {
      ...(instance.configValues ?? {}),
      [CONFIG_OPTION_IDS.genesisEnchanted]: enabled,
    },
  };
}
