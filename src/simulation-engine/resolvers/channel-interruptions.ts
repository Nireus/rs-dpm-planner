import type { AbilityDefinition, EquipmentSlot } from '../../game-data/types';
import type { ItemInstanceConfig, RotationAction, SimulationConfig } from '../models';

const WEAPON_SLOTS = new Set<EquipmentSlot>(['weapon', 'offHand']);

export function resolveChannelEndTickExclusive(
  config: SimulationConfig,
  action: RotationAction,
  ability: Pick<AbilityDefinition, 'isChanneled' | 'channelDurationTicks'>,
  naturalEndTickExclusive = action.tick + Math.max(ability.channelDurationTicks ?? 0, 0),
): number {
  if (!ability.isChanneled || !ability.channelDurationTicks || ability.channelDurationTicks <= 0) {
    return action.tick;
  }

  const weaponSwapEffectiveTick = resolveFirstWeaponSwapEffectiveTick(
    config,
    action.tick,
    naturalEndTickExclusive,
  );

  return weaponSwapEffectiveTick ?? naturalEndTickExclusive;
}

export function resolveEffectiveChannelDurationTicks(
  config: SimulationConfig,
  action: RotationAction,
  ability: Pick<AbilityDefinition, 'isChanneled' | 'channelDurationTicks'>,
): number {
  return Math.max(resolveChannelEndTickExclusive(config, action, ability) - action.tick, 0);
}

export function isWeaponChangingGearSwap(config: SimulationConfig, action: RotationAction): boolean {
  if (action.actionType !== 'gear-swap') {
    return false;
  }

  const targetSlot = resolveGearSwapTargetSlot(config, action);
  return Boolean(targetSlot && WEAPON_SLOTS.has(targetSlot));
}

function resolveFirstWeaponSwapEffectiveTick(
  config: SimulationConfig,
  channelStartTick: number,
  naturalEndTickExclusive: number,
): number | null {
  const interruptingAction = [...config.rotationPlan.nonGcdActions]
    .filter((action) => isWeaponChangingGearSwap(config, action))
    .map((action) => action.tick + 1)
    .filter((effectiveTick) => effectiveTick > channelStartTick && effectiveTick < naturalEndTickExclusive)
    .sort((left, right) => left - right)[0];

  return typeof interruptingAction === 'number' ? interruptingAction : null;
}

function resolveGearSwapTargetSlot(config: SimulationConfig, action: RotationAction): EquipmentSlot | null {
  const explicitSlot = readStringPayload(action, 'slot');
  if (isEquipmentSlot(explicitSlot)) {
    return explicitSlot;
  }

  const instance = resolveGearSwapInstance(config, action);
  const definitionId = readStringPayload(action, 'definitionId') ??
    readStringPayload(action, 'itemId') ??
    instance?.definitionId ??
    null;
  const definitionSlot = definitionId ? config.gameData.items[definitionId]?.slot : undefined;

  return isEquipmentSlot(definitionSlot) ? definitionSlot : null;
}

function resolveGearSwapInstance(
  config: SimulationConfig,
  action: RotationAction,
): ItemInstanceConfig | null {
  const instanceId = readStringPayload(action, 'instanceId');
  const definitionId = readStringPayload(action, 'definitionId') ?? readStringPayload(action, 'itemId');
  const knownInstances = [
    ...Object.values(config.gearSetup.equipment).filter((instance): instance is ItemInstanceConfig => Boolean(instance)),
    ...(config.gearSetup.ammoSelection ? [config.gearSetup.ammoSelection] : []),
    ...config.inventory.items,
  ];

  return knownInstances.find((instance) =>
    (instanceId ? instance.instanceId === instanceId : true) &&
    (definitionId ? instance.definitionId === definitionId : true)
  ) ?? null;
}

function isEquipmentSlot(value: string | null | undefined): value is EquipmentSlot {
  if (!value) {
    return false;
  }

  return [
    'weapon',
    'offHand',
    'ammo',
    'head',
    'body',
    'legs',
    'hands',
    'feet',
    'ring',
    'amulet',
    'cape',
    'pocket',
  ].includes(value);
}

function readStringPayload(action: RotationAction, key: string): string | null {
  const value = action.payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
