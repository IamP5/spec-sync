# ADR-0002: NgRx Signal Store for state

- Status: accepted
- Date: 2026-09-04

## Context

Angular signals are the primary reactive primitive in this codebase. Feature
state needs a consistent home that agents can recognise and that keeps data
access out of components.

## Decision

Feature state lives in NgRx Signal Stores (`@ngrx/signals`) extended with the
NgRx Toolkit (`@angular-architects/ngrx-toolkit`): `withResource` wraps the
`httpResource` produced by a data access client, `withMutations` covers writes
and `withDevtools` exposes the store to the Redux DevTools.

Stores have exactly one responsibility (search/list, detail/edit, UI state or
lookup data) and are named accordingly (`<Entity>SearchStore`,
`<Entity>DetailStore`, `<Feature>LookupStore`). Stores never depend on other
stores; combining stores is the job of a plain `Coordinator` service.

## Consequences

- Components stay thin: smart components read signals from a store or
  coordinator and forward actions; dumb components only use inputs and
  outputs.
- The conventions are written down in `apps/web/docs/architecture-state-management.md`
  and checked by tsarch (see ADR-0004).
