# Architecture Rules

These rules bind changes in `apps/web` and `libs/ui`. Sheriff checks domain and
layer permissions during lint; `arch/access-rules.spec.ts` checks building-block
access with tsarch; `arch/feature-boundaries.spec.ts` checks public entries,
transitive UI/contract access, form ownership, and feature cycles. Nx continues
to enforce dependencies between workspace projects.

The rationale is recorded in [ADR-0005](adr/0005-composable-features-and-pure-ui.md),
which supersedes the locality exception and downward-only feature reuse in
ADRs 0001, 0003, and 0004. [ADR-0007](adr/0007-generic-domain-boundaries.md)
replaces named-domain grants with the generic public API rules below.

## Domains and structure

- `auth` owns the SDK session, gateway session verification, login dialog content, logout component and authentication stores. SDK credentials stay outside application stores and devtools.
- `user` owns the verified Google profile, role data, saved preferences including theme. Its profile and preferences components are exposed through `user/api/features`.
- `shell` owns the responsive layout, sidebar frame, account menu and settings-dialog composition. It composes domain APIs; domains never import shell.
- `shared` contains only runtime configuration and gateway URL matching utilities.
- `chat` owns conversations, history, AG-UI state restoration,
  CopilotKit registration, and prompt/draft/send integration.
- `vehicles` owns configurations, specifications, comparison semantics, related
  reviews, reviewed specification ingestion, and their reusable workflows.
- Catalog, comparison, and reviews are features within vehicles. Vehicle details
  stay local to catalog while it is their only independent consumer.

```text
src/app/
  app.ts, app.routes.ts, app.config.ts
  shell/
    app-layout/, sidebar/, account-menu/, settings/
  domains/
    shared/
      util-config/, util-gateway/
    auth/
      api/features/, api/authentication/, api/session/, api/events/, api/bootstrap/
      feature-auth/, state/, session/, transport/, data/
    user/
      api/features/, api/preferences/, api/contracts/, api/bootstrap/
      feature-profile/, feature-preferences/, state/, data/, util/
    chat/
      api/features/, api/connection/, api/bootstrap/, state/
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
- Every domain follows the same permissions, derived from its directory and layer.
  Cross-domain imports use a typed public API's `index.ts`; direct imports of
  another domain's data, UI, features, state, or helpers are forbidden. New domain
  names require no config changes. Feature composition must remain acyclic.
- API entries expose only their own domain or shared technical dependencies. They
  cannot re-export another domain's API or internals to bypass ownership.
- Technical entry names (`contracts`, `features`, `events`, `session`, `bootstrap`)
  have dedicated architectural rules. Other `api/<capability>` entries use a
  generic public coordinator rule. Name them after their capability, such as
  `auth/api/authentication`, `chat/api/connection` or `user/api/preferences`.
  Adding `api/notifications` later requires no config change.
- API purpose determines the allowed consumers and exports:

  | API            | Consumers                                                | Exports / dependencies                                                                                                 |
  | -------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
  | `contracts`    | Features, UI and data                                    | Selected data/util types and schemas; the dependency closure contains no clients, stores, coordinators, UI or features |
  | `features`     | Features and shell                                       | Feature `index.ts` entries only; those entries export their own smart components or lazy loaders                       |
  | `<capability>` | Smart feature components, feature coordinators and shell | Own domain's `state/*-coordinator.ts` facades; stores remain private                                                   |
  | `events`       | Features, state, data and session runtime                | Typed event declarations, without application dependencies                                                             |
  | `session`      | Features, state, data and shell                          | Read-only session facade backed by the owning session runtime                                                          |
  | `bootstrap`    | Application configuration, providers and routes          | Technical SDK transport, interceptors, guards and storage/request tokens from data/transport/util                      |

- `state/` internals stay within that domain's state layer. The only public export
  is a coordinator through `api/<capability>/index.ts`. This applies to every current
  and future domain and protects stores from shell and root composition too.
- The application composition files also import domains through public entries.
  Shell cannot use bootstrap APIs; domains cannot import shell or root composition.
  Shared technical code cannot depend on business domains, including their APIs.
- Unrecognized domain layers, loose files under a domain root and private helpers
  inside API folders fail validation even if unreferenced. Capability entries
  expose only their own domain's state coordinators; changing the capability name
  cannot bypass that restriction. A new architectural layer or technical API role
  requires an explicit rule. Adding a domain, capability, feature, coordinator or
  entity inside the conventions does not.
- Sheriff owns domain/layer permissions; the tests in `arch/` additionally check
  public entry files, private state, transitive UI/contract purity, suffix-based
  access and feature cycles. Regression fixtures run Sheriff's real parser and
  matcher against this config with domain names absent from the application.
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
- Changing architectural permissions in Sheriff/tsarch/Nx rules, or
  moving code to shared requires an explicit request in the current conversation.
  Never weaken a boundary merely to silence a failing check.
- `libs/ui` contains only the generic Zard design system. Add design-system
  components with the Zard CLI; import via `@/ui/components/...`,
  `@/ui/services`, or `@/ui/utils`, not relative paths out of the app.

## Internationalization

The app ships one build and translates at runtime
([ADR-0008](adr/0008-runtime-translation.md)).

- `en-US` is the source locale: write every template and every `$localize`
  template literal in English. `pt-BR` is the default runtime locale and
  `es-419` the third; the catalogue is `domains/user/util/locale.ts`.
- Mark user-visible text: `i18n` on elements, `i18n-{attribute}` on attributes,
  ICU expressions for plurals, `$localize` tagged templates in TypeScript. Text
  that is part of a contract with the agent — prompts sent straight through,
  tool names, attribute codes, status codes — stays in the source language, and
  a status _code_ is never the same string as its label.
- Research warnings, claim issues and locators are diagnostics the AI service
  writes once per shared research and the agent reads back; they are stored
  as text and stay in the source language. Never restate them in the browser
  by matching their wording. Render what the structured data already carries
  (counts, coded qualifiers such as `scope=model`, availability, normalized
  values) through `$localize` and `LOCALE_ID` instead, and keep the service
  from emitting warnings that only repeat such data
  (`domains/vehicles/data/claim-presentation.ts`).
- Nothing imported by `src/main.ts` before `loadTranslations()` may use
  `$localize`; such a message would keep its English source forever.
- Format through `LOCALE_ID` (`inject(LOCALE_ID)`, the `date`/`number`/
  `currency` pipes). Never hardcode a locale tag or a `lang` attribute.
- After changing user-visible text run `nx run web:extract-i18n` and translate
  the new ids in `src/i18n/messages.pt-BR.json` and `messages.es-419.json`;
  `nx run web:check-i18n` fails on a missing, orphaned or placeholder-breaking
  message. Ids are generated from the source text, so editing an English string
  retires its translation on purpose.

## Reference implementations and checks

Use `VehicleCatalogOverview` plus its card for controlled presentation,
`VehicleReviewsSearch` for scoped reads, `ChatVehicleComparisonOverview` for a
host adapter, and `ChatCoordinator` for cross-store orchestration. Conversation
streaming still follows `ConversationDetailStore` and `ChatAgentClient`.

Run `npm exec -- nx run-many -t lint -p web,ui` and
`npm exec -- nx run web:test-arch` for boundaries, and
`npm exec -- nx run web:check-i18n` for translation completeness. Full verification is
`npm run verify` (or `npm run verify -- --changed` for changed projects).
