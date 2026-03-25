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
      'src/game-data/items/wen-arrows.sample.json',
      'src/game-data/items/jas-dragonbane-arrows.sample.json',
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

  it('parses and validates sample ability JSON', () => {
    const document = readJson('src/game-data/abilities/rapid-fire.sample.json');
    const result = validateAbilityDefinition(document);

    expect(result.success).toBe(true);
  });

  it('parses and validates sample buff JSON', () => {
    const document = readJson('src/game-data/buffs/deathspore-focus.sample.json');
    const result = validateBuffDefinition(document);

    expect(result.success).toBe(true);
  });

  it('parses and validates sample EOF spec JSON', () => {
    const document = readJson('src/game-data/eof-specs/dark-bow-eof.sample.json');
    const result = validateEofSpecDefinition(document);

    expect(result.success).toBe(true);
  });

  it('parses and validates sample perk JSON', () => {
    const document = readJson('src/game-data/perks/equilibrium.sample.json');
    const result = validatePerkDefinition(document);

    expect(result.success).toBe(true);
  });

  it('parses and validates sample relic JSON', () => {
    const document = readJson('src/game-data/relics/fury-of-the-small.sample.json');
    const result = validateRelicDefinition(document);

    expect(result.success).toBe(true);
  });
});
