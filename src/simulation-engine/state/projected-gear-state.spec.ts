import { describe, expect, it } from 'vitest';
import { projectSimulationConfigAtTick } from './projected-gear-state';
import type { SimulationConfig } from '../models';

function createConfig(): SimulationConfig {
  return {
    playerStats: {
      rangedLevel: 99,
      prayerLevel: 99,
    },
    gearSetup: {
      equipment: {
        weapon: {
          instanceId: 'weapon-bow',
          definitionId: 'bow',
        },
        ammo: {
          instanceId: 'quiver-deathspore',
          definitionId: 'pernixs-quiver',
          configValues: {
            'loaded-ammo': 'deathspore-arrows',
          },
        },
      },
      ammoSelection: {
        instanceId: 'quiver-deathspore:loaded-ammo:deathspore-arrows',
        definitionId: 'deathspore-arrows',
      },
    },
    inventory: {
      items: [
        {
          instanceId: 'quiver-ful',
          definitionId: 'pernixs-quiver',
          configValues: {
            'loaded-ammo': 'ful-arrows',
          },
        },
      ],
    },
    persistentBuffConfig: {},
    rotationPlan: {
      startingAdrenaline: 100,
      tickCount: 30,
      abilityActions: [],
      nonGcdActions: [
        {
          id: 'swap-to-ful',
          tick: 5,
          lane: 'non-gcd',
          actionType: 'gear-swap',
          payload: {
            instanceId: 'quiver-ful',
            definitionId: 'pernixs-quiver',
            slot: 'ammo',
          },
        },
        {
          id: 'swap-back-to-deathspore',
          tick: 15,
          lane: 'non-gcd',
          actionType: 'gear-swap',
          payload: {
            instanceId: 'quiver-deathspore',
            definitionId: 'pernixs-quiver',
            slot: 'ammo',
          },
        },
      ],
    },
    gameData: {
      items: {
        bow: {
          id: 'bow',
          name: 'Bow',
          category: 'weapon',
          slot: 'weapon',
          combatStyleTags: ['ranged'],
          effectRefs: [],
        },
        'pernixs-quiver': {
          id: 'pernixs-quiver',
          name: "Pernix's quiver",
          category: 'armor',
          slot: 'ammo',
          combatStyleTags: ['ranged'],
          configOptions: [
            {
              id: 'loaded-ammo',
              label: 'Loaded arrows',
              type: 'select',
              defaultValue: 'deathspore-arrows',
              options: ['deathspore-arrows', 'ful-arrows', 'none'],
            },
          ],
          effectRefs: ['quiver-passive'],
        },
        'deathspore-arrows': {
          id: 'deathspore-arrows',
          name: 'Deathspore arrows',
          category: 'ammo',
          slot: 'ammo',
          combatStyleTags: ['ranged'],
          effectRefs: ['deathspore-progress'],
        },
        'ful-arrows': {
          id: 'ful-arrows',
          name: 'Ful arrows',
          category: 'ammo',
          slot: 'ammo',
          combatStyleTags: ['ranged'],
          effectRefs: [],
        },
        'bakriminel-bolts': {
          id: 'bakriminel-bolts',
          name: 'Bakriminel bolts',
          category: 'ammo',
          slot: 'ammo',
          combatStyleTags: ['ranged'],
          effectRefs: [],
        },
      },
      ammo: {},
      abilities: {},
      buffs: {},
      perks: {},
      relics: {},
      eofSpecs: {},
    },
    modeFlags: {
      strictValidation: true,
    },
  };
}

describe('projectSimulationConfigAtTick', () => {
  it('recomputes effective quiver ammo after swapping away and back', () => {
    const config = createConfig();

    expect(projectSimulationConfigAtTick(config, 0).gearSetup.ammoSelection?.definitionId).toBe('deathspore-arrows');
    expect(projectSimulationConfigAtTick(config, 10).gearSetup.ammoSelection?.definitionId).toBe('ful-arrows');
    expect(projectSimulationConfigAtTick(config, 20).gearSetup.ammoSelection?.definitionId).toBe('deathspore-arrows');
  });
});
