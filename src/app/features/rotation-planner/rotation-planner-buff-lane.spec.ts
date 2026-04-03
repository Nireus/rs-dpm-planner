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
        isWarning: false,
        themeClass: undefined,
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
        isWarning: false,
        themeClass: undefined,
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
        isWarning: false,
        themeClass: undefined,
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
        isWarning: false,
        themeClass: undefined,
        startTick: 1,
        endTick: 2,
        span: 2,
        row: 0,
        stackPeak: 1,
      },
    ]);
  });

  it('filters Bloodlust stacks out of the shared buff lane', () => {
    const bars = buildPlannerBuffLaneBars({
      tickCount: 4,
      buffTimeline: {
        0: ['bloodlust'],
        1: ['bloodlust', 'bloodlust', 'berserk-buff'],
        2: ['berserk-buff'],
        3: [],
      },
      buffDefinitions: {
        bloodlust: {
          id: 'bloodlust',
          name: 'Bloodlust',
          category: 'temporary',
          sourceType: 'ability',
        },
        'berserk-buff': {
          id: 'berserk-buff',
          name: 'Berserk',
          category: 'temporary',
          sourceType: 'ability',
        },
      },
    });

    expect(bars).toEqual([
      {
        buffId: 'berserk-buff',
        name: 'Berserk',
        iconPath: undefined,
        isWarning: false,
        themeClass: undefined,
        startTick: 1,
        endTick: 2,
        span: 2,
        row: 0,
        stackPeak: 1,
      },
    ]);
  });

  it('filters Glacial Embrace and Essence Corruption stack buffs out of the shared buff lane', () => {
    const bars = buildPlannerBuffLaneBars({
      tickCount: 4,
      buffTimeline: {
        0: ['glacial-embrace'],
        1: ['glacial-embrace', 'essence-corruption', 'sunshine-buff'],
        2: ['sunshine-buff'],
        3: [],
      },
      buffDefinitions: {
        'glacial-embrace': {
          id: 'glacial-embrace',
          name: 'Glacial Embrace',
          category: 'temporary',
          sourceType: 'ability',
        },
        'essence-corruption': {
          id: 'essence-corruption',
          name: 'Essence Corruption',
          category: 'temporary',
          sourceType: 'item',
        },
        'sunshine-buff': {
          id: 'sunshine-buff',
          name: 'Sunshine',
          category: 'temporary',
          sourceType: 'ability',
        },
      },
    });

    expect(bars).toEqual([
      {
        buffId: 'sunshine-buff',
        name: 'Sunshine',
        iconPath: undefined,
        isWarning: false,
        themeClass: undefined,
        startTick: 1,
        endTick: 2,
        span: 2,
        row: 0,
        stackPeak: 1,
      },
    ]);
  });

  it('marks equilibrium cooldown as a warning-colored buff bar', () => {
    const bars = buildPlannerBuffLaneBars({
      tickCount: 4,
      buffTimeline: {
        0: [],
        1: ['equilibrium-cooldown'],
        2: ['equilibrium-cooldown'],
        3: [],
      },
      buffDefinitions: {
        'equilibrium-cooldown': {
          id: 'equilibrium-cooldown',
          name: 'Equilibrium cooldown',
          category: 'temporary',
          sourceType: 'perk',
          effectRefs: ['equilibrium-lock'],
        },
      },
    });

    expect(bars).toEqual([
      {
        buffId: 'equilibrium-cooldown',
        name: 'Equilibrium cooldown',
        iconPath: undefined,
        isWarning: true,
        themeClass: undefined,
        startTick: 1,
        endTick: 2,
        span: 2,
        row: 0,
        stackPeak: 1,
      },
    ]);
  });

  it('uses melee palette styling for buffs sourced from melee abilities', () => {
    const bars = buildPlannerBuffLaneBars({
      tickCount: 4,
      buffTimeline: {
        0: [],
        1: ['berserk-buff'],
        2: ['berserk-buff'],
        3: [],
      },
      buffDefinitions: {
        'berserk-buff': {
          id: 'berserk-buff',
          name: 'Berserk',
          category: 'temporary',
          sourceType: 'ability',
        },
      },
      timelineGeneratedBuffSources: [
        {
          buffId: 'berserk-buff',
          sourceType: 'ability',
          sourceId: 'berserk',
        },
      ],
      abilityDefinitions: {
        berserk: {
          id: 'berserk',
          name: 'Berserk',
          style: 'melee',
          subtype: 'ultimate',
          cooldownTicks: 100,
          adrenalineCost: 100,
          hitSchedule: [],
          baseDamage: {
            min: 0,
            max: 0,
          },
        },
      },
    });

    expect(bars).toEqual([
      {
        buffId: 'berserk-buff',
        name: 'Berserk',
        iconPath: undefined,
        isWarning: false,
        themeClass: 'style-melee',
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
