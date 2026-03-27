import { CONFIG_OPTION_IDS, EFFECT_REF_IDS } from '../../../game-data/conventions/mechanics';
import type { GameDataCatalog } from '../../../game-data/loaders';
import type { ItemDefinition } from '../../../game-data/types';
import type { ItemInstanceConfig } from '../../../simulation-engine/models';
import type { GearBuilderState } from './gear-state';

export function resolveEffectiveAmmoSelection(
  gearState: GearBuilderState,
  catalog: GameDataCatalog,
): ItemInstanceConfig | undefined {
  const equippedAmmo = gearState.equipment.ammo;

  if (!equippedAmmo) {
    return undefined;
  }

  const equippedDefinition = catalog.items[equippedAmmo.definitionId] ?? catalog.ammo[equippedAmmo.definitionId];
  if (!equippedDefinition) {
    return undefined;
  }

  if (!isQuiverDefinition(equippedDefinition)) {
    return equippedAmmo;
  }

  const loadedAmmoId = resolveStringConfigValue(
    equippedDefinition,
    equippedAmmo,
    CONFIG_OPTION_IDS.loadedAmmo,
  );
  if (!loadedAmmoId || loadedAmmoId === 'none') {
    return undefined;
  }

  const loadedAmmoDefinition = catalog.items[loadedAmmoId] ?? catalog.ammo[loadedAmmoId];
  if (!loadedAmmoDefinition) {
    return undefined;
  }

  return {
    instanceId: `${equippedAmmo.instanceId}:${CONFIG_OPTION_IDS.loadedAmmo}:${loadedAmmoId}`,
    definitionId: loadedAmmoId,
  };
}

function isQuiverDefinition(definition: ItemDefinition): boolean {
  return definition.effectRefs?.includes(EFFECT_REF_IDS.quiverPassive) ?? false;
}

function resolveStringConfigValue(
  item: ItemDefinition,
  instance: ItemInstanceConfig,
  optionId: string,
): string | null {
  const configuredValue = instance.configValues?.[optionId];

  if (typeof configuredValue === 'string') {
    return configuredValue;
  }

  const defaultValue = item.configOptions?.find((option) => option.id === optionId)?.defaultValue;
  return typeof defaultValue === 'string' ? defaultValue : null;
}
