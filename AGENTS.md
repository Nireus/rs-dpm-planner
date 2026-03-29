# AGENTS.md

## Project purpose

This repository contains a desktop-first web application for planning and simulating **theoretical RuneScape damage output** for manually defined rotations.

The app is intended to help users:
- configure gear and inventory
- configure relevant persistent buffs
- inspect available abilities
- plan a rotation on a tick-based timeline
- calculate theoretical min / avg / max damage under ideal conditions
- inspect buff states, adrenaline, cooldowns, and damage breakdowns
- export and import portable configurations
- save, share, and evolve builds over time as the product grows

This document defines the implementation rules and constraints for coding agents working in this repository.

---

## Current product scope

The project is evolving beyond its original MVP, but the current supported scope is still intentionally constrained.

### Currently supported / current product focus
- **Ranged is the current production focus**
- **Single target only**
- **Desktop-first UI**
- **Strict validation mode by default**
- **Portable versioned import/export**
- **Theoretical ideal-condition damage simulation**
- **Deterministic mechanics implemented exactly where required**
- **Probability-based mechanics approximated by expected value where accepted**
- **Curated game data**
- **Architecture designed to support future persistence, public builds, and community features**

### Not supported yet unless explicitly requested
- melee
- magic
- necromancy
- multiple targets
- AoE simulation
- mobile-first UX
- sandbox mode as default behavior
- full wiki scraping/import pipeline
- broad speculative generalization for all future combat systems

Do not introduce unsupported features unless explicitly requested.

---

## Technical stack

Preferred stack:
- Angular (latest stable used by the project)
- TypeScript
- Standalone components
- Angular Signals where helpful
- Angular CDK for drag and drop
- SCSS
- Vitest for unit/integration testing
- Playwright for E2E
- JSON files for curated game data

Do not introduce unnecessary framework complexity without explicit approval.

Avoid unless clearly justified:
- NgRx
- SSR
- large UI libraries
- speculative plugin systems
- overengineered abstractions for unsupported combat styles

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

This layer must be written as **pure TypeScript** and must not depend on Angular, browser storage, or backend SDKs.

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
- app-level state and view state only

This layer represents **how the user interacts with the simulator**.

### Hard rule
Do **not** place combat calculation logic inside Angular components.

Angular components may:
- collect user input
- call services/selectors/facades
- display simulation results
- manage view state

Angular components must **not** implement:
- damage formulas
- cooldown logic
- adrenaline logic
- timeline resolution
- buff resolution
- effect resolution
- ability availability engine rules beyond trivial display mapping

---

## Product and simulation rules

### Combat scope
- Ranged combat is the current production focus.
- Only single target is supported.
- The simulator models **theoretical perfect-condition damage**.
- Do not model hit chance, target defense, movement requirements, or real fight interruptions unless explicitly requested.

### Tick model
- The engine is tick-based.
- `1 GCD = 3 ticks`.
- Planner actions occur on integer ticks.
- Gear and ammo swaps take effect **starting from the next tick**, not the same tick.

### Channeling
- Channeled abilities occupy their channel window.
- Hits may resolve during channel or only at completion, depending on the ability definition.
- Unsupported beneficial mid-channel swap behavior should not be simulated as valid.
- Swaps during channel should not be modeled as improving later hits of that same channel unless explicitly supported.

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
- crit chance / crit damage -> expected value, only if explicitly treated as approximated

### Validation mode
Default behavior uses **strict validation**.

Invalid actions should produce structured validation errors instead of being simulated silently.

Examples:
- insufficient adrenaline
- cooldown violation
- unavailable ability
- missing gear requirement
- invalid action timing
- unsupported channel conflict

---

## Persistence and backend boundaries

The app may grow into save/share, public builds, voting, auth, and community features, but those concerns must remain isolated from simulation logic.

Rules:
- `simulation-engine/**` must remain framework-agnostic and backend-agnostic
- backend, auth, voting, public builds, analytics, and persistence concerns must not leak into `simulation-engine/**`
- app features must interact with persistence through repository/service/facade boundaries
- local persistence, import/export, and future backend save/share flows must map from the same canonical workspace document or app-level persistence model
- do not couple UI components directly to backend SDK calls when a repository/service abstraction is appropriate
- persistence models may evolve, but simulation inputs/outputs should stay clean and explicit

---

## External sources and URL handling

When the user provides a URL to a web page, the agent must **always use Playwright MCP to inspect that page directly** instead of relying on memory, assumptions, paraphrased recollection, or stale previously seen values.

Rules:
- always open user-provided web page URLs with Playwright MCP before making claims about their contents
- prefer direct inspection of the live page over in-memory assumptions
- if a page cannot be accessed, say so explicitly instead of guessing
- if relevant values are dynamic, verify them from the page at the time of the task
- when debugging issues tied to a live page, use Playwright MCP as the source of truth for visible behavior

This rule applies whenever the user provides a web page URL, even if the agent believes it already knows the page.

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
- Keep persistence mapping separate from both UI rendering and engine logic.

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

## Architecture guardrails and scaling rules

- `app/core/**` must not import from `app/features/**`
- shared helpers used by multiple features must live in `app/core/**`, `app/shared/**`, or `simulation-engine/**`
- do not add direct `window.localStorage`, `sessionStorage`, or future HTTP persistence code in feature stores or components
- all persistence must go through repository-style adapters, services, or facades
- local persistence, import/export, and future backend save/share must all map from the same canonical workspace document
- every new `effectRef`, requirement tag, config option ID, or similar cross-cutting identifier must be added to a central registry, conventions file, or clearly documented shared location
- do not add ad-hoc regex effect parsing in unrelated modules; new effect families must use shared parsers/helpers
- if a module mixes orchestration, view shaping, and domain logic, extract before adding more features
- use `~300` TypeScript lines as a warning threshold and `~450` as a strong extraction threshold
- every new combat mechanic should include:
  - one scenario-style engine test
  - one user-visible verification note or manual verification suggestion
- release priorities are architecture, persistence integrity, import/export integrity, tests, and build health first
- third-party runtime assets should not be expanded casually; existing ones may remain temporarily if low-priority cleanup is more appropriate than churn

### Future product readiness
- future backend save/share/user features must adapt from app-level persistence models
- backend concerns must not leak into `simulation-engine`
- public builds, feature voting, and community metadata must not distort the canonical simulation model

---

## Working approach for agents

### Before implementing
- Read this file first.
- Inspect the relevant planning or implementation docs if they exist.
- Understand which layer the requested change belongs to.
- Minimize the scope of changes.
- Prefer working within the existing architecture over inventing a new one.

### During implementation
- Modify only the relevant files.
- Do not move logic into the wrong layer.
- Avoid speculative abstractions for future combat styles unless they directly help the current product.
- Prefer data-driven extensions where practical, but do not overengineer a universal combat engine too early.
- If a change touches persistence or backend-adjacent code, preserve clean separation from simulation logic.

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
- persistence mapping and serialization logic

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
- persistence flow wiring where practical

### E2E
Playwright tests should cover major happy paths, not every edge case.

---

## Bugfix regression policy

When the user reports a bug, the agent should treat the task as both a fix and a regression-prevention task.

Rules:
- fix the root cause when reasonably possible, not only the visible symptom
- add an automated regression test whenever the bug can be covered in a reliable and maintainable way
- prefer unit tests for pure logic bugs
- prefer scenario-style tests for combat, simulation, and state-transition bugs
- prefer UI or E2E tests only when the bug is truly interaction-specific

If no automated test is added, the agent must explicitly explain why.

When completing a bugfix, report:
- what the root cause was
- what was changed
- what regression test was added
- if no test was added, why not

---

## Preferred delivery style

When completing a task:
1. Make the smallest useful change.
2. Keep the code readable.
3. Keep the project runnable.
4. Add tests if the step changes logic or fixes a bug that can be covered.
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
- avoid unnecessary churn when a localized extension will do

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
3. support for required combat mechanics in the current product scope
4. understandable output and breakdowns
5. strong regression protection via tests
6. persistence and sharing features that do not corrupt simulation correctness