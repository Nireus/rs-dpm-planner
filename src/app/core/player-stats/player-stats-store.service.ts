import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { PlayerStats } from '../../../simulation-engine/models';
import {
  DEFAULT_PLAYER_LEVELS,
  sanitizePlayerStats,
  validatePlayerStats,
  type PlayerStatsValidationIssue,
} from '../../../simulation-engine/validation/player-stats';
import { WorkspaceRepositoryService } from '../workspace/workspace-repository.service';

export const DEFAULT_PLAYER_STATS: PlayerStats = {
  ...DEFAULT_PLAYER_LEVELS,
};

@Injectable({
  providedIn: 'root',
})
export class PlayerStatsStoreService {
  private readonly workspaceRepository = inject(WorkspaceRepositoryService);
  readonly stats = signal<PlayerStats>(sanitizePlayerStats(this.workspaceRepository.readPlayerStats()));
  readonly issues = computed<PlayerStatsValidationIssue[]>(() => validatePlayerStats(this.stats()));

  constructor() {
    effect(() => {
      const stats = this.stats();
      this.workspaceRepository.updatePlayerStats(stats);
    });
  }

  updateStat<K extends keyof PlayerStats>(key: K, value: number | undefined): void {
    this.stats.update((current) =>
      sanitizePlayerStats({
        ...current,
        [key]: value,
      }),
    );
  }

  reset(): void {
    this.stats.set(DEFAULT_PLAYER_STATS);
    this.workspaceRepository.updatePlayerStats(DEFAULT_PLAYER_STATS);
  }

  loadStats(stats: PlayerStats): void {
    this.stats.set(sanitizePlayerStats(stats));
  }
}
