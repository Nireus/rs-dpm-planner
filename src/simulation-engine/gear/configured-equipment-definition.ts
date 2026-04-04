import { CONFIG_OPTION_IDS } from '../../game-data/conventions/mechanics';
import type { EquipmentSlot, ItemDefinition } from '../../game-data/types';
import type { ItemInstanceConfig, SimulationConfig } from '../models';

const GENESIS_UNLOCK_GROUPS: readonly (readonly string[])[] = [
  ['bolg'],
  ['ek-zekkil'],
  ['dark-shard-of-leng', 'dark-sliver-of-leng'],
  ['fractured-staff-of-armadyl'],
  ['roar-of-awakening', 'ode-to-deceit'],
  ['tumekens-light'],
];

const GENESIS_TIER_DELTA = 5;
const GENESIS_MAX_TIER = 100;

export function findGenesisUnlockGroup(definitionId: string): readonly string[] | null {
  return GENESIS_UNLOCK_GROUPS.find((group) => group.includes(definitionId)) ?? null;
}

export function resolveConfiguredEquipmentDefinition(
  config: SimulationConfig,
  slot: EquipmentSlot,
): ItemDefinition | null {
  const instance = config.gearSetup.equipment[slot];
  if (!instance) {
    return null;
  }

  return resolveConfiguredItemDefinition(config, instance);
}

export function resolveConfiguredItemDefinition(
  config: SimulationConfig,
  instance: Pick<ItemInstanceConfig, 'definitionId' | 'configValues'>,
): ItemDefinition | null {
  const definition = config.gameData.items[instance.definitionId] ?? config.gameData.ammo[instance.definitionId] ?? null;
  if (!definition) {
    return null;
  }

  if (!hasGenesisUnlockForDefinition(config, definition.id)) {
    return definition;
  }

  return applyGenesisUpgrade(definition);
}

function hasGenesisUnlockForDefinition(config: SimulationConfig, definitionId: string): boolean {
  const unlockGroup = findGenesisUnlockGroup(definitionId);
  if (!unlockGroup) {
    return false;
  }

  return collectKnownItemInstances(config)
    .filter((instance) => unlockGroup.includes(instance.definitionId))
    .some((instance) => instance.configValues?.[CONFIG_OPTION_IDS.genesisEnchanted] === true);
}

function collectKnownItemInstances(config: SimulationConfig): ItemInstanceConfig[] {
  return [
    ...Object.values(config.gearSetup.equipment).filter((instance): instance is ItemInstanceConfig => Boolean(instance)),
    ...config.inventory.items,
  ];
}

function applyGenesisUpgrade(definition: ItemDefinition): ItemDefinition {
  return {
    ...definition,
    offensiveStats: {
      ...(definition.offensiveStats ?? {}),
      damageTier: increaseTier(definition.offensiveStats?.['damageTier'] ?? definition.tier ?? 0),
      accuracyTier: increaseTier(definition.offensiveStats?.['accuracyTier'] ?? definition.tier ?? 0),
    },
  };
}

function increaseTier(tier: number): number {
  return Math.min(GENESIS_MAX_TIER, Math.max(0, Math.trunc(tier)) + GENESIS_TIER_DELTA);
}
