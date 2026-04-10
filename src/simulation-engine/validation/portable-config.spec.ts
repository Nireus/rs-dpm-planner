import {
  PORTABLE_CONFIG_SCHEMA_VERSION,
  createPortableConfigDocument,
  type PortableConfigDocumentV1,
} from '../models/portable-config';
import { parsePortableConfigDocument } from './portable-config';

describe('parsePortableConfigDocument', () => {
  it('parses a valid portable config document', () => {
    const document = createPortableConfigDocument({
      playerStats: {
        rangedLevel: 99,
      },
      gearSetup: {
        equipment: {},
      },
      inventory: {
        items: [],
      },
      persistentBuffConfig: {},
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 30,
        nonGcdActions: [],
        abilityActions: [],
      },
    });

    const result = parsePortableConfigDocument(document);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.schemaVersion).toBe(PORTABLE_CONFIG_SCHEMA_VERSION);
      expect(result.data.playerStats.rangedLevel).toBe(99);
      expect(result.data.combatChoices.magic.spellbookId).toBe('standard');
      expect(result.data.combatChoices.magic.activeSpellId).toBe('fire-surge');
      expect(result.data.simulationSettings.criticalHitResolutionMode).toBe('deterministic-accumulator');
      expect(result.data.playerStats.attackLevel).toBe(99);
      expect(result.data.playerStats.strengthLevel).toBe(99);
      expect(result.data.playerStats.defenceLevel).toBe(99);
      expect(result.data.playerStats.magicLevel).toBe(99);
      expect(result.data.playerStats.necromancyLevel).toBe(99);
      expect(result.data.playerStats.prayerLevel).toBe(99);
    }
  });

  it('fails with clear errors for invalid shape', () => {
    const result = parsePortableConfigDocument({
      schemaVersion: PORTABLE_CONFIG_SCHEMA_VERSION,
      playerStats: {},
      gearSetup: [],
      inventory: {},
      persistentBuffConfig: {},
      rotationPlan: {
        startingAdrenaline: 'zero',
      },
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.errors.map((error) => error.path)).toEqual(
        expect.arrayContaining([
          'playerStats.rangedLevel',
          'gearSetup',
          'inventory.items',
          'rotationPlan.startingAdrenaline',
          'rotationPlan.tickCount',
          'rotationPlan.nonGcdActions',
          'rotationPlan.abilityActions',
        ]),
      );
    }
  });

  it('rejects unsupported schema versions', () => {
    const result = parsePortableConfigDocument({
      schemaVersion: 999,
      playerStats: {
        rangedLevel: 99,
      },
      gearSetup: {
        equipment: {},
      },
      inventory: {
        items: [],
      },
      persistentBuffConfig: {},
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 30,
        nonGcdActions: [],
        abilityActions: [],
      },
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'unsupported-schema-version',
            path: 'schemaVersion',
          }),
        ]),
      );
    }
  });

  it('migrates legacy schemaVersion 1 documents to the current combat choices shape', () => {
    const result = parsePortableConfigDocument({
      schemaVersion: 1,
      playerStats: {
        rangedLevel: 99,
        magicLevel: 70,
      },
      gearSetup: {
        equipment: {},
      },
      inventory: {
        items: [],
      },
      persistentBuffConfig: {},
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 30,
        nonGcdActions: [],
        abilityActions: [],
      },
    } satisfies PortableConfigDocumentV1);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.schemaVersion).toBe(PORTABLE_CONFIG_SCHEMA_VERSION);
      expect(result.data.combatChoices.magic.spellbookId).toBe('standard');
      expect(result.data.combatChoices.magic.activeSpellId).toBe('earth-wave');
      expect(result.data.simulationSettings.criticalHitResolutionMode).toBe('deterministic-accumulator');
    }
  });

  it('parses configured simulation settings', () => {
    const document = createPortableConfigDocument({
      playerStats: {
        rangedLevel: 99,
      },
      gearSetup: {
        equipment: {},
      },
      inventory: {
        items: [],
      },
      persistentBuffConfig: {},
      rotationPlan: {
        startingAdrenaline: 0,
        tickCount: 30,
        nonGcdActions: [],
        abilityActions: [],
      },
      simulationSettings: {
        criticalHitResolutionMode: 'expected-value',
      },
    });

    const result = parsePortableConfigDocument(document);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.simulationSettings.criticalHitResolutionMode).toBe('expected-value');
    }
  });
});
