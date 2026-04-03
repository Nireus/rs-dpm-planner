import { CONFIG_OPTION_IDS, EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type { EquipmentSlot } from '../../game-data/types';
import { applyEquipmentPlacement } from '../gear/equipment-topology';
import type { RotationAction, SimulationConfig } from '../models';

const IMPLICIT_QUIVER_BOLT_AMMO_ID = 'bakriminel-bolts';

export function projectSimulationConfigAtTick(
  config: SimulationConfig,
  tick: number,
): SimulationConfig {
  const relevantSwaps = [...config.rotationPlan.nonGcdActions]
    .filter((entry) => (
      (entry.actionType === 'gear-swap' || entry.actionType === 'spell-swap') &&
      entry.tick < tick
    ))
    .sort((left, right) => left.tick - right.tick);

  if (!relevantSwaps.length) {
    return config;
  }

  let projectedEquipment = { ...config.gearSetup.equipment };
  let projectedInventory = [...config.inventory.items];
  let projectedCombatChoices = config.combatChoices ?? {
    magic: {
      spellbookId: 'standard',
      activeSpellId: 'air-strike',
    },
  };

  for (const swap of relevantSwaps) {
    if (swap.actionType === 'spell-swap') {
      const spellId = readStringPayload(swap, 'spellId');
      const spellDefinition = spellId ? config.gameData.spells?.[spellId] : undefined;
      const activeSpellbookId = projectedCombatChoices.magic.spellbookId;

      if (
        spellId &&
        spellDefinition &&
        spellDefinition.spellbookId === activeSpellbookId &&
        spellDefinition.role === 'combat'
      ) {
        projectedCombatChoices = {
          ...projectedCombatChoices,
          magic: {
            spellbookId: activeSpellbookId,
            activeSpellId: spellDefinition.id,
          },
        };
      }

      continue;
    }

    const instanceId = readStringPayload(swap, 'instanceId');
    const slot = readStringPayload(swap, 'slot');
    if (!instanceId || !slot) {
      continue;
    }

    const inventoryInstance = projectedInventory.find((item) => item.instanceId === instanceId);
    if (!inventoryInstance) {
      continue;
    }

    const applied = applyEquipmentPlacement(
      {
        equipment: projectedEquipment,
        inventory: projectedInventory,
      },
      inventoryInstance,
      slot as EquipmentSlot,
      config.gameData.items,
    );

    projectedEquipment = applied.equipment;
    projectedInventory = applied.inventory;
  }

  return {
    ...config,
    combatChoices: projectedCombatChoices,
    gearSetup: {
      ...config.gearSetup,
      equipment: projectedEquipment,
      ammoSelection: resolveProjectedAmmoSelection(config, projectedEquipment),
    },
    inventory: {
      ...config.inventory,
      items: projectedInventory,
    },
  };
}

function resolveProjectedAmmoSelection(
  config: SimulationConfig,
  projectedEquipment: SimulationConfig['gearSetup']['equipment'],
): SimulationConfig['gearSetup']['ammoSelection'] {
  const ammoSlot = projectedEquipment.ammo;
  if (!ammoSlot) {
    return undefined;
  }

  const ammoDefinition =
    config.gameData.items[ammoSlot.definitionId] ??
    config.gameData.ammo[ammoSlot.definitionId];

  if (!ammoDefinition) {
    return ammoSlot;
  }

  if (!ammoDefinition.effectRefs?.includes(EFFECT_REF_IDS.quiverPassive)) {
    if (config.gearSetup.ammoSelection?.instanceId === ammoSlot.instanceId) {
      return config.gearSetup.ammoSelection;
    }

    return ammoSlot;
  }

  const equippedWeapon = projectedEquipment.weapon;
  const weaponDefinition = equippedWeapon
    ? config.gameData.items[equippedWeapon.definitionId] ?? null
    : null;
  const usesCrossbowBolts = weaponDefinition?.effectRefs?.includes(EFFECT_REF_IDS.weaponClassCrossbow) ?? false;

  if (usesCrossbowBolts) {
    return buildImplicitQuiverAmmoInstance(ammoSlot, IMPLICIT_QUIVER_BOLT_AMMO_ID, 'loaded-bolts');
  }

  const loadedAmmoId = resolveStringConfigOptionValue(
    ammoDefinition.configOptions,
    ammoSlot.configValues,
    CONFIG_OPTION_IDS.loadedAmmo,
  );

  if (!loadedAmmoId || loadedAmmoId === 'none') {
    return undefined;
  }

  return buildImplicitQuiverAmmoInstance(ammoSlot, loadedAmmoId, CONFIG_OPTION_IDS.loadedAmmo);
}

function readStringPayload(action: RotationAction, key: string): string | null {
  const value = action.payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function resolveStringConfigOptionValue(
  configOptions: Array<{ id: string; defaultValue?: unknown }> | undefined,
  configValues: Record<string, unknown> | undefined,
  optionId: string,
): string | null {
  const configuredValue = configValues?.[optionId];
  if (typeof configuredValue === 'string' && configuredValue) {
    return configuredValue;
  }

  const defaultValue = configOptions?.find((option) => option.id === optionId)?.defaultValue;
  return typeof defaultValue === 'string' && defaultValue ? defaultValue : null;
}

function buildImplicitQuiverAmmoInstance(
  quiverInstance: NonNullable<SimulationConfig['gearSetup']['equipment']['ammo']>,
  definitionId: string,
  slotKey: string,
): NonNullable<SimulationConfig['gearSetup']['ammoSelection']> {
  return {
    instanceId: `${quiverInstance.instanceId}:${slotKey}:${definitionId}`,
    definitionId,
  };
}
