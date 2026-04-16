import type { EffectRef, EntityId } from '../../game-data/types';
import { EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type {
  DamageModifierContribution,
  DamageSummary,
  SimulationConfig,
} from '../models';
import { collectHighestEquippedPerkRank } from '../perks/equipped-perks';
import { projectSimulationConfigAtTick } from '../state/projected-gear-state';
import { collectActiveEffectRefs } from './active-effect-refs';
import {
  getCorruptedWoundsBleedBonus,
  getEnduringRuinNextAttackBonus,
} from '../melee/melee-combat-state';

export interface MultiplicativeDamageComputation {
  finalDamage: DamageSummary;
  multiplicativeModifiers: DamageModifierContribution[];
}

export function applyMultiplicativeDamageModifiers(
  config: SimulationConfig,
  ability: { id?: string; style?: string; subtype?: string; effectRefs?: EffectRef[] },
  hit: { id?: string },
  baseDamage: DamageSummary,
  castTick: number,
  hitTick: number,
  timelineBuffs: Record<number, EntityId[]>,
): MultiplicativeDamageComputation {
  const effectRefs = collectActiveEffectRefs(config, ability, hitTick, timelineBuffs);
  const projectedConfig = projectSimulationConfigAtTick(config, castTick);
  const isDamageOverTime = ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime) ?? false;
  const modifiers = effectRefs
    .map((effectRef) => parseMultiplicativeModifier(effectRef, effectRefs, ability, hit, config))
    .filter((entry): entry is DamageModifierContribution & { multiplier: number } => Boolean(entry));
  const enduringRuinBonus = getEnduringRuinNextAttackBonus(config, castTick);
  if (enduringRuinBonus > 0 && ability.style === 'melee' && !isDamageOverTime) {
    modifiers.push({
      sourceId: EFFECT_REF_IDS.glovesOfPassagePassive,
      label: `Enduring Ruin x${roundValue(1 + enduringRuinBonus).toFixed(2)}`,
      value: 0,
      multiplier: 1 + enduringRuinBonus,
    });
  }
  const corruptedWoundsBonus = getCorruptedWoundsBleedBonus(config, hitTick);
  if (corruptedWoundsBonus > 0 && isDamageOverTime) {
    modifiers.push({
      sourceId: 'corrupted-wounds',
      label: `Corrupted Wounds x${roundValue(1 + corruptedWoundsBonus).toFixed(2)}`,
      value: 0,
      multiplier: 1 + corruptedWoundsBonus,
    });
  }

  if (ability.id === 'combust' && (timelineBuffs[castTick] ?? []).includes('conflagrate')) {
    modifiers.push({
      sourceId: 'conflagrate',
      label: 'Conflagrate x1.40',
      value: 0,
      multiplier: 1.4,
    });
  }

  if (hasSongOfDestructionSetEquipped(projectedConfig) && isSongOfDestructionAbility(ability.id)) {
    modifiers.push({
      sourceId: 'song-of-destruction:set-2',
      label: 'Song of Destruction x1.30',
      value: 0,
      multiplier: 1.3,
    });
  }

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

function hasSongOfDestructionSetEquipped(config: SimulationConfig): boolean {
  return config.gearSetup.equipment.weapon?.definitionId === 'roar-of-awakening' &&
    config.gearSetup.equipment.offHand?.definitionId === 'ode-to-deceit';
}

function isSongOfDestructionAbility(abilityId: string | undefined): boolean {
  return abilityId === 'combust' || abilityId === 'corruption-blast' || abilityId === 'soulfire';
}

function parseMultiplicativeModifier(
  effectRef: EffectRef,
  activeEffectRefs: readonly EffectRef[],
  ability: { id?: string; style?: string; subtype?: string; effectRefs?: EffectRef[] },
  hit: { id?: string },
  config: SimulationConfig,
): (DamageModifierContribution & { multiplier: number }) | null {
  const isDamageOverTime = ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime) ?? false;

  if (effectRef === EFFECT_REF_IDS.equilibrium) {
    const equilibriumRank = collectHighestEquippedPerkRank(config, 'equilibrium');
    if (equilibriumRank <= 0) {
      return null;
    }

    const multiplier = 1.1 + equilibriumRank * 0.01;

    return {
      sourceId: effectRef,
      label: `Equilibrium x${roundValue(multiplier).toFixed(2)}`,
      value: 0,
      multiplier,
    };
  }

  if (effectRef === EFFECT_REF_IDS.ultimatums && ability.subtype === 'ultimate') {
    const ultimatumsRank = collectHighestEquippedPerkRank(config, 'ultimatums');
    if (ultimatumsRank <= 0) {
      return null;
    }

    const multiplier = 1.03 + ultimatumsRank * 0.01;

    return {
      sourceId: effectRef,
      label: `Ultimatums x${roundValue(multiplier).toFixed(2)}`,
      value: 0,
      multiplier,
    };
  }

  if (effectRef === EFFECT_REF_IDS.amHejPassive) {
    if (ability.style !== 'melee' || isDamageOverTime) {
      return null;
    }

    const strengthLevel = Math.max(0, Math.trunc(config.playerStats.strengthLevel ?? 0));
    const percent = Math.floor(strengthLevel * 0.05);
    if (percent <= 0) {
      return null;
    }

    const multiplier = 1 + percent / 100;

    return {
      sourceId: effectRef,
      label: `Am-hej x${roundValue(multiplier).toFixed(2)}`,
      value: 0,
      multiplier,
    };
  }

  if (
    (effectRef === EFFECT_REF_IDS.dragonSlayer && ability.style === 'ranged') ||
    (effectRef === EFFECT_REF_IDS.demonSlayer && ability.style === 'ranged') ||
    (effectRef === EFFECT_REF_IDS.undeadSlayer && ability.style === 'ranged')
  ) {
    const matchingConditionRef =
      effectRef === EFFECT_REF_IDS.dragonSlayer
        ? EFFECT_REF_IDS.dragonSlayerActive
        : effectRef === EFFECT_REF_IDS.demonSlayer
          ? EFFECT_REF_IDS.demonSlayerActive
          : EFFECT_REF_IDS.undeadSlayerActive;

    if (!activeEffectRefs.includes(matchingConditionRef)) {
      return null;
    }

    return {
      sourceId: effectRef,
      label: `${formatSlayerLabel(effectRef)} x1.07`,
      value: 0,
      multiplier: 1.07,
    };
  }

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
  const meleeMatch = /^melee-damage-multiplier:\+(\d+(?:\.\d+)?)%$/.exec(effectRef);
  const magicMatch = /^magic-damage-multiplier:\+(\d+(?:\.\d+)?)%$/.exec(effectRef);
  const targetDamageTakenMatch = /^target-damage-taken:\+(\d+(?:\.\d+)?)%$/.exec(effectRef);

  if (targetDamageTakenMatch) {
    const percent = Number.parseFloat(targetDamageTakenMatch[1]);
    const multiplier = 1 + percent / 100;

    return {
      sourceId: effectRef,
      label: `Target damage taken x${roundValue(multiplier).toFixed(2)}`,
      value: 0,
      multiplier,
    };
  }

  if (meleeMatch) {
    if (ability.style !== 'melee') {
      return null;
    }

    const percent = Number.parseFloat(meleeMatch[1]);
    const multiplier = 1 + percent / 100;

    return {
      sourceId: effectRef,
      label: `Melee damage x${roundValue(multiplier).toFixed(2)}`,
      value: 0,
      multiplier,
    };
  }

  if (magicMatch) {
    if (ability.style !== 'magic' || isDamageOverTime) {
      return null;
    }

    const percent = Number.parseFloat(magicMatch[1]);
    const multiplier = 1 + percent / 100;

    return {
      sourceId: effectRef,
      label: `Magic damage x${roundValue(multiplier).toFixed(2)}`,
      value: 0,
      multiplier,
    };
  }

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

function formatSlayerLabel(effectRef: EffectRef): string {
  switch (effectRef) {
    case EFFECT_REF_IDS.dragonSlayer:
      return 'Dragon Slayer';
    case EFFECT_REF_IDS.demonSlayer:
      return 'Demon Slayer';
    default:
      return 'Undead Slayer';
  }
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
