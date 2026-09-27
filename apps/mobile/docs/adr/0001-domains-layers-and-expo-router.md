# ADR-0001: Web domains and layers on Expo Router

- Status: accepted
- Date: 2026-09-27

## Context

SpecSync already has an Angular client whose architecture is enforced by
Sheriff, tsarch and binding docs (`apps/web/docs/`). The mobile app is new
(an `@nx/expo` scaffold), uses Expo Router, and is written mostly by agents.

The installed `expo-project-structure` skill proposes `src/app` for routes,
`screens/`, `components/`, `hooks/` and `utils/`, and states that it is "a
default to start from, never a standard to enforce". It says nothing about
feature slices or domains.

## Decision

The mobile app uses the web app's model:

- `src/domains/<domain>/<layer>` with `feature → ui → data → util`
- `api/<kind>/index.ts` public entries
- smart screens, dumb UI, stores, coordinators and clients recognised by
  file-name suffixes

The smart suffix `-page` becomes `-screen`.

Expo Router's `src/app` is routes-only and acts as the composition root, the
role web's `app.routes.ts` and `app.providers.ts` play. Routes render feature
entries from `api/features` and mount providers from `api/bootstrap`. The
skill's `screens/<name>/` becomes the feature's smart screen, and
`components/` becomes the design system plus domain and feature `ui/`
folders.

Enforcement mirrors web:

- **Sheriff:** `apps/mobile/sheriff.config.ts`, merged by the root stub. Its
  tags carry a `mobile:` prefix so the apps never match each other's rules.
- **Architecture tests:** tsarch access rules and a compiler-API boundary
  graph in `apps/mobile/arch/`.
- **Lint:** ESLint restrictions taken from the Expo and Vercel React Native
  skills.

App code imports with relative paths, like web, because Nx forbids path-alias
imports inside one project.

## Consequences

- **Portability:** agents and developers move between the clients with one
  vocabulary, and features port between them with the same slice layout.
- **Web rules unchanged:** the root Sheriff stub and the root ESLint Sheriff
  glob (now `.ts` and `.tsx`) changed, but the web rules did not.
  `arch/sheriff-config.spec.ts` runs the merged config and asserts that the
  two apps stay isolated.
- **React translations of the Angular checks:** web's `inject()` and Signal
  Forms checks become import checks for queries, forms, CopilotKit and
  navigation in dumb UI, plus a routes-only check for `src/app`.
