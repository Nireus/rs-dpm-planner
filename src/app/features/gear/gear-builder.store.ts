import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { EquipmentSlot, ItemDefinition } from '../../../game-data/types';
import type { ItemInstanceConfig } from '../../../simulation-engine/models';
import { GameDataStoreService } from '../../core/game-data/game-data-store.service';
import {
  canEquipItemInSlot,
  formatEquipmentSlot,
  SUPPORTED_GEAR_SLOTS,
  type GearBuilderState,
} from './gear-builder.utils';

const GEAR_BUILDER_STORAGE_KEY = 'rs-dpm-planner.gear-builder.v1';
const DEFAULT_GEAR_BUILDER_STATE: GearBuilderState = {
  equipment: {},
  inventory: [],
};

interface PersistedGearBuilderState {
  state: GearBuilderState;
  nextInstanceId: number;
}

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
  private readonly initialState = this.loadInitialState();
  private readonly state = signal<GearBuilderState>(this.initialState.state);
  private readonly nextInstanceIdValue = signal(this.initialState.nextInstanceId);

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

  constructor() {
    effect(() => {
      this.persistState({
        state: this.state(),
        nextInstanceId: this.nextInstanceIdValue(),
      });
    });
  }

  equipDefinition(definitionId: string, slot?: EquipmentSlot): string | null {
    const definition = this.findDefinition(definitionId);
    const targetSlot = slot ?? definition?.slot;

    if (!definition || !targetSlot || !canEquipItemInSlot(definition, targetSlot)) {
      return null;
    }

    const nextInstance = this.createInstance(definition);

    this.state.update((current) => {
      const previous = current.equipment[targetSlot];
      const inventory = previous ? [...current.inventory, previous] : [...current.inventory];

      return {
        equipment: {
          ...current.equipment,
          [targetSlot]: nextInstance,
        },
        inventory,
      };
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
    const instance = current.inventory.find((entry) => entry.instanceId === instanceId);

    if (!instance) {
      return null;
    }

    const definition = this.findDefinition(instance.definitionId);

    if (!definition || !canEquipItemInSlot(definition, slot)) {
      return null;
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

    return instance.instanceId;
  }

  moveEquippedItem(sourceSlot: EquipmentSlot, targetSlot: EquipmentSlot): string | null {
    if (sourceSlot === targetSlot) {
      return null;
    }

    const current = this.state();
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

      const nextEquipment = { ...latest.equipment };
      const displaced = nextEquipment[targetSlot];

      delete nextEquipment[sourceSlot];
      nextEquipment[targetSlot] = activeSource;

      return {
        equipment: nextEquipment,
        inventory: displaced ? [...latest.inventory, displaced] : [...latest.inventory],
      };
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
    this.clearPersistedState();
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

  private loadInitialState(): PersistedGearBuilderState {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        state: DEFAULT_GEAR_BUILDER_STATE,
        nextInstanceId: 1,
      };
    }

    try {
      const raw = window.localStorage.getItem(GEAR_BUILDER_STORAGE_KEY);

      if (!raw) {
        return {
          state: DEFAULT_GEAR_BUILDER_STATE,
          nextInstanceId: 1,
        };
      }

      const parsed = JSON.parse(raw) as Partial<PersistedGearBuilderState>;
      const equipment = sanitizeEquipment(parsed.state?.equipment);
      const inventory = sanitizeInventory(parsed.state?.inventory);
      const nextInstanceId = sanitizeNextInstanceId(parsed.nextInstanceId);

      return {
        state: {
          equipment,
          inventory,
        },
        nextInstanceId,
      };
    } catch {
      return {
        state: DEFAULT_GEAR_BUILDER_STATE,
        nextInstanceId: 1,
      };
    }
  }

  private persistState(state: PersistedGearBuilderState): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(GEAR_BUILDER_STORAGE_KEY, JSON.stringify(state));
  }

  private clearPersistedState(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.removeItem(GEAR_BUILDER_STORAGE_KEY);
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

function sanitizeEquipment(
  equipment: Partial<Record<EquipmentSlot, ItemInstanceConfig>> | undefined,
): Partial<Record<EquipmentSlot, ItemInstanceConfig>> {
  if (!equipment || typeof equipment !== 'object') {
    return {};
  }

  const sanitized: Partial<Record<EquipmentSlot, ItemInstanceConfig>> = {};

  for (const slot of SUPPORTED_GEAR_SLOTS) {
    const instance = equipment[slot];
    const nextInstance = sanitizeItemInstance(instance);

    if (nextInstance) {
      sanitized[slot] = nextInstance;
    }
  }

  return sanitized;
}

function sanitizeInventory(inventory: ItemInstanceConfig[] | undefined): ItemInstanceConfig[] {
  if (!Array.isArray(inventory)) {
    return [];
  }

  return inventory.map((entry) => sanitizeItemInstance(entry)).filter(isPresent);
}

function sanitizeItemInstance(instance: ItemInstanceConfig | undefined): ItemInstanceConfig | null {
  if (!instance || typeof instance !== 'object') {
    return null;
  }

  if (typeof instance.instanceId !== 'string' || typeof instance.definitionId !== 'string') {
    return null;
  }

  return {
    instanceId: instance.instanceId,
    definitionId: instance.definitionId,
    perkIds: Array.isArray(instance.perkIds) ? instance.perkIds.filter(isString) : undefined,
    configuredPerks: Array.isArray(instance.configuredPerks)
      ? instance.configuredPerks
          .filter(
            (entry) =>
              typeof entry?.socketIndex === 'number' &&
              typeof entry?.perkId === 'string' &&
              (entry.rank === undefined || typeof entry.rank === 'number'),
          )
          .map((entry) => ({
            socketIndex: Math.trunc(entry.socketIndex),
            perkId: entry.perkId,
            rank: typeof entry.rank === 'number' ? Math.trunc(entry.rank) : undefined,
          }))
      : undefined,
    configValues: sanitizeConfigValues(instance.configValues),
    effectRefs: Array.isArray(instance.effectRefs) ? instance.effectRefs.filter(isString) : undefined,
  };
}

function sanitizeConfigValues(
  configValues: Record<string, boolean | number | string> | undefined,
): Record<string, boolean | number | string> | undefined {
  if (!configValues || typeof configValues !== 'object') {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(configValues).filter(
      (entry): entry is [string, boolean | number | string] =>
        typeof entry[1] === 'boolean' || typeof entry[1] === 'number' || typeof entry[1] === 'string',
    ),
  );
}

function sanitizeNextInstanceId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.trunc(value));
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
