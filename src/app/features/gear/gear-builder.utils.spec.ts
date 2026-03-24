import type { ItemDefinition } from '../../../game-data/types';
import {
  canDropIntoEquipmentSlot,
  canDropIntoInventory,
  canEquipItemInSlot,
  getAllowedEquipmentSlots,
  validateGearSetup,
} from './gear-builder.utils';

describe('gear-builder utils', () => {
  const bow: ItemDefinition = {
    id: 'sample-bow',
    name: 'Sample bow',
    category: 'weapon',
    slot: 'weapon',
    combatStyleTags: ['ranged'],
  };

  const arrows: ItemDefinition = {
    id: 'sample-arrows',
    name: 'Sample arrows',
    category: 'ammo',
    slot: 'ammo',
    combatStyleTags: ['ranged'],
  };

  const ring: ItemDefinition = {
    id: 'sample-ring',
    name: 'Sample ring',
    category: 'jewellery',
    slot: 'ring',
    combatStyleTags: ['ranged'],
  };

  it('returns the supported slot for equippable items', () => {
    expect(getAllowedEquipmentSlots(bow)).toEqual(['weapon']);
    expect(getAllowedEquipmentSlots(arrows)).toEqual(['ammo']);
  });

  it('blocks incompatible slot placements', () => {
    expect(canEquipItemInSlot(ring, 'head')).toBe(false);
    expect(canEquipItemInSlot(arrows, 'weapon')).toBe(false);
  });

  it('reports invalid equipped assignments', () => {
    const issues = validateGearSetup(
      {
        head: {
          instanceId: 'instance-1',
          definitionId: ring.id,
        },
      },
      {
        [ring.id]: ring,
      },
    );

    expect(issues).toEqual(['Item "Sample ring" cannot be equipped in slot "head".']);
  });

  it('validates drag-and-drop targets', () => {
    const definitions = {
      [bow.id]: bow,
      [arrows.id]: arrows,
      [ring.id]: ring,
    };

    const state = {
      equipment: {
        ring: {
          instanceId: 'equipped-ring',
          definitionId: ring.id,
        },
      },
      inventory: [
        {
          instanceId: 'inventory-arrows',
          definitionId: arrows.id,
        },
      ],
    };

    expect(
      canDropIntoEquipmentSlot(
        { kind: 'catalog', definitionId: bow.id },
        'weapon',
        definitions,
        state,
      ),
    ).toBe(true);

    expect(
      canDropIntoEquipmentSlot(
        { kind: 'inventory', instanceId: 'inventory-arrows' },
        'weapon',
        definitions,
        state,
      ),
    ).toBe(false);

    expect(canDropIntoInventory({ kind: 'equipped', slot: 'ring' }, state)).toBe(true);
    expect(canDropIntoInventory({ kind: 'inventory', instanceId: 'inventory-arrows' }, state)).toBe(
      false,
    );
  });

  it('preserves config-like fields on equipped items', () => {
    const configured = {
      instanceId: 'configured-bow',
      definitionId: bow.id,
      perkIds: ['aftershock-4', 'equilibrium-4'],
      configValues: {
        enchanted: true,
      },
    };

    const issues = validateGearSetup(
      {
        weapon: configured,
      },
      {
        [bow.id]: bow,
      },
    );

    expect(issues).toEqual([]);
    expect(configured.perkIds).toEqual(['aftershock-4', 'equilibrium-4']);
    expect(configured.configValues).toEqual({ enchanted: true });
  });
});
