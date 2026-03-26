import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameDataStoreService } from '../../core/game-data/game-data-store.service';
import { ResultsSimulationService } from '../../core/results/results-simulation.service';
import {
  buildAbilityExplainabilitySummary,
  buildDamageModifierGroupSummaries,
  findSelectedHitBreakdown,
  getDefaultSelectedHitId,
} from './results-explainability.utils';

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
  protected readonly selectedHitId = signal<string | null>(null);
  protected readonly abilityCatalog = computed(() => this.gameDataStore.snapshot().catalog?.abilities ?? {});
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
    const abilities = this.abilityCatalog();

    if (!abilityId || !result) {
      return null;
    }

    return buildAbilityExplainabilitySummary(abilityId, result, abilities);
  });
  protected readonly selectedHitBreakdown = computed(() =>
    findSelectedHitBreakdown(this.selectedAbilitySummary(), this.selectedHitId()),
  );
  protected readonly selectedHitModifierGroups = computed(() =>
    buildDamageModifierGroupSummaries(this.selectedHitBreakdown()),
  );
  protected readonly selectedAbilityBreakdowns = computed(() =>
    this.selectedAbilitySummary()?.hitBreakdowns ?? [],
  );
  protected readonly selectedHitContribution = computed(() => {
    const breakdown = this.selectedHitBreakdown();
    return breakdown?.percentageOfTotal ?? null;
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
    const result = this.simulationResult();
    const summary = result
      ? buildAbilityExplainabilitySummary(abilityId, result, this.abilityCatalog())
      : null;
    this.selectedHitId.set(getDefaultSelectedHitId(summary));
  }

  protected selectHit(hitId: string): void {
    this.selectedHitId.set(hitId);
  }
}
