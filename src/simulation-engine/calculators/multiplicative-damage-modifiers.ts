import type { EffectRef, EntityId } from '../../game-data/types';
import type {
  DamageModifierContribution,
  DamageSummary,
  SimulationConfig,
} from '../models';
import { collectActiveEffectRefs } from './active-effect-refs';

export interface MultiplicativeDamageComputation {
  finalDamage: DamageSummary;
  multiplicativeModifiers: DamageModifierContribution[];
}

export function applyMultiplicativeDamageModifiers(
  config: SimulationConfig,
  ability: { effectRefs?: EffectRef[] },
  baseDamage: DamageSummary,
  hitTick: number,
  timelineBuffs: Record<number, EntityId[]>,
): MultiplicativeDamageComputation {
  const effectRefs = collectActiveEffectRefs(config, ability, hitTick, timelineBuffs);
  const modifiers = effectRefs
    .map((effectRef) => parseMultiplicativeModifier(effectRef))
    .filter((entry): entry is DamageModifierContribution & { multiplier: number } => Boolean(entry));

  if (!modifiers.length) {
    return {
      finalDamage: baseDamage,
      multiplicativeModifiers: [],
    };
  }

  const multiplier = modifiers.reduce((product, entry) => product * entry.multiplier, 1);

  return {
    finalDamage: scaleDamageSummary(baseDamage, multiplier),
    multiplicativeModifiers: modifiers.map(({ multiplier: entryMultiplier, value: _, ...entry }) => ({
      ...entry,
      value: roundValue(baseDamage.avg * (entryMultiplier - 1)),
    })),
  };
}

function parseMultiplicativeModifier(
  effectRef: EffectRef,
): (DamageModifierContribution & { multiplier: number }) | null {
  const match = /^ranged-damage-multiplier:\+(\d+(?:\.\d+)?)%$/.exec(effectRef);

  if (!match) {
    return null;
  }

  const percent = Number.parseFloat(match[1]);
  const multiplier = 1 + percent / 100;

  return {
    sourceId: effectRef,
    label: `Ranged damage x${roundValue(multiplier).toFixed(2)}`,
    value: 0,
    multiplier,
  };
}

function scaleDamageSummary(baseDamage: DamageSummary, multiplier: number): DamageSummary {
  return {
    min: roundValue(baseDamage.min * multiplier),
    avg: roundValue(baseDamage.avg * multiplier),
    max: roundValue(baseDamage.max * multiplier),
  };
}

function roundValue(value: number): number {
  return Math.round(value * 100) / 100;
}
