import { describe, expect, it } from 'vitest';
import { projectGearStateAtTick } from './project-gear-state';
import type { GearBuilderState } from './gear-state';
import type { RotationAction } from '../../../simulation-engine/models';

describe('projectGearStateAtTick', () => {
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

    const projected = projectGearStateAtTick(gearState, nonGcdActions, 6);

    expect(projected.equipment.weapon?.instanceId).toBe('weapon-swap');
    expect(projected.inventory.map((item) => item.instanceId)).toContain('weapon-original');
    expect(projected.inventory.map((item) => item.instanceId)).not.toContain('weapon-swap');
  });
});
