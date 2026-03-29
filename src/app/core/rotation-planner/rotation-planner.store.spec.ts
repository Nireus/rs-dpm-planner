import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';

import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition } from '../../../game-data/types';
import type { RotationPlannerWorkspaceState } from '../workspace/workspace.models';
import { BuffConfigurationStoreService } from '../buffs/buff-configuration-store.service';
import { GameDataStoreService } from '../game-data/game-data-store.service';
import { GearBuilderStore } from '../gear/gear-builder.store';
import { PlayerStatsStoreService } from '../player-stats/player-stats-store.service';
import { WorkspaceRepositoryService } from '../workspace/workspace-repository.service';
import { RotationPlannerStore } from './rotation-planner.store';

const RANGED_ABILITY: AbilityDefinition = {
  id: 'ranged',
  name: 'Ranged',
  style: 'ranged',
  subtype: 'basic',
  cooldownTicks: 3,
  adrenalineGain: 8,
  hitSchedule: [
    {
      id: 'hit-1',
      tickOffset: 0,
      damage: {
        min: 20,
        max: 40,
      },
    },
  ],
  baseDamage: {
    min: 20,
    max: 40,
  },
};

const CATALOG: GameDataCatalog = {
  items: {},
  ammo: {},
  abilities: {
    [RANGED_ABILITY.id]: RANGED_ABILITY,
  },
  buffs: {},
  perks: {},
  relics: {},
  eofSpecs: {},
};

class MockGameDataStoreService {
  snapshot() {
    return {
      catalog: CATALOG,
      issues: [],
      isLoading: false,
    };
  }
}

class MockGearBuilderStore {
  snapshot() {
    return {
      equipment: {},
      inventory: [],
    };
  }
}

class MockBuffConfigurationStoreService {
  readonly activeBuffIds = signal<string[]>([]);
  readonly activeRelicIds = signal<string[]>([]);
  readonly activePocketItemIds = signal<string[]>([]);

  state() {
    return {
      activeBuffIds: this.activeBuffIds(),
      activeRelicIds: this.activeRelicIds(),
      activePocketItemIds: this.activePocketItemIds(),
    };
  }
}

class MockPlayerStatsStoreService {
  readonly stats = signal({
    rangedLevel: 99,
    prayerLevel: 99,
  });
}

class MockWorkspaceRepositoryService {
  private state: RotationPlannerWorkspaceState = {
    startingAdrenaline: 100,
    tickCount: 99,
    startingStacks: {},
    nonGcdActions: [],
    abilityActions: [],
  };

  readRotationPlannerState(): RotationPlannerWorkspaceState {
    return this.state;
  }

  updateRotationPlannerState(state: RotationPlannerWorkspaceState): void {
    this.state = state;
  }
}

describe('RotationPlannerStore', () => {
  let store: RotationPlannerStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RotationPlannerStore,
        { provide: GameDataStoreService, useClass: MockGameDataStoreService },
        { provide: GearBuilderStore, useClass: MockGearBuilderStore },
        { provide: BuffConfigurationStoreService, useClass: MockBuffConfigurationStoreService },
        { provide: PlayerStatsStoreService, useClass: MockPlayerStatsStoreService },
        { provide: WorkspaceRepositoryService, useClass: MockWorkspaceRepositoryService },
      ],
    });

    store = TestBed.inject(RotationPlannerStore);
  });

  it('uses GCD counts and supports a 600-tick visible window', () => {
    store.updateGcdCount(200);

    expect(store.gcdCount()).toBe(200);
    expect(store.tickCount()).toBe(600);
  });

  it('preserves hidden future actions when the visible GCD window is lowered', () => {
    store.loadState({
      startingAdrenaline: 100,
      tickCount: 99,
      startingStacks: {
        deathsporeStacks: 8,
        perfectEquilibriumStacks: 6,
      },
      nonGcdActions: [
        {
          id: 'swap-1',
          tick: 45,
          lane: 'non-gcd',
          actionType: 'gear-swap',
          payload: {},
        },
      ],
      abilityActions: [
        {
          id: 'ability-1',
          tick: 48,
          lane: 'ability',
          actionType: 'ability-use',
          payload: {
            abilityId: 'ranged',
          },
        },
      ],
    });

    store.updateGcdCount(10);

    expect(store.tickCount()).toBe(30);
    expect(store.startingStacks()).toEqual({
      deathsporeStacks: 8,
      perfectEquilibriumStacks: 6,
    });
    expect(store.nonGcdActions()).toHaveLength(1);
    expect(store.abilityActions()).toHaveLength(1);
    expect(store.rotationPlan().nonGcdActions).toEqual([]);
    expect(store.rotationPlan().abilityActions).toEqual([]);
  });

  it('clamps configured starting stacks into supported ranges', () => {
    store.loadState({
      startingAdrenaline: 100,
      tickCount: 99,
      startingStacks: {
        deathsporeStacks: 99,
        perfectEquilibriumStacks: -4,
      },
      nonGcdActions: [],
      abilityActions: [],
    });

    expect(store.startingStacks()).toEqual({
      deathsporeStacks: 11,
      perfectEquilibriumStacks: 0,
    });
  });
});
