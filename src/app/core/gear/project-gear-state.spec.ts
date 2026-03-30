import { describe, expect, it } from 'vitest';
import { projectGearStateAtTick } from './project-gear-state';
import type { GearBuilderState } from './gear-state';
import type { RotationAction } from '../../../simulation-engine/models';
import type { ItemDefinition } from '../../../game-data/types';

describe('projectGearStateAtTick', () => {
  const definitions: Record<string, ItemDefinition> = {
    'bow-of-the-last-guardian': {
      id: 'bow-of-the-last-guardian',
      name: 'Bow of the Last Guardian',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['ranged'],
      equipBehavior: 'two-handed',
    },
    'eldritch-crossbow': {
      id: 'eldritch-crossbow',
      name: 'Eldritch crossbow',
      category: 'weapon',
      slot: 'weapon',
      combatStyleTags: ['ranged'],
      equipBehavior: 'two-handed',
    },
    'dark-sliver-of-leng': {
      id: 'dark-sliver-of-leng',
      name: 'Dark Sliver of Leng',
      category: 'weapon',
      slot: 'offHand',
      combatStyleTags: ['melee'],
    },
  };

  it('moves displaced equipped items into projected inventory for later swaps', () => {
    const gearState: GearBuilderState = {
      equipment: {
        weapon: {
          instanceId: 'weapon-original',
          definitionId: 'bow-of-the-last-guardian',
        },
      },
      inventory: [
        {
          instanceId: 'weapon-swap',
          definitionId: 'eldritch-crossbow',
        },
      ],
    };

    const nonGcdActions: RotationAction[] = [
      {
        id: 'gear-swap-1',
        tick: 3,
        lane: 'non-gcd',
        actionType: 'gear-swap',
        payload: {
          instanceId: 'weapon-swap',
          definitionId: 'eldritch-crossbow',
          slot: 'weapon',
          label: 'Swap: Eldritch crossbow',
        },
      },
    ];

    const projected = projectGearStateAtTick(gearState, definitions, nonGcdActions, 6);

    expect(projected.equipment.weapon?.instanceId).toBe('weapon-swap');
    expect(projected.inventory.map((item) => item.instanceId)).toContain('weapon-original');
    expect(projected.inventory.map((item) => item.instanceId)).not.toContain('weapon-swap');
  });

  it('unequips a two-handed weapon when an off-hand item is swapped in', () => {
    const gearState: GearBuilderState = {
      equipment: {
        weapon: {
          instanceId: 'weapon-two-handed',
          definitionId: 'bow-of-the-last-guardian',
        },
      },
      inventory: [
        {
          instanceId: 'off-hand-one',
          definitionId: 'dark-sliver-of-leng',
        },
      ],
    };

    const nonGcdActions: RotationAction[] = [
      {
        id: 'gear-swap-off-hand',
        tick: 3,
        lane: 'non-gcd',
        actionType: 'gear-swap',
        payload: {
          instanceId: 'off-hand-one',
          definitionId: 'dark-sliver-of-leng',
          slot: 'offHand',
        },
      },
    ];

    const projected = projectGearStateAtTick(gearState, definitions, nonGcdActions, 6);

    expect(projected.equipment.weapon).toBeUndefined();
    expect(projected.equipment.offHand?.instanceId).toBe('off-hand-one');
    expect(projected.inventory.map((item) => item.instanceId)).toContain('weapon-two-handed');
  });
});
