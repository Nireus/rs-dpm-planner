import { Routes } from '@angular/router';
import { AbilitiesPageComponent } from './features/abilities/abilities-page.component';
import { BuffsPageComponent } from './features/buffs/buffs-page.component';
import { DataExplorerPageComponent } from './features/data-explorer/data-explorer-page.component';
import { GearBuilderPageComponent } from './features/gear/gear-builder-page.component';
import { HomePageComponent } from './features/home/home-page.component';
import { ImportExportPageComponent } from './features/import-export/import-export-page.component';
import { RotationPlannerPageComponent } from './features/rotation-planner/rotation-planner-page.component';
import { ResultsPageComponent } from './features/results/results-page.component';

export const routes: Routes = [
  {
    path: '',
    component: HomePageComponent,
    pathMatch: 'full',
  },
  {
    path: 'home',
    component: HomePageComponent,
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
    component: ResultsPageComponent,
  },
  {
    path: 'import-export',
    component: ImportExportPageComponent,
  },
];
