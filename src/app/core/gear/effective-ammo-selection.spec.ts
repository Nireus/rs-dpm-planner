import { describe, expect, it } from 'vitest';

import type { GameDataCatalog } from '../../../game-data/loaders';
import type { ItemDefinition } from '../../../game-data/types';
import type { GearBuilderState } from './gear-state';
import { resolveEffectiveAmmoSelection } from './effective-ammo-selection';

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
      options: ['deathspore-arrows', 'none'],
    },
  ],
};

const ELDRITCH_CROSSBOW: ItemDefinition = {
  id: 'eldritch-crossbow',
  name: 'Eldritch crossbow',
  category: 'weapon',
  slot: 'weapon',
  combatStyleTags: ['ranged'],
  effectRefs: ['weapon-class:crossbow'],
};

const CATALOG: GameDataCatalog = {
  items: {
    'bakriminel-bolts': BAKRIMINEL_BOLTS,
    'deathspore-arrows': DEATHSPORE_ARROWS,
    'eldritch-crossbow': ELDRITCH_CROSSBOW,
    'pernixs-quiver': PERNIXS_QUIVER,
  },
  ammo: {},
  spells: {},
  abilities: {},
  buffs: {},
  perks: {},
  relics: {},
  eofSpecs: {},
};

describe('resolveEffectiveAmmoSelection', () => {
  it('returns the loaded ammo from a quiver configuration', () => {
    const gearState: GearBuilderState = {
      equipment: {
        ammo: {
          instanceId: 'quiver-1',
          definitionId: 'pernixs-quiver',
          configValues: {
            'loaded-ammo': 'deathspore-arrows',
          },
        },
      },
      inventory: [],
    };

    expect(resolveEffectiveAmmoSelection(gearState, CATALOG)).toEqual({
      instanceId: 'quiver-1:loaded-ammo:deathspore-arrows',
      definitionId: 'deathspore-arrows',
    });
  });

  it('falls back to the equipped ammo when no quiver is worn', () => {
    const gearState: GearBuilderState = {
      equipment: {
        ammo: {
          instanceId: 'ammo-1',
          definitionId: 'deathspore-arrows',
        },
      },
      inventory: [],
    };

    expect(resolveEffectiveAmmoSelection(gearState, CATALOG)).toEqual({
      instanceId: 'ammo-1',
      definitionId: 'deathspore-arrows',
    });
  });

  it('uses implicit bakriminel bolts from a quiver when a crossbow is equipped', () => {
    const gearState: GearBuilderState = {
      equipment: {
        weapon: {
          instanceId: 'weapon-1',
          definitionId: 'eldritch-crossbow',
        },
        ammo: {
          instanceId: 'quiver-1',
          definitionId: 'pernixs-quiver',
          configValues: {
            'loaded-ammo': 'deathspore-arrows',
          },
        },
      },
      inventory: [],
    };

    expect(resolveEffectiveAmmoSelection(gearState, CATALOG)).toEqual({
      instanceId: 'quiver-1:loaded-bolts:bakriminel-bolts',
      definitionId: 'bakriminel-bolts',
    });
  });
});
