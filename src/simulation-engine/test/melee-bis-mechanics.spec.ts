import { describe, expect, it } from 'vitest';

import { CONFIG_OPTION_IDS, EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type { AbilityDefinition, ItemDefinition } from '../../game-data/types';
import { simulateBaseDamage } from '../calculators/base-damage-simulation';
import {
  createAbilityAction,
  createAbilityDefinition,
  createScenarioConfig,
} from './scenario-test-helpers';

const MELEE_WEAPON: ItemDefinition = {
  id: 'melee-weapon',
  name: 'Melee weapon',
  category: 'weapon',
  slot: 'weapon',
  combatStyleTags: ['melee'],
  tier: 95,
  offensiveStats: {
    damageTier: 95,
  },
  requirements: {
    requiredEquipmentTags: ['melee-weapon'],
  },
};

const BASIC_MELEE_ATTACK = createAbilityDefinition({
  id: 'attack',
  name: 'Attack',
  style: 'melee',
  subtype: 'basic',
  cooldownTicks: 3,
  adrenalineGain: 9,
  hitSchedule: [{ id: 'attack-hit', tickOffset: 0, damage: { min: 100, max: 100 } }],
  baseDamage: { min: 100, max: 100 },
});

const REND = createAbilityDefinition({
  id: 'rend',
  name: 'Rend',
  style: 'melee',
  subtype: 'basic',
  cooldownTicks: 3,
  adrenalineGain: 9,
  hitSchedule: [{ id: 'rend-hit', tickOffset: 0, damage: { min: 80, max: 80 } }],
  baseDamage: { min: 80, max: 80 },
});

const DISMEMBER = createAbilityDefinition({
  id: 'dismember',
  name: 'Dismember',
  style: 'melee',
  subtype: 'basic',
  cooldownTicks: 3,
  adrenalineGain: 9,
  hitSchedule: [{ id: 'dismember-hit', tickOffset: 0, damage: { min: 100, max: 100 } }],
  baseDamage: { min: 100, max: 100 },
  effectRefs: [EFFECT_REF_IDS.damageOverTime],
});

describe('melee BIS mechanics', () => {
  it('applies Malevolence and Turmoil melee damage multipliers', () => {
    const baseline = simulateMeleeAttack();
    const malevolence = simulateMeleeAttack({
      buffs: {
        malevolence: {
          id: 'malevolence',
          name: 'Malevolence',
          category: 'prayer',
          sourceType: 'player-config',
          effectRefs: ['melee-damage-multiplier:+12%'],
        },
      },
      prayerIds: ['malevolence'],
    });
    const turmoil = simulateMeleeAttack({
      buffs: {
        turmoil: {
          id: 'turmoil',
          name: 'Turmoil',
          category: 'prayer',
          sourceType: 'player-config',
          effectRefs: ['melee-damage-multiplier:+10%'],
        },
      },
      prayerIds: ['turmoil'],
    });

    expect(malevolence.totalDamage.avg).toBeGreaterThan(baseline.totalDamage.avg);
    expect(turmoil.totalDamage.avg).toBeGreaterThan(baseline.totalDamage.avg);
    expect(
      malevolence.explainability.damageBreakdowns[0]?.multiplicativeModifiers.some(
        (modifier) => modifier.sourceId === 'melee-damage-multiplier:+12%',
      ),
    ).toBe(true);
    expect(
      turmoil.explainability.damageBreakdowns[0]?.multiplicativeModifiers.some(
        (modifier) => modifier.sourceId === 'melee-damage-multiplier:+10%',
      ),
    ).toBe(true);
  });

  it('upgrades Enduring Ruin with Enchantment of agony after enhanced gloves are equipped for 15 ticks', () => {
    const beforeDelay = simulateBaseDamage(
      createMeleeConfig({
        abilities: { rend: REND, attack: BASIC_MELEE_ATTACK },
        items: { 'enhanced-gloves-of-passage': enhancedGlovesOfPassage() },
        equipment: {
          weapon: { instanceId: 'weapon-1', definitionId: MELEE_WEAPON.id },
          hands: {
            instanceId: 'gloves-1',
            definitionId: 'enhanced-gloves-of-passage',
            configValues: { [CONFIG_OPTION_IDS.enhancedGlovesOfPassageAgonyEnchanted]: true },
          },
        },
        abilityActions: [
          createAbilityAction('rend-1', 0, 'rend'),
          createAbilityAction('attack-1', 3, 'attack'),
        ],
        tickCount: 10,
      }),
    );
    const afterDelay = simulateBaseDamage(
      createMeleeConfig({
        abilities: { rend: REND, attack: BASIC_MELEE_ATTACK },
        items: { 'enhanced-gloves-of-passage': enhancedGlovesOfPassage() },
        equipment: {
          weapon: { instanceId: 'weapon-1', definitionId: MELEE_WEAPON.id },
          hands: {
            instanceId: 'gloves-1',
            definitionId: 'enhanced-gloves-of-passage',
            configValues: { [CONFIG_OPTION_IDS.enhancedGlovesOfPassageAgonyEnchanted]: true },
          },
        },
        abilityActions: [
          createAbilityAction('rend-1', 15, 'rend'),
          createAbilityAction('attack-1', 18, 'attack'),
        ],
        tickCount: 25,
      }),
    );
    const bleedAfterDelay = simulateBaseDamage(
      createMeleeConfig({
        abilities: { rend: REND, dismember: DISMEMBER },
        items: { 'enhanced-gloves-of-passage': enhancedGlovesOfPassage() },
        equipment: {
          weapon: { instanceId: 'weapon-1', definitionId: MELEE_WEAPON.id },
          hands: {
            instanceId: 'gloves-1',
            definitionId: 'enhanced-gloves-of-passage',
            configValues: { [CONFIG_OPTION_IDS.enhancedGlovesOfPassageAgonyEnchanted]: true },
          },
        },
        abilityActions: [
          createAbilityAction('rend-1', 15, 'rend'),
          createAbilityAction('dismember-1', 18, 'dismember'),
        ],
        tickCount: 25,
      }),
    );

    expect(findModifierLabel(beforeDelay, 'attack', EFFECT_REF_IDS.glovesOfPassagePassive)).toContain('x1.10');
    expect(findModifierLabel(afterDelay, 'attack', EFFECT_REF_IDS.glovesOfPassagePassive)).toContain('x1.16');
    expect(findModifierLabel(bleedAfterDelay, 'dismember', 'corrupted-wounds')).toContain('x1.25');
  });

  it('adds Am-hej melee damage from configured Strength and excludes bleeds', () => {
    const result = simulateBaseDamage(
      createMeleeConfig({
        abilities: { attack: BASIC_MELEE_ATTACK, dismember: DISMEMBER },
        items: {
          'am-hej': {
            id: 'am-hej',
            name: 'Am-hej',
            category: 'jewellery',
            slot: 'amulet',
            combatStyleTags: ['melee'],
            effectRefs: [EFFECT_REF_IDS.amHejPassive],
          },
        },
        equipment: {
          weapon: { instanceId: 'weapon-1', definitionId: MELEE_WEAPON.id },
          amulet: { instanceId: 'amhej-1', definitionId: 'am-hej' },
        },
        abilityActions: [
          createAbilityAction('attack-1', 0, 'attack'),
          createAbilityAction('dismember-1', 3, 'dismember'),
        ],
        tickCount: 10,
      }),
    );

    expect(findModifierLabel(result, 'attack', EFFECT_REF_IDS.amHejPassive)).toContain('x1.04');
    expect(findModifierLabel(result, 'dismember', EFFECT_REF_IDS.amHejPassive)).toBeNull();
  });

  it('applies Rampage as a 100-tick +20% melee damage special attack buff', () => {
    const result = simulateBaseDamage(
      createMeleeConfig({
        abilities: {
          rampage: createAbilityDefinition({
            id: 'rampage',
            name: 'Rampage',
            style: 'melee',
            subtype: 'special',
            cooldownTicks: 0,
            adrenalineCost: 100,
            hitSchedule: [],
            baseDamage: { min: 0, max: 0 },
            timelineEffects: [{ kind: 'apply-buff', buffId: 'rampage', durationTicks: 100 }],
          }),
          attack: BASIC_MELEE_ATTACK,
        },
        buffs: {
          rampage: {
            id: 'rampage',
            name: 'Rampage',
            category: 'temporary',
            sourceType: 'ability',
            effectRefs: ['melee-damage-multiplier:+20%'],
          },
        },
        abilityActions: [
          createAbilityAction('rampage-1', 0, 'rampage'),
          createAbilityAction('attack-1', 3, 'attack'),
        ],
        startingAdrenaline: 100,
        tickCount: 110,
      }),
    );

    expect(result.isValid).toBe(true);
    expect(result.buffTimeline[3]).toContain('rampage');
    expect(result.buffTimeline[99]).toContain('rampage');
    expect(result.buffTimeline[100]).not.toContain('rampage');
    expect(findModifierLabel(result, 'attack', 'melee-damage-multiplier:+20%')).toContain('x1.20');
  });

  it('supports Dragon claw and Varanus EOF hit layouts with hit-scoped critical modifiers', () => {
    const dragonClaw = simulateBaseDamage(
      createMeleeConfig({
        abilities: { 'dragon-claw-eof': dragonClawEofAbility() },
        abilityActions: [createAbilityAction('dragon-claw-1', 0, 'dragon-claw-eof')],
        startingAdrenaline: 100,
        tickCount: 5,
      }),
    );
    const varanus = simulateBaseDamage(
      createMeleeConfig({
        abilities: { 'varanuss-mercy-eof': varanusEofAbility() },
        abilityActions: [createAbilityAction('varanus-1', 0, 'varanuss-mercy-eof')],
        startingAdrenaline: 100,
        tickCount: 5,
      }),
    );

    expect(dragonClaw.explainability.damageBreakdowns).toHaveLength(4);
    expect(varanus.explainability.damageBreakdowns).toHaveLength(3);
    expect(
      varanus.explainability.damageBreakdowns.every((entry) =>
        entry.expectedValueModifiers.some((modifier) => modifier.sourceId === 'critical-strike-chance-bonus') &&
        entry.expectedValueModifiers.some((modifier) => modifier.sourceId === 'critical-strike-damage-bonus'),
      ),
    ).toBe(true);
  });
});

function simulateMeleeAttack(input: {
  buffs?: Parameters<typeof createMeleeConfig>[0]['buffs'];
  prayerIds?: string[];
} = {}) {
  return simulateBaseDamage(
    createMeleeConfig({
      abilities: { attack: BASIC_MELEE_ATTACK },
      buffs: input.buffs,
      persistentBuffConfig: {
        prayerIds: input.prayerIds ?? [],
      },
      abilityActions: [createAbilityAction('attack-1', 0, 'attack')],
      tickCount: 5,
    }),
  );
}

function createMeleeConfig(input: {
  abilities: Record<string, AbilityDefinition>;
  buffs?: Parameters<typeof createScenarioConfig>[0]['buffs'];
  items?: Record<string, ItemDefinition>;
  equipment?: Parameters<typeof createScenarioConfig>[0]['equipment'];
  persistentBuffConfig?: Parameters<typeof createScenarioConfig>[0]['persistentBuffConfig'];
  abilityActions: Parameters<typeof createScenarioConfig>[0]['abilityActions'];
  startingAdrenaline?: number;
  tickCount: number;
}) {
  return createScenarioConfig({
    abilities: input.abilities,
    buffs: input.buffs,
    items: {
      [MELEE_WEAPON.id]: MELEE_WEAPON,
      ...(input.items ?? {}),
    },
    equipment: input.equipment ?? {
      weapon: { instanceId: 'weapon-1', definitionId: MELEE_WEAPON.id },
    },
    persistentBuffConfig: input.persistentBuffConfig,
    abilityActions: input.abilityActions,
    startingAdrenaline: input.startingAdrenaline ?? 0,
    tickCount: input.tickCount,
  });
}

function enhancedGlovesOfPassage(): ItemDefinition {
  return {
    id: 'enhanced-gloves-of-passage',
    name: 'Enhanced gloves of passage',
    category: 'armor',
    slot: 'hands',
    combatStyleTags: ['melee'],
    effectRefs: [EFFECT_REF_IDS.glovesOfPassagePassive],
  };
}

function findModifierLabel(
  result: ReturnType<typeof simulateBaseDamage>,
  abilityId: string,
  sourceId: string,
): string | null {
  return result.explainability.damageBreakdowns
    .find((entry) => entry.abilityId === abilityId)
    ?.multiplicativeModifiers.find((modifier) => modifier.sourceId === sourceId)
    ?.label ?? null;
}

function dragonClawEofAbility(): AbilityDefinition {
  return createAbilityDefinition({
    id: 'dragon-claw-eof',
    name: 'Dragon claw (EOF)',
    style: 'melee',
    subtype: 'special',
    cooldownTicks: 0,
    adrenalineCost: 50,
    hitSchedule: [
      { id: 'dragon-claw-eof-hit-1', tickOffset: 0, damage: { min: 180, max: 220 } },
      { id: 'dragon-claw-eof-hit-2', tickOffset: 0, damage: { min: 90, max: 110 } },
      { id: 'dragon-claw-eof-hit-3', tickOffset: 0, damage: { min: 45, max: 55 } },
      { id: 'dragon-claw-eof-hit-4', tickOffset: 0, damage: { min: 45, max: 55 } },
    ],
    baseDamage: { min: 360, max: 440 },
  });
}

function varanusEofAbility(): AbilityDefinition {
  return createAbilityDefinition({
    id: 'varanuss-mercy-eof',
    name: "Varanus's Mercy (EOF)",
    style: 'melee',
    subtype: 'special',
    cooldownTicks: 0,
    adrenalineCost: 50,
    hitSchedule: [
      {
        id: 'varanuss-mercy-eof-hit-1',
        tickOffset: 0,
        damage: { min: 80, max: 100 },
        effectRefs: ['critical-strike-chance:+25%', 'critical-strike-damage:+25%'],
      },
      {
        id: 'varanuss-mercy-eof-hit-2',
        tickOffset: 0,
        damage: { min: 80, max: 100 },
        effectRefs: ['critical-strike-chance:+25%', 'critical-strike-damage:+25%'],
      },
      {
        id: 'varanuss-mercy-eof-hit-3',
        tickOffset: 0,
        damage: { min: 150, max: 180 },
        effectRefs: ['critical-strike-chance:+50%', 'critical-strike-damage:+50%'],
      },
    ],
    baseDamage: { min: 310, max: 380 },
  });
}
