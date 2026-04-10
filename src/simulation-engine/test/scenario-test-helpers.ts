import { EFFECT_REF_IDS } from '../../game-data/conventions/mechanics';
import type { AbilityDefinition, BuffDefinition, ItemDefinition, SpellDefinition } from '../../game-data/types';
import type { RotationAction, SimulationConfig } from '../models';

const DEFAULT_BOW: ItemDefinition = {
  id: 'basic-bow',
  name: 'Basic Bow',
  category: 'weapon',
  slot: 'weapon',
  combatStyleTags: ['ranged'],
  tier: 95,
  offensiveStats: {
    damageTier: 95,
  },
};

export function createScenarioConfig(input: {
  abilities: Record<string, AbilityDefinition>;
  buffs?: Record<string, BuffDefinition>;
  items?: Record<string, ItemDefinition>;
  spells?: Record<string, SpellDefinition>;
  equipment?: SimulationConfig['gearSetup']['equipment'];
  inventoryItems?: SimulationConfig['inventory']['items'];
  persistentBuffConfig?: SimulationConfig['persistentBuffConfig'];
  simulationSettings?: SimulationConfig['simulationSettings'];
  combatChoices?: SimulationConfig['combatChoices'];
  nonGcdActions?: RotationAction[];
  abilityActions: RotationAction[];
  startingAdrenaline: number;
  tickCount: number;
}): SimulationConfig {
  return {
    playerStats: {
      attackLevel: 99,
      strengthLevel: 99,
      defenceLevel: 99,
      rangedLevel: 99,
      magicLevel: 99,
      necromancyLevel: 99,
      prayerLevel: 99,
    },
    gearSetup: {
      equipment: input.equipment ?? {
        weapon: {
          instanceId: 'weapon-1',
          definitionId: DEFAULT_BOW.id,
        },
      },
    },
    inventory: {
      items: input.inventoryItems ?? [],
    },
    combatChoices: input.combatChoices,
    persistentBuffConfig: input.persistentBuffConfig ?? {},
    rotationPlan: {
      startingAdrenaline: input.startingAdrenaline,
      tickCount: input.tickCount,
      nonGcdActions: input.nonGcdActions ?? [],
      abilityActions: input.abilityActions,
    },
    gameData: {
      items: {
        [DEFAULT_BOW.id]: DEFAULT_BOW,
        ...(input.items ?? {}),
      },
      ammo: {},
      spells: input.spells ?? {},
      abilities: input.abilities,
      buffs: input.buffs ?? {},
      perks: {},
      relics: {},
      eofSpecs: {},
    },
    modeFlags: {
      strictValidation: true,
    },
    simulationSettings: input.simulationSettings,
  };
}

export function createAbilityAction(id: string, tick: number, abilityId: string): RotationAction {
  return {
    id,
    tick,
    lane: 'ability',
    actionType: 'ability-use',
    payload: {
      abilityId,
    },
  };
}

export function createGearSwapAction(
  id: string,
  tick: number,
  instanceId: string,
  definitionId: string,
  slot: string,
): RotationAction {
  return {
    id,
    tick,
    lane: 'non-gcd',
    actionType: 'gear-swap',
    payload: {
      templateId: 'gear-swap',
      instanceId,
      definitionId,
      slot,
      label: `Swap: ${definitionId}`,
    },
  };
}

export function createAbilityDefinition(
  input: Omit<AbilityDefinition, 'style' | 'subtype'> &
    Pick<Partial<AbilityDefinition>, 'style' | 'subtype'>,
): AbilityDefinition {
  return {
    style: 'ranged',
    subtype: 'basic',
    ...input,
  };
}

export function createFulArrowsItem(): ItemDefinition {
  return {
    id: 'ful-arrows',
    name: 'Ful arrows',
    category: 'ammo',
    slot: 'ammo',
    combatStyleTags: ['ranged'],
    effectRefs: [EFFECT_REF_IDS.fulArrowsHeat],
  };
}
