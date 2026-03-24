import { normalizeById } from './definitions';

describe('normalizeById', () => {
  it('creates a lookup map keyed by id', () => {
    const result = normalizeById([
      { id: 'bolg', name: 'Bow of the Last Guardian' },
      { id: 'rapid-fire', name: 'Rapid Fire' },
    ]);

    expect(result.records['bolg']?.name).toBe('Bow of the Last Guardian');
    expect(result.records['rapid-fire']?.name).toBe('Rapid Fire');
    expect(result.issues).toEqual([]);
  });

  it('reports duplicate ids', () => {
    const result = normalizeById([
      { id: 'bolg', name: 'Original' },
      { id: 'bolg', name: 'Duplicate' },
    ]);

    expect(result.records['bolg']?.name).toBe('Original');
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'duplicate-id',
        id: 'bolg',
      }),
    ]);
  });
});
