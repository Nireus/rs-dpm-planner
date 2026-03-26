import type { AbilityDefinition, EntityId, EofSpecDefinition, ItemDefinition } from '../../game-data/types';
import type { RotationAction, SimulationConfig } from '../models';

export const WEAPON_SPECIAL_ATTACK_ABILITY_ID = 'weapon-special-attack';
export const ESSENCE_OF_FINALITY_ABILITY_ID = 'essence-of-finality';
export const BALANCE_BY_FORCE_ABILITY_ID = 'balance-by-force';
export const BOLG_WEAPON_SPECIAL_EFFECT_REF = 'weapon-special:balance-by-force';
export const DEADSHOT_ABILITY_ID = 'deadshot';
const VIGOUR_PASSIVE_EFFECT_REF = 'vigour-passive';
const IGNEOUS_KAL_XIL_EFFECT_REF = 'igneous-kal-xil-passive';
const IGNEOUS_KAL_ZUK_EFFECT_REF = 'igneous-kal-zuk-passive';

export function resolveEffectiveAbilityDefinition(
  config: SimulationConfig,
  action: RotationAction | null,
): AbilityDefinition | null {
  const abilityId = readAbilityId(action);
  if (!abilityId) {
    return null;
  }

  const baseAbility = config.gameData.abilities[abilityId];
  if (!baseAbility) {
    return null;
  }

  if (abilityId === ESSENCE_OF_FINALITY_ABILITY_ID) {
    return applyAdrenalineCostModifiers(config, resolveEffectiveEofAbilityDefinition(config, baseAbility));
  }

  if (abilityId === DEADSHOT_ABILITY_ID) {
    return applyAdrenalineCostModifiers(config, resolveEffectiveDeadshotDefinition(config, baseAbility));
  }

  if (abilityId !== WEAPON_SPECIAL_ATTACK_ABILITY_ID) {
    return applyAdrenalineCostModifiers(config, baseAbility);
  }

  const weaponDefinition = resolveEquippedWeaponDefinition(config);
  if (!weaponDefinition?.effectRefs?.includes(BOLG_WEAPON_SPECIAL_EFFECT_REF)) {
    return applyAdrenalineCostModifiers(config, baseAbility);
  }

  return applyAdrenalineCostModifiers(config, {
    ...baseAbility,
    id: BALANCE_BY_FORCE_ABILITY_ID,
    name: 'Balance by Force',
    style: 'ranged',
    subtype: 'special',
    adrenalineCost: 30,
    adrenalineGain: 0,
    hitSchedule: [
      {
        id: 'balance-by-force-hit',
        tickOffset: 0,
        damage: {
          min: 235,
          max: 255,
        },
      },
    ],
    baseDamage: {
      min: 235,
      max: 255,
    },
    effectRefs: [...(baseAbility.effectRefs ?? []), BOLG_WEAPON_SPECIAL_EFFECT_REF],
  });
}

function resolveEffectiveEofAbilityDefinition(
  config: SimulationConfig,
  baseAbility: AbilityDefinition,
): AbilityDefinition {
  const storedSpecial = resolveStoredEofSpecial(config);
  if (!storedSpecial || storedSpecial === 'none') {
    return baseAbility;
  }

  const eofSpec = config.gameData.eofSpecs[`${storedSpecial}-eof`];
  if (!eofSpec) {
    return baseAbility;
  }

  return mapEofSpecToAbility(baseAbility, eofSpec);
}

function resolveEffectiveDeadshotDefinition(
  config: SimulationConfig,
  baseAbility: AbilityDefinition,
): AbilityDefinition {
  if (!hasIgneousDeadshotUpgrade(config)) {
    return baseAbility;
  }

  return {
    ...baseAbility,
    adrenalineCost: 60,
    hitSchedule: Array.from({ length: 8 }, (_, index) => ({
      id: `deadshot-igneous-hit-${index + 1}`,
      tickOffset: 0,
      damage: { min: 55, max: 75 },
    })),
    baseDamage: {
      min: 440,
      max: 600,
    },
  };
}

function readAbilityId(action: RotationAction | null): EntityId | null {
  const abilityId = action?.payload['abilityId'];
  return typeof abilityId === 'string' && abilityId.length > 0 ? abilityId : null;
}

function resolveEquippedWeaponDefinition(config: SimulationConfig): ItemDefinition | null {
  const weapon = config.gearSetup.equipment.weapon;
  if (!weapon) {
    return null;
  }

  return config.gameData.items[weapon.definitionId] ?? null;
}

function resolveStoredEofSpecial(config: SimulationConfig): string | null {
  const amuletInstance = config.gearSetup.equipment.amulet;
  if (!amuletInstance || amuletInstance.definitionId !== 'essence-of-finality') {
    return null;
  }

  const amuletDefinition = config.gameData.items[amuletInstance.definitionId];
  const explicitValue = amuletInstance.configValues?.['stored-special'];
  if (typeof explicitValue === 'string') {
    return explicitValue;
  }

  const defaultValue = amuletDefinition?.configOptions?.find((option) => option.id === 'stored-special')?.defaultValue;
  return typeof defaultValue === 'string' ? defaultValue : null;
}

function hasIgneousDeadshotUpgrade(config: SimulationConfig): boolean {
  const cape = config.gearSetup.equipment.cape;
  if (!cape) {
    return false;
  }

  const capeDefinition = config.gameData.items[cape.definitionId];
  return (
    capeDefinition?.effectRefs?.includes(IGNEOUS_KAL_XIL_EFFECT_REF) ||
    capeDefinition?.effectRefs?.includes(IGNEOUS_KAL_ZUK_EFFECT_REF) ||
    false
  );
}

function mapEofSpecToAbility(
  baseAbility: AbilityDefinition,
  eofSpec: EofSpecDefinition,
): AbilityDefinition {
  return {
    ...baseAbility,
    id: eofSpec.id,
    name: eofSpec.name,
    iconPath: eofSpec.iconPath,
    hoverSummary: eofSpec.hoverSummary,
    detailLines: eofSpec.detailLines,
    wikiUrl: eofSpec.wikiUrl,
    style: 'ranged',
    subtype: 'special',
    adrenalineCost: eofSpec.adrenalineCost,
    adrenalineGain: 0,
    hitSchedule: eofSpec.hitSchedule,
    baseDamage: eofSpec.baseDamage,
    effectRefs: [...(baseAbility.effectRefs ?? []), ...(eofSpec.effectRefs ?? [])],
    description: eofSpec.description ?? baseAbility.description,
  };
}

function applyAdrenalineCostModifiers(
  config: SimulationConfig,
  ability: AbilityDefinition,
): AbilityDefinition {
  const adrenalineCost = ability.adrenalineCost;
  if (adrenalineCost === undefined || !hasVigourLikePassive(config)) {
    return ability;
  }

  if (ability.subtype === 'ultimate') {
    return {
      ...ability,
      adrenalineCost: Math.max(0, adrenalineCost - 10),
    };
  }

  if (ability.subtype === 'special') {
    return {
      ...ability,
      adrenalineCost: Math.round(adrenalineCost * 90 * 100) / 10000,
    };
  }

  return ability;
}

function hasVigourLikePassive(config: SimulationConfig): boolean {
  const ringInstance = config.gearSetup.equipment.ring;
  const ringDefinition = ringInstance ? config.gameData.items[ringInstance.definitionId] : null;
  const ringProvidesPassive = ringDefinition?.effectRefs?.includes(VIGOUR_PASSIVE_EFFECT_REF) ?? false;
  const activeBuffIds = config.persistentBuffConfig.buffIds ?? [];
  const buffProvidesPassive = activeBuffIds.some((buffId) =>
    config.gameData.buffs[buffId]?.effectRefs?.includes(VIGOUR_PASSIVE_EFFECT_REF),
  );

  return ringProvidesPassive || buffProvidesPassive;
}
