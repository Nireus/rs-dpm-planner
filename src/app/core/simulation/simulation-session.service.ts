import { computed, inject, Injectable } from '@angular/core';
import { simulateBaseDamage } from '../../../simulation-engine/calculators';
import { BuffConfigurationStoreService } from '../buffs/buff-configuration-store.service';
import { GameDataStoreService } from '../game-data/game-data-store.service';
import { GearBuilderStore } from '../gear/gear-builder.store';
import { PlayerStatsStoreService } from '../player-stats/player-stats-store.service';
import { RotationPlannerStore } from '../rotation-planner/rotation-planner.store';
import { buildSimulationConfigFromAppState } from './simulation-config.builder';

@Injectable({
  providedIn: 'root',
})
export class SimulationSessionService {
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly playerStatsStore = inject(PlayerStatsStoreService);
  private readonly gearBuilderStore = inject(GearBuilderStore);
  private readonly buffConfigurationStore = inject(BuffConfigurationStoreService);
  private readonly rotationPlannerStore = inject(RotationPlannerStore);

  readonly simulationConfig = computed(() => {
    const catalog = this.gameDataStore.snapshot().catalog;
    if (!catalog) {
      return null;
    }

    return buildSimulationConfigFromAppState({
      catalog,
      playerStats: this.playerStatsStore.stats(),
      gearState: this.gearBuilderStore.snapshot(),
      buffState: this.buffConfigurationStore.state(),
      rotationPlan: this.rotationPlannerStore.rotationPlan(),
    });
  });

  readonly simulationResult = computed(() => {
    const config = this.simulationConfig();
    return config ? simulateBaseDamage(config) : null;
  });
}
