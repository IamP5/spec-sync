# Architecture boundaries (binding)

These rules govern `apps/mobile`. They mirror the web app
(`apps/web/docs/architecture-boundaries.md`) so one mental model covers both
clients, adapted to Expo Router and React. The reasoning lives in
`apps/mobile/docs/adr/`.

Enforcement:

- **Sheriff** (`apps/mobile/sheriff.config.ts`, merged by the root
  `sheriff.config.ts`) checks domain and layer permissions in `mobile:lint`.
- **tsarch** (`arch/access-rules.spec.ts`) checks building-block access.
- **`arch/feature-boundaries.spec.ts`** checks public entries, transitive
  UI access, UI purity, runtime access, routes-only `src/app` and feature
  cycles.
- **ESLint** (`apps/mobile/eslint.config.mjs`) bans APIs the Expo and Vercel
  React Native skills rule out.

All of these run as `mobile:lint` and `mobile:test-arch` in the agent Stop
hooks, the pre-commit hook and `npm run verify`.

## Folder structure

```
apps/mobile/src/
  app/                    Expo Router: routes and layouts only (composition root)
  domains/<domain>/
    api/<kind>/index.ts   the domain's public entries
    feature-<name>/       a workflow slice: index.ts, smart screens, stores, ui/
    ui/ | ui-<name>/      dumb views shared by two features of the domain
    data/                 clients, contracts, zod schemas, pure mapping
    util/                 pure helpers
    state/                domain-level stores and coordinators (private)
    session/              the session runtime (single writer)
    transport/            runtime providers (CopilotKit, authenticated fetch)
  design-system/          React Native Reusables + Ford tokens (web: libs/ui)
  shell/                  cross-domain composition (account, settings)
  testing/                fakes and test helpers
  global.css              the Uniwind theme (Ford tokens)
```

**Domains** carry the same names as web: `auth`, `user`, `chat`, `vehicles`,
`shared`. Only `chat` and `shared` exist today. `shared` holds technical code
only: runtime configuration (`util-config`), the query cache (`util-query`),
and gateway helpers. It never depends on a business domain.

**A feature is a workflow boundary**, not one folder per component. Code that
changes together stays together. Move code down only when a second consumer
appears: from inline to the feature's `ui/`, then to the domain's `ui/`, then
to the design system (web ADR-0003, expo-design-system).

## Routes (`src/app`)

- Every file under `src/app` is a route or a layout (`.tsx`). A route file has
  a default export and may also export `ErrorBoundary` or `unstable_settings`;
  nothing else.
- Route files are thin. They read URL params, set route-dependent screen
  options, and render one smart screen from `api/features`.
- Routes and layouts may import only these:
  - `api/features` and `api/bootstrap` entries
  - `shell`
  - `design-system`
  - `domains/shared`
  - `expo-router` and third-party providers
- App code never imports a route.
- The root `_layout.tsx` is the composition root. It holds the app-wide
  providers (gestures, keyboard, query cache, chat runtime, theme), the
  `Stack`, and the `PortalHost`.
- Navigation imports come from `expo-router` and `expo-router/react-navigation`,
  never `@react-navigation/*` (Expo SDK 56).
- Introduce `NativeTabs` when a second top-level area exists. Each tab nests
  its own `Stack`, because native tabs render no header.
- Modals and sheets are routes with `presentation: 'modal' | 'formSheet'`.
- Typed routes are on (`experiments.typedRoutes`).

## Public boundaries and composition

- A feature exports its smart entry screens from its root `index.ts`. Stores,
  coordinators, helpers and internal UI stay private.
- Cross-domain imports go only through `api/<kind>/index.ts`. An API entry
  exposes only its own domain (or shared technical code) and never re-exports
  another domain.

| API            | Consumed by                                | Exports                                                                                         |
| -------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `contracts`    | feature, UI and data layers                | data/util types and schemas, whose closure has no clients, stores, coordinators, UI or features |
| `features`     | features, shell, routes                    | feature `index.ts` entries only                                                                 |
| `<capability>` | smart screens, feature coordinators, shell | the domain's own `state/*-coordinator.ts` only                                                  |
| `events`       | features, state, data, session runtime     | typed event declarations only                                                                   |
| `session`      | features, state, data, shell               | a read-only session facade                                                                      |
| `bootstrap`    | routes (the composition root)              | runtime providers, transport, configuration                                                     |

- The same-domain feature graph must be acyclic, including cycles through
  APIs.
- Unrecognized layers, loose files at a domain root, and private helpers
  inside `api/` fail validation.

## Layers and building blocks

The layering is `feature → ui → data → util`.

- Feature and UI code may use the design system; data and util code may not.
- Data and util hold no React components.

| Building block   | Suffix / location                                                | Responsibility                                                                                                         |
| ---------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Smart screen     | `-screen` / `-search` / `-edit` / `-detail` / `-overview` `.tsx` | workflow, drafts and forms, navigation, store access                                                                   |
| Dumb component   | `-card` / `-pane` `.tsx`, or anything in `ui/` / `ui-<name>/`    | props in, callbacks out; local visual state only                                                                       |
| Store            | `-store.ts`                                                      | a hook with one responsibility; server state through TanStack Query, the chat through CopilotKit; I/O through a client |
| Coordinator      | `-coordinator.ts`                                                | a hook that combines stores                                                                                            |
| Client           | `-client.ts` in `data/`                                          | stateless `expo/fetch` plus zod parsing; no React, no caching                                                          |
| Runtime provider | `transport/*.tsx`                                                | a React provider for a runtime (CopilotKit); exposed through `api/bootstrap`                                           |

**Access rules** (tsarch and `feature-boundaries.spec.ts`):

1. Only stores import clients.
2. Only smart screens and coordinators import stores.
3. Stores never import other stores; a coordinator combines them.
4. Dumb components never import stores, coordinators, clients or smart
   screens, and never reach them transitively. They also never use (even
   through a renamed import):
   - `@tanstack/react-query`, `zustand`, `react-hook-form`
   - `@copilotkit/*`, `@ag-ui/*` values
   - secure storage
   - `expo-router` navigation. A `Link` whose `href` arrives as a prop is
     allowed.
5. `@copilotkit/*` and `@tanstack/react-query` values appear only in:
   - stores and coordinators
   - `transport/`
   - `domains/shared/util-query`
   - routes (providers)
6. Forms belong to smart screens. Dumb fragments take values and `onChange`
   callbacks, never a form instance.

## Chat integration

- `docs/adr/0001-agentic-ui-contracts.md` (workspace root) applies unchanged.
- The client validates tool results, renders one registered component per
  result, and never merges, rewrites, suppresses or fabricates tool calls or
  results.
- Markdown is shown as text; nothing is parsed out of it.
- Vehicle features emit typed intentions and never contain chat or AG-UI
  types.
- The runtime contract (agent id `chat`, `/ai/copilotkit`, the `locale`
  forwarded property) lives in `domains/chat/data/chat-agent.ts` and matches
  the web app. See ADR-0003.

## Design system and styling

- UI is built from React Native Reusables components in
  `src/design-system/components/ui`, styled with Uniwind classes on the Ford
  tokens of `src/global.css` (ADR-0002).
- Add components with the CLI only:
  `cd apps/mobile && npx @react-native-reusables/cli@latest add <name>`. Don't
  hand-write a copy.
- Components may be adapted to Uniwind or to the Ford tokens. Keep the
  registry's code style so `--overwrite` stays reviewable.
- **App code imports the design system with relative paths.** Nx forbids
  path-alias imports inside a project. The generated components keep the
  `@mobile/*` alias that `components.json` gives the CLI; they are exempt,
  like `libs/ui` on web.
- **Tokens only:**
  - No hex colours, arbitrary sizes or radii in screens.
  - Brand blue marks primary actions and focus only; surfaces stay neutral
    gray.
  - Radii follow the concentric 4px scale in `global.css`.
- **Colours for code** (navigation theme, status bar, icon tints) come from
  `design-system/theme.ts`, which mirrors `global.css` in sRGB. Change both
  together, and change `libs/ui/styles.css` first.
- **Primitives:**
  - Text and inputs render through the design system.
    `react-native`'s `Text`, `TextInput`, `Button` and `Switch` are
    lint-banned outside `src/design-system`.
  - Images use `expo-image`.
  - Lists are virtualized (`FlatList`, `FlashList` or `LegendList`), never a
    mapped `ScrollView`.
  - Presses go through `Pressable`-based components; `Touchable*` is banned.
- **Accessibility:**
  - Every pressable has a role and a label.
  - Targets are at least 44pt.
  - Contrast meets WCAG AA; the Ford tokens are chosen for it.
  - Dynamic Type stays on.
  - Tests query by role and label.

## Changing the rules

- Don't create a new domain or move code to `shared` without an explicit
  request in the current conversation.
- Don't change these files without an explicit request either:
  - `apps/mobile/sheriff.config.ts`
  - the root `sheriff.config.ts`
  - `apps/mobile/arch/`
  - the ESLint restrictions
  - Nx `depConstraints`
- When a check fails, fix the code. Never weaken a rule to make a check pass.

## Reference implementation

The `chat` domain:

- `feature-chat/chat-screen.tsx`: smart screen.
- `feature-chat/chat-conversation-store.ts`: store over CopilotKit.
- `feature-chat/ui/*`: dumb components.
- `data/chat-agent.ts` and `data/chat-message.ts`: contract and mapping.
- `transport/chat-runtime-provider.tsx`: runtime provider.
- `api/features` and `api/bootstrap`: entries.

The routes that compose it are in `src/app/`.
