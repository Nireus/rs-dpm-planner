import { Routes } from '@angular/router';
import { DataExplorerPageComponent } from './features/data-explorer/data-explorer-page.component';
import { GearBuilderPageComponent } from './features/gear/gear-builder-page.component';
import { FeaturePlaceholderPageComponent } from './shared/feature-placeholder-page.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'gear',
  },
  {
    path: 'gear',
    component: GearBuilderPageComponent,
  },
  {
    path: 'abilities',
    component: DataExplorerPageComponent,
    data: {
      explorerKind: 'abilities',
      eyebrow: 'Explorer',
      title: 'Abilities',
      description:
        'Inspect supported ranged ability definitions, cooldowns, and hit schedule summaries.',
    },
  },
  {
    path: 'buffs',
    component: DataExplorerPageComponent,
    data: {
      explorerKind: 'buffs',
      eyebrow: 'Explorer',
      title: 'Buffs',
      description:
        'Inspect currently loaded buff definitions and their basic metadata.',
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
