import type { EntityId } from '../../game-data/types';
import { EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type { RotationAction, SimulationConfig, TimelineGeneratedBuffSource } from '../models';
import {
  BALANCE_BY_FORCE_ABILITY_ID,
  resolveEffectiveAbilityDefinition,
} from '../abilities/effective-ability';

const RAPID_FIRE_ABILITY_ID = 'rapid-fire';
const GALESHOT_ABILITY_ID = 'galeshot';
const DEATHS_SWIFTNESS_ABILITY_ID = 'deaths-swiftness';
const BALANCE_BY_FORCE_BUFF_ID = 'balance-by-force-buff';
const BALANCE_BY_FORCE_DURATION_TICKS = 50;
const DRACOLICH_SET_EFFECT = EFFECT_REF_IDS.dracolichSet;
const ELITE_DRACOLICH_SET_EFFECT = EFFECT_REF_IDS.eliteDracolichSet;
const DRACOLICH_INFUSION_BUFF_ID = 'dracolich-infusion';
const ELITE_DRACOLICH_INFUSION_BUFF_ID = 'elite-dracolich-infusion';
const DEATHS_SWIFTNESS_BUFF_ID = 'deaths-swiftness-buff';
const DEATHS_SWIFTNESS_DURATION_TICKS = 63;
const SEARING_WINDS_BUFF_ID = 'searing-winds';
const SEARING_WINDS_DURATION_TICKS = 10;
const IMBUE_SHADOWS_ABILITY_ID = 'imbue-shadows';
const SHADOW_TENDRILS_ABILITY_ID = 'shadow-tendrils';
const SHADOW_IMBUED_BUFF_ID = 'shadow-imbued';
const SHADOW_IMBUED_DURATION_TICKS = 50;
const SHADOW_IMBUED_EXTENSION_TICKS = 6;
const SHADOW_IMBUED_HIT_ADRENALINE_EFFECT_PREFIX = 'ranged-hit-adrenaline:+';
const BOW_TAG = 'two-handed-bow';
const PERFECT_EQUILIBRIUM_THRESHOLD_BUFF_ID = 'balance-by-force-buff';
const SPLIT_SOUL_ABILITY_ID = 'split-soul';
const SPLIT_SOUL_BUFF_ID = 'split-soul';
const SPLIT_SOUL_DURATION_TICKS = 25;
const VULNERABILITY_BOMB_ACTION_TYPE = 'vulnerability-bomb';
const VULNERABILITY_BOMB_AREA_BUFF_ID = 'vulnerability-bomb-area';
const VULNERABILITY_DEBUFF_BUFF_ID = 'vulnerability';
const VULNERABILITY_BOMB_TRAVEL_DELAY_TICKS = 3;
const VULNERABILITY_BOMB_AREA_DURATION_TICKS = 3;
const VULNERABILITY_DEBUFF_DURATION_TICKS = 100;

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
  let searingWindsUntilTick = -1;
  let generatedSearingWinds = false;
  let shadowImbuedUntilTick = -1;
  let generatedShadowImbued = false;
  let generatedVulnerabilityBomb = false;

  for (const action of [...config.rotationPlan.nonGcdActions].sort((left, right) => left.tick - right.tick)) {
    if (blockedActionIds.has(action.id)) {
      continue;
    }

    if (action.actionType === VULNERABILITY_BOMB_ACTION_TYPE) {
      applyVulnerabilityBombBuffs(config, action, buffTimeline);
      generatedVulnerabilityBomb = true;
    }
  }

  for (const action of [...config.rotationPlan.abilityActions].sort((left, right) => left.tick - right.tick)) {
    if (blockedActionIds.has(action.id)) {
      continue;
    }

    const effectiveAbility = resolveEffectiveAbilityDefinition(config, action);
    const abilityId = effectiveAbility?.id ?? readAbilityId(action);
    applyBalanceByForceBuff(config, action, effectiveAbility?.id ?? null, buffTimeline, timelineGeneratedBuffSources);
    applyDeathsSwiftnessBuff(config, action, abilityId, buffTimeline, timelineGeneratedBuffSources);
    applySplitSoulBuff(config, action, effectiveAbility, buffTimeline, timelineGeneratedBuffSources);
    if (abilityId === IMBUE_SHADOWS_ABILITY_ID) {
      shadowImbuedUntilTick = applyShadowImbuedBuff(
        config,
        action,
        buffTimeline,
        shadowImbuedUntilTick,
      );
      generatedShadowImbued = true;
    }
    if (abilityId === SHADOW_TENDRILS_ABILITY_ID && shadowImbuedUntilTick >= action.tick) {
      shadowImbuedUntilTick = extendShadowImbued(
        config,
        buffTimeline,
        shadowImbuedUntilTick,
      );
    }
    if (abilityId === GALESHOT_ABILITY_ID) {
      searingWindsUntilTick = applySearingWindsFromGaleshot(
        config,
        action,
        buffTimeline,
        searingWindsUntilTick,
      );
      generatedSearingWinds = true;
    }
    if (abilityId === RAPID_FIRE_ABILITY_ID && searingWindsUntilTick >= action.tick) {
      searingWindsUntilTick = extendSearingWindsWithRapidFire(
        config,
        action,
        buffTimeline,
        searingWindsUntilTick,
      );
    }

    if (!dracolichInfo || abilityId !== RAPID_FIRE_ABILITY_ID) {
      continue;
    }

    applyRapidFireDracolichAdrenaline(config, action, dracolichInfo, adrenalineByTick);
    applyRapidFireDracolichInfusion(config, action, dracolichInfo, buffTimeline);
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

  if (generatedSearingWinds) {
    timelineGeneratedBuffSources.push({
      buffId: SEARING_WINDS_BUFF_ID,
      sourceType: 'ability',
      sourceId: GALESHOT_ABILITY_ID,
    });
    notes.push(
      'Searing Winds: Galeshot applies a 10-tick buff starting on the cast tick, and each Rapid Fire hit extends it by 1 tick when active on cast.',
    );
  }

  if (generatedShadowImbued) {
    timelineGeneratedBuffSources.push({
      buffId: SHADOW_IMBUED_BUFF_ID,
      sourceType: 'ability',
      sourceId: IMBUE_SHADOWS_ABILITY_ID,
    });
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

function applyBalanceByForceBuff(
  config: SimulationConfig,
  action: RotationAction,
  effectiveAbilityId: EntityId | null,
  buffTimeline: Record<number, EntityId[]>,
  timelineGeneratedBuffSources: TimelineGeneratedBuffSource[],
): void {
  if (effectiveAbilityId !== BALANCE_BY_FORCE_ABILITY_ID || action.tick >= config.rotationPlan.tickCount) {
    return;
  }

  markBuffRange(
    buffTimeline,
    BALANCE_BY_FORCE_BUFF_ID,
    action.tick,
    action.tick + BALANCE_BY_FORCE_DURATION_TICKS - 1,
    config.rotationPlan.tickCount,
  );

  if (!timelineGeneratedBuffSources.some((entry) => entry.buffId === BALANCE_BY_FORCE_BUFF_ID)) {
    timelineGeneratedBuffSources.push({
      buffId: BALANCE_BY_FORCE_BUFF_ID,
      sourceType: 'ability',
      sourceId: BALANCE_BY_FORCE_ABILITY_ID,
    });
  }
}

function applySearingWindsFromGaleshot(
  config: SimulationConfig,
  action: RotationAction,
  buffTimeline: Record<number, EntityId[]>,
  currentUntilTick: number,
): number {
  const nextUntilTick = Math.max(currentUntilTick, action.tick + SEARING_WINDS_DURATION_TICKS - 1);
  markBuffRange(
    buffTimeline,
    SEARING_WINDS_BUFF_ID,
    Math.max(action.tick, currentUntilTick + 1),
    nextUntilTick,
    config.rotationPlan.tickCount,
  );
  return nextUntilTick;
}

function applyShadowImbuedBuff(
  config: SimulationConfig,
  action: RotationAction,
  buffTimeline: Record<number, EntityId[]>,
  currentUntilTick: number,
): number {
  const nextUntilTick = Math.max(currentUntilTick, action.tick + SHADOW_IMBUED_DURATION_TICKS - 1);
  markBuffRange(
    buffTimeline,
    SHADOW_IMBUED_BUFF_ID,
    Math.max(action.tick, currentUntilTick + 1),
    nextUntilTick,
    config.rotationPlan.tickCount,
  );
  return nextUntilTick;
}

function extendShadowImbued(
  config: SimulationConfig,
  buffTimeline: Record<number, EntityId[]>,
  currentUntilTick: number,
): number {
  const nextUntilTick = currentUntilTick + SHADOW_IMBUED_EXTENSION_TICKS;
  markBuffRange(
    buffTimeline,
    SHADOW_IMBUED_BUFF_ID,
    currentUntilTick + 1,
    nextUntilTick,
    config.rotationPlan.tickCount,
  );
  return nextUntilTick;
}

function extendSearingWindsWithRapidFire(
  config: SimulationConfig,
  action: RotationAction,
  buffTimeline: Record<number, EntityId[]>,
  currentUntilTick: number,
): number {
  const rapidFire = config.gameData.abilities[RAPID_FIRE_ABILITY_ID];
  const extensionTicks = resolveRapidFireSearingWindsExtensionTicks(rapidFire);

  if (extensionTicks <= 0) {
    return currentUntilTick;
  }

  const nextUntilTick = currentUntilTick + extensionTicks;
  markBuffRange(
    buffTimeline,
    SEARING_WINDS_BUFF_ID,
    currentUntilTick + 1,
    nextUntilTick,
    config.rotationPlan.tickCount,
  );
  return nextUntilTick;
}

function resolveRapidFireSearingWindsExtensionTicks(
  rapidFire: { hitSchedule?: Array<unknown>; channelDurationTicks?: number } | undefined,
): number {
  if (!rapidFire) {
    return 0;
  }

  const hitCount = rapidFire.hitSchedule?.length ?? 0;
  const channelTicks = rapidFire.channelDurationTicks ?? 0;
  const baseExtension = Math.max(hitCount, channelTicks);

  if (baseExtension <= 0) {
    return 0;
  }

  // Preserve the final GCD-aligned cast window after the channel so Searing Winds
  // still covers the same number of post-Galeshot ability starts in planner timing.
  return baseExtension + 1;
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
  dracolichInfo: DracolichSetInfo,
  adrenalineByTick: Record<number, number>,
): void {
  const rapidFire = config.gameData.abilities[RAPID_FIRE_ABILITY_ID];

  if (!rapidFire?.isChanneled || !rapidFire.channelDurationTicks || dracolichInfo.pieces <= 0) {
    return;
  }

  const gainPerTick = dracolichInfo.pieces * dracolichInfo.adrenalinePerPiecePerTick;

  for (let offset = 0; offset < rapidFire.channelDurationTicks; offset += 1) {
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
  dracolichInfo: DracolichSetInfo,
  buffTimeline: Record<number, EntityId[]>,
): void {
  const rapidFire = config.gameData.abilities[RAPID_FIRE_ABILITY_ID];

  if (
    !rapidFire?.isChanneled ||
    !rapidFire.channelDurationTicks ||
    dracolichInfo.infusionDurationTicks <= 0 ||
    !isBowEquipped(config)
  ) {
    return;
  }

  const buffStartTick = action.tick + rapidFire.channelDurationTicks + 1;

  if (buffStartTick >= config.rotationPlan.tickCount) {
    return;
  }

  for (let offset = 0; offset < dracolichInfo.infusionDurationTicks; offset += 1) {
    const tick = buffStartTick + offset;

    if (tick < 0 || tick >= config.rotationPlan.tickCount) {
      continue;
    }

    buffTimeline[tick].push(dracolichInfo.infusionBuffId);
  }
}

function applyDeathsSwiftnessBuff(
  config: SimulationConfig,
  action: RotationAction,
  abilityId: EntityId | null,
  buffTimeline: Record<number, EntityId[]>,
  timelineGeneratedBuffSources: TimelineGeneratedBuffSource[],
): void {
  if (abilityId !== DEATHS_SWIFTNESS_ABILITY_ID) {
    return;
  }

  const ability = config.gameData.abilities[DEATHS_SWIFTNESS_ABILITY_ID];

  if (!ability || action.tick >= config.rotationPlan.tickCount) {
    return;
  }

  for (let offset = 0; offset < DEATHS_SWIFTNESS_DURATION_TICKS; offset += 1) {
    const tick = action.tick + offset;

    if (tick < 0 || tick >= config.rotationPlan.tickCount) {
      continue;
    }

    buffTimeline[tick].push(DEATHS_SWIFTNESS_BUFF_ID);
  }

  if (!timelineGeneratedBuffSources.some((entry) => entry.buffId === DEATHS_SWIFTNESS_BUFF_ID)) {
    timelineGeneratedBuffSources.push({
      buffId: DEATHS_SWIFTNESS_BUFF_ID,
      sourceType: 'ability',
      sourceId: ability.id,
    });
  }
}

function applyTimelineHitAdrenaline(
  config: SimulationConfig,
  blockedActionIds: ReadonlySet<string>,
  buffTimeline: Record<number, EntityId[]>,
  adrenalineByTick: Record<number, number>,
): void {
  const abilityActions = [...config.rotationPlan.abilityActions].sort((left, right) => left.tick - right.tick);
  let perfectEquilibriumStacks = 0;
  const hasBolgPassive = hasBolgEquipped(config);

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

      if (
        hasBolgPassive &&
        ability.style === 'ranged' &&
        !ability.effectRefs?.includes(EFFECT_REF_IDS.damageOverTime)
      ) {
        perfectEquilibriumStacks += 1;
        const perfectEquilibriumThreshold = (buffTimeline[hitTick] ?? []).includes(PERFECT_EQUILIBRIUM_THRESHOLD_BUFF_ID)
          ? 4
          : 8;

        if (perfectEquilibriumStacks >= perfectEquilibriumThreshold) {
          perfectEquilibriumStacks = 0;
          if (hitAdrenaline > 0) {
            adrenalineByTick[hitTick] += hitAdrenaline;
          }
        }
      }
    }
  }
}

function applySplitSoulBuff(
  config: SimulationConfig,
  action: RotationAction,
  effectiveAbility: { id: EntityId; effectRefs?: string[] } | null,
  buffTimeline: Record<number, EntityId[]>,
  timelineGeneratedBuffSources: TimelineGeneratedBuffSource[],
): void {
  if (!isSplitSoulAbility(effectiveAbility) || action.tick >= config.rotationPlan.tickCount) {
    return;
  }

  const endTick = resolveSplitSoulEndTick(config, action.tick);
  markBuffRange(
    buffTimeline,
    SPLIT_SOUL_BUFF_ID,
    action.tick,
    endTick,
    config.rotationPlan.tickCount,
  );

  if (!timelineGeneratedBuffSources.some((entry) => entry.buffId === SPLIT_SOUL_BUFF_ID)) {
    timelineGeneratedBuffSources.push({
      buffId: SPLIT_SOUL_BUFF_ID,
      sourceType: 'ability',
      sourceId: SPLIT_SOUL_ABILITY_ID,
    });
  }
}

function isSplitSoulAbility(
  ability: { id: EntityId; effectRefs?: string[] } | null,
): boolean {
  if (!ability) {
    return false;
  }

  return (
    ability.id === SPLIT_SOUL_ABILITY_ID ||
    (ability.effectRefs?.includes(EFFECT_REF_IDS.weaponSpecialSplitSoul) ?? false)
  );
}

function resolveSplitSoulEndTick(config: SimulationConfig, castTick: number): number {
  const naturalEndTick = castTick + SPLIT_SOUL_DURATION_TICKS - 1;
  const firstWeaponSwapTick = [...config.rotationPlan.nonGcdActions]
    .filter((action) => action.actionType === 'gear-swap' && action.tick >= castTick)
    .map((action) => ({
      tick: action.tick,
      slot: readStringPayload(action, 'slot'),
    }))
    .find((entry) => entry.slot === 'weapon')?.tick;

  if (typeof firstWeaponSwapTick !== 'number') {
    return naturalEndTick;
  }

  return Math.min(naturalEndTick, firstWeaponSwapTick);
}

function resolveTimelineHitAdrenalineGain(
  config: SimulationConfig,
  activeBuffIds: EntityId[],
): number {
  return activeBuffIds
    .flatMap((buffId) => config.gameData.buffs[buffId]?.effectRefs ?? [])
    .reduce((total, effectRef) => total + parseHitAdrenalineGain(effectRef), 0);
}

function parseHitAdrenalineGain(effectRef: string): number {
  if (!effectRef.startsWith(SHADOW_IMBUED_HIT_ADRENALINE_EFFECT_PREFIX) || !effectRef.endsWith('%')) {
    return 0;
  }

  const value = effectRef
    .slice(SHADOW_IMBUED_HIT_ADRENALINE_EFFECT_PREFIX.length, -1)
    .trim();
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isBowEquipped(config: SimulationConfig): boolean {
  const equippedWeapon = config.gearSetup.equipment.weapon;

  if (!equippedWeapon) {
    return false;
  }

  const definition = config.gameData.items[equippedWeapon.definitionId];
  return definition?.requirements?.requiredEquipmentTags?.includes(BOW_TAG) ?? false;
}

function hasBolgEquipped(config: SimulationConfig): boolean {
  const equippedWeapon = config.gearSetup.equipment.weapon;

  if (!equippedWeapon) {
    return false;
  }

  const definition = config.gameData.items[equippedWeapon.definitionId];
  return definition?.effectRefs?.includes(EFFECT_REF_IDS.bolgPassive) ?? false;
}

function readAbilityId(action: RotationAction): EntityId | null {
  const abilityId = action.payload['abilityId'];
  return typeof abilityId === 'string' && abilityId.length > 0 ? abilityId : null;
}

function readStringPayload(action: RotationAction, key: string): string | null {
  const value = action.payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function createEmptyAdrenalineTimeline(tickCount: number): Record<number, number> {
  return Object.fromEntries(Array.from({ length: tickCount }, (_, tick) => [tick, 0]));
}

function createEmptyBuffTimeline(tickCount: number): Record<number, EntityId[]> {
  return Object.fromEntries(Array.from({ length: tickCount }, (_, tick) => [tick, []]));
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
