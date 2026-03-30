import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition, EquipmentSlot } from '../../../game-data/types';
import { CONFIG_OPTION_IDS, EFFECT_REF_IDS } from '../../../game-data/conventions/mechanics';
import type { GearBuilderState } from '../../core/gear/gear-state';
import { projectGearStateAtTick } from '../../core/gear/project-gear-state';
import { formatEquipmentSlot } from '../gear/gear-builder.utils';
import type {
  PlayerStats,
  RotationAction,
  RotationPlan,
  SimulationResult,
  ValidationIssue,
} from '../../../simulation-engine/models';
import { resolveEffectiveAmmoSelection } from '../../core/gear/effective-ammo-selection';
import { simulateBaseDamage } from '../../../simulation-engine/calculators';
import { resolveBuffStackRuleState } from '../../../simulation-engine/buffs/buff-stack-rules';
import { resolveAdrenalineTimeline } from '../../../simulation-engine/resolvers/adrenaline';
import { resolveCooldownTimeline } from '../../../simulation-engine/resolvers/cooldowns';
import { buildBaseTimeline } from '../../../simulation-engine/timeline';
import {
  buildRotationPlannerSimulationConfig,
  collectPersistentBuffIds,
  type PlannerBuffStateSnapshot,
} from './rotation-planner-simulation';

const QUIVER_SECONDARY_BOLT_AMMO_ID = 'bakriminel-bolts';

export interface RotationPlannerTickInspection {
  tick: number;
  adrenaline: {
    start: number;
    end: number;
  };
  deathsporeStacks: number | null;
  perfectEquilibriumStacks: number | null;
  bloodlustStacks: number | null;
  bloodlustMaxStacks: number | null;
  activePersistentBuffs: string[];
  activeTemporaryBuffs: string[];
  equipmentState: Array<{
    slot: string;
    itemName: string;
    details: string[];
  }>;
  ammoState: string | null;
  cooldowns: Array<{
    abilityId: string;
    abilityName: string;
    readyAtTick: number;
    remainingTicks: number;
  }>;
  actionsStarting: string[];
  hitsResolving: string[];
  damageCalculations: Array<{
    abilityName: string;
    hitName: string;
    baseRange: string;
    additiveStep: string;
    multiplicativeStep: string;
    expectedValueStep: string;
    finalRange: string;
    minFormula: string;
    avgFormula: string;
    maxFormula: string;
  }>;
  validationIssues: ValidationIssue[];
}

export function inspectRotationPlannerTick(input: {
  tick: number;
  catalog: GameDataCatalog;
  playerStats: PlayerStats;
  gearState: GearBuilderState;
  buffState: PlannerBuffStateSnapshot;
  rotationPlan: RotationPlan;
  simulationResult?: SimulationResult | null;
}): RotationPlannerTickInspection {
  const simulationConfig = buildRotationPlannerSimulationConfig(input);
  const timelineResult = buildBaseTimeline({
    rotationPlan: input.rotationPlan,
  });
  const adrenalineResult = resolveAdrenalineTimeline(simulationConfig);
  const cooldownResult = resolveCooldownTimeline(simulationConfig);
  const simulationResult = input.simulationResult ?? simulateBaseDamage(simulationConfig);
  const clampedTick = Math.max(0, Math.min(input.tick, input.rotationPlan.tickCount - 1));
  const bucket = timelineResult.timeline.ticks[clampedTick];
  const adrenalineTickState = adrenalineResult.tickStates[clampedTick];
  const cooldownTickState = cooldownResult.tickStates[clampedTick];
  const simulatedTickState = simulationResult.tickStates[clampedTick];
  const persistentBuffIds = simulatedTickState?.activePersistentBuffIds ?? collectPersistentBuffIds(input.buffState, input.catalog);
  const temporaryBuffIds = (simulatedTickState?.activeTimelineBuffIds ?? []).filter(
    (buffId) => !isCooldownLikeBuff(input.catalog.buffs[buffId]),
  );
  const projectedGearState = projectGearStateAtTick(
    input.gearState,
    input.catalog.items,
    input.rotationPlan.nonGcdActions,
    clampedTick,
  );
  const deathsporeAmmoActive = hasDeathsporeAmmoEquipped(projectedGearState, input.catalog);
  const perfectEquilibriumWeaponActive = hasEquippedBolg(projectedGearState, input.catalog);
  const bloodlustStacks = countBuffStacks(simulatedTickState?.activeTimelineBuffIds ?? [], 'bloodlust');
  const meleeWeaponActive = hasEquippedMeleeWeapon(projectedGearState, input.catalog);
  const bloodlustStackState = resolveBuffStackRuleState(
    input.catalog.buffs['bloodlust'],
    simulatedTickState?.activeTimelineBuffIds ?? [],
  );

  return {
    tick: clampedTick,
    adrenaline: {
      start: adrenalineTickState?.valueAtTickStart ?? input.rotationPlan.startingAdrenaline,
      end: adrenalineTickState?.valueAtTickEnd ?? input.rotationPlan.startingAdrenaline,
    },
    deathsporeStacks:
      deathsporeAmmoActive && typeof simulatedTickState?.deathsporeStacks === 'number'
        ? simulatedTickState.deathsporeStacks
        : null,
    perfectEquilibriumStacks:
      perfectEquilibriumWeaponActive && typeof simulatedTickState?.perfectEquilibriumStacks === 'number'
        ? simulatedTickState.perfectEquilibriumStacks
        : null,
    bloodlustStacks: meleeWeaponActive ? bloodlustStacks : null,
    bloodlustMaxStacks: meleeWeaponActive ? bloodlustStackState.maxStacks : null,
    activePersistentBuffs: persistentBuffIds.map(
      (buffId) => input.catalog.buffs[buffId]?.name ?? input.catalog.relics[buffId]?.name ?? buffId,
    ),
    activeTemporaryBuffs: temporaryBuffIds
      .filter((buffId) => buffId !== 'bloodlust')
      .map((buffId) => input.catalog.buffs[buffId]?.name ?? buffId),
    equipmentState: Object.entries(projectedGearState.equipment)
      .filter((entry) => Boolean(entry[1]))
      .map(([slot, instance]) => ({
        slot: formatEquipmentSlot(slot as Parameters<typeof formatEquipmentSlot>[0]),
        itemName: input.catalog.items[instance!.definitionId]?.name ?? instance!.definitionId,
        details: buildEquipmentDetails(instance!, input.catalog),
      })),
    ammoState: resolveAmmoState(projectedGearState, input.catalog),
    cooldowns: Object.entries(cooldownTickState?.cooldownsAtTickStart ?? {}).map(([abilityId, readyAtTick]) => ({
      abilityId,
      abilityName: input.catalog.abilities[abilityId]?.name ?? abilityId,
      readyAtTick,
      remainingTicks: Math.max(readyAtTick - clampedTick, 0),
    })),
    actionsStarting: [
      ...bucket.nonGcdActions.map((action) => readPlannerActionLabel(action)),
      ...bucket.abilityActions.map((action) => {
        const abilityId = action.payload['abilityId'];
        return typeof abilityId === 'string'
          ? input.catalog.abilities[abilityId]?.name ?? abilityId
          : action.id;
      }),
    ],
    hitsResolving: collectResolvedHitLabelsAtTick(
      simulationResult,
      clampedTick,
      input.catalog,
      input.rotationPlan,
    ),
    damageCalculations: collectDamageCalculationsAtTick(
      simulationResult,
      clampedTick,
      input.catalog,
      input.rotationPlan,
    ),
    validationIssues: [
      ...timelineResult.validationIssues.filter((issue) => issue.tick === clampedTick),
      ...adrenalineResult.validationIssues.filter((issue) => issue.tick === clampedTick),
      ...cooldownResult.validationIssues.filter((issue) => issue.tick === clampedTick),
      ...simulationResult.validationIssues.filter((issue) => issue.tick === clampedTick),
    ],
  };
}

function resolveAmmoState(
  gearState: GearBuilderState,
  catalog: GameDataCatalog,
): string | null {
  const ammoInstance = resolveEffectiveAmmoSelection(gearState, catalog);
  if (!ammoInstance) {
    return null;
  }

  return (
    catalog.items[ammoInstance.definitionId]?.name ??
    ammoInstance.definitionId
  );
}

function hasDeathsporeAmmoEquipped(
  gearState: GearBuilderState,
  catalog: GameDataCatalog,
): boolean {
  const ammoInstance = resolveEffectiveAmmoSelection(gearState, catalog);
  if (!ammoInstance) {
    return false;
  }

  const effectRefs =
    catalog.items[ammoInstance.definitionId]?.effectRefs ??
    (catalog.ammo as Record<string, { effectRefs?: string[] }>)[ammoInstance.definitionId]?.effectRefs ??
    [];

  return effectRefs.includes(EFFECT_REF_IDS.deathsporeProgress);
}

function hasEquippedMeleeWeapon(
  gearState: GearBuilderState,
  catalog: GameDataCatalog,
): boolean {
  return ['weapon', 'offHand'].some((slot) => {
    const item = gearState.equipment[slot as EquipmentSlot];
    if (!item) {
      return false;
    }

    return catalog.items[item.definitionId]?.combatStyleTags.includes('melee') ?? false;
  });
}

function hasEquippedBolg(
  gearState: GearBuilderState,
  catalog: GameDataCatalog,
): boolean {
  const weapon = gearState.equipment.weapon;
  if (!weapon) {
    return false;
  }

  return catalog.items[weapon.definitionId]?.effectRefs?.includes(EFFECT_REF_IDS.bolgPassive) ?? false;
}

function countBuffStacks(activeTimelineBuffIds: string[], buffId: string): number {
  return activeTimelineBuffIds.filter((entry) => entry === buffId).length;
}

function buildEquipmentDetails(
  instance: NonNullable<GearBuilderState['equipment'][EquipmentSlot]>,
  catalog: GameDataCatalog,
): string[] {
  const details: string[] = [];

  const configuredPerks = instance.configuredPerks ?? [];
  if (configuredPerks.length) {
    details.push(
      `Perks: ${configuredPerks
        .map((perk) => formatConfiguredPerk(perk.perkId, perk.rank, catalog))
        .join(', ')}`,
    );
  }

  if (instance.definitionId === 'essence-of-finality') {
    const storedSpecial = resolveStringConfigValue(
      catalog.items[instance.definitionId],
      instance,
      'stored-special',
    );

    if (storedSpecial && storedSpecial !== 'none') {
      details.push(`Stored special: ${formatDefinitionLabel(storedSpecial, catalog)}`);
    }
  }

  if (instance.definitionId === 'pernixs-quiver') {
    const loadedArrows = resolveStringConfigValue(
      catalog.items[instance.definitionId],
      instance,
      CONFIG_OPTION_IDS.loadedAmmo,
    );

    if (loadedArrows && loadedArrows !== 'none') {
      details.push(`Loaded arrows: ${formatDefinitionLabel(loadedArrows, catalog)}`);
    }

    details.push(`Loaded bolts: ${formatDefinitionLabel(QUIVER_SECONDARY_BOLT_AMMO_ID, catalog)}`);
  }

  return details;
}

function formatConfiguredPerk(
  perkId: string,
  rank: number | undefined,
  catalog: GameDataCatalog,
): string {
  const baseName = catalog.perks[perkId]?.name ?? perkId;
  return typeof rank === 'number' ? `${baseName} ${rank}` : baseName;
}

function formatDefinitionLabel(
  definitionId: string,
  catalog: GameDataCatalog,
): string {
  return (
    catalog.items[definitionId]?.name ??
    catalog.eofSpecs[`${definitionId}-eof`]?.name ??
    humanizeHitId(definitionId)
  );
}

function resolveStringConfigValue(
  item: GameDataCatalog['items'][string] | undefined,
  instance: NonNullable<GearBuilderState['equipment'][EquipmentSlot]>,
  optionId: string,
): string | null {
  const configuredValue = instance.configValues?.[optionId];

  if (typeof configuredValue === 'string') {
    return configuredValue;
  }

  const defaultValue = item?.configOptions?.find((option) => option.id === optionId)?.defaultValue;
  return typeof defaultValue === 'string' ? defaultValue : null;
}

function readPlannerActionLabel(action: RotationAction): string {
  const label = action.payload['label'];
  return typeof label === 'string' && label ? label : action.actionType;
}

function collectResolvedHitLabelsAtTick(
  simulationResult: SimulationResult,
  tick: number,
  catalog: GameDataCatalog,
  rotationPlan: RotationPlan,
): string[] {
  return simulationResult.explainability.damageBreakdowns
    .filter((entry) => resolveDisplayedHitTick(entry, catalog, rotationPlan) === tick)
    .map((entry) => {
      const abilityName = catalog.abilities[entry.abilityId]?.name ?? humanizeHitId(entry.abilityId);
      const hitLabel = humanizeHitId(entry.hitId.split(':').slice(1).join(':') || entry.hitId);
      return `${abilityName}: ${hitLabel} (${entry.finalDamage.min}-${entry.finalDamage.max})`;
    });
}

function collectDamageCalculationsAtTick(
  simulationResult: SimulationResult,
  tick: number,
  catalog: GameDataCatalog,
  rotationPlan: RotationPlan,
): RotationPlannerTickInspection['damageCalculations'] {
  return simulationResult.explainability.damageBreakdowns
    .filter((entry) => resolveDisplayedHitTick(entry, catalog, rotationPlan) === tick)
    .map((entry) => buildDamageCalculationEntry(entry, catalog));
}

function buildDamageCalculationEntry(
  entry: SimulationResult['explainability']['damageBreakdowns'][number],
  catalog: GameDataCatalog,
): RotationPlannerTickInspection['damageCalculations'][number] {
  const abilityName = catalog.abilities[entry.abilityId]?.name ?? humanizeHitId(entry.abilityId);
  const hitName = humanizeHitId(entry.hitId.split(':').slice(1).join(':') || entry.hitId);
  const inheritedTriggerDamage = entry.derivedParts?.inheritedTriggerDamage;
  const ordinaryAdditiveModifiers = inheritedTriggerDamage
    ? entry.additiveModifiers.filter((modifier) => modifier.sourceId !== 'perfect-equilibrium-trigger')
    : entry.additiveModifiers;
  const additiveTotal = sumModifierValues(ordinaryAdditiveModifiers);
  const multiplicativeProduct = calculateMultiplierProduct(entry);
  const afterMultiplicative = {
    min: roundValue(entry.baseDamage.min * multiplicativeProduct),
    avg: roundValue(entry.baseDamage.avg * multiplicativeProduct),
    max: roundValue(entry.baseDamage.max * multiplicativeProduct),
  };
  const afterAdditive = {
    min: roundValue(afterMultiplicative.min + additiveTotal),
    avg: roundValue(afterMultiplicative.avg + additiveTotal),
    max: roundValue(afterMultiplicative.max + additiveTotal),
  };
  const expectedValueTotal = sumModifierValues(entry.expectedValueModifiers);
  const critAdjustedRange = inheritedTriggerDamage
    ? {
        min: roundValue(entry.finalDamage.min - inheritedTriggerDamage.min),
        avg: roundValue(entry.finalDamage.avg - inheritedTriggerDamage.avg),
        max: roundValue(entry.finalDamage.max - inheritedTriggerDamage.max),
      }
    : entry.finalDamage;
  const critMinMultiplier = calculateCritMultiplier(afterAdditive.min, critAdjustedRange.min);
  const critAvgMultiplier = calculateCritMultiplier(afterAdditive.avg, critAdjustedRange.avg);
  const critMaxMultiplier = calculateCritMultiplier(afterAdditive.max, critAdjustedRange.max);
  const inheritedStep = inheritedTriggerDamage
    ? ` + inherited trigger ${formatDamageRange(inheritedTriggerDamage)}`
    : '';
  const finalMinFormula = inheritedTriggerDamage
    ? `Min: (((${formatNumber(entry.baseDamage.min)} × ${formatNumber(multiplicativeProduct)}) + ${formatNumber(additiveTotal)}) × ${formatNumber(critMinMultiplier)}${critAdjustedRange.min !== afterAdditive.min ? ' (crit)' : ''}) + ${formatNumber(inheritedTriggerDamage.min)} = ${formatNumber(entry.finalDamage.min)}`
    : `Min: ((${formatNumber(entry.baseDamage.min)} × ${formatNumber(multiplicativeProduct)}) + ${formatNumber(additiveTotal)}) × ${formatNumber(critMinMultiplier)}${entry.finalDamage.min !== afterAdditive.min ? ' (crit)' : ''} = ${formatNumber(entry.finalDamage.min)}`;
  const finalAvgFormula = inheritedTriggerDamage
    ? `Avg: (((${formatNumber(entry.baseDamage.avg)} × ${formatNumber(multiplicativeProduct)}) + ${formatNumber(additiveTotal)}) × ${formatNumber(critAvgMultiplier)} (crit)) + ${formatNumber(inheritedTriggerDamage.avg)} = ${formatNumber(entry.finalDamage.avg)}`
    : `Avg: ((${formatNumber(entry.baseDamage.avg)} × ${formatNumber(multiplicativeProduct)}) + ${formatNumber(additiveTotal)}) × ${formatNumber(critAvgMultiplier)} (crit) = ${formatNumber(entry.finalDamage.avg)}`;
  const finalMaxFormula = inheritedTriggerDamage
    ? `Max: (((${formatNumber(entry.baseDamage.max)} × ${formatNumber(multiplicativeProduct)}) + ${formatNumber(additiveTotal)}) × ${formatNumber(critMaxMultiplier)}${critAdjustedRange.max !== afterAdditive.max ? ' (crit)' : ''}) + ${formatNumber(inheritedTriggerDamage.max)} = ${formatNumber(entry.finalDamage.max)}`
    : `Max: ((${formatNumber(entry.baseDamage.max)} × ${formatNumber(multiplicativeProduct)}) + ${formatNumber(additiveTotal)}) × ${formatNumber(critMaxMultiplier)}${entry.finalDamage.max !== afterAdditive.max ? ' (crit)' : ''} = ${formatNumber(entry.finalDamage.max)}`;

  return {
    abilityName,
    hitName,
    baseRange: formatDamageRange(entry.baseDamage),
    additiveStep: ordinaryAdditiveModifiers.length || inheritedTriggerDamage
      ? `${ordinaryAdditiveModifiers.length ? `${formatSignedValue(additiveTotal)} from ${ordinaryAdditiveModifiers.map((modifier) => modifier.label).join(', ')}` : 'No flat added damage'}${inheritedStep}`
      : 'No flat added damage',
    multiplicativeStep: entry.multiplicativeModifiers.length
      ? `${entry.multiplicativeModifiers.map((modifier) => extractMultiplierLabel(modifier.label)).join(' × ')} = x${formatNumber(multiplicativeProduct)}`
      : 'No damage multipliers',
    expectedValueStep: entry.expectedValueModifiers.length
      ? `Min x${formatNumber(critMinMultiplier)}, Avg x${formatNumber(critAvgMultiplier)}, Max x${formatNumber(critMaxMultiplier)} (crit)`
      : 'No crit multiplier',
    finalRange: formatDamageRange(entry.finalDamage),
    minFormula: finalMinFormula,
    avgFormula: finalAvgFormula,
    maxFormula: finalMaxFormula,
  };
}

function resolveDisplayedHitTick(
  entry: SimulationResult['explainability']['damageBreakdowns'][number],
  catalog: GameDataCatalog,
  rotationPlan: RotationPlan,
): number {
  const sourceActionId = entry.hitId.split(':')[0];
  if (!sourceActionId) {
    return entry.tick;
  }

  const sourceAction = rotationPlan.abilityActions.find((action) => action.id === sourceActionId);
  if (!sourceAction) {
    return entry.tick;
  }

  const abilityId = sourceAction.payload['abilityId'];
  if (typeof abilityId !== 'string') {
    return entry.tick;
  }

  const ability = catalog.abilities[abilityId];
  if (!ability) {
    return entry.tick;
  }

  if (shouldUseResolvedHitTickInPlanner(ability)) {
    return entry.tick;
  }

  return sourceAction.tick;
}

function humanizeHitId(hitId: string): string {
  return hitId
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDamageRange(range: { min: number; avg: number; max: number }): string {
  return `${formatNumber(range.min)} / ${formatNumber(range.avg)} / ${formatNumber(range.max)}`;
}

function sumModifierValues(
  modifiers: Array<{ value: number }>,
): number {
  return roundValue(modifiers.reduce((sum, modifier) => sum + modifier.value, 0));
}

function calculateMultiplierProduct(
  entry: SimulationResult['explainability']['damageBreakdowns'][number],
): number {
  if (!entry.multiplicativeModifiers.length) {
    return 1;
  }

  return roundValue(
    entry.multiplicativeModifiers.reduce((product, modifier) => {
      const match = /\bx(\d+(?:\.\d+)?)\b/i.exec(modifier.label);
      if (!match) {
        return product;
      }

      return product * Number.parseFloat(match[1]);
    }, 1),
  );
}

function extractMultiplierLabel(label: string): string {
  const match = /\bx(\d+(?:\.\d+)?)\b/i.exec(label);
  return match ? `x${match[1]}` : label;
}

function formatSignedValue(value: number): string {
  return `${value >= 0 ? '+' : ''}${formatNumber(value)}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${roundValue(value)}`;
}

function roundValue(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateCritMultiplier(baseValue: number, finalValue: number): number {
  if (baseValue <= 0) {
    return 1;
  }

  return roundValue(finalValue / baseValue);
}

function readStringPayload(action: RotationAction, key: string): string | null {
  const value = action.payload[key];
  return typeof value === 'string' && value ? value : null;
}

function shouldUseResolvedHitTickInPlanner(ability: AbilityDefinition): boolean {
  return ability.displayHints?.hitTickMode === 'resolved';
}

function isCooldownLikeBuff(definition: GameDataCatalog['buffs'][string] | undefined): boolean {
  return definition?.effectRefs?.some((effectRef) => effectRef.endsWith('-cooldown')) ?? false;
}
