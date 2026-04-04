import { describe, expect, it } from 'vitest';

import type { GearBuilderState } from './gear-state';
import { syncGenesisConfigAcrossUnlockGroup } from './gear-builder.store';

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
