import type { DamageRange, EntityId, HitDefinition } from '../../game-data/types';
import { EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type { DamageSummary, RotationAction, SimulationConfig } from '../models';
import { resolveEffectiveAbilityDefinition } from '../abilities/effective-ability';
import { roundDamageValue } from './damage-summary';

export const PERFECT_EQUILIBRIUM_ABILITY_ID = 'perfect-equilibrium';

export interface SimulationHitEvent {
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
  derivedDamageParts?: {
    scaledAbilityDamage: DamageSummary;
    inheritedTriggerDamage: DamageSummary;
  };
}

export function buildSimulationHitEvents(
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
      !ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime);

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

export function createPerfectEquilibriumHitEvent(
  sourceEvent: SimulationHitEvent,
  triggeringDamage: DamageSummary,
  abilityDamage: number,
  _multiplicativeAbilityDamageMultiplier = 1,
): SimulationHitEvent {
  const inheritedEffectRefs = sourceEvent.ability.effectRefs?.includes(EFFECT_REF_IDS.guaranteedCriticalStrikeChance)
    ? [EFFECT_REF_IDS.guaranteedCriticalStrikeChance]
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
      damage: buildPerfectEquilibriumDamageRange(
        triggeringDamage,
        abilityDamage,
        _multiplicativeAbilityDamageMultiplier,
      ),
      tags: ['derived-hit', 'direct-damage'],
    },
    tick: sourceEvent.tick,
    contributesToPerfectEquilibrium: false,
    derivedDamageParts: buildPerfectEquilibriumDerivedDamageParts(
      triggeringDamage,
      abilityDamage,
      _multiplicativeAbilityDamageMultiplier,
    ),
  };
}

function buildPerfectEquilibriumDamageRange(
  triggeringDamage: DamageSummary,
  abilityDamage: number,
  multiplicativeAbilityDamageMultiplier: number,
): DamageRange {
  const min = roundDamageValue(
    (12 / 100) * abilityDamage * multiplicativeAbilityDamageMultiplier + (33 / 100) * triggeringDamage.min,
  );
  const max = roundDamageValue(
    (16 / 100) * abilityDamage * multiplicativeAbilityDamageMultiplier + (37 / 100) * triggeringDamage.max,
  );

  return {
    min,
    max,
  };
}

function buildPerfectEquilibriumDerivedDamageParts(
  triggeringDamage: DamageSummary,
  abilityDamage: number,
  _multiplicativeAbilityDamageMultiplier: number,
): {
  scaledAbilityDamage: DamageSummary;
  inheritedTriggerDamage: DamageSummary;
} {
  const scaledAbilityDamage = {
    min: roundDamageValue((12 / 100) * abilityDamage),
    avg: roundDamageValue((14 / 100) * abilityDamage),
    max: roundDamageValue((16 / 100) * abilityDamage),
  };
  const inheritedTriggerDamage = {
    min: roundDamageValue((33 / 100) * triggeringDamage.min),
    avg: roundDamageValue((35 / 100) * triggeringDamage.avg),
    max: roundDamageValue((37 / 100) * triggeringDamage.max),
  };

  return {
    scaledAbilityDamage,
    inheritedTriggerDamage,
  };
}
