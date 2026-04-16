import { CONFIG_OPTION_IDS } from '../../../game-data/conventions/mechanics';
import type { EquipmentSlot } from '../../../game-data/types';
import type { ItemInstanceConfig } from '../../../simulation-engine/models';
import type { GearBuilderState } from './gear-state';

export interface MeleeBisPresetApplicationOptions {
  removeCurrentGear: boolean;
}

export interface MeleeBisPresetApplicationResult {
  state: GearBuilderState;
  nextInstanceId: number;
}

export const MELEE_BIS_BUFF_SELECTION = {
  activeBuffIds: ['malevolence', 'warped-gem', 'reaper-crew', 'overload-tier-17-5'],
  activeRelicIds: ['berserkers-fury', 'conservation-of-energy'],
  activeSummonIds: ['ripper-demon'],
  activePocketItemIds: [],
} as const;

export function applyMeleeBisPresetToGearState(
  current: GearBuilderState,
  nextInstanceId: number,
  options: MeleeBisPresetApplicationOptions,
): MeleeBisPresetApplicationResult {
  const factory = createInstanceFactory(nextInstanceId);
  const equipment: Partial<Record<EquipmentSlot, ItemInstanceConfig>> = {
    weapon: factory('ek-zekkil', {
      configValues: {
        [CONFIG_OPTION_IDS.genesisEnchanted]: true,
      },
      configuredPerks: [
        { socketIndex: 0, perkId: 'precise', rank: 6 },
        { socketIndex: 0, perkId: 'ruthless', rank: 1 },
        { socketIndex: 1, perkId: 'aftershock', rank: 4 },
        { socketIndex: 1, perkId: 'eruptive', rank: 2 },
      ],
    }),
    head: factory('vestments-of-havoc-hood'),
    body: factory('vestments-of-havoc-robe-top', {
      configuredPerks: [
        { socketIndex: 0, perkId: 'relentless', rank: 5 },
        { socketIndex: 0, perkId: 'crackling', rank: 4 },
        { socketIndex: 1, perkId: 'biting', rank: 4 },
      ],
    }),
    legs: factory('vestments-of-havoc-robe-bottom', {
      configuredPerks: [
        { socketIndex: 0, perkId: 'impatient', rank: 4 },
        { socketIndex: 0, perkId: 'devoted', rank: 4 },
        { socketIndex: 1, perkId: 'ultimatums', rank: 4 },
      ],
    }),
    hands: factory('enhanced-gloves-of-passage', {
      configValues: {
        [CONFIG_OPTION_IDS.enhancedGlovesOfPassageAgonyEnchanted]: true,
      },
    }),
    feet: factory('vestments-of-havoc-boots'),
    amulet: factory('am-hej'),
    ring: factory('reavers-ring'),
    cape: factory('igneous-kal-zuk'),
    pocket: factory('scripture-of-ful'),
    ammo: factory('nodon-spike-harness'),
  };
  const presetInventory = [
    factory('dark-shard-of-leng', {
      configValues: {
        [CONFIG_OPTION_IDS.genesisEnchanted]: true,
      },
      configuredPerks: [
        { socketIndex: 0, perkId: 'precise', rank: 6 },
        { socketIndex: 0, perkId: 'aftershock', rank: 1 },
      ],
    }),
    factory('dark-sliver-of-leng', {
      configValues: {
        [CONFIG_OPTION_IDS.genesisEnchanted]: true,
      },
      configuredPerks: [
        { socketIndex: 0, perkId: 'aftershock', rank: 4 },
        { socketIndex: 0, perkId: 'eruptive', rank: 2 },
      ],
    }),
    factory('essence-of-finality', {
      configValues: {
        'applied-dye': 'red',
        [CONFIG_OPTION_IDS.storedSpecial]: 'dragon-claw',
      },
    }),
    factory('essence-of-finality', {
      configValues: {
        'applied-dye': 'black',
        [CONFIG_OPTION_IDS.storedSpecial]: 'varanuss-mercy',
      },
    }),
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
