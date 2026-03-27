import type { EffectRef, EntityId } from '../../game-data/types';
import { EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type {
  DamageModifierContribution,
  DamageSummary,
  RotationAction,
  SimulationConfig,
} from '../models';
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
  timelineBuffs: Record<number, EntityId[]>,
): AdditiveDamageComputation {
  if (ability.style !== 'ranged' || ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime)) {
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

  if (caromingModifier) {
    modifiers.push(caromingModifier);
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

  return [
    ...(ability.effectRefs ?? []),
    ...persistentBuffEffectRefs,
    ...activeTimelineBuffEffectRefs,
    ...equippedItemEffectRefs,
    ...ammoEffectRefs,
  ];
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

function collectHighestEquippedPerkRank(
  config: SimulationConfig,
  perkId: string,
): number {
  let highestRank = 0;

  for (const instance of Object.values(config.gearSetup.equipment)) {
    if (!instance?.configuredPerks?.length) {
      continue;
    }

    for (const perk of instance.configuredPerks) {
      if (perk.perkId !== perkId) {
        continue;
      }

      highestRank = Math.max(highestRank, perk.rank ?? 1);
    }
  }

  return highestRank;
}

function roundDamageValue(value: number): number {
  return Math.round(value * 100) / 100;
}
