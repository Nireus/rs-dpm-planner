import { beforeEach, describe, expect, it } from 'vitest';

import type { BuffDefinition } from '../../../game-data/types';
import { createPortableConfigDocument } from '../../../simulation-engine/models/portable-config';
import type { ItemInstanceConfig } from '../../../simulation-engine/models';
import {
  LEGACY_BUFF_CONFIGURATION_STORAGE_KEY,
  LEGACY_GEAR_BUILDER_STORAGE_KEY,
  LEGACY_PLAYER_STATS_STORAGE_KEY,
  LEGACY_ROTATION_PLANNER_STORAGE_KEY,
  WORKSPACE_STORAGE_KEY,
} from './workspace.models';
import { WorkspaceRepositoryService } from './workspace-repository.service';

const RIGOUR: BuffDefinition = {
  id: 'rigour',
  name: 'Rigour',
  category: 'prayer',
  sourceType: 'player-config',
  isPermanent: true,
};

describe('WorkspaceRepositoryService', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads legacy per-slice state before a workspace document exists', () => {
    const weapon: ItemInstanceConfig = {
      instanceId: 'weapon-1',
      definitionId: 'bow-of-the-last-guardian',
    };

    window.localStorage.setItem(
      LEGACY_PLAYER_STATS_STORAGE_KEY,
      JSON.stringify({
        rangedLevel: 120,
      }),
    );
    window.localStorage.setItem(
      LEGACY_GEAR_BUILDER_STORAGE_KEY,
      JSON.stringify({
        state: {
          equipment: {
            weapon,
          },
          inventory: [],
        },
        nextInstanceId: 7,
      }),
    );
    window.localStorage.setItem(
      LEGACY_BUFF_CONFIGURATION_STORAGE_KEY,
      JSON.stringify({
        activeBuffIds: ['rigour'],
        activeRelicIds: ['fury-of-the-small'],
        activePocketItemIds: ['scripture-of-jas'],
      }),
    );
    window.localStorage.setItem(
      LEGACY_ROTATION_PLANNER_STORAGE_KEY,
      JSON.stringify({
        startingAdrenaline: 87,
        tickCount: 42,
        startingStacks: {
          deathsporeStacks: 9,
        },
        nonGcdActions: [],
        abilityActions: [],
      }),
    );

    const repository = new WorkspaceRepositoryService();

    expect(repository.readPlayerStats().rangedLevel).toBe(120);
    expect(repository.readGearBuilderState()).toEqual({
      gearState: {
        equipment: {
          weapon,
        },
        inventory: [],
      },
      nextInstanceId: 7,
    });
    expect(repository.readBuffSelectionState()).toEqual({
      activeBuffIds: ['rigour'],
      activeRelicIds: ['fury-of-the-small'],
      activePocketItemIds: ['scripture-of-jas'],
    });
    expect(repository.readRotationPlannerState()).toEqual({
      startingAdrenaline: 87,
      tickCount: 42,
      startingStacks: {
        deathsporeStacks: 9,
      },
      nonGcdActions: [],
      abilityActions: [],
    });
  });

  it('seeds the first workspace write from current legacy slices instead of defaults', () => {
    const weapon: ItemInstanceConfig = {
      instanceId: 'weapon-1',
      definitionId: 'bow-of-the-last-guardian',
    };

    window.localStorage.setItem(
      LEGACY_PLAYER_STATS_STORAGE_KEY,
      JSON.stringify({
        rangedLevel: 118,
      }),
    );
    window.localStorage.setItem(
      LEGACY_GEAR_BUILDER_STORAGE_KEY,
      JSON.stringify({
        state: {
          equipment: {
            weapon,
          },
          inventory: [],
        },
        nextInstanceId: 9,
      }),
    );
    window.localStorage.setItem(
      LEGACY_BUFF_CONFIGURATION_STORAGE_KEY,
      JSON.stringify({
        activeBuffIds: ['rigour'],
        activeRelicIds: [],
        activePocketItemIds: [],
      }),
    );
    window.localStorage.setItem(
      LEGACY_ROTATION_PLANNER_STORAGE_KEY,
      JSON.stringify({
        startingAdrenaline: 64,
        tickCount: 60,
        startingStacks: {
          perfectEquilibriumStacks: 5,
        },
        nonGcdActions: [],
        abilityActions: [],
      }),
    );

    const repository = new WorkspaceRepositoryService();
    repository.updatePlayerStats({
      rangedLevel: 119,
    });

    const storedWorkspace = JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? 'null');

    expect(storedWorkspace.portableConfig.playerStats.rangedLevel).toBe(119);
    expect(storedWorkspace.portableConfig.gearSetup.equipment.weapon).toEqual(weapon);
    expect(storedWorkspace.portableConfig.rotationPlan.tickCount).toBe(60);
    expect(storedWorkspace.portableConfig.rotationPlan.startingStacks).toEqual({
      perfectEquilibriumStacks: 5,
    });
    expect(storedWorkspace.appState.gearBuilder.nextInstanceId).toBe(9);
    expect(storedWorkspace.appState.buffSelection.activeBuffIds).toEqual(['rigour']);
    expect(window.localStorage.getItem(LEGACY_PLAYER_STATS_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_GEAR_BUILDER_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_BUFF_CONFIGURATION_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_ROTATION_PLANNER_STORAGE_KEY)).toBeNull();
  });

  it('writes canonical buff state into both portable and app slices', () => {
    const repository = new WorkspaceRepositoryService();

    repository.updateBuffSelectionState(
      {
        activeBuffIds: ['rigour'],
        activeRelicIds: ['fury-of-the-small'],
        activePocketItemIds: ['scripture-of-jas'],
      },
      {
        rigour: RIGOUR,
      },
    );

    const storedWorkspace = JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? 'null');

    expect(storedWorkspace.appState.buffSelection).toEqual({
      activeBuffIds: ['rigour'],
      activeRelicIds: ['fury-of-the-small'],
      activePocketItemIds: ['scripture-of-jas'],
    });
    expect(storedWorkspace.portableConfig.persistentBuffConfig).toEqual({
      prayerIds: ['rigour'],
      potionIds: [],
      relicIds: ['fury-of-the-small'],
      buffIds: [],
      pocketEffectItemIds: ['scripture-of-jas'],
    });
  });

  it('replaces the workspace document from a portable config and derives app state', () => {
    const repository = new WorkspaceRepositoryService();
    const importedWeapon: ItemInstanceConfig = {
      instanceId: 'gear-item-14',
      definitionId: 'bow-of-the-last-guardian',
    };
    const importedInventoryItem: ItemInstanceConfig = {
      instanceId: 'custom-item-27',
      definitionId: 'ful-arrows',
    };

    const workspaceDocument = repository.replacePortableConfigDocument(
      createPortableConfigDocument({
        playerStats: {
          rangedLevel: 120,
          prayerLevel: 95,
        },
        gearSetup: {
          equipment: {
            weapon: importedWeapon,
          },
        },
        inventory: {
          items: [importedInventoryItem],
        },
        persistentBuffConfig: {
          prayerIds: ['rigour'],
          relicIds: ['fury-of-the-small'],
          pocketEffectItemIds: ['scripture-of-jas'],
        },
        rotationPlan: {
          startingAdrenaline: 73,
          tickCount: 84,
          startingStacks: {
            deathsporeStacks: 7,
          },
          nonGcdActions: [],
          abilityActions: [],
        },
      }),
    );

    expect(workspaceDocument.portableConfig.playerStats.rangedLevel).toBe(120);
    expect(workspaceDocument.appState.gearBuilder.nextInstanceId).toBe(28);
    expect(workspaceDocument.appState.buffSelection).toEqual({
      activeBuffIds: ['rigour'],
      activeRelicIds: ['fury-of-the-small'],
      activePocketItemIds: ['scripture-of-jas'],
    });
    expect(repository.readPortableConfigDocument().rotationPlan.tickCount).toBe(84);
    expect(repository.readPortableConfigDocument().rotationPlan.startingStacks).toEqual({
      deathsporeStacks: 7,
    });
  });
});
