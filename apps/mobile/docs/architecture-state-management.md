# State management (binding)

This doc maps the web app's Signal Store rules
(`apps/web/docs/architecture-state-management.md`) onto React hooks. The
tools are TanStack Query v5 for server state, CopilotKit's agent for the
chat, React state for local UI state, and React Hook Form for forms (ADR-0004).

## Location

- A store is a hook in a `-store.ts` file. It sits next to the smart screen
  that uses it, inside the feature, and is private to that feature.
- A store that two features of a domain need moves to the domain's `state/`
  and is exposed only through a coordinator in a capability API.
- Moving state across domains needs the user's explicit consent.

## Granularity

A store has exactly one responsibility:

| Kind           | Name                                              | Example                            |
| -------------- | ------------------------------------------------- | ---------------------------------- |
| Search or list | `<Entity>SearchStore`, `<entity>-search-store.ts` | the catalog query                  |
| Detail or edit | `<Entity>DetailStore`                             | one vehicle, its update and remove |
| Lookup         | `<Feature>LookupStore`                            | model options for a picker         |
| Conversation   | `<Feature>ConversationStore`                      | the chat transcript and runs       |

- A CRUD feature splits into a search store and a detail store. `create`,
  `update`, `remove`, `startEdit` and `cancelEdit` belong to the detail store.
- A store never imports another store. A `-coordinator.ts` hook combines them.

## Server state (TanStack Query)

- A store builds its queries from `queryOptions` factories whose `queryFn`
  calls a client, passing the query's `signal` for cancellation.
- **Query keys:** the store owns its query keys, which start with the domain
  name (`['vehicles', 'search', criteria]`). No other store reads or writes
  another store's keys.
- **Changes:** a mutation updates the cache from its `onSuccess`, through
  `invalidateQueries` on its own keys or `setQueryData`. When another store
  must react, publish a typed event through the domain's `events` API; the
  owner applies it. Never patch a cache you do not own.
- **The four screen states:** every smart screen designs loading, error,
  empty and content.
  - `isLoading` means the first fetch; `isFetching` means a background
    refetch, and a refetch keeps stale content on screen.
  - A pending mutation disables resubmission.
  - A failure keeps the user's draft.
- **One cache:** `domains/shared/util-query/query-cache.ts`. Signing out
  clears it.

## The chat (CopilotKit)

- `ChatConversationStore` is the only place that calls `useAgent`,
  `useCopilotKit` and `runAgent`.
- Every run forwards the `locale` property (see ADR-0003 and the web
  `ChatAgentClient`).
- The AG-UI agent mutates its message list in place, so a store that derives
  values from it opts out of React Compiler memoization with `'use no memo'`.
- Conversation history belongs to the AI service (Mastra memory). The device
  never persists a transcript.

## Local and client state

- Screen-local state is `useState` in the smart screen. State holds ground
  truth (`isOpen`, the draft), not derived or visual values; derive during
  render.
- State that outlives a screen or is read from list items uses a small
  Zustand store with selectors, behind a `-store.ts` hook. Don't add one
  before a second consumer exists.

## Forms

- `useForm` (React Hook Form with the zod resolver) lives only in the smart
  screen.
- Dumb fragments receive `value` and `onChange` (or a `Controller` render
  prop's field) and never the form instance.

## Storage and sessions

- **Secrets:**
  - Tokens live in `expo-secure-store`, behind a client in `data/` or the
    session runtime.
  - Preferences use `expo-sqlite/localStorage` with user-scoped keys.
  - Never AsyncStorage.
- **Sessions** (when the `auth` domain arrives): one writer holds `restoring |
signed-out | verifying | signed-in | error`.
  - A session is usable only after the gateway's `/auth/session` verifies the
    UID.
  - Invalidation clears the query cache and every client store.
  - Async results are applied only when their scope is still current, as on
    web.
