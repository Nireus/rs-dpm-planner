import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { BuffSelectionState } from './persistent-buff-config';
import { GameDataStoreService } from '../game-data/game-data-store.service';
import { WorkspaceRepositoryService } from '../workspace/workspace-repository.service';

const DEFAULT_STATE: BuffSelectionState = {
  activeBuffIds: [],
  activeRelicIds: [],
  activeSummonIds: [],
  activePocketItemIds: [],
};

@Injectable({
  providedIn: 'root',
})
export class BuffConfigurationStoreService {
  private readonly workspaceRepository = inject(WorkspaceRepositoryService);
  private readonly gameDataStore = inject(GameDataStoreService);
  readonly state = signal<BuffSelectionState>(this.workspaceRepository.readBuffSelectionState());
  readonly activeBuffIds = computed(() => this.state().activeBuffIds);
  readonly activeRelicIds = computed(() => this.state().activeRelicIds);
  readonly activeSummonIds = computed(() => this.state().activeSummonIds);
  readonly activePocketItemIds = computed(() => this.state().activePocketItemIds);

  constructor() {
    effect(() => {
      const buffDefinitions = this.gameDataStore.snapshot().catalog?.buffs;
      if (!buffDefinitions) {
        return;
      }

      this.workspaceRepository.updateBuffSelectionState(this.state(), buffDefinitions);
    });
  }

  toggleBuff(buffId: string): void {
    this.state.update((current) => ({
      ...current,
      activeBuffIds: toggleSelectionId(current.activeBuffIds, buffId),
    }));
  }

  toggleRelic(relicId: string): void {
    this.state.update((current) => ({
      ...current,
      activeRelicIds: toggleSelectionId(current.activeRelicIds, relicId),
    }));
  }

  activateSummon(summonId: string): void {
    this.state.update((current) => ({
      ...current,
      activeSummonIds: (current.activeSummonIds ?? []).includes(summonId) ? [] : [summonId],
    }));
  }

  togglePocketItem(itemId: string): void {
    this.state.update((current) => ({
      ...current,
      activePocketItemIds: toggleSelectionId(current.activePocketItemIds, itemId),
    }));
  }

  reset(): void {
    this.state.set(DEFAULT_STATE);
    const buffDefinitions = this.gameDataStore.snapshot().catalog?.buffs;
    if (buffDefinitions) {
      this.workspaceRepository.updateBuffSelectionState(DEFAULT_STATE, buffDefinitions);
    }
  }

  replaceSelections(state: BuffSelectionState): void {
    this.loadState(state);
  }

  loadState(state: BuffSelectionState): void {
    this.state.set({
      activeBuffIds: [...state.activeBuffIds],
      activeRelicIds: [...state.activeRelicIds],
      activeSummonIds: [...(state.activeSummonIds ?? [])],
      activePocketItemIds: [...state.activePocketItemIds],
    });
  }
}

function toggleSelectionId(currentIds: readonly string[], id: string): string[] {
  return currentIds.includes(id) ? currentIds.filter((entry) => entry !== id) : [...currentIds, id];
}
