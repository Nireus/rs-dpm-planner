import type { EntityId, EquipmentSlot, HitDefinition } from '../../game-data/types';
import type {
  DamageBreakdown,
  ItemInstanceConfig,
  RotationAction,
  SimulationConfig,
  TickState,
  ValidationIssue,
} from '../models';
import { createDirectDamageSummary } from './damage-summary';

export function mergeBuffTimelines(
  tickCount: number,
  ...timelines: Array<Record<number, EntityId[]>>
): Record<number, EntityId[]> {
  return Object.fromEntries(
    Array.from({ length: tickCount }, (_, tick) => {
      const maxCountByBuffId = new Map<EntityId, number>();
      const orderedBuffIds: EntityId[] = [];

      for (const timeline of timelines) {
        const countByBuffId = new Map<EntityId, number>();
        for (const buffId of timeline[tick] ?? []) {
          countByBuffId.set(buffId, (countByBuffId.get(buffId) ?? 0) + 1);
          if (!orderedBuffIds.includes(buffId)) {
            orderedBuffIds.push(buffId);
          }
        }

        for (const [buffId, count] of countByBuffId.entries()) {
          maxCountByBuffId.set(buffId, Math.max(maxCountByBuffId.get(buffId) ?? 0, count));
        }
      }

      const merged = orderedBuffIds.flatMap((buffId) =>
        Array.from({ length: maxCountByBuffId.get(buffId) ?? 0 }, () => buffId),
      );

      return [tick, merged];
    }),
  );
}

export function buildTickStates(
  config: SimulationConfig,
  tickIndexes: number[],
  validationIssues: ValidationIssue[],
  adrenalineResult: { adrenalineTimeline: number[]; startingAdrenaline: number },
  channelResult: { tickStates: Array<{ activeChannel?: TickState['channelState'] }> },
  cooldownResult: { cooldownTimeline: Record<number, Record<EntityId, number>> },
  buffTimeline: Record<number, EntityId[]>,
  deathsporeStackTimeline: Record<number, number>,
  perfectEquilibriumStackTimeline: Record<number, number>,
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
    perfectEquilibriumStacks: perfectEquilibriumStackTimeline[tickIndex],
    activePersistentBuffIds: [
      ...(config.persistentBuffConfig.prayerIds ?? []),
      ...(config.persistentBuffConfig.potionIds ?? []),
      ...(config.persistentBuffConfig.relicIds ?? []),
      ...(config.persistentBuffConfig.buffIds ?? []),
      ...(config.persistentBuffConfig.summonIds ?? []),
      ...(config.persistentBuffConfig.pocketEffectItemIds ?? []),
    ],
    activeTimelineBuffIds: buffTimeline[tickIndex] ?? [],
    activeBuffIds: [
      ...(config.persistentBuffConfig.prayerIds ?? []),
      ...(config.persistentBuffConfig.potionIds ?? []),
      ...(config.persistentBuffConfig.relicIds ?? []),
      ...(config.persistentBuffConfig.buffIds ?? []),
      ...(config.persistentBuffConfig.summonIds ?? []),
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
    const summary = createDirectDamageSummary({
      min: breakdown.finalDamage.min,
      max: breakdown.finalDamage.max,
    });
    bucket.push({
      id: breakdown.hitId,
      tickOffset: 0,
      damage: {
        min: summary.min,
        max: summary.max,
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
