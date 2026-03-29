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
import { resolveEquilibriumTimeline } from '../resolvers/equilibrium';
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
import { collectHighestEquippedPerkRank } from '../perks/equipped-perks';

const BALANCE_BY_FORCE_BUFF_ID = 'balance-by-force-buff';
const CRACKLING_COOLDOWN_TICKS = 100;
const CRACKLING_ABILITY_ID = 'crackling';
const AFTERSHOCK_COOLDOWN_TICKS = 10;
const AFTERSHOCK_THRESHOLD_DAMAGE = 50000;
const AFTERSHOCK_ABILITY_ID = 'aftershock';
const SPLIT_SOUL_ABILITY_ID = 'split-soul';
const SPLIT_SOUL_BUFF_ID = 'split-soul';
const SPLIT_SOUL_DAMAGE_CAP = 10000;
const AMULET_OF_SOULS_SPLIT_SOUL_AVERAGE_MULTIPLIER = 1.1875;

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
  const equilibriumTimeline = resolveEquilibriumTimeline(config);
  const mergedBuffTimeline = mergeBuffTimelines(
    config.rotationPlan.tickCount,
    deterministicRangedTimeline.buffTimeline,
    deathsporeTimeline.buffTimeline,
    equilibriumTimeline.buffTimeline,
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
  let cracklingReadyAtTick = 0;
  let aftershockReadyAtTick = 0;
  let aftershockPendingProcCount = 0;
  let aftershockStoredDamage = createZeroDamageSummary();
  let aftershockWasEquipped = collectHighestEquippedPerkRank(config, AFTERSHOCK_ABILITY_ID) > 0;

  for (let index = 0; index < hitEvents.length; index += 1) {
    const event = hitEvents[index];
    const projectedConfig = projectSimulationConfigAtTick(config, event.action.tick);
    const actionAbilityDamage = calculateRangedAbilityDamage(projectedConfig);
    const aftershockRank = collectHighestEquippedPerkRank(projectedConfig, AFTERSHOCK_ABILITY_ID);
    const aftershockEquipped = aftershockRank > 0;

    if (!aftershockEquipped && aftershockWasEquipped) {
      aftershockStoredDamage = createZeroDamageSummary();
      aftershockPendingProcCount = 0;
    }
    aftershockWasEquipped = aftershockEquipped;

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
    maybeAppendSplitSoulDamage(
      damageBreakdowns,
      damageByTick,
      damageByAbilityMap,
      config,
      event,
      breakdown,
      mergedBuffTimeline,
    );

    if (shouldContributeToAftershock(event, projectedConfig)) {
      addDamageSummary(aftershockStoredDamage, breakdown.finalDamage);

      if (aftershockStoredDamage.avg >= AFTERSHOCK_THRESHOLD_DAMAGE) {
        aftershockPendingProcCount += 1;
        aftershockStoredDamage = createZeroDamageSummary();
      }
    }

    const shouldInsertAftershock =
      aftershockEquipped &&
      aftershockPendingProcCount > 0 &&
      event.tick >= aftershockReadyAtTick &&
      event.ability.id !== AFTERSHOCK_ABILITY_ID;

    if (shouldInsertAftershock) {
      hitEvents.splice(index + 1, 0, createAftershockHitEvent(event, actionAbilityDamage, aftershockRank));
      aftershockPendingProcCount -= 1;
      aftershockReadyAtTick = event.tick + AFTERSHOCK_COOLDOWN_TICKS;
    }

    if (!hasBolgEquipped || !event.contributesToPerfectEquilibrium) {
      if (shouldTriggerCrackling(event, projectedConfig, cracklingReadyAtTick)) {
        const cracklingRank = collectHighestEquippedPerkRank(projectedConfig, CRACKLING_ABILITY_ID);
        hitEvents.splice(index + 1, 0, createCracklingHitEvent(event, actionAbilityDamage, cracklingRank));
        cracklingReadyAtTick = event.tick + CRACKLING_COOLDOWN_TICKS;
      }

      continue;
    }

    perfectEquilibriumStacks += 1;
    const perfectEquilibriumThreshold =
      mergedBuffTimeline[event.tick]?.includes(BALANCE_BY_FORCE_BUFF_ID) ? 4 : 8;

    if (perfectEquilibriumStacks < perfectEquilibriumThreshold) {
      if (shouldTriggerCrackling(event, projectedConfig, cracklingReadyAtTick)) {
        const cracklingRank = collectHighestEquippedPerkRank(projectedConfig, CRACKLING_ABILITY_ID);
        hitEvents.splice(index + 1, 0, createCracklingHitEvent(event, actionAbilityDamage, cracklingRank));
        cracklingReadyAtTick = event.tick + CRACKLING_COOLDOWN_TICKS;
      }

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

    if (shouldTriggerCrackling(event, projectedConfig, cracklingReadyAtTick)) {
      const cracklingRank = collectHighestEquippedPerkRank(projectedConfig, CRACKLING_ABILITY_ID);
      hitEvents.splice(index + 2, 0, createCracklingHitEvent(event, actionAbilityDamage, cracklingRank));
      cracklingReadyAtTick = event.tick + CRACKLING_COOLDOWN_TICKS;
    }
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
      ...equilibriumTimeline.timelineGeneratedBuffSources,
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
        ...(collectHighestEquippedPerkRank(config, CRACKLING_ABILITY_ID) > 0
          ? ['Crackling: after its cooldown ends, the next qualifying hit adds a direct perk hit on the same tick.']
          : []),
        ...(collectHighestEquippedPerkRank(config, AFTERSHOCK_ABILITY_ID) > 0
          ? ['Aftershock: qualifying weapon damage builds toward 50,000, then fires a delayed single-target perk hit with no overflow carry.']
          : []),
        ...(damageBreakdowns.some((entry) => entry.abilityId === SPLIT_SOUL_ABILITY_ID)
          ? ['Split Soul: each qualifying hit while the buff is active creates a separate same-tick damage splat based on Soul Split healing.']
          : []),
        ...deterministicRangedTimeline.notes,
        ...deathsporeTimeline.notes,
        ...equilibriumTimeline.notes,
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
  const preciseAdjustedBaseDamage = applyPreciseToBaseDamage(projectedConfig, ability, baseDamage);
  const multiplicativeResult = applyMultiplicativeDamageModifiers(
    projectedConfig,
    ability,
    hit,
    preciseAdjustedBaseDamage,
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
    baseDamage: preciseAdjustedBaseDamage,
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

  const baseAbilityDamage = (
    Math.floor(2.5 * rangedLevel) +
    Math.floor(1.25 * rangedLevel) +
    Math.floor(9.6 * tierForRangedScaling + rangedBonus) +
    Math.floor(4.8 * tierForRangedScaling + 0.5 * rangedBonus)
  );

  const eruptiveRank = collectHighestEquippedPerkRank(config, 'eruptive');
  const eruptiveMultiplier = 1 + eruptiveRank * 0.005;

  return roundDamageValue(baseAbilityDamage * eruptiveMultiplier);
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

function shouldTriggerCrackling(
  event: SimulationHitEvent,
  config: SimulationConfig,
  cracklingReadyAtTick: number,
): boolean {
  if (event.tick < cracklingReadyAtTick) {
    return false;
  }

  if (event.ability.id === PERFECT_EQUILIBRIUM_ABILITY_ID || event.ability.id === CRACKLING_ABILITY_ID) {
    return false;
  }

  if (event.ability.style !== 'ranged' || event.ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime)) {
    return false;
  }

  return collectHighestEquippedPerkRank(config, CRACKLING_ABILITY_ID) > 0;
}

function createCracklingHitEvent(
  sourceEvent: SimulationHitEvent,
  abilityDamage: number,
  cracklingRank: number,
): SimulationHitEvent {
  const damage = roundDamageValue(abilityDamage * cracklingRank * 0.5);

  return {
    action: sourceEvent.action,
    ability: {
      id: CRACKLING_ABILITY_ID,
      style: 'constitution',
      subtype: 'other',
      effectRefs: undefined,
    },
    hit: {
      id: `crackling:${sourceEvent.hit.id}`,
      tickOffset: 0,
      damage: {
        min: damage,
        max: damage,
      },
      tags: ['derived-hit', 'direct-damage'],
    },
    tick: sourceEvent.tick,
    contributesToPerfectEquilibrium: false,
  };
}

function shouldContributeToAftershock(
  event: SimulationHitEvent,
  config: SimulationConfig,
): boolean {
  if (collectHighestEquippedPerkRank(config, AFTERSHOCK_ABILITY_ID) <= 0) {
    return false;
  }

  if (event.ability.id === CRACKLING_ABILITY_ID || event.ability.id === AFTERSHOCK_ABILITY_ID) {
    return false;
  }

  if (event.ability.style !== 'ranged' || event.ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime)) {
    return false;
  }

  return true;
}

function createAftershockHitEvent(
  sourceEvent: SimulationHitEvent,
  abilityDamage: number,
  aftershockRank: number,
): SimulationHitEvent {
  const minMultiplier = aftershockRank * 0.24;
  const maxMultiplier = aftershockRank * 0.396;

  return {
    action: sourceEvent.action,
    ability: {
      id: AFTERSHOCK_ABILITY_ID,
      style: 'constitution',
      subtype: 'other',
      effectRefs: [EFFECT_REF_IDS.aftershock],
    },
    hit: {
      id: `aftershock:${sourceEvent.hit.id}`,
      tickOffset: 0,
      damage: {
        min: roundDamageValue(abilityDamage * minMultiplier),
        max: roundDamageValue(abilityDamage * maxMultiplier),
      },
      tags: ['derived-hit', 'direct-damage'],
    },
    tick: sourceEvent.tick,
    contributesToPerfectEquilibrium: false,
  };
}

function applyPreciseToBaseDamage(
  config: SimulationConfig,
  ability: { style?: string; effectRefs?: string[] },
  baseDamage: DamageSummary,
): DamageSummary {
  if (ability.style !== 'ranged' || ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime)) {
    return baseDamage;
  }

  const preciseRank = collectHighestEquippedPerkRank(config, 'precise');
  if (preciseRank <= 0) {
    return baseDamage;
  }

  const minIncrease = roundDamageValue(baseDamage.max * preciseRank * 0.015);

  return {
    min: roundDamageValue(baseDamage.min + minIncrease),
    avg: roundDamageValue(baseDamage.avg + minIncrease / 2),
    max: baseDamage.max,
  };
}

function maybeAppendSplitSoulDamage(
  damageBreakdowns: DamageBreakdown[],
  damageByTick: Record<number, DamageSummary>,
  damageByAbilityMap: Map<EntityId, DamageSummary>,
  config: SimulationConfig,
  event: SimulationHitEvent,
  sourceBreakdown: DamageBreakdown,
  buffTimeline: Record<number, EntityId[]>,
): void {
  const splitSoulTick = event.tick;
  if (
    event.ability.id === SPLIT_SOUL_ABILITY_ID ||
    !buffTimeline[event.tick]?.includes(SPLIT_SOUL_BUFF_ID) ||
    splitSoulTick < 0 ||
    splitSoulTick >= config.rotationPlan.tickCount ||
    sourceBreakdown.finalDamage.avg <= 0
  ) {
    return;
  }

  const projectedConfig = projectSimulationConfigAtTick(config, event.tick);
  const hasAmuletOfSoulsBoost = hasSplitSoulAmuletBoost(projectedConfig);
  const splitSoulDamage = calculateSplitSoulDamage(sourceBreakdown.finalDamage, hasAmuletOfSoulsBoost);
  const splitSoulBreakdown: DamageBreakdown = {
    abilityId: SPLIT_SOUL_ABILITY_ID,
    hitId: `${event.action.id}:split-soul:${event.hit.id}`,
    tick: splitSoulTick,
    baseDamage: splitSoulDamage,
    additiveModifiers: [],
    multiplicativeModifiers: [],
    expectedValueModifiers: [],
    finalDamage: splitSoulDamage,
  };

  damageBreakdowns.push(splitSoulBreakdown);
  addDamageSummary(damageByTick[splitSoulTick], splitSoulDamage);

  const abilitySummary = damageByAbilityMap.get(SPLIT_SOUL_ABILITY_ID) ?? createZeroDamageSummary();
  addDamageSummary(abilitySummary, splitSoulDamage);
  damageByAbilityMap.set(SPLIT_SOUL_ABILITY_ID, abilitySummary);
}

function hasSplitSoulAmuletBoost(config: SimulationConfig): boolean {
  const amulet = config.gearSetup.equipment.amulet;
  if (!amulet) {
    return false;
  }

  const amuletDefinition = config.gameData.items[amulet.definitionId];
  return amuletDefinition?.effectRefs?.includes('amulet-of-souls-passive') ?? false;
}

function calculateSplitSoulDamage(
  sourceDamage: DamageSummary,
  hasAmuletOfSoulsBoost: boolean,
): DamageSummary {
  return {
    min: calculateSplitSoulDamageValue(sourceDamage.min, hasAmuletOfSoulsBoost),
    avg: calculateSplitSoulDamageValue(sourceDamage.avg, hasAmuletOfSoulsBoost),
    max: calculateSplitSoulDamageValue(sourceDamage.max, hasAmuletOfSoulsBoost),
  };
}

function calculateSplitSoulDamageValue(
  sourceDamage: number,
  hasAmuletOfSoulsBoost: boolean,
): number {
  const healedAmount = calculateSoulSplitHeal(sourceDamage);
  const baseDamage = healedAmount * 4;
  const boostedDamage = hasAmuletOfSoulsBoost
    ? baseDamage * AMULET_OF_SOULS_SPLIT_SOUL_AVERAGE_MULTIPLIER
    : baseDamage;

  return roundDamageValue(Math.min(boostedDamage, SPLIT_SOUL_DAMAGE_CAP));
}

function calculateSoulSplitHeal(sourceDamage: number): number {
  const firstBracket = Math.min(sourceDamage, 2000) * 0.1;
  const secondBracket = Math.min(Math.max(sourceDamage - 2000, 0), 2000) * 0.05;
  const thirdBracket = Math.max(sourceDamage - 4000, 0) * 0.0125;

  return firstBracket + secondBracket + thirdBracket;
}
