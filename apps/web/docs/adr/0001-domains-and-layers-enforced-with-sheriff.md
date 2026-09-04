# ADR-0001: Domains and layers enforced with Sheriff

- Status: accepted
- Date: 2026-09-04

## Context

`apps/web` starts small, but it is developed with AI coding agents that
generate a lot of code quickly. Without machine-checked boundaries, an agent
places code wherever it compiles, and the architecture erodes silently.

## Decision

The application is organised into **domains** under
`apps/web/src/app/domains/<domain>`, each with **layers** `feature`, `ui`,
`data` and `util` (folder prefixes `feature-`, `ui-`, `data-`, `util-` or the
plain folders `data`, `ui`, `util`). Layers may only be accessed from top to
bottom (`feature → ui → data → util`), domains do not access one another
directly, and `shared` collects technical code used by several domains.

[Sheriff](https://sheriff.softarc.io) tags every folder with `domain:<domain>`
and `type:<layer>` and enforces the dependency rules in `apps/web/sheriff.config.ts` as
an ESLint rule, so violations surface in `nx lint` and in the agent stop hook.

The Zard design-system library `libs/ui` is tagged `domain:shared` and
`type:ui-kit`; every layer from `ui` upwards may use it.

## Consequences

- Sheriff errors are architecture feedback, not lint noise. Fix the code, not
  the rule. Sheriff changes require an explicit user request.
- Nx module boundaries (`@nx/enforce-module-boundaries`) keep governing
  dependencies _between_ Nx projects; Sheriff governs folders _inside_
  `apps/web`.
