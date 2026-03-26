import { describe, expect, it } from 'vitest';

import { buildPlannerBuffLaneBars, shortLabelForBuffBar } from './rotation-planner-buff-lane';

describe('buildPlannerBuffLaneBars', () => {
  it('merges contiguous buff ticks into a single bar', () => {
    const bars = buildPlannerBuffLaneBars({
      tickCount: 8,
      buffTimeline: {
        0: [],
        1: [],
        2: ['dracolich-infusion'],
        3: ['dracolich-infusion'],
        4: ['dracolich-infusion'],
        5: [],
        6: [],
        7: [],
      },
      buffDefinitions: {
        'dracolich-infusion': {
          id: 'dracolich-infusion',
          name: 'Dracolich infusion',
          category: 'temporary',
          sourceType: 'item',
        },
      },
    });

    expect(bars).toEqual([
      {
        buffId: 'dracolich-infusion',
        name: 'Dracolich infusion',
        iconPath: undefined,
        startTick: 2,
        endTick: 4,
        span: 3,
        row: 0,
        stackPeak: 1,
      },
    ]);
  });

  it('assigns separate rows to overlapping buff windows', () => {
    const bars = buildPlannerBuffLaneBars({
      tickCount: 8,
      buffTimeline: {
        0: [],
        1: ['buff-a'],
        2: ['buff-a', 'buff-b'],
        3: ['buff-a', 'buff-b'],
        4: ['buff-b'],
        5: [],
        6: [],
        7: [],
      },
      buffDefinitions: {
        'buff-a': {
          id: 'buff-a',
          name: 'Buff A',
          category: 'temporary',
          sourceType: 'item',
        },
        'buff-b': {
          id: 'buff-b',
          name: 'Buff B',
          category: 'temporary',
          sourceType: 'item',
        },
      },
    });

    expect(bars).toEqual([
      {
        buffId: 'buff-a',
        name: 'Buff A',
        iconPath: undefined,
        startTick: 1,
        endTick: 3,
        span: 3,
        row: 0,
        stackPeak: 1,
      },
      {
        buffId: 'buff-b',
        name: 'Buff B',
        iconPath: undefined,
        startTick: 2,
        endTick: 4,
        span: 3,
        row: 1,
        stackPeak: 1,
      },
    ]);
  });

  it('filters cooldown-style states out of the buff lane', () => {
    const bars = buildPlannerBuffLaneBars({
      tickCount: 4,
      buffTimeline: {
        0: ['feasting-spores-cooldown'],
        1: ['feasting-spores-cooldown', 'dracolich-infusion'],
        2: ['dracolich-infusion'],
        3: [],
      },
      buffDefinitions: {
        'feasting-spores-cooldown': {
          id: 'feasting-spores-cooldown',
          name: 'Feasting Spores cooldown',
          category: 'temporary',
          sourceType: 'item',
          effectRefs: ['deathspore-cooldown'],
        },
        'dracolich-infusion': {
          id: 'dracolich-infusion',
          name: 'Dracolich infusion',
          category: 'temporary',
          sourceType: 'item',
        },
      },
    });

    expect(bars).toEqual([
      {
        buffId: 'dracolich-infusion',
        name: 'Dracolich infusion',
        iconPath: undefined,
        startTick: 1,
        endTick: 2,
        span: 2,
        row: 0,
        stackPeak: 1,
      },
    ]);
  });
});

describe('shortLabelForBuffBar', () => {
  it('creates a compact readable label', () => {
    expect(shortLabelForBuffBar('Elite Dracolich infusion')).toBe('ED');
  });
});
