# Architecture Rules

These rules bind changes in `apps/web` and `libs/ui`. Sheriff checks domain and
layer permissions during lint; `arch/access-rules.spec.ts` checks building-block
access with tsarch; `arch/feature-boundaries.spec.ts` checks public entries,
transitive UI/contract access, form ownership, and feature cycles. Nx continues
to enforce dependencies between workspace projects.

The rationale is recorded in [ADR-0005](adr/0005-composable-features-and-pure-ui.md),
which supersedes the locality exception and downward-only feature reuse in
ADRs 0001, 0003, and 0004.

## Domains and structure

- `auth` owns the SDK session, gateway session verification, login page, logout component and authentication stores. SDK credentials stay outside application stores and devtools.
- `user` owns the verified Google profile, role data, saved preferences and configuration. Its account and preferences components are exposed through `user/api/features`.
- `chat` owns conversations, history, AG-UI state restoration,
  CopilotKit registration, and prompt/draft/send integration.
- `vehicles` owns configurations, specifications, comparison semantics, related
  reviews, reviewed specification ingestion, and their reusable workflows.
- Catalog, comparison, and reviews are features within vehicles. Vehicle details
  stay local to catalog while it is their only independent consumer.

```text
src/app/
  app.ts, app.html, app.routes.ts, app.config.ts
  domains/
    chat/
      feature-chat/
        index.ts
        chat-page/, thread-search/, settings-edit/
        tool-adapters/, ui/, chat-coordinator.ts
      data/, util/
    vehicles/
      api/contracts/index.ts
      api/features/index.ts
      feature-catalog/
        index.ts, vehicle-catalog-overview.ts
        vehicle-catalog-search-store.ts, vehicle-catalog-detail-store.ts
        ui/vehicle-catalog-card.ts, ui/vehicle-catalog-strip.ts, ui/vehicle-catalog-list.ts
        ui/vehicle-detail-pane.ts
      feature-comparison/
        index.ts, vehicle-comparison-overview.ts
        ui/vehicle-comparison-card.ts
      feature-reviews/
        index.ts, vehicle-reviews-search.ts, vehicle-reviews-search-store.ts
        ui/vehicle-reviews-pane.ts
      feature-ingestion/
        index.ts, vehicle-ingestion-page.ts, vehicle-ingestion-run-detail.ts
        vehicle-ingestion-launch-edit.ts, vehicle-ingestion-search.ts
        ingestion-detail-store.ts, ingestion-search-store.ts
        ui/ingestion-claims-pane.ts, ui/ingestion-source-pane.ts, ui/ingestion-run-status-pane.ts
      data/, util/
  testing/
libs/ui/  # Generic Zard design system
```

Templates, tests, and feature-only helpers stay beside their owners. A feature
is a workflow boundary, not one folder per component. Domain-level `ui/` or
`ui-<name>/` is available when two independent features need the same dumb view.

## Public boundaries and composition

- A feature exports its smart entry components from its root `index.ts`.
  Routed components may use an exported lazy loader, such as `loadChatPage`,
  so importing an eager sidebar does not also load the routed page.
  Consumers, including pages, import that entry. Stores, coordinators, helper
  files, and internal UI remain private to the owning feature.
- Same-domain features may compose other features through those entries. The
  feature dependency graph must be acyclic, including dependencies through APIs.
- Reusing a whole feature does not make its internal UI or state shared.
- Cross-domain imports use explicitly allowed public APIs. The current grant is
  `chat → vehicles/api`, `chat → user/api` and `user → auth/api/features`; auth does not depend on user, and vehicles cannot import chat. Direct cross-domain data,
  UI, feature, or helper imports are forbidden.
- `api/contracts/index.ts` exports selected types and schemas from data/util.
  Its dependency closure contains no clients, stores, coordinators, UI, or
  features. Chat data consumers may use this contract API for validating saved
  tool results without depending on vehicle feature implementations.
- `api/features/index.ts` exports feature entries only. Only feature/shell
  consumers may use it; data, util, and UI cannot.
- `user/api/preferences` exposes only `UserPreferencesCoordinator` for smart features that independently consume saved preferences. It coordinates the private stores under `user/state` and the active theme. Data, util, UI and auth cannot consume this API. Direct access to user state outside that owner is forbidden, including from the app shell. Preference model types remain in `user/api/contracts`.
- Sheriff enforces domain/layer permissions; barrels enforce module privacy;
  architecture tests additionally reject private paths even when barrel-less
  imports would otherwise be possible. Do not bypass an entry via another
  re-export or move application logic into a contract file.

## Layers and building blocks

Relaxed downward layering remains `feature → ui → data → util`, with explicit
feature composition and the contract/API permissions above. Feature and UI may
use the Zard design system; data/util may not.

| Building block  | File suffix / location                                           | Responsibility                                               |
| --------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| Smart component | `-page`, `-search`, `-edit`, `-detail`, `-overview` in a feature | Workflow, form ownership, store access, feature composition  |
| Dumb component  | `-card`, `-pane`, or any `ui/` / `ui-<name>/` folder             | Supplied state, presentation, input/output interactions      |
| Store           | `-store.ts`                                                      | One state responsibility; delegates I/O to a client          |
| Coordinator     | `-coordinator.ts`                                                | Combines stores and coordinates their actions                |
| Client          | `-client.ts` in data                                             | Stateless HTTP/storage access                                |
| Chat adapter    | Smart component in `feature-chat/tool-adapters/`                 | Tool envelopes and host interactions around vehicle features |

- UI is strictly presentational regardless of suffix or locality. Application
  stores, clients, coordinators, and smart components cannot live inside UI.
- Dumb components cannot reach application workflows through imports, helper
  re-exports, injected actions, or callbacks passed as an alternative to outputs.
  They receive data/form fields via inputs and report intentions via outputs.
- Local presentation signals (tabs, expansion), focus handling, formatting,
  domain models, and technical design-system dependencies are allowed in UI.
- Only smart components and coordinators access stores. Only stores access
  clients. There is no colocated-store or AI-folder exception.
- Components never call clients directly. Clients expose reads, resource
  factories, and writes without caching. Only stores depend on clients.
- Stores never depend on other stores. Use a coordinator when state must be
  combined; do not add coordinators without an orchestration responsibility.
- Follow [state management](architecture-state-management.md) for state scope,
  store responsibilities, and forms. Renaming a suffix changes classification;
  it does not change the actual responsibility.

## Chat integration

Vehicle features accept validated domain data/IDs and emit typed intentions.
`VehicleQuestion` carries vehicle, comparison, discovery, or selected-evidence
context. It contains no chat callbacks or CopilotKit types. Chat adapters turn
those intentions into prompts and choose draft or send behavior.

`ChatAgentClient` derives AG-UI selection through `comparison-selection.ts`,
using the vehicle contract API. Generic tool-result parsing stays in chat util;
vehicle comparison semantics stay in vehicles data. Wire schemas and server
behavior must remain compatible when moving files.

The catalog and review features keep state per rendered result/dialog, so older
transcript results and simultaneous instances do not share selection or loading.

## Locality, shared code, and changes

- Keep files with one responsibility and code that changes together nearby.
  File-local pure helpers are appropriate; multiline computed expressions
  delegate to pure functions.
- Share dumb views within a domain only when another independent feature needs
  the view directly. Keep each feature's internal view local otherwise.
- `shared` is for demonstrated technical reuse across domains, not a fallback
  for domain coupling. Obtain explicit approval before moving domain-specific
  code there. Classify proposed shared moves and explain their consumers.
- Adding domains or public domain grants, changing Sheriff/tsarch/Nx rules, or
  moving code to shared requires an explicit request in the current conversation.
  Never weaken a boundary merely to silence a failing check.
- `libs/ui` contains only the generic Zard design system. Add design-system
  components with the Zard CLI; import via `@/ui/components/...`,
  `@/ui/services`, or `@/ui/utils`, not relative paths out of the app.

## Reference implementations and checks

Use `VehicleCatalogOverview` plus its card for controlled presentation,
`VehicleReviewsSearch` for scoped reads, `ChatVehicleComparisonOverview` for a
host adapter, and `ChatCoordinator` for cross-store orchestration. Conversation
streaming still follows `ConversationDetailStore` and `ChatAgentClient`.

Run `npm exec -- nx run-many -t lint -p web,ui` and
`npm exec -- nx run web:test-arch` for boundaries. Full verification is
`npm run verify` (or `npm run verify -- --changed` for changed projects).
