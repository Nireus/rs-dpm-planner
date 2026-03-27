import {
  CONFIG_OPTION_IDS,
  EFFECT_REF_IDS,
} from '../../game-data/conventions/mechanics';
import type { AbilityDefinition, EofSpecDefinition, ItemDefinition } from '../../game-data/types';
import type { SimulationConfig } from '../models';
import {
  BALANCE_BY_FORCE_ABILITY_ID,
  SHADOWFALL_ABILITY_ID,
} from './effective-ability.constants';

export function resolveEffectiveEofAbilityDefinition(
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

export function resolveEffectiveRangedBasicDefinition(
  config: SimulationConfig,
  baseAbility: AbilityDefinition,
): AbilityDefinition {
  const weaponDefinition = resolveEquippedWeaponDefinition(config);
  if (!weaponDefinition?.effectRefs?.includes(EFFECT_REF_IDS.gloomfireDarkfang)) {
    return baseAbility;
  }

  return {
    ...baseAbility,
    hitSchedule: [
      {
        id: 'ranged-darkfang-hit-1',
        tickOffset: 0,
        damage: { min: 45, max: 55 },
      },
      {
        id: 'ranged-darkfang-hit-2',
        tickOffset: 0,
        damage: { min: 45, max: 55 },
      },
    ],
    baseDamage: {
      min: 90,
      max: 110,
    },
    effectRefs: [...(baseAbility.effectRefs ?? []), EFFECT_REF_IDS.gloomfireDarkfang],
  };
}

export function resolveEffectiveDeadshotDefinition(
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

export function resolveEffectiveWeaponSpecialDefinition(
  config: SimulationConfig,
  baseAbility: AbilityDefinition,
): AbilityDefinition {
  const weaponDefinition = resolveEquippedWeaponDefinition(config);

  if (!weaponDefinition?.effectRefs?.includes(EFFECT_REF_IDS.weaponSpecialBalanceByForce)) {
    if (weaponDefinition?.effectRefs?.includes(EFFECT_REF_IDS.weaponSpecialShadowfall)) {
      return {
        ...baseAbility,
        id: SHADOWFALL_ABILITY_ID,
        name: 'Shadowfall',
        style: 'ranged',
        subtype: 'special',
        adrenalineCost: 65,
        adrenalineGain: 0,
        hitSchedule: [
          {
            id: 'shadowfall-hit-1',
            tickOffset: 0,
            damage: {
              min: 85,
              max: 105,
            },
          },
          {
            id: 'shadowfall-hit-2',
            tickOffset: 0,
            damage: {
              min: 85,
              max: 105,
            },
          },
          {
            id: 'shadowfall-hit-3',
            tickOffset: 0,
            damage: {
              min: 255,
              max: 295,
            },
          },
        ],
        baseDamage: {
          min: 425,
          max: 505,
        },
        effectRefs: [...(baseAbility.effectRefs ?? []), EFFECT_REF_IDS.weaponSpecialShadowfall],
      };
    }

    return baseAbility;
  }

  return {
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
    effectRefs: [...(baseAbility.effectRefs ?? []), EFFECT_REF_IDS.weaponSpecialBalanceByForce],
  };
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
  const explicitValue = amuletInstance.configValues?.[CONFIG_OPTION_IDS.storedSpecial];
  if (typeof explicitValue === 'string') {
    return explicitValue;
  }

  const defaultValue = amuletDefinition?.configOptions?.find(
    (option) => option.id === CONFIG_OPTION_IDS.storedSpecial,
  )?.defaultValue;
  return typeof defaultValue === 'string' ? defaultValue : null;
}

function hasIgneousDeadshotUpgrade(config: SimulationConfig): boolean {
  const cape = config.gearSetup.equipment.cape;
  if (!cape) {
    return false;
  }

  const capeDefinition = config.gameData.items[cape.definitionId];
  return (
    capeDefinition?.effectRefs?.includes(EFFECT_REF_IDS.igneousKalXilPassive) ||
    capeDefinition?.effectRefs?.includes(EFFECT_REF_IDS.igneousKalZukPassive) ||
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
