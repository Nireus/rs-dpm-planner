import { describe, expect, it } from 'vitest';
import {
  activateExclusivePotion,
  buildBuffOptions,
  buildTimelineGeneratedBuffOptions,
  calculateRelicEnergy,
  canActivateRelicWithinCap,
  isConfigurableBuffCategory,
  toggleSelectionId,
} from './buffs-selection.utils';

describe('buffs-selection utils', () => {
  it('treats only prayer, potion, and passive as configurable pre-fight buffs', () => {
    expect(isConfigurableBuffCategory('prayer')).toBe(true);
    expect(isConfigurableBuffCategory('potion')).toBe(true);
    expect(isConfigurableBuffCategory('passive')).toBe(true);
    expect(isConfigurableBuffCategory('temporary')).toBe(false);
  });

  it('toggles ids in and out of the active selection', () => {
    expect(toggleSelectionId([], 'desolation')).toEqual(['desolation']);
    expect(toggleSelectionId(['desolation'], 'desolation')).toEqual([]);
  });

  it('filters out temporary buffs from configurable options', () => {
    const options = buildBuffOptions([
      {
        id: 'deathspore-focus',
        name: 'Deathspore Focus',
        category: 'temporary',
        sourceType: 'item',
      },
      {
        id: 'desolation',
        name: 'Desolation',
        category: 'prayer',
        sourceType: 'player-config',
      },
    ]);

    expect(options.map((option) => option.id)).toEqual(['desolation']);
  });

  it('separates timeline-generated buffs from pre-fight options', () => {
    const options = buildTimelineGeneratedBuffOptions([
      {
        id: 'deathspore-focus',
        name: 'Deathspore Focus',
        category: 'temporary',
        sourceType: 'item',
      },
      {
        id: 'desolation',
        name: 'Desolation',
        category: 'prayer',
        sourceType: 'player-config',
      },
    ]);

    expect(options.map((option) => option.id)).toEqual(['deathspore-focus']);
    expect(options[0]?.kind).toBe('timeline-generated');
  });

  it('keeps only one potion buff active at a time', () => {
    const nextIds = activateExclusivePotion(
      ['overload-tier-15-3', 'desolation'],
      [
        { id: 'overload-tier-15-3', name: 'Overload', kind: 'buff', categoryLabel: 'Potion', description: '' },
        { id: 'overload-tier-17-5', name: 'Elder overload', kind: 'buff', categoryLabel: 'Potion', description: '' },
      ],
      'overload-tier-17-5',
    );

    expect(nextIds).toEqual(['desolation', 'overload-tier-17-5']);
  });

  it('calculates relic energy and blocks activations beyond the cap', () => {
    const relicOptions = [
      { id: 'fury-of-the-small', name: 'Fury', kind: 'relic' as const, categoryLabel: 'Relic', description: '', resourceCost: 150 },
      { id: 'berserkers-fury', name: 'Berserker', kind: 'relic' as const, categoryLabel: 'Relic', description: '', resourceCost: 250 },
      { id: 'conservation-of-energy', name: 'CoE', kind: 'relic' as const, categoryLabel: 'Relic', description: '', resourceCost: 350 },
    ];

    expect(calculateRelicEnergy(['fury-of-the-small', 'berserkers-fury'], relicOptions)).toBe(400);
    expect(canActivateRelicWithinCap(['fury-of-the-small', 'berserkers-fury'], relicOptions, 'conservation-of-energy', 650)).toBe(false);
    expect(canActivateRelicWithinCap(['fury-of-the-small'], relicOptions, 'berserkers-fury', 650)).toBe(true);
  });
});
