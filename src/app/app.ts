import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { BuffConfigurationStoreService } from './core/buffs/buff-configuration-store.service';
import { CombatChoicesStoreService } from './core/combat-choices/combat-choices-store.service';
import { PlayerStatsStoreService } from './core/player-stats/player-stats-store.service';
import { GearBuilderStore } from './features/gear/gear-builder.store';
import { RotationPlannerStore } from './features/rotation-planner/rotation-planner.store';
import type { ScreenHelpInfo } from './shared/app-screen-info';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly plannerStore = inject(RotationPlannerStore);
  private readonly gearBuilderStore = inject(GearBuilderStore);
  private readonly buffConfigurationStore = inject(BuffConfigurationStoreService);
  private readonly combatChoicesStore = inject(CombatChoicesStoreService);
  private readonly playerStatsStore = inject(PlayerStatsStoreService);
  private readonly currentRouteData = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.readCurrentRouteData()),
    ),
    { initialValue: this.readCurrentRouteData() },
  );

  protected readonly clearStateDialogOpen = signal(false);
  protected readonly infoDialogOpen = signal(false);
  protected readonly navItems = [
    { label: 'Home', path: '/' },
    { label: 'Gear', path: '/gear' },
    { label: 'Buffs', path: '/buffs' },
    { label: 'Abilities', path: '/abilities' },
    { label: 'Spellbook', path: '/spellbook' },
    { label: 'Rotation Planner', path: '/rotation-planner' },
    { label: 'Results', path: '/results' },
    { label: 'Import / Export', path: '/import-export' },
  ];
  protected readonly secondaryNavItems = [
    {
      label: 'Donate',
      href: 'https://ko-fi.com/sweatyrs',
      accent: 'blue',
    },
    {
      label: 'Bug Report / Functionality Request',
      path: '/reporting',
    },
    {
      label: 'Changelog',
      path: '/changelog',
    },
  ];
  protected readonly currentScreenHelp = computed<ScreenHelpInfo | null>(
    () => (this.currentRouteData()?.['screenHelp'] as ScreenHelpInfo | null | undefined) ?? null,
  );

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
    this.combatChoicesStore.reset();
    this.playerStatsStore.reset();
  }

  protected openInfoDialog(): void {
    this.infoDialogOpen.set(true);
  }

  protected closeInfoDialog(): void {
    this.infoDialogOpen.set(false);
  }

  private readCurrentRouteData(): Record<string, unknown> {
    let route: ActivatedRoute | null = this.activatedRoute;

    while (route?.firstChild) {
      route = route.firstChild;
    }

    return route?.snapshot.data ?? {};
  }
}
