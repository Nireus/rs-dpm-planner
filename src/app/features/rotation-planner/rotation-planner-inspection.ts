import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition, EquipmentSlot } from '../../../game-data/types';
import type { GearBuilderState } from '../gear/gear-builder.utils';
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
  deathsporeStacks: number | null;
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
  const projectedGearState = projectGearStateAtTick(input.gearState, input.rotationPlan.nonGcdActions, clampedTick);

  return {
    tick: clampedTick,
    adrenaline: {
      start: adrenalineTickState?.valueAtTickStart ?? input.rotationPlan.startingAdrenaline,
      end: adrenalineTickState?.valueAtTickEnd ?? input.rotationPlan.startingAdrenaline,
    },
    deathsporeStacks:
      typeof simulatedTickState?.deathsporeStacks === 'number' ? simulatedTickState.deathsporeStacks : null,
    activePersistentBuffs: persistentBuffIds.map(
      (buffId) => input.catalog.buffs[buffId]?.name ?? input.catalog.relics[buffId]?.name ?? buffId,
    ),
    activeTemporaryBuffs: temporaryBuffIds.map((buffId) => input.catalog.buffs[buffId]?.name ?? buffId),
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

function readStringPayload(action: RotationAction, key: string): string | null {
  const value = action.payload[key];
  return typeof value === 'string' && value ? value : null;
}

function shouldUseResolvedHitTickInPlanner(ability: AbilityDefinition): boolean {
  return ability.id === 'rapid-fire';
}

function isCooldownLikeBuff(definition: GameDataCatalog['buffs'][string] | undefined): boolean {
  return definition?.effectRefs?.some((effectRef) => effectRef.endsWith('-cooldown')) ?? false;
}
