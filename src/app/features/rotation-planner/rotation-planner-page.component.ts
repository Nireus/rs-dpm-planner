import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ABILITY_STYLE_TABS,
  abilityStyleEmptyMessage,
  filterAbilitiesByStyle,
  groupAbilitiesBySubtype,
} from '../../core/abilities/ability-style-tabs';
import { CONFIG_OPTION_IDS, EFFECT_REF_IDS } from '../../../game-data/conventions/mechanics';
import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition, CombatStyle, EquipmentSlot, SpellDefinition } from '../../../game-data/types';
import { BuffConfigurationStoreService } from '../../core/buffs/buff-configuration-store.service';
import { CombatChoicesStoreService } from '../../core/combat-choices/combat-choices-store.service';
import { GameDataStoreService } from '../../core/game-data/game-data-store.service';
import { PlayerStatsStoreService } from '../../core/player-stats/player-stats-store.service';
import { AbilityAvailabilityService } from '../../core/abilities/ability-availability.service';
import { SimulationSessionService } from '../../core/simulation/simulation-session.service';
import { SimulationSettingsStoreService } from '../../core/simulation/simulation-settings-store.service';
import { GearBuilderStore } from '../gear/gear-builder.store';
import { resolveEffectiveAmmoSelection } from '../../core/gear/effective-ammo-selection';
import { projectGearStateAtTick } from '../../core/gear/project-gear-state';
import { RotationPlannerStore } from './rotation-planner.store';
import {
  SEREN_GODBOW_TARGET_ARROWS,
  SEREN_GODBOW_TARGET_SIZE_VALUES,
  type PreFightAbilityAction,
  type RotationAction,
  type SerenGodbowTargetSize,
} from '../../../simulation-engine/models';
import {
  ESSENCE_OF_FINALITY_ABILITY_ID,
  SEREN_GODBOW_ABILITY_ID,
  SEREN_GODBOW_EFFECT_REF,
  SEREN_GODBOW_WEAPON_ID,
  WEAPON_SPECIAL_ATTACK_ABILITY_ID,
} from '../../../simulation-engine/abilities/effective-ability.constants';
import { buildPreFightSchedule, GCD_TICKS, getPreFightAbilityTimelineSpan } from '../../../simulation-engine/timeline';
import {
  ADRENALINE_POTION_VARIANTS,
  getAdrenalinePotionVariant,
  type AdrenalinePotionVariantId,
} from '../../../simulation-engine/actions/adrenaline-potions';
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
  buildAbilityPlacementTicks,
  buildAbilityGapControls,
  getAbilityTimelineSpan,
  getNonGcdActionsAtTick,
  getAbilitySegment,
  previewAbilityActionsWithPlacement,
  type PlannerAbilityDropPayload,
  type PlannerAbilityGapControl,
  type PlannerNonGcdDropPayload,
  type PlannerNonGcdTemplate,
  snapTickToAbilityWindowStart,
} from './rotation-planner.utils';
import { canPlaceAbilityOnPlannerLane } from './rotation-planner-placement';
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
  buildBloodlustSpendMarkersByAction,
  buildInstabilityProcMarkersByAction,
  buildPlacedAbilityMarkerLeft,
  buildCooldownBarTitle,
  buildPerfectEquilibriumProcMarkersByAction,
  buildPlannerGearSwapOptions,
  buildPlacedAbilityDisplayName,
  buildPlacedAbilityTitle,
  buildPlacedAbilityThemeClass,
  buildTimelineRowTemplate,
  COOLDOWN_PLANNER_LANE,
  describeInvalidAbilityPlacement,
  laneBarCopyMarkers,
  laneCellLabel,
  laneBarCopyTemplate,
  laneHeightRem,
  INSTABILITY_ICON_PATH,
  PERFECT_EQUILIBRIUM_ICON_PATH,
  BLOODLUST_ICON_PATH,
  type AbilityOccupancyEntry,
  type PlannerAbilityPaletteEntry,
  type PlannerActionValidationSummary,
  type PlannerBloodlustSpendMarker,
  type PlannerGearSwapOption,
  type PlannerInstabilityProcMarker,
  type PlannerLaneViewModel,
  type PlannerPerfectEquilibriumProcMarker,
  buildNonGcdIconPath,
  buildNonGcdLabel,
  buildNonGcdShortLabel,
  shortLabelForGearSwap,
  shouldUseResolvedHitTickInPlanner,
} from './rotation-planner-page.helpers';
import { evaluateAbilityAvailability } from '../../../simulation-engine/rules/ability-availability';
import { RotationPlannerTickInspectorComponent } from './rotation-planner-tick-inspector.component';
import { RotationPlannerGearSwapDialogComponent } from './rotation-planner-gear-swap-dialog.component';
import { RotationPlannerAdrenalinePotionDialogComponent } from './rotation-planner-adrenaline-potion-dialog.component';
import {
  RotationPlannerSpellSwapDialogComponent,
  type RotationPlannerSpellSwapOption,
} from './rotation-planner-spell-swap-dialog.component';
import {
  RotationPlannerCastSpellDialogComponent,
  type RotationPlannerCastSpellOption,
} from './rotation-planner-cast-spell-dialog.component';
import type { GearBuilderState } from '../../core/gear/gear-state';

interface PlannerMagicSpellOption {
  spellId: string;
  name: string;
  role: SpellDefinition['role'];
  levelRequirement: number;
  tier: number;
  optionLabel: string;
  iconPath?: string;
}

type PreFightTimelineSection = 'prebuild' | 'stall' | 'gap';

interface PlannerTimelineColumn {
  id: string;
  tick: number;
  label: string;
  isMain: boolean;
  isPreFight: boolean;
  isSeparator?: boolean;
  preFightSection?: PreFightTimelineSection;
}

interface PrebuildTimelineEntry {
  index: number;
  action: PreFightAbilityAction;
  ability: AbilityDefinition | null;
  startTick: number;
  span: number;
  tickLabel: string;
}

const PREFIGHT_SEPARATOR_COLUMN_ID = 'prefight-separator';
const PREFIGHT_STALL_VISUAL_SPAN = GCD_TICKS;
const PREFIGHT_VISUAL_STALL_START_TICK = -PREFIGHT_STALL_VISUAL_SPAN;
const TIMELINE_TICK_COLUMN_WIDTH_REM = 2.18;
const TIMELINE_SEPARATOR_COLUMN_WIDTH_REM = 1.38;
const TIMELINE_COLUMN_GAP_REM = 0.42;
const TICK_SELECTION_OVERHANG_REM = 0.16;
const SEREN_GODBOW_TARGET_SIZE_OPTIONS: Array<{ value: SerenGodbowTargetSize; label: string }> =
  SEREN_GODBOW_TARGET_SIZE_VALUES.map((value) => ({
    value,
    label: `${value} - ${SEREN_GODBOW_TARGET_ARROWS[value]} arrow${SEREN_GODBOW_TARGET_ARROWS[value] === 1 ? '' : 's'}`,
  }));

@Component({
  selector: 'app-rotation-planner-page',
  standalone: true,
  imports: [
    FormsModule,
    RotationPlannerTickInspectorComponent,
    RotationPlannerGearSwapDialogComponent,
    RotationPlannerAdrenalinePotionDialogComponent,
    RotationPlannerSpellSwapDialogComponent,
    RotationPlannerCastSpellDialogComponent,
  ],
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
  private readonly simulationSettingsStore = inject(SimulationSettingsStoreService);
  private readonly gearBuilderStore = inject(GearBuilderStore);
  private readonly buffConfigurationStore = inject(BuffConfigurationStoreService);
  private readonly combatChoicesStore = inject(CombatChoicesStoreService);
  private readonly playerStatsStore = inject(PlayerStatsStoreService);

  protected readonly startingAdrenaline = this.plannerStore.startingAdrenaline;
  protected readonly maxStartingAdrenaline = this.plannerStore.maxStartingAdrenaline;
  protected readonly startingStacks = this.plannerStore.startingStacks;
  protected readonly gcdCount = this.plannerStore.gcdCount;
  protected readonly tickCount = this.plannerStore.tickCount;
  protected readonly playerStats = this.playerStatsStore.stats;
  protected readonly combatChoices = this.combatChoicesStore.combatChoices;
  protected readonly magicChoices = this.combatChoicesStore.magicChoices;
  protected readonly timelineResult = this.plannerStore.timelineResult;
  protected readonly tickIndexes = this.plannerStore.tickIndexes;
  protected readonly nonGcdActions = this.plannerStore.nonGcdActions;
  protected readonly abilityActions = this.plannerStore.abilityActions;
  protected readonly preFight = this.plannerStore.preFight;
  protected readonly prebuildNonGcdActions = computed(() => this.preFight().prebuildNonGcdActions ?? []);
  protected readonly allNonGcdActions = computed(() => [
    ...this.prebuildNonGcdActions(),
    ...this.nonGcdActions(),
  ]);
  protected readonly abilityCatalog = computed<Record<string, AbilityDefinition>>(() => {
    return this.gameDataStore.snapshot().catalog?.abilities ?? {};
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
      preFight: this.preFight(),
    }),
  );
  protected readonly simulationResult = this.resultsSimulationService.simulationResult;
  protected readonly simulationSettings = this.simulationSettingsStore.settings;
  protected readonly serenGodbowTargetSizeOptions = SEREN_GODBOW_TARGET_SIZE_OPTIONS;
  protected readonly usesSerenGodbowSpecial = computed(() => this.hasSerenGodbowSpecialUsage());
  protected readonly selectedTick = signal(0);
  protected readonly showCooldownLane = signal(false);
  protected readonly configurationPanelExpanded = signal(false);
  protected readonly prebuildCollapsed = signal(false);
  protected readonly stallSlotVisualSpan = PREFIGHT_STALL_VISUAL_SPAN;
  protected readonly prebuildEmptySlotVisualSpan = GCD_TICKS;
  protected readonly abilityPaletteStyleTabs = ABILITY_STYLE_TABS;
  protected readonly selectedAbilityPaletteStyle = signal<CombatStyle>('ranged');
  protected readonly hoveredAbilityDropTick = signal<number | null>(null);
  protected readonly plannerWarning = signal<string | null>(null);
  protected readonly gearSwapDialogActionId = signal<string | null>(null);
  protected readonly gearSwapDialogRemovesOnCancel = signal(false);
  protected readonly selectedGearSwapInstanceId = signal<string | null>(null);
  protected readonly adrenalinePotionDialogActionId = signal<string | null>(null);
  protected readonly adrenalinePotionDialogRemovesOnCancel = signal(false);
  protected readonly selectedAdrenalinePotionVariantId = signal<AdrenalinePotionVariantId | null>(null);
  protected readonly spellSwapDialogActionId = signal<string | null>(null);
  protected readonly spellSwapDialogRemovesOnCancel = signal(false);
  protected readonly selectedSpellSwapSpellId = signal<string | null>(null);
  protected readonly castSpellDialogActionId = signal<string | null>(null);
  protected readonly castSpellDialogRemovesOnCancel = signal(false);
  protected readonly selectedCastSpellSpellId = signal<string | null>(null);
  protected readonly activeGearSwapAction = computed(() => {
    const actionId = this.gearSwapDialogActionId();
    if (!actionId) {
      return null;
    }

    return this.allNonGcdActions().find((action) => action.id === actionId) ?? null;
  });
  protected readonly activeAdrenalinePotionAction = computed(() => {
    const actionId = this.adrenalinePotionDialogActionId();
    if (!actionId) {
      return null;
    }

    return this.allNonGcdActions().find((action) => action.id === actionId) ?? null;
  });
  protected readonly activeSpellSwapAction = computed(() => {
    const actionId = this.spellSwapDialogActionId();
    if (!actionId) {
      return null;
    }

    return this.allNonGcdActions().find((action) => action.id === actionId) ?? null;
  });
  protected readonly activeCastSpellAction = computed(() => {
    const actionId = this.castSpellDialogActionId();
    if (!actionId) {
      return null;
    }

    return this.abilityActions().find((action) => action.id === actionId) ?? null;
  });
  protected readonly gearSwapOptions = computed<PlannerGearSwapOption[]>(() => {
    const catalog = this.gameDataStore.snapshot().catalog;
    const activeAction = this.activeGearSwapAction();
    const tick = activeAction?.tick;

    if (!catalog) {
      return [];
    }

    const projectedGearState =
      typeof tick === 'number'
        ? projectGearStateAtTick(
            this.gearBuilderStore.snapshot(),
            catalog.items,
            this.allNonGcdActions(),
            tick,
          )
        : this.gearBuilderStore.snapshot();

    return buildPlannerGearSwapOptions(projectedGearState.inventory, catalog);
  });
  protected readonly spellSwapOptions = computed<RotationPlannerSpellSwapOption[]>(() =>
    buildPlannerSpellSwapOptions(
      this.gameDataStore.snapshot().catalog?.spells ?? {},
      this.playerStats().magicLevel ?? 0,
      this.magicChoices().spellbookId,
    ),
  );
  protected readonly castSpellOptions = computed<RotationPlannerCastSpellOption[]>(() =>
    buildPlannerCastSpellOptions(
      this.gameDataStore.snapshot().catalog?.spells ?? {},
      this.playerStats().magicLevel ?? 0,
      this.magicChoices().spellbookId,
    ),
  );
  protected readonly abilityPreviewActionOriginalTicks = computed<Record<string, number>>(() =>
    Object.fromEntries(this.abilityActions().map((action) => [action.id, action.tick])),
  );
  protected readonly previewAbilityPlacement = computed(() => {
    const payload = this.draggedAbilityPayload;
    const hoveredTick = this.hoveredAbilityDropTick();
    const abilityCatalog = this.abilityCatalog();

    if (!payload || hoveredTick === null) {
      return null;
    }

    const definition = abilityCatalog[payload.abilityId];
    if (!definition) {
      return null;
    }

    const snappedTick = this.abilityWindowStartTick(hoveredTick);
    if (!this.plannerStore.canPlaceAbilityAtTick(definition, snappedTick, payload.actionId)) {
      return null;
    }

    return previewAbilityActionsWithPlacement(
      this.abilityActions(),
      abilityCatalog,
      payload,
      snappedTick,
    );
  });
  protected readonly tickInspection = computed(() => {
    const catalog = this.gameDataStore.snapshot().catalog;
    if (!catalog) {
      return null;
    }

    return inspectRotationPlannerTick({
      tick: this.selectedTick(),
      catalog,
      playerStats: this.playerStatsStore.stats(),
      combatChoices: this.combatChoicesStore.combatChoices(),
      gearState: this.gearBuilderStore.snapshot(),
      buffState: this.buffConfigurationStore.state(),
      rotationPlan: this.plannerStore.rotationPlan(),
      simulationResult: this.simulationResult(),
    });
  });
  protected readonly inspectMinTick = computed(() => {
    if (this.prebuildCollapsed()) {
      return 0;
    }

    return this.timelineColumns().find((column) => column.isPreFight)?.tick ?? 0;
  });
  protected readonly inspectMaxTick = computed(() => Math.max(this.inspectMinTick(), this.tickCount() - 1));
  protected readonly abilityOccupancy = computed<Record<number, AbilityOccupancyEntry>>(() => {
    const preview = this.previewAbilityPlacement();

    return buildAbilityOccupancyMap(
      preview?.abilityActions ?? this.abilityActions(),
      this.tickIndexes(),
      this.abilityCatalog(),
      preview ? this.abilityPreviewActionOriginalTicks() : undefined,
    );
  });
  protected readonly abilityPaletteEntries = computed<PlannerAbilityPaletteEntry[]>(() => {
    return buildAbilityPaletteEntries(
      this.abilityCatalog(),
      this.abilityAvailabilityService.availabilityMap(),
    );
  });
  protected readonly visibleAbilityPaletteEntries = computed(() =>
    filterAbilitiesByStyle(this.abilityPaletteEntries(), this.selectedAbilityPaletteStyle()),
  );
  protected readonly groupedAbilityPaletteEntries = computed(() =>
    groupAbilitiesBySubtype(this.visibleAbilityPaletteEntries()),
  );
  protected readonly selectedAbilityPaletteThemeClass = computed(
    () =>
      this.abilityPaletteStyleTabs.find((tab) => tab.id === this.selectedAbilityPaletteStyle())?.themeClass ?? '',
  );
  protected readonly abilityPaletteEmptyCopy = computed(() =>
    abilityStyleEmptyMessage(this.selectedAbilityPaletteStyle()),
  );
  protected readonly abilityGapControls = computed<Record<number, PlannerAbilityGapControl>>(() =>
    Object.fromEntries(
      buildAbilityGapControls(this.abilityActions(), this.abilityCatalog()).map((control) => [control.tick, control]),
    ),
  );
  protected readonly abilityPlacementTicks = computed<Set<number>>(() =>
    new Set(
      buildAbilityPlacementTicks(
        this.abilityActions(),
        this.abilityCatalog(),
        this.tickCount(),
      ),
    ),
  );
  protected readonly preFightSchedule = computed(() =>
    buildPreFightSchedule({
      preFight: this.preFight(),
      abilityDefinitions: this.abilityCatalog(),
      mainAbilityActions: this.abilityActions(),
    }),
  );
  protected readonly prebuildTimelineEntries = computed<PrebuildTimelineEntry[]>(() => {
    const actionIndexById = new Map(
      this.preFight().prebuildActions.map((action, index) => [action.id, index]),
    );
    const scheduledEntries: PrebuildTimelineEntry[] = [];
    let cursorTick = PREFIGHT_VISUAL_STALL_START_TICK;

    for (const action of [...this.preFight().prebuildActions].reverse()) {
      const ability = this.abilityCatalog()[action.abilityId] ?? null;
      const span = ability ? getPreFightAbilityTimelineSpan(ability) : GCD_TICKS;
      const startTick = cursorTick - span;

      scheduledEntries.push({
        index: actionIndexById.get(action.id) ?? 0,
        action,
        ability,
        startTick,
        span,
        tickLabel: `T${startTick}`,
      });

      cursorTick = startTick;
    }

    return scheduledEntries.reverse();
  });
  protected readonly prebuildEmptySlotTick = computed(() => {
    const entries = this.prebuildTimelineEntries();
    const earliestPrebuildStart = Math.min(
      PREFIGHT_VISUAL_STALL_START_TICK,
      ...entries.map((entry) => entry.startTick),
      ...this.prebuildNonGcdActions().map((action) => action.tick),
    );

    return earliestPrebuildStart - GCD_TICKS;
  });
  protected readonly timelineColumns = computed<PlannerTimelineColumn[]>(() => {
    const prebuildEntries = this.prebuildTimelineEntries();
    const earliestPreFightTick = Math.min(
      PREFIGHT_VISUAL_STALL_START_TICK,
      this.prebuildEmptySlotTick(),
      ...prebuildEntries.map((entry) => entry.startTick),
      ...this.prebuildNonGcdActions().map((action) => action.tick),
    );
    const preFightColumns = !this.prebuildCollapsed() && earliestPreFightTick < 0
      ? Array.from({ length: Math.abs(earliestPreFightTick) }, (_, index) => earliestPreFightTick + index)
          .map<PlannerTimelineColumn>((tick) => ({
            id: `prefight:${tick}`,
            tick,
            label: `T${tick}`,
            isMain: false,
            isPreFight: true,
            preFightSection: preFightSectionForTick(tick),
          }))
      : [];
    const separatorColumn: PlannerTimelineColumn = {
      id: PREFIGHT_SEPARATOR_COLUMN_ID,
      tick: 0,
      label: '',
      isMain: false,
      isPreFight: false,
      isSeparator: true,
    };
    const mainColumns = this.tickIndexes().map<PlannerTimelineColumn>((tick) => ({
      id: `main:${tick}`,
      tick,
      label: `T${tick}`,
      isMain: true,
      isPreFight: false,
    }));

    return [...preFightColumns, separatorColumn, ...mainColumns];
  });
  protected readonly timelineColumnCount = computed(() => this.timelineColumns().length);
  protected readonly timelineColumnTemplate = computed(() =>
    this.timelineColumns()
      .map((column) => {
        const width = column.isSeparator ? TIMELINE_SEPARATOR_COLUMN_WIDTH_REM : TIMELINE_TICK_COLUMN_WIDTH_REM;
        return `minmax(${width}rem, ${width}rem)`;
      })
      .join(' '),
  );
  protected readonly preFightSeparatorOverlayLeft = computed(() => {
    const separatorIndex = this.timelineColumns().findIndex((column) => column.id === PREFIGHT_SEPARATOR_COLUMN_ID);
    return `calc(${this.timelineColumnLeft(Math.max(0, separatorIndex))})`;
  });
  protected readonly stallColumnId = computed(() => {
    return `prefight:${PREFIGHT_VISUAL_STALL_START_TICK}`;
  });
  protected readonly stalledAbilityDefinition = computed(() => {
    const stalledAbility = this.preFight().stalledAbility;
    return stalledAbility ? this.abilityCatalog()[stalledAbility.abilityId] ?? null : null;
  });
  protected readonly stalledAbilityCastTickLabel = computed(() => {
    const gapTicks = this.preFight().gapTicks;
    return `${gapTicks} tick${gapTicks === 1 ? '' : 's'} before T0`;
  });
  protected readonly stalledAbilityReleaseLabel = computed(() => {
    const releaseTick = this.preFightSchedule().stalledAbility?.releaseTick;
    return typeof releaseTick === 'number' ? `Releases T${releaseTick}` : 'No main ability yet';
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
      timelineGeneratedBuffSources: result.timelineGeneratedBuffSources,
      abilityDefinitions: this.abilityCatalog(),
    });
  });
  protected readonly cooldownLaneBars = computed<PlannerCooldownLaneBar[]>(() => {
    const result = this.simulationResult();
    const catalog = this.gameDataStore.snapshot().catalog;

    if (!result || !catalog) {
      return [];
    }

    return buildPlannerCooldownLaneBars({
      tickCount: this.tickCount(),
      cooldownTimeline: result.cooldownTimeline,
      abilityDefinitions: this.abilityCatalog(),
      buffTimeline: result.buffTimeline,
      buffDefinitions: catalog.buffs,
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
  protected readonly bloodlustSpendMarkersByAction = computed<
    Record<string, PlannerBloodlustSpendMarker[]>
  >(() => buildBloodlustSpendMarkersByAction(
    this.simulationResult(),
    this.abilityActions(),
    this.abilityCatalog(),
  ));
  protected readonly bloodlustIconPath = computed(() => BLOODLUST_ICON_PATH);
  protected readonly instabilityProcMarkersByAction = computed<
    Record<string, PlannerInstabilityProcMarker[]>
  >(() => buildInstabilityProcMarkersByAction(
    this.simulationResult(),
    this.abilityActions(),
    this.abilityCatalog(),
  ));
  protected readonly instabilityIconPath = computed(() => INSTABILITY_ICON_PATH);
  protected readonly nonGcdPaletteEntries = PLANNER_NON_GCD_TEMPLATES;
  protected readonly adrenalinePotionVariants = ADRENALINE_POTION_VARIANTS;
  protected readonly startingStackControls = computed(() => {
    const catalog = this.gameDataStore.snapshot().catalog;
    const gearState = this.gearBuilderStore.snapshot();

    if (!catalog) {
      return [];
    }

    const controls: Array<{
      key: 'perfect-equilibrium' | 'deathspore';
      label: string;
      iconPath: string | null;
      value: number;
      max: number;
    }> = [];

    const weapon = gearState.equipment.weapon
      ? catalog.items[gearState.equipment.weapon.definitionId]
      : null;
    if (weapon?.effectRefs?.includes(EFFECT_REF_IDS.bolgPassive)) {
      controls.push({
        key: 'perfect-equilibrium',
        label: 'BoLG stacks',
        iconPath: weapon.iconPath ?? null,
        value: this.startingStacks().perfectEquilibriumStacks ?? 0,
        max: 7,
      });
    }

    const ammoInstance = resolveEffectiveAmmoSelection(gearState, catalog);
    const ammoDefinition = ammoInstance
      ? catalog.items[ammoInstance.definitionId] ?? catalog.ammo[ammoInstance.definitionId]
      : null;
    if (ammoDefinition?.effectRefs?.includes(EFFECT_REF_IDS.deathsporeProgress)) {
      controls.push({
        key: 'deathspore',
        label: 'Deathspore stacks',
        iconPath: 'iconPath' in ammoDefinition ? ammoDefinition.iconPath ?? null : null,
        value: this.startingStacks().deathsporeStacks ?? 0,
        max: 11,
      });
    }

    return controls;
  });
  protected readonly lanes = computed<PlannerLaneViewModel[]>(() =>
    this.showCooldownLane()
      ? [...BASE_PLANNER_LANES, COOLDOWN_PLANNER_LANE]
      : BASE_PLANNER_LANES,
  );
  protected readonly maxNonGcdStackSize = computed(() => {
    const actions = this.allNonGcdActions();
    if (!actions.length) {
      return 1;
    }

    const countsByTick = new Map<number, number>();
    for (const action of actions) {
      countsByTick.set(action.tick, (countsByTick.get(action.tick) ?? 0) + 1);
    }

    return Math.max(...countsByTick.values(), 1);
  });
  protected readonly timelineRowTemplate = computed(() => {
    return buildTimelineRowTemplate(
      this.lanes(),
      this.buffLaneBars(),
      this.cooldownLaneBars(),
      this.maxNonGcdStackSize(),
    );
  });
  protected draggedNonGcdPayload: PlannerNonGcdDropPayload | null = null;
  protected draggedNonGcdAction: RotationAction | null = null;
  protected draggedAbilityPayload: PlannerAbilityDropPayload | null = null;
  protected draggedAbilityAction: RotationAction | null = null;
  protected draggedPrebuildActionId: string | null = null;

  protected updateStartingAdrenaline(value: number | string | null): void {
    this.plannerStore.updateStartingAdrenaline(value);
  }

  protected updateStartingDeathsporeStacks(value: number | string | null): void {
    this.plannerStore.updateStartingDeathsporeStacks(value);
  }

  protected updateStartingPerfectEquilibriumStacks(value: number | string | null): void {
    this.plannerStore.updateStartingPerfectEquilibriumStacks(value);
  }

  protected updateGcdCount(value: number | string | null): void {
    this.plannerStore.updateGcdCount(value);
    this.selectedTick.update((current) => this.clampInspectableTick(current));
  }

  protected updateRangedLevel(value: number | string | null): void {
    this.playerStatsStore.updateStat('rangedLevel', this.parseLevel(value));
  }

  protected updateAttackLevel(value: number | string | null): void {
    this.playerStatsStore.updateStat('attackLevel', this.parseLevel(value));
  }

  protected updateStrengthLevel(value: number | string | null): void {
    this.playerStatsStore.updateStat('strengthLevel', this.parseLevel(value));
  }

  protected updateDefenceLevel(value: number | string | null): void {
    this.playerStatsStore.updateStat('defenceLevel', this.parseLevel(value));
  }

  protected updateMagicLevel(value: number | string | null): void {
    this.playerStatsStore.updateStat('magicLevel', this.parseLevel(value));
  }

  protected updateNecromancyLevel(value: number | string | null): void {
    this.playerStatsStore.updateStat('necromancyLevel', this.parseLevel(value));
  }

  protected updateSelectedTick(value: number | string | null): void {
    if (value === null || value === undefined || value === '') {
      return;
    }

    const parsedValue = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    this.selectedTick.set(this.clampInspectableTick(parsedValue));
  }

  protected selectTick(tickIndex: number): void {
    this.selectedTick.set(this.clampInspectableTick(tickIndex));
  }

  protected toggleCooldownLane(value: boolean | string | null): void {
    this.showCooldownLane.set(value === true || value === 'true');
  }

  protected updateCriticalHitResolutionMode(value: string | null): void {
    this.simulationSettingsStore.updateCriticalHitResolutionMode(value);
  }

  protected updateSerenGodbowTargetSize(value: string | null): void {
    this.simulationSettingsStore.updateSerenGodbowTargetSize(value);
  }

  protected toggleConfigurationPanel(): void {
    this.configurationPanelExpanded.update((expanded) => !expanded);
  }

  protected togglePrebuildCollapsed(): void {
    const nextCollapsed = !this.prebuildCollapsed();
    this.prebuildCollapsed.set(nextCollapsed);

    if (nextCollapsed && this.selectedTick() < 0) {
      this.selectedTick.set(0);
    }
  }

  protected updatePreFightGapTicks(value: number | string | null): void {
    this.plannerStore.updatePreFightGapTicks(value);
  }

  protected selectAbilityPaletteStyle(style: CombatStyle): void {
    this.selectedAbilityPaletteStyle.set(style);
  }

  protected laneCellLabel(laneKey: PlannerLaneViewModel['key'], column: PlannerTimelineColumn): string {
    if (!column.isMain) {
      return '';
    }

    return laneCellLabel(laneKey, this.timelineResult().timeline.ticks[column.tick]);
  }

  protected isMajorTick(tickIndex: number): boolean {
    return tickIndex % 3 === 0;
  }

  protected isAbilityPlacementTick(tickIndex: number): boolean {
    return this.abilityPlacementTicks().has(tickIndex);
  }

  protected abilityWindowStartTick(tickIndex: number): number {
    return snapTickToAbilityWindowStart(
      this.abilityActions(),
      this.abilityCatalog(),
      this.tickCount(),
      tickIndex,
    );
  }

  protected abilityDropListId(tickIndex: number): string {
    return `ability-tick-${tickIndex}`;
  }

  protected nonGcdDropListId(tickIndex: number): string {
    return `non-gcd-tick-${tickIndex}`;
  }

  protected timelineCellTestId(laneKey: PlannerLaneViewModel['key'], column: PlannerTimelineColumn): string {
    if (column.id === PREFIGHT_SEPARATOR_COLUMN_ID) {
      return `timeline-cell-${laneKey}-prefight-toggle`;
    }

    return `timeline-cell-${laneKey}-${column.tick}`;
  }

  protected isSelectedTimelineColumn(column: PlannerTimelineColumn): boolean {
    return !column.isSeparator && this.selectedTick() === column.tick;
  }

  protected isPrebuildDropColumn(column: PlannerTimelineColumn): boolean {
    return column.isPreFight &&
      !this.prebuildCollapsed() &&
      (
        column.tick === this.prebuildEmptySlotTick() ||
        Boolean(this.prebuildEntryStartingAtTick(column.tick))
      );
  }

  protected isPrebuildEmptySlotColumn(column: PlannerTimelineColumn): boolean {
    return column.isPreFight && !this.prebuildCollapsed() && column.tick === this.prebuildEmptySlotTick();
  }

  protected isStallSlotColumn(column: PlannerTimelineColumn): boolean {
    return column.isPreFight && column.id === this.stallColumnId();
  }

  protected isPrebuildSectionColumn(column: PlannerTimelineColumn): boolean {
    return column.preFightSection === 'prebuild';
  }

  protected isStallSectionColumn(column: PlannerTimelineColumn): boolean {
    return column.preFightSection === 'stall';
  }

  protected isPreFightNonGcdDropColumn(column: PlannerTimelineColumn): boolean {
    return this.isPrebuildSectionColumn(column) || this.isStallSectionColumn(column);
  }

  protected isPreFightGapColumn(column: PlannerTimelineColumn): boolean {
    return column.preFightSection === 'gap';
  }

  protected isPreFightSeparatorColumn(column: PlannerTimelineColumn): boolean {
    return column.id === PREFIGHT_SEPARATOR_COLUMN_ID;
  }

  protected preFightVisibilityToggleLabel(): string {
    return this.prebuildCollapsed()
      ? 'Show prebuild and ability stall'
      : 'Hide prebuild and ability stall';
  }

  protected isFirstPreFightColumn(column: PlannerTimelineColumn): boolean {
    return this.timelineColumns().find((entry) => entry.isPreFight)?.id === column.id;
  }

  protected prebuildEntryStartingAtTick(tick: number): PrebuildTimelineEntry | null {
    return this.prebuildTimelineEntries().find((entry) => entry.startTick === tick) ?? null;
  }

  protected prebuildEntryForCell(
    laneKey: PlannerLaneViewModel['key'],
    column: PlannerTimelineColumn,
  ): PrebuildTimelineEntry | null {
    if (laneKey !== 'ability' || this.prebuildCollapsed()) {
      return null;
    }

    return this.prebuildEntryStartingAtTick(column.tick);
  }

  protected timelineCellCanDrop(laneKey: PlannerLaneViewModel['key'], column: PlannerTimelineColumn): boolean {
    if (laneKey === 'ability') {
      if (column.isPreFight) {
        return (
          this.isPrebuildDropColumn(column) &&
          (Boolean(this.draggedAbilityPayload) || Boolean(this.draggedPrebuildActionId))
        ) || (
          this.isStallSlotColumn(column) &&
          Boolean(this.draggedAbilityPayload)
        );
      }

      if (!column.isMain) {
        return false;
      }

      return this.canDropAbility(column.tick);
    }

    if (laneKey === 'non-gcd') {
      if (column.isPreFight) {
        return this.isPreFightNonGcdDropColumn(column) && this.canDropPrebuildNonGcd(column.tick);
      }

      if (!column.isMain) {
        return false;
      }

      return this.canDropNonGcd(column.tick);
    }

    return false;
  }

  protected timelineCellDropBlocked(laneKey: PlannerLaneViewModel['key'], column: PlannerTimelineColumn): boolean {
    if (!column.isMain) {
      if (laneKey === 'ability') {
        return column.isPreFight &&
          Boolean(this.draggedAbilityPayload) &&
          !this.isPrebuildDropColumn(column) &&
          !this.isStallSlotColumn(column);
      }

      return laneKey === 'non-gcd' &&
        column.isPreFight &&
        (Boolean(this.draggedNonGcdPayload) || Boolean(this.draggedAbilityPayload)) &&
        !this.isPreFightNonGcdDropColumn(column);
    }

    return (laneKey === 'ability' && Boolean(this.draggedAbilityPayload) && !this.canDropAbility(column.tick)) ||
      (laneKey === 'non-gcd' && Boolean(this.draggedNonGcdPayload) && !this.canDropNonGcd(column.tick));
  }

  protected canDropNonGcd(tickIndex: number): boolean {
    const draggedAbility = this.draggedAbilityPayload;
    if (draggedAbility) {
      const definition = this.abilityCatalog()[draggedAbility.abilityId];
      if (!definition || !canPlaceAbilityOnPlannerLane(definition, 'non-gcd')) {
        return false;
      }

      return this.canPlaceAbilityOnNonGcd(definition, tickIndex);
    }

    return Boolean(this.draggedNonGcdPayload) && this.plannerStore.canPlaceNonGcdActionAtTick(tickIndex);
  }

  protected canDropPrebuildNonGcd(tickIndex: number): boolean {
    const draggedAbility = this.draggedAbilityPayload;
    if (draggedAbility) {
      const definition = this.abilityCatalog()[draggedAbility.abilityId];
      return Boolean(definition && canPlaceAbilityOnPlannerLane(definition, 'non-gcd'));
    }

    return Boolean(this.draggedNonGcdPayload) && this.plannerStore.canPlacePrebuildNonGcdActionAtTick(tickIndex);
  }

  private canPlaceAbilityOnNonGcd(definition: AbilityDefinition, tickIndex: number): boolean {
    if (!this.plannerStore.canPlaceNonGcdActionAtTick(tickIndex)) {
      return false;
    }

    const catalog = this.gameDataStore.snapshot().catalog;
    if (!catalog) {
      return false;
    }

    const projectedGearState = projectGearStateAtTick(
      this.gearBuilderStore.snapshot(),
      catalog.items,
      this.nonGcdActions(),
      tickIndex,
    );
    const availability = evaluateAbilityAvailability(definition, {
      playerStats: this.playerStatsStore.stats(),
      equippedItems: Object.values(projectedGearState.equipment)
        .filter((item): item is NonNullable<(typeof projectedGearState.equipment)[EquipmentSlot]> => Boolean(item))
        .map((item) => catalog.items[item.definitionId])
        .filter((item): item is NonNullable<typeof catalog.items[string]> => Boolean(item)),
      inventoryItems: projectedGearState.inventory
        .map((item) => catalog.items[item.definitionId])
        .filter((item): item is NonNullable<typeof catalog.items[string]> => Boolean(item)),
      equippedInstances: Object.values(projectedGearState.equipment)
        .filter((item): item is NonNullable<(typeof projectedGearState.equipment)[EquipmentSlot]> => Boolean(item)),
    });

    return availability.isAvailable;
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

  protected abilityGapControlAtTick(tickIndex: number): PlannerAbilityGapControl | null {
    return this.abilityGapControls()[tickIndex] ?? null;
  }

  protected isPreviewDropTick(tickIndex: number): boolean {
    return this.hoveredAbilityDropTick() === tickIndex && Boolean(this.previewAbilityPlacement());
  }

  protected nonGcdActionsAtTick(tickIndex: number, isPreFight = false): RotationAction[] {
    return getNonGcdActionsAtTick(
      isPreFight ? this.prebuildNonGcdActions() : this.nonGcdActions(),
      tickIndex,
    );
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
    return `${laneHeightRem(
      laneKey,
      this.buffLaneBars(),
      this.cooldownLaneBars(),
      this.maxNonGcdStackSize(),
    )}rem`;
  }

  protected selectedTickOverlayLeft(): string {
    const selectedColumnIndex = this.timelineColumns().findIndex(
      (column) => !column.isSeparator && column.tick === this.selectedTick(),
    );

    return `calc(${this.timelineColumnLeft(Math.max(0, selectedColumnIndex))} - ${TICK_SELECTION_OVERHANG_REM}rem)`;
  }

  private clampInspectableTick(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(this.inspectMinTick(), Math.min(Math.trunc(value), this.inspectMaxTick()));
  }

  private timelineColumnLeft(columnIndex: number): string {
    const columnsBeforeTarget = this.timelineColumns().slice(0, columnIndex);
    const separatorColumnCount = columnsBeforeTarget.filter((column) => column.isSeparator).length;
    const fullColumnCount = columnsBeforeTarget.length - separatorColumnCount;

    return `${fullColumnCount} * (${TIMELINE_TICK_COLUMN_WIDTH_REM}rem + ${TIMELINE_COLUMN_GAP_REM}rem) + ` +
      `${separatorColumnCount} * (${TIMELINE_SEPARATOR_COLUMN_WIDTH_REM}rem + ${TIMELINE_COLUMN_GAP_REM}rem)`;
  }

  private hasSerenGodbowSpecialUsage(): boolean {
    const catalog = this.gameDataStore.snapshot().catalog;
    if (!catalog) {
      return false;
    }

    const baseGearState = this.gearBuilderStore.snapshot();
    const mainAbilityActions = [
      ...this.abilityActions(),
      ...this.nonGcdActions().filter((action) => action.actionType === 'ability-use'),
    ];

    for (const action of mainAbilityActions) {
      const abilityId = this.readActionAbilityId(action);
      if (!abilityId) {
        continue;
      }

      const projectedGearState = projectGearStateAtTick(
        baseGearState,
        catalog.items,
        this.allNonGcdActions(),
        action.tick,
      );

      if (this.abilityIdUsesSerenGodbowSpecial(abilityId, catalog, projectedGearState)) {
        return true;
      }
    }

    for (const entry of this.prebuildTimelineEntries()) {
      const projectedGearState = projectGearStateAtTick(
        baseGearState,
        catalog.items,
        this.allNonGcdActions(),
        entry.startTick,
      );

      if (this.abilityIdUsesSerenGodbowSpecial(entry.action.abilityId, catalog, projectedGearState)) {
        return true;
      }
    }

    const stalledAbilityId = this.preFight().stalledAbility?.abilityId;
    if (!stalledAbilityId) {
      return false;
    }

    const projectedGearState = projectGearStateAtTick(
      baseGearState,
      catalog.items,
      this.allNonGcdActions(),
      PREFIGHT_VISUAL_STALL_START_TICK,
    );
    return this.abilityIdUsesSerenGodbowSpecial(stalledAbilityId, catalog, projectedGearState);
  }

  private abilityIdUsesSerenGodbowSpecial(
    abilityId: string,
    catalog: GameDataCatalog,
    gearState: GearBuilderState,
  ): boolean {
    const ability = catalog.abilities[abilityId];
    if (abilityId === SEREN_GODBOW_ABILITY_ID || ability?.effectRefs?.includes(SEREN_GODBOW_EFFECT_REF)) {
      return true;
    }

    if (abilityId === ESSENCE_OF_FINALITY_ABILITY_ID) {
      return this.resolveStoredEofWeaponId(catalog, gearState) === SEREN_GODBOW_WEAPON_ID;
    }

    if (abilityId !== WEAPON_SPECIAL_ATTACK_ABILITY_ID) {
      return false;
    }

    const weaponInstance = gearState.equipment.weapon;
    const weapon = weaponInstance ? catalog.items[weaponInstance.definitionId] : null;
    return Boolean(
      weapon?.id === SEREN_GODBOW_WEAPON_ID ||
      weapon?.specialAbilityId === SEREN_GODBOW_ABILITY_ID ||
      weapon?.effectRefs?.includes(`weapon-special:${SEREN_GODBOW_WEAPON_ID}`),
    );
  }

  private resolveStoredEofWeaponId(
    catalog: GameDataCatalog,
    gearState: GearBuilderState,
  ): string | null {
    const amuletInstance = gearState.equipment.amulet;
    if (!amuletInstance || amuletInstance.definitionId !== ESSENCE_OF_FINALITY_ABILITY_ID) {
      return null;
    }

    const amuletDefinition = catalog.items[amuletInstance.definitionId];
    const explicitValue = amuletInstance.configValues?.[CONFIG_OPTION_IDS.storedSpecial];
    if (typeof explicitValue === 'string' && explicitValue.length > 0) {
      return explicitValue === 'none' ? null : explicitValue;
    }

    const defaultValue = amuletDefinition?.configOptions?.find(
      (option) => option.id === CONFIG_OPTION_IDS.storedSpecial,
    )?.defaultValue;
    return typeof defaultValue === 'string' && defaultValue.length > 0 && defaultValue !== 'none'
      ? defaultValue
      : null;
  }

  private readActionAbilityId(action: RotationAction): string | null {
    const abilityId = action.payload['abilityId'];
    return typeof abilityId === 'string' && abilityId.length > 0 ? abilityId : null;
  }

  protected abilityDefinitionForAction(action: RotationAction | null): AbilityDefinition | null {
    return abilityDefinitionForAction(action, this.abilityCatalog());
  }

  protected abilityPaletteEntryTitle(entry: PlannerAbilityPaletteEntry): string {
    return buildAbilityPaletteEntryTitle(entry);
  }

  protected placedAbilityTitle(action: RotationAction | null): string {
    if (action?.payload['abilityId'] === 'cast-spell') {
      const spellLabel = typeof action.payload['label'] === 'string' ? action.payload['label'] : 'Cast Spell';
      const summary = action ? this.actionValidationSummary(action) : null;
      const lines = [
        spellLabel,
        `Tick ${action.tick}`,
        'Drag to move or use remove to clear.',
      ];

      if (summary?.issues.length) {
        lines.push('', ...summary.issues.map((issue) => `Issue: ${issue.message}`));
      }

      return lines.join('\n');
    }

    return buildPlacedAbilityTitle(
      action,
      this.abilityDefinitionForAction(action),
      action ? this.actionValidationSummary(action) : null,
    );
  }

  protected abilitySegmentClass(segment: AbilityOccupancyEntry['segment']): string {
    return buildAbilitySegmentClass(segment);
  }

  protected placedAbilityThemeClass(definition: AbilityDefinition): string {
    return buildPlacedAbilityThemeClass(definition);
  }

  protected abilitySpan(definition: AbilityDefinition): number {
    return getAbilityTimelineSpan(definition);
  }

  protected abilityShortLabel(definition: AbilityDefinition): string {
    return buildAbilityShortLabel(definition);
  }

  protected placedAbilityLabel(action: RotationAction, definition: AbilityDefinition): string {
    if (action.payload['abilityId'] !== 'cast-spell') {
      return buildPlacedAbilityDisplayName(definition.name);
    }

    const label = action.payload['label'];
    return typeof label === 'string' && label
      ? buildPlacedAbilityDisplayName(label)
      : buildPlacedAbilityDisplayName(definition.name);
  }

  protected placedAbilityMeta(action: RotationAction, definition: AbilityDefinition): string {
    if (action.payload['abilityId'] !== 'cast-spell') {
      return definition.subtype;
    }

    const role = action.payload['spellRole'];
    return role === 'utility' ? 'utility spell' : 'combat spell';
  }

  protected placedAbilityIconPath(action: RotationAction, definition: AbilityDefinition): string | null {
    if (action.payload['abilityId'] !== 'cast-spell') {
      return definition.iconPath ?? null;
    }

    const iconPath = action.payload['iconPath'];
    return typeof iconPath === 'string' && iconPath ? iconPath : definition.iconPath ?? null;
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
    return buildPlacedAbilityMarkerLeft(
      action,
      marker,
      this.abilityDefinitionForAction(action),
    );
  }

  protected bloodlustSpendMarkers(
    action: RotationAction,
  ): PlannerBloodlustSpendMarker[] {
    return this.bloodlustSpendMarkersByAction()[action.id] ?? [];
  }

  protected bloodlustSpendLeft(
    action: RotationAction,
    marker: PlannerBloodlustSpendMarker,
  ): string {
    return buildPlacedAbilityMarkerLeft(
      action,
      marker,
      this.abilityDefinitionForAction(action),
    );
  }

  protected instabilityProcMarkers(
    action: RotationAction,
  ): PlannerInstabilityProcMarker[] {
    return this.instabilityProcMarkersByAction()[action.id] ?? [];
  }

  protected instabilityProcLeft(
    action: RotationAction,
    marker: PlannerInstabilityProcMarker,
  ): string {
    return buildPlacedAbilityMarkerLeft(
      action,
      marker,
      this.abilityDefinitionForAction(action),
    );
  }

  protected nonGcdShortLabel(action: RotationAction): string {
    if (action.actionType === 'ability-use') {
      return this.abilityDefinitionForAction(action)
        ? buildAbilityShortLabel(this.abilityDefinitionForAction(action)!)
        : 'Abi';
    }

    return buildNonGcdShortLabel(action);
  }

  protected nonGcdLabel(action: RotationAction): string {
    if (action.actionType === 'ability-use') {
      return this.abilityDefinitionForAction(action)?.name ?? buildNonGcdLabel(action);
    }

    return buildNonGcdLabel(action);
  }

  protected actionValidationSummary(action: RotationAction | null): PlannerActionValidationSummary | null {
    if (!action) {
      return null;
    }

    return this.actionValidationSummaryByAction()[action.id] ?? null;
  }

  protected actionValidationSummaryById(actionId: string | null | undefined): PlannerActionValidationSummary | null {
    if (!actionId) {
      return null;
    }

    const summaries = [
      this.actionValidationSummaryByAction()[actionId],
      this.actionValidationSummaryByAction()[`${actionId}:release`],
    ].filter((summary): summary is PlannerActionValidationSummary => Boolean(summary));

    if (!summaries.length) {
      return null;
    }

    return {
      issues: summaries.flatMap((summary) => summary.issues),
      highestSeverity: summaries.some((summary) => summary.highestSeverity === 'error')
        ? 'error'
        : summaries.some((summary) => summary.highestSeverity === 'warning')
          ? 'warning'
          : 'info',
    };
  }

  protected nonGcdIconPath(action: RotationAction): string | null {
    if (action.actionType === 'ability-use') {
      return this.abilityDefinitionForAction(action)?.iconPath ?? null;
    }

    return buildNonGcdIconPath(action);
  }

  protected prebuildEmptySlotTitle(): string {
    return `Drop an ability to add prebuild setup at T${this.prebuildEmptySlotTick()}.`;
  }

  protected prebuildEntryTitle(entry: PrebuildTimelineEntry): string {
    if (!entry.ability) {
      return 'Missing prebuild ability.';
    }

    const lines = [
      entry.ability.name,
      `${entry.tickLabel} prebuild`,
      'Drag to reorder or use remove to clear.',
    ];
    const summary = this.actionValidationSummaryById(entry.action.id);

    if (summary?.issues.length) {
      lines.push('', ...summary.issues.map((issue) => `Issue: ${issue.message}`));
    }

    return lines.join('\n');
  }

  protected stalledAbilityTitle(ability: AbilityDefinition): string {
    const lines = [
      ability.name,
      `Stalled ${this.stalledAbilityCastTickLabel()}`,
      this.stalledAbilityReleaseLabel(),
      'Use remove to clear.',
    ];
    const summary = this.actionValidationSummaryById(this.preFight().stalledAbility?.id);

    if (summary?.issues.length) {
      lines.push('', ...summary.issues.map((issue) => `Issue: ${issue.message}`));
    }

    return lines.join('\n');
  }

  protected allowPrebuildDrop(event: DragEvent): void {
    if (this.draggedAbilityPayload || this.draggedPrebuildActionId) {
      event.preventDefault();
    }
  }

  protected dropAbilityInPrebuildSlot(slotIndex: number, event: DragEvent, replaceExisting = false): void {
    event.preventDefault();

    if (this.draggedPrebuildActionId) {
      this.plannerStore.reorderPrebuildAbility(this.draggedPrebuildActionId, slotIndex);
      this.onPrebuildDragEnd();
      this.clearPlannerWarning();
      return;
    }

    const payload = this.draggedAbilityPayload;
    if (!payload) {
      return;
    }

    const definition = this.abilityCatalog()[payload.abilityId];
    if (!definition) {
      return;
    }

    if (definition.id === 'cast-spell') {
      this.showPlannerWarning('Cast Spell needs spell selection on the main timeline for now.');
      this.onAbilityDragEnd();
      return;
    }

    if (replaceExisting) {
      this.plannerStore.placePrebuildAbility(definition, slotIndex);
    } else {
      this.plannerStore.insertPrebuildAbility(definition, slotIndex);
    }

    this.clearPlannerWarning();
    this.onAbilityDragEnd();
  }

  protected removePrebuildAbility(actionId: string, event: Event): void {
    event.stopPropagation();
    this.plannerStore.removePrebuildAbility(actionId);
  }

  protected onPrebuildActionDragStart(action: PreFightAbilityAction): void {
    this.draggedPrebuildActionId = action.id;
  }

  protected onPrebuildDragEnd(): void {
    this.draggedPrebuildActionId = null;
  }

  protected allowStalledAbilityDrop(event: DragEvent): void {
    if (this.draggedAbilityPayload) {
      event.preventDefault();
    }
  }

  protected dropStalledAbility(event: DragEvent): void {
    event.preventDefault();

    const payload = this.draggedAbilityPayload;
    if (!payload) {
      return;
    }

    const definition = this.abilityCatalog()[payload.abilityId];
    if (!definition) {
      return;
    }

    if (definition.id === 'cast-spell') {
      this.showPlannerWarning('Cast Spell cannot be ability stalled yet.');
      this.onAbilityDragEnd();
      return;
    }

    if (!this.plannerStore.setStalledAbility(definition)) {
      this.showPlannerWarning(`${definition.name} is channelled and cannot be ability stalled.`);
      this.onAbilityDragEnd();
      return;
    }

    this.clearPlannerWarning();
    this.onAbilityDragEnd();
  }

  protected removeStalledAbility(event: Event): void {
    event.stopPropagation();
    this.plannerStore.removeStalledAbility();
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

  protected onCatalogNonGcdDragStart(template: PlannerNonGcdTemplate, event: DragEvent): void {
    this.draggedNonGcdPayload = {
      sourceType: 'catalog',
      templateId: template.id,
    };
    this.draggedNonGcdAction = null;
    this.applyCompactNonGcdDragPreview(event, template.iconPath ?? null, template.shortLabel);
  }

  protected onTimelineNonGcdDragStart(action: RotationAction, event: DragEvent): void {
    if (action.actionType === 'ability-use') {
      const abilityId = action.payload['abilityId'];
      this.draggedNonGcdPayload = {
        sourceType: 'timeline',
        templateId: 'ability-use',
        actionId: action.id,
        abilityId: typeof abilityId === 'string' ? abilityId : undefined,
      };
      this.draggedNonGcdAction = action;
      this.applyCompactNonGcdDragPreview(event, this.nonGcdIconPath(action), this.nonGcdShortLabel(action));
      return;
    }

    const templateId = action.payload['templateId'];
    this.draggedNonGcdPayload = {
      sourceType: 'timeline',
      templateId: typeof templateId === 'string' ? templateId : '',
      actionId: action.id,
    };
    this.draggedNonGcdAction = action;
    this.applyCompactNonGcdDragPreview(event, this.nonGcdIconPath(action), this.nonGcdShortLabel(action));
  }

  protected onAbilityDragEnd(): void {
    this.draggedAbilityPayload = null;
    this.draggedAbilityAction = null;
    this.hoveredAbilityDropTick.set(null);
  }

  protected onNonGcdDragEnd(): void {
    this.draggedNonGcdPayload = null;
    this.draggedNonGcdAction = null;
  }

  protected allowAbilityDrop(event: DragEvent, tickIndex: number): void {
    if (this.draggedAbilityPayload) {
      event.preventDefault();
      this.hoveredAbilityDropTick.set(tickIndex);
    }
  }

  protected allowNonGcdDrop(event: DragEvent, tickIndex: number): void {
    if (this.canDropNonGcd(tickIndex)) {
      event.preventDefault();
    }
  }

  protected onTimelineCellDragOver(
    laneKey: PlannerLaneViewModel['key'],
    column: PlannerTimelineColumn,
    event: DragEvent,
  ): void {
    if (laneKey === 'ability' && column.isPreFight) {
      if (this.isPrebuildDropColumn(column)) {
        this.allowPrebuildDrop(event);
        return;
      }

      if (this.isStallSlotColumn(column)) {
        this.allowStalledAbilityDrop(event);
      }

      return;
    }

    if (laneKey === 'non-gcd' && column.isPreFight) {
      if (this.isPreFightNonGcdDropColumn(column)) {
        this.allowPrebuildNonGcdDrop(event, column.tick);
      }

      return;
    }

    if (!column.isMain) {
      return;
    }

    if (laneKey === 'ability') {
      this.allowAbilityDrop(event, column.tick);
    } else if (laneKey === 'non-gcd') {
      this.allowNonGcdDrop(event, column.tick);
    }
  }

  protected onTimelineCellDrop(
    laneKey: PlannerLaneViewModel['key'],
    column: PlannerTimelineColumn,
    event: DragEvent,
  ): void {
    if (laneKey === 'ability' && column.isPreFight) {
      if (this.isPrebuildDropColumn(column)) {
        const entry = this.prebuildEntryStartingAtTick(column.tick);
        this.dropAbilityInPrebuildSlot(entry?.index ?? 0, event, Boolean(entry));
        return;
      }

      if (this.isStallSlotColumn(column)) {
        this.dropStalledAbility(event);
      }

      return;
    }

    if (laneKey === 'non-gcd' && column.isPreFight) {
      if (this.isPreFightNonGcdDropColumn(column)) {
        this.dropPrebuildNonGcdOnTick(column.tick, event);
      }

      return;
    }

    if (!column.isMain) {
      return;
    }

    if (laneKey === 'ability') {
      this.dropAbilityOnTick(column.tick, event);
    } else if (laneKey === 'non-gcd') {
      this.dropNonGcdOnTick(column.tick, event);
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

    const placement = this.plannerStore.evaluateAbilityPlacement(definition, snappedTick, payload.actionId);
    if (!placement.isPlaceable) {
      this.showPlannerWarning(describeInvalidAbilityPlacement(definition.name, placement.issue));
      this.onAbilityDragEnd();
      return;
    }

    const actionId = this.plannerStore.placeAbility(definition, snappedTick, payload);
    this.clearPlannerWarning();
    this.onAbilityDragEnd();

    if (definition.id === 'cast-spell' && actionId) {
      this.openCastSpellConfig(actionId, payload.sourceType === 'catalog');
    }
  }

  protected dropNonGcdOnTick(tickIndex: number, event: DragEvent): void {
    event.preventDefault();

    const draggedAbility = this.draggedAbilityPayload;
    if (draggedAbility) {
      const definition = this.abilityCatalog()[draggedAbility.abilityId];
      if (!definition || !canPlaceAbilityOnPlannerLane(definition, 'non-gcd')) {
        return;
      }

      if (!this.canPlaceAbilityOnNonGcd(definition, tickIndex)) {
        this.showPlannerWarning(`Cannot place ${definition.name} on that tick.`);
        this.onAbilityDragEnd();
        return;
      }

      this.plannerStore.placeUtilityAbilityNonGcd(definition, tickIndex, {
        sourceType: draggedAbility.actionId ? 'timeline' : 'catalog',
        templateId: 'ability-use',
        actionId: draggedAbility.actionId,
        abilityId: definition.id,
      });
      this.clearPlannerWarning();
      this.onAbilityDragEnd();
      return;
    }

    const payload = this.draggedNonGcdPayload;
    if (!payload || !this.canDropNonGcd(tickIndex)) {
      return;
    }

    if (payload.templateId === 'ability-use' && payload.abilityId) {
      const definition = this.abilityCatalog()[payload.abilityId];
      if (!definition) {
        return;
      }

      this.plannerStore.placeUtilityAbilityNonGcd(definition, tickIndex, payload);
      this.clearPlannerWarning();
      this.onNonGcdDragEnd();
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

    if (template.id === 'spell-swap' && payload.sourceType === 'catalog' && !this.spellSwapOptions().length) {
      this.showPlannerWarning('No unlocked magic combat spells are available for a spell swap.');
      this.onNonGcdDragEnd();
      return;
    }

    const actionId = this.plannerStore.placeNonGcdAction(template, tickIndex, payload);
    if (!actionId) {
      return;
    }

    if (template.id === 'gear-swap' && payload.sourceType === 'catalog') {
      this.openGearSwapConfig(actionId, true);
    } else if (template.id === 'adrenaline-potion' && payload.sourceType === 'catalog') {
      this.openAdrenalinePotionConfig(actionId, true);
    } else if (template.id === 'spell-swap' && payload.sourceType === 'catalog') {
      this.openSpellSwapConfig(actionId, true);
    } else {
      this.clearPlannerWarning();
    }

    this.onNonGcdDragEnd();
  }

  protected allowPrebuildNonGcdDrop(event: DragEvent, tickIndex: number): void {
    if (this.canDropPrebuildNonGcd(tickIndex)) {
      event.preventDefault();
    }
  }

  protected dropPrebuildNonGcdOnTick(tickIndex: number, event: DragEvent): void {
    event.preventDefault();

    const draggedAbility = this.draggedAbilityPayload;
    if (draggedAbility) {
      const definition = this.abilityCatalog()[draggedAbility.abilityId];
      if (!definition || !canPlaceAbilityOnPlannerLane(definition, 'non-gcd')) {
        return;
      }

      const actionId = this.plannerStore.placePrebuildUtilityAbilityNonGcd(definition, tickIndex, {
        sourceType: draggedAbility.actionId ? 'timeline' : 'catalog',
        templateId: 'ability-use',
        actionId: draggedAbility.actionId,
        abilityId: definition.id,
      });

      if (actionId) {
        this.clearPlannerWarning();
      }
      this.onAbilityDragEnd();
      return;
    }

    const payload = this.draggedNonGcdPayload;
    if (!payload || !this.canDropPrebuildNonGcd(tickIndex)) {
      return;
    }

    if (payload.templateId === 'ability-use' && payload.abilityId) {
      const definition = this.abilityCatalog()[payload.abilityId];
      if (!definition) {
        return;
      }

      this.plannerStore.placePrebuildUtilityAbilityNonGcd(definition, tickIndex, payload);
      this.clearPlannerWarning();
      this.onNonGcdDragEnd();
      return;
    }

    const template = this.nonGcdPaletteEntries.find((entry) => entry.id === payload.templateId);
    if (!template) {
      return;
    }

    const actionId = this.plannerStore.placePrebuildNonGcdAction(template, tickIndex, payload);
    if (!actionId) {
      return;
    }

    if (template.id === 'gear-swap' && payload.sourceType === 'catalog') {
      this.openGearSwapConfig(actionId, true);
    } else if (template.id === 'adrenaline-potion' && payload.sourceType === 'catalog') {
      this.openAdrenalinePotionConfig(actionId, true);
    } else if (template.id === 'spell-swap' && payload.sourceType === 'catalog') {
      this.openSpellSwapConfig(actionId, true);
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

  protected collapseAbilityGap(control: PlannerAbilityGapControl, event: Event): void {
    event.stopPropagation();
    this.plannerStore.collapseAbilityGap(control);
  }

  protected removePlacedNonGcdAction(actionId: string, event: Event): void {
    event.stopPropagation();
    this.plannerStore.removeNonGcdAction(actionId);
  }

  protected openNonGcdActionConfig(action: RotationAction, event: Event): void {
    event.stopPropagation();

    if (action.actionType === 'gear-swap') {
      this.openGearSwapConfig(action.id, false);
      return;
    }

    if (action.actionType === 'adrenaline-potion') {
      this.openAdrenalinePotionConfig(action.id, false);
      return;
    }

    if (action.actionType === 'spell-swap') {
      this.openSpellSwapConfig(action.id, false);
    }
  }

  protected openAbilityActionConfig(action: RotationAction, event: Event): void {
    if (action.payload['abilityId'] !== 'cast-spell') {
      return;
    }

    event.stopPropagation();
    this.openCastSpellConfig(action.id, false);
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

  protected confirmAdrenalinePotionConfig(): void {
    const action = this.activeAdrenalinePotionAction();
    const variant = getAdrenalinePotionVariant(this.selectedAdrenalinePotionVariantId());

    if (!action || !variant) {
      this.showPlannerWarning('Choose an adrenaline potion variant.');
      return;
    }

    this.plannerStore.updateNonGcdAction(action.id, {
      variantId: variant.id,
      label: variant.label,
      shortLabel: variant.shortLabel,
      iconPath: variant.iconPath,
      wikiUrl: variant.wikiUrl,
    });

    this.closeAdrenalinePotionConfig(false);
  }

  protected closeAdrenalinePotionConfig(cancelled: boolean): void {
    const actionId = this.adrenalinePotionDialogActionId();
    const shouldRemove = cancelled && this.adrenalinePotionDialogRemovesOnCancel() && actionId;

    this.adrenalinePotionDialogActionId.set(null);
    this.adrenalinePotionDialogRemovesOnCancel.set(false);
    this.selectedAdrenalinePotionVariantId.set(null);

    if (shouldRemove) {
      this.plannerStore.removeNonGcdAction(actionId);
    }
  }

  protected updateSelectedAdrenalinePotionVariantId(value: AdrenalinePotionVariantId | null): void {
    this.selectedAdrenalinePotionVariantId.set(value);
  }

  protected confirmSpellSwapConfig(): void {
    const action = this.activeSpellSwapAction();
    const option = this.spellSwapOptions().find((entry) => entry.spellId === this.selectedSpellSwapSpellId());

    if (!action || !option) {
      this.showPlannerWarning('Choose an unlocked spell for the spell swap.');
      return;
    }

    this.plannerStore.updateNonGcdAction(action.id, {
      spellId: option.spellId,
      label: `Spell: ${option.name}`,
      shortLabel: buildSpellSwapShortLabel(option.name),
      iconPath: option.iconPath ?? 'icons/actions/gear-swap.svg',
    });

    this.closeSpellSwapConfig(false);
  }

  protected closeSpellSwapConfig(cancelled: boolean): void {
    const actionId = this.spellSwapDialogActionId();
    const shouldRemove = cancelled && this.spellSwapDialogRemovesOnCancel() && actionId;

    this.spellSwapDialogActionId.set(null);
    this.spellSwapDialogRemovesOnCancel.set(false);
    this.selectedSpellSwapSpellId.set(null);

    if (shouldRemove) {
      this.plannerStore.removeNonGcdAction(actionId);
    }
  }

  protected updateSelectedSpellSwapSpellId(value: string | null): void {
    this.selectedSpellSwapSpellId.set(value);
  }

  protected confirmCastSpellConfig(): void {
    const action = this.activeCastSpellAction();
    const option = this.castSpellOptions().find((entry) => entry.spellId === this.selectedCastSpellSpellId());

    if (!action || !option) {
      this.showPlannerWarning('Choose a spell to cast.');
      return;
    }

    this.plannerStore.updateAbilityAction(action.id, {
      spellId: option.spellId,
      label: option.name,
      shortLabel: buildSpellSwapShortLabel(option.name),
      iconPath: option.iconPath ?? null,
      spellRole: option.role,
    });

    this.closeCastSpellConfig(false);
  }

  protected closeCastSpellConfig(cancelled: boolean): void {
    const actionId = this.castSpellDialogActionId();
    const shouldRemove = cancelled && this.castSpellDialogRemovesOnCancel() && actionId;

    this.castSpellDialogActionId.set(null);
    this.castSpellDialogRemovesOnCancel.set(false);
    this.selectedCastSpellSpellId.set(null);

    if (shouldRemove) {
      this.plannerStore.removeAbility(actionId);
    }
  }

  protected updateSelectedCastSpellSpellId(value: string | null): void {
    this.selectedCastSpellSpellId.set(value);
  }

  protected removeCastSpellActionFromDialog(): void {
    const actionId = this.castSpellDialogActionId();
    if (!actionId) {
      return;
    }

    this.closeCastSpellConfig(false);
    this.plannerStore.removeAbility(actionId);
  }

  protected removeSpellSwapActionFromDialog(): void {
    const actionId = this.spellSwapDialogActionId();
    if (!actionId) {
      return;
    }

    this.closeSpellSwapConfig(false);
    this.plannerStore.removeNonGcdAction(actionId);
  }

  protected removeAdrenalinePotionActionFromDialog(): void {
    const actionId = this.adrenalinePotionDialogActionId();
    if (!actionId) {
      return;
    }

    this.closeAdrenalinePotionConfig(false);
    this.plannerStore.removeNonGcdAction(actionId);
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
    const action = this.allNonGcdActions().find((entry) => entry.id === actionId) ?? null;
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

  private openAdrenalinePotionConfig(actionId: string, removesOnCancel: boolean): void {
    const action = this.allNonGcdActions().find((entry) => entry.id === actionId) ?? null;
    const currentVariantId = typeof action?.payload['variantId'] === 'string'
      ? action.payload['variantId'] as AdrenalinePotionVariantId
      : null;
    const defaultVariantId = currentVariantId ?? this.adrenalinePotionVariants[0]?.id ?? null;

    this.adrenalinePotionDialogActionId.set(actionId);
    this.adrenalinePotionDialogRemovesOnCancel.set(removesOnCancel);
    this.selectedAdrenalinePotionVariantId.set(defaultVariantId);
    this.clearPlannerWarning();
  }

  private openSpellSwapConfig(actionId: string, removesOnCancel: boolean): void {
    const action = this.allNonGcdActions().find((entry) => entry.id === actionId) ?? null;
    const options = buildPlannerSpellSwapOptions(
      this.gameDataStore.snapshot().catalog?.spells ?? {},
      this.playerStats().magicLevel ?? 0,
      this.magicChoices().spellbookId,
    );

    if (!options.length) {
      this.showPlannerWarning('No unlocked magic combat spells are available for the selected spellbook.');
      if (removesOnCancel) {
        this.plannerStore.removeNonGcdAction(actionId);
      }
      return;
    }

    const currentSpellId = typeof action?.payload['spellId'] === 'string'
      ? action.payload['spellId']
      : this.magicChoices().activeSpellId;

    this.spellSwapDialogActionId.set(actionId);
    this.spellSwapDialogRemovesOnCancel.set(removesOnCancel);
    this.selectedSpellSwapSpellId.set(
      options.some((option) => option.spellId === currentSpellId)
        ? currentSpellId
        : options[0]?.spellId ?? null,
    );
    this.clearPlannerWarning();
  }

  private openCastSpellConfig(actionId: string, removesOnCancel: boolean): void {
    const action = this.abilityActions().find((entry) => entry.id === actionId) ?? null;
    const options = this.castSpellOptions();

    if (!options.length) {
      this.showPlannerWarning('No unlocked spells are available for Cast Spell.');
      if (removesOnCancel) {
        this.plannerStore.removeAbility(actionId);
      }
      return;
    }

    const currentSpellId = typeof action?.payload['spellId'] === 'string'
      ? action.payload['spellId']
      : options[0]?.spellId ?? null;

    this.castSpellDialogActionId.set(actionId);
    this.castSpellDialogRemovesOnCancel.set(removesOnCancel);
    this.selectedCastSpellSpellId.set(
      options.some((option) => option.spellId === currentSpellId)
        ? currentSpellId
        : options[0]?.spellId ?? null,
    );
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

  private applyCompactNonGcdDragPreview(
    event: DragEvent,
    iconPath: string | null,
    fallbackLabel: string,
  ): void {
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer || typeof document === 'undefined') {
      return;
    }

    const preview = document.createElement('div');
    preview.style.position = 'fixed';
    preview.style.top = '-1000px';
    preview.style.left = '-1000px';
    preview.style.width = '40px';
    preview.style.height = '40px';
    preview.style.display = 'grid';
    preview.style.placeItems = 'center';
    preview.style.padding = '4px';
    preview.style.border = '1px solid rgba(150, 128, 68, 0.4)';
    preview.style.borderRadius = '10px';
    preview.style.background = 'linear-gradient(180deg, rgba(41, 31, 11, 0.98), rgba(17, 13, 7, 0.96))';
    preview.style.boxShadow = '0 8px 18px rgba(0, 0, 0, 0.24)';
    preview.style.pointerEvents = 'none';

    if (iconPath) {
      const image = document.createElement('img');
      image.src = iconPath;
      image.alt = fallbackLabel;
      image.style.width = '24px';
      image.style.height = '24px';
      image.style.borderRadius = '6px';
      image.style.objectFit = 'cover';
      preview.appendChild(image);
    } else {
      const fallback = document.createElement('span');
      fallback.textContent = fallbackLabel;
      fallback.style.display = 'grid';
      fallback.style.placeItems = 'center';
      fallback.style.width = '24px';
      fallback.style.height = '24px';
      fallback.style.border = '1px solid rgba(150, 128, 68, 0.28)';
      fallback.style.borderRadius = '6px';
      fallback.style.color = '#eed9a5';
      fallback.style.fontSize = '10px';
      fallback.style.fontWeight = '800';
      fallback.style.lineHeight = '1';
      fallback.style.textTransform = 'uppercase';
      fallback.style.background = 'rgba(26, 20, 9, 0.92)';
      preview.appendChild(fallback);
    }

    document.body.appendChild(preview);
    dataTransfer.setDragImage(preview, 20, 20);
    setTimeout(() => preview.remove(), 0);
  }
}

function preFightSectionForTick(tick: number): PreFightTimelineSection {
  if (tick < PREFIGHT_VISUAL_STALL_START_TICK) {
    return 'prebuild';
  }

  if (tick < 0) {
    return 'stall';
  }

  return 'gap';
}

function buildPlannerSpellSwapOptions(
  spellDefinitions: Record<string, SpellDefinition>,
  magicLevel: number,
  spellbookId: SpellDefinition['spellbookId'],
): PlannerMagicSpellOption[] {
  return buildPlannerCastSpellOptions(spellDefinitions, magicLevel, spellbookId)
    .filter((spell) => spell.role === 'combat')
    .map((spell) => ({
      ...spell,
      optionLabel: `${spell.name} - tier ${spell.tier} - level ${spell.levelRequirement}`,
    }));
}

function buildPlannerCastSpellOptions(
  spellDefinitions: Record<string, SpellDefinition>,
  magicLevel: number,
  spellbookId: SpellDefinition['spellbookId'],
): PlannerMagicSpellOption[] {
  return Object.values(spellDefinitions)
    .filter((spell) => spell.spellbookId === spellbookId && spell.levelRequirement <= magicLevel)
    .sort((left, right) => {
      if (left.role !== right.role) {
        return left.role === 'combat' ? -1 : 1;
      }

      return right.tier - left.tier || left.name.localeCompare(right.name);
    })
    .map((spell) => ({
      spellId: spell.id,
      name: spell.name,
      role: spell.role,
      levelRequirement: spell.levelRequirement,
      tier: spell.tier,
      optionLabel: spell.role === 'combat'
        ? `${spell.name} - combat - tier ${spell.tier} - level ${spell.levelRequirement}`
        : `${spell.name} - utility - level ${spell.levelRequirement}`,
      iconPath: spell.iconPath,
    }));
}

function buildSpellSwapShortLabel(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'Spell';
}
