# Architecture Cleanup and Release-Readiness Plan

## Summary

This is a pre-release stabilization plan focused on making the application safer to extend into a real product.

It prioritizes:

- architecture boundaries
- canonical persistence and state ownership
- import/export completion
- test and release hardening
- module decomposition

Low priority:

- third-party runtime asset replacement is tracked, but is explicitly non-blocking for the near-term cleanup pass

## 1. Goal

Prepare the app for the next stage of productization, especially:

- future backend persistence
- saved builds
- shareable or publishable builds
- release-quality validation and test coverage

The intent is to reduce structural risk before treating the planner as a real released product.

## 2. Action Items

### 1. Canonical Workspace Document

- introduce one app-level `WorkspaceDocument`
- make local persistence, import/export, and future backend save/share all map from that one canonical document
- keep `PortableConfigDocument` as the simulation/share core, but wrap it for app persistence

### 2. Persistence Repository Boundary

- add a `WorkspaceRepository` interface
- move direct persistence access out of feature stores
- use one local-storage implementation now and a backend implementation later

### 3. Layer Boundary Cleanup

- remove all `app/core -> app/features` imports
- move shared helpers into neutral locations
- rename cross-feature services by capability rather than page ownership

### 4. Shared SimulationConfig Builder

- replace duplicated config assembly with one shared builder used by planner, results, and inspection
- centralize persistent-buff grouping and effective-ammo resolution

### 5. Mechanic Contract Standardization

- add central constants or a registry for `effectRefs`, requirement tags, and important config option IDs
- require new mechanic families to use shared parsers and helpers
- extend validation so unknown or malformed effect refs fail clearly

### 6. Large Module Decomposition

- split large planner files into shell, subcomponents, and view-model helpers
- split engine "god files" into pipeline or mechanic modules by responsibility
- split effective ability resolution into dedicated override modules

### 7. Release Hardening

- implement the real Import / Export page
- expand E2E to cover actual happy paths
- resolve or intentionally re-budget current build and style warnings
- add CI checks for boundary violations and unsupported persistence patterns

### 8. Deferred Asset Ownership

- track third-party asset ownership cleanup as low priority
- do not block the near-term cleanup phase on replacing RuneScape Wiki-hosted assets unless hosting or security requirements change

## 3. Suggested Step Breakdown

- `Step 1`: define `WorkspaceDocument` and repository interfaces
- `Step 2`: migrate existing stores behind the shared persistence boundary
- `Step 3`: extract the shared `SimulationConfig` builder
- `Step 4`: remove core/features boundary leaks
- `Step 5`: add effect/tag registry and validator tightening
- `Step 6`: decompose oversized planner and engine modules
- `Step 7`: implement Import / Export UI and roundtrip path
- `Step 8`: expand tests and CI checks
- `Step 9`: leave asset ownership follow-up as explicitly deferred

## 4. Test Plan

Add explicit checks for:

- migration from legacy per-store state into `WorkspaceDocument`
- parity of shared simulation-config building across planner, results, and inspection
- effect/tag registry validation
- boundary enforcement preventing `app/core` importing `app/features`
- import/export roundtrip restoring the same app state
- E2E happy path for configure -> plan -> results -> reload -> export/import

## 5. Assumptions and Defaults

- the plan file path is `docs/architecture-cleanup-and-release-readiness.md`
- `PortableConfigDocument` remains the core simulation/share contract
- third-party asset replacement is tracked but intentionally low priority
- this cleanup plan is intended to happen before treating the app as a real released product
