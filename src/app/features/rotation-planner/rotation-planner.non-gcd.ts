import type { PlannerNonGcdTemplate } from './rotation-planner.utils';
import { ADRENALINE_POTION_VARIANTS } from '../../../simulation-engine/actions/adrenaline-potions';

export const PLANNER_NON_GCD_TEMPLATES: readonly PlannerNonGcdTemplate[] = [
  {
    id: 'adrenaline-potion',
    label: 'Adrenaline Potion',
    shortLabel: 'Adren',
    iconPath: ADRENALINE_POTION_VARIANTS[0].iconPath,
    actionType: 'adrenaline-potion',
  },
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
    iconPath: '/icons/wiki/vulnerability-bomb.png',
    actionType: 'vulnerability-bomb',
  },
];
