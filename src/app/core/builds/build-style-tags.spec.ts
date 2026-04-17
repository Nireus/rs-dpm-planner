import { describe, expect, it } from 'vitest';
import type { GameDataCatalog } from '../../../game-data/loaders';
import type { AbilityDefinition } from '../../../game-data/types';
import type { RotationPlan } from '../../../simulation-engine/models';
import { deriveBuildStyleTagsFromRotation, normalizeBuildStyleTags } from './build-style-tags';

const ABILITIES: Record<string, AbilityDefinition> = {
  'piercing-shot': {
    id: 'piercing-shot',
    name: 'Piercing Shot',
    style: 'ranged',
    subtype: 'basic',
    cooldownTicks: 0,
    hitSchedule: [],
    baseDamage: { min: 50, max: 100 },
  },
  'dragon-breath': {
    id: 'dragon-breath',
    name: 'Dragon Breath',
    style: 'magic',
    subtype: 'basic',
    cooldownTicks: 0,
    hitSchedule: [],
    baseDamage: { min: 50, max: 100 },
  },
};

const CATALOG = {
  abilities: ABILITIES,
} as Pick<GameDataCatalog, 'abilities'>;

describe('build style tags', () => {
  it('derives single style tags from used abilities', () => {
    expect(deriveBuildStyleTagsFromRotation(createRotation(['piercing-shot']), CATALOG)).toEqual(['ranged']);
  });

  it('adds hybrid when multiple combat styles are used', () => {
    expect(deriveBuildStyleTagsFromRotation(createRotation(['piercing-shot', 'dragon-breath']), CATALOG)).toEqual([
      'ranged',
      'magic',
      'hybrid',
    ]);
  });

  it('normalizes user-selected public build style tags', () => {
    expect(normalizeBuildStyleTags(['hybrid', 'unknown', 'magic', 'magic'])).toEqual(['magic', 'hybrid']);
  });
});

function createRotation(abilityIds: string[]): RotationPlan {
  return {
    startingAdrenaline: 100,
    tickCount: 30,
    startingStacks: {},
    nonGcdActions: [],
    abilityActions: abilityIds.map((abilityId, index) => ({
      id: `ability-${index}`,
      tick: index * 3,
      lane: 'ability',
      actionType: 'ability-use',
      payload: { abilityId },
    })),
  };
}
