import type { CombatStyle } from '../../game-data/types';
import type { SimulationConfig } from '../models';

export function calculatePersistentOffensiveStatBonus(
  config: SimulationConfig,
  style: Extract<CombatStyle, 'melee' | 'ranged' | 'magic' | 'necromancy'>,
): number {
  return [
    ...(config.persistentBuffConfig.prayerIds ?? []),
    ...(config.persistentBuffConfig.potionIds ?? []),
    ...(config.persistentBuffConfig.buffIds ?? []),
  ]
    .flatMap((buffId) => config.gameData.buffs[buffId]?.effectRefs ?? [])
    .reduce((total, effectRef) => total + parseOffensiveStatBonus(effectRef, style), 0);
}

function parseOffensiveStatBonus(effectRef: string, style: string): number {
  const match = /^offensive-stat-bonus:(melee|ranged|magic|necromancy):\+(\d+(?:\.\d+)?)$/.exec(effectRef);
  if (!match || match[1] !== style) {
    return 0;
  }

  return Number.parseFloat(match[2]);
}
