import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { loadSampleGameData, sampleGameDataManifest, type GameDataCatalog, type GameDataLoadIssue } from '../../../game-data/loaders';

export interface GameDataStoreState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  catalog: GameDataCatalog | null;
  issues: GameDataLoadIssue[];
}

@Injectable({
  providedIn: 'root',
})
export class GameDataStoreService {
  private readonly http = inject(HttpClient);
  private readonly state = signal<GameDataStoreState>({
    status: 'idle',
    catalog: null,
    issues: [],
  });

  readonly snapshot = this.state.asReadonly();

  readonly summary = computed(() => {
    const current = this.state();
    const catalog = current.catalog;

    return {
      status: current.status,
      issues: current.issues,
      counts: catalog
        ? {
            items: Object.keys(catalog.items).length,
            abilities: Object.keys(catalog.abilities).length,
            buffs: Object.keys(catalog.buffs).length,
            perks: Object.keys(catalog.perks).length,
            relics: Object.keys(catalog.relics).length,
          }
        : null,
    };
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.state.set({
      status: 'loading',
      catalog: null,
      issues: [],
    });

    const result = await loadSampleGameData(sampleGameDataManifest, async (path) =>
      firstValueFrom(this.http.get(path, { responseType: 'text' })),
    );

    if (result.success) {
      this.state.set({
        status: 'ready',
        catalog: result.data,
        issues: result.issues,
      });
      return;
    }

    this.state.set({
      status: 'error',
      catalog: null,
      issues: result.issues,
    });
  }
}
