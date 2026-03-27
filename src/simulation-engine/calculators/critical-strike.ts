import { EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type { EffectRef, EntityId } from '../../game-data/types';
import type {
  DamageModifierContribution,
  DamageSummary,
  SimulationConfig,
} from '../models';
import { collectActiveEffectRefs } from './active-effect-refs';

const BASE_CRIT_CHANCE = 0.1;
const DOT_EFFECT_REF = EFFECT_REF_IDS.damageOverTime;
const BOW_TAG = 'two-handed-bow';

export interface CriticalStrikeComputation {
  finalDamage: DamageSummary;
  expectedValueModifiers: DamageModifierContribution[];
}

export function applyExpectedValueCriticalStrike(
  config: SimulationConfig,
  ability: { effectRefs?: EffectRef[] },
  baseDamage: DamageSummary,
  hitTick: number,
  timelineBuffs: Record<number, EntityId[]>,
): CriticalStrikeComputation {
  if (ability.effectRefs?.includes(DOT_EFFECT_REF)) {
    return {
      finalDamage: baseDamage,
      expectedValueModifiers: [],
    };
  }

  const effectRefs = collectActiveEffectRefs(config, ability, hitTick, timelineBuffs);
  const critChanceBonus = effectRefs.reduce(
    (total, effectRef) => total + parseCriticalStrikeChanceBonus(effectRef, config),
    0,
  );
  const critDamageBonus = effectRefs.reduce((total, effectRef) => total + parseCriticalStrikeDamageBonus(effectRef), 0);
  const baseCritDamageBonus = resolveBaseCriticalStrikeDamageBonus(config.playerStats.rangedLevel);
  const totalChance = clampProbability(BASE_CRIT_CHANCE + critChanceBonus);
  const totalDamageBonus = Math.max(0, baseCritDamageBonus + critDamageBonus);

  if (totalChance <= 0 || totalDamageBonus <= 0) {
    return {
      finalDamage: baseDamage,
      expectedValueModifiers: [],
    };
  }

  const critMultiplier = 1 + totalDamageBonus;
  const finalDamage = applyCriticalStrikeToDamageSummary(
    baseDamage,
    totalChance,
    critMultiplier,
  );
  const expectedValueModifiers = buildExpectedValueModifiers(
    baseDamage,
    BASE_CRIT_CHANCE,
    baseCritDamageBonus,
    critChanceBonus,
    critDamageBonus,
  );

  return {
    finalDamage,
    expectedValueModifiers,
  };
}

function applyCriticalStrikeToDamageSummary(
  baseDamage: DamageSummary,
  critChance: number,
  critMultiplier: number,
): DamageSummary {
  const canRollCrit = critChance > 0;
  const alwaysCrits = critChance >= 1;
  const averageCritMultiplier = 1 + critChance * (critMultiplier - 1);

  return {
    min: roundDamageValue(baseDamage.min * (alwaysCrits ? critMultiplier : 1)),
    avg: roundDamageValue(baseDamage.avg * averageCritMultiplier),
    max: roundDamageValue(baseDamage.max * (canRollCrit ? critMultiplier : 1)),
  };
}

function parseCriticalStrikeChanceBonus(effectRef: EffectRef, config: SimulationConfig): number {
  const match = /^(?:ranged-)?critical-strike-chance:\+(\d+(?:\.\d+)?)%(?::(bow-only))?$/.exec(effectRef);

  if (!match) {
    return 0;
  }

  if (match[2] === 'bow-only' && !isBowEquipped(config)) {
    return 0;
  }

  return Number.parseFloat(match[1]) / 100;
}

function parseCriticalStrikeDamageBonus(effectRef: EffectRef): number {
  const match = /^(?:ranged-)?critical-strike-damage:\+(\d+(?:\.\d+)?)%$/.exec(effectRef);
  return match ? Number.parseFloat(match[1]) / 100 : 0;
}

function resolveBaseCriticalStrikeDamageBonus(rangedLevel: number): number {
  if (rangedLevel >= 90) {
    return 0.5;
  }

  if (rangedLevel >= 80) {
    return 0.45;
  }

  if (rangedLevel >= 70) {
    return 0.4;
  }

  if (rangedLevel >= 60) {
    return 0.35;
  }

  if (rangedLevel >= 50) {
    return 0.3;
  }

  if (rangedLevel >= 40) {
    return 0.25;
  }

  if (rangedLevel >= 30) {
    return 0.2;
  }

  if (rangedLevel >= 20) {
    return 0.15;
  }

  return 0.1;
}

function buildExpectedValueModifiers(
  baseDamage: DamageSummary,
  baseCritChance: number,
  baseCritDamageBonus: number,
  critChanceBonus: number,
  critDamageBonus: number,
): DamageModifierContribution[] {
  const modifiers: DamageModifierContribution[] = [];
  const baseAvgDamage = baseDamage.avg;
  const baseCritExtra = baseAvgDamage * baseCritChance * baseCritDamageBonus;

  if (baseCritExtra > 0) {
    modifiers.push({
      sourceId: 'base-critical-strike',
      label: 'Base critical strike expected value',
      value: roundDamageValue(baseCritExtra),
    });
  }

  const chanceBonusExtra = baseAvgDamage * critChanceBonus * baseCritDamageBonus;
  if (chanceBonusExtra > 0) {
    modifiers.push({
      sourceId: 'critical-strike-chance-bonus',
      label: 'Critical strike chance bonus',
      value: roundDamageValue(chanceBonusExtra),
    });
  }

  const damageBonusExtra = baseAvgDamage * baseCritChance * critDamageBonus;
  if (damageBonusExtra > 0) {
    modifiers.push({
      sourceId: 'critical-strike-damage-bonus',
      label: 'Critical strike damage bonus',
      value: roundDamageValue(damageBonusExtra),
    });
  }

  const synergyExtra = baseAvgDamage * critChanceBonus * critDamageBonus;
  if (synergyExtra > 0) {
    modifiers.push({
      sourceId: 'critical-strike-synergy',
      label: 'Critical strike bonus synergy',
      value: roundDamageValue(synergyExtra),
    });
  }

  return modifiers;
}

function roundDamageValue(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampProbability(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function isBowEquipped(config: SimulationConfig): boolean {
  const equippedWeapon = config.gearSetup.equipment.weapon;

  if (!equippedWeapon) {
    return false;
  }

  const definition = config.gameData.items[equippedWeapon.definitionId];
  return definition?.requirements?.requiredEquipmentTags?.includes(BOW_TAG) ?? false;
}
