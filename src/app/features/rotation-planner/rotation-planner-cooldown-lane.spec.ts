import { describe, expect, it } from 'vitest';
import { buildPlannerCooldownLaneBars } from './rotation-planner-cooldown-lane';

describe('buildPlannerCooldownLaneBars', () => {
  it('shows cooldown-style generated buffs on the cooldown lane', () => {
    const bars = buildPlannerCooldownLaneBars({
      tickCount: 8,
      cooldownTimeline: {},
      abilityDefinitions: {},
      buffTimeline: {
        0: [],
        1: ['feasting-spores-cooldown'],
        2: ['feasting-spores-cooldown'],
        3: ['feasting-spores-cooldown'],
        4: [],
        5: [],
        6: [],
        7: [],
      },
      buffDefinitions: {
        'feasting-spores-cooldown': {
          id: 'feasting-spores-cooldown',
          name: 'Feasting Spores cooldown',
          category: 'temporary',
          sourceType: 'item',
          durationTicks: 50,
          effectRefs: ['deathspore-cooldown'],
          iconPath: 'deathspore.png',
        },
      },
    });

    expect(bars).toEqual([
      {
        abilityId: 'feasting-spores-cooldown',
        name: 'Feasting Spores cooldown',
        iconPath: 'deathspore.png',
        startTick: 1,
        endTick: 3,
        span: 3,
        row: 0,
      },
    ]);
  });
});
