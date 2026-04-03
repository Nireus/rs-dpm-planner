import { CONFIG_OPTION_IDS } from '../../game-data/conventions/mechanics';
import type {
  AbilityDefinition,
  AbilityVariantDefinition,
  EntityId,
  EofSpecDefinition,
  ItemDefinition,
} from '../../game-data/types';
import type { ItemInstanceConfig, RotationAction, SimulationConfig } from '../models';
import { resolveConfiguredEquipmentDefinition } from '../gear/configured-equipment-definition';
import type { AbilityAvailabilityContext } from '../rules/ability-availability';
import { requirementSetMatches } from '../rules/ability-availability';
import { projectSimulationConfigAtTick } from '../state/projected-gear-state';
import { applyAdrenalineCostModifiers } from './effective-ability.costs';
import {
  BALANCE_BY_FORCE_ABILITY_ID,
  DEADSHOT_ABILITY_ID,
  ESSENCE_OF_FINALITY_ABILITY_ID,
  RANGED_ABILITY_ID,
  SHADOWFALL_ABILITY_ID,
  SPLIT_SOUL_ABILITY_ID,
  WEAPON_SPECIAL_ATTACK_ABILITY_ID,
} from './effective-ability.constants';

export {
  BALANCE_BY_FORCE_ABILITY_ID,
  DEADSHOT_ABILITY_ID,
  ESSENCE_OF_FINALITY_ABILITY_ID,
  RANGED_ABILITY_ID,
  SHADOWFALL_ABILITY_ID,
  SPLIT_SOUL_ABILITY_ID,
  WEAPON_SPECIAL_ATTACK_ABILITY_ID,
} from './effective-ability.constants';

export function resolveEffectiveAbilityDefinition(
  config: SimulationConfig,
  action: RotationAction | null,
): AbilityDefinition | null {
  const projectedConfig = projectSimulationConfigForAction(config, action);
  const abilityId = readAbilityId(action);
  if (!abilityId) {
    return null;
  }

  const baseAbility = projectedConfig.gameData.abilities[abilityId];
  if (!baseAbility) {
    return null;
  }

  const castSpellAbility = resolveCastSpellAbility(projectedConfig, action, baseAbility);
  if (castSpellAbility) {
    return applyAdrenalineCostModifiers(projectedConfig, castSpellAbility);
  }

  const dispatchedAbility = resolveSpecialDispatchAbility(projectedConfig, baseAbility) ?? baseAbility;
  const resolvedAbility = applyMatchingAbilityVariant(projectedConfig, dispatchedAbility);
  return applyAdrenalineCostModifiers(projectedConfig, resolvedAbility);
}

function resolveCastSpellAbility(
  config: SimulationConfig,
  action: RotationAction | null,
  baseAbility: AbilityDefinition,
): AbilityDefinition | null {
  if (baseAbility.id !== 'cast-spell') {
    return null;
  }

  const spellId = action?.payload['spellId'];
  const spell =
    typeof spellId === 'string' && spellId.length > 0
      ? config.gameData.spells?.[spellId] ?? null
      : null;
  if (!spell) {
    return baseAbility;
  }

  if (spell.role === 'combat') {
    const magicAbility = config.gameData.abilities['magic'];
    return magicAbility ?? baseAbility;
  }

  return {
    ...baseAbility,
    timelineEffects: spell.timelineEffects ?? [],
  };
}

function resolveSpecialDispatchAbility(
  config: SimulationConfig,
  baseAbility: AbilityDefinition,
): AbilityDefinition | null {
  switch (baseAbility.specialDispatch?.source) {
    case 'equipped-weapon':
      return resolveEquippedWeaponSpecialAbility(config);
    case 'equipped-eof':
      return resolveStoredEofAbility(config);
    default:
      return null;
  }
}

function resolveEquippedWeaponSpecialAbility(config: SimulationConfig): AbilityDefinition | null {
  const equippedWeapon = resolveConfiguredEquipmentDefinition(config, 'weapon');
  if (!equippedWeapon?.specialAbilityId) {
    return null;
  }

  return config.gameData.abilities[equippedWeapon.specialAbilityId] ?? null;
}

function resolveStoredEofAbility(config: SimulationConfig): AbilityDefinition | null {
  const eofSpec = resolveStoredEofSpec(config);
  if (!eofSpec?.abilityId) {
    return null;
  }

  return config.gameData.abilities[eofSpec.abilityId] ?? null;
}

function resolveStoredEofSpec(config: SimulationConfig): EofSpecDefinition | null {
  const amuletInstance = config.gearSetup.equipment.amulet;
  if (!amuletInstance || amuletInstance.definitionId !== 'essence-of-finality') {
    return null;
  }

  const amuletDefinition = config.gameData.items[amuletInstance.definitionId];
  const explicitValue = amuletInstance.configValues?.[CONFIG_OPTION_IDS.storedSpecial];
  const storedSpecial = typeof explicitValue === 'string'
    ? explicitValue
    : amuletDefinition?.configOptions?.find(
      (option) => option.id === CONFIG_OPTION_IDS.storedSpecial,
    )?.defaultValue;

  if (typeof storedSpecial !== 'string' || storedSpecial.length === 0 || storedSpecial === 'none') {
    return null;
  }

  return config.gameData.eofSpecs[`${storedSpecial}-eof`] ?? null;
}

function applyMatchingAbilityVariant(
  config: SimulationConfig,
  baseAbility: AbilityDefinition,
): AbilityDefinition {
  const matchingVariant = selectMatchingAbilityVariant(config, baseAbility);
  if (!matchingVariant) {
    return baseAbility;
  }

  return mergeAbilityVariant(baseAbility, matchingVariant);
}

function selectMatchingAbilityVariant(
  config: SimulationConfig,
  baseAbility: AbilityDefinition,
): AbilityVariantDefinition | null {
  const availabilityContext = createAbilityAvailabilityContext(config);
  let bestVariant: AbilityVariantDefinition | null = null;
  let bestPriority = Number.NEGATIVE_INFINITY;

  for (const variant of baseAbility.variants ?? []) {
    if (!requirementSetMatches(variant.when, availabilityContext)) {
      continue;
    }

    const priority = variant.priority ?? 0;
    if (!bestVariant || priority > bestPriority) {
      bestVariant = variant;
      bestPriority = priority;
    }
  }

  return bestVariant;
}

function createAbilityAvailabilityContext(config: SimulationConfig): AbilityAvailabilityContext {
  const equippedInstances: ItemInstanceConfig[] = [];
  const equippedItems: ItemDefinition[] = [];

  for (const [slot, instance] of Object.entries(config.gearSetup.equipment)) {
    if (!instance) {
      continue;
    }

    equippedInstances.push(instance);
    const definition = resolveConfiguredEquipmentDefinition(
      config,
      slot as keyof SimulationConfig['gearSetup']['equipment'],
    );
    if (definition) {
      equippedItems.push(definition);
    }
  }
  const inventoryItems = config.inventory.items
    .map((instance) => config.gameData.items[instance.definitionId] ?? null)
    .filter((item): item is ItemDefinition => Boolean(item));

  return {
    playerStats: config.playerStats,
    equippedItems,
    inventoryItems,
    equippedInstances,
  };
}

function mergeAbilityVariant(
  baseAbility: AbilityDefinition,
  variant: AbilityVariantDefinition,
): AbilityDefinition {
  const hitSchedule = variant.hitSchedule ?? baseAbility.hitSchedule;
  const baseDamage = variant.baseDamage ?? (variant.hitSchedule ? sumHitScheduleDamage(hitSchedule) : baseAbility.baseDamage);

  return {
    ...baseAbility,
    id: variant.id ?? baseAbility.id,
    name: variant.name ?? baseAbility.name,
    iconPath: variant.iconPath ?? baseAbility.iconPath,
    hoverSummary: variant.hoverSummary ?? baseAbility.hoverSummary,
    detailLines: variant.detailLines ?? baseAbility.detailLines,
    wikiUrl: variant.wikiUrl ?? baseAbility.wikiUrl,
    style: variant.style ?? baseAbility.style,
    subtype: variant.subtype ?? baseAbility.subtype,
    cooldownTicks: variant.cooldownTicks ?? baseAbility.cooldownTicks,
    adrenalineCost: variant.adrenalineCost ?? baseAbility.adrenalineCost,
    adrenalineGain: variant.adrenalineGain ?? baseAbility.adrenalineGain,
    requires: variant.requires ?? baseAbility.requires,
    isChanneled: variant.isChanneled ?? baseAbility.isChanneled,
    channelDurationTicks: variant.channelDurationTicks ?? baseAbility.channelDurationTicks,
    hitSchedule,
    baseDamage,
    effectRefs: mergeUniqueStrings(baseAbility.effectRefs, variant.effectRefs),
    timelineEffects: mergeArrayValues(baseAbility.timelineEffects, variant.timelineEffects),
    stackEffects: mergeArrayValues(baseAbility.stackEffects, variant.stackEffects),
    displayHints: {
      ...(baseAbility.displayHints ?? {}),
      ...(variant.displayHints ?? {}),
    },
    description: variant.description ?? baseAbility.description,
  };
}

function sumHitScheduleDamage(
  hitSchedule: AbilityDefinition['hitSchedule'],
): AbilityDefinition['baseDamage'] {
  return {
    min: hitSchedule.reduce((sum, hit) => sum + hit.damage.min, 0),
    max: hitSchedule.reduce((sum, hit) => sum + hit.damage.max, 0),
  };
}

function mergeUniqueStrings(
  left: string[] | undefined,
  right: string[] | undefined,
): string[] | undefined {
  if (!left?.length && !right?.length) {
    return undefined;
  }

  return [...new Set([...(left ?? []), ...(right ?? [])])];
}

function mergeArrayValues<T>(
  left: T[] | undefined,
  right: T[] | undefined,
): T[] | undefined {
  if (!left?.length && !right?.length) {
    return undefined;
  }

  return [...(left ?? []), ...(right ?? [])];
}

function readAbilityId(action: RotationAction | null): EntityId | null {
  const abilityId = action?.payload['abilityId'];
  return typeof abilityId === 'string' && abilityId.length > 0 ? abilityId : null;
}

function projectSimulationConfigForAction(
  config: SimulationConfig,
  action: RotationAction | null,
): SimulationConfig {
  if (!action) {
    return config;
  }

  return projectSimulationConfigAtTick(config, action.tick);
}
