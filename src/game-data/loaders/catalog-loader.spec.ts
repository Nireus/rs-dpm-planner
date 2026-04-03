import { loadBundledGameData, loadSampleGameData } from './catalog-loader';
import type { SampleGameDataManifest } from './sample-manifest';

describe('loadSampleGameData', () => {
  it('loads and normalizes sample definitions', async () => {
    const manifest: SampleGameDataManifest = {
      items: ['/items/bolg.json'],
      abilities: ['/abilities/rapid-fire.json', '/abilities/dark-bow-eof.json'],
      buffs: ['/buffs/feasting-spores-ready.json'],
      eofSpecs: ['/eof-specs/dark-bow.json'],
      perks: ['/perks/precise.json'],
      relics: ['/relics/fury-of-the-small.json'],
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
        subtype: 'enhanced',
        cooldownTicks: 17,
        hitSchedule: [],
        baseDamage: {
          min: 60,
          max: 120,
        },
      }),
      '/abilities/dark-bow-eof.json': JSON.stringify({
        id: 'dark-bow-eof',
        name: 'Dark Bow (EOF)',
        style: 'ranged',
        subtype: 'special',
        cooldownTicks: 0,
        adrenalineCost: 25,
        hitSchedule: [],
        baseDamage: {
          min: 180,
          max: 300,
        },
        displayHints: {
          hiddenFromUi: true,
        },
      }),
      '/buffs/feasting-spores-ready.json': JSON.stringify({
        id: 'feasting-spores-ready',
        name: 'Feasting Spores',
        category: 'temporary',
        sourceType: 'item',
      }),
      '/eof-specs/dark-bow.json': JSON.stringify({
        id: 'dark-bow-eof',
        name: 'Dark Bow (EOF)',
        weaponOrigin: 'dark-bow',
        abilityId: 'dark-bow-eof',
      }),
      '/perks/precise.json': JSON.stringify({
        id: 'precise',
        name: 'Precise',
      }),
      '/relics/fury-of-the-small.json': JSON.stringify({
        id: 'fury-of-the-small',
        name: 'Fury of the Small',
      }),
    };

    const result = await loadSampleGameData(manifest, async (path) => documents[path] ?? '');

    expect(result.success).toBe(true);

    if (result.success) {
      expect(Object.keys(result.data.items)).toEqual(['bolg']);
      expect(Object.keys(result.data.abilities)).toEqual(['rapid-fire', 'dark-bow-eof']);
      expect(Object.keys(result.data.buffs)).toEqual(['feasting-spores-ready']);
      expect(Object.keys(result.data.eofSpecs)).toEqual(['dark-bow-eof']);
      expect(Object.keys(result.data.perks)).toEqual(['precise']);
      expect(Object.keys(result.data.relics)).toEqual(['fury-of-the-small']);
    }
  });

  it('returns clean load issues when a document is invalid', async () => {
    const manifest: SampleGameDataManifest = {
      items: ['/items/bad.json'],
      abilities: [],
      buffs: [],
      eofSpecs: [],
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

  it('returns clean load issues when combat styles are unknown', async () => {
    const manifest: SampleGameDataManifest = {
      items: ['/items/bad-style-item.json'],
      abilities: ['/abilities/bad-style-ability.json'],
      buffs: [],
      eofSpecs: [],
      perks: [],
      relics: [],
    };

    const documents: Record<string, string> = {
      '/items/bad-style-item.json': JSON.stringify({
        id: 'bad-style-item',
        name: 'Bad Style Item',
        category: 'weapon',
        combatStyleTags: ['alchemy'],
      }),
      '/abilities/bad-style-ability.json': JSON.stringify({
        id: 'bad-style-ability',
        name: 'Bad Style Ability',
        style: 'alchemy',
        subtype: 'basic',
        cooldownTicks: 3,
        hitSchedule: [],
        baseDamage: {
          min: 0,
          max: 0,
        },
      }),
    };

    const result = await loadSampleGameData(manifest, async (path) => documents[path] ?? '');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([
          '/items/bad-style-item.json:combatStyleTags[0]',
          '/abilities/bad-style-ability.json:style',
        ]),
      );
    }
  });
});

describe('loadBundledGameData', () => {
  it('loads a bundled catalog document and keeps JSON-backed presentation metadata', () => {
    const result = loadBundledGameData({
      items: [{
        id: 'bolg',
        name: 'Bow of the Last Guardian',
        category: 'weapon',
        combatStyleTags: ['ranged'],
      }],
      abilities: [{
        id: 'rapid-fire',
        name: 'Rapid Fire',
        iconPath: '/icons/wiki/rapid-fire.png',
        hoverSummary: 'Enhanced | 34 ticks | 8 hits | -25% adrenaline',
        detailLines: ['8-hit channeled attack.'],
        wikiUrl: 'https://runescape.wiki/w/Rapid_Fire',
        style: 'ranged',
        subtype: 'enhanced',
        cooldownTicks: 17,
        hitSchedule: [],
        baseDamage: {
          min: 60,
          max: 120,
        },
      }],
      buffs: [{
        id: 'feasting-spores-ready',
        name: 'Feasting Spores',
        category: 'temporary',
        sourceType: 'item',
      }],
      eofSpecs: [],
      perks: [{
        id: 'precise',
        name: 'Precise',
        maxRank: 6,
        shortCode: 'P',
      }],
      relics: [{
        id: 'fury-of-the-small',
        name: 'Fury of the Small',
      }],
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.abilities['rapid-fire'].iconPath).toBe('/icons/wiki/rapid-fire.png');
      expect(result.data.abilities['rapid-fire'].detailLines).toEqual(['8-hit channeled attack.']);
      expect(result.data.perks['precise'].maxRank).toBe(6);
      expect(result.data.perks['precise'].shortCode).toBe('P');
    }
  });
});
