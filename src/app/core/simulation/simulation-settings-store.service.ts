import { effect, inject, Injectable, signal } from '@angular/core';
import type { SimulationSettings } from '../../../simulation-engine/models';
import {
  DEFAULT_SIMULATION_SETTINGS,
  normalizeCriticalHitResolutionMode,
  normalizeSerenGodbowTargetSize,
  normalizeSimulationSettings,
} from '../../../simulation-engine/models';
import { WorkspaceRepositoryService } from '../workspace/workspace-repository.service';

@Injectable({
  providedIn: 'root',
})
export class SimulationSettingsStoreService {
  private readonly workspaceRepository = inject(WorkspaceRepositoryService);
  private readonly settingsValue = signal<SimulationSettings>({
    ...DEFAULT_SIMULATION_SETTINGS,
    ...this.workspaceRepository.readSimulationSettings(),
  });

  readonly settings = this.settingsValue.asReadonly();

  constructor() {
    effect(() => {
      this.workspaceRepository.updateSimulationSettings(this.settings());
    });
  }

  updateCriticalHitResolutionMode(mode: string | null): void {
    this.settingsValue.update((current) => ({
      ...current,
      criticalHitResolutionMode: normalizeCriticalHitResolutionMode(mode),
    }));
  }

  updateSerenGodbowTargetSize(targetSize: string | null): void {
    this.settingsValue.update((current) => ({
      ...current,
      serenGodbowTargetSize: normalizeSerenGodbowTargetSize(targetSize),
    }));
  }

  loadSettings(settings: Partial<SimulationSettings> | undefined): void {
    this.settingsValue.set(normalizeSimulationSettings(settings));
  }
}
