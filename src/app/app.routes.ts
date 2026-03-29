import { Routes } from '@angular/router';
import { AbilitiesPageComponent } from './features/abilities/abilities-page.component';
import { BuffsPageComponent } from './features/buffs/buffs-page.component';
import { ChangelogPageComponent } from './features/changelog/changelog-page.component';
import { DataExplorerPageComponent } from './features/data-explorer/data-explorer-page.component';
import { GearBuilderPageComponent } from './features/gear/gear-builder-page.component';
import { HomePageComponent } from './features/home/home-page.component';
import { ImportExportPageComponent } from './features/import-export/import-export-page.component';
import { ReportingPageComponent } from './features/reporting/reporting-page.component';
import { RotationPlannerPageComponent } from './features/rotation-planner/rotation-planner-page.component';
import { ResultsPageComponent } from './features/results/results-page.component';
import {
  ABILITIES_SCREEN_HELP,
  BUFFS_SCREEN_HELP,
  GEAR_SCREEN_HELP,
  IMPORT_EXPORT_SCREEN_HELP,
  RESULTS_SCREEN_HELP,
  ROTATION_PLANNER_SCREEN_HELP,
} from './shared/app-screen-info';

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
    data: {
      screenHelp: GEAR_SCREEN_HELP,
    },
  },
  {
    path: 'abilities',
    component: AbilitiesPageComponent,
    data: {
      screenHelp: ABILITIES_SCREEN_HELP,
    },
  },
  {
    path: 'buffs',
    component: BuffsPageComponent,
    data: {
      screenHelp: BUFFS_SCREEN_HELP,
    },
  },
  {
    path: 'rotation-planner',
    component: RotationPlannerPageComponent,
    data: {
      screenHelp: ROTATION_PLANNER_SCREEN_HELP,
    },
  },
  {
    path: 'results',
    component: ResultsPageComponent,
    data: {
      screenHelp: RESULTS_SCREEN_HELP,
    },
  },
  {
    path: 'import-export',
    component: ImportExportPageComponent,
    data: {
      screenHelp: IMPORT_EXPORT_SCREEN_HELP,
    },
  },
  {
    path: 'changelog',
    component: ChangelogPageComponent,
  },
  {
    path: 'reporting',
    component: ReportingPageComponent,
  },
];
