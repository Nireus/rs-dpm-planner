import { describe, expect, it } from 'vitest';
import { sanitizePlayerStats, validatePlayerStats } from './player-stats';

describe('validatePlayerStats', () => {
  it('accepts valid combat and prayer levels', () => {
    expect(
      validatePlayerStats({
        attackLevel: 99,
        strengthLevel: 99,
        defenceLevel: 99,
        rangedLevel: 99,
        magicLevel: 99,
        necromancyLevel: 99,
        prayerLevel: 95,
      }),
    ).toEqual([]);
  });

  it('rejects out of range levels', () => {
    expect(
      validatePlayerStats({
        attackLevel: 0,
        strengthLevel: 121,
        defenceLevel: 0,
        rangedLevel: 0,
        magicLevel: 121,
        necromancyLevel: 0,
        prayerLevel: 121,
      }),
    ).toEqual([
      { field: 'attackLevel', message: 'Attack level must be between 1 and 120.' },
      { field: 'strengthLevel', message: 'Strength level must be between 1 and 120.' },
      { field: 'defenceLevel', message: 'Defence level must be between 1 and 120.' },
      { field: 'rangedLevel', message: 'Ranged level must be between 1 and 120.' },
      { field: 'magicLevel', message: 'Magic level must be between 1 and 120.' },
      { field: 'necromancyLevel', message: 'Necromancy level must be between 1 and 120.' },
      { field: 'prayerLevel', message: 'Prayer level must be between 1 and 99.' },
    ]);
  });

  it('rejects non-integer values', () => {
    expect(
      validatePlayerStats({
        attackLevel: 99,
        strengthLevel: 99,
        defenceLevel: 99,
        rangedLevel: 99.5,
        magicLevel: 99,
        necromancyLevel: 99,
        prayerLevel: 99,
      }),
    ).toEqual([{ field: 'rangedLevel', message: 'Ranged level must be a whole number.' }]);
  });
});

describe('sanitizePlayerStats', () => {
  it('clamps and rounds values into supported bounds', () => {
    expect(
      sanitizePlayerStats({
        attackLevel: undefined,
        strengthLevel: 125,
        defenceLevel: 0,
        rangedLevel: 125,
        magicLevel: 99.2,
        necromancyLevel: null as never,
        prayerLevel: 49.6,
      }),
    ).toEqual({
      attackLevel: 99,
      strengthLevel: 120,
      defenceLevel: 1,
      rangedLevel: 120,
      magicLevel: 99,
      necromancyLevel: 99,
      prayerLevel: 50,
    });
  });
});
