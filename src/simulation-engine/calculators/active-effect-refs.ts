import type { EffectRef, EntityId } from '../../game-data/types';
import type { SimulationConfig } from '../models';

export function collectActiveEffectRefs(
  config: SimulationConfig,
  ability: { effectRefs?: EffectRef[] },
  hitTick: number,
  timelineBuffs: Record<number, EntityId[]>,
): EffectRef[] {
  const persistentBuffIds = [
    ...(config.persistentBuffConfig.prayerIds ?? []),
    ...(config.persistentBuffConfig.potionIds ?? []),
    ...(config.persistentBuffConfig.relicIds ?? []),
    ...(config.persistentBuffConfig.buffIds ?? []),
    ...(config.persistentBuffConfig.pocketEffectItemIds ?? []),
  ];

  const activeBuffEffectRefs = [
    ...persistentBuffIds.flatMap((buffId) => config.gameData.buffs[buffId]?.effectRefs ?? []),
    ...(timelineBuffs[hitTick] ?? []).flatMap((buffId) => config.gameData.buffs[buffId]?.effectRefs ?? []),
  ];

  const equippedItemEffectRefs = Object.entries(config.gearSetup.equipment).flatMap(([slot, instance]) => {
    if (!instance || slot === 'ammo') {
      return [];
    }

    return config.gameData.items[instance.definitionId]?.effectRefs ?? [];
  });

  const ammoInstance = config.gearSetup.ammoSelection ?? config.gearSetup.equipment.ammo;
  const ammoEffectRefs = ammoInstance
    ? (config.gameData.items[ammoInstance.definitionId]?.effectRefs ?? config.gameData.ammo[ammoInstance.definitionId]?.effectRefs ?? [])
    : [];

  return [
    ...(ability.effectRefs ?? []),
    ...activeBuffEffectRefs,
    ...equippedItemEffectRefs,
    ...ammoEffectRefs,
  ];
}
