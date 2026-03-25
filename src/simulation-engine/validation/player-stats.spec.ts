import { describe, expect, it } from 'vitest';
import { sanitizePlayerStats, validatePlayerStats } from './player-stats';

describe('validatePlayerStats', () => {
  it('accepts valid ranged and prayer levels', () => {
    expect(
      validatePlayerStats({
        rangedLevel: 99,
        prayerLevel: 95,
      }),
    ).toEqual([]);
  });

  it('rejects out of range levels', () => {
    expect(
      validatePlayerStats({
        rangedLevel: 0,
        prayerLevel: 121,
      }),
    ).toEqual([
      { field: 'rangedLevel', message: 'Ranged level must be between 1 and 120.' },
      { field: 'prayerLevel', message: 'Prayer level must be between 1 and 99.' },
    ]);
  });

  it('rejects non-integer values', () => {
    expect(
      validatePlayerStats({
        rangedLevel: 99.5,
      }),
    ).toEqual([{ field: 'rangedLevel', message: 'Ranged level must be a whole number.' }]);
  });
});

describe('sanitizePlayerStats', () => {
  it('clamps and rounds values into supported bounds', () => {
    expect(
      sanitizePlayerStats({
        rangedLevel: 125,
        prayerLevel: 49.6,
      }),
    ).toEqual({
      rangedLevel: 120,
      prayerLevel: 50,
    });
  });
});
