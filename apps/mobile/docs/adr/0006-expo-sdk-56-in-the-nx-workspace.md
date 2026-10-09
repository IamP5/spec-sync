# ADR-0006: Expo SDK 56 inside the Nx workspace

- Status: accepted
- Date: 2026-09-27

## Context

- **Nx support:** `@nx/expo` 23.2 supports Expo SDK up to 56.
- **Skill warning:** the installed `expo-upgrade` skill warns that SDK 56
  (Hermes V1) has a memory regression with `react-native-reanimated` and
  worklets, and recommends SDK 57.0.9 or later.
- **Workspace:** it hoists dependencies from the root `package.json`, and it
  hosts other React users (Remotion in `apps/pitch`, CopilotKit's web
  packages).

## Decision

- **SDK version:** stay on **Expo SDK 56 / React Native 0.85.3**, compatible
  with Nx. Upgrade to SDK 57 when `@nx/expo` supports it. Until then,
  animations stay light (CSS transitions, no heavy worklet loops).
- **React pins:** `react`, `react-dom` and `react-test-renderer` are pinned
  to exactly **19.2.3**, the renderer version React Native 0.85.3 checks at
  runtime.
- **npm overrides:**
  - `expo-router` is held on the SDK 56 line (`~56.2.21`), because
    `@expo/cli`'s `*` peer range otherwise resolves SDK 57's router.
  - `react-server-dom-webpack` is held at `19.2.3`, matching React. Only
    Expo's server components use it, and we don't.
- **Workspace membership:**
  - `apps/mobile` is an npm workspace (`@specsync/mobile`). Its
    `package.json` lists dependencies as `*`, the `@nx/expo` convention; the
    root `package.json` holds the versions.
  - Install new packages at the root with the SDK 56 version that
    `expo/bundledNativeModules.json` names.
- **Nx wiring:**
  - `@nx/expo` and `@nx/jest` infer targets for `apps/mobile/**` only.
  - `.nxignore` hides agent skill folders, which ship their own
    `package.json`.
  - The `@mobile/*` alias is declared in `tsconfig.base.json`, which is how
    Sheriff and Nx Metro resolve it, and again in `apps/mobile/tsconfig.json`
    for the Reusables CLI.

## Consequences

- **SDK 57 upgrade:**
  - bump `expo` and the SDK packages
  - drop or move both overrides
  - bump the React pins
  - rerun `nx run mobile:doctor`

  Follow the `expo-upgrade` skill.

- **Toolchain choice:** Expo's `npx expo install` does not know the root
  lockfile, so root `npm install` with explicit versions is the documented
  path.
