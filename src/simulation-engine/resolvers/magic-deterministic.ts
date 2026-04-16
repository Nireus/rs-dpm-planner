import type { AbilityDefinition, EntityId, HitDefinition } from '../../game-data/types';
import { CONFIG_OPTION_IDS, EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type { ItemInstanceConfig, SimulationConfig, TimelineGeneratedBuffSource } from '../models';
import { resolveEffectiveAbilityDefinition } from '../abilities/effective-ability';
import {
  applyAbilityTimelineEffects,
  createEmptyBuffTimeline,
} from './ability-timeline-effects';
import {
  consumePendingBuff,
  isPendingBuffActive,
  markPendingMagicBuff,
  resolvePendingMagicCritBuffEndTick,
  type PendingMagicBuff,
} from './magic-buff-state';
import { projectSimulationConfigAtTick } from '../state/projected-gear-state';
import { resolveMagicSpellDefinitionForAction } from '../spells/selected-spell';
import { collectActiveEffectRefs } from '../calculators/active-effect-refs';
import { collectHighestEquippedPerkRank } from '../perks/equipped-perks';
import { advanceChanceAccumulator, createChanceAccumulatorState } from '../utils/chance-accumulator';

export interface DeterministicMagicTimelineResult {
  buffTimeline: Record<number, string[]>;
  adrenalineByTick: number[];
  timelineGeneratedBuffSources: TimelineGeneratedBuffSource[];
  resolvedAbilitiesByActionId: Record<string, AbilityDefinition>;
  actionCritChanceBonusByActionId: Record<string, number>;
  hitCritChanceBonusByActionId: Record<string, Record<string, number>>;
  hitCritDamageBonusByActionId: Record<string, Record<string, number>>;
  hitExpectedCritChanceByActionId: Record<string, Record<string, number>>;
  notes: string[];
}

export function resolveDeterministicMagicTimeline(
  config: SimulationConfig,
  blockedActionIds: ReadonlySet<string> = new Set(),
): DeterministicMagicTimelineResult {
  const buffTimeline = createEmptyBuffTimeline(config.rotationPlan.tickCount);
  const adrenalineByTick = Array.from({ length: config.rotationPlan.tickCount }, () => 0);
  const timelineGeneratedBuffSources: TimelineGeneratedBuffSource[] = [];
  const resolvedAbilitiesByActionId: Record<string, AbilityDefinition> = {};
  const actionCritChanceBonusByActionId: Record<string, number> = {};
  const hitCritChanceBonusByActionId: Record<string, Record<string, number>> = {};
  const hitCritDamageBonusByActionId: Record<string, Record<string, number>> = {};
  const hitExpectedCritChanceByActionId: Record<string, Record<string, number>> = {};
  let nextMagicAbilityCostReduction: PendingMagicBuff | null = null;
  let nextMagicAbilityCritChanceBonus: PendingMagicBuff | null = null;
  let animaChargedUntilTick = -1;
  let glacialEmbraceStacks = 0;
  let glacialEmbraceExpiresAtTick = -1;
  let essenceCorruptionStacks = 0;
  let essenceCorruptionExpiresAtTick = -1;
  let magicCriticalAccumulator = createChanceAccumulatorState();
  let channellersRingCritChanceApplied = false;
  let metaphysicsCritDamageApplied = false;

  for (const action of [...config.rotationPlan.abilityActions].sort((left, right) => left.tick - right.tick)) {
    if (blockedActionIds.has(action.id)) {
      continue;
    }

    const projectedConfig = projectSimulationConfigAtTick(config, action.tick);
    const spell = resolveMagicSpellDefinitionForAction(projectedConfig, action);
    const songOfDestructionActive = hasSongOfDestructionSetEquipped(projectedConfig);
    let ability = resolveEffectiveAbilityDefinition(projectedConfig, action);
    if (ability?.style !== 'magic') {
      continue;
    }

    const hitsMagicTarget = ability.hitSchedule.some((hit) => hit.damage.min > 0 || hit.damage.max > 0);
    const animaChargedActive = action.tick <= animaChargedUntilTick;
    const activeCritBonus = isPendingBuffActive(nextMagicAbilityCritChanceBonus, action.tick)
      ? nextMagicAbilityCritChanceBonus
      : null;
    const critBonusForAction = hitsMagicTarget ? activeCritBonus?.percent ?? 0 : 0;
    if (critBonusForAction > 0) {
      actionCritChanceBonusByActionId[action.id] = critBonusForAction;
      consumePendingBuff(buffTimeline, activeCritBonus?.buffId, action.tick, config.rotationPlan.tickCount);
      nextMagicAbilityCritChanceBonus = null;
    }

    if (ability.adrenalineCost && ability.adrenalineCost > 0) {
      let reductionPercent = 0;
      const activeCostReduction = isPendingBuffActive(nextMagicAbilityCostReduction, action.tick)
        ? nextMagicAbilityCostReduction
        : null;

      if (activeCostReduction) {
        reductionPercent = Math.max(reductionPercent, activeCostReduction.percent);
        consumePendingBuff(buffTimeline, activeCostReduction.buffId, action.tick, config.rotationPlan.tickCount);
        nextMagicAbilityCostReduction = null;
      }

      if (ability.id === 'tsunami' && glacialEmbraceStacks > 0) {
        reductionPercent = Math.max(reductionPercent, glacialEmbraceStacks * 12);
      }

      if (reductionPercent > 0) {
        ability = {
          ...ability,
          adrenalineCost: roundValue(ability.adrenalineCost * (1 - reductionPercent / 100)),
        };
      }
    }

    if (ability.id === 'dragon-breath' && animaChargedActive) {
      ability = {
        ...ability,
        hitSchedule: ability.hitSchedule.map((hit) => ({
          ...hit,
          damage: {
            min: 260,
            max: 310,
          },
        })),
        baseDamage: {
          min: 260,
          max: 310,
        },
      };
      animaChargedUntilTick = -1;
      consumePendingBuff(buffTimeline, 'anima-charged', action.tick, config.rotationPlan.tickCount);
    }

    const selfHitCritBonuses = resolveSelfHitCritBonuses(ability.id, ability.hitSchedule, animaChargedActive);
    const channellersCritChanceBonuses = resolveChannellersRingHitCritChanceBonuses(projectedConfig, ability);
    const channellersCritDamageBonuses = resolveChannellersRingHitCritDamageBonuses(config, action.tick, ability);
    channellersRingCritChanceApplied = channellersRingCritChanceApplied || Object.keys(channellersCritChanceBonuses).length > 0;
    metaphysicsCritDamageApplied = metaphysicsCritDamageApplied || Object.keys(channellersCritDamageBonuses).length > 0;
    const hitCritChanceBonuses = mergeHitBonusMaps(selfHitCritBonuses, channellersCritChanceBonuses);
    if (Object.keys(hitCritChanceBonuses).length > 0) {
      hitCritChanceBonusByActionId[action.id] = hitCritChanceBonuses;
    }
    if (Object.keys(channellersCritDamageBonuses).length > 0) {
      hitCritDamageBonusByActionId[action.id] = channellersCritDamageBonuses;
    }

    resolvedAbilitiesByActionId[action.id] = ability;
    applyAbilityTimelineEffects({
      config,
      action,
      ability,
      buffTimeline,
      adrenalineByTick,
      timelineGeneratedBuffSources,
    });

    if (essenceCorruptionExpiresAtTick >= 0 && action.tick > essenceCorruptionExpiresAtTick) {
      essenceCorruptionStacks = 0;
    }

    if (ability.id === 'combust' && (buffTimeline[action.tick] ?? []).includes('conflagrate')) {
      clearBuffRange(buffTimeline, 'conflagrate', action.tick + 1, config.rotationPlan.tickCount);
    }

    if (spell?.id === 'incite-fear') {
      glacialEmbraceStacks = Math.min(5, glacialEmbraceStacks + 1);
      glacialEmbraceExpiresAtTick = action.tick + 33;
      overwriteStackedBuffRange(
        buffTimeline,
        'glacial-embrace',
        glacialEmbraceStacks,
        action.tick,
        glacialEmbraceExpiresAtTick,
        config.rotationPlan.tickCount,
      );
      appendTimelineGeneratedBuffSourceOnce(timelineGeneratedBuffSources, {
        buffId: 'glacial-embrace',
        sourceType: 'ability',
        sourceId: 'incite-fear',
      });
    } else if (action.tick > glacialEmbraceExpiresAtTick) {
      glacialEmbraceStacks = 0;
    }

    if (songOfDestructionActive && isSongOfDestructionAbility(ability.id)) {
      for (const hit of ability.hitSchedule) {
        const hitTick = action.tick + hit.tickOffset;
        if (hitTick < 0 || hitTick >= config.rotationPlan.tickCount) {
          continue;
        }

        essenceCorruptionStacks = Math.min(100, essenceCorruptionStacks + 1);
        essenceCorruptionExpiresAtTick = hitTick + 49;
        overwriteStackedBuffRange(
          buffTimeline,
          'essence-corruption',
          essenceCorruptionStacks,
          hitTick,
          essenceCorruptionExpiresAtTick,
          config.rotationPlan.tickCount,
        );
      }

      appendTimelineGeneratedBuffSourceOnce(timelineGeneratedBuffSources, {
        buffId: 'essence-corruption',
        sourceType: 'item',
        sourceId: 'ode-to-deceit',
      });
    }

    for (const hit of ability.hitSchedule) {
      const hitTick = action.tick + hit.tickOffset;
      if (hitTick < 0 || hitTick >= config.rotationPlan.tickCount) {
        continue;
      }

      const expectedCritChance = resolveExpectedMagicCriticalStrikeChance(
        config,
        ability,
        hit,
        hitTick,
        buffTimeline,
        critBonusForAction,
        hitCritChanceBonuses[hit.id] ?? 0,
      );
      const criticalProcResult = resolveCriticalProcValue(config, magicCriticalAccumulator, expectedCritChance);
      magicCriticalAccumulator = criticalProcResult.nextAccumulator;
      if (criticalProcResult.procValue > 0) {
        const existing = hitExpectedCritChanceByActionId[action.id] ?? {};
        existing[hit.id] = criticalProcResult.procValue;
        hitExpectedCritChanceByActionId[action.id] = existing;
      }

      const criticalHitAdrenalineGain = resolveMagicCriticalHitAdrenalineGain(
        config,
        ability,
        hitTick,
        buffTimeline,
      );
      if (criticalHitAdrenalineGain > 0 && criticalProcResult.procValue > 0) {
        adrenalineByTick[hitTick] += roundValue(criticalProcResult.procValue * criticalHitAdrenalineGain);
      }
    }

    const pendingCritBuffEndTick = resolvePendingMagicCritBuffEndTick(config.rotationPlan.nonGcdActions, action.tick, config.rotationPlan.tickCount);

    switch (ability.id) {
      case 'runic-charge':
        animaChargedUntilTick = action.tick + 24;
        break;
      case 'sonic-wave':
        nextMagicAbilityCostReduction = {
          percent: animaChargedActive ? 35 : 10,
          buffId: 'flow',
          expiresAtTick: action.tick + 14,
        };
        if (animaChargedActive) {
          animaChargedUntilTick = -1;
          consumePendingBuff(buffTimeline, 'anima-charged', action.tick, config.rotationPlan.tickCount);
        }
        break;
      case 'greater-sonic-wave':
        nextMagicAbilityCostReduction = {
          percent: animaChargedActive ? 45 : 20,
          buffId: 'greater-flow',
          expiresAtTick: action.tick + 14,
        };
        if (animaChargedActive) {
          animaChargedUntilTick = -1;
          consumePendingBuff(buffTimeline, 'anima-charged', action.tick, config.rotationPlan.tickCount);
        }
        break;
      case 'concentrated-blast':
        nextMagicAbilityCritChanceBonus = markPendingMagicBuff({
          buffTimeline,
          timelineGeneratedBuffSources,
          buffId: 'concentrated-blast-critical-strike',
          sourceId: ability.id,
          percent: animaChargedActive ? 45 : 15,
          startTick: action.tick,
          endTick: pendingCritBuffEndTick,
          tickCount: config.rotationPlan.tickCount,
        });
        if (animaChargedActive) {
          animaChargedUntilTick = -1;
          consumePendingBuff(buffTimeline, 'anima-charged', action.tick, config.rotationPlan.tickCount);
        }
        break;
      case 'greater-concentrated-blast':
        nextMagicAbilityCritChanceBonus = markPendingMagicBuff({
          buffTimeline,
          timelineGeneratedBuffSources,
          buffId: 'greater-concentrated-blast-critical-strike',
          sourceId: ability.id,
          percent: animaChargedActive ? 51 : 21,
          startTick: action.tick,
          endTick: pendingCritBuffEndTick,
          tickCount: config.rotationPlan.tickCount,
        });
        if (animaChargedActive) {
          animaChargedUntilTick = -1;
          consumePendingBuff(buffTimeline, 'anima-charged', action.tick, config.rotationPlan.tickCount);
        }
        break;
      default:
        if (songOfDestructionActive && ability.subtype === 'basic' && ability.style === 'magic' && essenceCorruptionStacks >= 25) {
          grantWindowedAdrenaline(adrenalineByTick, action.tick, 6, config.rotationPlan.tickCount);
        }
        break;
    }
  }

  return {
    buffTimeline,
    adrenalineByTick,
    timelineGeneratedBuffSources,
    resolvedAbilitiesByActionId,
    actionCritChanceBonusByActionId,
    hitCritChanceBonusByActionId,
    hitCritDamageBonusByActionId,
    hitExpectedCritChanceByActionId,
    notes: [
      ...(Object.values(buffTimeline).some((buffIds) => buffIds.includes('sunshine-buff') || buffIds.includes('greater-sunshine-buff'))
        ? ['Sunshine and Greater Sunshine: apply their magic damage windows in the simulation. Area damage and planted-feet edge cases remain out of scope.']
        : []),
      ...(Object.values(buffTimeline).some((buffIds) => buffIds.includes('flow') || buffIds.includes('greater-flow'))
        ? ['Flow and Greater Flow: their next-magic-ability adrenaline reduction is applied in the adrenaline timeline and consumed by the discounted cast.']
        : []),
      ...(Object.values(buffTimeline).some((buffIds) => buffIds.includes('anima-charged'))
        ? ['Runic Charge: Sonic Wave, Greater Sonic Wave, Dragon Breath, Concentrated Blast, and Greater Concentrated Blast use their empowered behavior and consume Anima Charged.']
        : []),
      ...(Object.values(buffTimeline).some((buffIds) =>
        buffIds.includes('concentrated-blast-critical-strike') ||
        buffIds.includes('greater-concentrated-blast-critical-strike'))
        ? ['Concentrated Blast and Greater Concentrated Blast: their next-magic-attack critical strike setup is tracked as expected-value crit chance.']
        : []),
      ...(Object.values(buffTimeline).some((buffIds) => buffIds.includes('glacial-embrace'))
        ? ['Incite Fear: Glacial Embrace stacks are tracked and reduce Tsunami adrenaline cost based on the active stack count.']
        : []),
      ...(Object.values(buffTimeline).some((buffIds) => buffIds.includes('tsunami-buff'))
        ? [`Tsunami: magic critical strikes grant additional adrenaline using the ${resolveCriticalHitResolutionMode(config) === 'expected-value' ? 'Expected value' : 'Deterministic build-up'} crit model while the Tsunami buff is active.`]
        : []),
      ...(Object.values(buffTimeline).some((buffIds) => buffIds.includes('instability'))
        ? [`Instability: magic critical strikes on the primary target create Lightning Surge hits one tick later using the ${resolveCriticalHitResolutionMode(config) === 'expected-value' ? 'Expected value' : 'Deterministic build-up'} crit model while a magic weapon is equipped.`]
        : []),
      ...(Object.values(buffTimeline).some((buffIds) => buffIds.includes('essence-corruption'))
        ? ['Song of Destruction: Soulfire, Combust, and Corruption Blast now build Essence Corruption stacks; 10+ stacks add flat magic hit damage, 25+ stacks add basic-adrenaline flow, and the 30% immediate-proc/cooldown-reset effect remains descriptive-only for now.']
        : []),
      ...(channellersRingCritChanceApplied
        ? ["Channeller's ring: magic channelled hits gain stacking critical strike chance from Runic Embrace when the ring is equipped."]
        : []),
      ...(metaphysicsCritDamageApplied
        ? ["Enchantment of metaphysics: after Channeller's ring has been equipped for 9 seconds, magic channelled hits gain stacking critical strike damage. This stacks with Runic Embrace for +6.5% combined crit contribution per hit step."]
        : []),
    ],
  };
}

function resolveChannellersRingHitCritChanceBonuses(
  projectedConfig: SimulationConfig,
  ability: AbilityDefinition,
): Record<string, number> {
  if (!isMagicChanneledAbility(ability) || projectedConfig.gearSetup.equipment.ring?.definitionId !== 'channellers-ring') {
    return {};
  }

  return Object.fromEntries(ability.hitSchedule.map((hit, index) => [hit.id, (index + 1) * 4]));
}

function resolveChannellersRingHitCritDamageBonuses(
  config: SimulationConfig,
  actionTick: number,
  ability: AbilityDefinition,
): Record<string, number> {
  if (!isMagicChanneledAbility(ability)) {
    return {};
  }

  const castProjectedConfig = projectSimulationConfigAtTick(config, actionTick);
  const castRing = castProjectedConfig.gearSetup.equipment.ring;
  if (
    castRing?.definitionId !== 'channellers-ring' ||
    castRing.configValues?.[CONFIG_OPTION_IDS.channellersRingMetaphysicsEnchanted] !== true
  ) {
    return {};
  }

  return Object.fromEntries(
    ability.hitSchedule
      .map((hit, index): [string, number] | null => {
        const hitTick = actionTick + hit.tickOffset;
        const projectedConfig = projectSimulationConfigAtTick(config, hitTick);
        const ring = projectedConfig.gearSetup.equipment.ring;
        if (
          ring?.definitionId !== 'channellers-ring' ||
          ring.configValues?.[CONFIG_OPTION_IDS.channellersRingMetaphysicsEnchanted] !== true
        ) {
          return null;
        }

        const equippedAtTick = resolveChannellersRingEquippedAtTick(config, hitTick);
        if (equippedAtTick === null || hitTick - equippedAtTick < 15) {
          return null;
        }

        return [hit.id, (index + 1) * 2.5];
      })
      .filter((entry): entry is [string, number] => Boolean(entry)),
  );
}

function isMagicChanneledAbility(ability: AbilityDefinition): boolean {
  return ability.style === 'magic' && ability.isChanneled === true;
}

function resolveChannellersRingEquippedAtTick(config: SimulationConfig, hitTick: number): number | null {
  const projectedConfig = projectSimulationConfigAtTick(config, hitTick);
  if (projectedConfig.gearSetup.equipment.ring?.definitionId !== 'channellers-ring') {
    return null;
  }

  const knownInstances = [
    ...Object.values(config.gearSetup.equipment).filter((instance): instance is ItemInstanceConfig => Boolean(instance)),
    ...config.inventory.items,
  ];
  const lastRingSwap = [...config.rotationPlan.nonGcdActions]
    .filter((action) => action.actionType === 'gear-swap' && action.tick < hitTick && action.payload['slot'] === 'ring')
    .sort((left, right) => right.tick - left.tick)
    .find((action) => {
      const instanceId = action.payload['instanceId'];
      return typeof instanceId === 'string' &&
        knownInstances.find((instance) => instance.instanceId === instanceId)?.definitionId === 'channellers-ring';
    });

  if (lastRingSwap) {
    return lastRingSwap.tick + 1;
  }

  return config.gearSetup.equipment.ring?.definitionId === 'channellers-ring' ? 0 : null;
}

function mergeHitBonusMaps(
  left: Record<string, number>,
  right: Record<string, number>,
): Record<string, number> {
  const merged = { ...left };
  for (const [hitId, value] of Object.entries(right)) {
    merged[hitId] = (merged[hitId] ?? 0) + value;
  }

  return merged;
}

function resolveSelfHitCritBonuses(
  abilityId: string,
  hits: HitDefinition[],
  animaChargedActive: boolean,
): Record<string, number> {
  if (abilityId === 'greater-concentrated-blast') {
    const bonuses = animaChargedActive ? [10, 17, 34] : [0, 7, 14];
    return mapHitBonuses(hits, bonuses);
  }

  if (abilityId === 'concentrated-blast') {
    const bonuses = animaChargedActive ? [10, 15, 30] : [0, 5, 10];
    return mapHitBonuses(hits, bonuses);
  }

  return {};
}

function mapHitBonuses(hits: HitDefinition[], bonuses: number[]): Record<string, number> {
  return Object.fromEntries(
    hits
      .map((hit, index): [string, number] => [hit.id, bonuses[index] ?? 0])
      .filter(([, value]) => value > 0),
  );
}

function overwriteStackedBuffRange(
  buffTimeline: Record<number, string[]>,
  buffId: EntityId,
  stackCount: number,
  startTick: number,
  endTick: number,
  tickCount: number,
): void {
  for (let tick = startTick; tick <= endTick; tick += 1) {
    if (tick < 0 || tick >= tickCount) {
      continue;
    }

    buffTimeline[tick] = buffTimeline[tick].filter((existing) => existing !== buffId);
    for (let stack = 0; stack < stackCount; stack += 1) {
      buffTimeline[tick].push(buffId);
    }
  }
}

function clearBuffRange(
  buffTimeline: Record<number, string[]>,
  buffId: EntityId,
  startTick: number,
  tickCount: number,
): void {
  for (let tick = startTick; tick < tickCount; tick += 1) {
    buffTimeline[tick] = buffTimeline[tick].filter((existing) => existing !== buffId);
  }
}

function hasSongOfDestructionSetEquipped(config: SimulationConfig): boolean {
  return config.gearSetup.equipment.weapon?.definitionId === 'roar-of-awakening' &&
    config.gearSetup.equipment.offHand?.definitionId === 'ode-to-deceit';
}

function isSongOfDestructionAbility(abilityId: string): boolean {
  return abilityId === 'combust' || abilityId === 'corruption-blast' || abilityId === 'soulfire';
}

function grantWindowedAdrenaline(
  adrenalineByTick: number[],
  startTick: number,
  totalGain: number,
  tickCount: number,
): void {
  for (let offset = 0; offset < totalGain; offset += 1) {
    const tick = startTick + offset;
    if (tick < 0 || tick >= tickCount) {
      continue;
    }

    adrenalineByTick[tick] += 1;
  }
}

function appendTimelineGeneratedBuffSourceOnce(
  timelineGeneratedBuffSources: TimelineGeneratedBuffSource[],
  entry: TimelineGeneratedBuffSource,
): void {
  if (timelineGeneratedBuffSources.some((existing) => existing.buffId === entry.buffId)) {
    return;
  }

  timelineGeneratedBuffSources.push(entry);
}

function resolveCriticalProcValue(
  config: SimulationConfig,
  accumulator: ReturnType<typeof createChanceAccumulatorState>,
  expectedCritChance: number,
): {
  procValue: number;
  nextAccumulator: ReturnType<typeof createChanceAccumulatorState>;
} {
  if (expectedCritChance <= 0) {
    return {
      procValue: 0,
      nextAccumulator: accumulator,
    };
  }

  if (resolveCriticalHitResolutionMode(config) === 'expected-value') {
    return {
      procValue: expectedCritChance,
      nextAccumulator: accumulator,
    };
  }

  const result = advanceChanceAccumulator(accumulator, expectedCritChance * 100);
  return {
    procValue: result.procCount,
    nextAccumulator: result.nextState,
  };
}

function resolveCriticalHitResolutionMode(config: SimulationConfig) {
  return config.simulationSettings?.criticalHitResolutionMode ?? 'deterministic-accumulator';
}

function resolveExpectedMagicCriticalStrikeChance(
  config: SimulationConfig,
  ability: AbilityDefinition,
  hit: HitDefinition,
  hitTick: number,
  buffTimeline: Record<number, string[]>,
  actionCritChanceBonus: number,
  hitCritChanceBonus: number,
): number {
  if (ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime)) {
    return 0;
  }

  const activeEffectRefs = collectActiveEffectRefs(config, ability, hitTick, buffTimeline);
  const guaranteedCriticalStrikeBonus = activeEffectRefs.includes(EFFECT_REF_IDS.guaranteedCriticalStrikeChance) ? 1 : 0;
  const bitingBonus = activeEffectRefs.includes(EFFECT_REF_IDS.biting)
    ? collectHighestEquippedPerkRank(projectSimulationConfigAtTick(config, hitTick), 'biting') * 0.02
    : 0;
  const effectRefCritChanceBonus = activeEffectRefs.reduce((total, effectRef) => {
    const match = /^critical-strike-chance:\+(\d+(?:\.\d+)?)%$/.exec(effectRef);
    return match ? total + Number.parseFloat(match[1]) / 100 : total;
  }, 0);

  return clampProbability(
    0.1 + guaranteedCriticalStrikeBonus + bitingBonus + effectRefCritChanceBonus + actionCritChanceBonus / 100 + hitCritChanceBonus / 100,
  );
}

function resolveMagicCriticalHitAdrenalineGain(
  config: SimulationConfig,
  ability: AbilityDefinition,
  hitTick: number,
  buffTimeline: Record<number, string[]>,
): number {
  return collectActiveEffectRefs(config, ability, hitTick, buffTimeline)
    .reduce((total, effectRef) => total + parseMagicCriticalHitAdrenalineGain(effectRef), 0);
}

function parseMagicCriticalHitAdrenalineGain(effectRef: string): number {
  const match = /^magic-critical-hit-adrenaline:\+(\d+(?:\.\d+)?)%$/.exec(effectRef);
  return match ? Number.parseFloat(match[1]) : 0;
}

function clampProbability(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundValue(value: number): number {
  return Math.round(value * 100) / 100;
}
