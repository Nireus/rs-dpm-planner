import type { EntityId } from '../../game-data/types';
import { EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type { RotationAction, SimulationConfig, ValidationIssue } from '../models';
import { resolveEffectiveAbilityDefinition } from '../abilities/effective-ability';
import { collectHighestEquippedPerkRank } from '../perks/equipped-perks';
import { projectSimulationConfigAtTick } from '../state/projected-gear-state';
import { advanceChanceAccumulator, createChanceAccumulatorState } from '../utils/chance-accumulator';
import { resolveDeathsporeTimeline } from './deathspore';
import { resolveDeterministicRangedTimeline } from './ranged-deterministic';

export const MIN_ADRENALINE = 0;
export const MAX_ADRENALINE = 100;
export const HEIGHTENED_SENSES_MAX_ADRENALINE = 110;
const FURY_OF_THE_SMALL_EFFECT_REF = EFFECT_REF_IDS.furyOfTheSmall;
const HEIGHTENED_SENSES_EFFECT_REF = EFFECT_REF_IDS.heightenedSenses;
const CONSERVATION_OF_ENERGY_EFFECT_REF = EFFECT_REF_IDS.conservationOfEnergy;

export interface AdrenalineTickState {
  tick: number;
  valueAtTickStart: number;
  valueAtTickEnd: number;
  actionsResolved: string[];
}

export interface AdrenalineTimelineResult {
  startingAdrenaline: number;
  adrenalineTimeline: number[];
  tickStates: AdrenalineTickState[];
  validationIssues: ValidationIssue[];
}

export function resolveAdrenalineTimeline(
  config: SimulationConfig,
  blockedActionIds: ReadonlySet<string> = new Set(),
): AdrenalineTimelineResult {
  const abilityActions = [...config.rotationPlan.abilityActions].sort((left, right) => left.tick - right.tick);
  const validationIssues: ValidationIssue[] = [];
  const tickStates: AdrenalineTickState[] = [];
  const adrenalineTimeline: number[] = [];
  const groupedActions = groupAbilityActionsByTick(abilityActions);
  const deterministicRangedTimeline = resolveDeterministicRangedTimeline(config, blockedActionIds);
  const deathsporeTimeline = resolveDeathsporeTimeline(
    config,
    blockedActionIds,
    deterministicRangedTimeline.buffTimeline,
  );
  let currentAdrenaline = clampAdrenaline(config, config.rotationPlan.startingAdrenaline);
  let impatientAccumulator = createChanceAccumulatorState();

  if (currentAdrenaline !== config.rotationPlan.startingAdrenaline) {
    validationIssues.push({
      code: 'adrenaline.starting_out_of_bounds',
      severity: 'warning',
      tick: 0,
      message: `Starting adrenaline ${config.rotationPlan.startingAdrenaline}% was clamped to ${currentAdrenaline}%.`,
    });
  }

  for (let tick = 0; tick < config.rotationPlan.tickCount; tick += 1) {
    const actionsAtTick = groupedActions.get(tick) ?? [];
    const valueAtTickStart = currentAdrenaline;
    const actionsResolved: string[] = [];

    for (const action of actionsAtTick) {
      const result = resolveAbilityActionAdrenaline(
        config,
        action,
        currentAdrenaline,
        deathsporeTimeline.freeCastActionIds.has(action.id),
        impatientAccumulator,
      );

      if (result.issue) {
        validationIssues.push(result.issue);
        continue;
      }

      currentAdrenaline = result.nextAdrenaline;
      impatientAccumulator = result.nextImpatientAccumulator ?? impatientAccumulator;
      actionsResolved.push(action.id);
    }

    currentAdrenaline = clampAdrenaline(
      config,
      currentAdrenaline + (deterministicRangedTimeline.adrenalineByTick[tick] ?? 0),
    );
    adrenalineTimeline.push(currentAdrenaline);
    tickStates.push({
      tick,
      valueAtTickStart,
      valueAtTickEnd: currentAdrenaline,
      actionsResolved,
    });
  }

  return {
    startingAdrenaline: currentAdrenalineForTimeline(config, config.rotationPlan.startingAdrenaline),
    adrenalineTimeline,
    tickStates,
    validationIssues,
  };
}

interface ResolveAbilityActionAdrenalineResult {
  nextAdrenaline: number;
  nextImpatientAccumulator?: ReturnType<typeof createChanceAccumulatorState>;
  issue?: ValidationIssue;
}

function resolveAbilityActionAdrenaline(
  config: SimulationConfig,
  action: RotationAction,
  currentAdrenaline: number,
  usesDeathsporeFreeCast: boolean,
  impatientAccumulator: ReturnType<typeof createChanceAccumulatorState>,
): ResolveAbilityActionAdrenalineResult {
  const projectedConfig = projectSimulationConfigAtTick(config, action.tick);
  const ability = resolveEffectiveAbilityDefinition(projectedConfig, action);

  if (!ability) {
    return {
      nextAdrenaline: currentAdrenaline,
      issue: createAdrenalineIssue(
        action,
        'ability.invalid_payload',
        'Ability action is missing abilityId or references an unknown ability.',
      ),
    };
  }

  const adrenalineCost = Math.max(ability.adrenalineCost ?? 0, 0);
  const effectiveAdrenalineCost = usesDeathsporeFreeCast ? 0 : adrenalineCost;
  const adrenalineGain = Math.max(ability.adrenalineGain ?? 0, 0) +
    resolveAdrenalineGainBonus(projectedConfig, ability, impatientAccumulator);

  if (adrenalineCost > currentAdrenaline) {
    return {
      nextAdrenaline: currentAdrenaline,
      issue: createAdrenalineIssue(
        action,
        'ability.insufficient_adrenaline',
        `Ability "${ability.name}" requires ${adrenalineCost}% adrenaline but only ${currentAdrenaline}% is available.`,
      ),
    };
  }

  return {
    nextAdrenaline: clampAdrenaline(config, currentAdrenaline - effectiveAdrenalineCost + adrenalineGain),
    nextImpatientAccumulator: resolveNextImpatientAccumulator(projectedConfig, ability, impatientAccumulator),
  };
}

function resolveAdrenalineGainBonus(
  config: SimulationConfig,
  ability: { subtype: string; adrenalineGain?: number },
  impatientAccumulator: ReturnType<typeof createChanceAccumulatorState>,
): number {
  const activeRelicIds = config.persistentBuffConfig.relicIds ?? [];
  const hasRelicEffect = (effectRef: string) => activeRelicIds.some((relicId) =>
    config.gameData.relics[relicId]?.effectRefs?.includes(effectRef),
  );

  let bonus = 0;

  if (ability.subtype === 'basic') {
    const baseAdrenalineGain = Math.max(ability.adrenalineGain ?? 0, 0);
    const furyBonus = hasRelicEffect(FURY_OF_THE_SMALL_EFFECT_REF) ? 1 : 0;
    bonus += furyBonus;

    const invigoratingRank = collectHighestEquippedPerkRank(config, 'invigorating');
    if (invigoratingRank > 0) {
      bonus += roundAdrenalineValue((baseAdrenalineGain + furyBonus) * invigoratingRank * 0.05);
    }

    const impatientRank = collectHighestEquippedPerkRank(config, 'impatient');
    if (impatientRank > 0) {
      const impatientResult = advanceChanceAccumulator(impatientAccumulator, impatientRank * 9);
      bonus += impatientResult.procCount * 3;
    }
  }

  if (ability.subtype === 'ultimate' && hasRelicEffect(CONSERVATION_OF_ENERGY_EFFECT_REF)) {
    bonus += 10;
  }

  return bonus;
}

function resolveNextImpatientAccumulator(
  config: SimulationConfig,
  ability: { subtype: string },
  impatientAccumulator: ReturnType<typeof createChanceAccumulatorState>,
): ReturnType<typeof createChanceAccumulatorState> {
  if (ability.subtype !== 'basic') {
    return impatientAccumulator;
  }

  const impatientRank = collectHighestEquippedPerkRank(config, 'impatient');
  if (impatientRank <= 0) {
    return impatientAccumulator;
  }

  return advanceChanceAccumulator(impatientAccumulator, impatientRank * 9).nextState;
}

function groupAbilityActionsByTick(actions: RotationAction[]): Map<number, RotationAction[]> {
  const grouped = new Map<number, RotationAction[]>();

  for (const action of actions) {
    const bucket = grouped.get(action.tick);
    if (bucket) {
      bucket.push(action);
    } else {
      grouped.set(action.tick, [action]);
    }
  }

  return grouped;
}

function currentAdrenalineForTimeline(
  config: Pick<SimulationConfig, 'persistentBuffConfig' | 'gameData'>,
  startingAdrenaline: number,
): number {
  return clampAdrenaline(config, startingAdrenaline);
}

export function resolveMaxAdrenaline(config: Pick<SimulationConfig, 'persistentBuffConfig' | 'gameData'>): number {
  const activeRelicIds = config.persistentBuffConfig.relicIds ?? [];
  const hasHeightenedSenses = activeRelicIds.some((relicId) =>
    config.gameData.relics[relicId]?.effectRefs?.includes(HEIGHTENED_SENSES_EFFECT_REF),
  );

  return hasHeightenedSenses ? HEIGHTENED_SENSES_MAX_ADRENALINE : MAX_ADRENALINE;
}

function clampAdrenaline(
  config: Pick<SimulationConfig, 'persistentBuffConfig' | 'gameData'>,
  value: number,
): number {
  return Math.max(MIN_ADRENALINE, Math.min(resolveMaxAdrenaline(config), value));
}

function createAdrenalineIssue(
  action: RotationAction,
  code: string,
  message: string,
): ValidationIssue {
  return {
    code,
    severity: 'error',
    tick: action.tick,
    relatedActionId: action.id,
    message,
  };
}

function roundAdrenalineValue(value: number): number {
  return Math.round(value * 100) / 100;
}
