import { CONFIG_OPTION_IDS } from '../../../game-data/conventions/mechanics';
import type { EquipmentSlot } from '../../../game-data/types';
import type { ItemInstanceConfig } from '../../../simulation-engine/models';
import type { GearBuilderState } from './gear-state';

export interface MagicBisPresetApplicationOptions {
  removeCurrentGear: boolean;
}

export interface MagicBisPresetApplicationResult {
  state: GearBuilderState;
  nextInstanceId: number;
}

export const MAGIC_BIS_BUFF_SELECTION = {
  activeBuffIds: ['affliction', 'warped-gem', 'reaper-crew', 'overload-tier-17-5'],
  activeRelicIds: ['conservation-of-energy', 'berserkers-fury'],
  activeSummonIds: ['kalgerion-demon'],
  activePocketItemIds: [],
} as const;

export function applyMagicBisPresetToGearState(
  current: GearBuilderState,
  nextInstanceId: number,
  options: MagicBisPresetApplicationOptions,
): MagicBisPresetApplicationResult {
  const factory = createInstanceFactory(nextInstanceId);
  const equipment: Partial<Record<EquipmentSlot, ItemInstanceConfig>> = {
    weapon: factory('fractured-staff-of-armadyl', {
      configValues: {
        [CONFIG_OPTION_IDS.genesisEnchanted]: true,
      },
      configuredPerks: [
        { socketIndex: 0, perkId: 'precise', rank: 6 },
        { socketIndex: 0, perkId: 'ultimatums', rank: 4 },
        { socketIndex: 1, perkId: 'aftershock', rank: 4 },
        { socketIndex: 1, perkId: 'eruptive', rank: 2 },
      ],
    }),
    head: factory('mask-of-tumekens-resplendence'),
    body: factory('robe-top-of-tumekens-resplendence', {
      configuredPerks: [
        { socketIndex: 0, perkId: 'relentless', rank: 5 },
        { socketIndex: 0, perkId: 'crackling', rank: 4 },
        { socketIndex: 1, perkId: 'biting', rank: 4 },
      ],
    }),
    legs: factory('robe-bottom-of-tumekens-resplendence', {
      configuredPerks: [
        { socketIndex: 0, perkId: 'impatient', rank: 4 },
        { socketIndex: 0, perkId: 'devoted', rank: 4 },
        { socketIndex: 1, perkId: 'energising', rank: 4 },
        { socketIndex: 1, perkId: 'invigorating', rank: 3 },
      ],
    }),
    hands: factory('gloves-of-tumekens-resplendence'),
    feet: factory('boots-of-tumekens-resplendence'),
    ring: factory('channellers-ring', {
      configValues: {
        [CONFIG_OPTION_IDS.channellersRingMetaphysicsEnchanted]: true,
      },
    }),
    amulet: factory('essence-of-finality', {
      configValues: {
        'applied-dye': 'black',
        [CONFIG_OPTION_IDS.storedSpecial]: 'ibans-staff',
      },
    }),
    cape: factory('igneous-kal-zuk'),
    pocket: factory('erethdors-grimoire'),
    ammo: factory('grasping-rune-pouch'),
  };
  const presetInventory = [
    factory('roar-of-awakening', {
      configuredPerks: [
        { socketIndex: 0, perkId: 'caroming', rank: 4 },
        { socketIndex: 0, perkId: 'aftershock', rank: 1 },
      ],
    }),
    factory('ode-to-deceit', {
      configuredPerks: [
        { socketIndex: 0, perkId: 'lunging', rank: 4 },
        { socketIndex: 0, perkId: 'eruptive', rank: 2 },
      ],
    }),
    factory('essence-of-finality', {
      configValues: {
        'applied-dye': 'red',
        [CONFIG_OPTION_IDS.storedSpecial]: 'legatuss-emberstaff',
      },
    }),
    factory('essence-of-finality', {
      configValues: {
        'applied-dye': 'purple',
        [CONFIG_OPTION_IDS.storedSpecial]: 'guthix-staff',
      },
    }),
    factory('reavers-ring'),
  ];
  const preservedInventory = options.removeCurrentGear
    ? []
    : [
        ...Object.values(current.equipment).filter((instance): instance is ItemInstanceConfig => Boolean(instance)),
        ...current.inventory,
      ];

  return {
    state: {
      equipment,
      inventory: [...preservedInventory, ...presetInventory],
    },
    nextInstanceId: factory.nextInstanceId(),
  };
}

interface PresetItemOptions {
  configuredPerks?: NonNullable<ItemInstanceConfig['configuredPerks']>;
  configValues?: NonNullable<ItemInstanceConfig['configValues']>;
}

function createInstanceFactory(startingInstanceId: number) {
  let nextInstanceId = Math.max(1, Math.trunc(startingInstanceId));
  const create = (definitionId: string, options: PresetItemOptions = {}): ItemInstanceConfig => {
    const configuredPerks = options.configuredPerks ?? [];
    const instance: ItemInstanceConfig = {
      instanceId: `gear-item-${nextInstanceId}`,
      definitionId,
    };
    nextInstanceId += 1;

    if (configuredPerks.length) {
      instance.configuredPerks = configuredPerks;
      instance.perkIds = configuredPerks.map((perk) => perk.perkId);
    }

    if (options.configValues && Object.keys(options.configValues).length) {
      instance.configValues = options.configValues;
    }

    return instance;
  };

  return Object.assign(create, {
    nextInstanceId: () => nextInstanceId,
  });
}
