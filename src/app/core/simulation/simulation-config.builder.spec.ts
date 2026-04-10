import { describe, expect, it } from 'vitest';

import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition, BuffDefinition, ItemDefinition, RelicDefinition } from '../../../game-data/types';
import {
  buildSimulationConfigFromAppState,
  collectPersistentBuffIds,
} from './simulation-config.builder';

const RIGOUR: BuffDefinition = {
  id: 'rigour',
  name: 'Rigour',
  category: 'prayer',
  sourceType: 'player-config',
  isPermanent: true,
};

const WARPED_GEM: BuffDefinition = {
  id: 'warped-gem',
  name: 'Warped gem',
  category: 'miscellaneous',
  sourceType: 'player-config',
  isPermanent: true,
};

const FURY_OF_THE_SMALL: RelicDefinition = {
  id: 'fury-of-the-small',
  name: 'Fury of the Small',
  description: 'Basic abilities generate extra adrenaline.',
  monolithEnergy: 150,
  effectRefs: ['basic-adrenaline:+1'],
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

const SURGE: AbilityDefinition = {
  id: 'surge',
  name: 'Surge',
  style: 'magic',
  subtype: 'utility',
  cooldownTicks: 17,
  hitSchedule: [],
  baseDamage: {
    min: 0,
    max: 0,
  },
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
  abilities: {
    [SURGE.id]: SURGE,
  },
  buffs: {
    rigour: RIGOUR,
    'warped-gem': WARPED_GEM,
  },
  perks: {},
  relics: {
    'fury-of-the-small': FURY_OF_THE_SMALL,
  },
  eofSpecs: {},
};

describe('buildSimulationConfigFromAppState', () => {
  it('builds a simulation config from shared app state slices', () => {
    const result = buildSimulationConfigFromAppState({
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 120,
      },
      gearState: {
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
      },
      buffState: {
        activeBuffIds: ['rigour', 'warped-gem'],
        activeRelicIds: ['fury-of-the-small'],
        activePocketItemIds: ['scripture-of-jas'],
      },
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 30,
        nonGcdActions: [],
        abilityActions: [],
      },
      simulationSettings: {
        criticalHitResolutionMode: 'expected-value',
      },
    });

    expect(result.playerStats.rangedLevel).toBe(120);
    expect(result.gearSetup.ammoSelection).toEqual({
      instanceId: 'quiver-1:loaded-ammo:deathspore-arrows',
      definitionId: 'deathspore-arrows',
    });
    expect(result.persistentBuffConfig).toEqual({
      prayerIds: ['rigour'],
      potionIds: [],
      relicIds: ['fury-of-the-small'],
      buffIds: ['warped-gem'],
      pocketEffectItemIds: ['scripture-of-jas'],
    });
    expect(result.modeFlags.strictValidation).toBe(true);
    expect(result.simulationSettings?.criticalHitResolutionMode).toBe('expected-value');
  });

  it('projects bakriminel bolts from pernix quiver when a crossbow is equipped', () => {
    const result = buildSimulationConfigFromAppState({
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 120,
      },
      gearState: {
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
      },
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 30,
        nonGcdActions: [],
        abilityActions: [],
      },
    });

    expect(result.gearSetup.ammoSelection).toEqual({
      instanceId: 'quiver-1:loaded-bolts:bakriminel-bolts',
      definitionId: 'bakriminel-bolts',
    });
  });

  it('projects non-gcd utility ability actions into the simulation ability stream', () => {
    const result = buildSimulationConfigFromAppState({
      catalog: CATALOG,
      playerStats: {
        rangedLevel: 120,
        magicLevel: 120,
      },
      gearState: {
        equipment: {},
        inventory: [],
      },
      buffState: {
        activeBuffIds: [],
        activeRelicIds: [],
        activePocketItemIds: [],
      },
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 30,
        nonGcdActions: [
          {
            id: 'non-gcd-ability-surge-3-1',
            tick: 3,
            lane: 'non-gcd',
            actionType: 'ability-use',
            payload: {
              templateId: 'ability-use',
              abilityId: 'surge',
            },
          },
        ],
        abilityActions: [],
      },
    });

    expect(result.rotationPlan.abilityActions).toContainEqual({
      id: 'non-gcd-ability-surge-3-1',
      tick: 3,
      lane: 'non-gcd',
      actionType: 'ability-use',
      payload: {
        templateId: 'ability-use',
        abilityId: 'surge',
      },
    });
  });
});

describe('collectPersistentBuffIds', () => {
  it('returns only known buff and relic ids', () => {
    expect(
      collectPersistentBuffIds(
        {
          activeBuffIds: ['rigour', 'missing-buff'],
          activeRelicIds: ['fury-of-the-small', 'missing-relic'],
          activePocketItemIds: ['scripture-of-jas'],
        },
        CATALOG,
      ),
    ).toEqual(['rigour', 'fury-of-the-small']);
  });
});
