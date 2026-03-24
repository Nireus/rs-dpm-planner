import { Routes } from '@angular/router';
import { FeaturePlaceholderPageComponent } from './shared/feature-placeholder-page.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'gear',
  },
  {
    path: 'gear',
    component: FeaturePlaceholderPageComponent,
    data: {
      eyebrow: 'Configuration',
      title: 'Gear',
      description:
        'Equip ranged weapons, ammo, armor, and inventory items for the current setup.',
      purpose:
        'This area will eventually handle equipped slots, backpack state, and future gear configuration details.',
    },
  },
  {
    path: 'abilities',
    component: FeaturePlaceholderPageComponent,
    data: {
      eyebrow: 'Reference',
      title: 'Abilities',
      description:
        'Inspect supported ranged abilities, cooldowns, costs, and summary details.',
      purpose:
        'This area will eventually surface availability rules and ability detail views without embedding combat logic in the UI.',
    },
  },
  {
    path: 'buffs',
    component: FeaturePlaceholderPageComponent,
    data: {
      eyebrow: 'Modifiers',
      title: 'Buffs',
      description:
        'Configure the persistent modifiers that shape the simulated rotation scenario.',
      purpose:
        'This area will eventually manage prayers, potions, relics, perks, and other pre-fight selections.',
    },
  },
  {
    path: 'rotation-planner',
    component: FeaturePlaceholderPageComponent,
    data: {
      eyebrow: 'Timeline',
      title: 'Rotation Planner',
      description:
        'Build a manual tick-based ranged rotation with strict validation and clear state inspection.',
      purpose:
        'This area will eventually host the non-GCD lane, ability lane, derived buff lane, and tick inspection UX.',
    },
  },
  {
    path: 'results',
    component: FeaturePlaceholderPageComponent,
    data: {
      eyebrow: 'Simulation',
      title: 'Results',
      description:
        'Review total min, average, and max damage along with contribution breakdowns.',
      purpose:
        'This area will eventually display explainable simulation output driven by the pure TypeScript engine.',
    },
  },
  {
    path: 'import-export',
    component: FeaturePlaceholderPageComponent,
    data: {
      eyebrow: 'Portability',
      title: 'Import / Export',
      description:
        'Save and restore portable versioned planner configurations for local use and sharing.',
      purpose:
        'This area will eventually handle schema-validated import and export workflows for planner state.',
    },
  },
];
