import { describe, expect, it } from 'vitest';
import {
  activateExclusivePotion,
  buildBuffOptions,
  buildMiscellaneousBuffOptions,
  buildSummonOptions,
  buildTimelineGeneratedBuffOptions,
  calculateRelicEnergy,
  canActivateRelicWithinCap,
  isConfigurableBuffCategory,
  toggleSelectionId,
} from './buffs-selection.utils';

describe('buffs-selection utils', () => {
  it('treats prayer, potion, passive, and miscellaneous as configurable pre-fight buffs', () => {
    expect(isConfigurableBuffCategory('prayer')).toBe(true);
    expect(isConfigurableBuffCategory('potion')).toBe(true);
    expect(isConfigurableBuffCategory('passive')).toBe(true);
    expect(isConfigurableBuffCategory('miscellaneous')).toBe(true);
    expect(isConfigurableBuffCategory('temporary')).toBe(false);
  });

  it('builds miscellaneous configurable buff options', () => {
    const options = buildMiscellaneousBuffOptions([
      {
        id: 'warped-gem',
        name: 'Warped gem',
        category: 'miscellaneous',
        sourceType: 'player-config',
        effectRefs: ['warped-gem-special-cost-reduction'],
      },
    ]);

    expect(options.map((option) => option.id)).toEqual(['warped-gem']);
    expect(options[0]?.categoryLabel).toBe('Miscellaneous');
    expect(options[0]?.description).toBe('Manual passive utility modifier.');
  });

  it('builds summon options separately from generic configurable buffs', () => {
    const definitions = [
      {
        id: 'kalgerion-demon',
        name: "Kal'gerion demon",
        category: 'summon' as const,
        sourceType: 'player-config' as const,
        effectRefs: ['critical-strike-chance:+6%'],
      },
    ];

    expect(buildBuffOptions(definitions)).toEqual([]);
    const summons = buildSummonOptions(definitions);
    expect(summons[0]).toMatchObject({
      id: 'kalgerion-demon',
      categoryLabel: 'Summon',
      kind: 'buff',
    });
  });

  it('toggles ids in and out of the active selection', () => {
    expect(toggleSelectionId([], 'desolation')).toEqual(['desolation']);
    expect(toggleSelectionId(['desolation'], 'desolation')).toEqual([]);
  });

  it('filters out temporary buffs from configurable options', () => {
    const options = buildBuffOptions([
      {
        id: 'feasting-spores-ready',
        name: 'Feasting Spores',
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
        id: 'feasting-spores-ready',
        name: 'Feasting Spores',
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

    expect(options.map((option) => option.id)).toEqual(['feasting-spores-ready']);
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
