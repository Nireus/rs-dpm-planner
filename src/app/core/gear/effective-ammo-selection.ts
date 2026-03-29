import { CONFIG_OPTION_IDS, EFFECT_REF_IDS } from '../../../game-data/conventions/mechanics';
import type { GameDataCatalog } from '../../../game-data/loaders';
import type { ItemDefinition } from '../../../game-data/types';
import type { ItemInstanceConfig } from '../../../simulation-engine/models';
import type { GearBuilderState } from './gear-state';

const IMPLICIT_QUIVER_BOLT_AMMO_ID = 'bakriminel-bolts';

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

  if (isCrossbowWeaponDefinition(resolveEquippedWeaponDefinition(gearState, catalog))) {
    return buildImplicitQuiverAmmoInstance(equippedAmmo, IMPLICIT_QUIVER_BOLT_AMMO_ID, 'loaded-bolts');
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

  return buildImplicitQuiverAmmoInstance(equippedAmmo, loadedAmmoId, CONFIG_OPTION_IDS.loadedAmmo);
}

function isQuiverDefinition(definition: ItemDefinition): boolean {
  return definition.effectRefs?.includes(EFFECT_REF_IDS.quiverPassive) ?? false;
}

function resolveEquippedWeaponDefinition(
  gearState: GearBuilderState,
  catalog: GameDataCatalog,
): ItemDefinition | null {
  const equippedWeapon = gearState.equipment.weapon;
  if (!equippedWeapon) {
    return null;
  }

  return catalog.items[equippedWeapon.definitionId] ?? null;
}

function isCrossbowWeaponDefinition(definition: ItemDefinition | null): boolean {
  return definition?.effectRefs?.includes(EFFECT_REF_IDS.weaponClassCrossbow) ?? false;
}

function buildImplicitQuiverAmmoInstance(
  equippedAmmo: ItemInstanceConfig,
  definitionId: string,
  slotKey: string,
): ItemInstanceConfig {
  return {
    instanceId: `${equippedAmmo.instanceId}:${slotKey}:${definitionId}`,
    definitionId,
  };
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
