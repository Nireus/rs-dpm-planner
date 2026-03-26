import { computed, inject, Injectable } from '@angular/core';
import { simulateBaseDamage } from '../../../simulation-engine/calculators';
import type { PersistentBuffConfig, SimulationConfig } from '../../../simulation-engine/models';
import type { BuffDefinition } from '../../../game-data/types';
import { BuffConfigurationStoreService } from '../buffs/buff-configuration-store.service';
import { GameDataStoreService } from '../game-data/game-data-store.service';
import { resolveEffectiveAmmoSelection } from '../gear/effective-ammo-selection';
import { PlayerStatsStoreService } from '../player-stats/player-stats-store.service';
import { GearBuilderStore } from '../../features/gear/gear-builder.store';
import { RotationPlannerStore } from '../../features/rotation-planner/rotation-planner.store';

@Injectable({
  providedIn: 'root',
})
export class ResultsSimulationService {
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly playerStatsStore = inject(PlayerStatsStoreService);
  private readonly gearBuilderStore = inject(GearBuilderStore);
  private readonly buffConfigurationStore = inject(BuffConfigurationStoreService);
  private readonly rotationPlannerStore = inject(RotationPlannerStore);

  readonly simulationConfig = computed<SimulationConfig | null>(() => {
    const catalog = this.gameDataStore.snapshot().catalog;
    if (!catalog) {
      return null;
    }

    const gearState = this.gearBuilderStore.snapshot();

    return {
      playerStats: this.playerStatsStore.stats(),
      gearSetup: {
        equipment: gearState.equipment,
        ammoSelection: resolveEffectiveAmmoSelection(gearState, catalog),
      },
      inventory: {
        items: gearState.inventory,
      },
      persistentBuffConfig: buildPersistentBuffConfig(
        this.buffConfigurationStore.state().activeBuffIds,
        this.buffConfigurationStore.state().activeRelicIds,
        catalog.buffs,
      ),
      rotationPlan: this.rotationPlannerStore.rotationPlan(),
      gameData: catalog,
      modeFlags: {
        strictValidation: true,
      },
    };
  });

  readonly simulationResult = computed(() => {
    const config = this.simulationConfig();
    return config ? simulateBaseDamage(config) : null;
  });
}

function buildPersistentBuffConfig(
  activeBuffIds: readonly string[],
  activeRelicIds: readonly string[],
  buffDefinitions: Record<string, BuffDefinition>,
): PersistentBuffConfig {
  const prayerIds: string[] = [];
  const potionIds: string[] = [];
  const buffIds: string[] = [];

  for (const buffId of activeBuffIds) {
    const definition = buffDefinitions[buffId];
    if (!definition) {
      continue;
    }

    if (definition.category === 'prayer') {
      prayerIds.push(buffId);
      continue;
    }

    if (definition.category === 'potion') {
      potionIds.push(buffId);
      continue;
    }

    buffIds.push(buffId);
  }

  return {
    prayerIds,
    potionIds,
    relicIds: [...activeRelicIds],
    buffIds,
  };
}
