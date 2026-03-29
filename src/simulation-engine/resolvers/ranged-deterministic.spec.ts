import { describe, expect, it } from 'vitest';

import type { AbilityDefinition, ItemDefinition } from '../../game-data/types';
import type { LoadedGameDataSnapshot, SimulationConfig } from '../models';
import { resolveDeterministicRangedTimeline } from './ranged-deterministic';

function createAbility(overrides: Partial<AbilityDefinition> = {}): AbilityDefinition {
  return {
    id: 'rapid-fire',
    name: 'Rapid Fire',
    style: 'ranged',
    subtype: 'enhanced',
    cooldownTicks: 34,
    adrenalineCost: 25,
    isChanneled: true,
    channelDurationTicks: 9,
    hitSchedule: Array.from({ length: 8 }, (_, index) => ({
      id: `rapid-fire-hit-${index + 1}`,
      tickOffset: index + 1,
      damage: { min: 75, max: 85 },
    })),
    baseDamage: {
      min: 600,
      max: 680,
    },
    ...overrides,
  };
}

function createItem(overrides: Partial<ItemDefinition> = {}): ItemDefinition {
  return {
    id: 'bolg',
    name: 'Bow of the Last Guardian',
    category: 'weapon',
    slot: 'weapon',
    combatStyleTags: ['ranged'],
    requirements: {
      requiredEquipmentTags: ['two-handed-bow'],
    },
    ...overrides,
  };
}

function createConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  const gameData: LoadedGameDataSnapshot = {
    items: {
      'essence-of-finality': createItem({
        id: 'essence-of-finality',
        name: 'Essence of Finality amulet',
        category: 'jewellery',
        slot: 'amulet',
        effectRefs: ['eof-special-access'],
        configOptions: [
          {
            id: 'stored-special',
            label: 'Stored special',
            type: 'select',
            defaultValue: 'dark-bow',
            options: ['dark-bow', 'eldritch-crossbow', 'none'],
          },
        ],
      }),
      bolg: createItem({
        effectRefs: ['bolg-passive', 'weapon-special-access', 'weapon-special:balance-by-force'],
      }),
      'eldritch-crossbow': createItem({
        id: 'eldritch-crossbow',
        name: 'Eldritch crossbow',
        category: 'weapon',
        slot: 'weapon',
        effectRefs: ['weapon-special-access', 'weapon-special:split-soul'],
      }),
      'dracolich-coif': createItem({
        id: 'dracolich-coif',
        name: 'Dracolich coif',
        category: 'armor',
        slot: 'head',
        effectRefs: ['dracolich-set'],
      }),
      'dracolich-hauberk': createItem({
        id: 'dracolich-hauberk',
        name: 'Dracolich hauberk',
        category: 'armor',
        slot: 'body',
        effectRefs: ['dracolich-set'],
      }),
      'dracolich-chaps': createItem({
        id: 'dracolich-chaps',
        name: 'Dracolich chaps',
        category: 'armor',
        slot: 'legs',
        effectRefs: ['dracolich-set'],
      }),
      'dracolich-vambraces': createItem({
        id: 'dracolich-vambraces',
        name: 'Dracolich vambraces',
        category: 'armor',
        slot: 'hands',
        effectRefs: ['dracolich-set'],
      }),
      'dracolich-boots': createItem({
        id: 'dracolich-boots',
        name: 'Dracolich boots',
        category: 'armor',
        slot: 'feet',
        effectRefs: ['dracolich-set'],
      }),
      'elite-dracolich-helm': createItem({
        id: 'elite-dracolich-helm',
        name: 'Elite dracolich helm',
        category: 'armor',
        slot: 'head',
        effectRefs: ['elite-dracolich-set'],
      }),
      'elite-dracolich-hauberk': createItem({
        id: 'elite-dracolich-hauberk',
        name: 'Elite dracolich hauberk',
        category: 'armor',
        slot: 'body',
        effectRefs: ['elite-dracolich-set'],
      }),
      'elite-dracolich-chaps': createItem({
        id: 'elite-dracolich-chaps',
        name: 'Elite dracolich chaps',
        category: 'armor',
        slot: 'legs',
        effectRefs: ['elite-dracolich-set'],
      }),
      'elite-dracolich-vambraces': createItem({
        id: 'elite-dracolich-vambraces',
        name: 'Elite dracolich vambraces',
        category: 'armor',
        slot: 'hands',
        effectRefs: ['elite-dracolich-set'],
      }),
    },
    ammo: {},
    abilities: {
      'essence-of-finality': createAbility({
        id: 'essence-of-finality',
        name: 'Essence of Finality',
        style: 'constitution',
        subtype: 'special',
        cooldownTicks: 0,
        adrenalineCost: 0,
        adrenalineGain: 0,
        hitSchedule: [],
        baseDamage: { min: 0, max: 0 },
      }),
      'weapon-special-attack': createAbility({
        id: 'weapon-special-attack',
        name: 'Weapon Special Attack',
        style: 'constitution',
        subtype: 'special',
        cooldownTicks: 0,
        adrenalineGain: 0,
        hitSchedule: [],
        baseDamage: { min: 0, max: 0 },
      }),
      galeshot: createAbility({
        id: 'galeshot',
        name: 'Galeshot',
        cooldownTicks: 34,
        adrenalineGain: 9,
        isChanneled: false,
        channelDurationTicks: undefined,
        hitSchedule: [
          {
            id: 'galeshot-hit',
            tickOffset: 0,
            damage: { min: 100, max: 120 },
          },
        ],
        effectRefs: ['searing-winds'],
      }),
      'rapid-fire': createAbility(),
      'imbue-shadows': createAbility({
        id: 'imbue-shadows',
        name: 'Imbue: Shadows',
        subtype: 'enhanced',
        cooldownTicks: 100,
        adrenalineCost: 40,
        isChanneled: false,
        channelDurationTicks: undefined,
        hitSchedule: [],
        baseDamage: { min: 0, max: 0 },
      }),
      'shadow-tendrils': createAbility({
        id: 'shadow-tendrils',
        name: 'Shadow Tendrils',
        subtype: 'enhanced',
        cooldownTicks: 75,
        adrenalineCost: 0,
        isChanneled: false,
        channelDurationTicks: undefined,
        hitSchedule: [
          {
            id: 'shadow-tendrils-hit',
            tickOffset: 0,
            damage: { min: 200, max: 270 },
          },
        ],
        baseDamage: { min: 200, max: 270 },
        effectRefs: ['critical-strike-chance:+100%', 'shadow-tendrils'],
      }),
    },
    buffs: {
      'shadow-imbued': {
        id: 'shadow-imbued',
        name: 'Shadow Imbued',
        category: 'temporary',
        sourceType: 'ability',
        durationTicks: 50,
        effectRefs: ['ranged-hit-adrenaline:+5%'],
      },
      'vulnerability-bomb-area': {
        id: 'vulnerability-bomb-area',
        name: 'Area',
        category: 'temporary',
        sourceType: 'item',
        durationTicks: 3,
        effectRefs: [],
      },
      vulnerability: {
        id: 'vulnerability',
        name: 'Debuff',
        category: 'temporary',
        sourceType: 'item',
        durationTicks: 100,
        effectRefs: ['target-damage-taken:+10%'],
      },
      'split-soul': {
        id: 'split-soul',
        name: 'Split Soul',
        category: 'temporary',
        sourceType: 'ability',
        durationTicks: 25,
      },
    },
    perks: {},
    relics: {},
    eofSpecs: {
      'eldritch-crossbow-eof': {
        id: 'eldritch-crossbow-eof',
        name: 'Eldritch Crossbow (EOF)',
        weaponOrigin: 'eldritch-crossbow',
        adrenalineCost: 25,
        hitSchedule: [],
        baseDamage: { min: 0, max: 0 },
        effectRefs: ['eof-eldritch-crossbow-spec'],
      },
    },
  };

  return {
    playerStats: {
      rangedLevel: 99,
    },
    gearSetup: {
      equipment: {
        weapon: {
          instanceId: 'weapon-1',
          definitionId: 'bolg',
        },
      },
    },
    inventory: {
      items: [],
    },
    persistentBuffConfig: {},
    rotationPlan: {
      startingAdrenaline: 100,
      tickCount: 20,
      nonGcdActions: [],
      abilityActions: [
        {
          id: 'rapid-fire-1',
          tick: 0,
          lane: 'ability',
          actionType: 'ability-use',
          payload: {
            abilityId: 'rapid-fire',
          },
        },
      ],
    },
    gameData,
    modeFlags: {
      strictValidation: true,
    },
    ...overrides,
  };
}

describe('resolveDeterministicRangedTimeline', () => {
  it('applies regular dracolich Rapid Fire adrenaline gain per piece worn', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: { instanceId: 'weapon-1', definitionId: 'bolg' },
          head: { instanceId: 'head-1', definitionId: 'dracolich-coif' },
          body: { instanceId: 'body-1', definitionId: 'dracolich-hauberk' },
          legs: { instanceId: 'legs-1', definitionId: 'dracolich-chaps' },
        },
      },
    });

    const result = resolveDeterministicRangedTimeline(config);

    expect(result.adrenalineByTick[0]).toBeCloseTo(0.6);
    expect(result.adrenalineByTick[7]).toBeCloseTo(0.6);
    expect(result.buffTimeline[9]).toEqual([]);
    expect(result.buffTimeline[10]).toEqual(['dracolich-infusion']);
    expect(result.buffTimeline[14]).toEqual(['dracolich-infusion']);
    expect(result.buffTimeline[15]).toEqual([]);
  });

  it('extends regular dracolich infusion to 11 ticks with all 5 pieces worn', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: { instanceId: 'weapon-1', definitionId: 'bolg' },
          head: { instanceId: 'head-1', definitionId: 'dracolich-coif' },
          body: { instanceId: 'body-1', definitionId: 'dracolich-hauberk' },
          legs: { instanceId: 'legs-1', definitionId: 'dracolich-chaps' },
          hands: { instanceId: 'hands-1', definitionId: 'dracolich-vambraces' },
          feet: { instanceId: 'feet-1', definitionId: 'dracolich-boots' },
        },
      },
    });

    const result = resolveDeterministicRangedTimeline(config);

    expect(result.adrenalineByTick[0]).toBeCloseTo(1);
    expect(result.adrenalineByTick[7]).toBeCloseTo(1);
    expect(result.buffTimeline[9]).toEqual([]);
    expect(result.buffTimeline[10]).toEqual(['dracolich-infusion']);
    expect(result.buffTimeline[19]).toEqual(['dracolich-infusion']);
    expect(result.buffTimeline[20]).toEqual(undefined);
  });

  it('applies elite dracolich Rapid Fire gains and longer infusion windows', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: { instanceId: 'weapon-1', definitionId: 'bolg' },
          head: { instanceId: 'head-1', definitionId: 'elite-dracolich-helm' },
          body: { instanceId: 'body-1', definitionId: 'elite-dracolich-hauberk' },
          legs: { instanceId: 'legs-1', definitionId: 'elite-dracolich-chaps' },
          hands: { instanceId: 'hands-1', definitionId: 'elite-dracolich-vambraces' },
        },
      },
    });

    const result = resolveDeterministicRangedTimeline(config);

    expect(result.adrenalineByTick[0]).toBeCloseTo(2);
    expect(result.adrenalineByTick[7]).toBeCloseTo(2);
    expect(result.buffTimeline[9]).toEqual([]);
    expect(result.buffTimeline[10]).toEqual(['elite-dracolich-infusion']);
    expect(result.buffTimeline[17]).toEqual(['elite-dracolich-infusion']);
    expect(result.buffTimeline[18]).toEqual([]);
    expect(result.timelineGeneratedBuffSources).toEqual([
      {
        buffId: 'elite-dracolich-infusion',
        sourceType: 'item',
        sourceId: 'elite-dracolich-set',
      },
    ]);
  });

  it('does not generate infusion without a bow equipped', () => {
    const baseConfig = createConfig();
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: 'crossbow-like-weapon',
          },
          head: { instanceId: 'head-1', definitionId: 'dracolich-coif' },
          body: { instanceId: 'body-1', definitionId: 'dracolich-hauberk' },
          legs: { instanceId: 'legs-1', definitionId: 'dracolich-chaps' },
        },
      },
      gameData: {
        ...baseConfig.gameData,
        items: {
          ...baseConfig.gameData.items,
          'crossbow-like-weapon': createItem({
            id: 'crossbow-like-weapon',
            name: 'Crossbow-like weapon',
            requirements: {},
          }),
        },
      },
    });

    const result = resolveDeterministicRangedTimeline(config);

    expect(Object.values(result.buffTimeline).flat()).toEqual([]);
  });

  it("starts Death's Swiftness on the cast tick and keeps it active for 63 ticks", () => {
    const baseConfig = createConfig();
    const config = createConfig({
      gameData: {
        ...baseConfig.gameData,
        abilities: {
          ...baseConfig.gameData.abilities,
          'deaths-swiftness': createAbility({
            id: 'deaths-swiftness',
            name: "Death's Swiftness",
            subtype: 'ultimate',
            cooldownTicks: 100,
            adrenalineCost: 100,
          }),
        },
      },
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 80,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'deaths-swiftness-1',
            tick: 5,
            lane: 'ability',
            actionType: 'ability-use',
            payload: {
              abilityId: 'deaths-swiftness',
            },
          },
        ],
      },
    });

    const result = resolveDeterministicRangedTimeline(config);

    expect(result.buffTimeline[4]).toEqual([]);
    expect(result.buffTimeline[5]).toEqual(['deaths-swiftness-buff']);
    expect(result.buffTimeline[67]).toEqual(['deaths-swiftness-buff']);
    expect(result.buffTimeline[68]).toEqual([]);
    expect(result.timelineGeneratedBuffSources).toContainEqual({
      buffId: 'deaths-swiftness-buff',
      sourceType: 'ability',
      sourceId: 'deaths-swiftness',
    });
  });

  it('applies Searing Winds from Galeshot on the cast tick for 10 ticks', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 16,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'galeshot-1',
            tick: 2,
            lane: 'ability',
            actionType: 'ability-use',
            payload: {
              abilityId: 'galeshot',
            },
          },
        ],
      },
    });

    const result = resolveDeterministicRangedTimeline(config);

    expect(result.buffTimeline[1]).toEqual([]);
    expect(result.buffTimeline[2]).toEqual(['searing-winds']);
    expect(result.buffTimeline[11]).toEqual(['searing-winds']);
    expect(result.buffTimeline[12]).toEqual([]);
    expect(result.timelineGeneratedBuffSources).toContainEqual({
      buffId: 'searing-winds',
      sourceType: 'ability',
      sourceId: 'galeshot',
    });
  });

  it('extends Searing Winds by 8 ticks when Rapid Fire starts while it is active', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 24,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'galeshot-1',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: {
              abilityId: 'galeshot',
            },
          },
          {
            id: 'rapid-fire-1',
            tick: 9,
            lane: 'ability',
            actionType: 'ability-use',
            payload: {
              abilityId: 'rapid-fire',
            },
          },
        ],
      },
    });

    const result = resolveDeterministicRangedTimeline(config);

    expect(result.buffTimeline[0]).toContain('searing-winds');
    expect(result.buffTimeline[9]).toContain('searing-winds');
    expect(result.buffTimeline[18]).toContain('searing-winds');
    expect(result.buffTimeline[19]).toContain('searing-winds');
    expect(result.buffTimeline[20]).toEqual([]);
  });

  it('applies Balance by Force on the cast tick for 50 ticks', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 60,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'bolg-special-1',
            tick: 4,
            lane: 'ability',
            actionType: 'ability-use',
            payload: {
              abilityId: 'weapon-special-attack',
            },
          },
        ],
      },
    });

    const result = resolveDeterministicRangedTimeline(config);

    expect(result.buffTimeline[3]).toEqual([]);
    expect(result.buffTimeline[4]).toEqual(['balance-by-force-buff']);
    expect(result.buffTimeline[53]).toEqual(['balance-by-force-buff']);
    expect(result.buffTimeline[54]).toEqual([]);
    expect(result.timelineGeneratedBuffSources).toContainEqual({
      buffId: 'balance-by-force-buff',
      sourceType: 'ability',
      sourceId: 'balance-by-force',
    });
  });

  it('applies Shadow Imbued on the cast tick for 50 ticks', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 60,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'imbue-shadows-1',
            tick: 4,
            lane: 'ability',
            actionType: 'ability-use',
            payload: {
              abilityId: 'imbue-shadows',
            },
          },
        ],
      },
    });

    const result = resolveDeterministicRangedTimeline(config);

    expect(result.buffTimeline[3]).toEqual([]);
    expect(result.buffTimeline[4]).toEqual(['shadow-imbued']);
    expect(result.buffTimeline[53]).toEqual(['shadow-imbued']);
    expect(result.buffTimeline[54]).toEqual([]);
    expect(result.timelineGeneratedBuffSources).toContainEqual({
      buffId: 'shadow-imbued',
      sourceType: 'ability',
      sourceId: 'imbue-shadows',
    });
  });

  it('extends Shadow Imbued by 6 ticks when Shadow Tendrils is cast during the buff', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 64,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'imbue-shadows-1',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: {
              abilityId: 'imbue-shadows',
            },
          },
          {
            id: 'shadow-tendrils-1',
            tick: 20,
            lane: 'ability',
            actionType: 'ability-use',
            payload: {
              abilityId: 'shadow-tendrils',
            },
          },
        ],
      },
    });

    const result = resolveDeterministicRangedTimeline(config);

    expect(result.buffTimeline[49]).toEqual(['shadow-imbued']);
    expect(result.buffTimeline[50]).toEqual(['shadow-imbued']);
    expect(result.buffTimeline[55]).toEqual(['shadow-imbued']);
    expect(result.buffTimeline[56]).toEqual([]);
  });

  it('adds 5 adrenaline on each ranged hit while Shadow Imbued is active', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 12,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'imbue-shadows-1',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: {
              abilityId: 'imbue-shadows',
            },
          },
          {
            id: 'rapid-fire-1',
            tick: 3,
            lane: 'ability',
            actionType: 'ability-use',
            payload: {
              abilityId: 'rapid-fire',
            },
          },
        ],
      },
    });

    const result = resolveDeterministicRangedTimeline(config);

    expect(result.adrenalineByTick[4]).toBeCloseTo(5);
    expect(result.adrenalineByTick[11]).toBeCloseTo(10);
  });

  it('creates Vulnerability Bomb area and debuff as separate buff-lane states', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 110,
        nonGcdActions: [
          {
            id: 'vulnerability-bomb-1',
            tick: 0,
            lane: 'non-gcd',
            actionType: 'vulnerability-bomb',
            payload: {
              label: 'Vulnerability Bomb',
            },
          },
        ],
        abilityActions: [],
      },
    });

    const result = resolveDeterministicRangedTimeline(config);

    expect(result.buffTimeline[2]).toEqual([]);
    expect(result.buffTimeline[3]).toEqual(['vulnerability-bomb-area', 'vulnerability']);
    expect(result.buffTimeline[5]).toEqual(['vulnerability-bomb-area', 'vulnerability']);
    expect(result.buffTimeline[6]).toEqual(['vulnerability']);
    expect(result.buffTimeline[102]).toEqual(['vulnerability']);
    expect(result.buffTimeline[103]).toEqual([]);
    expect(result.timelineGeneratedBuffSources).toContainEqual({
      buffId: 'vulnerability-bomb-area',
      sourceType: 'item',
      sourceId: 'vulnerability',
    });
    expect(result.timelineGeneratedBuffSources).toContainEqual({
      buffId: 'vulnerability',
      sourceType: 'item',
      sourceId: 'vulnerability',
    });
  });

  it('creates Split Soul for 25 ticks and ends it early on a weapon swap', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: 'eldritch-crossbow',
          },
        },
      },
      inventory: {
        items: [
          {
            instanceId: 'weapon-2',
            definitionId: 'bolg',
          },
        ],
      },
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 40,
        nonGcdActions: [
          {
            id: 'weapon-swap',
            tick: 6,
            lane: 'non-gcd',
            actionType: 'gear-swap',
            payload: {
              instanceId: 'weapon-2',
              slot: 'weapon',
            },
          },
        ],
        abilityActions: [
          {
            id: 'split-soul-cast',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: {
              abilityId: 'weapon-special-attack',
            },
          },
        ],
      },
    });

    const result = resolveDeterministicRangedTimeline(config);

    expect(result.buffTimeline[0]).toContain('split-soul');
    expect(result.buffTimeline[6]).toContain('split-soul');
    expect(result.buffTimeline[7]).toEqual([]);
    expect(result.timelineGeneratedBuffSources).toContainEqual({
      buffId: 'split-soul',
      sourceType: 'ability',
      sourceId: 'split-soul',
    });
  });

  it('creates Split Soul on the buff lane for Eldritch crossbow stored in EOF', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          amulet: {
            instanceId: 'eof-1',
            definitionId: 'essence-of-finality',
            configValues: {
              'stored-special': 'eldritch-crossbow',
            },
          },
        },
      },
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 30,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'eof-ecb-cast',
            tick: 2,
            lane: 'ability',
            actionType: 'ability-use',
            payload: {
              abilityId: 'essence-of-finality',
            },
          },
        ],
      },
    });

    const result = resolveDeterministicRangedTimeline(config);

    expect(result.buffTimeline[1]).toEqual([]);
    expect(result.buffTimeline[2]).toContain('split-soul');
    expect(result.buffTimeline[26]).toContain('split-soul');
    expect(result.buffTimeline[27]).toEqual([]);
  });
});
