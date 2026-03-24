import type {
  GearSetup,
  InventoryState,
  PersistentBuffConfig,
  PlayerStats,
  RotationPlan,
} from './config';

export const PORTABLE_CONFIG_SCHEMA_VERSION = 1;

export interface PortableConfigDocumentV1 {
  schemaVersion: typeof PORTABLE_CONFIG_SCHEMA_VERSION;
  playerStats: PlayerStats;
  gearSetup: GearSetup;
  inventory: InventoryState;
  persistentBuffConfig: PersistentBuffConfig;
  rotationPlan: RotationPlan;
}

export type PortableConfigDocument = PortableConfigDocumentV1;

export interface ExportableSimulationState {
  playerStats: PlayerStats;
  gearSetup: GearSetup;
  inventory: InventoryState;
  persistentBuffConfig: PersistentBuffConfig;
  rotationPlan: RotationPlan;
}

export function createPortableConfigDocument(
  state: ExportableSimulationState,
): PortableConfigDocument {
  return {
    schemaVersion: PORTABLE_CONFIG_SCHEMA_VERSION,
    playerStats: state.playerStats,
    gearSetup: state.gearSetup,
    inventory: state.inventory,
    persistentBuffConfig: state.persistentBuffConfig,
    rotationPlan: state.rotationPlan,
  };
}
