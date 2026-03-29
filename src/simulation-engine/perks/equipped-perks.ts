import type { EffectRef } from '../../game-data/types';
import type { ItemInstanceConfig, SimulationConfig } from '../models';

export function collectHighestEquippedPerkRank(
  config: Pick<SimulationConfig, 'gearSetup'>,
  perkId: string,
): number {
  let highestRank = 0;

  for (const instance of Object.values(config.gearSetup.equipment)) {
    highestRank = Math.max(highestRank, readInstancePerkRank(instance, perkId));
  }

  return highestRank;
}

export function hasEquippedPerk(
  config: Pick<SimulationConfig, 'gearSetup'>,
  perkId: string,
): boolean {
  return collectHighestEquippedPerkRank(config, perkId) > 0;
}

export function collectEquippedPerkEffectRefs(
  config: Pick<SimulationConfig, 'gearSetup' | 'gameData'>,
): EffectRef[] {
  return Object.values(config.gearSetup.equipment).flatMap((instance) => {
    if (!instance?.configuredPerks?.length) {
      return [];
    }

    return instance.configuredPerks.flatMap((perk) =>
      config.gameData.perks[perk.perkId]?.effectRefs ?? [],
    );
  });
}

function readInstancePerkRank(
  instance: ItemInstanceConfig | undefined,
  perkId: string,
): number {
  if (!instance?.configuredPerks?.length) {
    return 0;
  }

  return instance.configuredPerks.reduce((highestRank, perk) => {
    if (perk.perkId !== perkId) {
      return highestRank;
    }

    return Math.max(highestRank, perk.rank ?? 1);
  }, 0);
}
