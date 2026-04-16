import { describe, expect, it } from 'vitest';

import type { GearBuilderState } from './gear-state';
import { syncGenesisConfigAcrossUnlockGroup } from './gear-builder.store';
import { applyRangedBisPresetToGearState } from './ranged-bis-preset';

describe('syncGenesisConfigAcrossUnlockGroup', () => {
  it('syncs Genesis enchantment across the whole Roar of Awakening and Ode to Deceit set', () => {
    const state: GearBuilderState = {
      equipment: {
        weapon: {
          instanceId: 'roar-1',
          definitionId: 'roar-of-awakening',
        },
      },
      inventory: [
        {
          instanceId: 'ode-1',
          definitionId: 'ode-to-deceit',
        },
      ],
    };

    const result = syncGenesisConfigAcrossUnlockGroup(state, 'roar-1', true);

    expect(result.equipment.weapon?.configValues?.['genesis-enchanted']).toBe(true);
    expect(result.inventory[0]?.configValues?.['genesis-enchanted']).toBe(true);
  });
});

describe('applyRangedBisPresetToGearState', () => {
  it('moves equipped items to backpack and appends BIS gear when preserving current gear', () => {
    const current: GearBuilderState = {
      equipment: {
        weapon: {
          instanceId: 'old-weapon',
          definitionId: 'masterwork-bow',
        },
      },
      inventory: [
        {
          instanceId: 'old-backpack',
          definitionId: 'scripture-of-jas',
        },
      ],
    };

    const result = applyRangedBisPresetToGearState(current, 10, { removeCurrentGear: false });

    expect(result.state.equipment.weapon?.definitionId).toBe('bolg');
    expect(result.state.equipment.weapon?.instanceId).toBe('gear-item-10');
    expect(result.state.equipment.weapon?.configValues?.['genesis-enchanted']).toBe(true);
    expect(result.state.equipment.ring?.configValues?.['stalkers-ring-shadows-enchanted']).toBe(true);
    expect(result.state.equipment.amulet?.configValues).toMatchObject({
      'applied-dye': 'yellow',
      'stored-special': 'eldritch-crossbow',
    });
    expect(result.state.equipment.ammo?.configValues).toMatchObject({
      'applied-dye': 'yellow',
      'loaded-ammo': 'deathspore-arrows',
    });
    expect(result.state.inventory.map((item) => item.instanceId).slice(0, 2)).toEqual([
      'old-weapon',
      'old-backpack',
    ]);
    expect(result.state.inventory.some((item) => item.configValues?.['loaded-ammo'] === 'wen-arrows')).toBe(true);
    expect(result.state.inventory.some((item) => item.configValues?.['stored-special'] === 'gloomfire-bow')).toBe(true);
    expect(result.nextInstanceId).toBe(27);
  });

  it('replaces current gear and backpack when requested', () => {
    const current: GearBuilderState = {
      equipment: {
        weapon: {
          instanceId: 'old-weapon',
          definitionId: 'masterwork-bow',
        },
      },
      inventory: [
        {
          instanceId: 'old-backpack',
          definitionId: 'scripture-of-jas',
        },
      ],
    };

    const result = applyRangedBisPresetToGearState(current, 1, { removeCurrentGear: true });

    expect(Object.values(result.state.equipment).some((item) => item?.instanceId === 'old-weapon')).toBe(false);
    expect(result.state.inventory.some((item) => item.instanceId === 'old-backpack')).toBe(false);
    expect(result.state.inventory).toHaveLength(6);
    expect(result.state.equipment.body?.configuredPerks).toEqual(
      expect.arrayContaining([
        { socketIndex: 0, perkId: 'relentless', rank: 5 },
        { socketIndex: 0, perkId: 'crackling', rank: 4 },
        { socketIndex: 1, perkId: 'biting', rank: 4 },
      ]),
    );
  });
});
