import type { EquipmentSlot } from '../../../game-data/types';
import type { ItemInstanceConfig } from '../../../simulation-engine/models';

export interface GearBuilderState {
  equipment: Partial<Record<EquipmentSlot, ItemInstanceConfig>>;
  inventory: ItemInstanceConfig[];
}
