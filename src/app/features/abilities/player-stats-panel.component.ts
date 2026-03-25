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

  protected updateRangedLevel(value: string): void {
    this.playerStatsStore.updateStat('rangedLevel', this.parseLevel(value));
  }

  protected updatePrayerLevel(value: string): void {
    this.playerStatsStore.updateStat('prayerLevel', this.parseLevel(value));
  }

  private parseLevel(value: string): number | undefined {
    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
