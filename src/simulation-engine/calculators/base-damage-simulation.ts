import type { DamageRange, EntityId, EquipmentSlot, HitDefinition } from '../../game-data/types';
import type {
  AbilityDamageSummary,
  DamageBreakdown,
  DamageSummary,
  ItemInstanceConfig,
  RotationAction,
  SimulationConfig,
  SimulationResult,
  TickState,
  ValidationIssue,
} from '../models';
import { resolveAdrenalineTimeline, resolveChannelTimeline, resolveCooldownTimeline } from '../resolvers';
import { resolveDeathsporeTimeline } from '../resolvers/deathspore';
import { resolveDeterministicRangedTimeline } from '../resolvers/ranged-deterministic';
import { resolveEffectiveAbilityDefinition } from '../abilities/effective-ability';
import { applyAdditiveDamageModifiers } from './additive-damage-modifiers';
import { applyExpectedValueCriticalStrike } from './critical-strike';
import { applyMultiplicativeDamageModifiers } from './multiplicative-damage-modifiers';
import { buildBaseTimeline } from '../timeline';
import { validateStrictRotationPlan } from '../validation/strict-rotation-plan';

const BOLG_PASSIVE_EFFECT_REF = 'bolg-passive';
const BALANCE_BY_FORCE_BUFF_ID = 'balance-by-force-buff';
const PERFECT_EQUILIBRIUM_ABILITY_ID = 'perfect-equilibrium';

interface SimulationHitEvent {
  action: RotationAction;
  ability: {
    id: EntityId;
    style?: string;
    subtype?: string;
    effectRefs?: string[];
  };
  hit: HitDefinition;
  tick: number;
  contributesToPerfectEquilibrium: boolean;
}

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
  const abilityDamage = calculateRangedAbilityDamage(config);
  const hitEvents = buildSimulationHitEvents(config, blockingActionIds);
  const hasBolgEquipped = isBolgEquipped(config);
  let perfectEquilibriumStacks = 0;

  for (let index = 0; index < hitEvents.length; index += 1) {
    const event = hitEvents[index];
    const breakdown = createDamageBreakdown(
      config,
      event.action,
      event.ability,
      event.hit,
      abilityDamage,
      event.tick,
      mergedBuffTimeline,
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
    hitEvents.splice(index + 1, 0, createPerfectEquilibriumHitEvent(event, breakdown.finalDamage, abilityDamage));
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

function buildSimulationHitEvents(
  config: SimulationConfig,
  blockingActionIds: ReadonlySet<string>,
): SimulationHitEvent[] {
  const events: SimulationHitEvent[] = [];

  for (const action of [...config.rotationPlan.abilityActions].sort((left, right) => left.tick - right.tick)) {
    if (blockingActionIds.has(action.id)) {
      continue;
    }

    const ability = resolveEffectiveAbilityDefinition(config, action);
    if (!ability) {
      continue;
    }

    const contributesToPerfectEquilibrium =
      ability.style === 'ranged' &&
      !ability.effectRefs?.includes('damage-over-time');

    for (const hit of ability.hitSchedule) {
      const tick = action.tick + hit.tickOffset;
      if (tick < 0 || tick >= config.rotationPlan.tickCount) {
        continue;
      }

      events.push({
        action,
        ability,
        hit,
        tick,
        contributesToPerfectEquilibrium,
      });
    }
  }

  return events.sort((left, right) => {
    if (left.tick !== right.tick) {
      return left.tick - right.tick;
    }

    if (left.action.tick !== right.action.tick) {
      return left.action.tick - right.action.tick;
    }

    return left.hit.tickOffset - right.hit.tickOffset;
  });
}

function buildTickStates(
  config: SimulationConfig,
  tickIndexes: number[],
  validationIssues: ValidationIssue[],
  adrenalineResult: ReturnType<typeof resolveAdrenalineTimeline>,
  channelResult: ReturnType<typeof resolveChannelTimeline>,
  cooldownResult: ReturnType<typeof resolveCooldownTimeline>,
  buffTimeline: Record<number, EntityId[]>,
  deathsporeStackTimeline: Record<number, number>,
  damageBreakdowns: DamageBreakdown[],
): TickState[] {
  const actionsByTick = groupActionsByTick(config.rotationPlan.abilityActions, config.rotationPlan.nonGcdActions);
  const hitsByTick = groupHitsByTick(damageBreakdowns);
  const issuesByTick = groupValidationIssuesByTick(validationIssues);
  const activeEquipmentState = createActiveEquipmentState(config.gearSetup.equipment);

  return tickIndexes.map((tickIndex) => ({
    tickIndex,
    activeEquipmentState,
    activeAmmoState: config.gearSetup.ammoSelection?.definitionId,
    adrenaline: adrenalineResult.adrenalineTimeline[tickIndex] ?? adrenalineResult.startingAdrenaline,
    deathsporeStacks: deathsporeStackTimeline[tickIndex],
    activePersistentBuffIds: [
      ...(config.persistentBuffConfig.prayerIds ?? []),
      ...(config.persistentBuffConfig.potionIds ?? []),
      ...(config.persistentBuffConfig.relicIds ?? []),
      ...(config.persistentBuffConfig.buffIds ?? []),
      ...(config.persistentBuffConfig.pocketEffectItemIds ?? []),
    ],
    activeTimelineBuffIds: buffTimeline[tickIndex] ?? [],
    activeBuffIds: [
      ...(config.persistentBuffConfig.prayerIds ?? []),
      ...(config.persistentBuffConfig.potionIds ?? []),
      ...(config.persistentBuffConfig.relicIds ?? []),
      ...(config.persistentBuffConfig.buffIds ?? []),
      ...(config.persistentBuffConfig.pocketEffectItemIds ?? []),
      ...(buffTimeline[tickIndex] ?? []),
    ],
    cooldowns: cooldownResult.cooldownTimeline[tickIndex] ?? {},
    channelState: channelResult.tickStates[tickIndex]?.activeChannel,
    actionsStartingThisTick: actionsByTick.get(tickIndex) ?? [],
    hitsResolvingThisTick: hitsByTick.get(tickIndex) ?? [],
    validationIssues: issuesByTick.get(tickIndex) ?? [],
  }));
}

function createDamageBreakdown(
  config: SimulationConfig,
  action: RotationAction,
  ability: { id: EntityId; style?: string; effectRefs?: string[] },
  hit: HitDefinition,
  abilityDamage: number,
  hitTick: number,
  buffTimeline: Record<number, EntityId[]>,
): DamageBreakdown {
  const baseDamage = hit.tags?.includes('direct-damage')
    ? createDirectDamageSummary(hit.damage)
    : scaleDamageRangeFromAbilityDamage(hit.damage, abilityDamage);
  const additiveResult = applyAdditiveDamageModifiers(
    config,
    action,
    ability,
    baseDamage,
    abilityDamage,
    buffTimeline,
  );
  const multiplicativeResult = applyMultiplicativeDamageModifiers(
    config,
    ability,
    additiveResult.finalDamage,
    hitTick,
    buffTimeline,
  );
  const criticalStrikeResult = applyExpectedValueCriticalStrike(
    config,
    ability,
    multiplicativeResult.finalDamage,
    hitTick,
    buffTimeline,
  );

  return {
    abilityId: ability.id,
    hitId: `${action.id}:${hit.id}`,
    tick: hitTick,
    baseDamage,
    additiveModifiers: additiveResult.additiveModifiers,
    multiplicativeModifiers: multiplicativeResult.multiplicativeModifiers,
    expectedValueModifiers: criticalStrikeResult.expectedValueModifiers,
    finalDamage: criticalStrikeResult.finalDamage,
  };
}

function scaleDamageRangeFromAbilityDamage(range: DamageRange, abilityDamage: number): DamageSummary {
  const min = Math.floor((abilityDamage * range.min) / 100);
  const max = Math.floor((abilityDamage * range.max) / 100);

  return {
    min,
    avg: (min + max) / 2,
    max,
  };
}

function createDirectDamageSummary(range: DamageRange): DamageSummary {
  const min = roundDamageValue(range.min);
  const max = roundDamageValue(range.max);

  return {
    min,
    avg: roundDamageValue((min + max) / 2),
    max,
  };
}

function createZeroDamageSummary(): DamageSummary {
  return {
    min: 0,
    avg: 0,
    max: 0,
  };
}

function addDamageSummary(target: DamageSummary, value: DamageSummary): void {
  target.min = roundDamageValue(target.min + value.min);
  target.avg = roundDamageValue(target.avg + value.avg);
  target.max = roundDamageValue(target.max + value.max);
}

function roundDamageValue(value: number): number {
  return Math.round(value * 100) / 100;
}

function createEmptyDamageByTick(tickCount: number): Record<number, DamageSummary> {
  return Object.fromEntries(
    Array.from({ length: tickCount }, (_, tick) => [tick, createZeroDamageSummary()]),
  );
}

function mergeBuffTimelines(
  tickCount: number,
  ...timelines: Array<Record<number, EntityId[]>>
): Record<number, EntityId[]> {
  return Object.fromEntries(
    Array.from({ length: tickCount }, (_, tick) => {
      const merged = new Set<EntityId>();
      for (const timeline of timelines) {
        for (const buffId of timeline[tick] ?? []) {
          merged.add(buffId);
        }
      }

      return [tick, [...merged]];
    }),
  );
}

function readAbilityId(action: RotationAction): EntityId | null {
  const abilityId = action.payload['abilityId'];
  return typeof abilityId === 'string' && abilityId.length > 0 ? abilityId : null;
}

function groupActionsByTick(
  abilityActions: RotationAction[],
  nonGcdActions: RotationAction[],
): Map<number, string[]> {
  const grouped = new Map<number, string[]>();

  for (const action of [...abilityActions, ...nonGcdActions]) {
    const existing = grouped.get(action.tick) ?? [];
    const label = action.actionType === 'ability-use'
      ? action.payload['abilityId']
      : action.payload['label'] ?? action.actionType;
    existing.push(typeof label === 'string' ? label : action.id);
    grouped.set(action.tick, existing);
  }

  return grouped;
}

function groupHitsByTick(damageBreakdowns: DamageBreakdown[]): Map<number, HitDefinition[]> {
  const grouped = new Map<number, HitDefinition[]>();

  for (const breakdown of damageBreakdowns) {
    const bucket = grouped.get(breakdown.tick) ?? [];
    bucket.push({
      id: breakdown.hitId,
      tickOffset: 0,
      damage: {
        min: breakdown.finalDamage.min,
        max: breakdown.finalDamage.max,
      },
      tags: ['resolved-hit'],
    });
    grouped.set(breakdown.tick, bucket);
  }

  return grouped;
}

function groupValidationIssuesByTick(validationIssues: ValidationIssue[]): Map<number, ValidationIssue[]> {
  const grouped = new Map<number, ValidationIssue[]>();

  for (const issue of validationIssues) {
    if (typeof issue.tick !== 'number') {
      continue;
    }

    const bucket = grouped.get(issue.tick) ?? [];
    bucket.push(issue);
    grouped.set(issue.tick, bucket);
  }

  return grouped;
}

function createActiveEquipmentState(
  equipment: Partial<Record<EquipmentSlot, ItemInstanceConfig>>,
): Partial<Record<EquipmentSlot, string>> {
  return Object.fromEntries(
    Object.entries(equipment)
      .filter((entry): entry is [EquipmentSlot, ItemInstanceConfig] => Boolean(entry[1]))
      .map(([slot, instance]) => [slot, instance.definitionId]),
  );
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

  return config.gameData.items[weapon.definitionId]?.effectRefs?.includes(BOLG_PASSIVE_EFFECT_REF) ?? false;
}

function createPerfectEquilibriumHitEvent(
  sourceEvent: SimulationHitEvent,
  triggeringDamage: DamageSummary,
  abilityDamage: number,
): SimulationHitEvent {
  const inheritedEffectRefs = sourceEvent.ability.effectRefs?.includes('critical-strike-chance:+100%')
    ? ['critical-strike-chance:+100%']
    : undefined;

  return {
    action: sourceEvent.action,
    ability: {
      id: PERFECT_EQUILIBRIUM_ABILITY_ID,
      style: 'ranged',
      subtype: 'other',
      effectRefs: inheritedEffectRefs,
    },
    hit: {
      id: `perfect-equilibrium:${sourceEvent.hit.id}`,
      tickOffset: 0,
      damage: buildPerfectEquilibriumDamageRange(triggeringDamage, abilityDamage),
      tags: ['derived-hit', 'direct-damage'],
    },
    tick: sourceEvent.tick,
    contributesToPerfectEquilibrium: false,
  };
}

function buildPerfectEquilibriumDamageRange(
  triggeringDamage: DamageSummary,
  abilityDamage: number,
): DamageRange {
  const min = roundDamageValue((12 / 100) * abilityDamage + (33 / 100) * triggeringDamage.min);
  const max = roundDamageValue((16 / 100) * abilityDamage + (37 / 100) * triggeringDamage.max);

  return {
    min,
    max,
  };
}
