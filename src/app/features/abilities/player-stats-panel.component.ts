import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlayerStatsStoreService } from '../../core/player-stats/player-stats-store.service';

@Component({
  selector: 'app-player-stats-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './player-stats-panel.component.html',
  styleUrl: './player-stats-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerStatsPanelComponent {
  protected readonly playerStatsStore = inject(PlayerStatsStoreService);
  protected readonly stats = this.playerStatsStore.stats;
  protected readonly issues = this.playerStatsStore.issues;

  protected updateRangedLevel(value: string | number | null): void {
    this.playerStatsStore.updateStat('rangedLevel', this.parseLevel(value));
  }

  protected updateAttackLevel(value: string | number | null): void {
    this.playerStatsStore.updateStat('attackLevel', this.parseLevel(value));
  }

  protected updateStrengthLevel(value: string | number | null): void {
    this.playerStatsStore.updateStat('strengthLevel', this.parseLevel(value));
  }

  protected updateDefenceLevel(value: string | number | null): void {
    this.playerStatsStore.updateStat('defenceLevel', this.parseLevel(value));
  }

  protected updateMagicLevel(value: string | number | null): void {
    this.playerStatsStore.updateStat('magicLevel', this.parseLevel(value));
  }

  protected updateNecromancyLevel(value: string | number | null): void {
    this.playerStatsStore.updateStat('necromancyLevel', this.parseLevel(value));
  }

  protected updatePrayerLevel(value: string | number | null): void {
    this.playerStatsStore.updateStat('prayerLevel', this.parseLevel(value));
  }

  private parseLevel(value: string | number | null): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
