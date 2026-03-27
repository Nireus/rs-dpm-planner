import type { GameDataCatalog } from '../../../game-data/loaders';
import type { BuffDefinition, EntityId } from '../../../game-data/types';
import type { PersistentBuffConfig } from '../../../simulation-engine/models';

export interface BuffSelectionState {
  activeBuffIds: string[];
  activeRelicIds: string[];
  activePocketItemIds: string[];
}

export function buildPersistentBuffConfigFromBuffSelection(
  selection: BuffSelectionState,
  buffDefinitions: Record<string, BuffDefinition>,
): PersistentBuffConfig {
  const prayerIds: string[] = [];
  const potionIds: string[] = [];
  const buffIds: string[] = [];

  for (const buffId of selection.activeBuffIds) {
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
    relicIds: [...selection.activeRelicIds],
    buffIds,
    pocketEffectItemIds: [...selection.activePocketItemIds],
  };
}

export function buildBuffSelectionStateFromPersistentConfig(
  persistentBuffConfig: PersistentBuffConfig | undefined,
): BuffSelectionState {
  return {
    activeBuffIds: [
      ...(persistentBuffConfig?.prayerIds ?? []),
      ...(persistentBuffConfig?.potionIds ?? []),
      ...(persistentBuffConfig?.buffIds ?? []),
    ],
    activeRelicIds: [...(persistentBuffConfig?.relicIds ?? [])],
    activePocketItemIds: [...(persistentBuffConfig?.pocketEffectItemIds ?? [])],
  };
}

export function collectPersistentBuffIdsFromSelection(
  selection: BuffSelectionState,
  catalog: Pick<GameDataCatalog, 'buffs' | 'relics'>,
): EntityId[] {
  return [
    ...selection.activeBuffIds.filter((id) => Boolean(catalog.buffs[id])),
    ...selection.activeRelicIds.filter((id) => Boolean(catalog.relics[id])),
  ];
}
