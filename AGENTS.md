# AGENTS.md

## Project purpose

This repository contains a desktop-first web application for planning and simulating **theoretical RuneScape ranged damage output** for manually defined rotations.

The app is intended to help users:
- configure gear and inventory
- configure relevant persistent buffs
- inspect available ranged abilities
- plan a rotation on a tick-based timeline
- calculate theoretical min / avg / max damage under ideal conditions
- inspect buff states, adrenaline, cooldowns, and damage breakdowns
- export and import portable configurations

This document defines the implementation rules and constraints for coding agents working in this repository.

---

## MVP scope

The current MVP scope is intentionally limited.

### Supported in MVP
- **Ranged only**
- **Single target only**
- **Desktop-first UI**
- **No backend**
- **No login/auth**
- **Manual JSON game data stored in repo**
- **Strict validation mode**
- **Manual rotation planning only**
- **Portable versioned import/export**
- **Theoretical ideal-condition damage simulation**
- **Deterministic mechanics implemented exactly where required**
- **Probability-based mechanics approximated by expected value where accepted**

### Not part of MVP
- melee
- magic
- necromancy
- multiple targets
- AoE simulation
- mobile-first UX
- backend persistence
- cloud sync
- sandbox mode
- wiki scraping/import pipeline
- collaborative features

Do not introduce non-MVP features unless explicitly requested.

---

## Technical stack

Preferred stack:
- Angular (latest stable)
- TypeScript
- Standalone components
- Angular Signals where helpful
- Angular CDK for drag and drop
- SCSS
- Vitest for unit/integration testing
- Playwright for E2E
- JSON files for curated game data

Do not introduce unnecessary framework complexity without explicit approval.

Avoid:
- NgRx unless clearly justified later
- backend frameworks
- databases
- SSR
- large UI libraries unless there is a strong need

---

## Required architecture

The codebase must remain clearly split into **three layers**:

### 1. `game-data`
Responsibilities:
- curated JSON definitions
- schemas
- loaders
- normalizers
- static game definitions

Examples:
- items
- ammo
- abilities
- buffs
- perks
- relics
- EOF definitions

This layer represents **what exists in the game**.

### 2. `simulation-engine`
Responsibilities:
- timeline resolution
- tick processing
- cooldown tracking
- adrenaline tracking
- gear/ammo state transitions
- buff lifecycle
- hit scheduling
- damage calculation
- validation
- explainability output

This layer represents **how the simulation works**.

This layer must be written as **pure TypeScript** and must not depend on Angular.

### 3. `app/ui`
Responsibilities:
- rendering
- routing
- user interaction
- drag and drop
- panels and forms
- planner display
- results display
- import/export UI
- UI state only

This layer represents **how the user interacts with the simulator**.

### Hard rule
Do **not** place combat calculation logic inside Angular components.

Angular components may:
- collect user input
- call services/selectors
- display simulation results

Angular components must **not** implement:
- damage formulas
- cooldown logic
- adrenaline logic
- timeline resolution
- buff resolution
- ability availability engine rules beyond trivial display mapping

---

## Domain rules and assumptions

### Combat scope
- Only ranged combat is supported in MVP.
- Only single target is supported in MVP.
- The simulator models **theoretical perfect-condition damage**.
- Do not model hit chance, target defense, movement requirements, or real fight interruptions unless explicitly requested later.

### Tick model
- The engine is tick-based.
- 1 GCD = 3 ticks.
- Planner actions occur on integer ticks.
- Gear and ammo swaps take effect **starting from the next tick**, not the same tick.

### Channeling
- Channeled abilities occupy their channel window.
- Hits may resolve during channel or only at completion, depending on the ability definition.
- Unsupported beneficial mid-channel swap behavior should not be simulated as valid.
- In MVP, swaps during channel should not be modeled as improving later hits of that same channel.

### Damage model
For base ability damage:
- `min = base minimum`
- `avg = (min + max) / 2`
- `max = base maximum`

Apply modifiers consistently in code and document the order clearly.

### Deterministic vs approximated mechanics
- Deterministic mechanics required by the product must be implemented exactly.
- Probability-based effects may be approximated using expected value where approved.

Examples:
- deterministic/stateful weapon or ammo behavior -> exact
- crit chance / crit damage -> expected value, if explicitly treated as approximated

### Validation mode
MVP uses **strict validation**.

Invalid actions should produce structured validation errors instead of being simulated silently.

Examples:
- insufficient adrenaline
- cooldown violation
- unavailable ability
- missing gear requirement
- invalid action timing
- unsupported channel conflict

---

## Implementation style rules

### General
- Prefer small, incremental changes.
- Keep each task focused.
- Keep the app buildable after each task.
- Avoid unrelated refactors.
- Do not rewrite large parts of the codebase unless explicitly asked.

### Code organization
- Keep simulation logic modular.
- Prefer pure functions for simulation and calculation logic.
- Prefer explicit models over implicit loosely typed objects.
- Prefer stable IDs and references over name matching.
- Keep data loading separate from data display.
- Keep UI state separate from simulation state.

### Data modeling
- Distinguish between **definitions** and **instances/config**.
- Distinguish between **persistent pre-fight config** and **timeline-generated state**.
- Keep import/export schema versioned and portable.
- Keep JSON game data curated and human-maintainable.

### Unsupported cases
If a mechanic or edge case is not yet supported:
- fail clearly
- add validation or warning
- do not silently simulate incorrect behavior

---

## Working approach for agents

### Before implementing
- Read this file first.
- Inspect the relevant phase or step in project planning docs if they exist.
- Understand which layer the requested change belongs to.
- Minimize the scope of changes.

### During implementation
- Modify only the relevant files.
- Do not move logic into the wrong layer.
- Avoid speculative abstractions for future combat styles unless they directly help the ranged MVP.
- Prefer data-driven extensions where practical, but do not overengineer a generic universal combat engine too early.

### After implementing
- Summarize what changed.
- Mention assumptions.
- Mention any known limitations.
- Suggest manual verification steps.
- Add or update tests where meaningful.

---

## Testing expectations

### Unit testing priority
Unit tests are especially important for:
- simulation engine
- damage formulas
- cooldown logic
- adrenaline logic
- buff/state transitions
- validation rules
- import/export validation
- data loading and normalization

### Scenario tests
Where useful, add scenario-based engine tests for:
- simple ranged rotation
- ammo swap
- cooldown conflict
- channel ability
- deterministic special mechanic
- expected-value modifier behavior

### UI testing
UI tests should focus on:
- rendering
- interaction wiring
- planner state behavior
- import/export behavior
- critical user flows

### E2E
Playwright tests should cover major happy paths, not every edge case.

---

## Preferred delivery style

When completing a task:
1. Make the smallest useful change.
2. Keep the code readable.
3. Keep the project runnable.
4. Add tests if the step changes logic.
5. Report:
   - what changed
   - what assumptions were made
   - how to manually verify

---

## Change management rules

This repository will evolve during development.

Treat planning documents as **guidance**, not as rigid contracts.

If requirements shift:
- preserve architecture boundaries
- prefer updating rule modules and data definitions over broad UI rewrites
- keep the simulation engine isolated and testable
- do not force old assumptions if the product direction changes

---

## First-principles priorities

If tradeoffs appear, prefer:
1. correctness over cleverness
2. clarity over abstraction
3. testability over convenience
4. small incremental delivery over big-bang implementation
5. maintainability over short-term hacks

---

## Repository priorities summary

The highest-priority engineering goals in this repository are:
1. clean separation of concerns
2. correct tick-based simulation behavior
3. support for required ranged MVP mechanics
4. understandable output and breakdowns
5. strong regression protection via tests
