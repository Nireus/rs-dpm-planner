import type { EntityId } from '../../game-data/types';
import type { RotationAction, SimulationConfig, ValidationIssue } from '../models';

export interface ChannelTickState {
  tick: number;
  activeChannel?: {
    sourceActionId: string;
    abilityId: EntityId;
    remainingTicks: number;
  };
}

export interface ChannelTimelineResult {
  tickStates: ChannelTickState[];
  validationIssues: ValidationIssue[];
}

export function resolveChannelTimeline(
  config: SimulationConfig,
  blockedActionIds: ReadonlySet<string> = new Set(),
): ChannelTimelineResult {
  const tickStates: ChannelTickState[] = Array.from(
    { length: config.rotationPlan.tickCount },
    (_, tick) => ({ tick }),
  );

  for (const action of [...config.rotationPlan.abilityActions].sort((left, right) => left.tick - right.tick)) {
    if (blockedActionIds.has(action.id)) {
      continue;
    }

    const abilityId = readAbilityId(action);
    if (!abilityId) {
      continue;
    }

    const ability = config.gameData.abilities[abilityId];
    if (!ability?.isChanneled || !ability.channelDurationTicks || ability.channelDurationTicks <= 0) {
      continue;
    }

    for (let offset = 0; offset < ability.channelDurationTicks; offset += 1) {
      const tick = action.tick + offset;
      if (tick < 0 || tick >= config.rotationPlan.tickCount) {
        continue;
      }

      tickStates[tick].activeChannel = {
        sourceActionId: action.id,
        abilityId,
        remainingTicks: ability.channelDurationTicks - offset,
      };
    }
  }

  return {
    tickStates,
    validationIssues: [],
  };
}

function readAbilityId(action: RotationAction): EntityId | null {
  const abilityId = action.payload['abilityId'];
  return typeof abilityId === 'string' && abilityId.length > 0 ? abilityId : null;
}
