import { describe, expect, it } from 'vitest';

import type { AbilityDefinition } from '../../../game-data/types';
import type { LoadedGameDataSnapshot, SimulationConfig } from '../../../simulation-engine/models';
import { buildAbilityBrowserEntry } from './abilities-page.component';

function createAbility(overrides: Partial<AbilityDefinition> = {}): AbilityDefinition {
  return {
    id: 'adaptive-strike',
    name: 'Adaptive Strike',
    style: 'melee',
    subtype: 'basic',
    cooldownTicks: 9,
    adrenalineGain: 12,
    hitSchedule: [{ id: 'adaptive-strike-hit-1', tickOffset: 0, damage: { min: 120, max: 140 } }],
    baseDamage: { min: 120, max: 140 },
    variants: [
      {
        id: 'adaptive-strike',
        priority: 100,
        when: {
          requiredEquipmentTags: ['melee-dual-wield'],
        },
        hitSchedule: [
          { id: 'adaptive-strike-dual-wield-hit-1', tickOffset: 0, damage: { min: 60, max: 75 } },
          { id: 'adaptive-strike-dual-wield-hit-2', tickOffset: 0, damage: { min: 60, max: 75 } },
        ],
        baseDamage: { min: 120, max: 150 },
      },
    ],
    displayHints: {
      hitCountLabel: '1-2 hit(s)',
      damageRangeLabel: '120%-140% (main-hand / 2h), or 2 x 60%-75% (dual-wield)',
      hitScheduleSummary: '1 hit at tick 0, or 2 same-tick hits while dual-wielding.',
    },
    ...overrides,
  };
}

function createSimulationConfig(): SimulationConfig {
  const gameData: LoadedGameDataSnapshot = {
    items: {
      'melee-main-hand': {
        id: 'melee-main-hand',
        name: 'Melee Main-hand',
        category: 'weapon',
        slot: 'weapon',
        combatStyleTags: ['melee'],
      },
      'melee-off-hand': {
        id: 'melee-off-hand',
        name: 'Melee Off-hand',
        category: 'weapon',
        slot: 'offHand',
        combatStyleTags: ['melee'],
      },
    },
    ammo: {},
    abilities: {
      'adaptive-strike': createAbility(),
    },
    buffs: {},
    perks: {},
    relics: {},
    eofSpecs: {},
  };

  return {
    playerStats: {
      attackLevel: 99,
      strengthLevel: 99,
      defenceLevel: 99,
      rangedLevel: 99,
      magicLevel: 99,
      necromancyLevel: 99,
      prayerLevel: 99,
    },
    gearSetup: {
      equipment: {
        weapon: {
          instanceId: 'main-hand-1',
          definitionId: 'melee-main-hand',
        },
        offHand: {
          instanceId: 'off-hand-1',
          definitionId: 'melee-off-hand',
        },
      },
    },
    inventory: {
      items: [],
    },
    persistentBuffConfig: {},
    rotationPlan: {
      startingAdrenaline: 100,
      tickCount: 1,
      nonGcdActions: [],
      abilityActions: [],
    },
    gameData,
    modeFlags: {
      strictValidation: true,
    },
  };
}

describe('buildAbilityBrowserEntry', () => {
  it('uses the effective ability damage range for Adaptive Strike', () => {
    const entry = buildAbilityBrowserEntry(
      createSimulationConfig(),
      createAbility(),
      (_ability, curatedDetailLines) => curatedDetailLines ?? [],
    );

    expect(entry.hitCount).toBe(2);
    expect(entry.baseDamage).toEqual({ min: 120, max: 150 });
    expect(entry.hitSchedule).toEqual([
      { id: 'adaptive-strike-dual-wield-hit-1', tickOffset: 0, damage: { min: 60, max: 75 } },
      { id: 'adaptive-strike-dual-wield-hit-2', tickOffset: 0, damage: { min: 60, max: 75 } },
    ]);
    expect(entry.displayHitCountLabel).toBe('1-2 hit(s)');
    expect(entry.displayDamageRangeLabel).toBe('120%-140% (main-hand / 2h), or 2 x 60%-75% (dual-wield)');
    expect(entry.displayHitScheduleSummary).toBe('1 hit at tick 0, or 2 same-tick hits while dual-wielding.');
  });
});
