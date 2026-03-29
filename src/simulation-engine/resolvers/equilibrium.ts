import { EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type { EntityId } from '../../game-data/types';
import type {
  ItemInstanceConfig,
  SimulationConfig,
  TimelineGeneratedBuffSource,
} from '../models';

const EQUILIBRIUM_COOLDOWN_BUFF_ID = 'equilibrium-cooldown';
const EQUILIBRIUM_COOLDOWN_TICKS = 50;

export interface EquilibriumTimelineResult {
  buffTimeline: Record<number, EntityId[]>;
  timelineGeneratedBuffSources: TimelineGeneratedBuffSource[];
  notes: string[];
}

export function resolveEquilibriumTimeline(
  config: SimulationConfig,
): EquilibriumTimelineResult {
  const buffTimeline = createEmptyBuffTimeline(config.rotationPlan.tickCount);
  const gearSwaps = [...config.rotationPlan.nonGcdActions]
    .filter((action) => action.actionType === 'gear-swap')
    .sort((left, right) => left.tick - right.tick);

  if (!gearSwaps.length) {
    return {
      buffTimeline,
      timelineGeneratedBuffSources: [],
      notes: collectHighestEquilibriumRank(config) > 0
        ? ['Equilibrium: prevents critical strikes and leaves a 30-second anti-crit debuff after unequipping.']
        : [],
    };
  }

  let projectedEquipment = { ...config.gearSetup.equipment };
  let projectedInventory = [...config.inventory.items];
  let hadEquilibrium = equipmentHasEquilibrium(config, projectedEquipment);

  for (const swap of gearSwaps) {
    const instanceId = readStringPayload(swap.payload['instanceId']);
    const slot = readStringPayload(swap.payload['slot']);
    if (!instanceId || !slot) {
      continue;
    }

    const inventoryInstance = projectedInventory.find((item) => item.instanceId === instanceId);
    if (!inventoryInstance) {
      continue;
    }

    const displaced = projectedEquipment[slot as keyof typeof projectedEquipment];
    projectedInventory = projectedInventory.filter((item) => item.instanceId !== instanceId);
    if (displaced) {
      projectedInventory.push(displaced);
    }

    projectedEquipment = {
      ...projectedEquipment,
      [slot]: inventoryInstance,
    };

    const hasEquilibrium = equipmentHasEquilibrium(config, projectedEquipment);
    if (hadEquilibrium && !hasEquilibrium) {
      const startTick = swap.tick + 1;
      const endTick = Math.min(config.rotationPlan.tickCount - 1, swap.tick + EQUILIBRIUM_COOLDOWN_TICKS);

      for (let tick = startTick; tick <= endTick; tick += 1) {
        buffTimeline[tick] = [...new Set([...(buffTimeline[tick] ?? []), EQUILIBRIUM_COOLDOWN_BUFF_ID])];
      }
    }

    hadEquilibrium = hasEquilibrium;
  }

  const hasGeneratedCooldown = Object.values(buffTimeline).some((buffIds) =>
    buffIds.includes(EQUILIBRIUM_COOLDOWN_BUFF_ID),
  );

  return {
    buffTimeline,
    timelineGeneratedBuffSources: hasGeneratedCooldown
      ? [{ buffId: EQUILIBRIUM_COOLDOWN_BUFF_ID, sourceType: 'event', sourceId: EFFECT_REF_IDS.equilibrium }]
      : [],
    notes: collectHighestEquilibriumRank(config) > 0 || hasGeneratedCooldown
      ? ['Equilibrium: prevents critical strikes and leaves a 30-second anti-crit debuff after unequipping.']
      : [],
  };
}

function equipmentHasEquilibrium(
  config: SimulationConfig,
  equipment: SimulationConfig['gearSetup']['equipment'],
): boolean {
  return Object.values(equipment).some((instance) => instanceHasEquilibrium(config, instance));
}

function instanceHasEquilibrium(
  config: SimulationConfig,
  instance: ItemInstanceConfig | undefined,
): boolean {
  if (!instance?.configuredPerks?.length) {
    return false;
  }

  return instance.configuredPerks.some((perk) => {
    if (perk.perkId !== 'equilibrium') {
      return false;
    }

    return config.gameData.perks[perk.perkId]?.effectRefs?.includes(EFFECT_REF_IDS.equilibrium) ?? false;
  });
}

function collectHighestEquilibriumRank(config: SimulationConfig): number {
  return Object.values(config.gearSetup.equipment).reduce((highestRank, instance) => {
    if (!instance?.configuredPerks?.length) {
      return highestRank;
    }

    for (const perk of instance.configuredPerks) {
      if (perk.perkId === 'equilibrium') {
        highestRank = Math.max(highestRank, perk.rank ?? 1);
      }
    }

    return highestRank;
  }, 0);
}

function createEmptyBuffTimeline(tickCount: number): Record<number, EntityId[]> {
  return Object.fromEntries(Array.from({ length: tickCount }, (_, tick) => [tick, []]));
}

function readStringPayload(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
