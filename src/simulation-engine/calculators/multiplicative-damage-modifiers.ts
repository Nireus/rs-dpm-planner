import type { EffectRef, EntityId } from '../../game-data/types';
import { EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
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
  ability: { id?: string; style?: string; effectRefs?: EffectRef[] },
  hit: { id?: string },
  baseDamage: DamageSummary,
  hitTick: number,
  timelineBuffs: Record<number, EntityId[]>,
): MultiplicativeDamageComputation {
  const effectRefs = collectActiveEffectRefs(config, ability, hitTick, timelineBuffs);
  const modifiers = effectRefs
    .map((effectRef) => parseMultiplicativeModifier(effectRef, ability, hit))
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
  ability: { id?: string; style?: string; effectRefs?: EffectRef[] },
  hit: { id?: string },
): (DamageModifierContribution & { multiplier: number }) | null {
  const isDamageOverTime = ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime) ?? false;

  if (effectRef === EFFECT_REF_IDS.fulArrowsHeat) {
    if (!shouldApplyFulArrowBonus(ability, hit)) {
      return null;
    }

    return {
      sourceId: effectRef,
      label: 'Ful arrows x1.15',
      value: 0,
      multiplier: 1.15,
    };
  }

  const match = /^ranged-damage-multiplier:\+(\d+(?:\.\d+)?)%$/.exec(effectRef);

  if (!match) {
    return null;
  }

  if (isDamageOverTime) {
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

function shouldApplyFulArrowBonus(
  ability: { id?: string; style?: string; effectRefs?: EffectRef[] },
  _hit: { id?: string },
): boolean {
  if (ability.style !== 'ranged') {
    return false;
  }

  if (ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime)) {
    return false;
  }

  return true;
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
