import { normalizeById } from '../normalizers';
import {
  parseJsonDocument,
  validateAbilityDefinition,
  validateBuffDefinition,
  validateEofSpecDefinition,
  validateItemDefinition,
  validatePerkDefinition,
  validateRelicDefinition,
} from '../schemas';
import type {
  AbilityDefinition,
  BuffDefinition,
  EofSpecDefinition,
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
  eofSpecs: Record<EntityId, EofSpecDefinition>;
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
  const [itemLoad, abilityLoad, buffLoad, eofSpecLoad, perkLoad, relicLoad] = await Promise.all([
    loadDefinitions(manifest.items, loadText, validateItemDefinition),
    loadDefinitions(manifest.abilities, loadText, validateAbilityDefinition),
    loadDefinitions(manifest.buffs, loadText, validateBuffDefinition),
    loadDefinitions(manifest.eofSpecs, loadText, validateEofSpecDefinition),
    loadDefinitions(manifest.perks, loadText, validatePerkDefinition),
    loadDefinitions(manifest.relics, loadText, validateRelicDefinition),
  ]);

  const itemNormalization = normalizeById(itemLoad.definitions);
  const abilityNormalization = normalizeById(abilityLoad.definitions);
  const buffNormalization = normalizeById(buffLoad.definitions);
  const eofSpecNormalization = normalizeById(eofSpecLoad.definitions);
  const perkNormalization = normalizeById(perkLoad.definitions);
  const relicNormalization = normalizeById(relicLoad.definitions);

  const issues: GameDataLoadIssue[] = [
    ...itemLoad.issues,
    ...abilityLoad.issues,
    ...buffLoad.issues,
    ...eofSpecLoad.issues,
    ...perkLoad.issues,
    ...relicLoad.issues,
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
    ...eofSpecNormalization.issues.map((issue) => ({
      path: `eofSpecs:${issue.id}`,
      message: issue.message,
    })),
    ...perkNormalization.issues.map((issue) => ({
      path: `perks:${issue.id}`,
      message: issue.message,
    })),
    ...relicNormalization.issues.map((issue) => ({
      path: `relics:${issue.id}`,
      message: issue.message,
    })),
  ];

  const normalizedCatalog: GameDataCatalog = {
    items: itemNormalization.records,
    ammo: {},
    abilities: abilityNormalization.records,
    buffs: buffNormalization.records,
    perks: perkNormalization.records,
    relics: relicNormalization.records,
    eofSpecs: eofSpecNormalization.records,
  };

  issues.push(...validateCatalogReferences(normalizedCatalog));

  if (issues.length > 0) {
    return {
      success: false,
      issues,
    };
  }

  return {
    success: true,
    data: normalizedCatalog,
    issues: [],
  };
}

function validateCatalogReferences(catalog: GameDataCatalog): GameDataLoadIssue[] {
  const issues: GameDataLoadIssue[] = [];

  for (const item of Object.values(catalog.items)) {
    if (item.specialAbilityId && !catalog.abilities[item.specialAbilityId]) {
      issues.push({
        path: `items:${item.id}:specialAbilityId`,
        message: `Unknown ability "${item.specialAbilityId}" referenced by item "${item.id}".`,
      });
    }
  }

  for (const eofSpec of Object.values(catalog.eofSpecs)) {
    if (!catalog.abilities[eofSpec.abilityId]) {
      issues.push({
        path: `eofSpecs:${eofSpec.id}:abilityId`,
        message: `Unknown ability "${eofSpec.abilityId}" referenced by EOF spec "${eofSpec.id}".`,
      });
    }
  }

  for (const ability of Object.values(catalog.abilities)) {
    validateAbilityMechanicsReferences(catalog, ability, `abilities:${ability.id}`, issues);

    ability.variants?.forEach((variant, index) => {
      validateTimelineEffectsReferences(
        catalog,
        variant.timelineEffects,
        `abilities:${ability.id}:variants[${index}].timelineEffects`,
        issues,
      );
      validateStackEffectsReferences(
        catalog,
        variant.stackEffects,
        `abilities:${ability.id}:variants[${index}].stackEffects`,
        issues,
      );
    });
  }

  for (const buff of Object.values(catalog.buffs)) {
    buff.stackRules?.conditionalModifiers?.forEach((modifier, index) => {
      if (!catalog.buffs[modifier.whenBuffActive]) {
        issues.push({
          path: `buffs:${buff.id}:stackRules.conditionalModifiers[${index}].whenBuffActive`,
          message: `Unknown buff "${modifier.whenBuffActive}" referenced by buff "${buff.id}".`,
        });
      }
    });
  }

  return issues;
}

function validateAbilityMechanicsReferences(
  catalog: GameDataCatalog,
  ability: AbilityDefinition,
  pathPrefix: string,
  issues: GameDataLoadIssue[],
): void {
  validateTimelineEffectsReferences(catalog, ability.timelineEffects, `${pathPrefix}:timelineEffects`, issues);
  validateStackEffectsReferences(catalog, ability.stackEffects, `${pathPrefix}:stackEffects`, issues);
}

function validateTimelineEffectsReferences(
  catalog: GameDataCatalog,
  effects: AbilityDefinition['timelineEffects'],
  pathPrefix: string,
  issues: GameDataLoadIssue[],
): void {
  effects?.forEach((effect, index) => {
    const effectPath = `${pathPrefix}[${index}]`;

    if ('buffId' in effect && !catalog.buffs[effect.buffId]) {
      issues.push({
        path: `${effectPath}.buffId`,
        message: `Unknown buff "${effect.buffId}" referenced by timeline effect.`,
      });
      return;
    }

    if (effect.kind === 'apply-buff') {
      const buff = catalog.buffs[effect.buffId];
      if (!buff) {
        return;
      }

      if (effect.durationTicks === undefined && buff.durationTicks === undefined) {
        issues.push({
          path: effectPath,
          message: `Timeline apply-buff effect for "${effect.buffId}" must define durationTicks or point to a buff with durationTicks.`,
        });
      }
    }

    if (effect.kind === 'extend-buff') {
      if (effect.durationTicks === undefined && effect.durationFromAbility === undefined) {
        issues.push({
          path: effectPath,
          message: 'Timeline extend-buff effect must define durationTicks or durationFromAbility.',
        });
      }
    }

    if (effect.kind === 'grant-adrenaline') {
      if (effect.durationTicks === undefined && effect.durationFromAbility === undefined) {
        issues.push({
          path: effectPath,
          message: 'Timeline grant-adrenaline effect must define durationTicks or durationFromAbility.',
        });
      }
    }
  });
}

function validateStackEffectsReferences(
  catalog: GameDataCatalog,
  effects: AbilityDefinition['stackEffects'],
  pathPrefix: string,
  issues: GameDataLoadIssue[],
): void {
  effects?.forEach((effect, index) => {
    const buff = catalog.buffs[effect.buffId];
    if (!buff) {
      issues.push({
        path: `${pathPrefix}[${index}].buffId`,
        message: `Unknown buff "${effect.buffId}" referenced by stack effect.`,
      });
      return;
    }

    if (!buff.stackRules) {
      issues.push({
        path: `${pathPrefix}[${index}].buffId`,
        message: `Stack effect references "${effect.buffId}", but that buff does not define stackRules.`,
      });
    }
  });
}
