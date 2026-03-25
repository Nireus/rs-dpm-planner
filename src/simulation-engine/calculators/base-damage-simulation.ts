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
import { buildBaseTimeline } from '../timeline';
import { validateStrictRotationPlan } from '../validation/strict-rotation-plan';

export function simulateBaseDamage(config: SimulationConfig): SimulationResult {
  const timelineResult = buildBaseTimeline({ rotationPlan: config.rotationPlan });
  const strictIssues = validateStrictRotationPlan(config);
  const adrenalineResult = resolveAdrenalineTimeline(config);
  const cooldownResult = resolveCooldownTimeline(config);
  const validationIssues = [
    ...timelineResult.validationIssues,
    ...strictIssues,
    ...adrenalineResult.validationIssues,
    ...cooldownResult.validationIssues,
  ];
  const blockingActionIds = new Set(
    validationIssues
      .filter((issue) => issue.severity === 'error' && typeof issue.relatedActionId === 'string')
      .map((issue) => issue.relatedActionId as string),
  );
  const channelResult = resolveChannelTimeline(config, blockingActionIds);
  const damageBreakdowns: DamageBreakdown[] = [];
  const damageByTick = createEmptyDamageByTick(config.rotationPlan.tickCount);
  const damageByAbilityMap = new Map<EntityId, DamageSummary>();

  for (const action of [...config.rotationPlan.abilityActions].sort((left, right) => left.tick - right.tick)) {
    if (blockingActionIds.has(action.id)) {
      continue;
    }

    const abilityId = readAbilityId(action);
    if (!abilityId) {
      continue;
    }

    const ability = config.gameData.abilities[abilityId];
    if (!ability) {
      continue;
    }

    const abilityDamage = calculateRangedAbilityDamage(config);

    for (const hit of ability.hitSchedule) {
      const tick = action.tick + hit.tickOffset;
      if (tick < 0 || tick >= config.rotationPlan.tickCount) {
        continue;
      }

      const breakdown = createDamageBreakdown(action, ability.id, hit, abilityDamage);
      damageBreakdowns.push(breakdown);
      addDamageSummary(damageByTick[tick], breakdown.finalDamage);

      const abilitySummary = damageByAbilityMap.get(ability.id) ?? createZeroDamageSummary();
      addDamageSummary(abilitySummary, breakdown.finalDamage);
      damageByAbilityMap.set(ability.id, abilitySummary);
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
    buffTimeline: createEmptyBuffTimeline(config.rotationPlan.tickCount),
    timelineGeneratedBuffSources: [],
    cooldownTimeline: cooldownResult.cooldownTimeline,
    tickStates: buildTickStates(
      config,
      timelineResult.timeline.ticks.map((bucket) => bucket.tickIndex),
      validationIssues,
      adrenalineResult,
      channelResult,
      cooldownResult,
    ),
    explainability: {
      damageBreakdowns,
      notes: [
        'Phase 9.1 uses base hit scheduling only. Additive, multiplicative, and expected-value modifiers are not applied yet.',
      ],
    },
  };
}

function buildTickStates(
  config: SimulationConfig,
  tickIndexes: number[],
  validationIssues: ValidationIssue[],
  adrenalineResult: ReturnType<typeof resolveAdrenalineTimeline>,
  channelResult: ReturnType<typeof resolveChannelTimeline>,
  cooldownResult: ReturnType<typeof resolveCooldownTimeline>,
): TickState[] {
  const actionsByTick = groupActionsByTick(config.rotationPlan.abilityActions, config.rotationPlan.nonGcdActions);
  const hitsByTick = groupHitsByTick(config);
  const issuesByTick = groupValidationIssuesByTick(validationIssues);
  const activeEquipmentState = createActiveEquipmentState(config.gearSetup.equipment);

  return tickIndexes.map((tickIndex) => ({
    tickIndex,
    activeEquipmentState,
    activeAmmoState: config.gearSetup.ammoSelection?.definitionId,
    adrenaline: adrenalineResult.adrenalineTimeline[tickIndex] ?? adrenalineResult.startingAdrenaline,
    activePersistentBuffIds: [
      ...(config.persistentBuffConfig.prayerIds ?? []),
      ...(config.persistentBuffConfig.potionIds ?? []),
      ...(config.persistentBuffConfig.relicIds ?? []),
      ...(config.persistentBuffConfig.buffIds ?? []),
      ...(config.persistentBuffConfig.pocketEffectItemIds ?? []),
    ],
    activeTimelineBuffIds: [],
    activeBuffIds: [
      ...(config.persistentBuffConfig.prayerIds ?? []),
      ...(config.persistentBuffConfig.potionIds ?? []),
      ...(config.persistentBuffConfig.relicIds ?? []),
      ...(config.persistentBuffConfig.buffIds ?? []),
      ...(config.persistentBuffConfig.pocketEffectItemIds ?? []),
    ],
    cooldowns: cooldownResult.cooldownTimeline[tickIndex] ?? {},
    channelState: channelResult.tickStates[tickIndex]?.activeChannel,
    actionsStartingThisTick: actionsByTick.get(tickIndex) ?? [],
    hitsResolvingThisTick: hitsByTick.get(tickIndex) ?? [],
    validationIssues: issuesByTick.get(tickIndex) ?? [],
  }));
}

function createDamageBreakdown(
  action: RotationAction,
  abilityId: EntityId,
  hit: HitDefinition,
  abilityDamage: number,
): DamageBreakdown {
  const baseDamage = scaleDamageRangeFromAbilityDamage(hit.damage, abilityDamage);

  return {
    abilityId,
    hitId: `${action.id}:${hit.id}`,
    baseDamage,
    additiveModifiers: [],
    multiplicativeModifiers: [],
    expectedValueModifiers: [],
    finalDamage: baseDamage,
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

function createZeroDamageSummary(): DamageSummary {
  return {
    min: 0,
    avg: 0,
    max: 0,
  };
}

function addDamageSummary(target: DamageSummary, value: DamageSummary): void {
  target.min += value.min;
  target.avg += value.avg;
  target.max += value.max;
}

function createEmptyDamageByTick(tickCount: number): Record<number, DamageSummary> {
  return Object.fromEntries(
    Array.from({ length: tickCount }, (_, tick) => [tick, createZeroDamageSummary()]),
  );
}

function createEmptyBuffTimeline(tickCount: number): Record<number, EntityId[]> {
  return Object.fromEntries(Array.from({ length: tickCount }, (_, tick) => [tick, []]));
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

function groupHitsByTick(config: SimulationConfig): Map<number, HitDefinition[]> {
  const grouped = new Map<number, HitDefinition[]>();

  for (const action of config.rotationPlan.abilityActions) {
    const abilityId = readAbilityId(action);
    if (!abilityId) {
      continue;
    }

    const ability = config.gameData.abilities[abilityId];
    if (!ability) {
      continue;
    }

    for (const hit of ability.hitSchedule) {
      const tick = action.tick + hit.tickOffset;
      if (tick < 0 || tick >= config.rotationPlan.tickCount) {
        continue;
      }

      const bucket = grouped.get(tick) ?? [];
      bucket.push(hit);
      grouped.set(tick, bucket);
    }
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
