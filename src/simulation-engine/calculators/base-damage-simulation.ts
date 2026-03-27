import { EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type { EntityId, EquipmentSlot } from '../../game-data/types';
import type {
  AbilityDamageSummary,
  DamageBreakdown,
  DamageSummary,
  SimulationConfig,
  SimulationResult,
  ValidationIssue,
} from '../models';
import { resolveAdrenalineTimeline, resolveChannelTimeline, resolveCooldownTimeline } from '../resolvers';
import { resolveDeathsporeTimeline } from '../resolvers/deathspore';
import { resolveDeterministicRangedTimeline } from '../resolvers/ranged-deterministic';
import { applyAdditiveDamageModifiers } from './additive-damage-modifiers';
import { applyExpectedValueCriticalStrike } from './critical-strike';
import {
  addDamageSummary,
  createDirectDamageSummary,
  createEmptyDamageByTick,
  createZeroDamageSummary,
  scaleDamageRangeFromAbilityDamage,
} from './damage-summary';
import { applyMultiplicativeDamageModifiers } from './multiplicative-damage-modifiers';
import {
  buildSimulationHitEvents,
  createPerfectEquilibriumHitEvent,
  PERFECT_EQUILIBRIUM_ABILITY_ID,
  type SimulationHitEvent,
} from './simulation-hit-events';
import { buildTickStates, mergeBuffTimelines } from './tick-state-builder';
import { buildBaseTimeline } from '../timeline';
import { validateStrictRotationPlan } from '../validation/strict-rotation-plan';
import { projectSimulationConfigAtTick } from '../state/projected-gear-state';

const BALANCE_BY_FORCE_BUFF_ID = 'balance-by-force-buff';

export function simulateBaseDamage(config: SimulationConfig): SimulationResult {
  const timelineResult = buildBaseTimeline({ rotationPlan: config.rotationPlan });
  const strictIssues = validateStrictRotationPlan(config);
  const cooldownResult = resolveCooldownTimeline(config);
  const baseValidationIssues = [
    ...timelineResult.validationIssues,
    ...strictIssues,
    ...cooldownResult.validationIssues,
  ];
  const blockingActionIds = new Set(
    baseValidationIssues
      .filter((issue) => issue.severity === 'error' && typeof issue.relatedActionId === 'string')
      .map((issue) => issue.relatedActionId as string),
  );
  const deterministicRangedTimeline = resolveDeterministicRangedTimeline(config, blockingActionIds);
  const deathsporeTimeline = resolveDeathsporeTimeline(
    config,
    blockingActionIds,
    deterministicRangedTimeline.buffTimeline,
  );
  const mergedBuffTimeline = mergeBuffTimelines(
    config.rotationPlan.tickCount,
    deterministicRangedTimeline.buffTimeline,
    deathsporeTimeline.buffTimeline,
  );
  const adrenalineResult = resolveAdrenalineTimeline(config, blockingActionIds);
  const validationIssues = [
    ...baseValidationIssues,
    ...adrenalineResult.validationIssues,
  ];
  const channelResult = resolveChannelTimeline(config, blockingActionIds);
  const damageBreakdowns: DamageBreakdown[] = [];
  const damageByTick = createEmptyDamageByTick(config.rotationPlan.tickCount);
  const damageByAbilityMap = new Map<EntityId, DamageSummary>();
  const hitEvents = buildSimulationHitEvents(config, blockingActionIds);
  const hasBolgEquipped = isBolgEquipped(config);
  let perfectEquilibriumStacks = 0;

  for (let index = 0; index < hitEvents.length; index += 1) {
    const event = hitEvents[index];
    const projectedConfig = projectSimulationConfigAtTick(config, event.action.tick);
    const actionAbilityDamage = calculateRangedAbilityDamage(projectedConfig);
    const breakdown = createDamageBreakdown(
      config,
      event.action,
      event.ability,
      event.hit,
      event.tick,
      mergedBuffTimeline,
      event.derivedDamageParts,
    );
    damageBreakdowns.push(breakdown);
    addDamageSummary(damageByTick[event.tick], breakdown.finalDamage);

    const abilitySummary = damageByAbilityMap.get(event.ability.id) ?? createZeroDamageSummary();
    addDamageSummary(abilitySummary, breakdown.finalDamage);
    damageByAbilityMap.set(event.ability.id, abilitySummary);

    if (!hasBolgEquipped || !event.contributesToPerfectEquilibrium) {
      continue;
    }

    perfectEquilibriumStacks += 1;
    const perfectEquilibriumThreshold =
      mergedBuffTimeline[event.tick]?.includes(BALANCE_BY_FORCE_BUFF_ID) ? 4 : 8;

    if (perfectEquilibriumStacks < perfectEquilibriumThreshold) {
      continue;
    }

    perfectEquilibriumStacks = 0;
    const multiplicativeAbilityDamageMultiplier = calculateBreakdownMultiplierProduct(breakdown);
    hitEvents.splice(
      index + 1,
      0,
      createPerfectEquilibriumHitEvent(
        event,
        breakdown.finalDamage,
        actionAbilityDamage,
        multiplicativeAbilityDamageMultiplier,
      ),
    );
  }

  const totalDamage = damageBreakdowns.reduce<DamageSummary>((summary, breakdown) => {
    addDamageSummary(summary, breakdown.finalDamage);
    return summary;
  }, createZeroDamageSummary());

  const damageByAbility = [...damageByAbilityMap.entries()]
    .map<AbilityDamageSummary>(([abilityId, summary]) => ({
      abilityId,
      min: summary.min,
      avg: summary.avg,
      max: summary.max,
    }))
    .sort((left, right) => right.avg - left.avg);

  for (const breakdown of damageBreakdowns) {
    breakdown.percentageOfTotal = totalDamage.avg > 0 ? breakdown.finalDamage.avg / totalDamage.avg : 0;
  }

  return {
    isValid: !validationIssues.some((issue) => issue.severity === 'error'),
    validationIssues,
    totalDamage,
    damageByAbility,
    damageByTick,
    adrenalineTimeline: adrenalineResult.adrenalineTimeline,
    buffTimeline: mergedBuffTimeline,
    timelineGeneratedBuffSources: [
      ...deterministicRangedTimeline.timelineGeneratedBuffSources,
      ...deathsporeTimeline.timelineGeneratedBuffSources,
    ],
    cooldownTimeline: cooldownResult.cooldownTimeline,
    tickStates: buildTickStates(
      config,
      timelineResult.timeline.ticks.map((bucket) => bucket.tickIndex),
      validationIssues,
      adrenalineResult,
      channelResult,
      cooldownResult,
      mergedBuffTimeline,
      deathsporeTimeline.stackTimeline,
      damageBreakdowns,
    ),
    explainability: {
      damageBreakdowns,
      notes: [
        'Base hit scheduling is active. Critical strike expected value is applied, while other additive and multiplicative modifier families remain unimplemented.',
        ...(hasBolgEquipped ? ['Perfect Equilibrium: every 8 qualifying hits fire a derived passive hit on the triggering tick.'] : []),
        ...deterministicRangedTimeline.notes,
        ...deathsporeTimeline.notes,
      ],
    },
  };
}

function createDamageBreakdown(
  config: SimulationConfig,
  action: SimulationHitEvent['action'],
  ability: { id: EntityId; style?: string; effectRefs?: string[] },
  hit: SimulationHitEvent['hit'],
  hitTick: number,
  buffTimeline: Record<number, EntityId[]>,
  derivedDamageParts?: SimulationHitEvent['derivedDamageParts'],
): DamageBreakdown {
  const projectedConfig = projectSimulationConfigAtTick(config, action.tick);
  const abilityDamage = calculateRangedAbilityDamage(projectedConfig);
  const baseDamage = derivedDamageParts?.scaledAbilityDamage ?? (hit.tags?.includes('direct-damage')
    ? createDirectDamageSummary(hit.damage)
    : scaleDamageRangeFromAbilityDamage(hit.damage, abilityDamage));
  const multiplicativeResult = applyMultiplicativeDamageModifiers(
    projectedConfig,
    ability,
    hit,
    baseDamage,
    hitTick,
    buffTimeline,
  );
  const additiveResult = applyAdditiveDamageModifiers(
    projectedConfig,
    action,
    ability,
    multiplicativeResult.finalDamage,
    abilityDamage,
    buffTimeline,
  );
  const postInheritedTriggerDamage = derivedDamageParts
    ? {
        additiveModifiers: [
          ...additiveResult.additiveModifiers,
          {
            sourceId: 'perfect-equilibrium-trigger',
            label: 'Inherited triggering hit contribution',
            value: derivedDamageParts.inheritedTriggerDamage.avg,
          },
        ],
      }
    : {
        additiveModifiers: additiveResult.additiveModifiers,
      };
  const criticalStrikeResult = applyExpectedValueCriticalStrike(
    projectedConfig,
    ability,
    additiveResult.finalDamage,
    hitTick,
    buffTimeline,
  );
  const finalDamage = derivedDamageParts
    ? {
        min: roundDamageValue(criticalStrikeResult.finalDamage.min + derivedDamageParts.inheritedTriggerDamage.min),
        avg: roundDamageValue(criticalStrikeResult.finalDamage.avg + derivedDamageParts.inheritedTriggerDamage.avg),
        max: roundDamageValue(criticalStrikeResult.finalDamage.max + derivedDamageParts.inheritedTriggerDamage.max),
      }
    : criticalStrikeResult.finalDamage;

  return {
    abilityId: ability.id,
    hitId: `${action.id}:${hit.id}`,
    tick: hitTick,
    baseDamage,
    additiveModifiers: postInheritedTriggerDamage.additiveModifiers,
    multiplicativeModifiers: multiplicativeResult.multiplicativeModifiers,
    expectedValueModifiers: criticalStrikeResult.expectedValueModifiers,
    finalDamage,
    derivedParts: derivedDamageParts
      ? {
          inheritedTriggerDamage: derivedDamageParts.inheritedTriggerDamage,
        }
      : undefined,
  };
}

function calculateRangedAbilityDamage(config: SimulationConfig): number {
  const rangedLevel = config.playerStats.rangedLevel;
  const weapon = resolveEquippedDefinition(config, 'weapon');

  if (!weapon) {
    return 0;
  }

  const weaponTier = readDamageTier(weapon);
  const ammoTier = readAmmoTier(config);
  const rangedBonus = calculateRangedBonus(config);
  const tierForRangedScaling =
    ammoTier > 0 ? Math.min(weaponTier, ammoTier) : weaponTier;

  return (
    Math.floor(2.5 * rangedLevel) +
    Math.floor(1.25 * rangedLevel) +
    Math.floor(9.6 * tierForRangedScaling + rangedBonus) +
    Math.floor(4.8 * tierForRangedScaling + 0.5 * rangedBonus)
  );
}

function resolveEquippedDefinition(
  config: SimulationConfig,
  slot: EquipmentSlot,
): { offensiveStats?: Record<string, number> } | null {
  const equippedItem = config.gearSetup.equipment[slot];
  if (!equippedItem) {
    return null;
  }

  return config.gameData.items[equippedItem.definitionId] ?? config.gameData.ammo[equippedItem.definitionId] ?? null;
}

function readAmmoTier(config: SimulationConfig): number {
  const ammoInstance = config.gearSetup.ammoSelection ?? config.gearSetup.equipment.ammo;
  if (!ammoInstance) {
    return 0;
  }

  const ammoDefinition =
    config.gameData.ammo[ammoInstance.definitionId] ??
    config.gameData.items[ammoInstance.definitionId];

  return ammoDefinition ? readDamageTier(ammoDefinition) : 0;
}

function readDamageTier(definition: { offensiveStats?: Record<string, number>; tier?: number }): number {
  return Math.max(
    0,
    Math.trunc(definition.offensiveStats?.['damageTier'] ?? definition.tier ?? 0),
  );
}

function calculateRangedBonus(config: SimulationConfig): number {
  return Object.values(config.gearSetup.equipment).reduce((total, instance) => {
    if (!instance) {
      return total;
    }

    const definition = config.gameData.items[instance.definitionId];
    return total + Math.trunc(definition?.offensiveStats?.['rangedBonus'] ?? 0);
  }, 0);
}

function isBolgEquipped(config: SimulationConfig): boolean {
  const weapon = config.gearSetup.equipment.weapon;
  if (!weapon) {
    return false;
  }

  return config.gameData.items[weapon.definitionId]?.effectRefs?.includes(EFFECT_REF_IDS.bolgPassive) ?? false;
}

function calculateBreakdownMultiplierProduct(breakdown: DamageBreakdown): number {
  if (!breakdown.multiplicativeModifiers.length) {
    return 1;
  }

  return breakdown.multiplicativeModifiers.reduce((product, modifier) => {
    const match = /\bx(\d+(?:\.\d+)?)\b/i.exec(modifier.label);
    if (!match) {
      return product;
    }

    return product * Number.parseFloat(match[1]);
  }, 1);
}

function roundDamageValue(value: number): number {
  return Math.round(value * 100) / 100;
}
