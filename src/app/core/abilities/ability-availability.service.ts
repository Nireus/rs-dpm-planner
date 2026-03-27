import { computed, inject, Injectable } from '@angular/core';
import { GameDataStoreService } from '../game-data/game-data-store.service';
import { GearBuilderStore } from '../gear/gear-builder.store';
import { PlayerStatsStoreService } from '../player-stats/player-stats-store.service';
import { evaluateAbilityAvailability } from '../../../simulation-engine/rules/ability-availability';

@Injectable({
  providedIn: 'root',
})
export class AbilityAvailabilityService {
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly gearBuilderStore = inject(GearBuilderStore);
  private readonly playerStatsStore = inject(PlayerStatsStoreService);

  readonly availabilityMap = computed(() => {
    const catalog = this.gameDataStore.snapshot().catalog;

    if (!catalog) {
      return {};
    }

    const equippedItems = this.gearBuilderStore
      .equippedSlots()
      .flatMap((entry) => (entry.definition ? [entry.definition] : []));

    const inventoryItems = this.gearBuilderStore
      .inventoryEntries()
      .flatMap((entry) => (entry.definition ? [entry.definition] : []));

    const equippedInstances = this.gearBuilderStore
      .equippedSlots()
      .flatMap((entry) => (entry.instance ? [entry.instance] : []));

    return Object.fromEntries(
      Object.values(catalog.abilities).map((ability) => [
        ability.id,
        evaluateAbilityAvailability(ability, {
          playerStats: this.playerStatsStore.stats(),
          equippedItems,
          inventoryItems,
          equippedInstances,
        }),
      ]),
    );
  });
}
