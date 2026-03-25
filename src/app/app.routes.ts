import { Routes } from '@angular/router';
import { AbilitiesPageComponent } from './features/abilities/abilities-page.component';
import { BuffsPageComponent } from './features/buffs/buffs-page.component';
import { DataExplorerPageComponent } from './features/data-explorer/data-explorer-page.component';
import { GearBuilderPageComponent } from './features/gear/gear-builder-page.component';
import { RotationPlannerPageComponent } from './features/rotation-planner/rotation-planner-page.component';
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
    component: AbilitiesPageComponent,
  },
  {
    path: 'buffs',
    component: BuffsPageComponent,
  },
  {
    path: 'rotation-planner',
    component: RotationPlannerPageComponent,
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
