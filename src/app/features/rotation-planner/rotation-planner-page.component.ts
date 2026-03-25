import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CURATED_ABILITY_UI } from '../../../game-data/abilities/curated-ability-ui';
import type { AbilityDefinition, EquipmentSlot } from '../../../game-data/types';
import { BuffConfigurationStoreService } from '../../core/buffs/buff-configuration-store.service';
import { GameDataStoreService } from '../../core/game-data/game-data-store.service';
import { PlayerStatsStoreService } from '../../core/player-stats/player-stats-store.service';
import { AbilityAvailabilityService } from '../../core/abilities/ability-availability.service';
import { GearBuilderStore } from '../gear/gear-builder.store';
import { formatEquipmentSlot } from '../gear/gear-builder.utils';
import { RotationPlannerStore } from './rotation-planner.store';
import type { RotationAction } from '../../../simulation-engine/models';
import { PLANNER_NON_GCD_TEMPLATES } from './rotation-planner.non-gcd';
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

interface PlannerLaneViewModel {
  key: 'non-gcd' | 'ability' | 'buff';
  title: string;
  summary: string;
  readOnly?: boolean;
}

interface PlannerAbilityPaletteEntry {
  definition: AbilityDefinition;
  availabilityIssue?: string;
}

interface AbilityOccupancyEntry {
  action: RotationAction;
  definition: AbilityDefinition;
  segment: 'single' | 'start' | 'middle' | 'end';
}

interface PlannerGearSwapOption {
  instanceId: string;
  definitionId: string;
  slot: EquipmentSlot;
  name: string;
  slotLabel: string;
}

@Component({
  selector: 'app-rotation-planner-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './rotation-planner-page.component.html',
  styleUrl: './rotation-planner-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RotationPlannerPageComponent {
  private warningTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly plannerStore = inject(RotationPlannerStore);
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly abilityAvailabilityService = inject(AbilityAvailabilityService);
  private readonly gearBuilderStore = inject(GearBuilderStore);
  private readonly buffConfigurationStore = inject(BuffConfigurationStoreService);
  private readonly playerStatsStore = inject(PlayerStatsStoreService);

  protected readonly startingAdrenaline = this.plannerStore.startingAdrenaline;
  protected readonly tickCount = this.plannerStore.tickCount;
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
  protected readonly selectedTick = signal(0);
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
    this.buildGearSwapOptions(),
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
    });
  });
  protected readonly abilityOccupancy = computed<Record<number, AbilityOccupancyEntry>>(() => {
    const occupancy: Record<number, AbilityOccupancyEntry> = {};

    for (const action of this.abilityActions()) {
      const definition = this.abilityDefinitionForAction(action);
      if (!definition) {
        continue;
      }

      for (const tickIndex of this.tickIndexes()) {
        const segment = getAbilitySegment(action, definition, tickIndex);
        if (!segment) {
          continue;
        }

        occupancy[tickIndex] = {
          action,
          definition,
          segment,
        };
      }
    }

    return occupancy;
  });
  protected readonly abilityPaletteEntries = computed<PlannerAbilityPaletteEntry[]>(() => {
    const availabilityMap = this.abilityAvailabilityService.availabilityMap();

    return Object.values(this.abilityCatalog())
      .map((definition) => ({
        definition,
        availabilityIssue: availabilityMap[definition.id]?.isAvailable
          ? undefined
          : availabilityMap[definition.id]?.issues[0]?.message,
      }))
      .sort((left, right) => left.definition.name.localeCompare(right.definition.name));
  });
  protected readonly nonGcdPaletteEntries = PLANNER_NON_GCD_TEMPLATES;
  protected readonly lanes: PlannerLaneViewModel[] = [
    {
      key: 'non-gcd',
      title: 'Non-GCD',
      summary: 'Any tick can hold swaps and utility.',
    },
    {
      key: 'ability',
      title: 'Ability',
      summary: 'Starts snap to the 3-tick GCD ruler.',
    },
    {
      key: 'buff',
      title: 'Buff Status',
      summary: 'Read-only lane for derived buff state.',
      readOnly: true,
    },
  ];
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

  protected laneCellLabel(laneKey: PlannerLaneViewModel['key'], tickIndex: number): string {
    const bucket = this.timelineResult().timeline.ticks[tickIndex];

    if (laneKey === 'non-gcd') {
      return bucket.nonGcdActions.length ? `${bucket.nonGcdActions.length} action(s)` : '';
    }

    if (laneKey === 'ability') {
      return bucket.abilityActions.length ? `${bucket.abilityActions.length} action(s)` : '';
    }

    return bucket.derivedBuffEntries.length ? `${bucket.derivedBuffEntries.length} buff event(s)` : '';
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

  protected abilityDefinitionForAction(action: RotationAction | null): AbilityDefinition | null {
    if (!action) {
      return null;
    }

    const abilityId = action.payload['abilityId'];
    if (typeof abilityId !== 'string') {
      return null;
    }

    return this.abilityCatalog()[abilityId] ?? null;
  }

  protected abilityPaletteEntryTitle(entry: PlannerAbilityPaletteEntry): string {
    const details = [
      entry.definition.name,
      entry.availabilityIssue ? `Blocked: ${entry.availabilityIssue}` : 'Ready to place',
      `${entry.definition.subtype} | ${entry.definition.cooldownTicks}t`,
    ];

    return details.join('\n');
  }

  protected placedAbilityTitle(action: RotationAction | null): string {
    const definition = this.abilityDefinitionForAction(action);
    if (!action || !definition) {
      return '';
    }

    return `${definition.name}\nTick ${action.tick}\nDrag to move or use remove to clear.`;
  }

  protected abilitySegmentClass(segment: AbilityOccupancyEntry['segment']): string {
    return `segment-${segment}`;
  }

  protected abilitySpan(definition: AbilityDefinition): number {
    return getAbilityTimelineSpan(definition);
  }

  protected abilityShortLabel(definition: AbilityDefinition): string {
    return definition.name
      .split(/\s+/)
      .filter((part) => Boolean(part))
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected nonGcdShortLabel(action: RotationAction): string {
    const shortLabel = action.payload['shortLabel'];
    if (typeof shortLabel === 'string' && shortLabel) {
      return shortLabel;
    }

    return action.actionType;
  }

  protected nonGcdLabel(action: RotationAction): string {
    const label = action.payload['label'];
    if (typeof label === 'string' && label) {
      return label;
    }

    return action.actionType;
  }

  protected nonGcdIconPath(action: RotationAction): string | null {
    const iconPath = action.payload['iconPath'];
    return typeof iconPath === 'string' && iconPath ? iconPath : null;
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

    const evaluation = this.plannerStore.evaluateAbilityPlacement(
      definition,
      snappedTick,
      payload.actionId,
    );

    if (!evaluation.isPlaceable) {
      this.showPlannerWarning(this.describeInvalidAbilityPlacement(definition.name, evaluation.issue));
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

    if (template.id === 'gear-swap' && payload.sourceType === 'catalog' && !this.buildGearSwapOptions().length) {
      this.showPlannerWarning('No equipable backpack items are available for a gear swap.');
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

  private describeInvalidAbilityPlacement(
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
    const options = this.buildGearSwapOptions();
    const currentInstanceId = typeof action?.payload['instanceId'] === 'string' ? action.payload['instanceId'] : null;
    const defaultInstanceId = currentInstanceId ?? options[0]?.instanceId ?? null;

    if (!options.length) {
      this.showPlannerWarning('No equipable backpack items are available for a gear swap.');

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

  private buildGearSwapOptions(): PlannerGearSwapOption[] {
    const catalog = this.gameDataStore.snapshot().catalog;
    const inventory = this.gearBuilderStore.snapshot().inventory;

    if (!catalog) {
      return [];
    }

    const options: PlannerGearSwapOption[] = [];

    for (const instance of inventory) {
      const definition = catalog.items[instance.definitionId] ?? null;

      if (!definition || !definition.slot || definition.slot === 'ammo') {
        continue;
      }

      options.push({
        instanceId: instance.instanceId,
        definitionId: definition.id,
        slot: definition.slot,
        name: definition.name,
        slotLabel: formatEquipmentSlot(definition.slot),
      });
    }

    return options.sort((left, right) => left.name.localeCompare(right.name));
  }
}

function shortLabelForGearSwap(option: PlannerGearSwapOption): string {
  const condensed = option.name
    .split(/\s+/)
    .filter((part) => Boolean(part))
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return condensed || option.slotLabel.slice(0, 4).toUpperCase();
}
