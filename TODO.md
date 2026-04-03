# TODO

This file tracks intentionally deferred work that is already known in the current codebase.

## Magic

- Song of Destruction:
  - implement the `30%` immediate-proc / cooldown-reset behavior for `Combust`, `Corruption Blast`, and `Soulfire`
  - validate exact interaction timing when a Song of Destruction proc happens on the same tick as another pending DoT hit
  - decide whether the proc should surface as a dedicated explainability note or a derived-hit artifact

- Fractured Staff of Armadyl:
  - evaluate whether `Lightning Surge` should be modeled with a true proc stream instead of expected value if/when magic crit simulation becomes exact
  - add any later live edge cases around non-primary-target handling only if multi-target simulation is introduced

- Roar of Awakening / Ode to Deceit:
  - add the remaining `Surging Storm` behavior when its full deterministic implementation is ready
  - verify whether additional Soulfire / Essence Corruption refresh rules need explicit cooldown-engine support beyond the current threshold modeling

- EOF specials:
  - expand beyond the currently modeled damage/debuff payloads if future special pages require more than timeline buffs and direct hits
  - consider adding user-facing explainability notes for Guthix staff affinity/defence debuff impact once target-state modeling exists

## Planner / UI

- Magic step 20 follow-up:
  - review whether any remaining magic stack states should move from generic buff displays into dedicated inspection rows
  - add broader interaction-level UI regression coverage for non-GCD utility abilities and spell-swap placement

## General cleanup

- Home page warning:
  - remove the unused `RouterLink` import warning in `src/app/features/home/home-page.component.ts`
