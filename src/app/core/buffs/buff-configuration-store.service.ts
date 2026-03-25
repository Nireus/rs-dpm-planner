import { computed, effect, Injectable, signal } from '@angular/core';
import { toggleSelectionId } from '../../features/buffs/buffs-selection.utils';

const BUFF_CONFIGURATION_STORAGE_KEY = 'rs-dpm-planner.buff-configuration.v1';

interface BuffConfigurationState {
  activeBuffIds: string[];
  activeRelicIds: string[];
  activePocketItemIds: string[];
}

const DEFAULT_STATE: BuffConfigurationState = {
  activeBuffIds: [],
  activeRelicIds: [],
  activePocketItemIds: [],
};

@Injectable({
  providedIn: 'root',
})
export class BuffConfigurationStoreService {
  readonly state = signal<BuffConfigurationState>(this.loadInitialState());
  readonly activeBuffIds = computed(() => this.state().activeBuffIds);
  readonly activeRelicIds = computed(() => this.state().activeRelicIds);
  readonly activePocketItemIds = computed(() => this.state().activePocketItemIds);

  constructor() {
    effect(() => {
      this.persistState(this.state());
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

  togglePocketItem(itemId: string): void {
    this.state.update((current) => ({
      ...current,
      activePocketItemIds: toggleSelectionId(current.activePocketItemIds, itemId),
    }));
  }

  reset(): void {
    this.state.set(DEFAULT_STATE);
    this.clearPersistedState();
  }

  private loadInitialState(): BuffConfigurationState {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_STATE;
    }

    try {
      const raw = window.localStorage.getItem(BUFF_CONFIGURATION_STORAGE_KEY);

      if (!raw) {
        return DEFAULT_STATE;
      }

      const parsed = JSON.parse(raw) as Partial<BuffConfigurationState>;

      return {
        activeBuffIds: Array.isArray(parsed.activeBuffIds) ? parsed.activeBuffIds.filter(isString) : [],
        activeRelicIds: Array.isArray(parsed.activeRelicIds) ? parsed.activeRelicIds.filter(isString) : [],
        activePocketItemIds: Array.isArray(parsed.activePocketItemIds)
          ? parsed.activePocketItemIds.filter(isString)
          : [],
      };
    } catch {
      return DEFAULT_STATE;
    }
  }

  private persistState(state: BuffConfigurationState): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(BUFF_CONFIGURATION_STORAGE_KEY, JSON.stringify(state));
  }

  private clearPersistedState(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.removeItem(BUFF_CONFIGURATION_STORAGE_KEY);
  }
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
