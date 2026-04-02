import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition, EquipmentSlot } from '../../../game-data/types';
import { CONFIG_OPTION_IDS } from '../../../game-data/conventions/mechanics';
import { displayAbilitySubtypeLabel, styleTabThemeClass } from '../../core/abilities/ability-style-tabs';
import type { RotationAction, SimulationResult, ValidationIssue } from '../../../simulation-engine/models';
import type { GearBuilderState } from '../../core/gear/gear-state';
import { formatEquipmentSlot } from '../../core/gear/gear-builder.utils';
import type { PlannerBuffLaneBar } from './rotation-planner-buff-lane';
import type { PlannerCooldownLaneBar } from './rotation-planner-cooldown-lane';
import { getAbilitySegment, getAbilityTimelineSpan } from '../../core/rotation-planner/rotation-planner.utils';
export const PERFECT_EQUILIBRIUM_ICON_PATH =
  '/icons/wiki/equilibrium.png';
export const BLOODLUST_ICON_PATH =
  '/icons/wiki/bloodlust-max-stacks.png';
const QUIVER_SECONDARY_BOLT_AMMO_ID = 'bakriminel-bolts';

const HEADER_ROW_HEIGHT_REM = 2.7;
const DEFAULT_LANE_ROW_HEIGHT_REM = 2.96;
const STACK_LANE_BASE_HEIGHT_REM = 1.06;
const STACK_LANE_ROW_STEP_REM = 0.9;
const STACK_LANE_BOTTOM_PADDING_REM = 0.22;
const NON_GCD_TOKEN_SIZE_REM = 1.45;
const NON_GCD_STACK_GAP_REM = 0.22;
const NON_GCD_STACK_VERTICAL_PADDING_REM = 0.62;
const TICK_COLUMN_WIDTH_REM = 2.18;
const TICK_COLUMN_GAP_REM = 0.42;
const TICK_SELECTION_OVERHANG_REM = 0.16;
const PLACED_ABILITY_MARKER_SIZE_REM = 0.72;
const PERFECT_EQUILIBRIUM_MARKER_BASE_OFFSET_REM =
  roundPlannerMeasure((TICK_COLUMN_WIDTH_REM - PLACED_ABILITY_MARKER_SIZE_REM) / 2);
const PERFECT_EQUILIBRIUM_MARKER_STACK_OFFSET_REM = 0.52;

export interface PlannerLaneViewModel {
  key: 'non-gcd' | 'ability' | 'buff' | 'cooldown';
  title: string;
  summary: string;
  readOnly?: boolean;
}

export interface PlannerAbilityPaletteEntry {
  definition: AbilityDefinition;
  name: AbilityDefinition['name'];
  style: AbilityDefinition['style'];
  subtype: AbilityDefinition['subtype'];
  themeClass: string;
  availabilityIssue?: string;
}

export interface AbilityOccupancyEntry {
  action: RotationAction;
  definition: AbilityDefinition;
  segment: 'single' | 'start' | 'middle' | 'end';
  previewState?: 'inserted' | 'shifted';
}

export interface PlannerActionValidationSummary {
  issues: ValidationIssue[];
  highestSeverity: ValidationIssue['severity'];
}

export interface PlannerValidationBannerEntry {
  issueKey: string;
  tickLabel: string;
  actionLabel: string;
  message: string;
  severity: ValidationIssue['severity'];
}

export interface PlannerGearSwapOption {
  instanceId: string;
  definitionId: string;
  slot: EquipmentSlot;
  name: string;
  slotLabel: string;
  detailsLabel: string;
  optionLabel: string;
}

export interface PlannerPerfectEquilibriumProcMarker {
  tickOffset: number;
  indexAtTick: number;
}

export interface PlannerBloodlustSpendMarker {
  tickOffset: number;
  indexAtTick: number;
}

export interface PlannerTimelineTickBucket {
  nonGcdActions: unknown[];
  abilityActions: unknown[];
  derivedBuffEntries: unknown[];
}

export const BASE_PLANNER_LANES: PlannerLaneViewModel[] = [
  {
    key: 'non-gcd',
    title: 'Non-GCD',
    summary: 'Any tick can hold swaps and utility.',
  },
  {
    key: 'ability',
    title: 'Ability',
    summary: 'Starts follow live GCD windows, including post-channel offsets.',
  },
  {
    key: 'buff',
    title: 'Buff Status',
    summary: 'Read-only lane for derived buff state.',
    readOnly: true,
  },
];

export const COOLDOWN_PLANNER_LANE: PlannerLaneViewModel = {
  key: 'cooldown',
  title: 'Cooldowns',
  summary: 'Read-only lane for active cooldown windows.',
  readOnly: true,
};

export function buildAbilityOccupancyMap(
  abilityActions: RotationAction[],
  tickIndexes: number[],
  abilityCatalog: Record<string, AbilityDefinition>,
  previewTicksByActionId?: Record<string, number>,
): Record<number, AbilityOccupancyEntry> {
  const occupancy: Record<number, AbilityOccupancyEntry> = {};

  for (const action of abilityActions) {
    const definition = abilityDefinitionForAction(action, abilityCatalog);
    if (!definition) {
      continue;
    }

    for (const tickIndex of tickIndexes) {
      const segment = getAbilitySegment(action, definition, tickIndex);
      if (!segment) {
        continue;
      }

      occupancy[tickIndex] = {
        action,
        definition,
        segment,
        previewState: resolvePreviewState(action, previewTicksByActionId),
      };
    }
  }

  return occupancy;
}

function resolvePreviewState(
  action: RotationAction,
  previewTicksByActionId: Record<string, number> | undefined,
): AbilityOccupancyEntry['previewState'] {
  if (!previewTicksByActionId) {
    return undefined;
  }

  if (action.id === '__planner-preview-placement__') {
    return 'inserted';
  }

  const originalTick = previewTicksByActionId[action.id];
  if (typeof originalTick === 'number' && originalTick !== action.tick) {
    return 'shifted';
  }

  return undefined;
}

export function buildPerfectEquilibriumProcMarkersByAction(
  simulationResult: SimulationResult | null,
  abilityActions: RotationAction[],
  abilityCatalog: Record<string, AbilityDefinition>,
): Record<string, PlannerPerfectEquilibriumProcMarker[]> {
  if (!simulationResult) {
    return {};
  }

  return simulationResult.explainability.damageBreakdowns.reduce<
    Record<string, PlannerPerfectEquilibriumProcMarker[]>
  >((markersByAction, breakdown) => {
    if (breakdown.abilityId !== 'perfect-equilibrium') {
      return markersByAction;
    }

    const sourceActionId = breakdown.hitId.split(':')[0];
    if (!sourceActionId) {
      return markersByAction;
    }

    const sourceAction = abilityActions.find((action) => action.id === sourceActionId);
    if (!sourceAction) {
      return markersByAction;
    }

    const definition = abilityDefinitionForAction(sourceAction, abilityCatalog);
    const displayedProcTick =
      definition && shouldUseResolvedHitTickInPlanner(definition)
        ? breakdown.tick
        : sourceAction.tick;
    const tickOffset = Math.max(0, displayedProcTick - sourceAction.tick);
    const existingMarkers = markersByAction[sourceActionId] ?? [];
    const indexAtTick = existingMarkers.filter((marker) => marker.tickOffset === tickOffset).length;

    markersByAction[sourceActionId] = [
      ...existingMarkers,
      {
        tickOffset,
        indexAtTick,
      },
    ];

    return markersByAction;
  }, {});
}

export function buildBloodlustSpendMarkersByAction(
  simulationResult: SimulationResult | null,
  abilityActions: RotationAction[],
  abilityCatalog: Record<string, AbilityDefinition>,
): Record<string, PlannerBloodlustSpendMarker[]> {
  if (!simulationResult) {
    return {};
  }

  return abilityActions.reduce<Record<string, PlannerBloodlustSpendMarker[]>>((markersByAction, action) => {
    const definition = abilityDefinitionForAction(action, abilityCatalog);
    if (!definition || !spendsBloodlustStacks(definition)) {
      return markersByAction;
    }

    const bloodlustStacksBeforeAction = countBloodlustStacksAtTick(simulationResult.buffTimeline, action.tick - 1);
    const bloodlustStacksAfterAction = countBloodlustStacksAtTick(simulationResult.buffTimeline, action.tick);
    if (bloodlustStacksBeforeAction < 4 || bloodlustStacksAfterAction > bloodlustStacksBeforeAction - 4) {
      return markersByAction;
    }

    markersByAction[action.id] = [{
      tickOffset: 0,
      indexAtTick: 0,
    }];

    return markersByAction;
  }, {});
}

export function buildActionValidationSummaryByAction(
  issues: ValidationIssue[],
): Record<string, PlannerActionValidationSummary> {
  const summaries: Record<string, PlannerActionValidationSummary> = {};

  for (const issue of issues) {
    if (!issue.relatedActionId) {
      continue;
    }

    const existing = summaries[issue.relatedActionId];
    if (!existing) {
      summaries[issue.relatedActionId] = {
        issues: [issue],
        highestSeverity: issue.severity,
      };
      continue;
    }

    existing.issues.push(issue);
    existing.highestSeverity = compareValidationSeverity(issue.severity, existing.highestSeverity) > 0
      ? issue.severity
      : existing.highestSeverity;
  }

  return summaries;
}

export function buildPlannerGearSwapOptions(
  inventory: GearBuilderState['inventory'],
  catalog: GameDataCatalog | null,
): PlannerGearSwapOption[] {
  if (!catalog) {
    return [];
  }

  const options: PlannerGearSwapOption[] = [];

  for (const instance of inventory) {
    const definition = catalog.items[instance.definitionId] ?? null;

    if (!definition || !definition.slot) {
      continue;
    }

    const slotLabel = formatEquipmentSlot(definition.slot);
    const detailsLabel = describeGearSwapOption(instance, definition, catalog);

    options.push({
      instanceId: instance.instanceId,
      definitionId: definition.id,
      slot: definition.slot,
      name: definition.name,
      slotLabel,
      detailsLabel,
      optionLabel: formatGearSwapOptionLabel(definition.name, slotLabel, detailsLabel),
    });
  }

  return options.sort((left, right) => left.name.localeCompare(right.name));
}

export function buildTimelineRowTemplate(
  lanes: PlannerLaneViewModel[],
  buffBars: PlannerBuffLaneBar[],
  cooldownBars: PlannerCooldownLaneBar[],
  maxNonGcdStackSize: number,
): string {
  const rowHeights = lanes.map((lane) =>
    laneHeightRem(lane.key, buffBars, cooldownBars, maxNonGcdStackSize),
  );
  return `${HEADER_ROW_HEIGHT_REM}rem ${rowHeights.map((height) => `${height}rem`).join(' ')}`;
}

export function buildAbilityPaletteEntries(
  abilityCatalog: Record<string, AbilityDefinition>,
  availabilityMap: Record<string, { isAvailable: boolean; issues?: Array<{ message: string }> }>,
): PlannerAbilityPaletteEntry[] {
  return Object.values(abilityCatalog)
    .filter((definition) => !definition.displayHints?.hiddenFromUi)
    .map((definition) => ({
      definition,
      name: definition.name,
      style: definition.style,
      subtype: definition.subtype,
      themeClass: styleTabThemeClass(definition.style),
      availabilityIssue: availabilityMap[definition.id]?.isAvailable
        ? undefined
        : availabilityMap[definition.id]?.issues?.[0]?.message,
    }))
    .sort((left, right) => left.definition.name.localeCompare(right.definition.name));
}

export function laneHeightRem(
  laneKey: PlannerLaneViewModel['key'],
  buffBars: PlannerBuffLaneBar[],
  cooldownBars: PlannerCooldownLaneBar[],
  maxNonGcdStackSize: number,
): number {
  if (laneKey === 'non-gcd') {
    return dynamicNonGcdLaneHeightRem(maxNonGcdStackSize);
  }

  if (laneKey === 'buff') {
    return dynamicStackLaneHeightRem(buffBars.map((bar) => bar.row));
  }

  if (laneKey === 'cooldown') {
    return dynamicStackLaneHeightRem(cooldownBars.map((bar) => bar.row));
  }

  return DEFAULT_LANE_ROW_HEIGHT_REM;
}

export function laneBarCopyMarkers(span: number): number[] {
  const repeatEveryTicks = 12;
  const count = Math.max(1, Math.ceil(span / repeatEveryTicks));
  return Array.from({ length: count }, (_, index) => index);
}

export function laneBarCopyTemplate(span: number): string {
  return `repeat(${laneBarCopyMarkers(span).length}, minmax(0, 1fr))`;
}

export function laneCellLabel(
  laneKey: PlannerLaneViewModel['key'],
  bucket: PlannerTimelineTickBucket,
): string {
  if (laneKey === 'non-gcd') {
    return bucket.nonGcdActions.length ? `${bucket.nonGcdActions.length} action(s)` : '';
  }

  if (laneKey === 'ability') {
    return bucket.abilityActions.length ? `${bucket.abilityActions.length} action(s)` : '';
  }

  if (laneKey === 'cooldown') {
    return '';
  }

  return bucket.derivedBuffEntries.length ? `${bucket.derivedBuffEntries.length} buff event(s)` : '';
}

export function buildAbilityPaletteEntryTitle(entry: PlannerAbilityPaletteEntry): string {
  const details = [
    entry.definition.name,
    entry.availabilityIssue ? `Blocked: ${entry.availabilityIssue}` : 'Ready to place',
    `${displayAbilitySubtypeLabel(entry.definition.subtype)} | ${entry.definition.cooldownTicks}t`,
  ];

  return details.join('\n');
}

export function buildPlacedAbilityTitle(
  action: RotationAction | null,
  definition: AbilityDefinition | null,
  validationSummary?: PlannerActionValidationSummary | null,
): string {
  if (!action || !definition) {
    return '';
  }

  const lines = [
    definition.name,
    `Tick ${action.tick}`,
    'Drag to move or use remove to clear.',
  ];

  if (validationSummary?.issues.length) {
    lines.push('', ...validationSummary.issues.map((issue) => `Issue: ${issue.message}`));
  }

  return lines.join('\n');
}

export function buildAbilitySegmentClass(
  segment: AbilityOccupancyEntry['segment'],
): string {
  return `segment-${segment}`;
}

export function buildPlacedAbilityThemeClass(definition: AbilityDefinition): string {
  return styleTabThemeClass(definition.style);
}

export function buildAbilityShortLabel(definition: AbilityDefinition): string {
  return definition.name
    .split(/\s+/)
    .filter((part) => Boolean(part))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function buildSelectedTickOverlayLeft(selectedTick: number): string {
  return `calc(${selectedTick} * (${TICK_COLUMN_WIDTH_REM}rem + ${TICK_COLUMN_GAP_REM}rem) - ${TICK_SELECTION_OVERHANG_REM}rem)`;
}

export function buildPerfectEquilibriumProcLeft(
  action: RotationAction,
  marker: PlannerPerfectEquilibriumProcMarker,
  definition: AbilityDefinition | null,
): string {
  return buildPlacedAbilityMarkerLeft(action, marker, definition);
}

export function buildPlacedAbilityMarkerLeft(
  action: RotationAction,
  marker: PlannerPerfectEquilibriumProcMarker | PlannerBloodlustSpendMarker,
  definition: AbilityDefinition | null,
): string {
  const offset = Math.max(0, marker.tickOffset);
  return `calc(${offset} * (${TICK_COLUMN_WIDTH_REM}rem + ${TICK_COLUMN_GAP_REM}rem) + ${PERFECT_EQUILIBRIUM_MARKER_BASE_OFFSET_REM}rem + (${marker.indexAtTick} * ${PERFECT_EQUILIBRIUM_MARKER_STACK_OFFSET_REM}rem))`;
}

export function buildNonGcdShortLabel(action: RotationAction): string {
  const shortLabel = action.payload['shortLabel'];
  if (typeof shortLabel === 'string' && shortLabel) {
    return shortLabel;
  }

  return action.actionType;
}

export function buildNonGcdLabel(action: RotationAction): string {
  const label = action.payload['label'];
  if (typeof label === 'string' && label) {
    return label;
  }

  return action.actionType;
}

export function buildActionIssueBadgeLabel(summary: PlannerActionValidationSummary | null | undefined): string | null {
  if (!summary?.issues.length) {
    return null;
  }

  return `${summary.issues.length}`;
}

export function buildPlannerValidationBannerEntries(input: {
  issues: ValidationIssue[];
  abilityActions: RotationAction[];
  nonGcdActions: RotationAction[];
  abilityCatalog: Record<string, AbilityDefinition>;
}): PlannerValidationBannerEntry[] {
  const actionsById = new Map<string, RotationAction>();

  for (const action of input.nonGcdActions) {
    actionsById.set(action.id, action);
  }

  for (const action of input.abilityActions) {
    actionsById.set(action.id, action);
  }

  return input.issues.map((issue, index) => {
    const action = issue.relatedActionId ? actionsById.get(issue.relatedActionId) ?? null : null;
    const tick = typeof issue.tick === 'number' ? issue.tick : action?.tick;

    return {
      issueKey: `${issue.relatedActionId ?? 'global'}:${issue.code}:${issue.message}:${index}`,
      tickLabel: typeof tick === 'number' ? `T${tick}` : 'Timeline',
      actionLabel: action ? resolvePlannerActionLabel(action, input.abilityCatalog) : 'Validation',
      message: issue.message,
      severity: issue.severity,
    };
  });
}

export function buildNonGcdIconPath(action: RotationAction): string | null {
  const iconPath = action.payload['iconPath'];
  return typeof iconPath === 'string' && iconPath ? iconPath : null;
}

export function buildBuffBarTitle(bar: PlannerBuffLaneBar): string {
  const details = [
    bar.name,
    `Active T${bar.startTick}-T${bar.endTick}`,
  ];

  if (bar.stackPeak > 1) {
    details.push(`Peak stack ${bar.stackPeak}`);
  }

  return details.join('\n');
}

export function buildCooldownBarTitle(bar: PlannerCooldownLaneBar): string {
  return `${bar.name}\nCooldown T${bar.startTick}-T${bar.endTick}`;
}

export function describeInvalidAbilityPlacement(
  abilityName: string,
  issue: { code?: string; message: string } | undefined,
): string {
  if (!issue) {
    return `${abilityName} cannot be placed on that tick.`;
  }

  if (issue.code === 'ability.cooldown_conflict') {
    return `${abilityName} is still on cooldown at that tick.`;
  }

  if (issue.code === 'ability.insufficient_adrenaline') {
    return `Not enough adrenaline to place ${abilityName} there.`;
  }

  return issue.message || `${abilityName} cannot be placed on that tick.`;
}

export function shortLabelForGearSwap(option: PlannerGearSwapOption): string {
  const condensed = option.name
    .split(/\s+/)
    .filter((part) => Boolean(part))
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return condensed || option.slotLabel.slice(0, 4).toUpperCase();
}

export function shouldUseResolvedHitTickInPlanner(definition: AbilityDefinition): boolean {
  return definition.displayHints?.hitTickMode === 'resolved';
}

export function formatGearSwapOptionLabel(
  name: string,
  slotLabel: string,
  detailsLabel: string,
): string {
  return detailsLabel ? `${name} - ${slotLabel} - ${detailsLabel}` : `${name} - ${slotLabel}`;
}

export function describeGearSwapOption(
  instance: GearBuilderState['inventory'][number],
  definition: NonNullable<GameDataCatalog['items'][string]>,
  catalog: GameDataCatalog,
): string {
  const details: string[] = [];

  const configuredPerks = instance.configuredPerks ?? [];
  if (configuredPerks.length) {
    const perkLabel = configuredPerks
      .map((perk) => {
        const perkName = catalog.perks[perk.perkId]?.name ?? perk.perkId;
        const shortName = perkName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? '')
          .join('');
        return typeof perk.rank === 'number' ? `${shortName}${perk.rank}` : shortName;
      })
      .join(', ');

    if (perkLabel) {
      details.push(`Perks ${perkLabel}`);
    }
  }

  if (definition.id === 'pernixs-quiver') {
    const loadedAmmo = resolveStringConfigOptionValue(definition, instance, CONFIG_OPTION_IDS.loadedAmmo);
    if (loadedAmmo) {
      details.push(`Arrows ${catalog.items[loadedAmmo]?.name ?? loadedAmmo}`);
    }

    details.push(`Bolts ${catalog.items[QUIVER_SECONDARY_BOLT_AMMO_ID]?.name ?? QUIVER_SECONDARY_BOLT_AMMO_ID}`);
  }

  if (definition.id === 'essence-of-finality') {
    const storedSpecial = resolveStringConfigOptionValue(definition, instance, 'stored-special');
    if (storedSpecial && storedSpecial !== 'none') {
      details.push(
        `Spec ${catalog.items[storedSpecial]?.name ?? humanizeStoredSpecialId(storedSpecial)}`,
      );
    }
  }

  return details.join(' | ');
}

export function resolveStringConfigOptionValue(
  definition: NonNullable<GameDataCatalog['items'][string]>,
  instance: GearBuilderState['inventory'][number],
  optionId: string,
): string | null {
  const configuredValue = instance.configValues?.[optionId];
  if (typeof configuredValue === 'string' && configuredValue) {
    return configuredValue;
  }

  const defaultValue = definition.configOptions?.find((option) => option.id === optionId)?.defaultValue;
  return typeof defaultValue === 'string' ? defaultValue : null;
}

export function humanizeStoredSpecialId(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function abilityDefinitionForAction(
  action: RotationAction | null,
  abilityCatalog: Record<string, AbilityDefinition>,
): AbilityDefinition | null {
  if (!action) {
    return null;
  }

  const abilityId = action.payload['abilityId'];
  if (typeof abilityId !== 'string') {
    return null;
  }

  return abilityCatalog[abilityId] ?? null;
}

function dynamicStackLaneHeightRem(rows: number[]): number {
  const stackRows = rows.length ? Math.max(...rows) + 1 : 1;
  const stackedHeight =
    STACK_LANE_BASE_HEIGHT_REM +
    (stackRows - 1) * STACK_LANE_ROW_STEP_REM +
    STACK_LANE_BOTTOM_PADDING_REM;

  return Math.max(DEFAULT_LANE_ROW_HEIGHT_REM, stackedHeight);
}

function dynamicNonGcdLaneHeightRem(maxStackSize: number): number {
  const clampedStackSize = Math.max(1, maxStackSize);
  const stackedHeight =
    NON_GCD_STACK_VERTICAL_PADDING_REM +
    (clampedStackSize * NON_GCD_TOKEN_SIZE_REM) +
    ((clampedStackSize - 1) * NON_GCD_STACK_GAP_REM);

  return Math.max(DEFAULT_LANE_ROW_HEIGHT_REM, stackedHeight);
}

function compareValidationSeverity(
  left: ValidationIssue['severity'],
  right: ValidationIssue['severity'],
): number {
  const rank: Record<ValidationIssue['severity'], number> = {
    info: 1,
    warning: 2,
    error: 3,
  };

  return rank[left] - rank[right];
}

function resolvePlannerActionLabel(
  action: RotationAction,
  abilityCatalog: Record<string, AbilityDefinition>,
): string {
  if (action.lane === 'ability') {
    const abilityId = action.payload['abilityId'];
    return typeof abilityId === 'string'
      ? abilityCatalog[abilityId]?.name ?? abilityId
      : action.id;
  }

  return buildNonGcdLabel(action);
}

function countBloodlustStacksAtTick(
  buffTimeline: Record<number, string[]>,
  tick: number,
): number {
  if (tick < 0) {
    return 0;
  }

  return (buffTimeline[tick] ?? []).filter((buffId) => buffId === 'bloodlust').length;
}

function roundPlannerMeasure(value: number): number {
  return Math.round(value * 100) / 100;
}

function spendsBloodlustStacks(definition: AbilityDefinition): boolean {
  return definition.stackEffects?.some((effect) =>
    effect.buffId === 'bloodlust' &&
    effect.operation === 'spend' &&
    effect.stacks > 0
  ) ?? false;
}

