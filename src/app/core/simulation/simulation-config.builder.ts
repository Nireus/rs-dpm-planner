import type { GameDataCatalog } from '../../../game-data/loaders';
import type { PlayerStats, RotationPlan, SimulationConfig } from '../../../simulation-engine/models';
import { buildPersistentBuffConfigFromBuffSelection, collectPersistentBuffIdsFromSelection, type BuffSelectionState } from '../buffs/persistent-buff-config';
import type { GearBuilderState } from '../gear/gear-state';
import { resolveEffectiveAmmoSelection } from '../gear/effective-ammo-selection';

export interface SimulationConfigBuilderInput {
  catalog: GameDataCatalog;
  playerStats: PlayerStats;
  gearState: GearBuilderState;
  buffState: BuffSelectionState;
  rotationPlan: RotationPlan;
}

export function buildSimulationConfigFromAppState(
  input: SimulationConfigBuilderInput,
): SimulationConfig {
  return {
    playerStats: input.playerStats,
    gearSetup: {
      equipment: input.gearState.equipment,
      ammoSelection: resolveEffectiveAmmoSelection(input.gearState, input.catalog),
    },
    inventory: {
      items: input.gearState.inventory,
    },
    persistentBuffConfig: buildPersistentBuffConfigFromBuffSelection(input.buffState, input.catalog.buffs),
    rotationPlan: input.rotationPlan,
    gameData: input.catalog,
    modeFlags: {
      strictValidation: true,
    },
  };
}

export function collectPersistentBuffIds(
  buffState: BuffSelectionState,
  catalog: Pick<GameDataCatalog, 'buffs' | 'relics'>,
): string[] {
  return collectPersistentBuffIdsFromSelection(buffState, catalog);
}
