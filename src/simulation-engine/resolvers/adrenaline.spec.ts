import { describe, expect, it } from 'vitest';

import type { AbilityDefinition, ItemDefinition } from '../../game-data/types';
import type { LoadedGameDataSnapshot, SimulationConfig } from '../models';
import { HEIGHTENED_SENSES_MAX_ADRENALINE, MAX_ADRENALINE, resolveAdrenalineTimeline } from './adrenaline';

function createAbility(overrides: Partial<AbilityDefinition> = {}): AbilityDefinition {
  return {
    id: 'basic-shot',
    name: 'Basic Shot',
    style: 'ranged',
    subtype: 'basic',
    cooldownTicks: 3,
    adrenalineGain: 9,
    hitSchedule: [
      {
        id: 'basic-shot-hit',
        tickOffset: 0,
        damage: {
          min: 90,
          max: 110,
        },
      },
    ],
    baseDamage: {
      min: 90,
      max: 110,
    },
    ...overrides,
  };
}

function createConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  const gameData: LoadedGameDataSnapshot = {
    items: {
      bolg: {
        id: 'bolg',
        name: 'Bow of the Last Guardian',
        category: 'weapon',
        slot: 'weapon',
        combatStyleTags: ['ranged'],
        effectRefs: ['bolg-passive', 'weapon-special-access', 'weapon-special:balance-by-force'],
      } satisfies ItemDefinition,
      'deathspore-arrows': {
        id: 'deathspore-arrows',
        name: 'Deathspore arrows',
        category: 'ammo',
        slot: 'ammo',
        combatStyleTags: ['ranged'],
        effectRefs: ['deathspore-progress'],
      } satisfies ItemDefinition,
      'ring-of-vigour': {
        id: 'ring-of-vigour',
        name: 'Ring of vigour',
        category: 'jewellery',
        slot: 'ring',
        combatStyleTags: ['ranged'],
        offensiveStats: {
          rangedBonus: 16.8,
        },
        effectRefs: ['vigour-passive'],
      } satisfies ItemDefinition,
    },
    ammo: {},
    abilities: {
      'basic-shot': createAbility(),
      'enhanced-shot': createAbility({
        id: 'enhanced-shot',
        name: 'Enhanced Shot',
        subtype: 'enhanced',
        adrenalineGain: 0,
        adrenalineCost: 25,
      }),
      'huge-basic': createAbility({
        id: 'huge-basic',
        name: 'Huge Basic',
        adrenalineGain: 15,
      }),
      'weapon-special-attack': createAbility({
        id: 'weapon-special-attack',
        name: 'Weapon Special Attack',
        style: 'constitution',
        subtype: 'special',
        adrenalineGain: 0,
        cooldownTicks: 0,
        hitSchedule: [],
        baseDamage: { min: 0, max: 0 },
      }),
      'stack-builder': createAbility({
        id: 'stack-builder',
        name: 'Stack Builder',
        adrenalineGain: 0,
        hitSchedule: Array.from({ length: 12 }, (_, index) => ({
          id: `stack-${index + 1}`,
          tickOffset: index,
          damage: {
            min: 10,
            max: 10,
          },
        })),
        baseDamage: {
          min: 120,
          max: 120,
        },
      }),
      'imbue-shadows': createAbility({
        id: 'imbue-shadows',
        name: 'Imbue: Shadows',
        subtype: 'enhanced',
        cooldownTicks: 100,
        adrenalineGain: 0,
        adrenalineCost: 40,
        hitSchedule: [],
        baseDamage: { min: 0, max: 0 },
      }),
      deadshot: createAbility({
        id: 'deadshot',
        name: 'Deadshot',
        subtype: 'ultimate',
        cooldownTicks: 50,
        adrenalineGain: 0,
        adrenalineCost: 60,
        hitSchedule: [
          { id: 'deadshot-hit-1', tickOffset: 0, damage: { min: 105, max: 125 } },
          { id: 'deadshot-hit-2', tickOffset: 0, damage: { min: 105, max: 125 } },
          { id: 'deadshot-hit-3', tickOffset: 0, damage: { min: 105, max: 125 } },
          { id: 'deadshot-hit-4', tickOffset: 0, damage: { min: 105, max: 125 } },
        ],
        baseDamage: { min: 420, max: 500 },
      }),
      'corruption-shot': createAbility({
        id: 'corruption-shot',
        name: 'Corruption Shot',
        subtype: 'basic',
        cooldownTicks: 25,
        adrenalineGain: 8,
        hitSchedule: [
          { id: 'corruption-shot-hit-1', tickOffset: 0, damage: { min: 60, max: 80 } },
          { id: 'corruption-shot-hit-2', tickOffset: 2, damage: { min: 48, max: 64 } },
          { id: 'corruption-shot-hit-3', tickOffset: 4, damage: { min: 36, max: 48 } },
          { id: 'corruption-shot-hit-4', tickOffset: 6, damage: { min: 24, max: 32 } },
          { id: 'corruption-shot-hit-5', tickOffset: 8, damage: { min: 12, max: 16 } },
        ],
        baseDamage: { min: 180, max: 240 },
        effectRefs: ['damage-over-time', 'corruption-shot'],
      }),
    },
    buffs: {},
    perks: {},
    relics: {
      'fury-of-the-small': {
        id: 'fury-of-the-small',
        name: 'Fury of the Small',
        effectRefs: ['fury-of-the-small'],
      },
      'heightened-senses': {
        id: 'heightened-senses',
        name: 'Heightened Senses',
        effectRefs: ['heightened-senses'],
      },
      'conservation-of-energy': {
        id: 'conservation-of-energy',
        name: 'Conservation of Energy',
        effectRefs: ['conservation-of-energy'],
      },
    },
    eofSpecs: {},
  };

  return {
    playerStats: {
      rangedLevel: 99,
    },
    gearSetup: {
      equipment: {},
    },
    inventory: {
      items: [],
    },
    persistentBuffConfig: {},
    rotationPlan: {
      startingAdrenaline: 0,
      tickCount: 8,
      nonGcdActions: [],
      abilityActions: [],
    },
    gameData,
    modeFlags: {
      strictValidation: true,
    },
    ...overrides,
  };
}

describe('resolveAdrenalineTimeline', () => {
  it('supports starting adrenaline and applies gains/costs per tick', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 25,
        tickCount: 6,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'basic-1',
            tick: 1,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'basic-shot' },
          },
          {
            id: 'enhanced-1',
            tick: 4,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'enhanced-shot' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.startingAdrenaline).toBe(25);
    expect(result.adrenalineTimeline).toEqual([25, 34, 34, 34, 9, 9]);
    expect(result.tickStates[1]).toMatchObject({
      valueAtTickStart: 25,
      valueAtTickEnd: 34,
      actionsResolved: ['basic-1'],
    });
    expect(result.tickStates[4]).toMatchObject({
      valueAtTickStart: 34,
      valueAtTickEnd: 9,
      actionsResolved: ['enhanced-1'],
    });
    expect(result.validationIssues).toEqual([]);
  });

  it('prevents invalid ability use when adrenaline is insufficient', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 10,
        tickCount: 4,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'enhanced-too-early',
            tick: 1,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'enhanced-shot' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.adrenalineTimeline).toEqual([10, 10, 10, 10]);
    expect(result.validationIssues).toHaveLength(1);
    expect(result.validationIssues[0]).toMatchObject({
      code: 'ability.insufficient_adrenaline',
      tick: 1,
      relatedActionId: 'enhanced-too-early',
    });
  });

  it('clamps adrenaline at the 100 cap', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: 95,
        tickCount: 3,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'overflow-basic',
            tick: 1,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'huge-basic' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.adrenalineTimeline).toEqual([95, MAX_ADRENALINE, MAX_ADRENALINE]);
    expect(result.validationIssues).toEqual([]);
  });

  it('raises the adrenaline cap to 110 when Heightened Senses is active', () => {
    const config = createConfig({
      persistentBuffConfig: {
        relicIds: ['heightened-senses'],
      },
      rotationPlan: {
        startingAdrenaline: 109,
        tickCount: 3,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'basic-with-heightened-senses',
            tick: 1,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'basic-shot' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.startingAdrenaline).toBe(109);
    expect(result.adrenalineTimeline).toEqual([109, HEIGHTENED_SENSES_MAX_ADRENALINE, HEIGHTENED_SENSES_MAX_ADRENALINE]);
    expect(result.validationIssues).toEqual([]);
  });

  it('clamps invalid starting adrenaline into the allowed range', () => {
    const config = createConfig({
      rotationPlan: {
        startingAdrenaline: -15,
        tickCount: 2,
        nonGcdActions: [],
        abilityActions: [],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.startingAdrenaline).toBe(0);
    expect(result.adrenalineTimeline).toEqual([0, 0]);
    expect(result.validationIssues).toHaveLength(1);
    expect(result.validationIssues[0]).toMatchObject({
      code: 'adrenaline.starting_out_of_bounds',
      severity: 'warning',
    });
  });

  it('adds 1% adrenaline to basic abilities when Fury of the Small is active', () => {
    const config = createConfig({
      persistentBuffConfig: {
        relicIds: ['fury-of-the-small'],
      },
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 3,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'basic-with-fury',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'basic-shot' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.adrenalineTimeline).toEqual([10, 10, 10]);
    expect(result.validationIssues).toEqual([]);
  });

  it('does not add adrenaline to non-basic abilities from Fury of the Small', () => {
    const config = createConfig({
      persistentBuffConfig: {
        relicIds: ['fury-of-the-small'],
      },
      rotationPlan: {
        startingAdrenaline: 30,
        tickCount: 3,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'enhanced-with-fury',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'enhanced-shot' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.adrenalineTimeline).toEqual([5, 5, 5]);
    expect(result.validationIssues).toEqual([]);
  });

  it('refunds 10 adrenaline after ultimate abilities when Conservation of Energy is active', () => {
    const config = createConfig({
      persistentBuffConfig: {
        relicIds: ['conservation-of-energy'],
      },
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 3,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'deadshot-with-coe',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'deadshot' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.validationIssues).toEqual([]);
    expect(result.adrenalineTimeline).toEqual([50, 50, 50]);
  });

  it('reduces ultimate cost by 10 with Ring of vigour', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          ring: {
            instanceId: 'ring-1',
            definitionId: 'ring-of-vigour',
          },
        },
      },
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 3,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'deadshot-with-vigour',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'deadshot' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.validationIssues).toEqual([]);
    expect(result.adrenalineTimeline).toEqual([50, 50, 50]);
  });

  it('reduces special attack costs by 10% with Warped gem', () => {
    const config = createConfig({
      persistentBuffConfig: {
        buffIds: ['warped-gem'],
      },
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: 'bolg',
          },
        },
      },
      gameData: {
        ...createConfig().gameData,
        buffs: {
          'warped-gem': {
            id: 'warped-gem',
            name: 'Warped gem',
            category: 'miscellaneous',
            sourceType: 'player-config',
            effectRefs: ['vigour-passive'],
          },
        },
      },
      rotationPlan: {
        startingAdrenaline: 30,
        tickCount: 3,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'bolg-special-with-warped-gem',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'weapon-special-attack' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.validationIssues).toEqual([]);
    expect(result.adrenalineTimeline).toEqual([3, 3, 3]);
  });

  it('does not stack Ring of vigour with Warped gem', () => {
    const config = createConfig({
      persistentBuffConfig: {
        buffIds: ['warped-gem'],
      },
      gearSetup: {
        equipment: {
          ring: {
            instanceId: 'ring-1',
            definitionId: 'ring-of-vigour',
          },
        },
      },
      gameData: {
        ...createConfig().gameData,
        buffs: {
          'warped-gem': {
            id: 'warped-gem',
            name: 'Warped gem',
            category: 'miscellaneous',
            sourceType: 'player-config',
            effectRefs: ['vigour-passive'],
          },
        },
      },
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 3,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'deadshot-with-both',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'deadshot' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.validationIssues).toEqual([]);
    expect(result.adrenalineTimeline).toEqual([50, 50, 50]);
  });

  it('uses the equipped BoLG special adrenaline cost for Weapon Special Attack', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: 'bolg',
          },
        },
      },
      rotationPlan: {
        startingAdrenaline: 20,
        tickCount: 3,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'bolg-special',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'weapon-special-attack' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.adrenalineTimeline).toEqual([20, 20, 20]);
    expect(result.validationIssues[0]).toMatchObject({
      code: 'ability.insufficient_adrenaline',
      relatedActionId: 'bolg-special',
    });
  });

  it('makes the next adrenaline-costing ability free after a Deathspore proc', () => {
    const config = createConfig({
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: 'bolg',
          },
          ammo: {
            instanceId: 'ammo-1',
            definitionId: 'deathspore-arrows',
          },
        },
      },
      rotationPlan: {
        startingAdrenaline: 30,
        tickCount: 20,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'stack-builder',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'stack-builder' },
          },
          {
            id: 'bolg-special',
            tick: 12,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'weapon-special-attack' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.validationIssues).toEqual([]);
    expect(result.adrenalineTimeline[11]).toBe(30);
    expect(result.adrenalineTimeline[12]).toBe(30);
  });

  it('adds 5 adrenaline for each Deadshot hit while Shadow Imbued is active', () => {
    const config = createConfig({
      gameData: {
        ...createConfig().gameData,
        items: {
          ...createConfig().gameData.items,
          'igneous-kal-xil': {
            id: 'igneous-kal-xil',
            name: 'Igneous Kal-Xil',
            category: 'armor',
            slot: 'cape',
            combatStyleTags: ['ranged'],
            effectRefs: ['igneous-kal-xil-passive'],
          },
        },
        buffs: {
          'shadow-imbued': {
            id: 'shadow-imbued',
            name: 'Shadow Imbued',
            category: 'temporary',
            sourceType: 'ability',
            effectRefs: ['ranged-hit-adrenaline:+5%'],
          },
        },
      },
      gearSetup: {
        equipment: {
          cape: {
            instanceId: 'cape-1',
            definitionId: 'igneous-kal-xil',
          },
        },
      },
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 4,
        nonGcdActions: [],
        abilityActions: [
          {
            id: 'imbue-shadows-1',
            tick: 0,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'imbue-shadows' },
          },
          {
            id: 'deadshot-1',
            tick: 1,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'deadshot' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.validationIssues).toEqual([]);
    expect(result.adrenalineTimeline[0]).toBe(60);
    expect(result.adrenalineTimeline[1]).toBe(40);
    expect(result.adrenalineTimeline[2]).toBe(40);
    expect(result.adrenalineTimeline[3]).toBe(40);
  });

  it('counts Perfect Equilibrium as an extra Shadow Imbued adrenaline hit when it procs', () => {
    const config = createConfig({
      gameData: {
        ...createConfig().gameData,
        abilities: {
          ...createConfig().gameData.abilities,
          'rapid-fire': createAbility({
            id: 'rapid-fire',
            name: 'Rapid Fire',
            subtype: 'enhanced',
            cooldownTicks: 34,
            adrenalineGain: 0,
            adrenalineCost: 25,
            isChanneled: true,
            channelDurationTicks: 9,
            hitSchedule: Array.from({ length: 8 }, (_, index) => ({
              id: `rapid-fire-hit-${index + 1}`,
              tickOffset: index + 1,
              damage: { min: 75, max: 85 },
            })),
            baseDamage: { min: 600, max: 680 },
          }),
        },
        buffs: {
          'shadow-imbued': {
            id: 'shadow-imbued',
            name: 'Shadow Imbued',
            category: 'temporary',
            sourceType: 'ability',
            effectRefs: ['ranged-hit-adrenaline:+5%'],
          },
        },
      },
      gearSetup: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: 'bolg',
          },
        },
      },
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
            payload: { abilityId: 'imbue-shadows' },
          },
          {
            id: 'rapid-fire-1',
            tick: 3,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'rapid-fire' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.validationIssues).toEqual([]);
    expect(result.adrenalineTimeline[0]).toBe(60);
    expect(result.adrenalineTimeline[1]).toBe(60);
    expect(result.adrenalineTimeline[2]).toBe(60);
    expect(result.adrenalineTimeline[3]).toBe(35);
    expect(result.adrenalineTimeline[4]).toBe(40);
    expect(result.adrenalineTimeline[5]).toBe(45);
    expect(result.adrenalineTimeline[6]).toBe(50);
    expect(result.adrenalineTimeline[7]).toBe(55);
    expect(result.adrenalineTimeline[8]).toBe(60);
    expect(result.adrenalineTimeline[9]).toBe(65);
    expect(result.adrenalineTimeline[10]).toBe(70);
    expect(result.adrenalineTimeline[11]).toBe(80);
  });

  it('does not grant Shadow Imbued hit adrenaline from Corruption Shot ticks', () => {
    const config = createConfig({
      gameData: {
        ...createConfig().gameData,
        buffs: {
          'shadow-imbued': {
            id: 'shadow-imbued',
            name: 'Shadow Imbued',
            category: 'temporary',
            sourceType: 'ability',
            effectRefs: ['ranged-hit-adrenaline:+5%'],
          },
        },
      },
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
            payload: { abilityId: 'imbue-shadows' },
          },
          {
            id: 'corruption-shot-1',
            tick: 1,
            lane: 'ability',
            actionType: 'ability-use',
            payload: { abilityId: 'corruption-shot' },
          },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.validationIssues).toEqual([]);
    expect(result.adrenalineTimeline[0]).toBe(60);
    expect(result.adrenalineTimeline[1]).toBe(68);
    expect(result.adrenalineTimeline[2]).toBe(68);
    expect(result.adrenalineTimeline[10]).toBe(68);
  });

  it('uses cumulative chance for Impatient and carries overflow forward', () => {
    const base = createConfig();
    const config = createConfig({
      gameData: {
        ...base.gameData,
        perks: {
          impatient: {
            id: 'impatient',
            name: 'Impatient',
            effectRefs: ['impatient'],
          },
        },
      },
      gearSetup: {
        equipment: {
          body: {
            instanceId: 'body-1',
            definitionId: 'ring-of-vigour',
            configuredPerks: [{ socketIndex: 0, perkId: 'impatient', rank: 3 }],
          },
        },
      },
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 6,
        nonGcdActions: [],
        abilityActions: [
          { id: 'basic-1', tick: 0, lane: 'ability', actionType: 'ability-use', payload: { abilityId: 'basic-shot' } },
          { id: 'basic-2', tick: 1, lane: 'ability', actionType: 'ability-use', payload: { abilityId: 'basic-shot' } },
          { id: 'basic-3', tick: 2, lane: 'ability', actionType: 'ability-use', payload: { abilityId: 'basic-shot' } },
          { id: 'basic-4', tick: 3, lane: 'ability', actionType: 'ability-use', payload: { abilityId: 'basic-shot' } },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.validationIssues).toEqual([]);
    expect(result.adrenalineTimeline[0]).toBe(9);
    expect(result.adrenalineTimeline[1]).toBe(18);
    expect(result.adrenalineTimeline[2]).toBe(27);
    expect(result.adrenalineTimeline[3]).toBe(39);
  });

  it('adds percentage adrenaline gain from Invigorating to all basic abilities', () => {
    const base = createConfig();
    const config = createConfig({
      gameData: {
        ...base.gameData,
        perks: {
          invigorating: {
            id: 'invigorating',
            name: 'Invigorating',
            effectRefs: ['invigorating'],
          },
        },
      },
      gearSetup: {
        equipment: {
          body: {
            instanceId: 'body-1',
            definitionId: 'ring-of-vigour',
            configuredPerks: [{ socketIndex: 0, perkId: 'invigorating', rank: 4 }],
          },
        },
      },
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 3,
        nonGcdActions: [],
        abilityActions: [
          { id: 'basic-1', tick: 0, lane: 'ability', actionType: 'ability-use', payload: { abilityId: 'basic-shot' } },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.validationIssues).toEqual([]);
    expect(result.adrenalineTimeline[0]).toBe(10.8);
  });

  it('applies Invigorating after Fury of the Small on basic abilities', () => {
    const base = createConfig();
    const config = createConfig({
      persistentBuffConfig: {
        relicIds: ['fury-of-the-small'],
      },
      gameData: {
        ...base.gameData,
        perks: {
          invigorating: {
            id: 'invigorating',
            name: 'Invigorating',
            effectRefs: ['invigorating'],
          },
        },
      },
      gearSetup: {
        equipment: {
          body: {
            instanceId: 'body-1',
            definitionId: 'ring-of-vigour',
            configuredPerks: [{ socketIndex: 0, perkId: 'invigorating', rank: 4 }],
          },
        },
      },
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 3,
        nonGcdActions: [],
        abilityActions: [
          { id: 'basic-1', tick: 0, lane: 'ability', actionType: 'ability-use', payload: { abilityId: 'basic-shot' } },
        ],
      },
    });

    const result = resolveAdrenalineTimeline(config);

    expect(result.validationIssues).toEqual([]);
    expect(result.adrenalineTimeline[0]).toBe(12);
  });
});
