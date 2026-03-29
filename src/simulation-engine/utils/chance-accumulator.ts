export interface ChanceAccumulatorState {
  progressPercent: number;
}

export interface ChanceAccumulatorResult {
  nextState: ChanceAccumulatorState;
  procCount: number;
}

export function createChanceAccumulatorState(): ChanceAccumulatorState {
  return { progressPercent: 0 };
}

export function advanceChanceAccumulator(
  state: ChanceAccumulatorState,
  chancePercent: number,
): ChanceAccumulatorResult {
  const total = Math.max(0, state.progressPercent + chancePercent);
  const procCount = Math.floor(total / 100);
  const progressPercent = total % 100;

  return {
    nextState: {
      progressPercent,
    },
    procCount,
  };
}
