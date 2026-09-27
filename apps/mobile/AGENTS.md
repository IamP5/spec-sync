<!-- BEGIN:expo-agent-rules -->

# This is NOT the Expo or React Native you know

Expo SDK 56, React Native 0.85, React 19.2 and Expo Router 56 have breaking
changes: APIs, conventions and file structure may all differ from your
training data.

- **Before writing code,** invoke the `expo-overview` skill, then the
  specific skill it routes to (`expo-router`, `expo-data-fetching`,
  `expo-native-ui`, `vercel-react-native-skills`, ...).
- **Docs:** read the SDK 56 docs (`https://docs.expo.dev/versions/v56.0.0/`),
  not `latest`.
- **Deprecations:** heed deprecation notices.

<!-- END:expo-agent-rules -->

# SpecSync mobile app (Expo SDK 56)

Expo app built with Nx, Expo Router, React Native Reusables on Uniwind (Ford
tokens), TanStack Query and the CopilotKit headless client. Paths below are
relative to the workspace root.

## Architecture (red lines)

The binding rules live in the docs; this section only names the red lines.
The reasoning is recorded in `apps/mobile/docs/adr/`.

- **Required reading:**
  - `apps/mobile/docs/architecture-boundaries.md`, before changing code
    under `apps/mobile`.
  - `apps/mobile/docs/architecture-state-management.md`, when the change
    touches stores, queries, forms or the chat.
  - `docs/adr/0001-agentic-ui-contracts.md` at the workspace root, for AI
    tool/component contracts.
- **Domains and layers:** domains live in
  `apps/mobile/src/domains/<domain>/<layer>`, with the same model as the web
  app.
  - The layers are `feature → ui → data → util`.
  - Cross-domain access goes through `api/<kind>/index.ts`.
  - The feature graph is acyclic.
  - UI is strictly dumb: no stores, queries, forms, CopilotKit or navigation
    hooks.
- **`src/app` is Expo Router: routes and layouts only.**
  - A route is thin: it reads params and renders one smart screen from
    `api/features`.
  - The root `_layout.tsx` is the composition root: providers from
    `api/bootstrap`, the `Stack`, and the `PortalHost`.
  - Never put components, hooks or helpers in `src/app`.
- **Data flow:** components never call a client (`-client.ts`). Data flows
  client → store (`-store.ts` hook) → smart screen (`-screen`, `-search`,
  `-edit`, `-detail`, `-overview`). Stores never import stores; use a
  `-coordinator.ts`.
- **Imports:** app code imports with relative paths, as in `apps/web`. Nx
  forbids path aliases inside one project. Only the generated Reusables
  components use `@mobile/*`.
- **Changing rules:** don't create a new domain, move code to `shared`, or
  change any of these without an explicit request in the current
  conversation:
  - `apps/mobile/sheriff.config.ts` or the root `sheriff.config.ts`
  - `apps/mobile/arch/`
  - the ESLint restrictions
  - Nx `depConstraints`
- **The chat:**
  - It talks to the existing Mastra runtime through the gateway:
    `<gateway>/ai/copilotkit`, agent `chat`, single endpoint, `locale`
    forwarded on every run.
  - Use `@copilotkit/react-native/headless` at the version `apps/ai` runs
    (1.70.1).
  - Never add a second runtime or a `BuiltInAgent`; this is ADR-0003.
  - Only `ChatConversationStore` calls `useAgent`/`runAgent`.
  - Tool results render through registered components, never text made up
    in the client.
- **Design system:** React Native Reusables in `src/design-system`.
  - Add components with
    `cd apps/mobile && npx @react-native-reusables/cli@latest add <name>`.
  - Style with Uniwind classes on the Ford tokens of `src/global.css`:
    - Ford blue only for primary actions and focus; neutral gray surfaces.
    - Radii on the 4px concentric scale.
    - No hex colours or ad-hoc radii in screens.
  - `design-system/theme.ts` mirrors the tokens for code. Change
    `libs/ui/styles.css` first, then `global.css` and `theme.ts`.
- **Dependencies:**
  - Install at the workspace root, with the SDK 56 version named in
    `expo/bundledNativeModules.json`, and list the package as `"*"` in
    `apps/mobile/package.json`.
  - React stays pinned at 19.2.3, and the `expo-router` and
    `react-server-dom-webpack` overrides stay in place until the SDK 57
    upgrade (ADR-0006).
- **Language:** user-visible text is English only for now (ADR-0005).

## Checks

- Lint (Sheriff, Nx boundaries, Expo/RN rules):
  `npm exec -- nx run mobile:lint`
- Typecheck: `npm exec -- nx run mobile:typecheck`
- Architecture tests: `npm exec -- nx run mobile:test-arch`
- Unit tests (jest-expo): `npm exec -- nx run mobile:test`
- iOS and Android bundles:
  `npm exec -- nx run mobile:export --platform ios --platform android`
- Everything: `npm run verify` (`npm run verify:changed` for the apps you
  touched)
- The checks are declared in `apps/mobile/checks.mjs`. The agent Stop hooks
  and the pre-commit hook run the fast ones whenever files under `apps/mobile`
  changed, and feed failures back. Fix the code; never weaken a rule to make
  a check pass.
- Use the `mobile-architecture-review` skill for reviews and
  `mobile-verify-and-fix` before declaring work merge-ready.
- Run `nx run mobile:doctor` (expo-doctor) after dependency changes.

## Running the app

- `npm exec -- nx run mobile:start` starts Metro. The app needs a development
  build (`nx run mobile:run-ios` or `nx run mobile:run-android`); Expo Go
  only runs the latest SDK.
- The app reaches the local gateway (`nx serve gateway`, port 3000) at
  `localhost`, or at `10.0.2.2` on the Android emulator. Release builds need
  `EXPO_PUBLIC_GATEWAY_URL` (https).

## React and React Native practices

- **TypeScript:** strict. Avoid `any`; use `unknown` when a type is
  uncertain.
- **React 19:** use `use(Context)`, not `useContext`; pass `ref` as a prop
  instead of `forwardRef`. The React Compiler is on, so don't add
  `useMemo`/`useCallback`/`memo` by reflex. Use `'use no memo'` only for
  hooks over objects mutated in place, such as the AG-UI agent.
- **Lists and rendering:**
  - Lists are virtualized, never a mapped `ScrollView`.
  - Pass primitives and stable references to list items; don't create
    objects in `renderItem`.
  - Never render `{value && <X />}` when `value` can be `''` or `0`; use a
    ternary.
  - Strings render inside `Text`.
- **Components:**
  - Images use `expo-image`.
  - Presses use `Pressable`-based components.
  - Safe areas use `contentInsetAdjustmentBehavior="automatic"`.
  - Animations use Reanimated on `transform` and `opacity` only.
- **Screen states:** every smart screen designs loading, error, empty and
  content, and keeps the draft when a save fails.
- **Accessibility:**
  - Every pressable has a role and a label.
  - Targets are at least 44pt.
  - Contrast meets WCAG AA.
  - Dynamic Type stays on.
  - Tests query by role and label.

## Agent configuration

- **Skills** for this app live in `apps/mobile/.agents/skills/`:
  - the Expo skills (`expo/skills`, pinned in `apps/mobile/skills-lock.json`)
  - `vercel-react-native-skills`
  - `mobile-architecture-review`
  - `mobile-verify-and-fix`
- `npm run sync:agent-config` generates `apps/mobile/.claude/skills/` from
  them; do not edit that copy.
- Start Claude from this directory (`cd apps/mobile && claude`) to have these
  skills and this file loaded at launch. From the workspace root they load
  once Claude touches files under `apps/mobile`.
