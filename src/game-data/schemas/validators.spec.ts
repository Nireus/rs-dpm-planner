import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseJsonDocument,
  validateAbilityDefinition,
  validateBuffDefinition,
  validateItemDefinition,
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
});
