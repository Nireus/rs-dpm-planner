import type {
  AbilityDefinition,
  AbilityExtendBuffTimelineEffect,
  AbilityTimelineEffectDurationBonus,
  EquipmentSlot,
  EntityId,
} from '../../game-data/types';
import type {
  SimulationConfig,
  TimelineGeneratedBuffSource,
  RotationAction,
} from '../models';
import { projectSimulationConfigAtTick } from '../state/projected-gear-state';
import {
  isWeaponChangingGearSwap,
  resolveEffectiveChannelDurationTicks,
} from './channel-interruptions';

type TimelineAdrenalineState = Record<number, number> | number[];

export interface ApplyAbilityTimelineEffectsInput {
  config: SimulationConfig;
  action: RotationAction;
  ability: AbilityDefinition | null;
  buffTimeline: Record<number, EntityId[]>;
  adrenalineByTick?: TimelineAdrenalineState;
  timelineGeneratedBuffSources: TimelineGeneratedBuffSource[];
}

export function applyAbilityTimelineEffects(input: ApplyAbilityTimelineEffectsInput): void {
  const { config, action, ability, buffTimeline, adrenalineByTick, timelineGeneratedBuffSources } = input;
  if (!ability) {
    return;
  }

  for (const effect of ability.timelineEffects ?? []) {
    if (effect.kind === 'apply-buff') {
      const startTick = action.tick + (effect.startTickOffset ?? 0);
      const durationTicks = resolveApplyBuffDuration(config, action.tick, ability, effect.buffId, effect.durationTicks, effect.conditionalDurationBonuses);
      if (durationTicks <= 0 || startTick >= config.rotationPlan.tickCount) {
        continue;
      }

      let endTick = startTick + durationTicks - 1;
      if (effect.endsOnWeaponSwap) {
        endTick = Math.min(endTick, resolveFirstWeaponSwapTick(config, action.tick) ?? endTick);
      }

      markBuffRange(buffTimeline, effect.buffId, startTick, endTick, config.rotationPlan.tickCount);
      appendTimelineGeneratedBuffSource(timelineGeneratedBuffSources, {
        buffId: effect.buffId,
        sourceType: 'ability',
        sourceId: ability.id,
      });
      continue;
    }

    if (effect.kind === 'extend-buff') {
      const extensionDuration = resolveExtendBuffDuration(config, action, ability, effect);
      if (extensionDuration <= 0) {
        continue;
      }

      const currentEndTick = resolveBuffEndTick(buffTimeline, effect.buffId, action.tick, config.rotationPlan.tickCount);
      if (effect.requiresActive !== false && currentEndTick === null) {
        continue;
      }

      const extensionStartTick = currentEndTick === null ? action.tick : currentEndTick + 1;
      const extensionEndTick = extensionStartTick + extensionDuration - 1;
      markBuffRange(
        buffTimeline,
        effect.buffId,
        extensionStartTick,
        extensionEndTick,
        config.rotationPlan.tickCount,
      );
      appendTimelineGeneratedBuffSource(timelineGeneratedBuffSources, {
        buffId: effect.buffId,
        sourceType: 'ability',
        sourceId: ability.id,
      });
      continue;
    }

    if (!adrenalineByTick) {
      continue;
    }

    const startTick = action.tick + (effect.startTickOffset ?? 0);
    const durationTicks = effect.durationTicks ??
      (effect.durationFromAbility === 'channel-duration'
        ? resolveEffectiveChannelDurationTicks(config, action, ability)
        : 0);
    if (durationTicks <= 0 || startTick >= config.rotationPlan.tickCount) {
      continue;
    }

    const endTick = startTick + durationTicks - 1;
    for (let tick = startTick; tick <= endTick; tick += 1) {
      if (tick < 0 || tick >= config.rotationPlan.tickCount) {
        continue;
      }

      if (effect.requiresWeaponStyle && !hasEquippedWeaponStyle(config, tick, effect.requiresWeaponStyle)) {
        continue;
      }

      addTimelineAdrenaline(adrenalineByTick, tick, effect.amount);
    }
  }
}

function resolveApplyBuffDuration(
  config: SimulationConfig,
  actionTick: number,
  ability: AbilityDefinition,
  buffId: EntityId,
  explicitDurationTicks: number | undefined,
  conditionalDurationBonuses: AbilityTimelineEffectDurationBonus[] | undefined,
): number {
  const baseDuration = explicitDurationTicks ?? config.gameData.buffs[buffId]?.durationTicks ?? 0;
  if (baseDuration <= 0) {
    return 0;
  }

  const projectedConfig = projectSimulationConfigAtTick(config, actionTick);
  const bonusTicks = (conditionalDurationBonuses ?? []).reduce((total, bonus) => {
    const equippedCount = Object.values(projectedConfig.gearSetup.equipment).reduce((count, instance) => {
      if (!instance) {
        return count;
      }

      const definition = projectedConfig.gameData.items[instance.definitionId];
      return definition?.effectRefs?.includes(bonus.requiredEquippedEffect) ? count + 1 : count;
    }, 0);
    const minCount = bonus.minCount ?? 1;
    return equippedCount >= minCount ? total + bonus.bonusTicks : total;
  }, 0);

  return baseDuration + bonusTicks;
}

function resolveExtendBuffDuration(
  config: SimulationConfig,
  action: RotationAction,
  ability: AbilityDefinition,
  effect: AbilityExtendBuffTimelineEffect,
): number {
  const baseDuration = effect.durationTicks ?? (
    effect.durationFromAbility === 'hit-count'
      ? resolveEffectiveHitCount(config, action, ability)
      : effect.durationFromAbility === 'channel-duration'
        ? resolveEffectiveChannelDurationTicks(config, action, ability)
        : effect.durationFromAbility === 'max-hit-count-or-channel-duration'
          ? Math.max(
              resolveEffectiveHitCount(config, action, ability),
              resolveEffectiveChannelDurationTicks(config, action, ability),
            )
          : 0
  );

  return Math.max(0, baseDuration + (effect.bonusTicks ?? 0));
}

function resolveEffectiveHitCount(
  config: SimulationConfig,
  action: RotationAction,
  ability: AbilityDefinition,
): number {
  if (!ability.isChanneled) {
    return ability.hitSchedule.length;
  }

  const naturalEndTickExclusive = action.tick + Math.max(ability.channelDurationTicks ?? 0, 0);
  const channelEndTickExclusive = action.tick + resolveEffectiveChannelDurationTicks(config, action, ability);
  if (channelEndTickExclusive >= naturalEndTickExclusive) {
    return ability.hitSchedule.length;
  }

  return ability.hitSchedule.filter((hit) => action.tick + hit.tickOffset < channelEndTickExclusive).length;
}

function resolveBuffEndTick(
  buffTimeline: Record<number, EntityId[]>,
  buffId: EntityId,
  activeAtTick: number,
  tickCount: number,
): number | null {
  if (activeAtTick < 0 || activeAtTick >= tickCount || !buffTimeline[activeAtTick]?.includes(buffId)) {
    return null;
  }

  let endTick = activeAtTick;
  while (endTick + 1 < tickCount && buffTimeline[endTick + 1]?.includes(buffId)) {
    endTick += 1;
  }

  return endTick;
}

function resolveFirstWeaponSwapTick(config: SimulationConfig, fromTick: number): number | null {
  const swapTick = [...config.rotationPlan.nonGcdActions]
    .filter((action) => isWeaponChangingGearSwap(config, action) && action.tick >= fromTick)
    .map((action) => action.tick)
    .sort((left, right) => left - right)[0];

  return typeof swapTick === 'number' ? swapTick : null;
}

function hasEquippedWeaponStyle(
  config: SimulationConfig,
  tick: number,
  style: AbilityDefinition['style'],
): boolean {
  const projectedConfig = projectSimulationConfigAtTick(config, tick);
  return (['weapon', 'offHand'] as EquipmentSlot[]).some((slot) => {
    const instance = projectedConfig.gearSetup.equipment[slot];
    if (!instance) {
      return false;
    }

    return projectedConfig.gameData.items[instance.definitionId]?.combatStyleTags.includes(style) ?? false;
  });
}

function addTimelineAdrenaline(
  adrenalineByTick: TimelineAdrenalineState,
  tick: number,
  amount: number,
): void {
  if (Array.isArray(adrenalineByTick)) {
    adrenalineByTick[tick] = (adrenalineByTick[tick] ?? 0) + amount;
    return;
  }

  adrenalineByTick[tick] = (adrenalineByTick[tick] ?? 0) + amount;
}

function appendTimelineGeneratedBuffSource(
  timelineGeneratedBuffSources: TimelineGeneratedBuffSource[],
  entry: TimelineGeneratedBuffSource,
): void {
  if (timelineGeneratedBuffSources.some((existing) => existing.buffId === entry.buffId)) {
    return;
  }

  timelineGeneratedBuffSources.push(entry);
}

export function createEmptyBuffTimeline(tickCount: number): Record<number, EntityId[]> {
  return Object.fromEntries(Array.from({ length: tickCount }, (_, tick) => [tick, []]));
}

export function markBuffRange(
  buffTimeline: Record<number, EntityId[]>,
  buffId: EntityId,
  startTick: number,
  endTick: number,
  tickCount: number,
): void {
  for (let tick = startTick; tick <= endTick; tick += 1) {
    if (tick < 0 || tick >= tickCount) {
      continue;
    }

    if (!buffTimeline[tick].includes(buffId)) {
      buffTimeline[tick].push(buffId);
    }
  }
}
