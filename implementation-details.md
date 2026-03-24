# Implementation Details

## Document Purpose

This document describes the proposed technical architecture, domain modeling approach, simulation rules, and implementation guardrails for the RuneScape ranged rotation planner MVP.

This document is intentionally guidance, not a rigid contract. It should help the coding agent make good implementation decisions without forcing brittle solutions when requirements evolve during development.

The implementation must remain:

- incremental
- testable
- understandable
- maintainable
- extensible toward future combat styles

## 1. Product and Scope Summary

### MVP Scope

The MVP supports:

- Ranged only
- Single target only
- Desktop-first UI
- No backend
- Local in-browser usage
- Import/export via portable versioned JSON
- Strict validation mode
- Manual planning only
- Theoretical ideal-condition damage simulation
- No hit chance / movement / imperfect encounter factors
- Deterministic mechanics implemented exactly where required
- Probability-based effects approximated by expected value where accepted

### Explicit Non-Goals for MVP

The MVP does not need to support:

- login/auth
- user accounts
- cloud storage
- multiplayer or collaborative editing
- full mobile-first UX
- multiple targets
- AoE/multi-target logic
- backend persistence
- fully automated wiki scraping
- sandbox mode
- all combat styles

## 2. Architecture Overview

The codebase should be split into three clearly separated layers:

### 2.1 `game-data`

**Responsibility:**

- store curated game definitions
- store JSON files
- define data schemas and data loading contracts
- represent "what exists in the game"

**Examples:**

- bows
- ammo
- armor
- abilities
- perks
- relics
- buffs
- EOF special attack definitions
- effect definitions and requirement tags

This layer should not know anything about Angular UI state.

### 2.2 `simulation-engine`

**Responsibility:**

- process a config and a rotation
- build tick state
- resolve cooldowns
- resolve adrenaline
- resolve equipment state transitions
- resolve buff activation windows
- resolve hit schedules
- calculate min / avg / max damage
- produce validation issues
- produce breakdown/explainability output

This should be pure TypeScript, independent of Angular.

This layer should not care:

- how data is displayed
- which panel is open
- how drag and drop is implemented

It should care only about simulation inputs and outputs.

### 2.3 `app/ui`

**Responsibility:**

- render screens
- collect user inputs
- display planners and breakdowns
- display validation issues
- manage local UI interaction state
- call the simulation engine
- present results

This layer should not contain combat math or game rule logic beyond trivial display mapping.

## 3. Proposed Folder Structure

A possible structure:

```text
src/
  app/
    core/
      layout/
      navigation/
      theme/
    shared/
      components/
      ui/
      utils/
    features/
      gear/
      abilities/
      buffs/
      rotation-planner/
      results/
      import-export/
    state/

  game-data/
    abilities/
    items/
    buffs/
    perks/
    relics/
    schemas/
    loaders/
    normalizers/
    types/

  simulation-engine/
    models/
    timeline/
    validation/
    resolvers/
    calculators/
    mechanics/
      ranged/
      shared/
    explainability/
    test/
```

This structure may change, but the separation of responsibilities should remain.

## 4. Technology Guidance

### Recommended Stack

- Angular latest stable
- TypeScript
- Standalone components
- Angular Signals where useful for UI-level state
- Angular CDK for drag-and-drop
- SCSS
- Vitest for unit/integration tests
- Playwright for E2E
- JSON files in repo for game data
- Optional schema validation library if desired

### Avoid in MVP

- NgRx unless there is a strong reason later
- backend frameworks
- database integration
- SSR requirements
- overcomplicated component libraries
- speculative plugin systems too early

## 5. Domain Modeling Principles

### 5.1 Prefer Definitions + Instances

There should be a clear distinction between:

- definitions: static game content
- instances/config: the user's current chosen setup

**Examples**

**Definition**

A bow definition says:

- item ID
- name
- slot type
- tier
- combat style
- offensive stats
- effect hooks

**Instance**

A bow instance in user config says:

- equipped in weapon slot
- chosen perk configuration
- active at this point in timeline or not

This distinction is important because the same item definition may appear:

- equipped
- in inventory
- in swapped state later

### 5.2 Prefer Composable Effect Descriptors Over Giant Hardcoded Objects

Not every mechanic should be hardcoded directly into one giant switch statement.

A useful pattern is:

- data definitions describe categories and references
- engine mechanics interpret effect hooks

Example concept:

```ts
effectRefs: ["bolg-passive", "deathspore-progress"]
```

The engine contains handlers for those references.

This helps keep data readable while allowing exact logic in code.

### 5.3 Separate Persistent Configuration From Timeline-Generated State

Two different kinds of state exist:

**Persistent configuration**

Chosen before simulation:

- equipped gear
- inventory contents
- player stats
- selected prayers
- selected potions
- relics
- passive perks
- permanent-style effects

**Timeline-generated state**

Created during simulation:

- active temporary buffs
- stacks
- cooldowns
- adrenaline values
- active channel windows
- per-tick equipment state
- progress counters like deterministic arrow mechanics

These must not be mixed carelessly.

## 6. Core Data Model Proposal

The exact names may differ, but the model should roughly cover the following.

### 6.1 Game Data Definitions

#### `ItemDefinition`

Suggested fields:

- id
- name
- category
- slot
- combatStyleTags
- tier
- offensiveStats
- requirements
- effectRefs
- configOptions
- inventoryOnlyBehavior
- equipBehavior

#### `AmmoDefinition`

Suggested fields:

- id
- name
- ammoType
- offensiveStats
- effectRefs
- requirements

#### `AbilityDefinition`

Suggested fields:

- id
- name
- style
- subtype (basic, threshold, ultimate, etc.)
- cooldownTicks
- adrenalineCost
- adrenalineGain
- requires
- isChanneled
- channelDurationTicks
- hitSchedule
- baseDamage
- effectRefs
- description

#### `BuffDefinition`

Suggested fields:

- id
- name
- category
- sourceType
- durationTicks or permanent marker
- stackRules
- effectRefs
- displayPriority

#### `PerkDefinition`

Suggested fields:

- id
- name
- effectRefs
- configOptions

#### `RelicDefinition`

Suggested fields:

- id
- name
- effectRefs

#### `EofSpecDefinition`

Suggested fields:

- id
- name
- weaponOrigin
- adrenalineCost
- hitSchedule
- baseDamage
- effectRefs

### 6.2 User Configuration Models

#### `PlayerStats`

Suggested fields:

- ranged level
- prayer level if needed
- relevant combat stats used by rules
- optional toggles if later required

#### `GearSetup`

Suggested fields:

- equipment slots map
- item instance references
- ammo selection
- configurable perks by equipped item

#### `InventoryState`

Suggested fields:

- ordered or unordered inventory item list
- item instance references
- flags for enabled inventory-only mechanics where relevant

#### `PersistentBuffConfig`

Suggested fields:

- selected prayers
- selected potion
- active relics
- selected passive buffs
- selected relevant perks not directly tied to equipped instance config

#### `RotationPlan`

Suggested fields:

- startingAdrenaline
- tickCount
- nonGcdActions
- abilityActions

#### `RotationAction`

Suggested fields:

- id
- tick
- lane
- actionType
- payload

Examples of action payloads:

- ability use
- ammo swap
- gear swap
- vulnerability bomb
- EOF special use
- future supported non-GCD actions

### 6.3 Engine State / Result Models

#### `SimulationConfig`

Suggested fields:

- player stats
- gear setup
- inventory
- persistent buffs
- rotation plan
- loaded game data snapshot
- mode flags

#### `TickState`

Suggested fields:

- tick index
- active equipment state
- active ammo state
- adrenaline
- active buffs
- cooldown map
- channel state
- actions starting this tick
- hits resolving this tick
- validation issues linked to tick

#### `SimulationResult`

Suggested fields:

- validity
- validation issues
- total damage summary
- damage by ability
- damage by tick
- adrenaline timeline
- buff timeline
- cooldown timeline
- tick states
- explainability artifacts

#### `DamageBreakdown`

Suggested fields:

- ability ID
- hit ID or hit index
- base damage min/avg/max
- additive modifiers
- multiplicative modifiers
- expected-value modifiers
- final min/avg/max
- percentage of total

#### `ValidationIssue`

Suggested fields:

- code
- severity
- tick
- related action ID
- human-readable message

## 7. JSON Data Conventions

### 7.1 IDs

IDs should be:

- stable
- lowercase
- kebab-case
- not dependent on display name formatting

Examples:

- `bolg`
- `deathspore-arrows`
- `rapid-fire`
- `elite-dracolich-set`
- `eof-dark-bow-spec`

### 7.2 Keep References Explicit

If an ability or item refers to another concept, prefer explicit IDs over name-based matching.

### 7.3 Keep JSON Curated

Game data in MVP is manually maintained. Do not over-automate early. Curated consistency is more important than speed of adding data.

### 7.4 Include Comments Indirectly if Needed

JSON has no native comments. If necessary, use fields like:

- notes
- sourceNotes
- implementationNotes

But keep them optional and avoid polluting runtime structures if not needed.

## 8. Import / Export Format

Import/export should use a portable versioned JSON document.

Example shape:

```json
{
  "schemaVersion": 1,
  "playerStats": {
    "rangedLevel": 99
  },
  "gearSetup": {},
  "inventory": {},
  "persistentBuffConfig": {},
  "rotationPlan": {
    "startingAdrenaline": 0,
    "tickCount": 30,
    "nonGcdActions": [],
    "abilityActions": []
  }
}
```

### Required Principles

- include `schemaVersion`
- validate before applying
- reject or clearly warn on unknown version
- keep format human-readable
- round-trip cleanly

## 9. Simulation Rules Overview

This section describes the high-level engine behavior.

### 9.1 Tick Model

The engine is tick-based.

Assumptions:

- 1 game tick is the base time unit
- 1 GCD = 3 ticks
- all planner actions are placed on integer ticks
- rotation simulation runs from tick `0` to `tickCount - 1`

The engine should produce state for every tick.

### 9.2 Lanes

#### Lane 1: Non-GCD Actions

Examples:

- ammo swap
- gear swap
- vulnerability bomb
- similar actions not consuming normal GCD ability slot

Multiple actions may exist on the same tick.

#### Lane 2: Ability Use

Contains:

- ability activations
- one primary ability use at a valid start tick according to rules

#### Lane 3: Buff Status

Read-only derived lane. The user does not place actions here.

It visualizes:

- temporary buff windows
- compact stack or progress indicators
- not necessarily permanent passive buffs

### 9.3 Equip and Swap Timing

MVP rule:

- gear and ammo swaps take effect starting from the next tick
- not the same tick they are placed on

This must be consistently enforced.

Example:

- if arrows are swapped on tick `10`
- new arrows apply from tick `11`

This is important for correct hit/state resolution.

### 9.4 Ability Start Timing

**Non-channeled abilities**

- calculations begin on the tick the ability is used
- buffs relevant at that tick should apply according to engine rules

**Channeled abilities**

- occupy their channel window
- their hits resolve according to their hit schedule
- some channeled abilities hit multiple times during channel
- some "charge/complete" abilities only resolve damage at completion

### 9.5 Channeling Rules

For MVP:

- a channeling ability occupies the slot for its full channel duration
- hits may be distributed across channel ticks according to ability definition
- some abilities resolve only at completion
- do not model unsupported beneficial equipment swaps during channel
- if a swap is placed during a channel in a way the MVP does not support, strict mode should reject it or flag it

MVP simplification:

- ammo/gear swap during channel should not modify subsequent channel hits
- unsupported mid-channel optimization cases should not be simulated as beneficial

This keeps behavior deterministic and safe.

### 9.6 Adrenaline Rules

The engine must:

- initialize adrenaline from planner setting
- update adrenaline as abilities resolve according to design
- reject ability use if adrenaline is insufficient at its use tick
- expose adrenaline timeline for UI inspection

Adrenaline should be part of tick state.

### 9.7 Cooldown Rules

The engine must:

- track cooldown start and end
- reject ability reuse before cooldown expires
- expose cooldown state for explainability and UI

### 9.8 Validation Mode

MVP uses strict mode.

Strict mode means:

- invalid actions should not quietly simulate
- engine should return structured errors
- UI should clearly show the plan is invalid

Examples of invalid states:

- using unavailable ability
- insufficient adrenaline
- cooldown violation
- incompatible gear state
- unsupported channel conflict
- action outside timeline bounds

## 10. Damage Calculation Model

### 10.1 Min / Avg / Max Rules

For an ability with base range:

- `min = base minimum`
- `avg = (min + max) / 2`
- `max = base maximum`

Then modifiers are applied according to mechanic type.

### 10.2 Modifier Categories

A useful conceptual order:

1. determine base hit range
2. apply flat additive damage contributions
3. apply multiplicative modifiers
4. apply expected-value adjustments for probabilistic effects
5. produce final min / avg / max

The exact ordering must be documented in code and kept consistent.

### 10.3 Deterministic vs Approximated Mechanics

#### Deterministic mechanics

Must be modeled exactly where required for MVP.

Examples:

- BoLG stateful mechanics
- deterministic arrow progression if required in chosen model
- exact Rapid Fire + Elite Dracolich interaction
- exact temporary buff windows produced by abilities/items where agreed

#### Approximated mechanics

May use expected value.

Examples:

- crit chance
- crit damage bonus
- similar probability-based effects approved for approximation

Example expected-value concept:

- 10% crit chance and 50% extra crit damage may be represented as a 5% average uplift where appropriate

Do not fake deterministic mechanics with average approximations if the product explicitly requires exact handling.

### 10.4 Additive vs Multiplicative Contributions

The breakdown system should preserve modifier types separately.

For explainability, the result should be able to answer:

- how much came from base ability damage
- how much came from additive damage
- how much came from multiplicative buffs
- how much came from expected-value adjustments

This is important for hover/click breakdowns.

## 11. Explainability Model

The application should not just show totals. It should help the user understand why the total is what it is.

### 11.1 Ability Detail Breakdown

For a selected ability/hit, the UI should be able to show:

- base damage range
- modifiers applied
- active buffs at hit time
- active ammo/gear context
- final min/avg/max
- share of total damage

### 11.2 Buff Display

The buff lane should show:

- temporary buff windows
- compact indicators for stacks/progress/charges where needed
- minimal clutter

Permanent passive configuration buffs can live in a separate summary area instead of the timeline.

### 11.3 Tick Inspection

The planner should allow inspecting a tick and seeing:

- current adrenaline
- active buffs
- cooldown state
- active gear/ammo
- hits resolving this tick
- actions occurring this tick

## 12. Ranged MVP Content Model

### 12.1 Supported Weapon Scope

Initial MVP weapon scope:

- bows only
- tier 90 and above
- BoLG as default BiS baseline reference
- no crossbows in MVP

### 12.2 Supported Ammo Scope

Initial MVP ammo scope:

- deathspore arrows
- ful arrows
- wen arrows
- dragonbane arrows

### 12.3 Supported Armor Scope

Initial MVP armor scope:

- sirenic
- elite sirenic
- dracolich
- elite dracolich
- masterwork ranged equipment

### 12.4 Supported Abilities Scope

Initial MVP ability scope:

- all ranged abilities required for ranged planning
- important ranged EOF specs

### 12.5 Supported Modifier Scope

Initial MVP modifier scope:

- DPS-relevant perks
- DPS-relevant relics
- DPS-relevant permanent buffs
- ranged temporary buffs produced by supported abilities/items

## 13. Mechanics Implementation Strategy

Do not try to implement all ranged mechanics at once.

A safer strategy is:

### Stage A: Generic Engine Support

- base timeline
- adrenaline
- cooldowns
- non-channeled hits
- simple buffs
- simple modifiers

### Stage B: Generic Channel Support

- channel occupancy
- hit schedules
- completion-only channels

### Stage C: First Ranged-Specific Mechanics

- chosen ammo mechanics
- chosen set interactions
- chosen exact weapon interactions

### Stage D: Explainability and Scenario Refinement

- breakdown UI
- regression scenarios
- edge case cleanup

This strategy avoids coupling advanced mechanics too early to unfinished infrastructure.

## 14. Suggested Engine Module Responsibilities

A useful breakdown could be:

### `timeline/`

- tick creation
- action placement structures
- basic scheduling helpers

### `validation/`

- bounds validation
- availability validation
- cooldown validation
- adrenaline validation
- channel conflict validation

### `resolvers/`

- equipment state resolver
- ammo state resolver
- buff state resolver
- cooldown resolver
- adrenaline resolver

### `calculators/`

- base damage calculator
- additive modifier calculator
- multiplicative modifier calculator
- expected-value modifier calculator
- total aggregation calculator

### `mechanics/shared/`

- common mechanic helpers
- generic effect hook processing

### `mechanics/ranged/`

- BoLG logic
- deathspore logic
- dracolich logic
- ammo-specific logic
- EOF ranged special logic

### `explainability/`

- damage explanation builders
- human-readable breakdown models

## 15. UI State Guidance

The UI will have state that is not part of simulation config.

Examples:

- selected tab
- search inputs
- open detail drawer
- hovered item
- dragged entity
- selected tick
- zoom or scroll state

This is UI state, not simulation state.

Do not serialize these into import/export config unless there is a clear product reason.

## 16. Recommended Feature Boundaries in Angular

Suggested Angular feature responsibilities:

### `features/gear`

- item search list
- equipment slots
- inventory grid/list
- drag-and-drop
- item configuration editor

### `features/abilities`

- available ability browser
- ability detail panel
- availability explanation

### `features/buffs`

- persistent buff selection
- relic/perk/prayer/potion selection
- summary of active persistent modifiers

### `features/rotation-planner`

- lanes
- tick grid
- action placement
- tick inspection
- validation visualization

### `features/results`

- total min/avg/max
- ability contribution breakdown
- hit detail breakdown

### `features/import-export`

- export current config
- import file
- validation errors for import

## 17. Testing Strategy

### 17.1 Unit Tests

Unit tests should focus heavily on:

- simulation rules
- validation
- damage formulas
- state transitions
- data loading/normalization
- import/export validation

The simulation engine should be the most heavily unit-tested area.

### 17.2 Scenario Tests

Add scenario-style tests for representative ranged rotations.

These should test end-to-end engine behavior for cases like:

- simple rotation
- ammo swap
- cooldown conflict
- channel ability
- deterministic special interaction
- crit/expected-value interaction

### 17.3 UI Tests

UI tests should verify:

- rendering
- interaction flow
- important selectors/state wiring
- drag-and-drop critical paths if feasible

### 17.4 E2E Tests

E2E should cover:

- app load
- configure gear
- configure buffs
- plan rotation
- inspect result
- export/import round trip

## 18. Agent Guardrails

These rules are especially important for Codex-like agents.

### 18.1 Do Not Mix UI Logic With Simulation Logic

If the agent needs to change damage behavior, it should modify the engine, not a component.

### 18.2 Prefer Small Changes

One mechanic at a time is better than broad rewrites.

### 18.3 Keep Data-Driven Where Practical

If a mechanic can be introduced by adding data + a targeted engine hook, prefer that over giant rewrites.

### 18.4 Avoid Speculative Abstraction

Do not build a full universal combat engine for all combat styles before the ranged MVP works.

### 18.5 Keep Unsupported Cases Explicit

If a mid-channel swap optimization or obscure mechanic is not supported yet, fail clearly or flag it instead of silently simulating wrong behavior.

## 19. Suggested Implementation Order for Mechanics

A reasonable order:

- simple non-channeled ranged abilities
- adrenaline and cooldown enforcement
- simple temporary buff application
- simple additive/multiplicative damage modifiers
- channel support
- rapid fire handling
- snipe-style completion resolution
- ammo swap timing
- basic ranged ammo effects
- elite dracolich interaction
- BoLG stateful behavior
- expected-value crit model
- explainability refinement

This order is intentionally infrastructure-first.

## 20. Known Simplifications and Accepted Assumptions

These assumptions are acceptable in MVP unless changed later:

- no hit chance modeling
- no target defense/resistance model
- no movement constraints
- no encounter mechanics
- no multi-target/AoE logic
- no beneficial unsupported mid-channel swap optimization
- expected-value treatment for approved probabilistic effects
- desktop-first UX

These assumptions should be visible in the code or documentation so users and future developers understand the model boundaries.

## 21. Future Evolution Guidance

The MVP should be built so that future expansion is possible without rewriting everything.

Future likely expansions:

- sandbox mode
- melee
- magic
- necromancy
- hybrid JSON + scraper workflow
- presets/templates
- hosting/deployment
- more advanced planner ergonomics

The best preparation for that future is not heavy abstraction. It is:

- clean boundaries
- pure engine
- curated data
- clear tests
- readable models

## 22. Final Recommendation

The project should be treated as:

- a curated domain-heavy simulator
- with a clean TypeScript engine
- and a clear, desktop-first Angular UI

The most important technical success criteria are:

- clean separation of concerns
- exact handling for required deterministic ranged mechanics
- understandable results
- incremental delivery
- strong regression protection through tests

If a tradeoff appears, prefer:

- correctness over cleverness
- clarity over abstraction
- incremental delivery over big-bang implementation
- modularity over component-level combat logic
