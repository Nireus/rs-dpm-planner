import { CONFIG_OPTION_IDS } from '../../../game-data/conventions/mechanics';
import type { EquipmentSlot } from '../../../game-data/types';
import type { ItemInstanceConfig } from '../../../simulation-engine/models';
import type { GearBuilderState } from './gear-state';

export interface RangedBisPresetApplicationOptions {
  removeCurrentGear: boolean;
}

export interface RangedBisPresetApplicationResult {
  state: GearBuilderState;
  nextInstanceId: number;
}

export const RANGED_BIS_BUFF_SELECTION = {
  activeBuffIds: ['desolation', 'warped-gem', 'reaper-crew', 'overload-tier-17-5'],
  activeRelicIds: ['conservation-of-energy', 'fury-of-the-small', 'death-ward'],
  activePocketItemIds: [],
} as const;

export function applyRangedBisPresetToGearState(
  current: GearBuilderState,
  nextInstanceId: number,
  options: RangedBisPresetApplicationOptions,
): RangedBisPresetApplicationResult {
  const factory = createInstanceFactory(nextInstanceId);
  const equipment: Partial<Record<EquipmentSlot, ItemInstanceConfig>> = {
    weapon: factory('bolg', {
      configValues: {
        [CONFIG_OPTION_IDS.genesisEnchanted]: true,
      },
      configuredPerks: [
        { socketIndex: 0, perkId: 'precise', rank: 6 },
        { socketIndex: 0, perkId: 'caroming', rank: 1 },
        { socketIndex: 1, perkId: 'aftershock', rank: 4 },
        { socketIndex: 1, perkId: 'eruptive', rank: 2 },
      ],
    }),
    head: factory('elite-dracolich-helm'),
    body: factory('elite-dracolich-hauberk', {
      configuredPerks: [
        { socketIndex: 0, perkId: 'relentless', rank: 5 },
        { socketIndex: 0, perkId: 'crackling', rank: 4 },
        { socketIndex: 1, perkId: 'biting', rank: 4 },
      ],
    }),
    legs: factory('elite-dracolich-chaps', {
      configuredPerks: [
        { socketIndex: 0, perkId: 'impatient', rank: 4 },
        { socketIndex: 0, perkId: 'devoted', rank: 4 },
        { socketIndex: 1, perkId: 'ultimatums', rank: 4 },
      ],
    }),
    hands: factory('elite-dracolich-vambraces'),
    feet: factory('elite-dracolich-boots'),
    amulet: factory('essence-of-finality', {
      configValues: {
        'applied-dye': 'yellow',
        [CONFIG_OPTION_IDS.storedSpecial]: 'eldritch-crossbow',
      },
    }),
    ring: factory('stalkers-ring', {
      configValues: {
        [CONFIG_OPTION_IDS.stalkersRingShadowsEnchanted]: true,
      },
    }),
    pocket: factory('scripture-of-ful'),
    cape: factory('igneous-kal-zuk'),
    ammo: factory('pernixs-quiver', {
      configValues: {
        [CONFIG_OPTION_IDS.loadedAmmo]: 'deathspore-arrows',
        'applied-dye': 'yellow',
      },
    }),
  };
  const presetInventory = [
    factory('pernixs-quiver', {
      configValues: {
        [CONFIG_OPTION_IDS.loadedAmmo]: 'ful-arrows',
        'applied-dye': 'red',
      },
    }),
    factory('pernixs-quiver', {
      configValues: {
        [CONFIG_OPTION_IDS.loadedAmmo]: 'wen-arrows',
        'applied-dye': 'blue',
      },
    }),
    factory('pernixs-quiver', {
      configValues: {
        [CONFIG_OPTION_IDS.loadedAmmo]: 'jas-dragonbane-arrows',
        'applied-dye': 'purple',
      },
    }),
    factory('essence-of-finality', {
      configValues: {
        'applied-dye': 'blue',
        [CONFIG_OPTION_IDS.storedSpecial]: 'seren-godbow',
      },
    }),
    factory('essence-of-finality', {
      configValues: {
        'applied-dye': 'green',
        [CONFIG_OPTION_IDS.storedSpecial]: 'dark-bow',
      },
    }),
    factory('essence-of-finality', {
      configValues: {
        'applied-dye': 'pink',
        [CONFIG_OPTION_IDS.storedSpecial]: 'gloomfire-bow',
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
