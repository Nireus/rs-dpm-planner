import { describe, expect, it } from 'vitest';
import type { AbilityDefinition, BuffDefinition, ItemDefinition } from '../../game-data/types';
import type { SimulationConfig } from '../models';
import { resolveDeterministicMagicTimeline } from './magic-deterministic';

describe('resolveDeterministicMagicTimeline', () => {
  it("adds Channeller's ring stacking crit chance to magic channelled hits", () => {
    const result = resolveDeterministicMagicTimeline(createConfig({ actionTick: 0 }));

    expect(result.hitCritChanceBonusByActionId['action-1']).toEqual({
      hit1: 4,
      hit2: 8,
      hit3: 12,
    });
  });

  it('adds Enchantment of metaphysics crit damage only after the ring has been equipped for 15 ticks', () => {
    const early = resolveDeterministicMagicTimeline(createConfig({ actionTick: 0, metaphysicsEnchanted: true }));
    const active = resolveDeterministicMagicTimeline(createConfig({ actionTick: 20, metaphysicsEnchanted: true }));

    expect(early.hitCritDamageBonusByActionId['action-1']).toBeUndefined();
    expect(active.hitCritDamageBonusByActionId['action-1']).toEqual({
      hit1: 2.5,
      hit2: 5,
      hit3: 7.5,
    });
    expect(active.notes).toContain(
      "Enchantment of metaphysics: after Channeller's ring has been equipped for 9 seconds, magic channelled hits gain stacking critical strike damage. This stacks with Runic Embrace for +6.5% combined crit contribution per hit step.",
    );
  });
});

function createConfig(options: { actionTick: number; metaphysicsEnchanted?: boolean }): SimulationConfig {
  const channelAbility: AbilityDefinition = {
    id: 'sample-channel',
    name: 'Sample Channel',
    style: 'magic',
    subtype: 'basic',
    cooldownTicks: 0,
    adrenalineGain: 8,
    isChanneled: true,
    channelDurationTicks: 3,
    hitSchedule: [
      { id: 'hit1', tickOffset: 0, damage: { min: 100, max: 100 } },
      { id: 'hit2', tickOffset: 1, damage: { min: 100, max: 100 } },
      { id: 'hit3', tickOffset: 2, damage: { min: 100, max: 100 } },
    ],
    baseDamage: { min: 300, max: 300 },
  };
  const channellersRing: ItemDefinition = {
    id: 'channellers-ring',
    name: "Channeller's ring",
    category: 'jewellery',
    slot: 'ring',
    combatStyleTags: ['magic'],
  };

  return {
    playerStats: {
      rangedLevel: 99,
      magicLevel: 99,
    },
    gearSetup: {
      equipment: {
        ring: {
          instanceId: 'ring-1',
          definitionId: 'channellers-ring',
          configValues: {
            'channellers-ring-metaphysics-enchanted': options.metaphysicsEnchanted === true,
          },
        },
      },
    },
    inventory: {
      items: [],
    },
    persistentBuffConfig: {},
    rotationPlan: {
      startingAdrenaline: 100,
      tickCount: 40,
      nonGcdActions: [],
      abilityActions: [
        {
          id: 'action-1',
          tick: options.actionTick,
          lane: 'ability',
          actionType: 'ability-use',
          payload: {
            abilityId: 'sample-channel',
          },
        },
      ],
    },
    gameData: {
      items: {
        'channellers-ring': channellersRing,
      },
      ammo: {},
      abilities: {
        'sample-channel': channelAbility,
      },
      buffs: {} as Record<string, BuffDefinition>,
      perks: {},
      relics: {},
      eofSpecs: {},
    },
    modeFlags: {
      strictValidation: true,
    },
  };
}
