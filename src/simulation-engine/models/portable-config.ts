import type {
  CombatChoices,
  GearSetup,
  InventoryState,
  PersistentBuffConfig,
  PlayerStats,
  RotationPlan,
  SimulationSettings,
} from './config';
import { DEFAULT_SIMULATION_SETTINGS } from './config';
import { normalizeCombatChoices } from '../spells/magic-combat-choices';

export const PORTABLE_CONFIG_SCHEMA_VERSION = 2;

export interface PortableConfigDocumentV1 {
  schemaVersion: 1;
  playerStats: PlayerStats;
  gearSetup: GearSetup;
  inventory: InventoryState;
  persistentBuffConfig: PersistentBuffConfig;
  rotationPlan: RotationPlan;
}

export interface PortableConfigDocumentV2 {
  schemaVersion: typeof PORTABLE_CONFIG_SCHEMA_VERSION;
  playerStats: PlayerStats;
  combatChoices: CombatChoices;
  gearSetup: GearSetup;
  inventory: InventoryState;
  persistentBuffConfig: PersistentBuffConfig;
  rotationPlan: RotationPlan;
  simulationSettings: SimulationSettings;
}

export type PortableConfigDocument = PortableConfigDocumentV2;

export interface ExportableSimulationState {
  playerStats: PlayerStats;
  combatChoices?: CombatChoices;
  gearSetup: GearSetup;
  inventory: InventoryState;
  persistentBuffConfig: PersistentBuffConfig;
  rotationPlan: RotationPlan;
  simulationSettings?: SimulationSettings;
}

export function createPortableConfigDocument(
  state: ExportableSimulationState,
): PortableConfigDocument {
  return {
    schemaVersion: PORTABLE_CONFIG_SCHEMA_VERSION,
    playerStats: state.playerStats,
    combatChoices: normalizeCombatChoices(state.playerStats, state.combatChoices),
    gearSetup: state.gearSetup,
    inventory: state.inventory,
    persistentBuffConfig: state.persistentBuffConfig,
    rotationPlan: state.rotationPlan,
    simulationSettings: state.simulationSettings ?? DEFAULT_SIMULATION_SETTINGS,
  };
}
