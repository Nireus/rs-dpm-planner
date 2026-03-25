import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameDataStoreService } from '../../core/game-data/game-data-store.service';
import { ResultsSimulationService } from '../../core/results/results-simulation.service';

@Component({
  selector: 'app-results-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './results-page.component.html',
  styleUrl: './results-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsPageComponent {
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly resultsSimulationService = inject(ResultsSimulationService);

  protected readonly gameDataSummary = this.gameDataStore.summary;
  protected readonly simulationResult = this.resultsSimulationService.simulationResult;
  protected readonly simulationConfig = this.resultsSimulationService.simulationConfig;
  protected readonly selectedAbilityId = signal<string | null>(null);
  protected readonly selectedBreakdownAbilityId = signal<string | null>(null);
  protected readonly resultMetrics = computed(() => {
    const config = this.simulationConfig();
    const result = this.simulationResult();

    if (!config || !result) {
      return null;
    }

    const seconds = config.rotationPlan.tickCount * 0.6;

    return {
      durationSeconds: seconds,
      avgDpt: config.rotationPlan.tickCount > 0 ? result.totalDamage.avg / config.rotationPlan.tickCount : 0,
      avgDpm: seconds > 0 ? (result.totalDamage.avg / seconds) * 60 : 0,
    };
  });
  protected readonly selectedAbilitySummary = computed(() => {
    const abilityId = this.selectedAbilityId();
    const result = this.simulationResult();

    if (!abilityId || !result) {
      return null;
    }

    return result.damageByAbility.find((entry) => entry.abilityId === abilityId) ?? null;
  });
  protected readonly selectedAbilityBreakdowns = computed(() => {
    const abilityId = this.selectedBreakdownAbilityId() ?? this.selectedAbilityId();
    const result = this.simulationResult();

    if (!abilityId || !result) {
      return [];
    }

    return result.explainability.damageBreakdowns.filter((entry) => entry.abilityId === abilityId);
  });
  protected readonly topDamageTicks = computed(() => {
    const result = this.simulationResult();
    if (!result) {
      return [];
    }

    return Object.entries(result.damageByTick)
      .map(([tick, summary]) => ({
        tick: Number.parseInt(tick, 10),
        ...summary,
      }))
      .filter((entry) => entry.avg > 0)
      .sort((left, right) => right.avg - left.avg)
      .slice(0, 8);
  });

  protected selectAbility(abilityId: string): void {
    this.selectedAbilityId.set(abilityId);
    this.selectedBreakdownAbilityId.set(abilityId);
  }
}
