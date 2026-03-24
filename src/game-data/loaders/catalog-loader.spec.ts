import { loadSampleGameData } from './catalog-loader';
import type { SampleGameDataManifest } from './sample-manifest';

describe('loadSampleGameData', () => {
  it('loads and normalizes sample definitions', async () => {
    const manifest: SampleGameDataManifest = {
      items: ['/items/bolg.json'],
      abilities: ['/abilities/rapid-fire.json'],
      buffs: ['/buffs/deathspore-focus.json'],
      perks: [],
      relics: [],
    };

    const documents: Record<string, string> = {
      '/items/bolg.json': JSON.stringify({
        id: 'bolg',
        name: 'Bow of the Last Guardian',
        category: 'weapon',
        combatStyleTags: ['ranged'],
      }),
      '/abilities/rapid-fire.json': JSON.stringify({
        id: 'rapid-fire',
        name: 'Rapid Fire',
        style: 'ranged',
        subtype: 'threshold',
        cooldownTicks: 17,
        hitSchedule: [],
        baseDamage: {
          min: 60,
          max: 120,
        },
      }),
      '/buffs/deathspore-focus.json': JSON.stringify({
        id: 'deathspore-focus',
        name: 'Deathspore Focus',
        category: 'temporary',
        sourceType: 'item',
      }),
    };

    const result = await loadSampleGameData(manifest, async (path) => documents[path] ?? '');

    expect(result.success).toBe(true);

    if (result.success) {
      expect(Object.keys(result.data.items)).toEqual(['bolg']);
      expect(Object.keys(result.data.abilities)).toEqual(['rapid-fire']);
      expect(Object.keys(result.data.buffs)).toEqual(['deathspore-focus']);
    }
  });

  it('returns clean load issues when a document is invalid', async () => {
    const manifest: SampleGameDataManifest = {
      items: ['/items/bad.json'],
      abilities: [],
      buffs: [],
      perks: [],
      relics: [],
    };

    const result = await loadSampleGameData(
      manifest,
      async () =>
        JSON.stringify({
          id: 'bad-item',
          name: 'Bad Item',
          category: 123,
          combatStyleTags: 'ranged',
        }),
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining(['/items/bad.json:category', '/items/bad.json:combatStyleTags']),
      );
    }
  });
});
