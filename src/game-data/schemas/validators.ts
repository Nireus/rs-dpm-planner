import type {
  AbilityDefinition,
  BuffDefinition,
  EofSpecDefinition,
  ItemDefinition,
  PerkDefinition,
  RelicDefinition,
} from '../types';
import { isRecognizedCombatStyle } from '../conventions/combat-styles';
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

function isRequirementSet(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
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
  } else {
    combatStyleTags.forEach((style, index) => {
      if (!isRecognizedCombatStyle(style)) {
        pushError(errors, `combatStyleTags[${index}]`, `Unrecognized combat style "${style}".`);
      }
    });
  }

  const dyeVariantIconPaths = input['dyeVariantIconPaths'];
  if (dyeVariantIconPaths !== undefined && !isStringRecord(dyeVariantIconPaths)) {
    pushError(errors, 'dyeVariantIconPaths', 'Expected "dyeVariantIconPaths" to be an object of string values.');
  }

  if (input['wikiUrl'] !== undefined && typeof input['wikiUrl'] !== 'string') {
    pushError(errors, 'wikiUrl', 'Expected "wikiUrl" to be a string when present.');
  }

  if (input['specialAbilityId'] !== undefined && typeof input['specialAbilityId'] !== 'string') {
    pushError(errors, 'specialAbilityId', 'Expected "specialAbilityId" to be a string when present.');
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
  } else if (!isRecognizedCombatStyle(input['style'])) {
    pushError(errors, 'style', `Unrecognized combat style "${input['style']}".`);
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

  validateRequirementTags(errors, input['requires'], 'requires');
  validateSpecialDispatch(errors, input['specialDispatch'], 'specialDispatch');
  validateAbilityVariants(errors, input['variants'], 'variants');
  validateTimelineEffects(errors, input['timelineEffects'], 'timelineEffects');
  validateStackEffects(errors, input['stackEffects'], 'stackEffects');
  validateDisplayHints(errors, input['displayHints'], 'displayHints');

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

  validateStackRules(errors, input['stackRules'], 'stackRules');

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

  if (input['iconPath'] !== undefined && typeof input['iconPath'] !== 'string') {
    pushError(errors, 'iconPath', 'Expected "iconPath" to be a string when present.');
  }

  if (input['wikiUrl'] !== undefined && typeof input['wikiUrl'] !== 'string') {
    pushError(errors, 'wikiUrl', 'Expected "wikiUrl" to be a string when present.');
  }

  if (input['maxRank'] !== undefined && typeof input['maxRank'] !== 'number') {
    pushError(errors, 'maxRank', 'Expected "maxRank" to be a number when present.');
  }

  if (input['shortCode'] !== undefined && typeof input['shortCode'] !== 'string') {
    pushError(errors, 'shortCode', 'Expected "shortCode" to be a string when present.');
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

  if (typeof input['abilityId'] !== 'string') {
    pushError(errors, 'abilityId', 'Expected "abilityId" to be a string.');
  }

  validateRequirementTags(errors, input['requires'], 'requires');

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input as unknown as EofSpecDefinition };
}

function validateRequirementTags(
  errors: GameDataValidationError[],
  requiresValue: unknown,
  pathPrefix: string,
): void {
  if (requiresValue === undefined) {
    return;
  }

  if (!isRequirementSet(requiresValue)) {
    pushError(errors, pathPrefix, `Expected "${pathPrefix}" to be an object.`);
    return;
  }

  const requiredEquipmentTags = requiresValue['requiredEquipmentTags'];
  if (requiredEquipmentTags !== undefined && !isStringArray(requiredEquipmentTags)) {
    pushError(
      errors,
      `${pathPrefix}.requiredEquipmentTags`,
      'Expected "requiredEquipmentTags" to be an array of strings.',
    );
  } else if (Array.isArray(requiredEquipmentTags)) {
    requiredEquipmentTags.forEach((tag, index) => {
      if (!isRecognizedRequirementTag(tag)) {
        pushError(
          errors,
          `${pathPrefix}.requiredEquipmentTags[${index}]`,
          `Unrecognized requirement tag "${tag}".`,
        );
      }
    });
  }

  const blockedEquipmentTags = requiresValue['blockedEquipmentTags'];
  if (blockedEquipmentTags !== undefined && !isStringArray(blockedEquipmentTags)) {
    pushError(
      errors,
      `${pathPrefix}.blockedEquipmentTags`,
      'Expected "blockedEquipmentTags" to be an array of strings.',
    );
  } else if (Array.isArray(blockedEquipmentTags)) {
    blockedEquipmentTags.forEach((tag, index) => {
      if (!isRecognizedRequirementTag(tag)) {
        pushError(
          errors,
          `${pathPrefix}.blockedEquipmentTags[${index}]`,
          `Unrecognized requirement tag "${tag}".`,
        );
      }
    });
  }
}

function validateSpecialDispatch(
  errors: GameDataValidationError[],
  dispatchValue: unknown,
  pathPrefix: string,
): void {
  if (dispatchValue === undefined) {
    return;
  }

  if (!isRecord(dispatchValue)) {
    pushError(errors, pathPrefix, `Expected "${pathPrefix}" to be an object.`);
    return;
  }

  const source = dispatchValue['source'];
  if (source !== 'equipped-weapon' && source !== 'equipped-eof') {
    pushError(
      errors,
      `${pathPrefix}.source`,
      'Expected "source" to be "equipped-weapon" or "equipped-eof".',
    );
  }
}

function validateAbilityVariants(
  errors: GameDataValidationError[],
  variantsValue: unknown,
  pathPrefix: string,
): void {
  if (variantsValue === undefined) {
    return;
  }

  if (!Array.isArray(variantsValue)) {
    pushError(errors, pathPrefix, `Expected "${pathPrefix}" to be an array.`);
    return;
  }

  const seenConditionPriority = new Map<string, number>();
  let highestUnconditionalPriority: number | null = null;

  variantsValue.forEach((entry, index) => {
    const variantPath = `${pathPrefix}[${index}]`;
    if (!isRecord(entry)) {
      pushError(errors, variantPath, 'Expected variant entry to be an object.');
      return;
    }

    if (typeof entry['id'] !== 'string') {
      pushError(errors, `${variantPath}.id`, 'Expected "id" to be a string.');
    }

    const priority = entry['priority'];
    if (priority !== undefined && typeof priority !== 'number') {
      pushError(errors, `${variantPath}.priority`, 'Expected "priority" to be a number when present.');
    }

    validateRequirementTags(errors, entry['when'], `${variantPath}.when`);
    validateTimelineEffects(errors, entry['timelineEffects'], `${variantPath}.timelineEffects`);
    validateStackEffects(errors, entry['stackEffects'], `${variantPath}.stackEffects`);
    validateDisplayHints(errors, entry['displayHints'], `${variantPath}.displayHints`);

    const normalizedPriority = typeof priority === 'number' ? priority : 0;
    const conditionKey = entry['when'] === undefined ? '__unconditional__' : JSON.stringify(entry['when']);

    const previousPriority = seenConditionPriority.get(conditionKey);
    if (previousPriority !== undefined && previousPriority >= normalizedPriority) {
      pushError(
        errors,
        variantPath,
        'Variant is shadowed by an earlier variant with the same condition and higher or equal priority.',
      );
    } else {
      seenConditionPriority.set(conditionKey, normalizedPriority);
    }

    if (entry['when'] === undefined) {
      if (highestUnconditionalPriority !== null && highestUnconditionalPriority >= normalizedPriority) {
        pushError(
          errors,
          variantPath,
          'Variant is unreachable because an earlier unconditional variant already wins at higher or equal priority.',
        );
      } else {
        highestUnconditionalPriority = normalizedPriority;
      }
    }
  });
}

function validateTimelineEffects(
  errors: GameDataValidationError[],
  effectsValue: unknown,
  pathPrefix: string,
): void {
  if (effectsValue === undefined) {
    return;
  }

  if (!Array.isArray(effectsValue)) {
    pushError(errors, pathPrefix, `Expected "${pathPrefix}" to be an array.`);
    return;
  }

  effectsValue.forEach((entry, index) => {
    const effectPath = `${pathPrefix}[${index}]`;
    if (!isRecord(entry)) {
      pushError(errors, effectPath, 'Expected timeline effect to be an object.');
      return;
    }

    const kind = entry['kind'];
    if (kind !== 'apply-buff' && kind !== 'extend-buff' && kind !== 'grant-adrenaline') {
      pushError(
        errors,
        `${effectPath}.kind`,
        'Expected "kind" to be "apply-buff", "extend-buff", or "grant-adrenaline".',
      );
      return;
    }

    if (kind === 'apply-buff') {
      if (typeof entry['buffId'] !== 'string') {
        pushError(errors, `${effectPath}.buffId`, 'Expected "buffId" to be a string.');
      }
      if (entry['startTickOffset'] !== undefined && typeof entry['startTickOffset'] !== 'number') {
        pushError(errors, `${effectPath}.startTickOffset`, 'Expected "startTickOffset" to be a number when present.');
      }
      if (entry['durationTicks'] !== undefined && typeof entry['durationTicks'] !== 'number') {
        pushError(errors, `${effectPath}.durationTicks`, 'Expected "durationTicks" to be a number when present.');
      }
      if (entry['endsOnWeaponSwap'] !== undefined && !isBoolean(entry['endsOnWeaponSwap'])) {
        pushError(errors, `${effectPath}.endsOnWeaponSwap`, 'Expected "endsOnWeaponSwap" to be a boolean when present.');
      }
      validateTimelineEffectDurationBonuses(
        errors,
        entry['conditionalDurationBonuses'],
        `${effectPath}.conditionalDurationBonuses`,
      );
      return;
    }

    if (kind === 'extend-buff') {
      if (typeof entry['buffId'] !== 'string') {
        pushError(errors, `${effectPath}.buffId`, 'Expected "buffId" to be a string.');
      }
      if (entry['requiresActive'] !== undefined && !isBoolean(entry['requiresActive'])) {
        pushError(errors, `${effectPath}.requiresActive`, 'Expected "requiresActive" to be a boolean when present.');
      }
      if (entry['durationTicks'] !== undefined && typeof entry['durationTicks'] !== 'number') {
        pushError(errors, `${effectPath}.durationTicks`, 'Expected "durationTicks" to be a number when present.');
      }
      if (
        entry['durationFromAbility'] !== undefined &&
        entry['durationFromAbility'] !== 'hit-count' &&
        entry['durationFromAbility'] !== 'channel-duration' &&
        entry['durationFromAbility'] !== 'max-hit-count-or-channel-duration'
      ) {
        pushError(
          errors,
          `${effectPath}.durationFromAbility`,
          'Expected "durationFromAbility" to be "hit-count", "channel-duration", or "max-hit-count-or-channel-duration".',
        );
      }
      if (entry['bonusTicks'] !== undefined && typeof entry['bonusTicks'] !== 'number') {
        pushError(errors, `${effectPath}.bonusTicks`, 'Expected "bonusTicks" to be a number when present.');
      }
      return;
    }

    if (typeof entry['amount'] !== 'number') {
      pushError(errors, `${effectPath}.amount`, 'Expected "amount" to be a number.');
    }
    if (entry['timing'] !== 'per-tick-window') {
      pushError(errors, `${effectPath}.timing`, 'Expected "timing" to be "per-tick-window".');
    }
    if (entry['startTickOffset'] !== undefined && typeof entry['startTickOffset'] !== 'number') {
      pushError(errors, `${effectPath}.startTickOffset`, 'Expected "startTickOffset" to be a number when present.');
    }
    if (entry['durationTicks'] !== undefined && typeof entry['durationTicks'] !== 'number') {
      pushError(errors, `${effectPath}.durationTicks`, 'Expected "durationTicks" to be a number when present.');
    }
    if (
      entry['durationFromAbility'] !== undefined &&
      entry['durationFromAbility'] !== 'channel-duration'
    ) {
      pushError(
        errors,
        `${effectPath}.durationFromAbility`,
        'Expected "durationFromAbility" to be "channel-duration" when present.',
      );
    }
    if (
      entry['requiresWeaponStyle'] !== undefined &&
      (typeof entry['requiresWeaponStyle'] !== 'string' || !isRecognizedCombatStyle(entry['requiresWeaponStyle']))
    ) {
      pushError(
        errors,
        `${effectPath}.requiresWeaponStyle`,
        'Expected "requiresWeaponStyle" to be a recognized combat style when present.',
      );
    }
  });
}

function validateTimelineEffectDurationBonuses(
  errors: GameDataValidationError[],
  bonusesValue: unknown,
  pathPrefix: string,
): void {
  if (bonusesValue === undefined) {
    return;
  }

  if (!Array.isArray(bonusesValue)) {
    pushError(errors, pathPrefix, `Expected "${pathPrefix}" to be an array.`);
    return;
  }

  bonusesValue.forEach((entry, index) => {
    const bonusPath = `${pathPrefix}[${index}]`;
    if (!isRecord(entry)) {
      pushError(errors, bonusPath, 'Expected duration bonus to be an object.');
      return;
    }

    const requiredEquippedEffect = entry['requiredEquippedEffect'];
    if (typeof requiredEquippedEffect !== 'string') {
      pushError(errors, `${bonusPath}.requiredEquippedEffect`, 'Expected "requiredEquippedEffect" to be a string.');
    } else if (!isRecognizedEffectRef(requiredEquippedEffect)) {
      pushError(
        errors,
        `${bonusPath}.requiredEquippedEffect`,
        `Unrecognized effect ref "${requiredEquippedEffect}".`,
      );
    }

    if (entry['minCount'] !== undefined && typeof entry['minCount'] !== 'number') {
      pushError(errors, `${bonusPath}.minCount`, 'Expected "minCount" to be a number when present.');
    }

    if (typeof entry['bonusTicks'] !== 'number') {
      pushError(errors, `${bonusPath}.bonusTicks`, 'Expected "bonusTicks" to be a number.');
    }
  });
}

function validateStackEffects(
  errors: GameDataValidationError[],
  effectsValue: unknown,
  pathPrefix: string,
): void {
  if (effectsValue === undefined) {
    return;
  }

  if (!Array.isArray(effectsValue)) {
    pushError(errors, pathPrefix, `Expected "${pathPrefix}" to be an array.`);
    return;
  }

  effectsValue.forEach((entry, index) => {
    const effectPath = `${pathPrefix}[${index}]`;
    if (!isRecord(entry)) {
      pushError(errors, effectPath, 'Expected stack effect to be an object.');
      return;
    }

    if (typeof entry['buffId'] !== 'string') {
      pushError(errors, `${effectPath}.buffId`, 'Expected "buffId" to be a string.');
    }

    if (entry['operation'] !== 'add' && entry['operation'] !== 'spend') {
      pushError(errors, `${effectPath}.operation`, 'Expected "operation" to be "add" or "spend".');
    }

    if (typeof entry['stacks'] !== 'number') {
      pushError(errors, `${effectPath}.stacks`, 'Expected "stacks" to be a number.');
    }
  });
}

function validateDisplayHints(
  errors: GameDataValidationError[],
  hintsValue: unknown,
  pathPrefix: string,
): void {
  if (hintsValue === undefined) {
    return;
  }

  if (!isRecord(hintsValue)) {
    pushError(errors, pathPrefix, `Expected "${pathPrefix}" to be an object.`);
    return;
  }

  if (
    hintsValue['hitTickMode'] !== undefined &&
    hintsValue['hitTickMode'] !== 'cast' &&
    hintsValue['hitTickMode'] !== 'resolved'
  ) {
    pushError(errors, `${pathPrefix}.hitTickMode`, 'Expected "hitTickMode" to be "cast" or "resolved".');
  }

  ['hitCountLabel', 'damageRangeLabel', 'hitScheduleSummary', 'hoverSummary'].forEach((key) => {
    if (hintsValue[key] !== undefined && typeof hintsValue[key] !== 'string') {
      pushError(errors, `${pathPrefix}.${key}`, `Expected "${key}" to be a string when present.`);
    }
  });

  if (hintsValue['hiddenFromUi'] !== undefined && !isBoolean(hintsValue['hiddenFromUi'])) {
    pushError(errors, `${pathPrefix}.hiddenFromUi`, 'Expected "hiddenFromUi" to be a boolean when present.');
  }
}

function validateStackRules(
  errors: GameDataValidationError[],
  stackRulesValue: unknown,
  pathPrefix: string,
): void {
  if (stackRulesValue === undefined) {
    return;
  }

  if (!isRecord(stackRulesValue)) {
    pushError(errors, pathPrefix, `Expected "${pathPrefix}" to be an object.`);
    return;
  }

  ['maxStacks'].forEach((key) => {
    if (stackRulesValue[key] !== undefined && typeof stackRulesValue[key] !== 'number') {
      pushError(errors, `${pathPrefix}.${key}`, `Expected "${key}" to be a number when present.`);
    }
  });

  ['refreshesDuration', 'consumesOnTrigger'].forEach((key) => {
    if (stackRulesValue[key] !== undefined && !isBoolean(stackRulesValue[key])) {
      pushError(errors, `${pathPrefix}.${key}`, `Expected "${key}" to be a boolean when present.`);
    }
  });

  const conditionalModifiers = stackRulesValue['conditionalModifiers'];
  if (conditionalModifiers === undefined) {
    return;
  }

  if (!Array.isArray(conditionalModifiers)) {
    pushError(errors, `${pathPrefix}.conditionalModifiers`, 'Expected "conditionalModifiers" to be an array.');
    return;
  }

  conditionalModifiers.forEach((entry, index) => {
    const modifierPath = `${pathPrefix}.conditionalModifiers[${index}]`;
    if (!isRecord(entry)) {
      pushError(errors, modifierPath, 'Expected conditional stack modifier to be an object.');
      return;
    }

    if (typeof entry['whenBuffActive'] !== 'string') {
      pushError(errors, `${modifierPath}.whenBuffActive`, 'Expected "whenBuffActive" to be a string.');
    }
    if (entry['maxStacks'] !== undefined && typeof entry['maxStacks'] !== 'number') {
      pushError(errors, `${modifierPath}.maxStacks`, 'Expected "maxStacks" to be a number when present.');
    }
    if (entry['gainMultiplier'] !== undefined && typeof entry['gainMultiplier'] !== 'number') {
      pushError(errors, `${modifierPath}.gainMultiplier`, 'Expected "gainMultiplier" to be a number when present.');
    }
  });
}
