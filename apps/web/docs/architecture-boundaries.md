# Architecture Rules

## Goal

This document defines the architecture rules for the Angular application in
`apps/web` and the UI library in `libs/ui`. Both agents and developers are
required to adhere to these rules whenever they modify application code.

The rules are enforced deterministically by:

- **Sheriff** (`apps/web/sheriff.config.ts`, runs as part of `nx lint`): domain and
  layer boundaries between folders.
- **tsarch** (`apps/web/arch/*.spec.ts`, runs as `nx run web:test-arch`):
  access rules between building blocks identified by file-name suffixes.
- **Nx module boundaries** (`eslint.config.mjs`): dependencies between Nx
  projects (`web`, `ui`, `api`, `infra`).

Concise rules live here. The reasoning behind them lives in the linked ADRs
under `apps/web/docs/adr/`.

## Reference Implementations

- Model new features after `GreetingPage` in terms of structure and style:
  - smart component: `apps/web/src/app/domains/greeting/feature-greeting/greeting-page/greeting-page.ts`
  - store: `apps/web/src/app/domains/greeting/feature-greeting/greeting-page/greeting-detail-store.ts`
  - data access client: `apps/web/src/app/domains/greeting/data/greeting-client.ts`

## Folder Structure

_(derived from [ADR-0001](adr/0001-domains-and-layers-enforced-with-sheriff.md))_

```
apps/web/src/app/
  app.ts, app.routes.ts, app.config.ts   # shell (Sheriff root module)
  testing/                               # test helpers, may be used by anything
  domains/
    <domain>/
      feature-<name>/                    # use cases, smart components, stores
      ui-<name>/ or ui/                  # dumb, reusable components of the domain
      data-<name>/ or data/              # models and data access clients
      util-<name>/ or util/              # technical helpers
      api/                               # optional public API (explicit request only)
    shared/
      ui-<name>/, util-<name>/, ...      # technical code used by 2+ domains
libs/ui/                                 # design-system library (Zard), type:ui-kit
```

- `apps/web/src/app/domains/<domain>/<layer>` is the unit Sheriff tags. The
  folder names carry the tags `domain:<domain>` and `type:<layer>`.
- `libs/ui` is the design-system library. It is tagged `domain:shared` and
  `type:ui-kit` and must stay free of application or domain logic. Add
  components there with the Zard CLI (`components.json`), not by hand.

## Domain Boundaries

- Add a new domain only when the user explicitly requests it. The agent may
  always propose a new domain, but such a proposal must be accepted by the user
  before it is created.
- Respect the existing domain boundaries enforced by Sheriff.
- Never import implementation details from the private internals of another
  feature or domain.
- Cross-domain communication must occur exclusively through the public APIs
  configured in Sheriff (`api/` folder, tag `domain:<domain>/api`) or through
  dedicated parts of the shared area.
- A domain may access another domain when the latter exposes a dedicated API
  that publishes only selected details. This requires a Sheriff change
  (allow `domain:<consumer>` to access `domain:<provider>/api`). Consult the
  user before choosing this approach.

## Layering

- Apply _relaxed_ layering.
- Permit only the following import direction:
  `feature → ui → data → util`.
- Every layer from `ui` upwards may additionally use the design-system
  library `libs/ui` (`type:ui-kit`). `data` and `util` must not.

## Changing the Sheriff Configuration

- Modify `apps/web/sheriff.config.ts` only when explicitly instructed to do so.
- Never change the Sheriff configuration merely to relax existing boundaries.
- The same applies to the tsarch rules in `apps/web/arch/` and to the Nx
  `depConstraints` in `eslint.config.mjs`.

## Locality

- Keep code that is used and changed together in close proximity (e.g. within
  the same folder).

## Single Responsibility

- Each file should have a single, well-defined responsibility.
- Adding helper constructs (functions, etc.) that are used only within the
  current file is acceptable.

## Signals

- Computed signals whose computation exceeds a single line should delegate to
  pure functions.
  - If such a function is used only once, place it at the end of the current
    file.

## Feature Slicing

_(derived from [ADR-0003](adr/0003-feature-slicing-and-shared-code.md))_

- If code is used by a single feature only, place it in the corresponding
  feature folder.
- If code from one feature must be reused by another feature within the same
  domain, move it down to a lower layer of that domain.
- If technical code from one feature must be reused by a feature in a
  different domain, move it down to a lower layer of the shared area.
  - If the code might be domain-specific, the agent MUST ask for explicit user
    approval before moving it to `shared`.
  - Explicit approval means a clear confirmation in the current chat.
  - Without explicit approval, keep the code in the current domain and propose
    alternatives.

## Data Access Services

_(derived from [ADR-0004](adr/0004-suffix-conventions-enforced-with-tsarch.md))_

- Use the suffix `Client` and the file suffix `-client.ts`
  (e.g. `GreetingClient` in `greeting-client.ts`).
- Follow `GreetingClient` as the reference implementation.
- Data access services must be stateless. They expose `httpResource`
  factories and plain `HttpClient` calls; they do not cache.
- Components must never call a data access service directly. They obtain data
  through a store or through a coordinator that combines several stores (see
  `apps/web/docs/architecture-state-management.md`).
- Only stores may access a data access service directly. Exception: files
  inside an `ai` layer (any `ai/` folder) may access data access services
  directly.

## Shared Code

_(derived from [ADR-0003](adr/0003-feature-slicing-and-shared-code.md))_

- Promote code to a shared area only when at least two independent features
  require it.
- Avoid premature shared abstractions.
- `shared` is a deliberate architectural decision, not a fallback folder.

## Pre-Change Checklist (Shared Moves)

- Before moving code to `shared`, verify cross-domain reuse is truly required.
- Classify the code as technical or domain-specific, and state that
  classification explicitly.
- If there is any domain-specific ambiguity, obtain explicit user approval
  first.
- Record the chosen option and rationale in the response.

## File-Name Suffixes

_(derived from [ADR-0004](adr/0004-suffix-conventions-enforced-with-tsarch.md))_

File-name suffixes carry architectural meaning and are checked by tsarch.
Renaming or moving a file across suffixes is a re-classification, not a
cosmetic change.

| Building block  | File suffix                                                               | Class suffix                                                         |
| --------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Smart component | `-page.ts`, `-search.ts`, `-edit.ts`, `-detail.ts`, `-overview.ts`        | `Page`, `Search`, `Edit`, `Detail`, `Overview`                       |
| Dumb component  | `-card.ts`, `-pane.ts`, or any file inside a `ui/` or `ui-<name>/` folder | free                                                                 |
| Store           | `-store.ts`                                                               | `<Entity>SearchStore`, `<Entity>DetailStore`, `<Feature>LookupStore` |
| Coordinator     | `-coordinator.ts`                                                         | `Coordinator`                                                        |
| Data access     | `-client.ts`                                                              | `Client`                                                             |

## State Management

_(derived from [ADR-0002](adr/0002-ngrx-signal-store-for-state.md))_

- Follow `apps/web/docs/architecture-state-management.md` where applicable.

## Nx Project Boundaries

- `web` (`type:app`) may depend on every library.
- `ui` (`type:ui-kit`, `scope:shared`) may depend only on other `type:ui-kit`
  libraries.
- Import the design system through the configured aliases
  (`@/ui/components/...`, `@/ui/services`, `@/ui/utils`), never through
  relative paths that leave `apps/web`.
