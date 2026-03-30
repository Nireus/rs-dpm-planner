import { describe, expect, it } from 'vitest';

import { resolveDeterministicMeleeTimeline } from './melee-deterministic';
import {
  createAbilityAction,
  createAbilityDefinition,
  createScenarioConfig,
} from '../test/scenario-test-helpers';

describe('resolveDeterministicMeleeTimeline', () => {
  it('tracks Bloodlust stacks through Rend, Berserk, doubled basics, and a spender', () => {
    const result = resolveDeterministicMeleeTimeline(
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
            stackEffects: [
              {
                buffId: 'bloodlust',
                operation: 'add',
                stacks: 1,
              },
            ],
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
            stackEffects: [
              {
                buffId: 'bloodlust',
                operation: 'add',
                stacks: 2,
              },
            ],
          }),
          berserk: createAbilityDefinition({
            id: 'berserk',
            name: 'Berserk',
            style: 'melee',
            subtype: 'ultimate',
            cooldownTicks: 100,
            adrenalineCost: 100,
            hitSchedule: [],
            baseDamage: { min: 0, max: 0 },
            timelineEffects: [
              {
                kind: 'apply-buff',
                buffId: 'berserk-buff',
              },
            ],
            stackEffects: [
              {
                buffId: 'bloodlust',
                operation: 'add',
                stacks: 2,
              },
            ],
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
            stackEffects: [
              {
                buffId: 'bloodlust',
                operation: 'spend',
                stacks: 4,
              },
            ],
          }),
        },
        buffs: {
          'berserk-buff': {
            id: 'berserk-buff',
            name: 'Berserk',
            category: 'temporary',
            sourceType: 'ability',
            durationTicks: 33,
          },
          bloodlust: {
            id: 'bloodlust',
            name: 'Bloodlust',
            category: 'temporary',
            sourceType: 'ability',
            stackRules: {
              maxStacks: 4,
              conditionalModifiers: [
                {
                  whenBuffActive: 'berserk-buff',
                  maxStacks: 8,
                  gainMultiplier: 2,
                },
              ],
            },
          },
        },
        abilityActions: [
          createAbilityAction('attack-action-1', 0, 'attack'),
          createAbilityAction('rend-action', 3, 'rend'),
          createAbilityAction('berserk-action', 6, 'berserk'),
          createAbilityAction('attack-action-2', 9, 'attack'),
          createAbilityAction('assault-action', 12, 'assault'),
        ],
        startingAdrenaline: 100,
        tickCount: 14,
      }),
    );

    const bloodlustCountAt = (tick: number) =>
      (result.buffTimeline[tick] ?? []).filter((buffId) => buffId === 'bloodlust').length;

    expect(bloodlustCountAt(0)).toBe(1);
    expect(bloodlustCountAt(2)).toBe(1);
    expect(bloodlustCountAt(3)).toBe(3);
    expect(bloodlustCountAt(5)).toBe(3);
    expect(bloodlustCountAt(6)).toBe(7);
    expect(bloodlustCountAt(8)).toBe(7);
    expect(bloodlustCountAt(9)).toBe(8);
    expect(bloodlustCountAt(12)).toBe(4);
    expect(result.timelineGeneratedBuffSources).toContainEqual({
      buffId: 'bloodlust',
      sourceType: 'event',
    });
  });
});
