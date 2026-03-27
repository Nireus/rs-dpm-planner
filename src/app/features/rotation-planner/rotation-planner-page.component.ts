import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CURATED_ABILITY_UI } from '../../../game-data/abilities/curated-ability-ui';
import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition, EquipmentSlot } from '../../../game-data/types';
import { BuffConfigurationStoreService } from '../../core/buffs/buff-configuration-store.service';
import { GameDataStoreService } from '../../core/game-data/game-data-store.service';
import { PlayerStatsStoreService } from '../../core/player-stats/player-stats-store.service';
import { AbilityAvailabilityService } from '../../core/abilities/ability-availability.service';
import { SimulationSessionService } from '../../core/simulation/simulation-session.service';
import { GearBuilderStore } from '../gear/gear-builder.store';
import type { GearBuilderState } from '../../core/gear/gear-state';
import { RotationPlannerStore } from './rotation-planner.store';
import type { RotationAction } from '../../../simulation-engine/models';
import { PLANNER_NON_GCD_TEMPLATES } from './rotation-planner.non-gcd';
import {
  buildPlannerBuffLaneBars,
  shortLabelForBuffBar,
  type PlannerBuffLaneBar,
} from './rotation-planner-buff-lane';
import {
  buildPlannerCooldownLaneBars,
  type PlannerCooldownLaneBar,
} from './rotation-planner-cooldown-lane';
import { inspectRotationPlannerTick } from './rotation-planner-inspection';
import {
  getAbilityTimelineSpan,
  getNonGcdActionsAtTick,
  getAbilitySegment,
  type PlannerAbilityDropPayload,
  type PlannerNonGcdDropPayload,
  type PlannerNonGcdTemplate,
  snapTickToAbilityWindowStart,
} from './rotation-planner.utils';
import {
  abilityDefinitionForAction,
  buildActionValidationSummaryByAction,
  buildPlannerValidationBannerEntries,
  BASE_PLANNER_LANES,
  buildAbilityPaletteEntries,
  buildAbilityPaletteEntryTitle,
  buildAbilitySegmentClass,
  buildAbilityShortLabel,
  buildAbilityOccupancyMap,
  buildBuffBarTitle,
  buildCooldownBarTitle,
  buildPerfectEquilibriumProcMarkersByAction,
  buildPerfectEquilibriumProcLeft,
  buildPlannerGearSwapOptions,
  buildPlacedAbilityTitle,
  buildSelectedTickOverlayLeft,
  buildTimelineRowTemplate,
  COOLDOWN_PLANNER_LANE,
  describeInvalidAbilityPlacement,
  laneBarCopyMarkers,
  laneCellLabel,
  laneBarCopyTemplate,
  laneHeightRem,
  PERFECT_EQUILIBRIUM_ICON_PATH,
  type AbilityOccupancyEntry,
  type PlannerAbilityPaletteEntry,
  type PlannerActionValidationSummary,
  type PlannerGearSwapOption,
  type PlannerLaneViewModel,
  type PlannerPerfectEquilibriumProcMarker,
  buildNonGcdIconPath,
  buildNonGcdLabel,
  buildNonGcdShortLabel,
  shortLabelForGearSwap,
  shouldUseResolvedHitTickInPlanner,
} from './rotation-planner-page.helpers';
import { RotationPlannerTickInspectorComponent } from './rotation-planner-tick-inspector.component';
import { RotationPlannerGearSwapDialogComponent } from './rotation-planner-gear-swap-dialog.component';

@Component({
  selector: 'app-rotation-planner-page',
  standalone: true,
  imports: [FormsModule, RotationPlannerTickInspectorComponent, RotationPlannerGearSwapDialogComponent],
  templateUrl: './rotation-planner-page.component.html',
  styleUrl: './rotation-planner-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RotationPlannerPageComponent {
  private warningTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly plannerStore = inject(RotationPlannerStore);
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly abilityAvailabilityService = inject(AbilityAvailabilityService);
  private readonly resultsSimulationService = inject(SimulationSessionService);
  private readonly gearBuilderStore = inject(GearBuilderStore);
  private readonly buffConfigurationStore = inject(BuffConfigurationStoreService);
  private readonly playerStatsStore = inject(PlayerStatsStoreService);

  protected readonly startingAdrenaline = this.plannerStore.startingAdrenaline;
  protected readonly maxStartingAdrenaline = this.plannerStore.maxStartingAdrenaline;
  protected readonly tickCount = this.plannerStore.tickCount;
  protected readonly playerStats = this.playerStatsStore.stats;
  protected readonly timelineResult = this.plannerStore.timelineResult;
  protected readonly tickIndexes = this.plannerStore.tickIndexes;
  protected readonly nonGcdActions = this.plannerStore.nonGcdActions;
  protected readonly abilityActions = this.plannerStore.abilityActions;
  protected readonly abilityCatalog = computed<Record<string, AbilityDefinition>>(() => {
    const abilities = this.gameDataStore.snapshot().catalog?.abilities ?? {};

    return Object.fromEntries(
      Object.values(abilities).map((definition) => [
        definition.id,
        {
          ...definition,
          ...CURATED_ABILITY_UI[definition.id],
        },
      ]),
    );
  });
  protected readonly validationIssues = computed(() => this.timelineResult().validationIssues);
  protected readonly actionValidationSummaryByAction = computed<Record<string, PlannerActionValidationSummary>>(() =>
    buildActionValidationSummaryByAction(this.simulationResult()?.validationIssues ?? []),
  );
  protected readonly plannerValidationIssues = computed(() => this.simulationResult()?.validationIssues ?? []);
  protected readonly plannerValidationBannerEntries = computed(() =>
    buildPlannerValidationBannerEntries({
      issues: this.plannerValidationIssues(),
      abilityActions: this.abilityActions(),
      nonGcdActions: this.nonGcdActions(),
      abilityCatalog: this.abilityCatalog(),
    }),
  );
  protected readonly simulationResult = this.resultsSimulationService.simulationResult;
  protected readonly selectedTick = signal(0);
  protected readonly showCooldownLane = signal(false);
  protected readonly plannerWarning = signal<string | null>(null);
  protected readonly gearSwapDialogActionId = signal<string | null>(null);
  protected readonly gearSwapDialogRemovesOnCancel = signal(false);
  protected readonly selectedGearSwapInstanceId = signal<string | null>(null);
  protected readonly activeGearSwapAction = computed(() => {
    const actionId = this.gearSwapDialogActionId();
    if (!actionId) {
      return null;
    }

    return this.nonGcdActions().find((action) => action.id === actionId) ?? null;
  });
  protected readonly gearSwapOptions = computed<PlannerGearSwapOption[]>(() =>
    buildPlannerGearSwapOptions(
      this.gearBuilderStore.snapshot().inventory,
      this.gameDataStore.snapshot().catalog,
    ),
  );
  protected readonly tickInspection = computed(() => {
    const catalog = this.gameDataStore.snapshot().catalog;
    if (!catalog) {
      return null;
    }

    return inspectRotationPlannerTick({
      tick: this.selectedTick(),
      catalog,
      playerStats: this.playerStatsStore.stats(),
      gearState: this.gearBuilderStore.snapshot(),
      buffState: this.buffConfigurationStore.state(),
      rotationPlan: this.plannerStore.rotationPlan(),
      simulationResult: this.simulationResult(),
    });
  });
  protected readonly abilityOccupancy = computed<Record<number, AbilityOccupancyEntry>>(() => {
    return buildAbilityOccupancyMap(
      this.abilityActions(),
      this.tickIndexes(),
      this.abilityCatalog(),
    );
  });
  protected readonly abilityPaletteEntries = computed<PlannerAbilityPaletteEntry[]>(() => {
    return buildAbilityPaletteEntries(
      this.abilityCatalog(),
      this.abilityAvailabilityService.availabilityMap(),
    );
  });
  protected readonly buffLaneBars = computed<PlannerBuffLaneBar[]>(() => {
    const result = this.simulationResult();
    const catalog = this.gameDataStore.snapshot().catalog;

    if (!result || !catalog) {
      return [];
    }

    return buildPlannerBuffLaneBars({
      tickCount: this.tickCount(),
      buffTimeline: result.buffTimeline,
      buffDefinitions: catalog.buffs,
    });
  });
  protected readonly cooldownLaneBars = computed<PlannerCooldownLaneBar[]>(() => {
    const result = this.simulationResult();

    if (!result) {
      return [];
    }

    return buildPlannerCooldownLaneBars({
      tickCount: this.tickCount(),
      cooldownTimeline: result.cooldownTimeline,
      abilityDefinitions: this.abilityCatalog(),
    });
  });
  protected readonly perfectEquilibriumProcMarkersByAction = computed<
    Record<string, PlannerPerfectEquilibriumProcMarker[]>
  >(() => {
    return buildPerfectEquilibriumProcMarkersByAction(
      this.simulationResult(),
      this.abilityActions(),
      this.abilityCatalog(),
    );
  });
  protected readonly perfectEquilibriumIconPath = computed(() => PERFECT_EQUILIBRIUM_ICON_PATH);
  protected readonly nonGcdPaletteEntries = PLANNER_NON_GCD_TEMPLATES;
  protected readonly lanes = computed<PlannerLaneViewModel[]>(() =>
    this.showCooldownLane()
      ? [...BASE_PLANNER_LANES, COOLDOWN_PLANNER_LANE]
      : BASE_PLANNER_LANES,
  );
  protected readonly timelineRowTemplate = computed(() => {
    return buildTimelineRowTemplate(
      this.lanes(),
      this.buffLaneBars(),
      this.cooldownLaneBars(),
    );
  });
  protected draggedNonGcdPayload: PlannerNonGcdDropPayload | null = null;
  protected draggedNonGcdAction: RotationAction | null = null;
  protected draggedAbilityPayload: PlannerAbilityDropPayload | null = null;
  protected draggedAbilityAction: RotationAction | null = null;

  protected updateStartingAdrenaline(value: number | string | null): void {
    this.plannerStore.updateStartingAdrenaline(value);
  }

  protected updateTickCount(value: number | string | null): void {
    this.plannerStore.updateTickCount(value);
    this.selectedTick.update((current) => Math.max(0, Math.min(current, this.tickCount() - 1)));
  }

  protected updateRangedLevel(value: number | string | null): void {
    this.playerStatsStore.updateStat('rangedLevel', this.parseLevel(value));
  }

  protected updateSelectedTick(value: number | string | null): void {
    if (value === null || value === undefined || value === '') {
      return;
    }

    const parsedValue = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    this.selectedTick.set(Math.max(0, Math.min(Math.trunc(parsedValue), this.tickCount() - 1)));
  }

  protected selectTick(tickIndex: number): void {
    this.selectedTick.set(Math.max(0, Math.min(tickIndex, this.tickCount() - 1)));
  }

  protected toggleCooldownLane(value: boolean | string | null): void {
    this.showCooldownLane.set(value === true || value === 'true');
  }

  protected laneCellLabel(laneKey: PlannerLaneViewModel['key'], tickIndex: number): string {
    return laneCellLabel(laneKey, this.timelineResult().timeline.ticks[tickIndex]);
  }

  protected isMajorTick(tickIndex: number): boolean {
    return tickIndex % 3 === 0;
  }

  protected isAbilityPlacementTick(tickIndex: number): boolean {
    return tickIndex % 3 === 0;
  }

  protected abilityWindowStartTick(tickIndex: number): number {
    return snapTickToAbilityWindowStart(tickIndex);
  }

  protected abilityDropListId(tickIndex: number): string {
    return `ability-tick-${tickIndex}`;
  }

  protected nonGcdDropListId(tickIndex: number): string {
    return `non-gcd-tick-${tickIndex}`;
  }

  protected canDropNonGcd(tickIndex: number): boolean {
    return Boolean(this.draggedNonGcdPayload) && this.plannerStore.canPlaceNonGcdActionAtTick(tickIndex);
  }

  protected canRemoveDraggedNonGcd(): boolean {
    return this.draggedNonGcdPayload?.sourceType === 'timeline' && Boolean(this.draggedNonGcdPayload.actionId);
  }

  protected canDropAbility(tickIndex: number): boolean {
    const payload = this.draggedAbilityPayload;
    if (!payload) {
      return false;
    }

    const definition = this.abilityCatalog()[payload.abilityId];
    if (!definition) {
      return false;
    }

    return this.plannerStore.canPlaceAbilityAtTick(
      definition,
      this.abilityWindowStartTick(tickIndex),
      payload.actionId,
    );
  }

  protected placedAbilityAtTick(tickIndex: number): RotationAction | null {
    return this.timelineResult().timeline.ticks[tickIndex].abilityActions[0] ?? null;
  }

  protected abilityOccupancyAtTick(tickIndex: number): AbilityOccupancyEntry | null {
    return this.abilityOccupancy()[tickIndex] ?? null;
  }

  protected nonGcdActionsAtTick(tickIndex: number): RotationAction[] {
    return getNonGcdActionsAtTick(this.nonGcdActions(), tickIndex);
  }

  protected buffBarsStartingAtTick(tickIndex: number): PlannerBuffLaneBar[] {
    return this.buffLaneBars().filter((entry) => entry.startTick === tickIndex);
  }

  protected cooldownBarsStartingAtTick(tickIndex: number): PlannerCooldownLaneBar[] {
    return this.cooldownLaneBars().filter((entry) => entry.startTick === tickIndex);
  }

  protected buffBarTitle(bar: PlannerBuffLaneBar): string {
    return buildBuffBarTitle(bar);
  }

  protected buffBarShortLabel(bar: PlannerBuffLaneBar): string {
    return shortLabelForBuffBar(bar.name);
  }

  protected cooldownBarTitle(bar: PlannerCooldownLaneBar): string {
    return buildCooldownBarTitle(bar);
  }

  protected cooldownBarShortLabel(bar: PlannerCooldownLaneBar): string {
    return shortLabelForBuffBar(bar.name);
  }

  protected laneBarCopyMarkers(span: number): number[] {
    return laneBarCopyMarkers(span);
  }

  protected laneBarCopyTemplate(span: number): string {
    return laneBarCopyTemplate(span);
  }

  protected laneHeightStyle(laneKey: PlannerLaneViewModel['key']): string {
    return `${laneHeightRem(laneKey, this.buffLaneBars(), this.cooldownLaneBars())}rem`;
  }

  protected selectedTickOverlayLeft(): string {
    return buildSelectedTickOverlayLeft(this.selectedTick());
  }

  protected abilityDefinitionForAction(action: RotationAction | null): AbilityDefinition | null {
    return abilityDefinitionForAction(action, this.abilityCatalog());
  }

  protected abilityPaletteEntryTitle(entry: PlannerAbilityPaletteEntry): string {
    return buildAbilityPaletteEntryTitle(entry);
  }

  protected placedAbilityTitle(action: RotationAction | null): string {
    return buildPlacedAbilityTitle(
      action,
      this.abilityDefinitionForAction(action),
      action ? this.actionValidationSummary(action) : null,
    );
  }

  protected abilitySegmentClass(segment: AbilityOccupancyEntry['segment']): string {
    return buildAbilitySegmentClass(segment);
  }

  protected abilitySpan(definition: AbilityDefinition): number {
    return getAbilityTimelineSpan(definition);
  }

  protected abilityShortLabel(definition: AbilityDefinition): string {
    return buildAbilityShortLabel(definition);
  }

  protected perfectEquilibriumProcMarkers(
    action: RotationAction,
  ): PlannerPerfectEquilibriumProcMarker[] {
    return this.perfectEquilibriumProcMarkersByAction()[action.id] ?? [];
  }

  protected perfectEquilibriumProcLeft(
    action: RotationAction,
    marker: PlannerPerfectEquilibriumProcMarker,
  ): string {
    return buildPerfectEquilibriumProcLeft(
      action,
      marker,
      this.abilityDefinitionForAction(action),
    );
  }

  protected nonGcdShortLabel(action: RotationAction): string {
    return buildNonGcdShortLabel(action);
  }

  protected nonGcdLabel(action: RotationAction): string {
    return buildNonGcdLabel(action);
  }

  protected actionValidationSummary(action: RotationAction | null): PlannerActionValidationSummary | null {
    if (!action) {
      return null;
    }

    return this.actionValidationSummaryByAction()[action.id] ?? null;
  }

  protected nonGcdIconPath(action: RotationAction): string | null {
    return buildNonGcdIconPath(action);
  }

  protected onCatalogAbilityDragStart(entry: PlannerAbilityPaletteEntry): void {
    this.draggedAbilityPayload = {
      sourceType: 'catalog',
      abilityId: entry.definition.id,
    };
    this.draggedAbilityAction = null;
  }

  protected onTimelineAbilityDragStart(action: RotationAction): void {
    const abilityId = action.payload['abilityId'];
    this.draggedAbilityPayload = {
      sourceType: 'timeline',
      abilityId: typeof abilityId === 'string' ? abilityId : '',
      actionId: action.id,
    };
    this.draggedAbilityAction = action;
  }

  protected onCatalogNonGcdDragStart(template: PlannerNonGcdTemplate): void {
    this.draggedNonGcdPayload = {
      sourceType: 'catalog',
      templateId: template.id,
    };
    this.draggedNonGcdAction = null;
  }

  protected onTimelineNonGcdDragStart(action: RotationAction): void {
    const templateId = action.payload['templateId'];
    this.draggedNonGcdPayload = {
      sourceType: 'timeline',
      templateId: typeof templateId === 'string' ? templateId : '',
      actionId: action.id,
    };
    this.draggedNonGcdAction = action;
  }

  protected onAbilityDragEnd(): void {
    this.draggedAbilityPayload = null;
    this.draggedAbilityAction = null;
  }

  protected onNonGcdDragEnd(): void {
    this.draggedNonGcdPayload = null;
    this.draggedNonGcdAction = null;
  }

  protected allowAbilityDrop(event: DragEvent, tickIndex: number): void {
    if (this.draggedAbilityPayload) {
      event.preventDefault();
    }
  }

  protected allowNonGcdDrop(event: DragEvent, tickIndex: number): void {
    if (this.canDropNonGcd(tickIndex)) {
      event.preventDefault();
    }
  }

  protected dropAbilityOnTick(tickIndex: number, event: DragEvent): void {
    event.preventDefault();

    const payload = this.draggedAbilityPayload;
    const snappedTick = this.abilityWindowStartTick(tickIndex);

    if (!payload) {
      return;
    }

    const definition = this.abilityCatalog()[payload.abilityId];
    if (!definition) {
      return;
    }

    if (!this.plannerStore.canPlaceAbilityAtTick(definition, snappedTick, payload.actionId)) {
      this.showPlannerWarning(describeInvalidAbilityPlacement(definition.name, undefined));
      this.onAbilityDragEnd();
      return;
    }

    this.plannerStore.placeAbility(definition, snappedTick, payload);
    this.clearPlannerWarning();
    this.onAbilityDragEnd();
  }

  protected dropNonGcdOnTick(tickIndex: number, event: DragEvent): void {
    event.preventDefault();

    const payload = this.draggedNonGcdPayload;
    if (!payload || !this.canDropNonGcd(tickIndex)) {
      return;
    }

    const template = this.nonGcdPaletteEntries.find((entry) => entry.id === payload.templateId);
    if (!template) {
      return;
    }

    if (template.id === 'gear-swap' && payload.sourceType === 'catalog' && !this.gearSwapOptions().length) {
      this.showPlannerWarning('No equippable backpack items are available for a gear swap.');
      this.onNonGcdDragEnd();
      return;
    }

    const actionId = this.plannerStore.placeNonGcdAction(template, tickIndex, payload);
    if (!actionId) {
      return;
    }

    if (template.id === 'gear-swap' && payload.sourceType === 'catalog') {
      this.openGearSwapConfig(actionId, true);
    } else {
      this.clearPlannerWarning();
    }

    this.onNonGcdDragEnd();
  }

  protected allowNonGcdRemoval(event: DragEvent): void {
    if (this.canRemoveDraggedNonGcd()) {
      event.preventDefault();
    }
  }

  protected removeDraggedNonGcdAction(event: DragEvent): void {
    event.preventDefault();

    const actionId = this.draggedNonGcdPayload?.actionId;
    if (!actionId) {
      return;
    }

    this.plannerStore.removeNonGcdAction(actionId);
    this.onNonGcdDragEnd();
  }

  protected removePlacedAbility(actionId: string, event: Event): void {
    event.stopPropagation();
    this.plannerStore.removeAbility(actionId);
  }

  protected removePlacedNonGcdAction(actionId: string, event: Event): void {
    event.stopPropagation();
    this.plannerStore.removeNonGcdAction(actionId);
  }

  protected openNonGcdActionConfig(action: RotationAction, event: Event): void {
    event.stopPropagation();

    if (action.actionType !== 'gear-swap') {
      return;
    }

    this.openGearSwapConfig(action.id, false);
  }

  protected confirmGearSwapConfig(): void {
    const action = this.activeGearSwapAction();
    const instanceId = this.selectedGearSwapInstanceId();
    const option = this.gearSwapOptions().find((entry) => entry.instanceId === instanceId);

    if (!action || !option) {
      this.showPlannerWarning('Choose a backpack item for the gear swap.');
      return;
    }

    this.plannerStore.updateNonGcdAction(action.id, {
      instanceId: option.instanceId,
      definitionId: option.definitionId,
      slot: option.slot,
      label: `Swap: ${option.name}`,
      shortLabel: shortLabelForGearSwap(option),
      iconPath: 'icons/actions/gear-swap.svg',
    });

    this.closeGearSwapConfig(false);
  }

  protected closeGearSwapConfig(cancelled: boolean): void {
    const actionId = this.gearSwapDialogActionId();
    const shouldRemove = cancelled && this.gearSwapDialogRemovesOnCancel() && actionId;

    this.gearSwapDialogActionId.set(null);
    this.gearSwapDialogRemovesOnCancel.set(false);
    this.selectedGearSwapInstanceId.set(null);

    if (shouldRemove) {
      this.plannerStore.removeNonGcdAction(actionId);
    }
  }

  protected updateSelectedGearSwapInstanceId(value: string | null): void {
    this.selectedGearSwapInstanceId.set(value);
  }

  protected removeGearSwapActionFromDialog(): void {
    const actionId = this.gearSwapDialogActionId();
    if (!actionId) {
      return;
    }

    this.closeGearSwapConfig(false);
    this.plannerStore.removeNonGcdAction(actionId);
  }

  private showPlannerWarning(message: string): void {
    this.plannerWarning.set(message);

    if (this.warningTimeoutId) {
      clearTimeout(this.warningTimeoutId);
    }

    this.warningTimeoutId = setTimeout(() => {
      this.plannerWarning.set(null);
      this.warningTimeoutId = null;
    }, 2600);
  }

  private clearPlannerWarning(): void {
    if (this.warningTimeoutId) {
      clearTimeout(this.warningTimeoutId);
      this.warningTimeoutId = null;
    }

    this.plannerWarning.set(null);
  }

  private openGearSwapConfig(actionId: string, removesOnCancel: boolean): void {
    const action = this.nonGcdActions().find((entry) => entry.id === actionId) ?? null;
    const options = this.gearSwapOptions();
    const currentInstanceId = typeof action?.payload['instanceId'] === 'string' ? action.payload['instanceId'] : null;
    const defaultInstanceId = currentInstanceId ?? options[0]?.instanceId ?? null;

    if (!options.length) {
      this.showPlannerWarning('No equippable backpack items are available for a gear swap.');

      if (removesOnCancel) {
        this.plannerStore.removeNonGcdAction(actionId);
      }

      return;
    }

    this.gearSwapDialogActionId.set(actionId);
    this.gearSwapDialogRemovesOnCancel.set(removesOnCancel);
    this.selectedGearSwapInstanceId.set(defaultInstanceId);
    this.clearPlannerWarning();
  }

  private parseLevel(value: string | number | null): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
