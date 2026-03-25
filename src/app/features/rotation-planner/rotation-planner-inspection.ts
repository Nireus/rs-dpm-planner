import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition, EquipmentSlot, HitDefinition } from '../../../game-data/types';
import type { GearBuilderState } from '../gear/gear-builder.utils';
import { formatEquipmentSlot } from '../gear/gear-builder.utils';
import type { PlayerStats, RotationAction, RotationPlan, ValidationIssue } from '../../../simulation-engine/models';
import { resolveAdrenalineTimeline } from '../../../simulation-engine/resolvers/adrenaline';
import { resolveCooldownTimeline } from '../../../simulation-engine/resolvers/cooldowns';
import { buildBaseTimeline } from '../../../simulation-engine/timeline';
import {
  buildRotationPlannerSimulationConfig,
  collectPersistentBuffIds,
  type PlannerBuffStateSnapshot,
} from './rotation-planner-simulation';

export interface RotationPlannerTickInspection {
  tick: number;
  adrenaline: {
    start: number;
    end: number;
  };
  activePersistentBuffs: string[];
  activeTimelineBuffs: string[];
  equipmentState: Array<{
    slot: string;
    itemName: string;
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
  validationIssues: ValidationIssue[];
}

export function inspectRotationPlannerTick(input: {
  tick: number;
  catalog: GameDataCatalog;
  playerStats: PlayerStats;
  gearState: GearBuilderState;
  buffState: PlannerBuffStateSnapshot;
  rotationPlan: RotationPlan;
}): RotationPlannerTickInspection {
  const simulationConfig = buildRotationPlannerSimulationConfig(input);
  const timelineResult = buildBaseTimeline({
    rotationPlan: input.rotationPlan,
  });
  const adrenalineResult = resolveAdrenalineTimeline(simulationConfig);
  const cooldownResult = resolveCooldownTimeline(simulationConfig);
  const clampedTick = Math.max(0, Math.min(input.tick, input.rotationPlan.tickCount - 1));
  const bucket = timelineResult.timeline.ticks[clampedTick];
  const adrenalineTickState = adrenalineResult.tickStates[clampedTick];
  const cooldownTickState = cooldownResult.tickStates[clampedTick];
  const persistentBuffIds = collectPersistentBuffIds(input.buffState, input.catalog);
  const projectedGearState = projectGearStateAtTick(input.gearState, input.rotationPlan.nonGcdActions, clampedTick);

  return {
    tick: clampedTick,
    adrenaline: {
      start: adrenalineTickState?.valueAtTickStart ?? input.rotationPlan.startingAdrenaline,
      end: adrenalineTickState?.valueAtTickEnd ?? input.rotationPlan.startingAdrenaline,
    },
    activePersistentBuffs: persistentBuffIds.map(
      (buffId) => input.catalog.buffs[buffId]?.name ?? input.catalog.relics[buffId]?.name ?? buffId,
    ),
    activeTimelineBuffs: bucket.derivedBuffEntries.map(
      (entry) => input.catalog.buffs[entry.buffId]?.name ?? entry.buffId,
    ),
    equipmentState: Object.entries(projectedGearState.equipment)
      .filter((entry) => Boolean(entry[1]))
      .map(([slot, instance]) => ({
        slot: formatEquipmentSlot(slot as Parameters<typeof formatEquipmentSlot>[0]),
        itemName: input.catalog.items[instance!.definitionId]?.name ?? instance!.definitionId,
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
    hitsResolving: input.rotationPlan.abilityActions.flatMap((action) =>
      collectHitsResolvingAtTick(action, clampedTick, input.catalog),
    ),
    validationIssues: [
      ...timelineResult.validationIssues.filter((issue) => issue.tick === clampedTick),
      ...adrenalineResult.validationIssues.filter((issue) => issue.tick === clampedTick),
      ...cooldownResult.validationIssues.filter((issue) => issue.tick === clampedTick),
    ],
  };
}

function resolveAmmoState(
  gearState: GearBuilderState,
  catalog: GameDataCatalog,
): string | null {
  const ammoInstance = gearState.equipment['ammo'];
  if (!ammoInstance) {
    return null;
  }

  return catalog.items[ammoInstance.definitionId]?.name ?? ammoInstance.definitionId;
}

function projectGearStateAtTick(
  gearState: GearBuilderState,
  nonGcdActions: RotationAction[],
  tick: number,
): GearBuilderState {
  let projectedState: GearBuilderState = {
    equipment: { ...gearState.equipment },
    inventory: [...gearState.inventory],
  };

  for (const action of [...nonGcdActions].sort((left, right) => left.tick - right.tick)) {
    if (action.tick >= tick) {
      break;
    }

    if (action.actionType === 'gear-swap') {
      projectedState = applyProjectedGearSwap(projectedState, action);
    }
  }

  return projectedState;
}

function applyProjectedGearSwap(
  state: GearBuilderState,
  action: RotationAction,
): GearBuilderState {
  const instanceId = readStringPayload(action, 'instanceId');
  const slot = readStringPayload(action, 'slot') as EquipmentSlot | null;

  if (!instanceId || !slot) {
    return state;
  }

  const inventoryInstance = state.inventory.find((item) => item.instanceId === instanceId);
  if (!inventoryInstance) {
    return state;
  }

  const displaced = state.equipment[slot];
  const nextInventory = state.inventory.filter((item) => item.instanceId !== instanceId);

  if (displaced) {
    nextInventory.push(displaced);
  }

  return {
    equipment: {
      ...state.equipment,
      [slot]: inventoryInstance,
    },
    inventory: nextInventory,
  };
}

function readPlannerActionLabel(action: RotationAction): string {
  const label = action.payload['label'];
  return typeof label === 'string' && label ? label : action.actionType;
}

function collectHitsResolvingAtTick(
  action: RotationAction,
  tick: number,
  catalog: GameDataCatalog,
): string[] {
  const abilityDefinition = resolveAbilityDefinition(action, catalog);
  if (!abilityDefinition) {
    return [];
  }

  return abilityDefinition.hitSchedule
    .filter((hit) => action.tick + hit.tickOffset === tick)
    .map((hit, index) => formatResolvingHitLabel(abilityDefinition, hit, index));
}

function resolveAbilityDefinition(
  action: RotationAction,
  catalog: GameDataCatalog,
): AbilityDefinition | null {
  const abilityId = action.payload['abilityId'];
  if (typeof abilityId !== 'string') {
    return null;
  }

  return catalog.abilities[abilityId] ?? null;
}

function formatResolvingHitLabel(
  definition: AbilityDefinition,
  hit: HitDefinition,
  index: number,
): string {
  const hitLabel = hit.id ? humanizeHitId(hit.id) : `Hit ${index + 1}`;
  return `${definition.name}: ${hitLabel} (${hit.damage.min}-${hit.damage.max}%)`;
}

function humanizeHitId(hitId: string): string {
  return hitId
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function readStringPayload(action: RotationAction, key: string): string | null {
  const value = action.payload[key];
  return typeof value === 'string' && value ? value : null;
}
