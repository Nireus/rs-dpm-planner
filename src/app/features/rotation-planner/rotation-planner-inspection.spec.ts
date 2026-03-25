import { describe, expect, it } from 'vitest';

import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition, BuffDefinition, ItemDefinition, RelicDefinition } from '../../../game-data/types';
import type { GearBuilderState } from '../gear/gear-builder.utils';
import type { RotationPlan } from '../../../simulation-engine/models';
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
};

const SEREN_GODBOW: ItemDefinition = {
  id: 'seren-godbow',
  name: 'Seren godbow',
  category: 'weapon',
  slot: 'weapon',
  combatStyleTags: ['ranged'],
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

const CATALOG: GameDataCatalog = {
  items: {
    [BOLG.id]: BOLG,
    [DEATHSPORE_ARROWS.id]: DEATHSPORE_ARROWS,
    [SEREN_GODBOW.id]: SEREN_GODBOW,
  },
  ammo: {},
  abilities: {
    [PIERCING_SHOT.id]: PIERCING_SHOT,
  },
  buffs: {
    [RIGOUR.id]: RIGOUR,
  },
  perks: {},
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
    expect(inspection.activePersistentBuffs).toEqual(['Rigour', 'Fury of the Small']);
    expect(inspection.equipmentState).toEqual([
      {
        slot: 'Weapon',
        itemName: 'Bow of the Last Guardian',
      },
      {
        slot: 'Ammo',
        itemName: 'Deathspore arrows',
      },
    ]);
    expect(inspection.ammoState).toBe('Deathspore arrows');
    expect(inspection.actionsStarting).toEqual([]);
    expect(inspection.hitsResolving).toEqual(['Piercing Shot: Piercing Shot Hit 2 (45-55%)']);
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
    expect(inspection.hitsResolving).toEqual(['Piercing Shot: Piercing Shot Hit 1 (45-55%)']);
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
    });
  });
});
