import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BuffConfigurationStoreService } from './core/buffs/buff-configuration-store.service';
import { PlayerStatsStoreService } from './core/player-stats/player-stats-store.service';
import { GearBuilderStore } from './features/gear/gear-builder.store';
import { RotationPlannerStore } from './features/rotation-planner/rotation-planner.store';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly plannerStore = inject(RotationPlannerStore);
  private readonly gearBuilderStore = inject(GearBuilderStore);
  private readonly buffConfigurationStore = inject(BuffConfigurationStoreService);
  private readonly playerStatsStore = inject(PlayerStatsStoreService);

  protected readonly clearStateDialogOpen = signal(false);
  protected readonly navItems = [
    { label: 'Gear', path: '/gear' },
    { label: 'Abilities', path: '/abilities' },
    { label: 'Buffs', path: '/buffs' },
    { label: 'Rotation Planner', path: '/rotation-planner' },
    { label: 'Results', path: '/results' },
    { label: 'Import / Export', path: '/import-export' },
  ];

  protected openClearStateDialog(): void {
    this.clearStateDialogOpen.set(true);
  }

  protected closeClearStateDialog(): void {
    this.clearStateDialogOpen.set(false);
  }

  protected confirmClearState(): void {
    this.clearStateDialogOpen.set(false);
    this.plannerStore.reset();
    this.gearBuilderStore.reset();
    this.buffConfigurationStore.reset();
    this.playerStatsStore.reset();
  }
}
