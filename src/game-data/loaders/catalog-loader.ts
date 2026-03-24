import { normalizeById } from '../normalizers';
import {
  parseJsonDocument,
  validateAbilityDefinition,
  validateBuffDefinition,
  validateItemDefinition,
} from '../schemas';
import type {
  AbilityDefinition,
  BuffDefinition,
  EntityId,
  ItemDefinition,
  PerkDefinition,
  RelicDefinition,
} from '../types';
import type { SampleGameDataManifest } from './sample-manifest';

export interface GameDataCatalog {
  items: Record<EntityId, ItemDefinition>;
  ammo: Record<EntityId, never>;
  abilities: Record<EntityId, AbilityDefinition>;
  buffs: Record<EntityId, BuffDefinition>;
  perks: Record<EntityId, PerkDefinition>;
  relics: Record<EntityId, RelicDefinition>;
  eofSpecs: Record<EntityId, never>;
}

export interface GameDataLoadIssue {
  path: string;
  message: string;
}

export type GameDataLoadResult =
  | {
      success: true;
      data: GameDataCatalog;
      issues: GameDataLoadIssue[];
    }
  | {
      success: false;
      issues: GameDataLoadIssue[];
    };

export type TextFileLoader = (path: string) => Promise<string>;

async function loadDefinitions<T>(
  paths: readonly string[],
  loadText: TextFileLoader,
  validate: (
    input: unknown,
  ) => { success: true; data: T } | { success: false; errors: { path: string; message: string }[] },
): Promise<{ definitions: T[]; issues: GameDataLoadIssue[] }> {
  const definitions: T[] = [];
  const issues: GameDataLoadIssue[] = [];

  for (const path of paths) {
    try {
      const raw = await loadText(path);
      const parsed = parseJsonDocument(raw);
      const result = validate(parsed);

      if (!result.success) {
        issues.push(
          ...result.errors.map((error) => ({
            path: `${path}:${error.path}`,
            message: error.message,
          })),
        );
        continue;
      }

      definitions.push(result.data);
    } catch (error) {
      issues.push({
        path,
        message: error instanceof Error ? error.message : 'Unknown game-data loading error.',
      });
    }
  }

  return { definitions, issues };
}

export async function loadSampleGameData(
  manifest: SampleGameDataManifest,
  loadText: TextFileLoader,
): Promise<GameDataLoadResult> {
  const [itemLoad, abilityLoad, buffLoad] = await Promise.all([
    loadDefinitions(manifest.items, loadText, validateItemDefinition),
    loadDefinitions(manifest.abilities, loadText, validateAbilityDefinition),
    loadDefinitions(manifest.buffs, loadText, validateBuffDefinition),
  ]);

  const itemNormalization = normalizeById(itemLoad.definitions);
  const abilityNormalization = normalizeById(abilityLoad.definitions);
  const buffNormalization = normalizeById(buffLoad.definitions);

  const issues: GameDataLoadIssue[] = [
    ...itemLoad.issues,
    ...abilityLoad.issues,
    ...buffLoad.issues,
    ...itemNormalization.issues.map((issue) => ({
      path: `items:${issue.id}`,
      message: issue.message,
    })),
    ...abilityNormalization.issues.map((issue) => ({
      path: `abilities:${issue.id}`,
      message: issue.message,
    })),
    ...buffNormalization.issues.map((issue) => ({
      path: `buffs:${issue.id}`,
      message: issue.message,
    })),
  ];

  if (issues.length > 0) {
    return {
      success: false,
      issues,
    };
  }

  return {
    success: true,
    data: {
      items: itemNormalization.records,
      ammo: {},
      abilities: abilityNormalization.records,
      buffs: buffNormalization.records,
      perks: {},
      relics: {},
      eofSpecs: {},
    },
    issues: [],
  };
}
