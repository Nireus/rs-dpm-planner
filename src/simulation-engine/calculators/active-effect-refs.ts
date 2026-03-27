import type { EffectRef, EntityId } from '../../game-data/types';
import type { SimulationConfig } from '../models';
import { projectSimulationConfigAtTick } from '../state/projected-gear-state';

export function collectActiveEffectRefs(
  config: SimulationConfig,
  ability: { effectRefs?: EffectRef[] },
  hitTick: number,
  timelineBuffs: Record<number, EntityId[]>,
): EffectRef[] {
  const projectedConfig = projectSimulationConfigAtTick(config, hitTick);
  const persistentBuffIds = [
    ...(projectedConfig.persistentBuffConfig.prayerIds ?? []),
    ...(projectedConfig.persistentBuffConfig.potionIds ?? []),
    ...(projectedConfig.persistentBuffConfig.relicIds ?? []),
    ...(projectedConfig.persistentBuffConfig.buffIds ?? []),
    ...(projectedConfig.persistentBuffConfig.pocketEffectItemIds ?? []),
  ];

  const activeBuffEffectRefs = [
    ...persistentBuffIds.flatMap((buffId) => projectedConfig.gameData.buffs[buffId]?.effectRefs ?? []),
    ...(timelineBuffs[hitTick] ?? []).flatMap((buffId) => projectedConfig.gameData.buffs[buffId]?.effectRefs ?? []),
  ];

  const equippedItemEffectRefs = Object.entries(projectedConfig.gearSetup.equipment).flatMap(([slot, instance]) => {
    if (!instance || slot === 'ammo') {
      return [];
    }

    return projectedConfig.gameData.items[instance.definitionId]?.effectRefs ?? [];
  });

  const ammoInstance = projectedConfig.gearSetup.ammoSelection ?? projectedConfig.gearSetup.equipment.ammo;
  const ammoEffectRefs = ammoInstance
    ? (projectedConfig.gameData.items[ammoInstance.definitionId]?.effectRefs ??
      projectedConfig.gameData.ammo[ammoInstance.definitionId]?.effectRefs ??
      [])
    : [];

  return [
    ...(ability.effectRefs ?? []),
    ...activeBuffEffectRefs,
    ...equippedItemEffectRefs,
    ...ammoEffectRefs,
  ];
}
