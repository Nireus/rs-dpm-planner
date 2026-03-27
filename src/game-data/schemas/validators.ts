import type {
  AbilityDefinition,
  BuffDefinition,
  EofSpecDefinition,
  ItemDefinition,
  PerkDefinition,
  RelicDefinition,
} from '../types';
import { isRecognizedEffectRef, isRecognizedRequirementTag } from '../conventions/mechanics';

export type GameDataValidationError = {
  path: string;
  message: string;
};

export type GameDataValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: GameDataValidationError[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function pushError(
  errors: GameDataValidationError[],
  path: string,
  message: string,
): void {
  errors.push({ path, message });
}

export function parseJsonDocument(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}

function validateDefinitionBase(
  input: unknown,
  kind: 'item' | 'ability' | 'buff' | 'eof spec' | 'perk' | 'relic',
): GameDataValidationError[] {
  const errors: GameDataValidationError[] = [];

  if (!isRecord(input)) {
    pushError(errors, '$', `${kind} definition must be an object.`);
    return errors;
  }

  if (typeof input['id'] !== 'string') {
    pushError(errors, 'id', 'Expected "id" to be a string.');
  }

  if (typeof input['name'] !== 'string') {
    pushError(errors, 'name', 'Expected "name" to be a string.');
  }

  const effectRefs = input['effectRefs'];
  if (effectRefs !== undefined && !isStringArray(effectRefs)) {
    pushError(errors, 'effectRefs', 'Expected "effectRefs" to be an array of strings.');
  } else if (Array.isArray(effectRefs)) {
    effectRefs.forEach((effectRef, index) => {
      if (!isRecognizedEffectRef(effectRef)) {
        pushError(errors, `effectRefs[${index}]`, `Unrecognized effect ref "${effectRef}".`);
      }
    });
  }

  return errors;
}

export function validateItemDefinition(input: unknown): GameDataValidationResult<ItemDefinition> {
  const errors = validateDefinitionBase(input, 'item');

  if (!isRecord(input)) {
    return { success: false, errors };
  }

  if (typeof input['category'] !== 'string') {
    pushError(errors, 'category', 'Expected "category" to be a string.');
  }

  const combatStyleTags = input['combatStyleTags'];
  if (!isStringArray(combatStyleTags)) {
    pushError(errors, 'combatStyleTags', 'Expected "combatStyleTags" to be an array of strings.');
  }

  const dyeVariantIconPaths = input['dyeVariantIconPaths'];
  if (dyeVariantIconPaths !== undefined && !isStringRecord(dyeVariantIconPaths)) {
    pushError(errors, 'dyeVariantIconPaths', 'Expected "dyeVariantIconPaths" to be an object of string values.');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input as unknown as ItemDefinition };
}

export function validateAbilityDefinition(
  input: unknown,
): GameDataValidationResult<AbilityDefinition> {
  const errors = validateDefinitionBase(input, 'ability');

  if (!isRecord(input)) {
    return { success: false, errors };
  }

  if (typeof input['style'] !== 'string') {
    pushError(errors, 'style', 'Expected "style" to be a string.');
  }

  if (typeof input['subtype'] !== 'string') {
    pushError(errors, 'subtype', 'Expected "subtype" to be a string.');
  }

  if (typeof input['cooldownTicks'] !== 'number') {
    pushError(errors, 'cooldownTicks', 'Expected "cooldownTicks" to be a number.');
  }

  if (!Array.isArray(input['hitSchedule'])) {
    pushError(errors, 'hitSchedule', 'Expected "hitSchedule" to be an array.');
  }

  if (!isRecord(input['baseDamage'])) {
    pushError(errors, 'baseDamage', 'Expected "baseDamage" to be an object.');
  }

  const requiredEquipmentTags = input['requiredEquipmentTags'];
  if (requiredEquipmentTags !== undefined && !isStringArray(requiredEquipmentTags)) {
    pushError(errors, 'requiredEquipmentTags', 'Expected "requiredEquipmentTags" to be an array of strings.');
  } else if (Array.isArray(requiredEquipmentTags)) {
    requiredEquipmentTags.forEach((tag, index) => {
      if (!isRecognizedRequirementTag(tag)) {
        pushError(errors, `requiredEquipmentTags[${index}]`, `Unrecognized requirement tag "${tag}".`);
      }
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input as unknown as AbilityDefinition };
}

export function validateBuffDefinition(input: unknown): GameDataValidationResult<BuffDefinition> {
  const errors = validateDefinitionBase(input, 'buff');

  if (!isRecord(input)) {
    return { success: false, errors };
  }

  if (typeof input['category'] !== 'string') {
    pushError(errors, 'category', 'Expected "category" to be a string.');
  }

  if (typeof input['sourceType'] !== 'string') {
    pushError(errors, 'sourceType', 'Expected "sourceType" to be a string.');
  }

  if (input['iconPath'] !== undefined && typeof input['iconPath'] !== 'string') {
    pushError(errors, 'iconPath', 'Expected "iconPath" to be a string when present.');
  }

  if (input['variantNames'] !== undefined && !isStringArray(input['variantNames'])) {
    pushError(errors, 'variantNames', 'Expected "variantNames" to be an array of strings when present.');
  }

  if (
    input['durationTicks'] !== undefined &&
    typeof input['durationTicks'] !== 'number'
  ) {
    pushError(errors, 'durationTicks', 'Expected "durationTicks" to be a number when present.');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input as unknown as BuffDefinition };
}

export function validatePerkDefinition(input: unknown): GameDataValidationResult<PerkDefinition> {
  const errors = validateDefinitionBase(input, 'perk');

  if (!isRecord(input)) {
    return { success: false, errors };
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input as unknown as PerkDefinition };
}

export function validateRelicDefinition(input: unknown): GameDataValidationResult<RelicDefinition> {
  const errors = validateDefinitionBase(input, 'relic');

  if (!isRecord(input)) {
    return { success: false, errors };
  }

  if (input['iconPath'] !== undefined && typeof input['iconPath'] !== 'string') {
    pushError(errors, 'iconPath', 'Expected "iconPath" to be a string when present.');
  }

  if (input['wikiUrl'] !== undefined && typeof input['wikiUrl'] !== 'string') {
    pushError(errors, 'wikiUrl', 'Expected "wikiUrl" to be a string when present.');
  }

  if (input['monolithEnergy'] !== undefined && typeof input['monolithEnergy'] !== 'number') {
    pushError(errors, 'monolithEnergy', 'Expected "monolithEnergy" to be a number when present.');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input as unknown as RelicDefinition };
}

export function validateEofSpecDefinition(
  input: unknown,
): GameDataValidationResult<EofSpecDefinition> {
  const errors = validateDefinitionBase(input, 'eof spec');

  if (!isRecord(input)) {
    return { success: false, errors };
  }

  if (typeof input['weaponOrigin'] !== 'string') {
    pushError(errors, 'weaponOrigin', 'Expected "weaponOrigin" to be a string.');
  }

  if (typeof input['adrenalineCost'] !== 'number') {
    pushError(errors, 'adrenalineCost', 'Expected "adrenalineCost" to be a number.');
  }

  if (!Array.isArray(input['hitSchedule'])) {
    pushError(errors, 'hitSchedule', 'Expected "hitSchedule" to be an array.');
  }

  if (!isRecord(input['baseDamage'])) {
    pushError(errors, 'baseDamage', 'Expected "baseDamage" to be an object.');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input as unknown as EofSpecDefinition };
}
