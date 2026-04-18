export const IMPORT_OVERWRITE_CONFIRMATION_MESSAGE =
  'Importing will replace your current local planner state. Continue?';

export function confirmPlannerStateOverwrite(): boolean {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return true;
  }

  return window.confirm(IMPORT_OVERWRITE_CONFIRMATION_MESSAGE);
}
