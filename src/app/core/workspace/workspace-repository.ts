import type { BuffDefinition } from '../../../game-data/types';
import type { PlayerStats } from '../../../simulation-engine/models';
import type { PortableConfigDocument } from '../../../simulation-engine/models/portable-config';
import type { BuffSelectionState } from '../buffs/persistent-buff-config';
import type { GearBuilderState } from '../gear/gear-state';
import type {
  GearBuilderWorkspaceState,
  RotationPlannerWorkspaceState,
  WorkspaceDocument,
} from './workspace.models';

export interface WorkspaceRepository {
  readDocument(): WorkspaceDocument;
  readPortableConfigDocument(): PortableConfigDocument;
  readPlayerStats(): PlayerStats;
  readGearBuilderState(): GearBuilderWorkspaceState;
  readBuffSelectionState(): BuffSelectionState;
  readRotationPlannerState(): RotationPlannerWorkspaceState;
  replacePortableConfigDocument(document: PortableConfigDocument): WorkspaceDocument;
  updatePlayerStats(playerStats: PlayerStats): void;
  updateGearBuilderState(gearState: GearBuilderState, nextInstanceId: number): void;
  updateBuffSelectionState(
    selection: BuffSelectionState,
    buffDefinitions: Record<string, BuffDefinition>,
  ): void;
  updateRotationPlannerState(state: RotationPlannerWorkspaceState): void;
  clear(): void;
}
