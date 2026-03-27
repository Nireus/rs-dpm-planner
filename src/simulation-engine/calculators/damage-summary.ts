import type { DamageRange } from '../../game-data/types';
import type { DamageSummary } from '../models';

export function scaleDamageRangeFromAbilityDamage(
  range: DamageRange,
  abilityDamage: number,
): DamageSummary {
  const min = Math.floor((abilityDamage * range.min) / 100);
  const max = Math.floor((abilityDamage * range.max) / 100);

  return {
    min,
    avg: (min + max) / 2,
    max,
  };
}

export function createDirectDamageSummary(range: DamageRange): DamageSummary {
  const min = roundDamageValue(range.min);
  const max = roundDamageValue(range.max);

  return {
    min,
    avg: roundDamageValue((min + max) / 2),
    max,
  };
}

export function createZeroDamageSummary(): DamageSummary {
  return {
    min: 0,
    avg: 0,
    max: 0,
  };
}

export function addDamageSummary(target: DamageSummary, value: DamageSummary): void {
  target.min = roundDamageValue(target.min + value.min);
  target.avg = roundDamageValue(target.avg + value.avg);
  target.max = roundDamageValue(target.max + value.max);
}

export function roundDamageValue(value: number): number {
  return Math.round(value * 100) / 100;
}

export function createEmptyDamageByTick(tickCount: number): Record<number, DamageSummary> {
  return Object.fromEntries(
    Array.from({ length: tickCount }, (_, tick) => [tick, createZeroDamageSummary()]),
  );
}
