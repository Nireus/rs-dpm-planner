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
  items: {
    'masterwork-2h-sword': {
      id: 'masterwork-2h-sword',
      name: 'Masterwork 2h Sword',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['melee'],
    },
    'vestments-of-havoc-hood': {
      id: 'vestments-of-havoc-hood',
      name: 'Vestments of Havoc Hood',
      category: 'armor',
      slot: 'head',
      combatStyleTags: ['melee'],
      effectRefs: ['vestments-of-havoc-set'],
    },
    'vestments-of-havoc-robe-top': {
      id: 'vestments-of-havoc-robe-top',
      name: 'Vestments of Havoc Robe Top',
      category: 'armor',
      slot: 'body',
      combatStyleTags: ['melee'],
      effectRefs: ['vestments-of-havoc-set'],
    },
    'vestments-of-havoc-robe-bottom': {
      id: 'vestments-of-havoc-robe-bottom',
      name: 'Vestments of Havoc Robe Bottom',
      category: 'armor',
      slot: 'legs',
      combatStyleTags: ['melee'],
      effectRefs: ['vestments-of-havoc-set'],
    },
    'vestments-of-havoc-boots': {
      id: 'vestments-of-havoc-boots',
      name: 'Vestments of Havoc Boots',
      category: 'armor',
      slot: 'feet',
      combatStyleTags: ['melee'],
      effectRefs: ['vestments-of-havoc-set'],
    },
  },
  ammo: {},
  spells: {},
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
  readonly gearState = signal({
    equipment: {},
    inventory: [],
  });

  snapshot() {
    return this.gearState();
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
  let gearBuilderStore: MockGearBuilderStore;

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
    gearBuilderStore = TestBed.inject(GearBuilderStore) as unknown as MockGearBuilderStore;
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

  it('clears planned actions without resetting planner configuration', () => {
    store.loadState({
      startingAdrenaline: 85,
      tickCount: 90,
      startingStacks: {
        deathsporeStacks: 7,
        perfectEquilibriumStacks: 2,
      },
      nonGcdActions: [
        {
          id: 'swap-1',
          tick: 3,
          lane: 'non-gcd',
          actionType: 'gear-swap',
          payload: {},
        },
      ],
      abilityActions: [
        {
          id: 'ability-1',
          tick: 6,
          lane: 'ability',
          actionType: 'ability-use',
          payload: {
            abilityId: 'ranged',
          },
        },
      ],
    });

    store.clearPlannedActions();

    expect(store.startingAdrenaline()).toBe(85);
    expect(store.tickCount()).toBe(90);
    expect(store.startingStacks()).toEqual({
      deathsporeStacks: 7,
      perfectEquilibriumStacks: 2,
    });
    expect(store.nonGcdActions()).toEqual([]);
    expect(store.abilityActions()).toEqual([]);
  });

  it('raises max starting adrenaline to 120 with full Vestments of Havoc and a melee weapon', () => {
    gearBuilderStore.gearState.set({
      equipment: {
        weapon: {
          instanceId: 'weapon-1',
          definitionId: 'masterwork-2h-sword',
        },
        head: {
          instanceId: 'head-1',
          definitionId: 'vestments-of-havoc-hood',
        },
        body: {
          instanceId: 'body-1',
          definitionId: 'vestments-of-havoc-robe-top',
        },
        legs: {
          instanceId: 'legs-1',
          definitionId: 'vestments-of-havoc-robe-bottom',
        },
        feet: {
          instanceId: 'feet-1',
          definitionId: 'vestments-of-havoc-boots',
        },
      },
      inventory: [],
    });

    expect(store.maxStartingAdrenaline()).toBe(120);
  });
});
