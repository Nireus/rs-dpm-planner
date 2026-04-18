import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition, EquipmentSlot } from '../../../game-data/types';
import { CONFIG_OPTION_IDS, EFFECT_REF_IDS } from '../../../game-data/conventions/mechanics';
import type { CombatChoices } from '../../../simulation-engine/models';
import type { GearBuilderState } from '../../core/gear/gear-state';
import { projectGearStateAtTick } from '../../core/gear/project-gear-state';
import { formatEquipmentSlot } from '../gear/gear-builder.utils';
import type {
  PlayerStats,
  RotationAction,
  RotationPlan,
  SimulationConfig,
  SimulationResult,
  ValidationIssue,
} from '../../../simulation-engine/models';
import { resolveEffectiveAmmoSelection } from '../../core/gear/effective-ammo-selection';
import { simulateBaseDamage } from '../../../simulation-engine/calculators';
import { parsePerfectEquilibriumThreshold } from '../../../simulation-engine/buffs/buff-effect-refs';
import { resolveBuffStackRuleState } from '../../../simulation-engine/buffs/buff-stack-rules';
import { resolveAdrenalineTimeline } from '../../../simulation-engine/resolvers/adrenaline';
import { resolveCooldownTimeline } from '../../../simulation-engine/resolvers/cooldowns';
import {
  buildBaseTimeline,
  cloneDefaultPreFightPlan,
  expandPreFightSimulationConfig,
  GCD_TICKS,
  mapPreFightVisualTickToSimulationTick,
} from '../../../simulation-engine/timeline';
import { projectSimulationConfigAtTick } from '../../../simulation-engine/state/projected-gear-state';
import { resolveActiveMagicSpellDefinition } from '../../../simulation-engine/spells/selected-spell';
import {
  buildRotationPlannerSimulationConfig,
  collectPersistentBuffIds,
  type PlannerBuffStateSnapshot,
} from './rotation-planner-simulation';

const QUIVER_SECONDARY_BOLT_AMMO_ID = 'bakriminel-bolts';
const PERFECT_EQUILIBRIUM_DEFAULT_THRESHOLD = 8;

export interface RotationPlannerTickInspection {
  tick: number;
  adrenaline: {
    start: number;
    end: number;
  };
  activeSpell: {
    name: string;
    spellbookId: string;
  } | null;
  deathsporeStacks: number | null;
  perfectEquilibriumStacks: number | null;
  perfectEquilibriumThreshold: number | null;
  bloodlustStacks: number | null;
  bloodlustMaxStacks: number | null;
  glacialEmbraceStacks: number | null;
  glacialEmbraceMaxStacks: number | null;
  essenceCorruptionStacks: number | null;
  essenceCorruptionMaxStacks: number | null;
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
  combatChoices?: CombatChoices;
  gearState: GearBuilderState;
  buffState: PlannerBuffStateSnapshot;
  rotationPlan: RotationPlan;
  simulationResult?: SimulationResult | null;
}): RotationPlannerTickInspection {
  const baseSimulationConfig = buildRotationPlannerSimulationConfig(input);
  const runtime = buildInspectionRuntime(input.tick, baseSimulationConfig, input.simulationResult);
  const bucket = runtime.timelineResult.timeline.ticks[runtime.engineTick];
  const adrenalineTickState = runtime.adrenalineResult.tickStates[runtime.engineTick];
  const cooldownTickState = runtime.cooldownResult.tickStates[runtime.engineTick];
  const simulatedTickState = runtime.simulationResult.tickStates[runtime.engineTick];
  const projectedConfig = projectSimulationConfigAtTick(runtime.simulationConfig, runtime.engineTick);
  const activeSpell = resolveActiveMagicSpellDefinition(projectedConfig);
  const persistentBuffIds = simulatedTickState?.activePersistentBuffIds ?? collectPersistentBuffIds(input.buffState, input.catalog);
  const temporaryBuffIds = (simulatedTickState?.activeTimelineBuffIds ?? []).filter(
    (buffId) => !isCooldownLikeBuff(input.catalog.buffs[buffId]),
  );
  const projectedGearState = projectGearStateAtTick(
    input.gearState,
    input.catalog.items,
    runtime.simulationConfig.rotationPlan.nonGcdActions,
    runtime.engineTick,
  );
  const deathsporeAmmoActive = hasDeathsporeAmmoEquipped(projectedGearState, input.catalog);
  const perfectEquilibriumWeaponActive = hasEquippedBolg(projectedGearState, input.catalog);
  const perfectEquilibriumThreshold = perfectEquilibriumWeaponActive
    ? resolvePerfectEquilibriumThreshold(input.catalog, simulatedTickState?.activeTimelineBuffIds ?? [])
    : null;
  const bloodlustStacks = countBuffStacks(simulatedTickState?.activeTimelineBuffIds ?? [], 'bloodlust');
  const meleeWeaponActive = hasEquippedMeleeWeapon(projectedGearState, input.catalog);
  const bloodlustStackState = resolveBuffStackRuleState(
    input.catalog.buffs['bloodlust'],
    simulatedTickState?.activeTimelineBuffIds ?? [],
  );
  const glacialEmbraceStacks = countBuffStacks(simulatedTickState?.activeTimelineBuffIds ?? [], 'glacial-embrace');
  const glacialEmbraceStackState = resolveBuffStackRuleState(
    input.catalog.buffs['glacial-embrace'],
    simulatedTickState?.activeTimelineBuffIds ?? [],
  );
  const essenceCorruptionStacks = countBuffStacks(simulatedTickState?.activeTimelineBuffIds ?? [], 'essence-corruption');
  const essenceCorruptionStackState = resolveBuffStackRuleState(
    input.catalog.buffs['essence-corruption'],
    simulatedTickState?.activeTimelineBuffIds ?? [],
  );

  return {
    tick: runtime.displayTick,
    adrenaline: {
      start: adrenalineTickState?.valueAtTickStart ?? input.rotationPlan.startingAdrenaline,
      end: adrenalineTickState?.valueAtTickEnd ?? input.rotationPlan.startingAdrenaline,
    },
    activeSpell: activeSpell
      ? {
          name: activeSpell.name,
          spellbookId: activeSpell.spellbookId,
        }
      : null,
    deathsporeStacks:
      deathsporeAmmoActive && typeof simulatedTickState?.deathsporeStacks === 'number'
        ? simulatedTickState.deathsporeStacks
        : null,
    perfectEquilibriumStacks:
      perfectEquilibriumWeaponActive && typeof simulatedTickState?.perfectEquilibriumStacks === 'number'
        ? simulatedTickState.perfectEquilibriumStacks
        : null,
    perfectEquilibriumThreshold,
    bloodlustStacks: meleeWeaponActive ? bloodlustStacks : null,
    bloodlustMaxStacks: meleeWeaponActive ? bloodlustStackState.maxStacks : null,
    glacialEmbraceStacks:
      activeSpell?.id === 'incite-fear' || glacialEmbraceStacks > 0
        ? glacialEmbraceStacks
        : null,
    glacialEmbraceMaxStacks:
      activeSpell?.id === 'incite-fear' || glacialEmbraceStacks > 0
        ? glacialEmbraceStackState.maxStacks
        : null,
    essenceCorruptionStacks:
      essenceCorruptionStacks > 0
        ? essenceCorruptionStacks
        : null,
    essenceCorruptionMaxStacks:
      essenceCorruptionStacks > 0
        ? essenceCorruptionStackState.maxStacks
        : null,
    activePersistentBuffs: persistentBuffIds.map(
      (buffId) => input.catalog.buffs[buffId]?.name ?? input.catalog.relics[buffId]?.name ?? buffId,
    ),
    activeTemporaryBuffs: temporaryBuffIds
      .filter((buffId) =>
        buffId !== 'bloodlust' &&
        buffId !== 'glacial-embrace' &&
        buffId !== 'essence-corruption',
      )
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
      readyAtTick: runtime.engineTickToDisplayTick(readyAtTick),
      remainingTicks: Math.max(readyAtTick - runtime.engineTick, 0),
    })),
    actionsStarting: [
      ...bucket.nonGcdActions.map((action) => readPlannerActionLabel(action)),
      ...bucket.abilityActions.map((action) => readAbilityActionInspectionLabel(action, input.catalog)),
    ],
    hitsResolving: collectResolvedHitLabelsAtTick(
      runtime.simulationResult,
      runtime.engineTick,
      input.catalog,
      runtime.simulationConfig.rotationPlan,
    ),
    damageCalculations: collectDamageCalculationsAtTick(
      runtime.simulationResult,
      runtime.engineTick,
      input.catalog,
      runtime.simulationConfig.rotationPlan,
    ),
    validationIssues: [
      ...validationIssuesAtEngineTick(runtime.timelineResult.validationIssues, runtime),
      ...validationIssuesAtEngineTick(runtime.adrenalineResult.validationIssues, runtime),
      ...validationIssuesAtEngineTick(runtime.cooldownResult.validationIssues, runtime),
      ...validationIssuesAtEngineTick(runtime.additionalValidationIssues, runtime),
      ...validationIssuesAtEngineTick(runtime.simulationResult.validationIssues, runtime),
    ],
  };
}

interface InspectionRuntime {
  simulationConfig: SimulationConfig;
  timelineResult: ReturnType<typeof buildBaseTimeline>;
  adrenalineResult: ReturnType<typeof resolveAdrenalineTimeline>;
  cooldownResult: ReturnType<typeof resolveCooldownTimeline>;
  simulationResult: SimulationResult;
  engineTick: number;
  displayTick: number;
  additionalValidationIssues: ValidationIssue[];
  engineTickToDisplayTick: (tick: number) => number;
}

function buildInspectionRuntime(
  requestedTick: number,
  baseSimulationConfig: SimulationConfig,
  providedSimulationResult?: SimulationResult | null,
): InspectionRuntime {
  const preFightExpansion = expandPreFightSimulationConfig(baseSimulationConfig);

  if (preFightExpansion) {
    const preFight = preFightExpansion.config.rotationPlan.preFight;
    const setupTick = -(preFight?.gapTicks ?? 0);
    const expandedSimulationConfig = {
      ...preFightExpansion.config,
      rotationPlan: {
        ...preFightExpansion.config.rotationPlan,
        preFight: cloneDefaultPreFightPlan(),
      },
    };
    const requestedActualTick = requestedTick < 0
      ? mapPreFightVisualTickToSimulationTick(requestedTick, setupTick)
      : Math.trunc(requestedTick);
    const engineTick = clampTick(
      requestedActualTick + preFightExpansion.offsetTicks,
      expandedSimulationConfig.rotationPlan.tickCount,
    );
    const engineTickToDisplayTick = (tick: number): number => {
      const actualTick = tick - preFightExpansion.offsetTicks;
      return actualTick < 0
        ? actualTick - setupTick - GCD_TICKS
        : actualTick;
    };

    return {
      simulationConfig: expandedSimulationConfig,
      timelineResult: buildBaseTimeline({ rotationPlan: expandedSimulationConfig.rotationPlan }),
      adrenalineResult: resolveAdrenalineTimeline(expandedSimulationConfig),
      cooldownResult: resolveCooldownTimeline(expandedSimulationConfig),
      simulationResult: simulateBaseDamage(expandedSimulationConfig),
      engineTick,
      displayTick: engineTickToDisplayTick(engineTick),
      additionalValidationIssues: preFightExpansion.validationIssues,
      engineTickToDisplayTick,
    };
  }

  if (requestedTick < 0) {
    const offsetTicks = Math.abs(Math.trunc(requestedTick));
    const expandedSimulationConfig = {
      ...baseSimulationConfig,
      rotationPlan: {
        ...baseSimulationConfig.rotationPlan,
        tickCount: baseSimulationConfig.rotationPlan.tickCount + offsetTicks,
        abilityActions: baseSimulationConfig.rotationPlan.abilityActions.map((action) =>
          shiftInspectionAction(action, offsetTicks),
        ),
        nonGcdActions: baseSimulationConfig.rotationPlan.nonGcdActions.map((action) =>
          shiftInspectionAction(action, offsetTicks),
        ),
        preFight: cloneDefaultPreFightPlan(),
      },
    };
    const engineTick = 0;
    const engineTickToDisplayTick = (tick: number): number => tick - offsetTicks;

    return {
      simulationConfig: expandedSimulationConfig,
      timelineResult: buildBaseTimeline({ rotationPlan: expandedSimulationConfig.rotationPlan }),
      adrenalineResult: resolveAdrenalineTimeline(expandedSimulationConfig),
      cooldownResult: resolveCooldownTimeline(expandedSimulationConfig),
      simulationResult: simulateBaseDamage(expandedSimulationConfig),
      engineTick,
      displayTick: engineTickToDisplayTick(engineTick),
      additionalValidationIssues: [],
      engineTickToDisplayTick,
    };
  }

  const engineTick = clampTick(requestedTick, baseSimulationConfig.rotationPlan.tickCount);

  return {
    simulationConfig: baseSimulationConfig,
    timelineResult: buildBaseTimeline({ rotationPlan: baseSimulationConfig.rotationPlan }),
    adrenalineResult: resolveAdrenalineTimeline(baseSimulationConfig),
    cooldownResult: resolveCooldownTimeline(baseSimulationConfig),
    simulationResult: providedSimulationResult ?? simulateBaseDamage(baseSimulationConfig),
    engineTick,
    displayTick: engineTick,
    additionalValidationIssues: [],
    engineTickToDisplayTick: (tick) => tick,
  };
}

function shiftInspectionAction(action: RotationAction, offsetTicks: number): RotationAction {
  return {
    ...action,
    tick: action.tick + offsetTicks,
  };
}

function clampTick(tick: number, tickCount: number): number {
  if (!Number.isFinite(tick)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.trunc(tick), Math.max(0, tickCount - 1)));
}

function validationIssuesAtEngineTick(
  issues: ValidationIssue[],
  runtime: Pick<InspectionRuntime, 'engineTick' | 'engineTickToDisplayTick'>,
): ValidationIssue[] {
  return issues
    .filter((issue) => issue.tick === runtime.engineTick)
    .map((issue) => ({
      ...issue,
      tick: typeof issue.tick === 'number'
        ? runtime.engineTickToDisplayTick(issue.tick)
        : issue.tick,
    }));
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

function resolvePerfectEquilibriumThreshold(
  catalog: GameDataCatalog,
  activeTimelineBuffIds: string[],
): number {
  return activeTimelineBuffIds
    .flatMap((buffId) => catalog.buffs[buffId]?.effectRefs ?? [])
    .map((effectRef) => parsePerfectEquilibriumThreshold(effectRef))
    .find((value): value is number => typeof value === 'number') ?? PERFECT_EQUILIBRIUM_DEFAULT_THRESHOLD;
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
  if (action.actionType === 'spell-swap') {
    const spellLabel = action.payload['label'];
    if (typeof spellLabel === 'string' && spellLabel) {
      return `Spell Swap: ${spellLabel.replace(/^Spell:\s*/i, '')}`;
    }

    return 'Spell Swap';
  }

  const label = action.payload['label'];
  return typeof label === 'string' && label ? label : action.actionType;
}

function readAbilityActionInspectionLabel(action: RotationAction, catalog: GameDataCatalog): string {
  const configuredLabel = readConfiguredSpellCastLabel(action);
  const abilityId = action.payload['abilityId'];
  const abilityLabel = configuredLabel ?? (
    typeof abilityId === 'string'
      ? catalog.abilities[abilityId]?.name ?? abilityId
      : action.id
  );
  const preFightPhase = action.payload['preFightPhase'];

  if (preFightPhase === 'prebuild') {
    return `${abilityLabel} (prebuild)`;
  }

  if (preFightPhase === 'stalled-cast') {
    return `${abilityLabel} (stalled)`;
  }

  if (preFightPhase === 'stalled-release') {
    return `${abilityLabel} (stall release)`;
  }

  return abilityLabel;
}

function readConfiguredSpellCastLabel(action: RotationAction | null): string | null {
  if (action?.payload['abilityId'] !== 'cast-spell') {
    return null;
  }

  const label = action.payload['label'];
  return typeof label === 'string' && label ? label : 'Cast Spell';
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
      const sourceActionId = entry.hitId.split(':')[0];
      const sourceAction = sourceActionId
        ? rotationPlan.abilityActions.find((action) => action.id === sourceActionId) ?? null
        : null;
      const abilityName = readConfiguredSpellCastLabel(sourceAction) ??
        catalog.abilities[entry.abilityId]?.name ??
        humanizeHitId(entry.abilityId);
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
    .map((entry) => buildDamageCalculationEntry(entry, catalog, rotationPlan));
}

function buildDamageCalculationEntry(
  entry: SimulationResult['explainability']['damageBreakdowns'][number],
  catalog: GameDataCatalog,
  rotationPlan: RotationPlan,
): RotationPlannerTickInspection['damageCalculations'][number] {
  const sourceActionId = entry.hitId.split(':')[0];
  const sourceAction = sourceActionId
    ? rotationPlan.abilityActions.find((action) => action.id === sourceActionId) ?? null
    : null;
  const abilityName = readConfiguredSpellCastLabel(sourceAction) ??
    catalog.abilities[entry.abilityId]?.name ??
    humanizeHitId(entry.abilityId);
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

  const procEfficacyStep = typeof entry.derivedParts?.procEfficacy === 'number'
    ? `Proc efficacy: ${formatPercent(entry.derivedParts.procEfficacy)}`
    : null;

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
      ? `Min x${formatNumber(critMinMultiplier)}, Avg x${formatNumber(critAvgMultiplier)}, Max x${formatNumber(critMaxMultiplier)} (crit)${procEfficacyStep ? `; ${procEfficacyStep}` : ''}`
      : procEfficacyStep ?? 'No crit multiplier',
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

function formatPercent(value: number): string {
  return `${formatNumber(value * 100)}%`;
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
