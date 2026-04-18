import { describe, expect, it } from 'vitest';

import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition, BuffDefinition, ItemDefinition, RelicDefinition, SpellDefinition } from '../../../game-data/types';
import type { GearBuilderState } from '../../core/gear/gear-state';
import type { RotationPlan, SimulationResult } from '../../../simulation-engine/models';
import { inspectRotationPlannerTick } from './rotation-planner-inspection';

const PIERCING_SHOT: AbilityDefinition = {
  id: 'piercing-shot',
  name: 'Piercing Shot',
  style: 'ranged',
  subtype: 'basic',
  cooldownTicks: 5,
  adrenalineGain: 9,
  hitSchedule: [
    {
      id: 'piercing-shot-hit-1',
      tickOffset: 0,
      damage: {
        min: 45,
        max: 55,
      },
    },
    {
      id: 'piercing-shot-hit-2',
      tickOffset: 1,
      damage: {
        min: 45,
        max: 55,
      },
    },
  ],
  baseDamage: {
    min: 90,
    max: 110,
  },
};

const GALESHOT: AbilityDefinition = {
  id: 'galeshot',
  name: 'Galeshot',
  style: 'ranged',
  subtype: 'basic',
  cooldownTicks: 10,
  adrenalineGain: 9,
  hitSchedule: [
    {
      id: 'galeshot-hit-1',
      tickOffset: 0,
      damage: {
        min: 45,
        max: 55,
      },
    },
  ],
  baseDamage: {
    min: 90,
    max: 110,
  },
};

const BOLG: ItemDefinition = {
  id: 'bow-of-the-last-guardian',
  name: 'Bow of the Last Guardian',
  category: 'weapon',
  slot: 'weapon',
  combatStyleTags: ['ranged'],
};

const DEATHSPORE_ARROWS: ItemDefinition = {
  id: 'deathspore-arrows',
  name: 'Deathspore arrows',
  category: 'ammo',
  slot: 'ammo',
  combatStyleTags: ['ranged'],
  effectRefs: ['deathspore-progress'],
};

const BAKRIMINEL_BOLTS: ItemDefinition = {
  id: 'bakriminel-bolts',
  name: 'Bakriminel bolts',
  category: 'ammo',
  slot: 'ammo',
  combatStyleTags: ['ranged'],
};

const WEN_ARROWS: ItemDefinition = {
  id: 'wen-arrows',
  name: 'Wen arrows',
  category: 'ammo',
  slot: 'ammo',
  combatStyleTags: ['ranged'],
};

const SEREN_GODBOW: ItemDefinition = {
  id: 'seren-godbow',
  name: 'Seren godbow',
  category: 'weapon',
  slot: 'weapon',
  combatStyleTags: ['ranged'],
};

const ELDRITCH_CROSSBOW: ItemDefinition = {
  id: 'eldritch-crossbow',
  name: 'Eldritch crossbow',
  category: 'weapon',
  slot: 'weapon',
  combatStyleTags: ['ranged'],
  effectRefs: ['weapon-class:crossbow'],
};

const ESSENCE_OF_FINALITY: ItemDefinition = {
  id: 'essence-of-finality',
  name: 'Essence of Finality amulet',
  category: 'jewellery',
  slot: 'amulet',
  combatStyleTags: ['ranged'],
  configOptions: [
    {
      id: 'stored-special',
      label: 'Stored special',
      type: 'select',
      defaultValue: 'dark-bow',
      options: ['dark-bow', 'seren-godbow', 'none'],
    },
  ],
};

const PERNIXS_QUIVER: ItemDefinition = {
  id: 'pernixs-quiver',
  name: "Pernix's quiver",
  category: 'armor',
  slot: 'ammo',
  combatStyleTags: ['ranged'],
  effectRefs: ['quiver-passive'],
  configOptions: [
    {
      id: 'loaded-ammo',
      label: 'Loaded ammo',
      type: 'select',
      defaultValue: 'deathspore-arrows',
      options: ['deathspore-arrows'],
    },
  ],
};

const RIGOUR: BuffDefinition = {
  id: 'rigour',
  name: 'Rigour',
  category: 'prayer',
  sourceType: 'player-config',
};

const FURY_OF_THE_SMALL: RelicDefinition = {
  id: 'fury-of-the-small',
  name: 'Fury of the Small',
};

const FIRE_SURGE: SpellDefinition = {
  id: 'fire-surge',
  name: 'Fire Surge',
  spellbookId: 'standard',
  role: 'combat',
  levelRequirement: 95,
  tier: 95,
};

const WATER_SURGE: SpellDefinition = {
  id: 'water-surge',
  name: 'Water Surge',
  spellbookId: 'standard',
  role: 'combat',
  levelRequirement: 85,
  tier: 85,
};

const INCITE_FEAR: SpellDefinition = {
  id: 'incite-fear',
  name: 'Incite Fear',
  spellbookId: 'ancient',
  role: 'combat',
  levelRequirement: 98,
  tier: 98,
};

const PRECISE_PERK = {
  id: 'precise',
  name: 'Precise',
  effectRefs: ['precise'],
};

const CATALOG: GameDataCatalog = {
  items: {
    [BOLG.id]: BOLG,
    [BAKRIMINEL_BOLTS.id]: BAKRIMINEL_BOLTS,
    [DEATHSPORE_ARROWS.id]: DEATHSPORE_ARROWS,
    [ELDRITCH_CROSSBOW.id]: ELDRITCH_CROSSBOW,
    [WEN_ARROWS.id]: WEN_ARROWS,
    [SEREN_GODBOW.id]: SEREN_GODBOW,
    [PERNIXS_QUIVER.id]: PERNIXS_QUIVER,
    [ESSENCE_OF_FINALITY.id]: ESSENCE_OF_FINALITY,
  },
  ammo: {},
  spells: {
    [FIRE_SURGE.id]: FIRE_SURGE,
    [WATER_SURGE.id]: WATER_SURGE,
    [INCITE_FEAR.id]: INCITE_FEAR,
  },
  abilities: {
    [PIERCING_SHOT.id]: PIERCING_SHOT,
    [GALESHOT.id]: GALESHOT,
  },
  buffs: {
    [RIGOUR.id]: RIGOUR,
  },
  perks: {
    [PRECISE_PERK.id]: PRECISE_PERK,
  },
  relics: {
    [FURY_OF_THE_SMALL.id]: FURY_OF_THE_SMALL,
  },
  eofSpecs: {},
};

const GEAR_STATE: GearBuilderState = {
  equipment: {
    weapon: {
      instanceId: 'weapon-1',
      definitionId: BOLG.id,
    },
    ammo: {
      instanceId: 'ammo-1',
      definitionId: DEATHSPORE_ARROWS.id,
    },
  },
  inventory: [],
};

const ROTATION_PLAN: RotationPlan = {
  startingAdrenaline: 12,
  tickCount: 12,
  nonGcdActions: [
    {
      id: 'vuln-0',
      tick: 0,
      lane: 'non-gcd',
      actionType: 'vulnerability-bomb',
      payload: {
        label: 'Vulnerability Bomb',
      },
    },
  ],
  abilityActions: [
    {
      id: 'piercing-0',
      tick: 0,
      lane: 'ability',
      actionType: 'ability-use',
      payload: {
        abilityId: PIERCING_SHOT.id,
      },
    },
  ],
};

describe('rotation planner inspection', () => {
  it('returns adrenaline, gear, buffs, actions, and resolving hits for the selected tick', () => {
    const inspection = inspectRotationPlannerTick({
      tick: 1,
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
        prayerLevel: 99,
      },
      gearState: GEAR_STATE,
      buffState: {
        activeBuffIds: [RIGOUR.id],
        activeRelicIds: [FURY_OF_THE_SMALL.id],
        activePocketItemIds: [],
      },
      rotationPlan: ROTATION_PLAN,
    });

    expect(inspection.tick).toBe(1);
    expect(inspection.adrenaline.start).toBe(21);
    expect(inspection.adrenaline.end).toBe(21);
    expect(inspection.deathsporeStacks).toBe(2);
    expect(inspection.perfectEquilibriumStacks).toBeNull();
    expect(inspection.bloodlustStacks).toBeNull();
    expect(inspection.bloodlustMaxStacks).toBeNull();
    expect(inspection.activePersistentBuffs).toEqual(['Rigour', 'Fury of the Small']);
    expect(inspection.activeTemporaryBuffs).toEqual([]);
    expect(inspection.equipmentState).toEqual([
      {
        slot: 'Weapon',
        itemName: 'Bow of the Last Guardian',
        details: [],
      },
      {
        slot: 'Ammo',
        itemName: 'Deathspore arrows',
        details: [],
      },
    ]);
    expect(inspection.ammoState).toBe('Deathspore arrows');
    expect(inspection.actionsStarting).toEqual([]);
    expect(inspection.hitsResolving).toEqual([]);
    expect(inspection.damageCalculations).toEqual([]);
  });

  it('includes actions that start on the inspected tick and clamps out-of-range input', () => {
    const inspection = inspectRotationPlannerTick({
      tick: 99,
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
      },
      gearState: GEAR_STATE,
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: ROTATION_PLAN,
    });

    expect(inspection.tick).toBe(11);
    expect(inspection.actionsStarting).toEqual([]);
    expect(inspection.hitsResolving).toEqual([]);
    expect(inspection.damageCalculations).toEqual([]);
  });

  it('shows action labels when the inspected tick contains non-gcd and ability starts', () => {
    const inspection = inspectRotationPlannerTick({
      tick: 0,
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
      },
      gearState: GEAR_STATE,
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: ROTATION_PLAN,
    });

    expect(inspection.actionsStarting).toEqual(['Vulnerability Bomb', 'Piercing Shot']);
    expect(inspection.hitsResolving).toEqual([
      'Piercing Shot: Piercing Shot Hit 1 (178-325.5)',
      'Piercing Shot: Piercing Shot Hit 2 (178-325.5)',
    ]);
    expect(inspection.damageCalculations).toEqual([
      {
        abilityName: 'Piercing Shot',
        hitName: 'Piercing Shot Hit 1',
        baseRange: '178 / 197.5 / 217',
        additiveStep: 'No flat added damage',
        multiplicativeStep: 'No damage multipliers',
        expectedValueStep: 'Min x1, Avg x1.05, Max x1.5 (crit)',
        finalRange: '178 / 207.38 / 325.5',
        minFormula: 'Min: ((178 × 1) + 0) × 1 = 178',
        avgFormula: 'Avg: ((197.5 × 1) + 0) × 1.05 (crit) = 207.38',
        maxFormula: 'Max: ((217 × 1) + 0) × 1.5 (crit) = 325.5',
      },
      {
        abilityName: 'Piercing Shot',
        hitName: 'Piercing Shot Hit 2',
        baseRange: '178 / 197.5 / 217',
        additiveStep: 'No flat added damage',
        multiplicativeStep: 'No damage multipliers',
        expectedValueStep: 'Min x1, Avg x1.05, Max x1.5 (crit)',
        finalRange: '178 / 207.38 / 325.5',
        minFormula: 'Min: ((178 × 1) + 0) × 1 = 178',
        avgFormula: 'Avg: ((197.5 × 1) + 0) × 1.05 (crit) = 207.38',
        maxFormula: 'Max: ((217 × 1) + 0) × 1.5 (crit) = 325.5',
      },
    ]);
  });

  it('inspects visible prebuild and ability stall ticks', () => {
    const rotationPlan: RotationPlan = {
      ...ROTATION_PLAN,
      preFight: {
        gapTicks: 5,
        prebuildActions: [
          {
            id: 'prebuild-piercing',
            abilityId: PIERCING_SHOT.id,
          },
        ],
        prebuildNonGcdActions: [
          {
            id: 'prefight-vuln',
            tick: -2,
            lane: 'non-gcd',
            actionType: 'vulnerability-bomb',
            payload: {
              label: 'Vulnerability Bomb',
            },
          },
        ],
        stalledAbility: {
          id: 'stalled-galeshot',
          abilityId: GALESHOT.id,
        },
      },
    };
    const baseInput = {
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
      },
      gearState: GEAR_STATE,
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan,
    };

    const prebuildInspection = inspectRotationPlannerTick({
      ...baseInput,
      tick: -6,
    });
    const stallInspection = inspectRotationPlannerTick({
      ...baseInput,
      tick: -3,
    });
    const stallNonGcdInspection = inspectRotationPlannerTick({
      ...baseInput,
      tick: -2,
    });

    expect(prebuildInspection.tick).toBe(-6);
    expect(prebuildInspection.actionsStarting).toEqual(['Piercing Shot (prebuild)']);
    expect(prebuildInspection.damageCalculations).toEqual([]);
    expect(stallInspection.tick).toBe(-3);
    expect(stallInspection.actionsStarting).toEqual(['Galeshot (stalled)']);
    expect(stallNonGcdInspection.tick).toBe(-2);
    expect(stallNonGcdInspection.actionsStarting).toEqual(['Vulnerability Bomb']);
  });

  it('keeps empty pre-fight ticks inspectable before actions are configured', () => {
    const inspection = inspectRotationPlannerTick({
      tick: -3,
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
      },
      gearState: GEAR_STATE,
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: ROTATION_PLAN,
    });

    expect(inspection.tick).toBe(-3);
    expect(inspection.actionsStarting).toEqual([]);
    expect(inspection.hitsResolving).toEqual([]);
  });

  it('shows Instability Lightning Surge proc efficacy in tick inspection', () => {
    const simulationResult: SimulationResult = {
      isValid: true,
      validationIssues: [],
      totalDamage: { min: 70, avg: 80, max: 90 },
      damageByAbility: [],
      damageByTick: {
        4: { min: 70, avg: 80, max: 90 },
      },
      adrenalineTimeline: [],
      buffTimeline: {},
      timelineGeneratedBuffSources: [],
      cooldownTimeline: {},
      explainability: {
        damageBreakdowns: [
          {
            abilityId: 'lightning-surge',
            hitId: 'magic-action:lightning-surge:magic-hit',
            tick: 4,
            baseDamage: { min: 70, avg: 80, max: 90 },
            additiveModifiers: [],
            multiplicativeModifiers: [],
            expectedValueModifiers: [],
            finalDamage: { min: 70, avg: 80, max: 90 },
            derivedParts: {
              procEfficacy: 0.3,
            },
          },
        ],
      },
      tickStates: Array.from({ length: 8 }, (_, index) => ({
        tickIndex: index,
        activeEquipmentState: {},
        adrenaline: 0,
        activePersistentBuffIds: [],
        activeTimelineBuffIds: [],
        activeBuffIds: [],
        cooldowns: {},
        actionsStartingThisTick: [],
        hitsResolvingThisTick: [],
        validationIssues: [],
      })),
    };

    const inspection = inspectRotationPlannerTick({
      tick: 4,
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
      },
      gearState: GEAR_STATE,
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: {
        ...ROTATION_PLAN,
        tickCount: 8,
        abilityActions: [
          {
            id: 'magic-action',
            tick: 3,
            lane: 'ability',
            actionType: 'ability-use',
            payload: {
              abilityId: 'magic',
            },
          },
        ],
      },
      simulationResult,
    });

    expect(inspection.damageCalculations[0]?.abilityName).toBe('Lightning Surge');
    expect(inspection.damageCalculations[0]?.expectedValueStep).toBe('Proc efficacy: 30%');
  });

  it('projects configured gear swaps from the next tick onward', () => {
    const inspection = inspectRotationPlannerTick({
      tick: 2,
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
      },
      gearState: {
        equipment: GEAR_STATE.equipment,
        inventory: [
          {
            instanceId: 'weapon-2',
            definitionId: SEREN_GODBOW.id,
          },
        ],
      },
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: {
        ...ROTATION_PLAN,
        nonGcdActions: [
          {
            id: 'gear-swap-1',
            tick: 1,
            lane: 'non-gcd',
            actionType: 'gear-swap',
            payload: {
              instanceId: 'weapon-2',
              definitionId: SEREN_GODBOW.id,
              slot: 'weapon',
              label: 'Swap: Seren godbow',
            },
          },
        ],
      },
    });

    expect(inspection.equipmentState[0]).toEqual({
      slot: 'Weapon',
      itemName: 'Seren godbow',
      details: [],
    });
  });

  it('shows active temporary buffs from simulated tick state', () => {
    const simulationResult: SimulationResult = {
      isValid: true,
      validationIssues: [],
      totalDamage: { min: 0, avg: 0, max: 0 },
      damageByAbility: [],
      damageByTick: {},
      adrenalineTimeline: [],
      buffTimeline: {},
      timelineGeneratedBuffSources: [],
      cooldownTimeline: {},
      explainability: {
        damageBreakdowns: [],
      },
      tickStates: Array.from({ length: ROTATION_PLAN.tickCount }, (_, index) => ({
        tickIndex: index,
        activeEquipmentState: {},
        adrenaline: 0,
        deathsporeStacks: index === 4 ? 7 : 0,
        activePersistentBuffIds: [],
        activeTimelineBuffIds: index === 4 ? ['deaths-swiftness-buff'] : [],
        activeBuffIds: index === 4 ? ['deaths-swiftness-buff'] : [],
        cooldowns: {},
        actionsStartingThisTick: [],
        hitsResolvingThisTick: [],
        validationIssues: [],
      })),
    };

    const inspection = inspectRotationPlannerTick({
      tick: 4,
      catalog: {
        ...CATALOG,
        buffs: {
          ...CATALOG.buffs,
          'deaths-swiftness-buff': {
            id: 'deaths-swiftness-buff',
            name: "Death's Swiftness",
            category: 'temporary',
            sourceType: 'ability',
          },
        },
      },
      playerStats: {
        rangedLevel: 99,
      },
      gearState: GEAR_STATE,
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: ROTATION_PLAN,
      simulationResult,
    });

    expect(inspection.activeTemporaryBuffs).toEqual(["Death's Swiftness"]);
    expect(inspection.deathsporeStacks).toBe(7);
    expect(inspection.perfectEquilibriumStacks).toBeNull();
    expect(inspection.bloodlustStacks).toBeNull();
  });

  it('filters cooldown-style generated buffs out of temporary inspector buffs', () => {
    const simulationResult: SimulationResult = {
      isValid: true,
      validationIssues: [],
      totalDamage: { min: 0, avg: 0, max: 0 },
      damageByAbility: [],
      damageByTick: {},
      adrenalineTimeline: [],
      buffTimeline: {},
      timelineGeneratedBuffSources: [],
      cooldownTimeline: {},
      explainability: {
        damageBreakdowns: [],
      },
      tickStates: Array.from({ length: ROTATION_PLAN.tickCount }, (_, index) => ({
        tickIndex: index,
        activeEquipmentState: {},
        adrenaline: 0,
        deathsporeStacks: 0,
        activePersistentBuffIds: [],
        activeTimelineBuffIds:
          index === 4 ? ['feasting-spores-ready', 'feasting-spores-cooldown'] : [],
        activeBuffIds: index === 4 ? ['feasting-spores-ready', 'feasting-spores-cooldown'] : [],
        cooldowns: {},
        actionsStartingThisTick: [],
        hitsResolvingThisTick: [],
        validationIssues: [],
      })),
    };

    const inspection = inspectRotationPlannerTick({
      tick: 4,
      catalog: {
        ...CATALOG,
        buffs: {
          ...CATALOG.buffs,
          'feasting-spores-ready': {
            id: 'feasting-spores-ready',
            name: 'Feasting Spores',
            category: 'temporary',
            sourceType: 'item',
          },
          'feasting-spores-cooldown': {
            id: 'feasting-spores-cooldown',
            name: 'Feasting Spores cooldown',
            category: 'temporary',
            sourceType: 'item',
            effectRefs: ['deathspore-cooldown'],
          },
        },
      },
      playerStats: {
        rangedLevel: 99,
      },
      gearState: GEAR_STATE,
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: ROTATION_PLAN,
      simulationResult,
    });

    expect(inspection.activeTemporaryBuffs).toEqual(['Feasting Spores']);
  });

  it('shows the loaded quiver ammo as the effective ammo state', () => {
    const inspection = inspectRotationPlannerTick({
      tick: 1,
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
      },
      gearState: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: BOLG.id,
          },
          ammo: {
            instanceId: 'quiver-1',
            definitionId: PERNIXS_QUIVER.id,
            configValues: {
              'loaded-ammo': DEATHSPORE_ARROWS.id,
            },
          },
        },
        inventory: [],
      },
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: ROTATION_PLAN,
    });

    expect(inspection.ammoState).toBe('Deathspore arrows');
  });

  it('shows bakriminel bolts as the effective ammo state for crossbows with pernix quiver', () => {
    const inspection = inspectRotationPlannerTick({
      tick: 1,
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
      },
      gearState: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: ELDRITCH_CROSSBOW.id,
          },
          ammo: {
            instanceId: 'quiver-1',
            definitionId: PERNIXS_QUIVER.id,
            configValues: {
              'loaded-ammo': DEATHSPORE_ARROWS.id,
            },
          },
        },
        inventory: [],
      },
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: ROTATION_PLAN,
    });

    expect(inspection.ammoState).toBe('Bakriminel bolts');
    expect(inspection.equipmentState).toContainEqual({
      slot: 'Ammo',
      itemName: "Pernix's quiver",
      details: ['Loaded arrows: Deathspore arrows', 'Loaded bolts: Bakriminel bolts'],
    });
  });

  it('hides deathspore stacks when deathspore arrows are not effectively equipped', () => {
    const simulationResult: SimulationResult = {
      isValid: true,
      validationIssues: [],
      totalDamage: { min: 0, avg: 0, max: 0 },
      damageByAbility: [],
      damageByTick: {},
      adrenalineTimeline: [],
      buffTimeline: {},
      timelineGeneratedBuffSources: [],
      cooldownTimeline: {},
      explainability: {
        damageBreakdowns: [],
      },
      tickStates: Array.from({ length: ROTATION_PLAN.tickCount }, (_, index) => ({
        tickIndex: index,
        activeEquipmentState: {},
        adrenaline: 0,
        deathsporeStacks: 9,
        activePersistentBuffIds: [],
        activeTimelineBuffIds: [],
        activeBuffIds: [],
        cooldowns: {},
        actionsStartingThisTick: [],
        hitsResolvingThisTick: [],
        validationIssues: [],
      })),
    };

    const inspection = inspectRotationPlannerTick({
      tick: 4,
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
      },
      gearState: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: BOLG.id,
          },
          ammo: {
            instanceId: 'quiver-1',
            definitionId: PERNIXS_QUIVER.id,
            configValues: {
              'loaded-ammo': 'wen-arrows',
            },
          },
        },
        inventory: [],
      },
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: ROTATION_PLAN,
      simulationResult,
    });

    expect(inspection.ammoState).toBe('Wen arrows');
    expect(inspection.deathsporeStacks).toBeNull();
  });

  it('shows BoLG stacks after swapping into Bow of the Last Guardian', () => {
    const meleeWeapon: ItemDefinition = {
      id: 'dark-shard-of-leng',
      name: 'Dark Shard of Leng',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['melee'],
    };
    const simulationResult: SimulationResult = {
      isValid: true,
      validationIssues: [],
      totalDamage: { min: 0, avg: 0, max: 0 },
      damageByAbility: [],
      damageByTick: {},
      adrenalineTimeline: [],
      buffTimeline: {},
      timelineGeneratedBuffSources: [],
      cooldownTimeline: {},
      explainability: {
        damageBreakdowns: [],
      },
      tickStates: Array.from({ length: 6 }, (_, index) => ({
        tickIndex: index,
        activeEquipmentState: {},
        adrenaline: 0,
        deathsporeStacks: 0,
        perfectEquilibriumStacks: index >= 2 ? 3 : 0,
        activePersistentBuffIds: [],
        activeTimelineBuffIds: [],
        activeBuffIds: [],
        cooldowns: {},
        actionsStartingThisTick: [],
        hitsResolvingThisTick: [],
        validationIssues: [],
      })),
    };

    const inspection = inspectRotationPlannerTick({
      tick: 2,
      catalog: {
        ...CATALOG,
        items: {
          ...CATALOG.items,
          [BOLG.id]: {
            ...BOLG,
            effectRefs: ['bolg-passive'],
          },
          [meleeWeapon.id]: meleeWeapon,
        },
      },
      playerStats: {
        attackLevel: 99,
        strengthLevel: 99,
        rangedLevel: 99,
      },
      gearState: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: meleeWeapon.id,
          },
        },
        inventory: [
          {
            instanceId: 'weapon-2',
            definitionId: BOLG.id,
          },
        ],
      },
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 6,
        nonGcdActions: [
          {
            id: 'swap-bolg',
            tick: 1,
            lane: 'non-gcd',
            actionType: 'gear-swap',
            payload: {
              instanceId: 'weapon-2',
              definitionId: BOLG.id,
              slot: 'weapon',
              label: 'Swap: Bow of the Last Guardian',
            },
          },
        ],
        abilityActions: [],
      },
      simulationResult,
    });

    expect(inspection.equipmentState[0]?.itemName).toBe('Bow of the Last Guardian');
    expect(inspection.perfectEquilibriumStacks).toBe(3);
    expect(inspection.perfectEquilibriumThreshold).toBe(8);
  });

  it('shows the reduced BoLG stack threshold while Balance by Force is active', () => {
    const balanceByForceBuff: BuffDefinition = {
      id: 'balance-by-force-buff',
      name: 'Balance by Force',
      category: 'temporary',
      sourceType: 'ability',
      effectRefs: ['perfect-equilibrium-threshold:4'],
    };
    const simulationResult: SimulationResult = {
      isValid: true,
      validationIssues: [],
      totalDamage: { min: 0, avg: 0, max: 0 },
      damageByAbility: [],
      damageByTick: {},
      adrenalineTimeline: [],
      buffTimeline: {},
      timelineGeneratedBuffSources: [],
      cooldownTimeline: {},
      explainability: {
        damageBreakdowns: [],
      },
      tickStates: Array.from({ length: 6 }, (_, index) => ({
        tickIndex: index,
        activeEquipmentState: {},
        adrenaline: 0,
        deathsporeStacks: 0,
        perfectEquilibriumStacks: 3,
        activePersistentBuffIds: [],
        activeTimelineBuffIds: index === 2 ? [balanceByForceBuff.id] : [],
        activeBuffIds: [],
        cooldowns: {},
        actionsStartingThisTick: [],
        hitsResolvingThisTick: [],
        validationIssues: [],
      })),
    };

    const inspection = inspectRotationPlannerTick({
      tick: 2,
      catalog: {
        ...CATALOG,
        items: {
          ...CATALOG.items,
          [BOLG.id]: {
            ...BOLG,
            effectRefs: ['bolg-passive'],
          },
        },
        buffs: {
          ...CATALOG.buffs,
          [balanceByForceBuff.id]: balanceByForceBuff,
        },
      },
      playerStats: {
        attackLevel: 120,
        strengthLevel: 120,
        rangedLevel: 120,
        magicLevel: 120,
      },
      gearState: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: BOLG.id,
          },
        },
        inventory: [],
      },
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 6,
        nonGcdActions: [],
        abilityActions: [],
      },
      simulationResult,
    });

    expect(inspection.perfectEquilibriumStacks).toBe(3);
    expect(inspection.perfectEquilibriumThreshold).toBe(4);
  });

  it('shows Bloodlust stacks in tick inspection and hides the raw Bloodlust buff entry', () => {
    const meleeWeapon: ItemDefinition = {
      id: 'abyssal-scourge',
      name: 'Abyssal scourge',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['melee'],
    };
    const simulationResult: SimulationResult = {
      isValid: true,
      validationIssues: [],
      totalDamage: { min: 0, avg: 0, max: 0 },
      damageByAbility: [],
      damageByTick: {},
      adrenalineTimeline: [],
      buffTimeline: {},
      timelineGeneratedBuffSources: [],
      cooldownTimeline: {},
      explainability: {
        damageBreakdowns: [],
      },
      tickStates: Array.from({ length: 6 }, (_, index) => ({
        tickIndex: index,
        activeEquipmentState: {},
        adrenaline: 0,
        deathsporeStacks: 0,
        activePersistentBuffIds: [],
        activeTimelineBuffIds: index === 4 ? ['berserk-buff', 'bloodlust', 'bloodlust', 'bloodlust'] : [],
        activeBuffIds: index === 4 ? ['berserk-buff', 'bloodlust', 'bloodlust', 'bloodlust'] : [],
        cooldowns: {},
        actionsStartingThisTick: [],
        hitsResolvingThisTick: [],
        validationIssues: [],
      })),
    };

    const inspection = inspectRotationPlannerTick({
      tick: 4,
      catalog: {
        ...CATALOG,
        items: {
          ...CATALOG.items,
          [meleeWeapon.id]: meleeWeapon,
        },
        buffs: {
          ...CATALOG.buffs,
          'berserk-buff': {
            id: 'berserk-buff',
            name: 'Berserk',
            category: 'temporary',
            sourceType: 'ability',
          },
          bloodlust: {
            id: 'bloodlust',
            name: 'Bloodlust',
            category: 'temporary',
            sourceType: 'ability',
            stackRules: {
              maxStacks: 4,
              conditionalModifiers: [
                {
                  whenBuffActive: 'berserk-buff',
                  maxStacks: 8,
                  gainMultiplier: 2,
                },
              ],
            },
          },
        },
      },
      playerStats: {
        attackLevel: 99,
        strengthLevel: 99,
        rangedLevel: 99,
      },
      gearState: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: meleeWeapon.id,
          },
        },
        inventory: [],
      },
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 6,
        nonGcdActions: [],
        abilityActions: [],
      },
      simulationResult,
    });

    expect(inspection.bloodlustStacks).toBe(3);
    expect(inspection.bloodlustMaxStacks).toBe(8);
    expect(inspection.perfectEquilibriumStacks).toBeNull();
    expect(inspection.activeTemporaryBuffs).toEqual(['Berserk']);
  });

  it('shows equipped perks and EOF stored special in equipment details', () => {
    const inspection = inspectRotationPlannerTick({
      tick: 1,
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
      },
      gearState: {
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: BOLG.id,
            configuredPerks: [
              {
                socketIndex: 0,
                perkId: PRECISE_PERK.id,
                rank: 4,
              },
            ],
          },
          amulet: {
            instanceId: 'amulet-1',
            definitionId: ESSENCE_OF_FINALITY.id,
            configValues: {
              'stored-special': 'dark-bow',
            },
          },
        },
        inventory: [],
      },
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: ROTATION_PLAN,
    });

    expect(inspection.equipmentState).toContainEqual({
      slot: 'Weapon',
      itemName: 'Bow of the Last Guardian',
      details: ['Perks: Precise 4'],
    });
    expect(inspection.equipmentState).toContainEqual({
      slot: 'Amulet',
      itemName: 'Essence of Finality amulet',
      details: ['Stored special: Dark Bow'],
    });
  });

  it('shows validation issues for the inspected tick', () => {
    const simulationResult: SimulationResult = {
      isValid: false,
      validationIssues: [
        {
          code: 'ability.insufficient_adrenaline',
          severity: 'error',
          tick: 3,
          relatedActionId: 'deadshot-1',
          message: 'Deadshot requires more adrenaline at this tick.',
        },
      ],
      totalDamage: { min: 0, avg: 0, max: 0 },
      damageByAbility: [],
      damageByTick: {},
      adrenalineTimeline: [],
      buffTimeline: {},
      timelineGeneratedBuffSources: [],
      cooldownTimeline: {},
      explainability: {
        damageBreakdowns: [],
      },
      tickStates: Array.from({ length: ROTATION_PLAN.tickCount }, (_, index) => ({
        tickIndex: index,
        activeEquipmentState: {},
        adrenaline: 0,
        activePersistentBuffIds: [],
        activeTimelineBuffIds: [],
        activeBuffIds: [],
        cooldowns: {},
        actionsStartingThisTick: [],
        hitsResolvingThisTick: [],
        validationIssues: [],
      })),
    };

    const inspection = inspectRotationPlannerTick({
      tick: 3,
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
      },
      gearState: GEAR_STATE,
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: {
        ...ROTATION_PLAN,
        abilityActions: [
          {
            id: 'deadshot-1',
            tick: 3,
            lane: 'ability',
            actionType: 'ability-use',
            payload: {
              abilityId: 'piercing-shot',
            },
          },
        ],
      },
      simulationResult,
    });

    expect(inspection.validationIssues).toEqual([
      expect.objectContaining({
        code: 'ability.insufficient_adrenaline',
        message: 'Deadshot requires more adrenaline at this tick.',
      }),
    ]);
  });

  it('shows the projected active spell after a spell swap takes effect', () => {
    const rotationPlan: RotationPlan = {
      startingAdrenaline: 0,
      tickCount: 8,
      nonGcdActions: [
        {
          id: 'spell-swap-2',
          tick: 2,
          lane: 'non-gcd',
          actionType: 'spell-swap',
          payload: {
            spellId: WATER_SURGE.id,
            label: 'Spell: Water Surge',
            shortLabel: 'Water',
            iconPath: 'icons/actions/gear-swap.svg',
          },
        },
      ],
      abilityActions: [],
    };

    const beforeSwap = inspectRotationPlannerTick({
      tick: 2,
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
        magicLevel: 99,
      },
      combatChoices: {
        magic: {
          spellbookId: 'standard',
          activeSpellId: FIRE_SURGE.id,
        },
      },
      gearState: GEAR_STATE,
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan,
    });

    const afterSwap = inspectRotationPlannerTick({
      tick: 3,
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 99,
        magicLevel: 99,
      },
      combatChoices: {
        magic: {
          spellbookId: 'standard',
          activeSpellId: FIRE_SURGE.id,
        },
      },
      gearState: GEAR_STATE,
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan,
    });

    expect(beforeSwap.activeSpell).toEqual({
      name: 'Fire Surge',
      spellbookId: 'standard',
    });
    expect(beforeSwap.actionsStarting).toEqual(['Spell Swap: Water Surge']);
    expect(afterSwap.activeSpell).toEqual({
      name: 'Water Surge',
      spellbookId: 'standard',
    });
  });

  it('shows Glacial Embrace and Essence Corruption as stack readouts instead of generic buffs', () => {
    const simulationResult: SimulationResult = {
      isValid: true,
      validationIssues: [],
      totalDamage: { min: 0, avg: 0, max: 0 },
      damageByAbility: [],
      damageByTick: {},
      adrenalineTimeline: [],
      buffTimeline: {},
      timelineGeneratedBuffSources: [],
      cooldownTimeline: {},
      explainability: {
        damageBreakdowns: [],
      },
      tickStates: Array.from({ length: 6 }, (_, index) => ({
        tickIndex: index,
        activeEquipmentState: {},
        adrenaline: 0,
        deathsporeStacks: 0,
        activePersistentBuffIds: [],
        activeTimelineBuffIds:
          index === 4
            ? ['glacial-embrace', 'glacial-embrace', 'essence-corruption', 'essence-corruption', 'essence-corruption', 'sunshine-buff']
            : [],
        activeBuffIds:
          index === 4
            ? ['glacial-embrace', 'glacial-embrace', 'essence-corruption', 'essence-corruption', 'essence-corruption', 'sunshine-buff']
            : [],
        cooldowns: {},
        actionsStartingThisTick: [],
        hitsResolvingThisTick: [],
        validationIssues: [],
      })),
    };

    const inspection = inspectRotationPlannerTick({
      tick: 4,
      catalog: {
        ...CATALOG,
        buffs: {
          ...CATALOG.buffs,
          'glacial-embrace': {
            id: 'glacial-embrace',
            name: 'Glacial Embrace',
            category: 'temporary',
            sourceType: 'ability',
            stackRules: {
              maxStacks: 5,
            },
          },
          'essence-corruption': {
            id: 'essence-corruption',
            name: 'Essence Corruption',
            category: 'temporary',
            sourceType: 'item',
            stackRules: {
              maxStacks: 100,
            },
          },
          'sunshine-buff': {
            id: 'sunshine-buff',
            name: 'Sunshine',
            category: 'temporary',
            sourceType: 'ability',
          },
        },
      },
      playerStats: {
        rangedLevel: 99,
        magicLevel: 99,
      },
      combatChoices: {
        magic: {
          spellbookId: 'ancient',
          activeSpellId: INCITE_FEAR.id,
        },
      },
      gearState: GEAR_STATE,
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 6,
        nonGcdActions: [],
        abilityActions: [],
      },
      simulationResult,
    });

    expect(inspection.glacialEmbraceStacks).toBe(2);
    expect(inspection.glacialEmbraceMaxStacks).toBe(5);
    expect(inspection.essenceCorruptionStacks).toBe(3);
    expect(inspection.essenceCorruptionMaxStacks).toBe(100);
    expect(inspection.activeTemporaryBuffs).toEqual(['Sunshine']);
  });
});
