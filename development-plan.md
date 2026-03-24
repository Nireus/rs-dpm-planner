# Development Plan

## Project Overview

Build a desktop-first, single-page web application that helps RuneScape players estimate theoretical ranged damage output for a manually planned rotation under ideal conditions.

The MVP scope is intentionally limited to:

- Ranged only
- Single target only
- No backend
- Manual JSON data stored in repo
- Strict validation
- Portable versioned import/export
- Deterministic mechanics implemented exactly where required
- Probabilistic mechanics approximated via expected value where acceptable

The project must be implemented in a way that keeps three areas clearly separated:

- `game-data`
- `simulation-engine`
- `app/ui`

The plan below is intentionally phase-based and step-based so that Codex can work incrementally and each step can be manually and automatically tested.

## Working Rules for the Coding Agent

### General Rules

- Do not implement large cross-cutting changes in one step.
- Keep `game-data`, `simulation-engine`, and `app/ui` separated.
- Do not put combat simulation logic inside Angular components.
- Prefer small, testable, reviewable commits.
- Every completed step must leave the app in a runnable state.
- Every step should include:
  - implementation
  - unit tests where meaningful
  - manual verification notes
- If a design issue appears mid-development, prefer small extension-friendly abstractions instead of speculative overengineering.
- Avoid introducing backend, auth, database, or scraping functionality in MVP phases unless explicitly requested in later optional phases.
- Use desktop-first responsive layout. Mobile can degrade gracefully.
- Use a simple dark theme from the start, but avoid heavy game-themed styling.

### Recommended Stack

- Angular latest stable
- TypeScript
- Standalone components
- Angular Signals for UI state where helpful
- Angular CDK for drag and drop
- SCSS
- Vitest for unit/integration tests
- Playwright for E2E
- JSON files in repo for game data
- Portable versioned JSON for import/export

## Phase 1 - Project Foundation

### Goal

Create a clean Angular application foundation with correct tooling, folder structure, dark theme baseline, and test setup.

### Step 1.1 - Initialize Project and Base Tooling

#### Tasks

- Create a new Angular application.
- Use standalone components.
- Enable SCSS.
- Set up linting and formatting if not already included.
- Set up Vitest for unit tests.
- Set up Playwright for E2E tests.
- Add npm scripts for:
  - `dev`
  - `build`
  - `test`
  - `test:watch`
  - `e2e`
  - `lint`

#### Acceptance Criteria

- App runs locally.
- App builds successfully.
- Unit tests can run successfully.
- E2E test runner can launch.
- Base scripts are documented in README or package scripts.

#### Manual Test Checklist

- Run app locally.
- Confirm dark background and readable text.
- Confirm test command works.
- Confirm build command works.

#### Unit Test Checklist

- Add one trivial smoke test for a helper or app bootstrap utility.

### Step 1.2 - Create Base Folder Structure

#### Tasks

Create a clear structure similar to:

```text
src/
  app/
    core/
    shared/
    features/
      gear/
      abilities/
      buffs/
      rotation-planner/
      import-export/
      results/
  game-data/
    items/
    abilities/
    buffs/
    perks/
    relics/
    schemas/
  simulation-engine/
    core/
    timeline/
    rules/
    calculators/
    validation/
    models/
    test/
```

Adjust names if needed, but preserve the logical separation.

#### Acceptance Criteria

- Folder structure exists.
- No feature code placed in the wrong layer.
- Placeholder README files or index files explain layer responsibilities.

#### Manual Test Checklist

- Review folder structure and confirm it matches architecture intent.

#### Unit Test Checklist

- Not required for this step.

### Step 1.3 - Create Base App Shell

#### Tasks

- Add top-level layout shell.
- Add navigation for:
  - Gear
  - Abilities
  - Buffs
  - Rotation Planner
  - Results
  - Import / Export
- Add placeholder pages for each section.
- Add simple dark theme tokens and reusable layout primitives.
- Use a dark forest palette as the visual baseline:
  - `#002400`
  - `#273b09`
  - `#58641d`
  - `#7b904b`

#### Acceptance Criteria

- App has stable navigation.
- Each section renders without errors.
- Theme is readable and consistent.
- The shell visually follows the dark forest palette direction.

#### Manual Test Checklist

- Navigate between all sections.
- Confirm no layout breakage on desktop.

#### Unit Test Checklist

- Smoke test for app shell render.

## Phase 2 - Domain Model and Schema Foundation

### Goal

Define the core domain model and establish a versioned JSON schema approach before implementing UI and simulation behavior.

### Step 2.1 - Define Core TypeScript Models

#### Tasks

Create domain types/interfaces for at least:

- `ItemDefinition`
- `AmmoDefinition`
- `AbilityDefinition`
- `BuffDefinition`
- `PerkDefinition`
- `RelicDefinition`
- `PlayerStats`
- `GearSetup`
- `InventoryState`
- `RotationAction`
- `RotationPlan`
- `SimulationConfig`
- `SimulationResult`
- `DamageBreakdown`
- `TickState`
- `ValidationIssue`

#### Acceptance Criteria

- Types compile cleanly.
- Types are grouped by responsibility.
- No Angular dependency exists inside simulation models.

#### Manual Test Checklist

- Review models for clarity and extensibility.

#### Unit Test Checklist

- Not required unless validation helpers are introduced.

### Step 2.2 - Define Portable Import / Export Schema

#### Tasks

Create a versioned schema for application state export/import.

Minimum shape:

```json
{
  "schemaVersion": 1,
  "playerStats": {},
  "gearSetup": {},
  "inventory": {},
  "activeConfigBuffs": {},
  "rotationPlan": {}
}
```

Include validation approach:

- runtime validation for imported JSON
- schema version compatibility check
- graceful error handling for invalid files

#### Acceptance Criteria

- Schema version exists.
- Invalid shape is detectable.
- Future schema migrations are possible.

#### Manual Test Checklist

- Inspect example exported JSON.
- Confirm schema is understandable by a human.

#### Unit Test Checklist

- Valid import example parses.
- Invalid import example fails with clear error.
- Wrong `schemaVersion` is rejected or flagged.

### Step 2.3 - Create Initial Game Data File Conventions

#### Tasks

Define conventions for JSON game-data files:

- file naming
- IDs
- enum/tag usage
- references between files
- effect descriptors
- cooldown definitions
- channel definitions
- equipment requirement definitions

#### Acceptance Criteria

- Data conventions are documented.
- Example JSON files exist for at least a few sample entries.

#### Manual Test Checklist

- Review example JSON and confirm it is maintainable.

#### Unit Test Checklist

- Add parser/loading tests for sample JSON.

## Phase 3 - Read-Only Game Data Explorer

### Goal

Load JSON data into the app and provide a read-only explorer before editing workflows begin.

### Step 3.1 - Implement Game-Data Loading Layer

#### Tasks

- Load JSON data from repo.
- Normalize data into lookup maps by ID.
- Handle loading errors cleanly.
- Expose data through dedicated services/adapters.

#### Acceptance Criteria

- App can load sample game data.
- Data access is centralized.
- Components do not parse raw JSON directly.

#### Manual Test Checklist

- Open app and confirm sample data is visible somewhere in UI.

#### Unit Test Checklist

- Test normalization helpers.
- Test missing reference detection if applicable.

### Step 3.2 - Create Read-Only Explorer Pages

#### Tasks

- Add read-only lists/cards/tables for:
  - items
  - ranged abilities
  - buffs
  - perks/relics
- Add search/filter support.

#### Acceptance Criteria

- User can inspect currently loaded definitions.
- Explorer helps verify data before simulation features exist.

#### Manual Test Checklist

- Search for sample ability/item and verify details display.

#### Unit Test Checklist

- Test filtering/search helpers.

## Phase 4 - Gear Builder MVP

### Goal

Allow the user to define equipped ranged gear and backpack contents.

### Step 4.1 - Build Gear Slot Model and UI

#### Tasks

Support equipment slots relevant to ranged MVP:

- weapon
- ammo
- head
- body
- legs
- hands
- feet
- ring
- amulet
- cape
- pocket

Represent backpack separately.

#### Acceptance Criteria

- User can assign supported items to slots.
- User can place supported items into inventory/backpack.
- UI clearly distinguishes equipped vs inventory.

#### Manual Test Checklist

- Equip a bow.
- Equip arrows.
- Put alternate ammo in inventory.
- Put inventory-only enabling item in backpack.

#### Unit Test Checklist

- Slot validation tests.
- Item compatibility tests.

### Step 4.2 - Add Drag-and-Drop Interactions

#### Tasks

- Implement drag and drop from searchable item list to equipment slots or inventory.
- Support moving/removing items.
- Prevent invalid placements.

#### Acceptance Criteria

- DnD works reliably on desktop.
- Invalid target interactions are blocked.
- UI feedback is clear.

#### Manual Test Checklist

- Drag supported item into valid slot.
- Attempt invalid drop.
- Move equipped item back to inventory.
- Replace one ammo item with another.

#### Unit Test Checklist

- Test drop validation helpers.

### Step 4.3 - Add Item Detail and Configurable Properties

#### Tasks

Support configurable properties for items where needed, such as:

- perks on armor
- perks on weapons
- special embedded effect references where applicable

Do not implement all effects yet; only structure and editable fields.

#### Acceptance Criteria

- Configurable items expose editable details.
- Configuration persists in app state.

#### Manual Test Checklist

- Add item with configurable properties.
- Edit property.
- Confirm state updates.

#### Unit Test Checklist

- Config serialization tests.

## Phase 5 - Ability Availability and Player Stats

### Goal

Show which abilities are available based on current setup and player stats.

### Step 5.1 - Add Player Stats Configuration

#### Tasks

- Allow user to set relevant player stats/levels used for ability availability and damage scaling.

#### Acceptance Criteria

- Stats can be edited.
- Stats persist in local app state.
- Downstream systems can read them.

#### Manual Test Checklist

- Change ranged-related stats and confirm app state updates.

#### Unit Test Checklist

- Validation tests for stat ranges.

### Step 5.2 - Implement Ability Availability Rules

#### Tasks

Determine ability availability based on:

- equipped ranged weapon requirements
- inventory-supported enablement rules where applicable
- level/stat requirements
- always-available categories if relevant
- EOF-based special access for ranged special attacks

#### Acceptance Criteria

- Available abilities update when gear/stats change.
- Unavailable abilities are either hidden or clearly marked unavailable.

#### Manual Test Checklist

- Equip bow and confirm ranged abilities appear.
- Remove required setup and confirm some abilities disappear or disable.

#### Unit Test Checklist

- Ability availability rule tests for multiple scenarios.

### Step 5.3 - Ability Details Panel

#### Tasks

On click or hover, show:

- name
- category
- cooldown
- adrenaline impact
- damage range %
- supported hit schedule summary
- descriptive text

Nominal damage output can stay placeholder until engine exists.

#### Acceptance Criteria

- Ability detail panel works from ability list.

#### Manual Test Checklist

- Open multiple ability details and verify content.

#### Unit Test Checklist

- Not required unless derived selector logic exists.

## Phase 6 - Buffs and Passive Modifiers Configuration

### Goal

Allow the user to configure externally active DPS-relevant buffs and passive modifiers.

### Step 6.1 - Build Buffs Configuration UI

#### Tasks

Allow adding/removing active buffs from supported categories:

- prayers that affect damage
- potions
- passive permanent buffs
- pocket slot effects
- archaeology relics
- relevant perks affecting DPS

Exclude temporary combat buffs that come from rotation actions here if they should instead be generated by engine events.

#### Acceptance Criteria

- User can activate/deactivate supported buffs.
- Buffs are searchable/filterable.
- Active buffs are clearly visible.

#### Manual Test Checklist

- Add prayer, potion, relic.
- Remove one and confirm state updates.

#### Unit Test Checklist

- Buff selection state tests.

### Step 6.2 - Distinguish Permanent vs Timeline-Generated Buffs

#### Tasks

Create a distinction between:

- persistent pre-fight modifiers
- buffs generated during simulation by abilities/items/events

#### Acceptance Criteria

- Domain model clearly separates the two.
- UI reflects the difference.

#### Manual Test Checklist

- Confirm permanent buffs do not clutter the future timeline display.

#### Unit Test Checklist

- State transformation tests.

## Phase 7 - Core Simulation Engine Foundation

### Goal

Create the engine skeleton before exact advanced mechanics.

### Step 7.1 - Implement Base Timeline Model

#### Tasks

Define:

- tick indexing
- action placement
- 1 GCD = 3 ticks
- non-GCD action lane
- ability lane
- derived buff lane
- starting adrenaline
- total tick count

#### Acceptance Criteria

- Timeline structures exist.
- Timeline can represent actions by tick.
- Basic validation exists for bounds.

#### Manual Test Checklist

- Create sample timeline in code and inspect output.

#### Unit Test Checklist

- Tick boundary tests.
- Timeline insertion tests.

### Step 7.2 - Implement Strict Validation Engine

#### Tasks

Validate at minimum:

- action placement within timeline bounds
- insufficient adrenaline
- ability cooldown conflicts
- missing required gear
- invalid action overlap rules
- invalid slot/equip state at time of use

#### Acceptance Criteria

- Invalid plans produce structured validation issues.
- Engine can reject illegal rotations in strict mode.

#### Manual Test Checklist

- Create invalid scenarios and confirm readable errors.

#### Unit Test Checklist

- One test per validation rule category.

### Step 7.3 - Implement Adrenaline Model

#### Tasks

- Support starting adrenaline.
- Apply adrenaline gains/costs from abilities.
- Prevent invalid ability use when adrenaline is insufficient.
- Track adrenaline value per tick.

#### Acceptance Criteria

- Engine produces adrenaline timeline.
- Strict validation blocks illegal ability usage.

#### Manual Test Checklist

- Build simple plan and inspect adrenaline progression.

#### Unit Test Checklist

- Gain/cost tests.
- Boundary tests at 0 and 100 or allowed range.

### Step 7.4 - Implement Cooldown Tracking

#### Tasks

- Track ability cooldowns.
- Enforce no reuse before cooldown expires.
- Expose cooldown state for UI inspection.

#### Acceptance Criteria

- Cooldown violations are caught.
- Cooldown data is available in simulation result.

#### Manual Test Checklist

- Reuse an ability too early and confirm rejection.

#### Unit Test Checklist

- Cooldown scheduling tests.

## Phase 8 - Rotation Planner UI

### Goal

Build the interactive planner UI that drives the engine.

### Step 8.1 - Planner Layout and Lanes

#### Tasks

Create planner view with:

- controls for starting adrenaline
- controls for number of ticks
- lane 1: non-GCD actions
- lane 2: ability usage
- lane 3: buff status (read-only)

#### Acceptance Criteria

- Planner layout is stable and readable on desktop.
- Tick grid is visible.
- Lane purposes are clear.

#### Manual Test Checklist

- Open planner and confirm all major sections are visible.

#### Unit Test Checklist

- Not required for layout-only step.

### Step 8.2 - Ability Drag-and-Drop Into Timeline

#### Tasks

- Allow dragging abilities into ability lane.
- Enforce lane-specific constraints.
- Visualize style color for ranged-related entries and other shared categories if needed.

#### Acceptance Criteria

- User can place abilities on ticks.
- Illegal placement is blocked in strict mode.

#### Manual Test Checklist

- Add legal ability.
- Attempt illegal placement.
- Move ability to different tick.

#### Unit Test Checklist

- Planner action insertion helper tests.

### Step 8.3 - Non-GCD Action Placement

#### Tasks

Allow placing non-GCD actions such as:

- gear swaps
- ammo swaps
- vulnerability bomb
- similar supported actions

Allow stacking multiple non-GCD actions on same tick visually.

Respect overlap rules.

#### Acceptance Criteria

- Multiple non-GCD actions can appear on same tick.
- UI remains readable.

#### Manual Test Checklist

- Place multiple non-GCD actions in one tick.
- Verify visual stacking.

#### Unit Test Checklist

- Overlap stacking helper tests.

### Step 8.4 - Tick Inspection Cursor / Slider

#### Tasks

Allow user to inspect any tick and view:

- current adrenaline
- active buffs
- relevant gear/ammo state
- cooldown state
- action/hit details occurring at that tick

#### Acceptance Criteria

- Tick inspection updates correctly as user moves through timeline.

#### Manual Test Checklist

- Move cursor across multiple ticks and confirm data changes.

#### Unit Test Checklist

- Tick selection derived state tests.

## Phase 9 - First End-to-End Simulation Result

### Goal

Connect planner inputs to a working damage simulation pipeline.

### Step 9.1 - Base Hit Scheduling and Damage Calculation

#### Tasks

Implement first-pass support for:

- non-channeled abilities
- base hit timing
- min/avg/max calculation
- flat additive damage contributions
- multiplicative damage contributions
- expected value treatment for approximated effects

#### Acceptance Criteria

- Engine returns total min/avg/max damage for a simple valid rotation.
- Result includes per-action and per-hit breakdown.

#### Manual Test Checklist

- Simulate simple rotation and inspect totals.

#### Unit Test Checklist

Damage formula tests for:

- base min
- base avg
- base max
- flat additive effect
- multiplicative effect

### Step 9.2 - Results Panel

#### Tasks

Show:

- total min damage
- total avg damage
- total max damage
- optionally DPT / estimated DPS based on timeline length
- per-ability contribution
- ability detail breakdown

#### Acceptance Criteria

- Results update when rotation changes.
- User can inspect which ability contributed what.

#### Manual Test Checklist

- Change rotation and confirm totals change.

#### Unit Test Checklist

- Selector/aggregation tests.

## Phase 10 - Channeling Support

### Goal

Support channeled ranged abilities correctly.

### Step 10.1 - General Channeling Model

#### Tasks

Implement channel support with:

- occupied channel window
- hit schedule per channel ability
- per-tick hit resolution where relevant
- support for abilities like Snipe where damage resolves only at completion
- rule that swaps during channel are not recommended and not modeled as affecting subsequent hits
- prohibit or warn on unsupported channel swap cases according to strict MVP design

#### Acceptance Criteria

- Engine can represent channel start, duration, and hit timings.
- At least one channeling ability and one charge-style ability are supported.

#### Manual Test Checklist

- Add Rapid Fire and inspect scheduled hits.
- Add Snipe and confirm damage resolves at completion.

#### Unit Test Checklist

- Channel hit timing tests.
- Completion-only hit tests.
- Channel occupancy validation tests.

## Phase 11 - Exact Ranged Mechanic Support for MVP Priority Features

### Goal

Implement the first meaningful set of ranged-specific mechanics needed for the desired MVP.

### Step 11.1 - Add Supported Ranged Gear and Ammo Dataset

#### Tasks

Add manual JSON data for MVP-supported:

- bows t90+
- BoLG as default BiS reference
- deathspore arrows
- ful arrows
- wen arrows
- dragonbane arrows
- sirenic / elite sirenic
- dracolich / elite dracolich
- masterwork ranged equipment
- relevant EOF ranged specs
- DPS-relevant perks/relics

#### Acceptance Criteria

- Data exists and loads cleanly.
- IDs and references are consistent.

#### Manual Test Checklist

- Verify each category appears in data explorer and selection UIs.

#### Unit Test Checklist

- JSON consistency tests.

### Step 11.2 - Implement Deterministic Priority Mechanics

#### Tasks

Implement exact handling for mechanics explicitly required for MVP where approximation is not acceptable.

Examples include:

- BoLG arrow/state-dependent behavior
- deathspore arrow progression if deterministic in chosen model
- rapid fire + elite dracolich interaction
- exact buff windows produced by ranged abilities and supported items where required

#### Acceptance Criteria

- Engine supports required exact mechanics for chosen MVP scenarios.
- Mechanics are test-covered with concrete examples.

#### Manual Test Checklist

- Recreate at least one known expected interaction flow and inspect tick-by-tick result.

#### Unit Test Checklist

- Dedicated scenario tests per mechanic.

### Step 11.3 - Implement Approximated Probabilistic Mechanics

#### Tasks

Implement expected-value treatment for suitable mechanics, such as:

- crit chance contributions
- crit damage bonus contributions
- similar probability-based modifiers approved for approximation

#### Acceptance Criteria

- Expected-value logic is documented and test-covered.
- UI can explain that some effects are approximated.

#### Manual Test Checklist

- Compare totals before and after enabling crit-related modifier.

#### Unit Test Checklist

- Expected-value formula tests.

## Phase 12 - Buff Lane and Explainability

### Goal

Make simulation results understandable, not just numerically correct.

### Step 12.1 - Buff Lane Visualization

#### Tasks

Show timeline-derived buffs on lane 3:

- active duration bars
- compact stack/charge/progress indicators where needed
- avoid clutter for permanent pre-fight modifiers

#### Acceptance Criteria

- Buff lane is readable.
- Important temporary buffs are visible.
- Stack/progress presentation is compact.

#### Manual Test Checklist

- Simulate rotation with multiple overlapping buffs and inspect readability.

#### Unit Test Checklist

- Derived buff timeline state tests.

### Step 12.2 - Damage Explanation Panel

#### Tasks

For a selected ability or hit, show:

- base damage contribution
- additive damage sources
- multiplicative damage sources
- expected-value adjustments
- share of total rotation damage

#### Acceptance Criteria

- User can inspect why a result is what it is.
- Breakdown is understandable without reading code.

#### Manual Test Checklist

- Hover or click planned ability and inspect breakdown.

#### Unit Test Checklist

- Breakdown composition tests.

## Phase 13 - Import / Export

### Goal

Allow users to save and share configurations.

### Step 13.1 - Export Current Configuration

#### Tasks

Export:

- player stats
- gear setup
- inventory
- active pre-fight buffs
- planner actions
- settings needed to reproduce the simulation

#### Acceptance Criteria

- Exported JSON is valid and versioned.
- Export can be downloaded by user.

#### Manual Test Checklist

- Export a setup and inspect JSON file.

#### Unit Test Checklist

- Export serialization tests.

### Step 13.2 - Import Configuration

#### Tasks

- Allow importing previously exported JSON.
- Validate schema version and structure.
- Restore all supported state cleanly.

#### Acceptance Criteria

- Valid file restores state.
- Invalid file shows readable error.
- Importing does not corrupt app state.

#### Manual Test Checklist

- Export then import same file and confirm state matches.

#### Unit Test Checklist

- Round-trip import/export tests.
- Invalid file tests.

## Phase 14 - Hardening and Polish

### Goal

Stabilize the MVP and reduce regression risk.

### Step 14.1 - Improve Validation UX

#### Tasks

- Present validation issues clearly.
- Highlight invalid timeline entries.
- Make strict mode errors easy to understand.

#### Acceptance Criteria

- User understands why a plan is invalid.

#### Manual Test Checklist

- Create multiple invalid plans and verify clarity.

#### Unit Test Checklist

- Validation message mapping tests.

### Step 14.2 - Add Regression Test Scenarios

#### Tasks

Create representative simulation scenarios for:

- simple bow rotation
- ammo swap flow
- channel ability flow
- adrenaline edge case
- cooldown violation
- deterministic special interaction
- expected-value buff interaction

#### Acceptance Criteria

- Scenarios run in automated tests.
- Major regressions are caught.

#### Manual Test Checklist

- Spot-check at least two scenarios in UI.

#### Unit Test Checklist

- Scenario test suite added.

### Step 14.3 - E2E Happy Path Coverage

#### Tasks

Add Playwright tests covering:

- app load
- gear assignment
- buff selection
- planner interaction
- result generation
- export/import round trip

#### Acceptance Criteria

- Main user flow is covered by E2E.
- Tests are stable enough for repeated local runs.

#### Manual Test Checklist

- Run E2E suite locally.

#### Unit Test Checklist

- Not applicable.

## Optional Future Phases

These are explicitly out of MVP unless requested later.

### Optional Phase A - Sandbox Mode

- Allow invalid actions with warnings instead of blocking them.
- Compare strict vs sandbox outputs.

### Optional Phase B - Additional Combat Styles

- Melee
- Magic
- Necromancy

### Optional Phase C - Wiki-Assisted Data Pipeline

- Hybrid JSON + scraper workflow
- Validation against curated repo data
- Manual review layer to avoid bad imports

### Optional Phase D - Presets and Helper Tools

- Prebuilt rotations
- Copy/paste timeline segments
- Rotation templates
- More advanced planner ergonomics

### Optional Phase E - Hosting and Deployment

- Static hosting
- CI pipeline
- Production build checks
- Lightweight analytics if desired

## Definition of Done for MVP

The MVP is considered done when all of the following are true:

- User can configure ranged gear and inventory.
- User can configure relevant player stats.
- User can configure supported persistent buffs/perks/relics.
- User can manually build a ranged rotation on a tick-based planner.
- Strict mode prevents invalid plans.
- Engine computes min/avg/max total damage under ideal conditions.
- Engine supports the agreed MVP ranged mechanics, with exact handling where required and expected-value approximations where accepted.
- User can inspect buff states and damage breakdowns.
- User can export and import a portable versioned config.
- The project has meaningful unit test coverage and basic E2E coverage.

## Suggested Execution Order for Codex

Codex should work phase by phase in this order:

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 6
7. Phase 7
8. Phase 8
9. Phase 9
10. Phase 10
11. Phase 11
12. Phase 12
13. Phase 13
14. Phase 14

Do not skip ahead to advanced ranged mechanics before the engine skeleton and planner are already functioning.

## Agent Guidance for Change Management

If requirements change during development:

- prefer updating data definitions and rule modules first
- avoid rewriting the planner UI unless necessary
- keep simulation rules modular
- document deviations from this plan directly in the code or in a short changelog section

This plan is a guide, not a rigid contract. The implementation may evolve, but it must preserve:

- separation of concerns
- testability
- incremental delivery
- human readability
- maintainability for future combat style expansion
