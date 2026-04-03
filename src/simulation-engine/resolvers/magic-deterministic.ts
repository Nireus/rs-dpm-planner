import type { AbilityDefinition, EntityId, HitDefinition } from '../../game-data/types';
import { EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type { SimulationConfig, TimelineGeneratedBuffSource } from '../models';
import { resolveEffectiveAbilityDefinition } from '../abilities/effective-ability';
import {
  applyAbilityTimelineEffects,
  createEmptyBuffTimeline,
} from './ability-timeline-effects';
import { projectSimulationConfigAtTick } from '../state/projected-gear-state';
import { resolveMagicSpellDefinitionForAction } from '../spells/selected-spell';
import { collectActiveEffectRefs } from '../calculators/active-effect-refs';
import { collectHighestEquippedPerkRank } from '../perks/equipped-perks';

export interface DeterministicMagicTimelineResult {
  buffTimeline: Record<number, string[]>;
  adrenalineByTick: number[];
  timelineGeneratedBuffSources: TimelineGeneratedBuffSource[];
  resolvedAbilitiesByActionId: Record<string, AbilityDefinition>;
  actionCritChanceBonusByActionId: Record<string, number>;
  hitCritChanceBonusByActionId: Record<string, Record<string, number>>;
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
  const hitExpectedCritChanceByActionId: Record<string, Record<string, number>> = {};
  let nextMagicAbilityCostReductionPercent = 0;
  let nextMagicAbilityCritChanceBonus = 0;
  let animaChargedUntilTick = -1;
  let glacialEmbraceStacks = 0;
  let glacialEmbraceExpiresAtTick = -1;
  let essenceCorruptionStacks = 0;
  let essenceCorruptionExpiresAtTick = -1;

  for (const action of [...config.rotationPlan.abilityActions].sort((left, right) => left.tick - right.tick)) {
    if (blockedActionIds.has(action.id)) {
      continue;
    }

    const projectedConfig = projectSimulationConfigAtTick(config, action.tick);
    const spell = resolveMagicSpellDefinitionForAction(projectedConfig, action);
    const songOfDestructionActive = hasSongOfDestructionSetEquipped(projectedConfig);
    let ability = resolveEffectiveAbilityDefinition(config, action);
    if (ability?.style !== 'magic') {
      continue;
    }

    const hitsMagicTarget = ability.hitSchedule.some((hit) => hit.damage.min > 0 || hit.damage.max > 0);
    const animaChargedActive = action.tick <= animaChargedUntilTick;
    const critBonusForAction = hitsMagicTarget ? nextMagicAbilityCritChanceBonus : 0;
    if (critBonusForAction > 0) {
      actionCritChanceBonusByActionId[action.id] = critBonusForAction;
      nextMagicAbilityCritChanceBonus = 0;
    }

    if (ability.adrenalineCost && ability.adrenalineCost > 0) {
      let reductionPercent = 0;

      if (nextMagicAbilityCostReductionPercent > 0) {
        reductionPercent = Math.max(reductionPercent, nextMagicAbilityCostReductionPercent);
        nextMagicAbilityCostReductionPercent = 0;
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
    }

    const selfHitCritBonuses = resolveSelfHitCritBonuses(ability.id, ability.hitSchedule, animaChargedActive);
    if (Object.keys(selfHitCritBonuses).length > 0) {
      hitCritChanceBonusByActionId[action.id] = selfHitCritBonuses;
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
        selfHitCritBonuses[hit.id] ?? 0,
      );
      if (expectedCritChance > 0) {
        const existing = hitExpectedCritChanceByActionId[action.id] ?? {};
        existing[hit.id] = expectedCritChance;
        hitExpectedCritChanceByActionId[action.id] = existing;
      }

      if ((buffTimeline[hitTick] ?? []).includes('tsunami-buff')) {
        adrenalineByTick[hitTick] += roundValue(
          expectedCritChance * 8,
        );
      }
    }

    switch (ability.id) {
      case 'runic-charge':
        animaChargedUntilTick = action.tick + 24;
        break;
      case 'sonic-wave':
        nextMagicAbilityCostReductionPercent = animaChargedActive ? 35 : 10;
        if (animaChargedActive) {
          animaChargedUntilTick = -1;
        }
        break;
      case 'greater-sonic-wave':
        nextMagicAbilityCostReductionPercent = animaChargedActive ? 45 : 20;
        if (animaChargedActive) {
          animaChargedUntilTick = -1;
        }
        break;
      case 'concentrated-blast':
        nextMagicAbilityCritChanceBonus = animaChargedActive ? 45 : 15;
        if (animaChargedActive) {
          animaChargedUntilTick = -1;
        }
        break;
      case 'greater-concentrated-blast':
        nextMagicAbilityCritChanceBonus = animaChargedActive ? 51 : 21;
        if (animaChargedActive) {
          animaChargedUntilTick = -1;
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
    hitExpectedCritChanceByActionId,
    notes: [
      ...(Object.values(buffTimeline).some((buffIds) => buffIds.includes('sunshine-buff') || buffIds.includes('greater-sunshine-buff'))
        ? ['Sunshine and Greater Sunshine: apply their magic damage windows in the simulation. Area damage and planted-feet edge cases remain out of scope.']
        : []),
      ...(Object.values(buffTimeline).some((buffIds) => buffIds.includes('flow') || buffIds.includes('greater-flow'))
        ? ['Flow and Greater Flow: their next-magic-ability adrenaline reduction is now applied in the adrenaline timeline.']
        : []),
      ...(Object.values(buffTimeline).some((buffIds) => buffIds.includes('anima-charged'))
        ? ['Runic Charge: Sonic Wave, Greater Sonic Wave, Dragon Breath, Concentrated Blast, and Greater Concentrated Blast now use their empowered milestone behavior.']
        : []),
      ...(Object.values(buffTimeline).some((buffIds) => buffIds.includes('glacial-embrace'))
        ? ['Incite Fear: Glacial Embrace stacks are tracked and reduce Tsunami adrenaline cost based on the active stack count.']
        : []),
      ...(Object.values(buffTimeline).some((buffIds) => buffIds.includes('instability'))
        ? ['Instability: magic critical strikes on the primary target now create expected-value Lightning Surge hits one tick later while a magic weapon is equipped.']
        : []),
      ...(Object.values(buffTimeline).some((buffIds) => buffIds.includes('essence-corruption'))
        ? ['Song of Destruction: Soulfire, Combust, and Corruption Blast now build Essence Corruption stacks; 10+ stacks add flat magic hit damage, 25+ stacks add basic-adrenaline flow, and the 30% immediate-proc/cooldown-reset effect remains descriptive-only for now.']
        : []),
    ],
  };
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

function clampProbability(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundValue(value: number): number {
  return Math.round(value * 100) / 100;
}
