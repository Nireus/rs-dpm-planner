import { describe, expect, it } from 'vitest';

import { advanceChanceAccumulator, createChanceAccumulatorState } from './chance-accumulator';

describe('chance accumulator', () => {
  it('procs at 100% and carries overflow', () => {
    let state = createChanceAccumulatorState();

    state = advanceChanceAccumulator(state, 26).nextState;
    state = advanceChanceAccumulator(state, 26).nextState;
    state = advanceChanceAccumulator(state, 26).nextState;
    const result = advanceChanceAccumulator(state, 26);

    expect(result.procCount).toBe(1);
    expect(result.nextState.progressPercent).toBe(4);
  });
});
