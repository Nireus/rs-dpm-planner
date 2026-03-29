export interface StartingStackState {
  deathsporeStacks?: number;
  perfectEquilibriumStacks?: number;
}

export const MAX_STARTING_DEATHSPORE_STACKS = 11;
export const MAX_STARTING_PERFECT_EQUILIBRIUM_STACKS = 7;

export function normalizeStartingDeathsporeStacks(value: number | null | undefined): number {
  return normalizeStartingStackValue(value, 0, MAX_STARTING_DEATHSPORE_STACKS);
}

export function normalizeStartingPerfectEquilibriumStacks(value: number | null | undefined): number {
  return normalizeStartingStackValue(value, 0, MAX_STARTING_PERFECT_EQUILIBRIUM_STACKS);
}

function normalizeStartingStackValue(
  value: number | null | undefined,
  min: number,
  max: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.trunc(value)));
}
