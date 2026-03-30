import type { BuffDefinition, EntityId } from '../../game-data/types';

export interface ResolvedBuffStackRuleState {
  maxStacks: number | null;
  gainMultiplier: number;
}

export function resolveBuffStackRuleState(
  definition: BuffDefinition | undefined,
  activeBuffIds: EntityId[],
): ResolvedBuffStackRuleState {
  let maxStacks = typeof definition?.stackRules?.maxStacks === 'number'
    ? definition.stackRules.maxStacks
    : null;
  let gainMultiplier = 1;

  for (const modifier of definition?.stackRules?.conditionalModifiers ?? []) {
    if (!activeBuffIds.includes(modifier.whenBuffActive)) {
      continue;
    }

    if (typeof modifier.maxStacks === 'number') {
      maxStacks = typeof maxStacks === 'number'
        ? Math.max(maxStacks, modifier.maxStacks)
        : modifier.maxStacks;
    }

    if (typeof modifier.gainMultiplier === 'number' && Number.isFinite(modifier.gainMultiplier)) {
      gainMultiplier *= modifier.gainMultiplier;
    }
  }

  return {
    maxStacks,
    gainMultiplier,
  };
}

export function clampBuffStacks(
  value: number,
  maxStacks: number | null,
): number {
  const upperBound = typeof maxStacks === 'number' ? maxStacks : value;
  return Math.max(0, Math.min(value, upperBound));
}
