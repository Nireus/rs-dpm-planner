import { describe, expect, it } from 'vitest';

import type { ItemDefinition } from '../../game-data/types';
import { applyEquipmentPlacement, type EquipmentTopologyState } from './equipment-topology';

const dualWieldWeapon: ItemDefinition = {
  id: 'ascension-crossbow',
  name: 'Ascension crossbow',
  category: 'weapon',
  slot: 'weapon',
  combatStyleTags: ['ranged'],
};

const offHandWeapon: ItemDefinition = {
  id: 'off-hand-ascension-crossbow',
  name: 'Off-hand Ascension crossbow',
  category: 'weapon',
  slot: 'offHand',
  combatStyleTags: ['ranged'],
};

const twoHandedWeapon: ItemDefinition = {
  id: 'eldritch-crossbow',
  name: 'Eldritch crossbow',
  category: 'weapon',
  slot: 'weapon',
  combatStyleTags: ['ranged'],
  equipBehavior: 'two-handed',
};

describe('applyEquipmentPlacement', () => {
  it('moves the equipped off-hand into inventory when equipping a two-handed weapon', () => {
    const state: EquipmentTopologyState = {
      equipment: {
        weapon: {
          instanceId: 'main-hand-1',
          definitionId: dualWieldWeapon.id,
        },
        offHand: {
          instanceId: 'off-hand-1',
          definitionId: offHandWeapon.id,
        },
      },
      inventory: [
        {
          instanceId: 'weapon-2h-1',
          definitionId: twoHandedWeapon.id,
        },
      ],
    };

    const result = applyEquipmentPlacement(
      state,
      state.inventory[0],
      'weapon',
      {
        [dualWieldWeapon.id]: dualWieldWeapon,
        [offHandWeapon.id]: offHandWeapon,
        [twoHandedWeapon.id]: twoHandedWeapon,
      },
    );

    expect(result.equipment.weapon?.instanceId).toBe('weapon-2h-1');
    expect(result.equipment.offHand).toBeUndefined();
    expect(result.inventory.map((item) => item.instanceId)).toEqual(
      expect.arrayContaining(['main-hand-1', 'off-hand-1']),
    );
  });
});
