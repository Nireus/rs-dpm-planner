import type { EntityId } from '../../game-data/types';
import { EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type { RotationAction, SimulationConfig, TimelineGeneratedBuffSource } from '../models';
import {
  normalizeStartingDeathsporeStacks,
  normalizeStartingPerfectEquilibriumStacks,
} from '../models/starting-stacks';
import { resolveEffectiveAbilityDefinition } from '../abilities/effective-ability';
import { projectSimulationConfigAtTick } from '../state/projected-gear-state';

const DEATHSPORE_EFFECT_REF = EFFECT_REF_IDS.deathsporeProgress;
const FEASTING_SPORES_READY_BUFF_ID = 'feasting-spores-ready';
const FEASTING_SPORES_COOLDOWN_BUFF_ID = 'feasting-spores-cooldown';
const BALANCE_BY_FORCE_BUFF_ID = 'balance-by-force-buff';
const BOLG_PASSIVE_EFFECT_REF = EFFECT_REF_IDS.bolgPassive;

const FEASTING_SPORES_REQUIRED_STACKS = 12;
const FEASTING_SPORES_READY_DURATION_TICKS = 15;
const FEASTING_SPORES_COOLDOWN_TICKS = 50;

interface RangedHitOccurrence {
  tick: number;
  contributesToPerfectEquilibrium: boolean;
  countsForDeathspore: boolean;
}

export interface DeathsporeTimelineResult {
  buffTimeline: Record<number, EntityId[]>;
  stackTimeline: Record<number, number>;
  timelineGeneratedBuffSources: TimelineGeneratedBuffSource[];
  freeCastActionIds: Set<string>;
  notes: string[];
}

export function resolveDeathsporeTimeline(
  config: SimulationConfig,
  blockedActionIds: ReadonlySet<string> = new Set(),
  baseBuffTimeline: Record<number, EntityId[]> = createEmptyBuffTimeline(config.rotationPlan.tickCount),
): DeathsporeTimelineResult {
  const buffTimeline = createEmptyBuffTimeline(config.rotationPlan.tickCount);
  const stackTimeline = createEmptyStackTimeline(config.rotationPlan.tickCount);
  const timelineGeneratedBuffSources: TimelineGeneratedBuffSource[] = [];
  const freeCastActionIds = new Set<string>();
  const notes: string[] = [];

  const hitOccurrences = buildRangedHitOccurrences(config, blockedActionIds, baseBuffTimeline);
  const abilityActions = [...config.rotationPlan.abilityActions]
    .filter((action) => !blockedActionIds.has(action.id))
    .sort((left, right) => left.tick - right.tick);

  let feastingSporesStacks = normalizeStartingDeathsporeStacks(config.rotationPlan.startingStacks?.deathsporeStacks);
  let cooldownUntilTick = -1;
  let lastRecordedTick = -1;

  for (const occurrence of hitOccurrences) {
    fillStackRange(
      stackTimeline,
      lastRecordedTick + 1,
      occurrence.tick - 1,
      feastingSporesStacks,
      config.rotationPlan.tickCount,
    );

    if (!occurrence.countsForDeathspore) {
      stackTimeline[occurrence.tick] = feastingSporesStacks;
      lastRecordedTick = occurrence.tick;
      continue;
    }

    if (occurrence.tick <= cooldownUntilTick) {
      stackTimeline[occurrence.tick] = 0;
      lastRecordedTick = occurrence.tick;
      continue;
    }

    feastingSporesStacks += 1;
    if (feastingSporesStacks < FEASTING_SPORES_REQUIRED_STACKS) {
      stackTimeline[occurrence.tick] = feastingSporesStacks;
      lastRecordedTick = occurrence.tick;
      continue;
    }

    feastingSporesStacks = 0;
    const readyStartTick = occurrence.tick;
    const readyEndTick = Math.min(
      config.rotationPlan.tickCount - 1,
      readyStartTick + FEASTING_SPORES_READY_DURATION_TICKS - 1,
    );
    const cooldownEndTick = Math.min(
      config.rotationPlan.tickCount - 1,
      readyStartTick + FEASTING_SPORES_COOLDOWN_TICKS - 1,
    );
    const consumingAction = findFirstEligibleFreeCastAction(config, abilityActions, readyStartTick, readyEndTick);
    const visibleReadyEndTick = consumingAction?.tick ?? readyEndTick;

    markBuffRange(buffTimeline, FEASTING_SPORES_READY_BUFF_ID, readyStartTick, visibleReadyEndTick, config.rotationPlan.tickCount);
    markBuffRange(buffTimeline, FEASTING_SPORES_COOLDOWN_BUFF_ID, readyStartTick, cooldownEndTick, config.rotationPlan.tickCount);

    if (consumingAction) {
      freeCastActionIds.add(consumingAction.id);
    }

    cooldownUntilTick = cooldownEndTick;
    stackTimeline[occurrence.tick] = feastingSporesStacks;
    lastRecordedTick = occurrence.tick;
  }

  fillStackRange(
    stackTimeline,
    lastRecordedTick + 1,
    config.rotationPlan.tickCount - 1,
    feastingSporesStacks,
    config.rotationPlan.tickCount,
  );

  if (Object.values(buffTimeline).some((buffIds) => buffIds.includes(FEASTING_SPORES_READY_BUFF_ID))) {
    timelineGeneratedBuffSources.push({
      buffId: FEASTING_SPORES_READY_BUFF_ID,
      sourceType: 'item',
      sourceId: 'deathspore-arrows',
    });
  }

  if (Object.values(buffTimeline).some((buffIds) => buffIds.includes(FEASTING_SPORES_COOLDOWN_BUFF_ID))) {
    timelineGeneratedBuffSources.push({
      buffId: FEASTING_SPORES_COOLDOWN_BUFF_ID,
      sourceType: 'item',
      sourceId: 'deathspore-arrows',
    });
  }

  if (timelineGeneratedBuffSources.length > 0) {
    notes.push(
      'Deathspore arrows: every ranged hit adds a stack; at 12 stacks they grant a 15-tick free-cast window and begin a 50-tick cooldown that blocks further stack gain.',
    );
  }

  return {
    buffTimeline,
    stackTimeline,
    timelineGeneratedBuffSources,
    freeCastActionIds,
    notes,
  };
}

function findFirstEligibleFreeCastAction(
  config: SimulationConfig,
  abilityActions: RotationAction[],
  readyStartTick: number,
  readyEndTick: number,
): RotationAction | null {
  for (const action of abilityActions) {
    if (action.tick < readyStartTick) {
      continue;
    }

    if (action.tick > readyEndTick) {
      return null;
    }

    const effectiveAbility = resolveEffectiveAbilityDefinition(config, action);
    if (!effectiveAbility) {
      continue;
    }

    if ((effectiveAbility.adrenalineCost ?? 0) > 0) {
      return action;
    }
  }

  return null;
}

function buildRangedHitOccurrences(
  config: SimulationConfig,
  blockedActionIds: ReadonlySet<string>,
  buffTimeline: Record<number, EntityId[]>,
): RangedHitOccurrence[] {
  const occurrences: RangedHitOccurrence[] = [];

  for (const action of [...config.rotationPlan.abilityActions].sort((left, right) => left.tick - right.tick)) {
    if (blockedActionIds.has(action.id)) {
      continue;
    }

    const ability = resolveEffectiveAbilityDefinition(config, action);
    if (!ability) {
      continue;
    }

    const countsForDeathspore =
      ability.style === 'ranged' &&
      !ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime);
    const contributesToPerfectEquilibrium =
      countsForDeathspore && !ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime);

    for (const hit of ability.hitSchedule) {
      const tick = action.tick + hit.tickOffset;
      if (tick < 0 || tick >= config.rotationPlan.tickCount) {
        continue;
      }

      const countsForDeathspore =
        ability.style === 'ranged' &&
        hasDeathsporeArrowsEquippedAtTick(config, tick) &&
        !ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime);
      const contributesToPerfectEquilibrium =
        countsForDeathspore && !ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime);

      occurrences.push({
        tick,
        contributesToPerfectEquilibrium,
        countsForDeathspore,
      });
    }
  }

  occurrences.sort((left, right) => left.tick - right.tick);

  if (!isBolgEquipped(config)) {
    return occurrences;
  }

  let perfectEquilibriumStacks = normalizeStartingPerfectEquilibriumStacks(
    config.rotationPlan.startingStacks?.perfectEquilibriumStacks,
  );

  for (let index = 0; index < occurrences.length; index += 1) {
    const occurrence = occurrences[index];
    if (!occurrence.contributesToPerfectEquilibrium) {
      continue;
    }

    perfectEquilibriumStacks += 1;
    const threshold = buffTimeline[occurrence.tick]?.includes(BALANCE_BY_FORCE_BUFF_ID) ? 4 : 8;
    if (perfectEquilibriumStacks < threshold) {
      continue;
    }

    perfectEquilibriumStacks = 0;
    occurrences.splice(index + 1, 0, {
      tick: occurrence.tick,
      contributesToPerfectEquilibrium: false,
      countsForDeathspore: true,
    });
  }

  return occurrences;
}

function hasDeathsporeArrowsEquippedAtTick(
  config: SimulationConfig,
  tick: number,
): boolean {
  const projectedConfig = projectSimulationConfigAtTick(config, tick);
  const ammoInstance = projectedConfig.gearSetup.ammoSelection ?? projectedConfig.gearSetup.equipment.ammo;
  if (!ammoInstance) {
    return false;
  }

  const definition =
    projectedConfig.gameData.items[ammoInstance.definitionId] ??
    projectedConfig.gameData.ammo[ammoInstance.definitionId];

  return definition?.effectRefs?.includes(DEATHSPORE_EFFECT_REF) ?? false;
}

function isBolgEquipped(config: SimulationConfig): boolean {
  const weapon = config.gearSetup.equipment.weapon;
  if (!weapon) {
    return false;
  }

  return config.gameData.items[weapon.definitionId]?.effectRefs?.includes(BOLG_PASSIVE_EFFECT_REF) ?? false;
}

function createEmptyBuffTimeline(tickCount: number): Record<number, EntityId[]> {
  return Object.fromEntries(Array.from({ length: tickCount }, (_, tick) => [tick, []]));
}

function createEmptyStackTimeline(tickCount: number): Record<number, number> {
  return Object.fromEntries(Array.from({ length: tickCount }, (_, tick) => [tick, 0]));
}

function fillStackRange(
  stackTimeline: Record<number, number>,
  startTick: number,
  endTick: number,
  stacks: number,
  tickCount: number,
): void {
  for (let tick = Math.max(0, startTick); tick <= endTick && tick < tickCount; tick += 1) {
    stackTimeline[tick] = stacks;
  }
}

function markBuffRange(
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
