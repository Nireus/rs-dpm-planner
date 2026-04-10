import type { EntityId } from '../../game-data/types';
import type { RotationAction, SimulationConfig, TimelineGeneratedBuffSource } from '../models';
import { clampBuffStacks, resolveBuffStackRuleState } from '../buffs/buff-stack-rules';
import { resolveEffectiveAbilityDefinition } from '../abilities/effective-ability';
import {
  applyAbilityTimelineEffects,
  createEmptyBuffTimeline,
} from './ability-timeline-effects';

export const BLOODLUST_BUFF_ID = 'bloodlust';
export const METEOR_STRIKE_BUFF_ID = 'meteor-strike-buff';
const BERSERK_BUFF_ID = 'berserk-buff';

export interface DeterministicMeleeTimelineResult {
  buffTimeline: Record<number, EntityId[]>;
  adrenalineByTick: number[];
  timelineGeneratedBuffSources: TimelineGeneratedBuffSource[];
  notes: string[];
}

export function resolveDeterministicMeleeTimeline(
  config: SimulationConfig,
  blockedActionIds: ReadonlySet<string> = new Set(),
): DeterministicMeleeTimelineResult {
  const buffTimeline = createEmptyBuffTimeline(config.rotationPlan.tickCount);
  const adrenalineByTick = Array.from({ length: config.rotationPlan.tickCount }, () => 0);
  const timelineGeneratedBuffSources: TimelineGeneratedBuffSource[] = [];

  for (const action of [...config.rotationPlan.abilityActions].sort((left, right) => left.tick - right.tick)) {
    if (blockedActionIds.has(action.id)) {
      continue;
    }

    const ability = resolveEffectiveAbilityDefinition(config, action);
    if (ability?.style !== 'melee') {
      continue;
    }

    applyAbilityTimelineEffects({
      config,
      action,
      ability,
      buffTimeline,
      adrenalineByTick,
      timelineGeneratedBuffSources,
    });
  }

  applyStackEffects(config, blockedActionIds, buffTimeline, timelineGeneratedBuffSources);

  return {
    buffTimeline,
    adrenalineByTick,
    timelineGeneratedBuffSources,
    notes: [
      ...(Object.values(buffTimeline).some((buffIds) => buffIds.includes(BERSERK_BUFF_ID))
        ? ['Berserk: applies a melee damage buff starting on the cast tick, and Vestments of havoc extends it when 3 pieces are worn.']
        : []),
      ...(Object.values(buffTimeline).some((buffIds) => buffIds.includes(BLOODLUST_BUFF_ID))
        ? ['Bloodlust: melee basic abilities add stacks on the cast tick, Rend grants 2, Berserk grants 4 through the active multiplier setup, and supported spenders consume 4 stacks when available.']
        : []),
      ...(Object.values(buffTimeline).some((buffIds) => buffIds.includes(METEOR_STRIKE_BUFF_ID))
        ? ['Meteor Strike: applies a 30 second melee-only adrenaline buff with passive per-tick adrenaline and boosted melee basic adrenaline gain while a melee weapon remains equipped.']
        : []),
    ],
  };
}

function applyStackEffects(
  config: SimulationConfig,
  blockedActionIds: ReadonlySet<string>,
  buffTimeline: Record<number, EntityId[]>,
  timelineGeneratedBuffSources: TimelineGeneratedBuffSource[],
): void {
  const actionsByTick = groupAbilityActionsByTick(
    [...config.rotationPlan.abilityActions]
      .filter((action) => !blockedActionIds.has(action.id))
      .sort((left, right) => left.tick - right.tick),
  );
  const stackCounts = new Map<EntityId, number>();

  for (let tick = 0; tick < config.rotationPlan.tickCount; tick += 1) {
    const actionsAtTick = actionsByTick.get(tick) ?? [];
    const activeBuffIds = buffTimeline[tick] ?? [];

    for (const action of actionsAtTick) {
      const ability = resolveEffectiveAbilityDefinition(config, action);
      if (!ability) {
        continue;
      }

      for (const effect of ability.stackEffects ?? []) {
        const currentStacks = stackCounts.get(effect.buffId) ?? 0;
        const stackRuleState = resolveBuffStackRuleState(
          config.gameData.buffs[effect.buffId],
          activeBuffIds,
        );

        if (effect.operation === 'spend') {
          if (currentStacks >= effect.stacks) {
            stackCounts.set(effect.buffId, currentStacks - effect.stacks);
          }
          continue;
        }

        const nextStacks = clampBuffStacks(
          currentStacks + (effect.stacks * stackRuleState.gainMultiplier),
          stackRuleState.maxStacks,
        );
        stackCounts.set(effect.buffId, nextStacks);
      }
    }

    for (const [buffId, count] of stackCounts.entries()) {
      for (let index = 0; index < count; index += 1) {
        buffTimeline[tick].push(buffId);
      }
    }
  }

  if (
    Object.values(buffTimeline).some((buffIds) => buffIds.includes(BLOODLUST_BUFF_ID)) &&
    !timelineGeneratedBuffSources.some((entry) => entry.buffId === BLOODLUST_BUFF_ID)
  ) {
    timelineGeneratedBuffSources.push({
      buffId: BLOODLUST_BUFF_ID,
      sourceType: 'event',
    });
  }
}

function groupAbilityActionsByTick(actions: RotationAction[]): Map<number, RotationAction[]> {
  const grouped = new Map<number, RotationAction[]>();

  for (const action of actions) {
    const existing = grouped.get(action.tick);
    if (existing) {
      existing.push(action);
    } else {
      grouped.set(action.tick, [action]);
    }
  }

  return grouped;
}
