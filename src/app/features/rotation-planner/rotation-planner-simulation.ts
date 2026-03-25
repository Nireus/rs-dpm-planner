import type { GameDataCatalog } from '../../../game-data/loaders';
import type { PlayerStats, RotationPlan, SimulationConfig } from '../../../simulation-engine/models';
import type { GearBuilderState } from '../gear/gear-builder.utils';

export interface PlannerBuffStateSnapshot {
  activeBuffIds: string[];
  activeRelicIds: string[];
  activePocketItemIds: string[];
}

export function buildRotationPlannerSimulationConfig(input: {
  catalog: GameDataCatalog;
  playerStats: PlayerStats;
  gearState: GearBuilderState;
  buffState: PlannerBuffStateSnapshot;
  rotationPlan: RotationPlan;
}): SimulationConfig {
  const persistentBuffIds = collectPersistentBuffIds(input.buffState, input.catalog);
  const prayerIds = persistentBuffIds.filter((id) => input.catalog.buffs[id]?.category === 'prayer');
  const potionIds = persistentBuffIds.filter((id) => input.catalog.buffs[id]?.category === 'potion');
  const buffIds = persistentBuffIds.filter((id) => {
    const category = input.catalog.buffs[id]?.category;
    return category && category !== 'prayer' && category !== 'potion';
  });

  return {
    playerStats: input.playerStats,
    gearSetup: {
      equipment: input.gearState.equipment,
      ammoSelection: input.gearState.equipment['ammo'],
    },
    inventory: {
      items: input.gearState.inventory,
    },
    persistentBuffConfig: {
      prayerIds,
      potionIds,
      buffIds,
      relicIds: input.buffState.activeRelicIds.filter((id) => Boolean(input.catalog.relics[id])),
      pocketEffectItemIds: input.buffState.activePocketItemIds,
    },
    rotationPlan: input.rotationPlan,
    gameData: input.catalog,
    modeFlags: {
      strictValidation: true,
    },
  };
}

export function collectPersistentBuffIds(
  buffState: PlannerBuffStateSnapshot,
  catalog: GameDataCatalog,
): string[] {
  return [
    ...buffState.activeBuffIds.filter((id) => Boolean(catalog.buffs[id])),
    ...buffState.activeRelicIds.filter((id) => Boolean(catalog.relics[id])),
  ];
}
