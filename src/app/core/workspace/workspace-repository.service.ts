import { Injectable } from '@angular/core';
import type { BuffDefinition } from '../../../game-data/types';
import type { CombatChoices, ItemInstanceConfig, PlayerStats } from '../../../simulation-engine/models';
import type { PortableConfigDocument } from '../../../simulation-engine/models/portable-config';
import { parsePortableConfigDocument } from '../../../simulation-engine/validation/portable-config';
import type { BuffSelectionState } from '../buffs/persistent-buff-config';
import {
  buildBuffSelectionStateFromPersistentConfig,
  buildPersistentBuffConfigFromBuffSelection,
} from '../buffs/persistent-buff-config';
import type { GearBuilderState } from '../gear/gear-state';
import {
  DEFAULT_WORKSPACE_DOCUMENT,
  isWorkspaceDocument,
  LEGACY_BUFF_CONFIGURATION_STORAGE_KEY,
  LEGACY_GEAR_BUILDER_STORAGE_KEY,
  LEGACY_PLAYER_STATS_STORAGE_KEY,
  LEGACY_ROTATION_PLANNER_STORAGE_KEY,
  type GearBuilderWorkspaceState,
  type RotationPlannerWorkspaceState,
  WORKSPACE_STORAGE_KEY,
  type WorkspaceDocument,
} from './workspace.models';
import type { WorkspaceRepository } from './workspace-repository';

@Injectable({
  providedIn: 'root',
})
export class WorkspaceRepositoryService implements WorkspaceRepository {
  readDocument(): WorkspaceDocument {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_WORKSPACE_DOCUMENT;
    }

    return this.readWorkspaceDocumentFromStorage() ?? this.buildDocumentFromCurrentSlices();
  }

  readPortableConfigDocument(): PortableConfigDocument {
    return this.readDocument().portableConfig;
  }

  readPlayerStats(): PlayerStats {
    const storedDocument = this.readWorkspaceDocumentFromStorage();
    if (storedDocument) {
      return storedDocument.portableConfig.playerStats;
    }

    return (this.readLegacyJson(LEGACY_PLAYER_STATS_STORAGE_KEY) as PlayerStats | null)
      ?? DEFAULT_WORKSPACE_DOCUMENT.portableConfig.playerStats;
  }

  readCombatChoices(): CombatChoices {
    const storedDocument = this.readWorkspaceDocumentFromStorage();
    if (storedDocument) {
      return storedDocument.portableConfig.combatChoices;
    }

    return DEFAULT_WORKSPACE_DOCUMENT.portableConfig.combatChoices;
  }

  readGearBuilderState(): GearBuilderWorkspaceState {
    const document = this.readWorkspaceDocumentFromStorage();
    if (document) {
      return {
        gearState: {
          equipment: document.portableConfig.gearSetup.equipment ?? {},
          inventory: document.portableConfig.inventory.items ?? [],
        },
        nextInstanceId: document.appState.gearBuilder.nextInstanceId,
      };
    }

    const legacyGearBuilder = this.readLegacyJson(LEGACY_GEAR_BUILDER_STORAGE_KEY) as
      | { state?: GearBuilderState; nextInstanceId?: number }
      | null;

    return {
      gearState: {
        equipment: legacyGearBuilder?.state?.equipment ?? DEFAULT_WORKSPACE_DOCUMENT.portableConfig.gearSetup.equipment,
        inventory: legacyGearBuilder?.state?.inventory ?? DEFAULT_WORKSPACE_DOCUMENT.portableConfig.inventory.items,
      },
      nextInstanceId: legacyGearBuilder?.nextInstanceId ?? DEFAULT_WORKSPACE_DOCUMENT.appState.gearBuilder.nextInstanceId,
    };
  }

  readBuffSelectionState(): BuffSelectionState {
    const document = this.readWorkspaceDocumentFromStorage();
    if (document) {
      return document.appState.buffSelection
        ?? buildBuffSelectionStateFromPersistentConfig(document.portableConfig.persistentBuffConfig);
    }

    return (
      this.readLegacyJson(LEGACY_BUFF_CONFIGURATION_STORAGE_KEY) as BuffSelectionState | null
    ) ?? buildBuffSelectionStateFromPersistentConfig(DEFAULT_WORKSPACE_DOCUMENT.portableConfig.persistentBuffConfig);
  }

  readRotationPlannerState(): RotationPlannerWorkspaceState {
    const document = this.readWorkspaceDocumentFromStorage();
    if (document) {
      const plan = document.portableConfig.rotationPlan;

      return {
        startingAdrenaline: plan.startingAdrenaline,
        tickCount: plan.tickCount,
        startingStacks: plan.startingStacks ?? {},
        nonGcdActions: plan.nonGcdActions,
        abilityActions: plan.abilityActions,
      };
    }

    const legacyPlannerState = this.readLegacyJson(LEGACY_ROTATION_PLANNER_STORAGE_KEY) as RotationPlannerWorkspaceState | null;

    return {
      startingAdrenaline: legacyPlannerState?.startingAdrenaline ?? DEFAULT_WORKSPACE_DOCUMENT.portableConfig.rotationPlan.startingAdrenaline,
      tickCount: legacyPlannerState?.tickCount ?? DEFAULT_WORKSPACE_DOCUMENT.portableConfig.rotationPlan.tickCount,
      startingStacks: legacyPlannerState?.startingStacks ?? DEFAULT_WORKSPACE_DOCUMENT.portableConfig.rotationPlan.startingStacks ?? {},
      nonGcdActions: legacyPlannerState?.nonGcdActions ?? DEFAULT_WORKSPACE_DOCUMENT.portableConfig.rotationPlan.nonGcdActions,
      abilityActions: legacyPlannerState?.abilityActions ?? DEFAULT_WORKSPACE_DOCUMENT.portableConfig.rotationPlan.abilityActions,
    };
  }

  replacePortableConfigDocument(portableConfig: PortableConfigDocument): WorkspaceDocument {
    const nextDocument = this.buildWorkspaceDocumentFromPortableConfig(portableConfig);

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(nextDocument));
      this.clearLegacyKeys();
    }

    return nextDocument;
  }

  updatePlayerStats(playerStats: PlayerStats): void {
    this.updateDocument((current) => ({
      ...current,
      portableConfig: {
        ...current.portableConfig,
        playerStats,
      },
    }));
  }

  updateCombatChoices(combatChoices: CombatChoices): void {
    this.updateDocument((current) => ({
      ...current,
      portableConfig: {
        ...current.portableConfig,
        combatChoices,
      },
    }));
  }

  updateGearBuilderState(gearState: GearBuilderState, nextInstanceId: number): void {
    this.updateDocument((current) => ({
      ...current,
      portableConfig: {
        ...current.portableConfig,
        gearSetup: {
          ...current.portableConfig.gearSetup,
          equipment: gearState.equipment,
        },
        inventory: {
          ...current.portableConfig.inventory,
          items: gearState.inventory,
        },
      },
      appState: {
        ...current.appState,
        gearBuilder: {
          nextInstanceId,
        },
      },
    }));
  }

  updateBuffSelectionState(
    selection: BuffSelectionState,
    buffDefinitions: Record<string, BuffDefinition>,
  ): void {
    this.updateDocument((current) => ({
      ...current,
      portableConfig: {
        ...current.portableConfig,
        persistentBuffConfig: buildPersistentBuffConfigFromBuffSelection(selection, buffDefinitions),
      },
      appState: {
        ...current.appState,
        buffSelection: {
          activeBuffIds: [...selection.activeBuffIds],
          activeRelicIds: [...selection.activeRelicIds],
          activePocketItemIds: [...selection.activePocketItemIds],
        },
      },
    }));
  }

  updateRotationPlannerState(state: RotationPlannerWorkspaceState): void {
    this.updateDocument((current) => ({
      ...current,
      portableConfig: {
        ...current.portableConfig,
        rotationPlan: {
          startingAdrenaline: state.startingAdrenaline,
          tickCount: state.tickCount,
          startingStacks: state.startingStacks,
          nonGcdActions: state.nonGcdActions,
          abilityActions: state.abilityActions,
        },
      },
    }));
  }

  clear(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    this.clearLegacyKeys();
  }

  private updateDocument(updater: (current: WorkspaceDocument) => WorkspaceDocument): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const nextDocument = updater(this.readDocument());
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(nextDocument));
    this.clearLegacyKeys();
  }

  private readWorkspaceDocumentFromStorage(): WorkspaceDocument | null {
    try {
      const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (!isWorkspaceDocument(parsed)) {
        return null;
      }

      const portableConfigResult = parsePortableConfigDocument(parsed.portableConfig);
      if (!portableConfigResult.success) {
        return null;
      }

      return {
        ...parsed,
        portableConfig: portableConfigResult.data,
      };
    } catch {
      return null;
    }
  }

  private readLegacyJson(key: string): unknown {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private buildDocumentFromCurrentSlices(): WorkspaceDocument {
    const gearBuilder = this.readGearBuilderState();
    const rotationPlanner = this.readRotationPlannerState();
    const buffSelection = this.readLegacyJson(LEGACY_BUFF_CONFIGURATION_STORAGE_KEY) as BuffSelectionState | null;

    return {
      ...DEFAULT_WORKSPACE_DOCUMENT,
      portableConfig: {
        ...DEFAULT_WORKSPACE_DOCUMENT.portableConfig,
        playerStats: this.readPlayerStats(),
        gearSetup: {
          ...DEFAULT_WORKSPACE_DOCUMENT.portableConfig.gearSetup,
          equipment: gearBuilder.gearState.equipment,
        },
        inventory: {
          ...DEFAULT_WORKSPACE_DOCUMENT.portableConfig.inventory,
          items: gearBuilder.gearState.inventory,
        },
        rotationPlan: {
          startingAdrenaline: rotationPlanner.startingAdrenaline,
          tickCount: rotationPlanner.tickCount,
          startingStacks: rotationPlanner.startingStacks,
          nonGcdActions: rotationPlanner.nonGcdActions,
          abilityActions: rotationPlanner.abilityActions,
        },
      },
      appState: {
        gearBuilder: {
          nextInstanceId: gearBuilder.nextInstanceId,
        },
        buffSelection:
          buffSelection
          ?? buildBuffSelectionStateFromPersistentConfig(DEFAULT_WORKSPACE_DOCUMENT.portableConfig.persistentBuffConfig),
      },
    };
  }

  private buildWorkspaceDocumentFromPortableConfig(
    portableConfig: PortableConfigDocument,
  ): WorkspaceDocument {
    return {
      ...DEFAULT_WORKSPACE_DOCUMENT,
      portableConfig: {
        ...portableConfig,
      },
      appState: {
        gearBuilder: {
          nextInstanceId: deriveNextInstanceIdFromPortableConfig(portableConfig),
        },
        buffSelection: buildBuffSelectionStateFromPersistentConfig(
          portableConfig.persistentBuffConfig,
        ),
      },
    };
  }

  private clearLegacyKeys(): void {
    window.localStorage.removeItem(LEGACY_GEAR_BUILDER_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_BUFF_CONFIGURATION_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_PLAYER_STATS_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_ROTATION_PLANNER_STORAGE_KEY);
  }
}

function deriveNextInstanceIdFromPortableConfig(portableConfig: PortableConfigDocument): number {
  const allItems: ItemInstanceConfig[] = [
    ...Object.values(portableConfig.gearSetup.equipment ?? {}),
    ...(portableConfig.inventory.items ?? []),
  ].filter((instance): instance is ItemInstanceConfig => Boolean(instance));

  if (allItems.length === 0) {
    return DEFAULT_WORKSPACE_DOCUMENT.appState.gearBuilder.nextInstanceId;
  }

  const numericSuffixes = allItems
    .map((instance) => extractNumericSuffix(instance.instanceId))
    .filter((value): value is number => value !== null);

  if (numericSuffixes.length === 0) {
    return allItems.length + 1;
  }

  return Math.max(...numericSuffixes) + 1;
}

function extractNumericSuffix(instanceId: string): number | null {
  const match = /(\d+)$/.exec(instanceId);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}
