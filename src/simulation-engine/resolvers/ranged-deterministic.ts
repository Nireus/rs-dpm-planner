import { EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type { EntityId } from '../../game-data/types';
import type { RotationAction, SimulationConfig, TimelineGeneratedBuffSource } from '../models';
import {
  ADRENALINE_POTION_ACTION_TYPE,
  ADRENALINE_POTION_COOLDOWN_BUFF_ID,
  ADRENALINE_POTION_COOLDOWN_TICKS,
  ADRENALINE_RENEWAL_BUFF_ID,
  ADRENALINE_RENEWAL_DURATION_TICKS,
  getAdrenalinePotionVariant,
} from '../actions/adrenaline-potions';
import { resolveEffectiveAbilityDefinition } from '../abilities/effective-ability';
import {
  parsePerfectEquilibriumThreshold,
  parseRangedHitAdrenalineGain,
} from '../buffs/buff-effect-refs';
import { projectSimulationConfigAtTick } from '../state/projected-gear-state';
import {
  applyAbilityTimelineEffects,
  createEmptyBuffTimeline,
  markBuffRange,
} from './ability-timeline-effects';

const DRACOLICH_SET_EFFECT = EFFECT_REF_IDS.dracolichSet;
const ELITE_DRACOLICH_SET_EFFECT = EFFECT_REF_IDS.eliteDracolichSet;
const DRACOLICH_INFUSION_BUFF_ID = 'dracolich-infusion';
const ELITE_DRACOLICH_INFUSION_BUFF_ID = 'elite-dracolich-infusion';
const BALANCE_BY_FORCE_BUFF_ID = 'balance-by-force-buff';
const DEATHS_SWIFTNESS_BUFF_ID = 'deaths-swiftness-buff';
const SEARING_WINDS_BUFF_ID = 'searing-winds';
const SHADOW_IMBUED_BUFF_ID = 'shadow-imbued';
const SPLIT_SOUL_BUFF_ID = 'split-soul';
const VULNERABILITY_BOMB_ACTION_TYPE = 'vulnerability-bomb';
const VULNERABILITY_BOMB_AREA_BUFF_ID = 'vulnerability-bomb-area';
const VULNERABILITY_DEBUFF_BUFF_ID = 'vulnerability';
const VULNERABILITY_BOMB_TRAVEL_DELAY_TICKS = 3;
const VULNERABILITY_BOMB_AREA_DURATION_TICKS = 3;
const VULNERABILITY_DEBUFF_DURATION_TICKS = 100;
const RAPID_FIRE_CHANNEL_EFFECT_REF = 'rapid-fire-channel';
const PERFECT_EQUILIBRIUM_DEFAULT_THRESHOLD = 8;

export interface DeterministicRangedTimelineResult {
  adrenalineByTick: Record<number, number>;
  buffTimeline: Record<number, EntityId[]>;
  timelineGeneratedBuffSources: TimelineGeneratedBuffSource[];
  notes: string[];
}

export function resolveDeterministicRangedTimeline(
  config: SimulationConfig,
  blockedActionIds: ReadonlySet<string> = new Set(),
): DeterministicRangedTimelineResult {
  const adrenalineByTick = createEmptyAdrenalineTimeline(config.rotationPlan.tickCount);
  const buffTimeline = createEmptyBuffTimeline(config.rotationPlan.tickCount);
  const timelineGeneratedBuffSources: TimelineGeneratedBuffSource[] = [];
  const notes: string[] = [];
  const dracolichInfo = resolveDracolichSetInfo(config);
  let generatedVulnerabilityBomb = false;
  let generatedAdrenalinePotionCooldown = false;
  let generatedAdrenalineRenewal = false;

  for (const action of [...config.rotationPlan.nonGcdActions].sort((left, right) => left.tick - right.tick)) {
    if (blockedActionIds.has(action.id)) {
      continue;
    }

    if (action.actionType === VULNERABILITY_BOMB_ACTION_TYPE) {
      applyVulnerabilityBombBuffs(config, action, buffTimeline);
      generatedVulnerabilityBomb = true;
    }

    if (action.actionType === ADRENALINE_POTION_ACTION_TYPE) {
      const result = applyAdrenalinePotionBuffs(config, action, buffTimeline);
      generatedAdrenalinePotionCooldown ||= result.generatedCooldown;
      generatedAdrenalineRenewal ||= result.generatedRenewal;
    }
  }

  for (const action of [...config.rotationPlan.abilityActions].sort((left, right) => left.tick - right.tick)) {
    if (blockedActionIds.has(action.id)) {
      continue;
    }

    const effectiveAbility = resolveEffectiveAbilityDefinition(config, action);
    applyAbilityTimelineEffects({
      config,
      action,
      ability: effectiveAbility,
      buffTimeline,
      timelineGeneratedBuffSources,
    });

    if (!dracolichInfo || !isRapidFireAbility(effectiveAbility)) {
      continue;
    }

    applyRapidFireDracolichAdrenaline(config, action, effectiveAbility, dracolichInfo, adrenalineByTick);
    applyRapidFireDracolichInfusion(config, action, effectiveAbility, dracolichInfo, buffTimeline);
  }

  applyTimelineHitAdrenaline(config, blockedActionIds, buffTimeline, adrenalineByTick);

  if (dracolichInfo && Object.values(adrenalineByTick).some((value) => value > 0)) {
    notes.push(
      `${dracolichInfo.label}: Rapid Fire grants ${(dracolichInfo.pieces * dracolichInfo.adrenalinePerPiecePerTick).toFixed(1)}% extra adrenaline per tick while channeling.`,
    );
  }

  if (dracolichInfo && Object.values(buffTimeline).some((buffIds) => buffIds.includes(dracolichInfo.infusionBuffId))) {
    timelineGeneratedBuffSources.push({
      buffId: dracolichInfo.infusionBuffId,
      sourceType: 'item',
      sourceId: dracolichInfo.effectRef,
    });
    notes.push(
      `${dracolichInfo.label}: fully channeling Rapid Fire generates ${dracolichInfo.infusionLabel} for ${dracolichInfo.infusionDurationTicks} ticks starting on the tick after the channel finishes.`,
    );
  }

  if (Object.values(buffTimeline).some((buffIds) => buffIds.includes(DEATHS_SWIFTNESS_BUFF_ID))) {
    notes.push("Death's Swiftness: applies a 63-tick ranged damage buff starting on the cast tick.");
  }

  if (Object.values(buffTimeline).some((buffIds) => buffIds.includes(BALANCE_BY_FORCE_BUFF_ID))) {
    notes.push('Balance by Force: applies a 50-tick buff starting on the cast tick, lowering Perfect Equilibrium to 4 stacks.');
  }

  if (Object.values(buffTimeline).some((buffIds) => buffIds.includes(SEARING_WINDS_BUFF_ID))) {
    notes.push(
      'Searing Winds: Galeshot applies a 10-tick buff starting on the cast tick, and each Rapid Fire hit extends it by 1 tick when active on cast.',
    );
  }

  if (Object.values(buffTimeline).some((buffIds) => buffIds.includes(SHADOW_IMBUED_BUFF_ID))) {
    notes.push(
      'Shadow Imbued: Imbue: Shadows applies a 50-tick buff starting on the cast tick, and Shadow Tendrils extends it by 6 ticks.',
    );
  }

  if (Object.values(buffTimeline).some((buffIds) => buffIds.includes(SPLIT_SOUL_BUFF_ID))) {
    notes.push(
      'Split Soul: for 25 ticks, qualifying hits create a separate damage splat on the same tick. The effect ends early if the main-hand weapon is changed.',
    );
  }

  if (generatedVulnerabilityBomb) {
    timelineGeneratedBuffSources.push({
      buffId: VULNERABILITY_BOMB_AREA_BUFF_ID,
      sourceType: 'item',
      sourceId: VULNERABILITY_DEBUFF_BUFF_ID,
    });
    timelineGeneratedBuffSources.push({
      buffId: VULNERABILITY_DEBUFF_BUFF_ID,
      sourceType: 'item',
      sourceId: VULNERABILITY_DEBUFF_BUFF_ID,
    });
    notes.push(
      'Vulnerability Bomb: 3 ticks after the throw it creates a 3-tick area, and the resulting debuff lasts 100 ticks.',
    );
  }

  if (generatedAdrenalinePotionCooldown) {
    timelineGeneratedBuffSources.push({
      buffId: ADRENALINE_POTION_COOLDOWN_BUFF_ID,
      sourceType: 'item',
      sourceId: ADRENALINE_POTION_COOLDOWN_BUFF_ID,
    });
    notes.push('Adrenaline potions share a 200-tick cooldown starting on the drink tick.');
  }

  if (generatedAdrenalineRenewal) {
    timelineGeneratedBuffSources.push({
      buffId: ADRENALINE_RENEWAL_BUFF_ID,
      sourceType: 'item',
      sourceId: ADRENALINE_RENEWAL_BUFF_ID,
    });
    notes.push('Adrenaline Renewal: applies a 10-tick buff starting on the drink tick and grants 4% adrenaline on each active tick.');
  }

  return {
    adrenalineByTick,
    buffTimeline,
    timelineGeneratedBuffSources,
    notes,
  };
}

function applyVulnerabilityBombBuffs(
  config: SimulationConfig,
  action: RotationAction,
  buffTimeline: Record<number, EntityId[]>,
): void {
  const areaStartTick = action.tick + VULNERABILITY_BOMB_TRAVEL_DELAY_TICKS;
  const areaEndTick = areaStartTick + VULNERABILITY_BOMB_AREA_DURATION_TICKS - 1;
  const debuffEndTick = areaStartTick + VULNERABILITY_DEBUFF_DURATION_TICKS - 1;

  markBuffRange(
    buffTimeline,
    VULNERABILITY_BOMB_AREA_BUFF_ID,
    areaStartTick,
    areaEndTick,
    config.rotationPlan.tickCount,
  );

  markBuffRange(
    buffTimeline,
    VULNERABILITY_DEBUFF_BUFF_ID,
    areaStartTick,
    debuffEndTick,
    config.rotationPlan.tickCount,
  );
}

function applyAdrenalinePotionBuffs(
  config: SimulationConfig,
  action: RotationAction,
  buffTimeline: Record<number, EntityId[]>,
): {
  generatedCooldown: boolean;
  generatedRenewal: boolean;
} {
  const variant = getAdrenalinePotionVariant(readStringPayload(action, 'variantId'));
  if (!variant) {
    return {
      generatedCooldown: false,
      generatedRenewal: false,
    };
  }

  markBuffRange(
    buffTimeline,
    ADRENALINE_POTION_COOLDOWN_BUFF_ID,
    action.tick,
    action.tick + ADRENALINE_POTION_COOLDOWN_TICKS - 1,
    config.rotationPlan.tickCount,
  );

  if (!variant.grantsRenewal) {
    return {
      generatedCooldown: true,
      generatedRenewal: false,
    };
  }

  markBuffRange(
    buffTimeline,
    ADRENALINE_RENEWAL_BUFF_ID,
    action.tick,
    action.tick + ADRENALINE_RENEWAL_DURATION_TICKS - 1,
    config.rotationPlan.tickCount,
  );

  return {
    generatedCooldown: true,
    generatedRenewal: true,
  };
}

interface DracolichSetInfo {
  effectRef: string;
  label: string;
  pieces: number;
  adrenalinePerPiecePerTick: number;
  infusionBuffId: EntityId;
  infusionLabel: string;
  infusionDurationTicks: number;
}

function resolveDracolichSetInfo(config: SimulationConfig): DracolichSetInfo | null {
  const regularPieces = countPiecesWithEffect(config, DRACOLICH_SET_EFFECT);
  const elitePieces = countPiecesWithEffect(config, ELITE_DRACOLICH_SET_EFFECT);

  if (regularPieces === 0 && elitePieces === 0) {
    return null;
  }

  const useElite = elitePieces >= regularPieces;
  const pieces = useElite ? elitePieces : regularPieces;

  return {
    effectRef: useElite ? ELITE_DRACOLICH_SET_EFFECT : DRACOLICH_SET_EFFECT,
    label: useElite ? 'Elite Dracolich Remnant' : 'Dracolich Remnant',
    pieces,
    adrenalinePerPiecePerTick: useElite ? 0.5 : 0.2,
    infusionBuffId: useElite ? ELITE_DRACOLICH_INFUSION_BUFF_ID : DRACOLICH_INFUSION_BUFF_ID,
    infusionLabel: useElite ? 'Elite Dracolich infusion' : 'Dracolich infusion',
    infusionDurationTicks: calculateInfusionDurationTicks(pieces),
  };
}

function countPiecesWithEffect(config: SimulationConfig, effectRef: string): number {
  return Object.values(config.gearSetup.equipment).reduce((count, instance) => {
    if (!instance) {
      return count;
    }

    const definition = config.gameData.items[instance.definitionId];
    return definition?.effectRefs?.includes(effectRef) ? count + 1 : count;
  }, 0);
}

function calculateInfusionDurationTicks(pieces: number): number {
  if (pieces < 3) {
    return 0;
  }

  let durationTicks = 5;
  if (pieces >= 4) {
    durationTicks += 3;
  }
  if (pieces >= 5) {
    durationTicks += 3;
  }

  return durationTicks;
}

function applyRapidFireDracolichAdrenaline(
  config: SimulationConfig,
  action: RotationAction,
  ability: NonNullable<ReturnType<typeof resolveEffectiveAbilityDefinition>>,
  dracolichInfo: DracolichSetInfo,
  adrenalineByTick: Record<number, number>,
): void {
  if (!ability.isChanneled || !ability.channelDurationTicks || dracolichInfo.pieces <= 0) {
    return;
  }

  const gainPerTick = dracolichInfo.pieces * dracolichInfo.adrenalinePerPiecePerTick;
  for (let offset = 0; offset < ability.channelDurationTicks; offset += 1) {
    const tick = action.tick + offset;
    if (tick < 0 || tick >= config.rotationPlan.tickCount) {
      continue;
    }

    adrenalineByTick[tick] += gainPerTick;
  }
}

function applyRapidFireDracolichInfusion(
  config: SimulationConfig,
  action: RotationAction,
  ability: NonNullable<ReturnType<typeof resolveEffectiveAbilityDefinition>>,
  dracolichInfo: DracolichSetInfo,
  buffTimeline: Record<number, EntityId[]>,
): void {
  if (!ability.isChanneled || !ability.channelDurationTicks || dracolichInfo.infusionDurationTicks <= 0 || !isBowEquipped(config)) {
    return;
  }

  const buffStartTick = action.tick + ability.channelDurationTicks + 1;
  if (buffStartTick >= config.rotationPlan.tickCount) {
    return;
  }

  markBuffRange(
    buffTimeline,
    dracolichInfo.infusionBuffId,
    buffStartTick,
    buffStartTick + dracolichInfo.infusionDurationTicks - 1,
    config.rotationPlan.tickCount,
  );
}

function applyTimelineHitAdrenaline(
  config: SimulationConfig,
  blockedActionIds: ReadonlySet<string>,
  buffTimeline: Record<number, EntityId[]>,
  adrenalineByTick: Record<number, number>,
): void {
  const abilityActions = [...config.rotationPlan.abilityActions].sort((left, right) => left.tick - right.tick);
  let perfectEquilibriumStacks = 0;

  for (const action of abilityActions) {
    if (blockedActionIds.has(action.id)) {
      continue;
    }

    const ability = resolveEffectiveAbilityDefinition(config, action);
    if (!ability || ability.style !== 'ranged' || ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime)) {
      continue;
    }

    for (const hit of ability.hitSchedule) {
      const hitTick = action.tick + hit.tickOffset;
      if (hitTick < 0 || hitTick >= config.rotationPlan.tickCount) {
        continue;
      }

      const hitAdrenaline = resolveTimelineHitAdrenalineGain(config, buffTimeline[hitTick] ?? []);
      if (hitAdrenaline > 0) {
        adrenalineByTick[hitTick] += hitAdrenaline;
      }

      const projectedConfig = projectSimulationConfigAtTick(config, hitTick);
      if (!hasBolgEquipped(projectedConfig)) {
        continue;
      }

      perfectEquilibriumStacks += 1;
      const perfectEquilibriumThreshold = resolvePerfectEquilibriumThreshold(config, buffTimeline[hitTick] ?? []);
      if (perfectEquilibriumStacks >= perfectEquilibriumThreshold) {
        perfectEquilibriumStacks = 0;
        if (hitAdrenaline > 0) {
          adrenalineByTick[hitTick] += hitAdrenaline;
        }
      }
    }
  }
}

function resolveTimelineHitAdrenalineGain(
  config: SimulationConfig,
  activeBuffIds: EntityId[],
): number {
  return activeBuffIds
    .flatMap((buffId) => config.gameData.buffs[buffId]?.effectRefs ?? [])
    .reduce((total, effectRef) => total + parseRangedHitAdrenalineGain(effectRef), 0);
}

function resolvePerfectEquilibriumThreshold(
  config: SimulationConfig,
  activeBuffIds: EntityId[],
): number {
  return activeBuffIds
    .flatMap((buffId) => config.gameData.buffs[buffId]?.effectRefs ?? [])
    .map((effectRef) => parsePerfectEquilibriumThreshold(effectRef))
    .find((value): value is number => typeof value === 'number') ?? PERFECT_EQUILIBRIUM_DEFAULT_THRESHOLD;
}

function isRapidFireAbility(
  ability: ReturnType<typeof resolveEffectiveAbilityDefinition>,
): ability is NonNullable<ReturnType<typeof resolveEffectiveAbilityDefinition>> {
  return Boolean(ability?.effectRefs?.includes(RAPID_FIRE_CHANNEL_EFFECT_REF));
}

function isBowEquipped(config: SimulationConfig): boolean {
  const equippedWeapon = config.gearSetup.equipment.weapon;
  if (!equippedWeapon) {
    return false;
  }

  const definition = config.gameData.items[equippedWeapon.definitionId];
  return definition?.requirements?.requiredEquipmentTags?.includes('two-handed-bow') ?? false;
}

function hasBolgEquipped(config: SimulationConfig): boolean {
  const equippedWeapon = config.gearSetup.equipment.weapon;
  if (!equippedWeapon) {
    return false;
  }

  return config.gameData.items[equippedWeapon.definitionId]?.effectRefs?.includes(EFFECT_REF_IDS.bolgPassive) ?? false;
}

function readStringPayload(action: RotationAction, key: string): string | null {
  const value = action.payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function createEmptyAdrenalineTimeline(tickCount: number): Record<number, number> {
  return Object.fromEntries(Array.from({ length: tickCount }, (_, tick) => [tick, 0]));
}
