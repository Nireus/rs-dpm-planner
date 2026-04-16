import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseJsonDocument,
  validateAbilityDefinition,
  validateBuffDefinition,
  validateEofSpecDefinition,
  validateItemDefinition,
  validatePerkDefinition,
  validateRelicDefinition,
} from './validators';

function readJson(relativePath: string): unknown {
  const raw = readFileSync(join(process.cwd(), relativePath), 'utf8');
  return parseJsonDocument(raw);
}

describe('game-data sample JSON validation', () => {
  it('parses and validates sample item JSON', () => {
    const document = readJson('src/game-data/items/bolg.sample.json');
    const result = validateItemDefinition(document);

    expect(result.success).toBe(true);
  });

  it('parses and validates additional phase 11.1 item samples', () => {
    const itemPaths = [
      'src/game-data/items/masterwork-bow.sample.json',
      'src/game-data/items/masterwork-ranged-cowl.sample.json',
      'src/game-data/items/masterwork-ranged-body.sample.json',
      'src/game-data/items/wen-arrows.sample.json',
      'src/game-data/items/jas-dragonbane-arrows.sample.json',
      'src/game-data/items/gloomfire-bow.sample.json',
      'src/game-data/items/dracolich-hauberk.sample.json',
      'src/game-data/items/dracolich-vambraces.sample.json',
      'src/game-data/items/elite-dracolich-vambraces.sample.json',
      'src/game-data/items/sirenic-hauberk.sample.json',
      'src/game-data/items/elite-sirenic-hauberk.sample.json',
    ];

    for (const itemPath of itemPaths) {
      const document = readJson(itemPath);
      const result = validateItemDefinition(document);

      expect(result.success, itemPath).toBe(true);
    }
  });

  it('parses and validates melee BIS item, buff, ability, EOF, and perk samples', () => {
    const checks = [
      [validateItemDefinition, 'src/game-data/items/nodon-spike-harness.sample.json'],
      [validateItemDefinition, 'src/game-data/items/dragon-battleaxe.sample.json'],
      [validateBuffDefinition, 'src/game-data/buffs/malevolence.sample.json'],
      [validateBuffDefinition, 'src/game-data/buffs/turmoil.sample.json'],
      [validateBuffDefinition, 'src/game-data/buffs/rampage.sample.json'],
      [validateAbilityDefinition, 'src/game-data/abilities/rampage.sample.json'],
      [validateAbilityDefinition, 'src/game-data/abilities/dragon-claw-eof.sample.json'],
      [validateAbilityDefinition, 'src/game-data/abilities/varanuss-mercy-eof.sample.json'],
      [validateEofSpecDefinition, 'src/game-data/eof-specs/dragon-claw-eof.sample.json'],
      [validateEofSpecDefinition, 'src/game-data/eof-specs/varanuss-mercy-eof.sample.json'],
      [validatePerkDefinition, 'src/game-data/perks/ruthless.sample.json'],
    ] as const;

    for (const [validator, path] of checks) {
      const document = readJson(path);
      const result = validator(document);

      expect(result.success, path).toBe(true);
    }
  });

  it('includes melee stored special options on Essence of Finality', () => {
    const document = readJson('src/game-data/items/essence-of-finality.sample.json');
    const result = validateItemDefinition(document);

    expect(result.success).toBe(true);
    if (result.success) {
      const storedSpecial = result.data.configOptions?.find((option) => option.id === 'stored-special');
      expect(storedSpecial?.options).toEqual(expect.arrayContaining(['dragon-claw', 'varanuss-mercy']));
    }
  });

  it('parses and validates sample ability JSON', () => {
    const document = readJson('src/game-data/abilities/rapid-fire.sample.json');
    const result = validateAbilityDefinition(document);

    expect(result.success).toBe(true);
  });

  it('parses and validates sample buff JSON', () => {
    const document = readJson('src/game-data/buffs/feasting-spores-ready.sample.json');
    const result = validateBuffDefinition(document);

    expect(result.success).toBe(true);
  });

  it('parses and validates sample EOF spec JSON', () => {
    const document = readJson('src/game-data/eof-specs/dark-bow-eof.sample.json');
    const result = validateEofSpecDefinition(document);

    expect(result.success).toBe(true);
  });

  it('parses and validates additional EOF spec JSON', () => {
    const document = readJson('src/game-data/eof-specs/gloomfire-bow-eof.sample.json');
    const result = validateEofSpecDefinition(document);

    expect(result.success).toBe(true);
  });

  it('parses and validates sample perk JSON', () => {
    const document = readJson('src/game-data/perks/precise.sample.json');
    const result = validatePerkDefinition(document);

    expect(result.success).toBe(true);
  });

  it('parses and validates sample relic JSON', () => {
    const document = readJson('src/game-data/relics/fury-of-the-small.sample.json');
    const result = validateRelicDefinition(document);

    expect(result.success).toBe(true);
  });

  it('rejects unknown effect refs', () => {
    const result = validateBuffDefinition({
      id: 'bad-buff',
      name: 'Bad Buff',
      category: 'temporary',
      sourceType: 'ability',
      effectRefs: ['totally-unknown-effect'],
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'effectRefs[0]',
          }),
        ]),
      );
    }
  });

  it('accepts supported parameterized effect refs and requirement tags', () => {
    const result = validateAbilityDefinition({
      id: 'sample-ability',
      name: 'Sample Ability',
      style: 'ranged',
      subtype: 'special',
      cooldownTicks: 0,
      baseDamage: {
        min: 100,
        max: 120,
      },
      hitSchedule: [],
      effectRefs: ['weapon-special:sample-special', 'critical-strike-chance:+100%', 'magic-critical-hit-adrenaline:+8%'],
      requires: {
        requiredEquipmentTags: ['equipped-effect:weapon-special-access', 'melee-dual-wield'],
        blockedEquipmentTags: ['ranged-two-handed'],
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts supported hit-scoped effect refs', () => {
    const result = validateAbilityDefinition({
      id: 'sample-hit-effects',
      name: 'Sample Hit Effects',
      style: 'melee',
      subtype: 'special',
      cooldownTicks: 0,
      baseDamage: {
        min: 100,
        max: 120,
      },
      hitSchedule: [
        {
          id: 'sample-hit',
          tickOffset: 0,
          damage: {
            min: 100,
            max: 120,
          },
          effectRefs: ['critical-strike-chance:+25%', 'critical-strike-damage:+25%'],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('accepts supported planner placement lanes', () => {
    const result = validateAbilityDefinition({
      id: 'sample-utility',
      name: 'Sample Utility',
      style: 'magic',
      subtype: 'utility',
      cooldownTicks: 50,
      baseDamage: {
        min: 0,
        max: 0,
      },
      hitSchedule: [],
      plannerPlacement: {
        allowedLanes: ['non-gcd'],
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects unknown planner placement lanes', () => {
    const result = validateAbilityDefinition({
      id: 'bad-utility',
      name: 'Bad Utility',
      style: 'magic',
      subtype: 'utility',
      cooldownTicks: 50,
      baseDamage: {
        min: 0,
        max: 0,
      },
      hitSchedule: [],
      plannerPlacement: {
        allowedLanes: ['sideways'],
      },
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'plannerPlacement.allowedLanes[0]',
          }),
        ]),
      );
    }
  });

  it('rejects unknown nested requirement tags', () => {
    const result = validateAbilityDefinition({
      id: 'bad-ability',
      name: 'Bad Ability',
      style: 'melee',
      subtype: 'basic',
      cooldownTicks: 0,
      baseDamage: {
        min: 100,
        max: 120,
      },
      hitSchedule: [],
      requires: {
        requiredEquipmentTags: ['not-a-real-tag'],
      },
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'requires.requiredEquipmentTags[0]',
          }),
        ]),
      );
    }
  });
});
