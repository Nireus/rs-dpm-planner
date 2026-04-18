import { Injectable, inject } from '@angular/core';
import type { PortableConfigValidationError } from '../../../simulation-engine/validation/portable-config';
import { parsePortableConfigDocument } from '../../../simulation-engine/validation/portable-config';
import { normalizePreFightPlan } from '../../../simulation-engine/timeline/pre-fight';
import { BuffConfigurationStoreService } from '../buffs/buff-configuration-store.service';
import { CombatChoicesStoreService } from '../combat-choices/combat-choices-store.service';
import { GearBuilderStore } from '../gear/gear-builder.store';
import { PlayerStatsStoreService } from '../player-stats/player-stats-store.service';
import { RotationPlannerStore } from '../rotation-planner/rotation-planner.store';
import { SimulationSettingsStoreService } from '../simulation/simulation-settings-store.service';
import { WorkspaceRepositoryService } from '../workspace/workspace-repository.service';

export type PortableConfigTextParseResult =
  | {
      success: true;
      documentText: string;
    }
  | {
      success: false;
      message: string;
      errors: PortableConfigValidationError[];
    };

@Injectable({
  providedIn: 'root',
})
export class PortableConfigExchangeService {
  private readonly workspaceRepository = inject(WorkspaceRepositoryService);
  private readonly gearBuilderStore = inject(GearBuilderStore);
  private readonly buffConfigurationStore = inject(BuffConfigurationStoreService);
  private readonly combatChoicesStore = inject(CombatChoicesStoreService);
  private readonly playerStatsStore = inject(PlayerStatsStoreService);
  private readonly rotationPlannerStore = inject(RotationPlannerStore);
  private readonly simulationSettingsStore = inject(SimulationSettingsStoreService);

  readFormattedPortableConfigDocument(): string {
    return this.formatPortableConfigDocument(this.workspaceRepository.readPortableConfigDocument());
  }

  formatPortableConfigDocument(document = this.workspaceRepository.readPortableConfigDocument()): string {
    return JSON.stringify(document, null, 2);
  }

  parsePortableConfigText(text: string): PortableConfigTextParseResult {
    const trimmed = text.trim();

    if (!trimmed) {
      return {
        success: false,
        message: 'Paste a portable configuration JSON document first.',
        errors: [],
      };
    }

    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(trimmed);
    } catch {
      return {
        success: false,
        message: 'The provided text is not valid JSON.',
        errors: [],
      };
    }

    const parseResult = parsePortableConfigDocument(parsedJson);

    if (!parseResult.success) {
      return {
        success: false,
        message: 'Portable config validation failed.',
        errors: parseResult.errors,
      };
    }

    return {
      success: true,
      documentText: this.formatPortableConfigDocument(parseResult.data),
    };
  }

  applyPortableConfigText(text: string): PortableConfigTextParseResult {
    const parseResult = this.parsePortableConfigText(text);

    if (!parseResult.success) {
      return parseResult;
    }

    const document = JSON.parse(parseResult.documentText);
    const workspaceDocument = this.workspaceRepository.replacePortableConfigDocument(document);

    this.gearBuilderStore.loadWorkspaceState({
      gearState: {
        equipment: workspaceDocument.portableConfig.gearSetup.equipment ?? {},
        inventory: workspaceDocument.portableConfig.inventory.items ?? [],
      },
      nextInstanceId: workspaceDocument.appState.gearBuilder.nextInstanceId,
    });
    this.buffConfigurationStore.loadState(workspaceDocument.appState.buffSelection);
    this.playerStatsStore.loadStats(workspaceDocument.portableConfig.playerStats);
    this.combatChoicesStore.loadCombatChoices(workspaceDocument.portableConfig.combatChoices);
    this.simulationSettingsStore.loadSettings(workspaceDocument.portableConfig.simulationSettings);
    this.rotationPlannerStore.loadState({
      startingAdrenaline: workspaceDocument.portableConfig.rotationPlan.startingAdrenaline,
      tickCount: workspaceDocument.portableConfig.rotationPlan.tickCount,
      startingStacks: workspaceDocument.portableConfig.rotationPlan.startingStacks ?? {},
      nonGcdActions: workspaceDocument.portableConfig.rotationPlan.nonGcdActions,
      abilityActions: workspaceDocument.portableConfig.rotationPlan.abilityActions,
      preFight: normalizePreFightPlan(workspaceDocument.portableConfig.rotationPlan.preFight),
    });

    return parseResult;
  }
}
