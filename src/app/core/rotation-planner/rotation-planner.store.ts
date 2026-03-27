import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { AbilityDefinition } from '../../../game-data/types';
import type { RotationAction, RotationPlan } from '../../../simulation-engine/models';
import { MAX_ADRENALINE, resolveMaxAdrenaline } from '../../../simulation-engine/resolvers/adrenaline';
import { buildBaseTimeline } from '../../../simulation-engine/timeline';
import { BuffConfigurationStoreService } from '../buffs/buff-configuration-store.service';
import { GameDataStoreService } from '../game-data/game-data-store.service';
import { GearBuilderStore } from '../gear/gear-builder.store';
import { PlayerStatsStoreService } from '../player-stats/player-stats-store.service';
import type { RotationPlannerWorkspaceState } from '../workspace/workspace.models';
import { WorkspaceRepositoryService } from '../workspace/workspace-repository.service';
import { evaluateAbilityPlacement } from './rotation-planner-placement';
import {
  getAbilityTimelineSpan,
  removeNonGcdAction,
  removeAbilityAction,
  type PlannerAbilityDropPayload,
  type PlannerNonGcdDropPayload,
  type PlannerNonGcdTemplate,
  updateNonGcdActionPayload,
  upsertNonGcdAction,
  upsertAbilityAction,
} from './rotation-planner.utils';

const MIN_TICK_COUNT = 6;
const MAX_TICK_COUNT = 200;

const DEFAULT_ROTATION_PLANNER_STATE: RotationPlannerWorkspaceState = {
  startingAdrenaline: 100,
  tickCount: 100,
  nonGcdActions: [],
  abilityActions: [],
};

@Injectable({
  providedIn: 'root',
})
export class RotationPlannerStore {
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly gearBuilderStore = inject(GearBuilderStore);
  private readonly buffConfigurationStore = inject(BuffConfigurationStoreService);
  private readonly playerStatsStore = inject(PlayerStatsStoreService);
  private readonly workspaceRepository = inject(WorkspaceRepositoryService);
  private readonly initialState = this.loadInitialState();
  private readonly startingAdrenalineValue = signal(this.initialState.startingAdrenaline);
  private readonly tickCountValue = signal(this.initialState.tickCount);
  private readonly nonGcdActionsValue = signal<RotationAction[]>(this.initialState.nonGcdActions);
  private readonly abilityActionsValue = signal<RotationAction[]>(this.initialState.abilityActions);

  readonly startingAdrenaline = this.startingAdrenalineValue.asReadonly();
  readonly tickCount = this.tickCountValue.asReadonly();
  readonly nonGcdActions = this.nonGcdActionsValue.asReadonly();
  readonly abilityActions = this.abilityActionsValue.asReadonly();
  readonly maxStartingAdrenaline = computed(() =>
    resolveMaxAdrenaline({
      persistentBuffConfig: {
        buffIds: this.buffConfigurationStore.activeBuffIds(),
        relicIds: this.buffConfigurationStore.activeRelicIds(),
        pocketEffectItemIds: this.buffConfigurationStore.activePocketItemIds(),
      },
      gameData: this.gameDataStore.snapshot().catalog ?? {
        items: {},
        ammo: {},
        abilities: {},
        buffs: {},
        perks: {},
        relics: {},
        eofSpecs: {},
      },
    }),
  );

  readonly rotationPlan = computed<RotationPlan>(() => ({
    startingAdrenaline: this.startingAdrenaline(),
    tickCount: this.tickCount(),
    nonGcdActions: this.nonGcdActions(),
    abilityActions: this.abilityActions(),
  }));

  readonly timelineResult = computed(() =>
    buildBaseTimeline({
      rotationPlan: this.rotationPlan(),
    }),
  );

  readonly tickIndexes = computed(() =>
    Array.from({ length: this.tickCount() }, (_, index) => index),
  );

  constructor() {
    effect(() => {
      const maxAdrenaline = this.maxStartingAdrenaline();
      if (this.startingAdrenaline() > maxAdrenaline) {
        this.startingAdrenalineValue.set(maxAdrenaline);
      }
    });

    effect(() => {
      this.workspaceRepository.updateRotationPlannerState({
        startingAdrenaline: this.startingAdrenaline(),
        tickCount: this.tickCount(),
        nonGcdActions: this.nonGcdActions(),
        abilityActions: this.abilityActions(),
      });
    });
  }

  updateStartingAdrenaline(value: number | string | null): void {
    const parsedValue = normalizeIntegerInput(value, this.startingAdrenaline(), 0, this.maxStartingAdrenaline());
    this.startingAdrenalineValue.set(parsedValue);
  }

  updateTickCount(value: number | string | null): void {
    const parsedValue = normalizeIntegerInput(value, this.tickCount(), MIN_TICK_COUNT, MAX_TICK_COUNT);
    this.tickCountValue.set(parsedValue);
    const abilityDefinitions = this.gameDataStore.snapshot().catalog?.abilities ?? {};
    this.nonGcdActionsValue.update((actions) => actions.filter((action) => action.tick < parsedValue));
    this.abilityActionsValue.update((actions) => actions.filter((action) => {
      const abilityId = action.payload['abilityId'];
      if (typeof abilityId !== 'string') {
        return action.tick < parsedValue;
      }

      const definition = abilityDefinitions[abilityId];
      if (!definition) {
        return action.tick < parsedValue;
      }

      return action.tick + getAbilityTimelineSpan(definition) <= parsedValue;
    }));
  }

  canPlaceAbilityAtTick(
    definition: AbilityDefinition,
    tick: number,
    draggedActionId?: string,
  ): boolean {
    return this.evaluateAbilityPlacement(definition, tick, draggedActionId).isPlaceable;
  }

  evaluateAbilityPlacement(
    definition: AbilityDefinition,
    tick: number,
    draggedActionId?: string,
  ) {
    const catalog = this.gameDataStore.snapshot().catalog;
    if (!catalog) {
      return {
        isPlaceable: false,
      };
    }

    return evaluateAbilityPlacement({
      abilityActions: this.abilityActions(),
      nonGcdActions: this.nonGcdActions(),
      abilityDefinitions: catalog.abilities,
      tickCount: this.tickCount(),
      startingAdrenaline: this.startingAdrenaline(),
      abilityDefinition: definition,
      tick,
      payload: {
        sourceType: draggedActionId ? 'timeline' : 'catalog',
        abilityId: definition.id,
        actionId: draggedActionId,
      },
      catalog,
      playerStats: this.playerStatsStore.stats(),
      gearState: this.gearBuilderStore.snapshot(),
      buffState: this.buffConfigurationStore.state(),
    });
  }

  placeAbility(definition: AbilityDefinition, tick: number, payload?: PlannerAbilityDropPayload): boolean {
    const dropPayload: PlannerAbilityDropPayload = payload ?? {
      sourceType: 'catalog',
      abilityId: definition.id,
    };

    if (!this.canPlaceAbilityAtTick(definition, tick, dropPayload.actionId)) {
      return false;
    }

    this.abilityActionsValue.update((actions) => upsertAbilityAction(actions, dropPayload, tick));
    return true;
  }

  canPlaceNonGcdActionAtTick(tick: number): boolean {
    return tick >= 0 && tick < this.tickCount();
  }

  placeNonGcdAction(
    template: PlannerNonGcdTemplate,
    tick: number,
    payload?: PlannerNonGcdDropPayload,
  ): string | null {
    if (!this.canPlaceNonGcdActionAtTick(tick)) {
      return null;
    }

    let nextActionId: string | null = null;

    this.nonGcdActionsValue.update((actions) => {
      const nextActions = upsertNonGcdAction(actions, template, tick, payload);

      if (payload?.sourceType === 'timeline' && payload.actionId) {
        nextActionId = payload.actionId;
      } else {
        const previousIds = new Set(actions.map((action) => action.id));
        nextActionId =
          nextActions.find((action) => !previousIds.has(action.id) && action.tick === tick && action.actionType === template.actionType)?.id ??
          null;
      }

      return nextActions;
    });

    return nextActionId;
  }

  updateNonGcdAction(actionId: string, payloadUpdate: Record<string, unknown>): void {
    this.nonGcdActionsValue.update((actions) => updateNonGcdActionPayload(actions, actionId, payloadUpdate));
  }

  removeAbility(actionId: string): void {
    this.abilityActionsValue.update((actions) => removeAbilityAction(actions, actionId));
  }

  removeNonGcdAction(actionId: string): void {
    this.nonGcdActionsValue.update((actions) => removeNonGcdAction(actions, actionId));
  }

  reset(): void {
    this.startingAdrenalineValue.set(DEFAULT_ROTATION_PLANNER_STATE.startingAdrenaline);
    this.tickCountValue.set(DEFAULT_ROTATION_PLANNER_STATE.tickCount);
    this.nonGcdActionsValue.set(DEFAULT_ROTATION_PLANNER_STATE.nonGcdActions);
    this.abilityActionsValue.set(DEFAULT_ROTATION_PLANNER_STATE.abilityActions);
    this.workspaceRepository.updateRotationPlannerState(DEFAULT_ROTATION_PLANNER_STATE);
  }

  loadState(state: RotationPlannerWorkspaceState): void {
    this.startingAdrenalineValue.set(
      normalizeIntegerInput(state.startingAdrenaline, DEFAULT_ROTATION_PLANNER_STATE.startingAdrenaline, 0, this.maxStartingAdrenaline()),
    );
    this.tickCountValue.set(
      normalizeIntegerInput(state.tickCount, DEFAULT_ROTATION_PLANNER_STATE.tickCount, MIN_TICK_COUNT, MAX_TICK_COUNT),
    );
    this.nonGcdActionsValue.set(sanitizeRotationActions(state.nonGcdActions, 'non-gcd'));
    this.abilityActionsValue.set(sanitizeRotationActions(state.abilityActions, 'ability'));
  }

  private loadInitialState(): RotationPlannerWorkspaceState {
    const persisted = this.workspaceRepository.readRotationPlannerState();

    return {
      startingAdrenaline: normalizeIntegerInput(
        persisted.startingAdrenaline,
        DEFAULT_ROTATION_PLANNER_STATE.startingAdrenaline,
        0,
        HEIGHTENED_SENSES_MAX_STARTING_ADRENALINE,
      ),
      tickCount: normalizeIntegerInput(
        persisted.tickCount,
        DEFAULT_ROTATION_PLANNER_STATE.tickCount,
        MIN_TICK_COUNT,
        MAX_TICK_COUNT,
      ),
      nonGcdActions: sanitizeRotationActions(persisted.nonGcdActions, 'non-gcd'),
      abilityActions: sanitizeRotationActions(persisted.abilityActions, 'ability'),
    };
  }
}

const HEIGHTENED_SENSES_MAX_STARTING_ADRENALINE = MAX_ADRENALINE + 10;

function normalizeIntegerInput(
  value: number | string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const nextValue =
    typeof value === 'number'
      ? value
      : Number.parseInt(typeof value === 'string' ? value.trim() : '', 10);

  if (!Number.isFinite(nextValue)) {
    return fallback;
  }

  const integerValue = Math.trunc(nextValue);
  return Math.max(min, Math.min(max, integerValue));
}

function sanitizeRotationActions(
  actions: RotationAction[] | undefined,
  lane: RotationAction['lane'],
): RotationAction[] {
  if (!Array.isArray(actions)) {
    return [];
  }

  return actions
    .filter(
      (action): action is RotationAction =>
        typeof action?.id === 'string' &&
        typeof action?.tick === 'number' &&
        action?.lane === lane &&
        typeof action?.actionType === 'string' &&
        typeof action?.payload === 'object' &&
        action.payload !== null,
    )
    .map((action) => ({
      id: action.id,
      tick: Math.max(0, Math.trunc(action.tick)),
      lane: action.lane,
      actionType: action.actionType,
      payload: sanitizePayload(action.payload),
    }));
}

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) =>
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean',
    ),
  );
}
