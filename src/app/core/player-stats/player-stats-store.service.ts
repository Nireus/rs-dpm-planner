import { computed, effect, Injectable, signal } from '@angular/core';
import type { PlayerStats } from '../../../simulation-engine/models';
import {
  sanitizePlayerStats,
  validatePlayerStats,
  type PlayerStatsValidationIssue,
} from '../../../simulation-engine/validation/player-stats';

const PLAYER_STATS_STORAGE_KEY = 'rs-dpm-planner.player-stats.v1';

export const DEFAULT_PLAYER_STATS: PlayerStats = {
  rangedLevel: 99,
  prayerLevel: 99,
};

@Injectable({
  providedIn: 'root',
})
export class PlayerStatsStoreService {
  readonly stats = signal<PlayerStats>(this.loadInitialStats());
  readonly issues = computed<PlayerStatsValidationIssue[]>(() => validatePlayerStats(this.stats()));

  constructor() {
    effect(() => {
      const stats = this.stats();
      this.persistStats(stats);
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

  private loadInitialStats(): PlayerStats {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_PLAYER_STATS;
    }

    try {
      const raw = window.localStorage.getItem(PLAYER_STATS_STORAGE_KEY);

      if (!raw) {
        return DEFAULT_PLAYER_STATS;
      }

      return sanitizePlayerStats({
        ...DEFAULT_PLAYER_STATS,
        ...(JSON.parse(raw) as Partial<PlayerStats>),
      });
    } catch {
      return DEFAULT_PLAYER_STATS;
    }
  }

  private persistStats(stats: PlayerStats): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(PLAYER_STATS_STORAGE_KEY, JSON.stringify(stats));
  }
}
