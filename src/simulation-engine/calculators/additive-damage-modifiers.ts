import type { EffectRef, EntityId } from '../../game-data/types';
import { EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type {
  DamageModifierContribution,
  DamageSummary,
  RotationAction,
  SimulationConfig,
} from '../models';
import { collectHighestEquippedPerkRank } from '../perks/equipped-perks';
import { projectSimulationConfigAtTick } from '../state/projected-gear-state';

export interface AdditiveDamageComputation {
  finalDamage: DamageSummary;
  additiveModifiers: DamageModifierContribution[];
}

export function applyAdditiveDamageModifiers(
  config: SimulationConfig,
  action: RotationAction,
  ability: { id?: string; style?: string; effectRefs?: EffectRef[] },
  baseDamage: DamageSummary,
  abilityDamage: number,
  hitTick: number,
  timelineBuffs: Record<number, EntityId[]>,
): AdditiveDamageComputation {
  const isRangedHit = ability.style === 'ranged' && !ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime);
  const isMagicHit = ability.style === 'magic';
  if (!isRangedHit && !isMagicHit) {
    return {
      finalDamage: baseDamage,
      additiveModifiers: [],
    };
  }

  const effectRefs = collectCastScopedEffectRefs(config, action.tick, ability, timelineBuffs);
  const modifiers = effectRefs
    .map((effectRef) => parseAdditiveModifier(effectRef, abilityDamage))
    .filter((entry): entry is DamageModifierContribution & { bonusDamage: number } => Boolean(entry));
  const caromingModifier = parseCaromingModifier(config, ability.id, abilityDamage);
  const flankingModifier = parseFlankingModifier(config, ability.id, timelineBuffs[action.tick], abilityDamage);
  const songOfDestructionModifier = parseSongOfDestructionModifier(config, ability, hitTick, timelineBuffs);

  if (caromingModifier) {
    modifiers.push(caromingModifier);
  }

  if (flankingModifier) {
    modifiers.push(flankingModifier);
  }

  if (songOfDestructionModifier) {
    modifiers.push(songOfDestructionModifier);
  }

  if (!modifiers.length) {
    return {
      finalDamage: baseDamage,
      additiveModifiers: [],
    };
  }

  const totalBonusDamage = modifiers.reduce((sum, entry) => sum + entry.bonusDamage, 0);

  return {
    finalDamage: {
      min: roundDamageValue(baseDamage.min + totalBonusDamage),
      avg: roundDamageValue(baseDamage.avg + totalBonusDamage),
      max: roundDamageValue(baseDamage.max + totalBonusDamage),
    },
    additiveModifiers: modifiers.map(({ bonusDamage, ...entry }) => ({
      ...entry,
      value: bonusDamage,
    })),
  };
}

function parseSongOfDestructionModifier(
  config: SimulationConfig,
  ability: { style?: string },
  hitTick: number,
  timelineBuffs: Record<number, EntityId[]>,
): (DamageModifierContribution & { bonusDamage: number }) | null {
  if (ability.style !== 'magic') {
    return null;
  }

  const projectedConfig = projectSimulationConfigAtTick(config, hitTick);
  if (
    projectedConfig.gearSetup.equipment.weapon?.definitionId !== 'roar-of-awakening' ||
    projectedConfig.gearSetup.equipment.offHand?.definitionId !== 'ode-to-deceit'
  ) {
    return null;
  }

  const essenceCorruptionStacks = (timelineBuffs[hitTick] ?? []).filter((buffId) => buffId === 'essence-corruption').length;
  if (essenceCorruptionStacks < 10) {
    return null;
  }

  const bonusDamage = roundDamageValue(essenceCorruptionStacks * 3 + (projectedConfig.playerStats.magicLevel ?? 0));
  return {
    sourceId: 'song-of-destruction:set-1',
    label: `Song of Destruction +${bonusDamage} damage`,
    value: 0,
    bonusDamage,
  };
}

function collectCastScopedEffectRefs(
  config: SimulationConfig,
  castTick: number,
  ability: { effectRefs?: EffectRef[] },
  timelineBuffs: Record<number, EntityId[]>,
): EffectRef[] {
  const projectedConfig = projectSimulationConfigAtTick(config, castTick);
  const persistentBuffIds = [
    ...(projectedConfig.persistentBuffConfig.prayerIds ?? []),
    ...(projectedConfig.persistentBuffConfig.potionIds ?? []),
    ...(projectedConfig.persistentBuffConfig.relicIds ?? []),
    ...(projectedConfig.persistentBuffConfig.buffIds ?? []),
    ...(projectedConfig.persistentBuffConfig.summonIds ?? []),
    ...(projectedConfig.persistentBuffConfig.pocketEffectItemIds ?? []),
  ];

  const persistentBuffEffectRefs = persistentBuffIds.flatMap(
    (buffId) => projectedConfig.gameData.buffs[buffId]?.effectRefs ?? [],
  );
  const generatedBySameAbility = new Set(ability.effectRefs ?? []);
  const activeTimelineBuffEffectRefs = (timelineBuffs[castTick] ?? [])
    .filter((buffId) => !generatedBySameAbility.has(buffId))
    .flatMap((buffId) => projectedConfig.gameData.buffs[buffId]?.effectRefs ?? []);
  const equippedItemEffectRefs = Object.entries(projectedConfig.gearSetup.equipment).flatMap(([slot, instance]) => {
    if (!instance || slot === 'ammo') {
      return [];
    }

    return projectedConfig.gameData.items[instance.definitionId]?.effectRefs ?? [];
  });
  const ammoInstance = projectedConfig.gearSetup.ammoSelection ?? projectedConfig.gearSetup.equipment.ammo;
  const ammoEffectRefs = ammoInstance
    ? (projectedConfig.gameData.items[ammoInstance.definitionId]?.effectRefs ??
      projectedConfig.gameData.ammo[ammoInstance.definitionId]?.effectRefs ??
      [])
    : [];

  return [...new Set([
    ...(ability.effectRefs ?? []),
    ...persistentBuffEffectRefs,
    ...activeTimelineBuffEffectRefs,
    ...equippedItemEffectRefs,
    ...ammoEffectRefs,
  ])];
}

function parseAdditiveModifier(
  effectRef: EffectRef,
  abilityDamage: number,
): (DamageModifierContribution & { bonusDamage: number }) | null {
  const match = /^ranged-hit-flat-bonus-ability-damage:\+(\d+(?:\.\d+)?)%:cast-snapshot$/.exec(effectRef);
  if (!match) {
    return null;
  }

  const percent = Number.parseFloat(match[1]);
  const bonusDamage = roundDamageValue((abilityDamage * percent) / 100);

  return {
    sourceId: effectRef,
    label: `Ranged hit bonus +${roundDamageValue(percent)}% ability damage`,
    value: 0,
    bonusDamage,
  };
}

function parseCaromingModifier(
  config: SimulationConfig,
  abilityId: string | undefined,
  abilityDamage: number,
): (DamageModifierContribution & { bonusDamage: number }) | null {
  if (abilityId !== 'ricochet' && abilityId !== 'greater-ricochet') {
    return null;
  }

  const caromingRank = collectHighestEquippedPerkRank(config, 'caroming');
  if (caromingRank <= 0) {
    return null;
  }

  const percent = caromingRank * 4;
  const bonusDamage = roundDamageValue((abilityDamage * percent) / 100);

  return {
    sourceId: `perk:caroming:${caromingRank}`,
    label: `Caroming ${caromingRank} +${percent}% ability damage`,
    value: 0,
    bonusDamage,
  };
}

function parseFlankingModifier(
  config: SimulationConfig,
  abilityId: string | undefined,
  activeBuffIds: EntityId[] | undefined,
  abilityDamage: number,
): (DamageModifierContribution & { bonusDamage: number }) | null {
  if (abilityId !== 'binding-shot' || !(activeBuffIds ?? []).includes('flanking-active')) {
    return null;
  }

  const flankingRank = collectHighestEquippedPerkRank(config, 'flanking');
  if (flankingRank <= 0) {
    return null;
  }

  const percent = flankingRank * 40;
  const bonusDamage = roundDamageValue((abilityDamage * percent) / 100);

  return {
    sourceId: `perk:flanking:${flankingRank}`,
    label: `Flanking ${flankingRank} +${percent}% ability damage`,
    value: 0,
    bonusDamage,
  };
}

function roundDamageValue(value: number): number {
  return Math.round(value * 100) / 100;
}
