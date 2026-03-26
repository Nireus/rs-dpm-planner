import type {
  AbilityDefinition,
  AmmoDefinition,
  EntityId,
  EquipmentSlot,
  ItemDefinition,
} from '../../game-data/types';
import type {
  ItemInstanceConfig,
  RotationAction,
  SimulationConfig,
  ValidationIssue,
} from '../models';
import { resolveEffectiveAbilityDefinition } from '../abilities/effective-ability';
import { buildBaseTimeline } from '../timeline';
import { evaluateAbilityAvailability } from '../rules/ability-availability';

interface ValidationContext {
  config: SimulationConfig;
  itemPool: Map<EntityId, ItemInstanceConfig>;
  inventoryDefinitions: ItemDefinition[];
}

interface ProjectedGearState {
  equipment: Partial<Record<EquipmentSlot, ItemInstanceConfig>>;
  ammoSelection?: ItemInstanceConfig;
}

interface ChannelWindow {
  startTick: number;
  endTickExclusive: number;
}

export function validateStrictRotationPlan(config: SimulationConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const context = createValidationContext(config);
  const timelineResult = buildBaseTimeline({ rotationPlan: config.rotationPlan });

  issues.push(...timelineResult.validationIssues);
  issues.push(...validateAbilityLaneOverlap(timelineResult.timeline.ticks));
  issues.push(...validateSwapActionPayloads(config, context));
  issues.push(...validateAbilityActions(config, context));

  return issues;
}

function createValidationContext(config: SimulationConfig): ValidationContext {
  const itemPool = new Map<EntityId, ItemInstanceConfig>();

  for (const item of Object.values(config.gearSetup.equipment)) {
    if (item) {
      itemPool.set(item.definitionId, item);
    }
  }

  if (config.gearSetup.ammoSelection) {
    itemPool.set(config.gearSetup.ammoSelection.definitionId, config.gearSetup.ammoSelection);
  }

  for (const item of config.inventory.items) {
    itemPool.set(item.definitionId, item);
  }

  const inventoryDefinitions = config.inventory.items
    .map((item) => config.gameData.items[item.definitionId])
    .filter((item): item is ItemDefinition => Boolean(item));

  return {
    config,
    itemPool,
    inventoryDefinitions,
  };
}

function validateAbilityLaneOverlap(
  ticks: Array<{ tickIndex: number; abilityActions: RotationAction[] }>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const tick of ticks) {
    if (tick.abilityActions.length <= 1) {
      continue;
    }

    for (const action of tick.abilityActions) {
      issues.push({
        code: 'timeline.ability_overlap',
        severity: 'error',
        tick: tick.tickIndex,
        relatedActionId: action.id,
        message: 'Only one ability action may start on a tick.',
      });
    }
  }

  return issues;
}

function validateSwapActionPayloads(config: SimulationConfig, context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const action of config.rotationPlan.nonGcdActions) {
    if (action.actionType === 'gear-swap') {
      const instanceId = readStringPayload(action, 'instanceId');
      const definitionId = readStringPayload(action, 'definitionId') ?? readStringPayload(action, 'itemId');
      const targetSlot = readStringPayload(action, 'slot') as EquipmentSlot | null;

      if (!instanceId && !definitionId) {
        issues.push(createActionIssue(action, 'action.invalid_payload', 'Gear swap is missing item reference.'));
        continue;
      }

      const instance = findItemInstance(config, definitionId ?? null, instanceId);
      const resolvedDefinitionId = definitionId ?? instance?.definitionId ?? null;
      const itemDefinition = resolvedDefinitionId ? config.gameData.items[resolvedDefinitionId] : undefined;

      if (!itemDefinition) {
        issues.push(
          createActionIssue(
            action,
            'action.invalid_item_reference',
            `Unknown gear item "${definitionId ?? instanceId}".`,
          ),
        );
        continue;
      }

      if (!instance) {
        issues.push(
          createActionIssue(
            action,
            'action.invalid_equip_state',
            `Gear swap item "${itemDefinition.name}" is not present in backpack or equipped state.`,
          ),
        );
      }

      if (!itemDefinition.slot) {
        issues.push(
          createActionIssue(
            action,
            'action.invalid_slot',
            `Item "${itemDefinition.name}" cannot be equipped into a gear slot.`,
          ),
        );
        continue;
      }

      if (targetSlot && targetSlot !== itemDefinition.slot) {
        issues.push(
          createActionIssue(
            action,
            'action.invalid_slot',
            `Item "${itemDefinition.name}" cannot be equipped into slot "${targetSlot}".`,
          ),
        );
      }
    }

    if (action.actionType === 'ammo-swap') {
      const ammoId = readStringPayload(action, 'ammoId') ?? readStringPayload(action, 'definitionId');

      if (!ammoId) {
        issues.push(createActionIssue(action, 'action.invalid_payload', 'Ammo swap is missing ammo reference.'));
        continue;
      }

      const ammoDefinition = resolveAmmoDefinition(config, ammoId);

      if (!ammoDefinition) {
        issues.push(createActionIssue(action, 'action.invalid_item_reference', `Unknown ammo "${ammoId}".`));
        continue;
      }

      if (!context.itemPool.has(ammoId)) {
        issues.push(
          createActionIssue(
            action,
            'action.invalid_equip_state',
            `Ammo swap item "${ammoDefinition.name}" is not present in current gear or inventory.`,
          ),
        );
      }
    }
  }

  return issues;
}

function validateAbilityActions(config: SimulationConfig, context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const abilityActions = [...config.rotationPlan.abilityActions].sort((left, right) => left.tick - right.tick);
  const nonGcdActions = [...config.rotationPlan.nonGcdActions].sort((left, right) => left.tick - right.tick);
  const cooldownMap = new Map<EntityId, number>();
  let appliedSwapIndex = 0;
  let projectedGearState = createInitialProjectedGearState(config);
  let activeChannelUntilTickExclusive = -1;
  const channelWindows: ChannelWindow[] = [];

  for (const action of abilityActions) {
    const abilityId = readStringPayload(action, 'abilityId');
    if (!abilityId) {
      issues.push(createActionIssue(action, 'ability.invalid_payload', 'Ability action is missing abilityId.'));
      continue;
    }

    const baseAbility = config.gameData.abilities[abilityId];
    if (!baseAbility) {
      issues.push(createActionIssue(action, 'ability.missing_definition', `Unknown ability "${abilityId}".`));
      continue;
    }

    const ability = resolveEffectiveAbilityDefinition(config, action) ?? baseAbility;

    while (
      appliedSwapIndex < nonGcdActions.length &&
      nonGcdActions[appliedSwapIndex].tick < action.tick
    ) {
      projectedGearState = applyProjectedSwap(config, projectedGearState, nonGcdActions[appliedSwapIndex]);
      appliedSwapIndex += 1;
    }

    if (action.tick < activeChannelUntilTickExclusive) {
      issues.push(
        createActionIssue(
          action,
          'ability.channel_conflict',
          `Ability "${ability.name}" starts before the previous channel completes.`,
        ),
      );
    }

    const availability = evaluateAbilityAvailability(baseAbility, {
      playerStats: config.playerStats,
      equippedItems: getEquippedDefinitions(projectedGearState, config),
      inventoryItems: context.inventoryDefinitions,
      equippedInstances: getEquippedInstances(projectedGearState),
    });

    if (!availability.isAvailable) {
      for (const issue of availability.issues) {
        issues.push(
          createActionIssue(action, 'ability.unavailable', `${ability.name}: ${issue.message}`),
        );
      }
    }

    const nextAvailableTick = cooldownMap.get(ability.id) ?? 0;
    if (action.tick < nextAvailableTick) {
      issues.push(
        createActionIssue(
          action,
          'ability.cooldown_conflict',
          `Ability "${ability.name}" is on cooldown until tick ${nextAvailableTick}.`,
        ),
      );
    }

    cooldownMap.set(ability.id, action.tick + Math.max(ability.cooldownTicks, 0));

    if (ability.isChanneled && ability.channelDurationTicks && ability.channelDurationTicks > 0) {
      activeChannelUntilTickExclusive = action.tick + ability.channelDurationTicks;
      channelWindows.push({
        startTick: action.tick,
        endTickExclusive: activeChannelUntilTickExclusive,
      });
    } else if (action.tick >= activeChannelUntilTickExclusive) {
      activeChannelUntilTickExclusive = -1;
    }
  }

  for (const action of nonGcdActions) {
    if (isChannelSensitiveAction(action) && isWithinChannelWindow(action.tick, channelWindows)) {
      issues.push(
        createActionIssue(
          action,
          'action.channel_conflict',
          'Gear and ammo swaps during an active channel are not supported in strict mode.',
        ),
      );
    }
  }

  return issues;
}

function createInitialProjectedGearState(config: SimulationConfig): ProjectedGearState {
  return {
    equipment: { ...config.gearSetup.equipment },
    ammoSelection: config.gearSetup.ammoSelection,
  };
}

function applyProjectedSwap(
  config: SimulationConfig,
  state: ProjectedGearState,
  action: RotationAction,
): ProjectedGearState {
  if (action.actionType === 'ammo-swap') {
    const ammoId = readStringPayload(action, 'ammoId') ?? readStringPayload(action, 'definitionId');
    if (!ammoId) {
      return state;
    }

    const instance = findItemInstance(config, ammoId);
    if (!instance) {
      return state;
    }

    return {
      ...state,
      ammoSelection: instance,
      equipment: {
        ...state.equipment,
        ammo: instance,
      },
    };
  }

  if (action.actionType === 'gear-swap') {
    const instanceId = readStringPayload(action, 'instanceId');
    const definitionId = readStringPayload(action, 'definitionId') ?? readStringPayload(action, 'itemId');
    if (!definitionId && !instanceId) {
      return state;
    }

    const instance = findItemInstance(config, definitionId ?? null, instanceId);
    const itemDefinition = config.gameData.items[definitionId ?? instance?.definitionId ?? ''];
    const targetSlot = (readStringPayload(action, 'slot') as EquipmentSlot | null) ?? itemDefinition?.slot;

    if (!itemDefinition || !targetSlot || !instance) {
      return state;
    }

    return {
      ...state,
      equipment: {
        ...state.equipment,
        [targetSlot]: instance,
      },
    };
  }

  return state;
}

function getEquippedDefinitions(state: ProjectedGearState, config: SimulationConfig): ItemDefinition[] {
  const definitions: ItemDefinition[] = [];

  for (const item of Object.values(state.equipment)) {
    if (!item) {
      continue;
    }

    const definition = config.gameData.items[item.definitionId];
    if (definition) {
      definitions.push(definition);
    }
  }

  return definitions;
}

function getEquippedInstances(state: ProjectedGearState): ItemInstanceConfig[] {
  return Object.values(state.equipment).filter((item): item is ItemInstanceConfig => Boolean(item));
}

function findItemInstance(
  config: SimulationConfig,
  definitionId: EntityId | null,
  instanceId?: string | null,
): ItemInstanceConfig | undefined {
  if (instanceId) {
    for (const item of Object.values(config.gearSetup.equipment)) {
      if (item?.instanceId === instanceId) {
        return item;
      }
    }

    if (config.gearSetup.ammoSelection?.instanceId === instanceId) {
      return config.gearSetup.ammoSelection;
    }

    const inventoryMatch = config.inventory.items.find((item) => item.instanceId === instanceId);
    if (inventoryMatch) {
      return inventoryMatch;
    }
  }

  if (!definitionId) {
    return undefined;
  }

  for (const item of Object.values(config.gearSetup.equipment)) {
    if (item?.definitionId === definitionId) {
      return item;
    }
  }

  if (config.gearSetup.ammoSelection?.definitionId === definitionId) {
    return config.gearSetup.ammoSelection;
  }

  return config.inventory.items.find((item) => item.definitionId === definitionId);
}

function resolveAmmoDefinition(
  config: SimulationConfig,
  ammoId: EntityId,
): AmmoDefinition | ItemDefinition | undefined {
  return config.gameData.ammo[ammoId] ?? config.gameData.items[ammoId];
}

function isChannelSensitiveAction(action: RotationAction): boolean {
  return action.actionType === 'gear-swap' || action.actionType === 'ammo-swap';
}

function isWithinChannelWindow(tick: number, windows: ChannelWindow[]): boolean {
  return windows.some((window) => tick > window.startTick && tick < window.endTickExclusive);
}

function readStringPayload(action: RotationAction, key: string): string | null {
  const value = action.payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function createActionIssue(
  action: RotationAction,
  code: string,
  message: string,
): ValidationIssue {
  return {
    code,
    severity: 'error',
    tick: action.tick,
    relatedActionId: action.id,
    message,
  };
}
