import { describe, expect, it } from 'vitest';

import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition, BuffDefinition, ItemDefinition, RelicDefinition } from '../../../game-data/types';
import type { GearBuilderState } from '../gear/gear-builder.utils';
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

const SEREN_GODBOW: ItemDefinition = {
  id: 'seren-godbow',
  name: 'Seren godbow',
  category: 'weapon',
  slot: 'weapon',
  combatStyleTags: ['ranged'],
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

const EQUILIBRIUM_PERK = {
  id: 'equilibrium',
  name: 'Equilibrium',
  effectRefs: ['equilibrium'],
};

const CATALOG: GameDataCatalog = {
  items: {
    [BOLG.id]: BOLG,
    [DEATHSPORE_ARROWS.id]: DEATHSPORE_ARROWS,
    [SEREN_GODBOW.id]: SEREN_GODBOW,
    [PERNIXS_QUIVER.id]: PERNIXS_QUIVER,
    [ESSENCE_OF_FINALITY.id]: ESSENCE_OF_FINALITY,
  },
  ammo: {},
  abilities: {
    [PIERCING_SHOT.id]: PIERCING_SHOT,
  },
  buffs: {
    [RIGOUR.id]: RIGOUR,
  },
  perks: {
    [EQUILIBRIUM_PERK.id]: EQUILIBRIUM_PERK,
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
      'Piercing Shot: Piercing Shot Hit 1 (166-304.5)',
      'Piercing Shot: Piercing Shot Hit 2 (166-304.5)',
    ]);
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
                perkId: EQUILIBRIUM_PERK.id,
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
      details: ['Perks: Equilibrium 4'],
    });
    expect(inspection.equipmentState).toContainEqual({
      slot: 'Amulet',
      itemName: 'Essence of Finality amulet',
      details: ['Stored special: Dark Bow'],
    });
  });
});
