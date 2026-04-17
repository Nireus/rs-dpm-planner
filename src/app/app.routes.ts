import { Routes } from '@angular/router';
import { AbilitiesPageComponent } from './features/abilities/abilities-page.component';
import { BuffsPageComponent } from './features/buffs/buffs-page.component';
import { MyBuildsPageComponent } from './features/builds/my-builds-page.component';
import { PublicBuildsPageComponent } from './features/builds/public-builds-page.component';
import { DataExplorerPageComponent } from './features/data-explorer/data-explorer-page.component';
import { GearBuilderPageComponent } from './features/gear/gear-builder-page.component';
import { HomePageComponent } from './features/home/home-page.component';
import { ImportExportPageComponent } from './features/import-export/import-export-page.component';
import { ReportingPageComponent } from './features/reporting/reporting-page.component';
import { RotationPlannerPageComponent } from './features/rotation-planner/rotation-planner-page.component';
import { ResultsPageComponent } from './features/results/results-page.component';
import { SpellbookPageComponent } from './features/spellbook/spellbook-page.component';
import {
  ABILITIES_SCREEN_HELP,
  BUFFS_SCREEN_HELP,
  GEAR_SCREEN_HELP,
  IMPORT_EXPORT_SCREEN_HELP,
  RESULTS_SCREEN_HELP,
  ROTATION_PLANNER_SCREEN_HELP,
  SPELLBOOK_SCREEN_HELP,
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
    path: 'public-builds',
    component: PublicBuildsPageComponent,
  },
  {
    path: 'my-builds',
    component: MyBuildsPageComponent,
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
    path: 'spellbook',
    component: SpellbookPageComponent,
    data: {
      screenHelp: SPELLBOOK_SCREEN_HELP,
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
    path: 'reporting',
    component: ReportingPageComponent,
  },
];
