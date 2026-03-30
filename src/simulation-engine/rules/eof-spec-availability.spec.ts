import { describe, expect, it } from 'vitest';
import type { EofSpecDefinition, ItemDefinition } from '../../game-data/types';
import type { ItemInstanceConfig, PlayerStats } from '../models';
import { evaluateEofSpecAvailability } from './eof-spec-availability';

const eofAmulet: ItemDefinition = {
  id: 'essence-of-finality',
  name: 'Essence of Finality amulet',
  category: 'jewellery',
  slot: 'amulet',
  combatStyleTags: ['ranged'],
  effectRefs: ['eof-special-access'],
};

const baseStats: PlayerStats = {
  rangedLevel: 99,
  prayerLevel: 95,
};

describe('evaluateEofSpecAvailability', () => {
  it('allows EOF specials when the stored special matches', () => {
    const eofSpec: EofSpecDefinition = {
      id: 'dark-bow-eof',
      name: 'Dark Bow (EOF)',
      weaponOrigin: 'dark-bow',
      abilityId: 'dark-bow-eof',
      requires: {
        requiredEquipmentTags: ['eof-special:dark-bow'],
      },
    };

    const eofInstance: ItemInstanceConfig = {
      instanceId: 'eof-1',
      definitionId: 'essence-of-finality',
      configValues: {
        'stored-special': 'dark-bow',
      },
    };

    expect(
      evaluateEofSpecAvailability(eofSpec, {
        playerStats: baseStats,
        equippedItems: [eofAmulet],
        inventoryItems: [],
        equippedInstances: [eofInstance],
      }),
    ).toEqual({
      eofSpecId: 'dark-bow-eof',
      isAvailable: true,
      issues: [],
    });
  });

  it('reports missing stored special access', () => {
    const eofSpec: EofSpecDefinition = {
      id: 'seren-godbow-eof',
      name: 'Seren Godbow (EOF)',
      weaponOrigin: 'seren-godbow',
      abilityId: 'seren-godbow-eof',
      requires: {
        requiredEquipmentTags: ['eof-special:seren-godbow'],
      },
    };

    expect(
      evaluateEofSpecAvailability(eofSpec, {
        playerStats: baseStats,
        equippedItems: [eofAmulet],
        inventoryItems: [],
        equippedInstances: [],
      }),
    ).toEqual({
      eofSpecId: 'seren-godbow-eof',
      isAvailable: false,
      issues: [
        {
          code: 'missing-tag',
          message: 'Requires Essence of Finality storing seren godbow.',
        },
      ],
    });
  });
});
