import { describe, expect, it } from 'vitest';

import type { ItemDefinition } from '../../../game-data/types';
import { simulateBaseDamage } from '../../../simulation-engine/calculators';
import {
  createAbilityAction,
  createAbilityDefinition,
  createScenarioConfig,
} from '../../../simulation-engine/test/scenario-test-helpers';
import {
  buildPlannerValidationBannerEntries,
  buildBloodlustSpendMarkersByAction,
  buildInstabilityProcMarkersByAction,
  describeInvalidAbilityPlacement,
  buildPerfectEquilibriumProcMarkersByAction,
  buildPlacedAbilityMarkerLeft,
  PERFECT_EQUILIBRIUM_ICON_PATH,
} from './rotation-planner-page.helpers';

const MELEE_WEAPON: ItemDefinition = {
  id: 'abyssal-scourge',
  name: 'Abyssal scourge',
  category: 'weapon',
  slot: 'weapon',
  combatStyleTags: ['melee'],
  tier: 95,
  offensiveStats: {
    damageTier: 95,
    meleeBonus: 98,
  },
};

describe('rotation planner page helpers', () => {
  it('uses the Perfect Equilibrium status artwork for proc markers', () => {
    expect(PERFECT_EQUILIBRIUM_ICON_PATH).toBe('/icons/wiki/perfect-equilibrium-self-status.png');
  });

  it('labels pre-fight validation warnings by visible tiles instead of hidden gap ticks', () => {
    const entries = buildPlannerValidationBannerEntries({
      issues: [
        {
          code: 'ability.unavailable',
          severity: 'error',
          tick: -21,
          relatedActionId: 'prebuild-piercing',
          message: 'Piercing Shot requires a ranged weapon.',
        },
        {
          code: 'pre_fight.stall_channelled_ability',
          severity: 'error',
          tick: -12,
          relatedActionId: 'stall-galeshot',
          message: 'Galeshot cannot be stalled.',
        },
      ],
      abilityActions: [],
      nonGcdActions: [],
      abilityCatalog: {
        'piercing-shot': createAbilityDefinition({
          id: 'piercing-shot',
          name: 'Piercing Shot',
          style: 'ranged',
          subtype: 'basic',
          cooldownTicks: 3,
          adrenalineGain: 9,
          hitSchedule: [{ id: 'piercing-hit', tickOffset: 0, damage: { min: 100, max: 100 } }],
          baseDamage: { min: 100, max: 100 },
        }),
        galeshot: createAbilityDefinition({
          id: 'galeshot',
          name: 'Galeshot',
          style: 'ranged',
          subtype: 'basic',
          cooldownTicks: 3,
          adrenalineGain: 9,
          hitSchedule: [{ id: 'galeshot-hit', tickOffset: 0, damage: { min: 100, max: 100 } }],
          baseDamage: { min: 100, max: 100 },
        }),
      },
      preFight: {
        gapTicks: 12,
        prebuildActions: [{ id: 'prebuild-piercing', abilityId: 'piercing-shot' }],
        stalledAbility: { id: 'stall-galeshot', abilityId: 'galeshot' },
      },
    });

    expect(entries.map((entry) => [entry.tickLabel, entry.actionLabel])).toEqual([
      ['T-6', 'Prebuild: Piercing Shot'],
      ['T-3', 'Ability Stall: Galeshot'],
    ]);
  });

  it('centers placed ability markers on the tick tile axis', () => {
    const action = createAbilityAction('assault-action', 9, 'assault');
    const definition = createAbilityDefinition({
      id: 'assault',
      name: 'Assault',
      style: 'melee',
      subtype: 'enhanced',
      cooldownTicks: 10,
      adrenalineCost: 25,
      hitSchedule: [],
      baseDamage: { min: 0, max: 0 },
    });

    expect(buildPlacedAbilityMarkerLeft(action, { tickOffset: 0, indexAtTick: 0 }, definition)).toBe(
      'calc(0 * (2.18rem + 0.42rem) + 0.73rem + (0 * 0.52rem))',
    );
  });

  it('keeps Perfect Equilibrium markers on the resolved proc tick even when it lands after a channel tile span', () => {
    const action = createAbilityAction('rapid-fire-action', 37, 'rapid-fire');
    const rapidFire = createAbilityDefinition({
      id: 'rapid-fire',
      name: 'Rapid Fire',
      style: 'ranged',
      subtype: 'enhanced',
      cooldownTicks: 34,
      adrenalineCost: 25,
      isChanneled: true,
      channelDurationTicks: 9,
      hitSchedule: Array.from({ length: 8 }, (_, index) => ({
        id: `rapid-fire-hit-${index + 1}`,
        tickOffset: index,
        damage: { min: 75, max: 85 },
      })),
      baseDamage: { min: 600, max: 680 },
      displayHints: {
        hitTickMode: 'resolved',
      },
    });

    const markersByAction = buildPerfectEquilibriumProcMarkersByAction(
      {
        isValid: true,
        validationIssues: [],
        totalDamage: { min: 0, avg: 0, max: 0 },
        damageByAbility: [],
        damageByTick: {},
        adrenalineTimeline: [],
        buffTimeline: {},
        timelineGeneratedBuffSources: [],
        cooldownTimeline: {},
        tickStates: [],
        explainability: {
          damageBreakdowns: [
            {
              abilityId: 'perfect-equilibrium',
              hitId: 'rapid-fire-action:perfect-equilibrium:rapid-fire-hit-8',
              tick: 44,
              baseDamage: { min: 0, avg: 0, max: 0 },
              additiveModifiers: [],
              multiplicativeModifiers: [],
              expectedValueModifiers: [],
              finalDamage: { min: 0, avg: 0, max: 0 },
            },
          ],
        },
      },
      [action],
      {
        'rapid-fire': rapidFire,
      },
    );

    expect(markersByAction).toEqual({
      'rapid-fire-action': [
        {
          tickOffset: 7,
          indexAtTick: 0,
        },
      ],
    });
    expect(
      buildPlacedAbilityMarkerLeft(
        action,
        markersByAction['rapid-fire-action'][0],
        rapidFire,
      ),
    ).toBe('calc(7 * (2.18rem + 0.42rem) + 0.73rem + (0 * 0.52rem))');
  });

  it('builds a Bloodlust spend marker when a spender consumes 4 stacks', () => {
    const abilityActions = [
      createAbilityAction('attack-action-1', 0, 'attack'),
      createAbilityAction('rend-action', 3, 'rend'),
      createAbilityAction('attack-action-2', 6, 'attack'),
      createAbilityAction('assault-action', 9, 'assault'),
    ];
    const result = simulateBaseDamage(
      createScenarioConfig({
        abilities: {
          attack: createAbilityDefinition({
            id: 'attack',
            name: 'Attack',
            style: 'melee',
            subtype: 'basic',
            cooldownTicks: 3,
            adrenalineGain: 9,
            hitSchedule: [{ id: 'attack-hit-1', tickOffset: 0, damage: { min: 110, max: 130 } }],
            baseDamage: { min: 110, max: 130 },
            stackEffects: [{ buffId: 'bloodlust', operation: 'add', stacks: 1 }],
          }),
          rend: createAbilityDefinition({
            id: 'rend',
            name: 'Rend',
            style: 'melee',
            subtype: 'basic',
            cooldownTicks: 17,
            adrenalineGain: 9,
            hitSchedule: [{ id: 'rend-hit-1', tickOffset: 0, damage: { min: 135, max: 165 } }],
            baseDamage: { min: 135, max: 165 },
            stackEffects: [{ buffId: 'bloodlust', operation: 'add', stacks: 2 }],
          }),
          assault: createAbilityDefinition({
            id: 'assault',
            name: 'Assault',
            style: 'melee',
            subtype: 'enhanced',
            cooldownTicks: 10,
            adrenalineCost: 25,
            hitSchedule: [
              { id: 'assault-hit-1', tickOffset: 1, damage: { min: 130, max: 150 } },
              { id: 'assault-hit-2', tickOffset: 3, damage: { min: 130, max: 150 } },
            ],
            baseDamage: { min: 260, max: 300 },
            stackEffects: [{ buffId: 'bloodlust', operation: 'spend', stacks: 4 }],
          }),
        },
        items: {
          [MELEE_WEAPON.id]: MELEE_WEAPON,
        },
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: MELEE_WEAPON.id,
          },
        },
        abilityActions,
        startingAdrenaline: 100,
        tickCount: 12,
      }),
    );

    expect(buildBloodlustSpendMarkersByAction(result, abilityActions, {
      attack: createAbilityDefinition({
        id: 'attack',
        name: 'Attack',
        style: 'melee',
        subtype: 'basic',
        cooldownTicks: 3,
        adrenalineGain: 9,
        hitSchedule: [{ id: 'attack-hit-1', tickOffset: 0, damage: { min: 110, max: 130 } }],
        baseDamage: { min: 110, max: 130 },
        stackEffects: [{ buffId: 'bloodlust', operation: 'add', stacks: 1 }],
      }),
      rend: createAbilityDefinition({
        id: 'rend',
        name: 'Rend',
        style: 'melee',
        subtype: 'basic',
        cooldownTicks: 17,
        adrenalineGain: 9,
        hitSchedule: [{ id: 'rend-hit-1', tickOffset: 0, damage: { min: 135, max: 165 } }],
        baseDamage: { min: 135, max: 165 },
        stackEffects: [{ buffId: 'bloodlust', operation: 'add', stacks: 2 }],
      }),
      assault: createAbilityDefinition({
        id: 'assault',
        name: 'Assault',
        style: 'melee',
        subtype: 'enhanced',
        cooldownTicks: 10,
        adrenalineCost: 25,
        hitSchedule: [
          { id: 'assault-hit-1', tickOffset: 1, damage: { min: 130, max: 150 } },
          { id: 'assault-hit-2', tickOffset: 3, damage: { min: 130, max: 150 } },
        ],
        baseDamage: { min: 260, max: 300 },
        stackEffects: [{ buffId: 'bloodlust', operation: 'spend', stacks: 4 }],
      }),
    })).toEqual({
      'assault-action': [
        {
          tickOffset: 0,
          indexAtTick: 0,
        },
      ],
    });
  });

  it('builds Instability proc markers from Lightning Surge damage breakdowns', () => {
    const action = createAbilityAction('magic-action', 6, 'magic');
    const magic = createAbilityDefinition({
      id: 'magic',
      name: 'Magic',
      style: 'magic',
      cooldownTicks: 3,
      adrenalineGain: 8,
      hitSchedule: [{ id: 'magic-hit', tickOffset: 0, damage: { min: 95, max: 105 } }],
      baseDamage: { min: 95, max: 105 },
      displayHints: {
        hitTickMode: 'resolved',
      },
    });

    const markersByAction = buildInstabilityProcMarkersByAction(
      {
        isValid: true,
        validationIssues: [],
        totalDamage: { min: 0, avg: 0, max: 0 },
        damageByAbility: [],
        damageByTick: {},
        adrenalineTimeline: [],
        buffTimeline: {},
        timelineGeneratedBuffSources: [],
        cooldownTimeline: {},
        tickStates: [],
        explainability: {
          damageBreakdowns: [
            {
              abilityId: 'lightning-surge',
              hitId: 'magic-action:lightning-surge:magic-hit',
              tick: 7,
              baseDamage: { min: 0, avg: 0, max: 0 },
              additiveModifiers: [],
              multiplicativeModifiers: [],
              expectedValueModifiers: [],
              finalDamage: { min: 0, avg: 0, max: 0 },
              derivedParts: {
                procEfficacy: 1,
              },
            },
          ],
        },
      },
      [action],
      {
        magic,
      },
    );

    expect(markersByAction).toEqual({
      'magic-action': [
        {
          tickOffset: 0,
          indexAtTick: 0,
        },
      ],
    });
  });

  it('does not mark a Bloodlust spender when not enough stacks were available', () => {
    const abilityActions = [
      createAbilityAction('attack-action-1', 0, 'attack'),
      createAbilityAction('assault-action', 3, 'assault'),
    ];
    const result = simulateBaseDamage(
      createScenarioConfig({
        abilities: {
          attack: createAbilityDefinition({
            id: 'attack',
            name: 'Attack',
            style: 'melee',
            subtype: 'basic',
            cooldownTicks: 3,
            adrenalineGain: 9,
            hitSchedule: [{ id: 'attack-hit-1', tickOffset: 0, damage: { min: 110, max: 130 } }],
            baseDamage: { min: 110, max: 130 },
            stackEffects: [{ buffId: 'bloodlust', operation: 'add', stacks: 1 }],
          }),
          assault: createAbilityDefinition({
            id: 'assault',
            name: 'Assault',
            style: 'melee',
            subtype: 'enhanced',
            cooldownTicks: 10,
            adrenalineCost: 25,
            hitSchedule: [
              { id: 'assault-hit-1', tickOffset: 1, damage: { min: 130, max: 150 } },
              { id: 'assault-hit-2', tickOffset: 3, damage: { min: 130, max: 150 } },
            ],
            baseDamage: { min: 260, max: 300 },
            stackEffects: [{ buffId: 'bloodlust', operation: 'spend', stacks: 4 }],
          }),
        },
        items: {
          [MELEE_WEAPON.id]: MELEE_WEAPON,
        },
        equipment: {
          weapon: {
            instanceId: 'weapon-1',
            definitionId: MELEE_WEAPON.id,
          },
        },
        abilityActions,
        startingAdrenaline: 100,
        tickCount: 6,
      }),
    );

    expect(buildBloodlustSpendMarkersByAction(result, abilityActions, {
      attack: createAbilityDefinition({
        id: 'attack',
        name: 'Attack',
        style: 'melee',
        subtype: 'basic',
        cooldownTicks: 3,
        adrenalineGain: 9,
        hitSchedule: [{ id: 'attack-hit-1', tickOffset: 0, damage: { min: 110, max: 130 } }],
        baseDamage: { min: 110, max: 130 },
        stackEffects: [{ buffId: 'bloodlust', operation: 'add', stacks: 1 }],
      }),
      assault: createAbilityDefinition({
        id: 'assault',
        name: 'Assault',
        style: 'melee',
        subtype: 'enhanced',
        cooldownTicks: 10,
        adrenalineCost: 25,
        hitSchedule: [
          { id: 'assault-hit-1', tickOffset: 1, damage: { min: 130, max: 150 } },
          { id: 'assault-hit-2', tickOffset: 3, damage: { min: 130, max: 150 } },
        ],
        baseDamage: { min: 260, max: 300 },
        stackEffects: [{ buffId: 'bloodlust', operation: 'spend', stacks: 4 }],
      }),
    })).toEqual({});
  });

  it('describes magic weapon availability failures in user-facing planner copy', () => {
    expect(
      describeInvalidAbilityPlacement('Sunshine', {
        code: 'ability.unavailable',
        message: 'Sunshine: Requires a magic weapon in the main hand slot.',
      }),
    ).toBe('Sunshine requires a magic weapon at that tick.');
  });
});
