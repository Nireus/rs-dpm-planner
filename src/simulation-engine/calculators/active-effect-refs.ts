import type { EffectRef, EntityId } from '../../game-data/types';
import type { SimulationConfig } from '../models';
import { collectEquippedPerkEffectRefs } from '../perks/equipped-perks';
import { resolveConfiguredItemEffectRefs } from '../gear/configured-equipment-definition';
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
  const activePocketEffectRefs =
    (projectedConfig.persistentBuffConfig.pocketEffectItemIds ?? [])
      .flatMap((itemId) => projectedConfig.gameData.items[itemId]?.effectRefs ?? []);

  const equippedItemEffectRefs = Object.entries(projectedConfig.gearSetup.equipment).flatMap(([slot, instance]) => {
    if (!instance || slot === 'ammo') {
      return [];
    }

    return resolveConfiguredItemEffectRefs(projectedConfig, instance);
  });

  const ammoInstance = projectedConfig.gearSetup.ammoSelection ?? projectedConfig.gearSetup.equipment.ammo;
  const ammoEffectRefs = ammoInstance
    ? (resolveConfiguredItemEffectRefs(projectedConfig, ammoInstance) ??
      projectedConfig.gameData.ammo[ammoInstance.definitionId]?.effectRefs ??
      [])
    : [];
  const equippedPerkEffectRefs = collectEquippedPerkEffectRefs(projectedConfig);

  return [...new Set([
    ...(ability.effectRefs ?? []),
    ...activeBuffEffectRefs,
    ...activePocketEffectRefs,
    ...equippedItemEffectRefs,
    ...ammoEffectRefs,
    ...equippedPerkEffectRefs,
  ])];
}
