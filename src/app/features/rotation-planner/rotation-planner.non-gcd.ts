import type { PlannerNonGcdTemplate } from './rotation-planner.utils';

export const PLANNER_NON_GCD_TEMPLATES: readonly PlannerNonGcdTemplate[] = [
  {
    id: 'gear-swap',
    label: 'Gear Swap',
    shortLabel: 'Gear',
    iconPath: 'icons/actions/gear-swap.svg',
    actionType: 'gear-swap',
  },
  {
    id: 'vulnerability-bomb',
    label: 'Vulnerability Bomb',
    shortLabel: 'Vuln',
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Vulnerability%20bomb.png',
    actionType: 'vulnerability-bomb',
  },
];
