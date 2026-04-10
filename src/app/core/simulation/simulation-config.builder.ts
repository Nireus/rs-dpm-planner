import type { GameDataCatalog } from '../../../game-data/loaders';
import { DEFAULT_SIMULATION_SETTINGS } from '../../../simulation-engine/models';
import type { CombatChoices, PlayerStats, RotationPlan, SimulationConfig, SimulationSettings } from '../../../simulation-engine/models';
import { normalizeCombatChoices } from '../../../simulation-engine/spells/magic-combat-choices';
import { buildPersistentBuffConfigFromBuffSelection, collectPersistentBuffIdsFromSelection, type BuffSelectionState } from '../buffs/persistent-buff-config';
import type { GearBuilderState } from '../gear/gear-state';
import { resolveEffectiveAmmoSelection } from '../gear/effective-ammo-selection';

export interface SimulationConfigBuilderInput {
  catalog: GameDataCatalog;
  playerStats: PlayerStats;
  combatChoices?: CombatChoices;
  gearState: GearBuilderState;
  buffState: BuffSelectionState;
  rotationPlan: RotationPlan;
  simulationSettings?: SimulationSettings;
}

export function buildSimulationConfigFromAppState(
  input: SimulationConfigBuilderInput,
): SimulationConfig {
  const projectedAbilityActions = [
    ...input.rotationPlan.abilityActions,
    ...input.rotationPlan.nonGcdActions.filter((action) => action.actionType === 'ability-use'),
  ].sort((left, right) => left.tick - right.tick || left.id.localeCompare(right.id));

  return {
    playerStats: input.playerStats,
    combatChoices: normalizeCombatChoices(input.playerStats, input.combatChoices),
    gearSetup: {
      equipment: input.gearState.equipment,
      ammoSelection: resolveEffectiveAmmoSelection(input.gearState, input.catalog),
    },
    inventory: {
      items: input.gearState.inventory,
    },
    persistentBuffConfig: buildPersistentBuffConfigFromBuffSelection(input.buffState, input.catalog.buffs),
    rotationPlan: {
      ...input.rotationPlan,
      abilityActions: projectedAbilityActions,
    },
    gameData: input.catalog,
    modeFlags: {
      strictValidation: true,
    },
    simulationSettings: input.simulationSettings ?? DEFAULT_SIMULATION_SETTINGS,
  };
}

export function collectPersistentBuffIds(
  buffState: BuffSelectionState,
  catalog: Pick<GameDataCatalog, 'buffs' | 'relics'>,
): string[] {
  return collectPersistentBuffIdsFromSelection(buffState, catalog);
}
