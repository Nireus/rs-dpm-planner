import { createPortableConfigDocument, PORTABLE_CONFIG_SCHEMA_VERSION, type PortableConfigDocument } from '../../../simulation-engine/models/portable-config';
import type { CombatChoices, PlayerStats, PreFightPlan, RotationAction, SimulationSettings } from '../../../simulation-engine/models';
import { parsePortableConfigDocument } from '../../../simulation-engine/validation/portable-config';
import type { StartingStackState } from '../../../simulation-engine/models/starting-stacks';
import { buildBuffSelectionStateFromPersistentConfig, type BuffSelectionState } from '../buffs/persistent-buff-config';
import type { GearBuilderState } from '../gear/gear-state';

export const WORKSPACE_DOCUMENT_VERSION = 1;

export interface GearBuilderWorkspaceState {
  gearState: GearBuilderState;
  nextInstanceId: number;
}

export interface RotationPlannerWorkspaceState {
  startingAdrenaline: number;
  tickCount: number;
  startingStacks: StartingStackState;
  nonGcdActions: RotationAction[];
  abilityActions: RotationAction[];
  preFight: PreFightPlan;
}

export interface SimulationSettingsWorkspaceState extends SimulationSettings {}

export interface WorkspaceDocument {
  documentVersion: typeof WORKSPACE_DOCUMENT_VERSION;
  portableConfig: PortableConfigDocument;
  appState: {
    gearBuilder: {
      nextInstanceId: number;
    };
    buffSelection: BuffSelectionState;
  };
}

export const DEFAULT_WORKSPACE_DOCUMENT: WorkspaceDocument = {
  documentVersion: WORKSPACE_DOCUMENT_VERSION,
  portableConfig: createPortableConfigDocument({
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
      equipment: {},
    },
    inventory: {
      items: [],
    },
    persistentBuffConfig: {},
    simulationSettings: {
      criticalHitResolutionMode: 'deterministic-accumulator',
      serenGodbowTargetSize: '5x5',
    },
    rotationPlan: {
      startingAdrenaline: 100,
      tickCount: 99,
      startingStacks: {},
      nonGcdActions: [],
      abilityActions: [],
      preFight: {
        gapTicks: 0,
        prebuildActions: [],
        prebuildNonGcdActions: [],
        stalledAbility: null,
      },
    },
  }),
  appState: {
    gearBuilder: {
      nextInstanceId: 1,
    },
    buffSelection: buildBuffSelectionStateFromPersistentConfig({}),
  },
};

export const WORKSPACE_STORAGE_KEY = 'rs-dpm-planner.workspace.v1';
export const LEGACY_GEAR_BUILDER_STORAGE_KEY = 'rs-dpm-planner.gear-builder.v1';
export const LEGACY_BUFF_CONFIGURATION_STORAGE_KEY = 'rs-dpm-planner.buff-configuration.v1';
export const LEGACY_PLAYER_STATS_STORAGE_KEY = 'rs-dpm-planner.player-stats.v1';
export const LEGACY_ROTATION_PLANNER_STORAGE_KEY = 'rs-dpm-planner.rotation-planner.v1';

export function isWorkspaceDocument(value: unknown): value is WorkspaceDocument {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<WorkspaceDocument>;
  const portableConfigResult = parsePortableConfigDocument(candidate.portableConfig);
  return (
    candidate.documentVersion === WORKSPACE_DOCUMENT_VERSION &&
    portableConfigResult.success &&
    !!candidate.appState?.gearBuilder &&
    typeof candidate.appState.gearBuilder.nextInstanceId === 'number' &&
    Array.isArray(candidate.appState.buffSelection?.activeBuffIds) &&
    Array.isArray(candidate.appState.buffSelection?.activeRelicIds) &&
    (candidate.appState.buffSelection.activeSummonIds === undefined ||
      Array.isArray(candidate.appState.buffSelection.activeSummonIds)) &&
    Array.isArray(candidate.appState.buffSelection?.activePocketItemIds)
  );
}
