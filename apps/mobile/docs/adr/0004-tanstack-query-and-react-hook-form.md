# ADR-0004: TanStack Query for server state, React Hook Form for forms

- Status: accepted
- Date: 2026-09-27

## Context

Web stores wrap `httpResource` with NgRx Signal Store resources and
mutations. The `expo-data-fetching` skill recommends TanStack Query for
complex apps and `expo/fetch` over axios. The skills name no form library.

## Decision

- **Server state:** TanStack Query v5. A `-store.ts` hook owns its
  `queryOptions` and mutations and calls a stateless `-client.ts` (built on
  `expo/fetch`, parsed with zod). The one `QueryClient` lives in
  `domains/shared/util-query/query-cache.ts`.
- **Forms:** React Hook Form with `@hookform/resolvers/zod`, owned by smart
  screens.
- **Validation:** zod stays on the workspace's `^3.25.76` line, the same
  version web and ai use.
- **Client state:** Zustand only when state outlives a screen or list items
  read it (vercel-react-native-skills).

## Consequences

- The web rules carry over one for one: one responsibility per store, no
  store-to-store imports, and coordinators to combine stores.
- `@tanstack/react-query` and CopilotKit values are allowed only in stores,
  coordinators, transport, the shared query cache and routes (for providers).
  `arch/feature-boundaries.spec.ts` enforces this.
