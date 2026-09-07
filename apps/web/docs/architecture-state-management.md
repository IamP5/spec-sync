# Signal Store

_(derived from [ADR-0002](adr/0002-ngrx-signal-store-for-state.md))_

State is managed with the NgRx Signal Store (`@ngrx/signals`) and the NgRx
Toolkit (`@angular-architects/ngrx-toolkit`). These conventions are checked by
the tsarch tests in `apps/web/arch/`.

## Location of Stores

- Place new Signal Stores at the feature level whenever possible, co-located
  with the smart component that uses them (same folder).
- Stores remain private to their feature. Reuse a complete feature through its
  public entry; do not import its store into another feature. Propose a dedicated
  shared state owner only when independent consumers truly require one.
- If a store is needed across different domains, consult the user before
  moving it to the shared area.

## Granularity of Stores

- A store MUST manage exactly one of the following responsibilities — never a
  mix:
  1. **Search/list state** of one entity type (the collection, filters,
     paging).
  2. **Detail/edit state** of a single entity (selected/edited entity,
     create/update/delete).
  3. **A piece of UI state.**
  4. **Lookup data** (e.g. dropdown values). Bundle these in one store per
     feature named `<Feature>LookupStore`.

- Naming MUST make the responsibility explicit (examples use arbitrary
  entities; the rule applies to every entity in every domain):
  - Search/list store: `<Entity>SearchStore` in `<entity>-search-store.ts`
    (e.g. `SpecSearchStore`).
  - Detail/edit store: `<Entity>DetailStore` in `<entity>-detail-store.ts`
    (e.g. `ConversationDetailStore`).
  - These map 1:1 to the smart-component suffixes `Search` and
    `Detail`/`Edit`.

- A "manage" / CRUD feature is NOT one store. Split it:
  - the list/overview belongs to the `<Entity>SearchStore`;
  - selecting, creating, updating and deleting a single record belongs to the
    `<Entity>DetailStore`.
  - Concretely: `editId`, `selectedEntity`, `create`, `update`, `remove`,
    `startEdit` and `cancelEdit` MUST live in the detail/edit store, never in
    the search/list store.

- Never perform data access directly within a store; delegate it to a data
  access service (`-client.ts`) instead.

### Self-check before adding state to a store

- Does the store already hold list state AND a selected/edited record? → split
  it.
- Does the store name end in `SearchStore`, `DetailStore` or `LookupStore`? If
  none of these, justify why.
- Could a list view and an edit view import this store independently? They
  should import _different_ stores.

## Store Dependencies

- A store MUST NOT depend on another store. Combining state from several
  stores is the job of a coordinator, never of a store itself.

## Coordinators

- When a feature needs to read and combine state from several stores (and
  delegate writes back to them), introduce a coordinator instead of letting a
  store depend on other stores.
- A coordinator is a plain injectable service class, not a Signal Store.
  Application-wide coordination may use `providedIn: 'root'`; coordination of
  scoped stores must be provided at the same feature/dialog scope. Use the suffix `Coordinator` and the file suffix
  `-coordinator.ts` (e.g. `SummaryCoordinator` in `summary-coordinator.ts`).
- A coordinator MAY inject several stores; it typically exposes `computed`
  views derived from them and forwards write actions to the underlying stores.
  Reference: `ChatCoordinator` (`apps/web/src/app/domains/chat/feature-chat/chat-coordinator.ts`)
  combines the open conversation with the thread history.

## Structure of Stores

- Use the following features from the NgRx Toolkit:
  - `withResource` for reads (wrap an `httpResource` created by the client)
  - `withMutations` for writes (if needed)
  - `withDevtools` (always, named after the store)
- Inject the client via `withProps` under a `_`-prefixed name so it stays
  private to the store.
- For HTTP-backed state, follow this shape (a resource wrapped by the store):

```ts
export const GreetingDetailStore = signalStore(
  { providedIn: 'root' },
  withState({ name: '' }),
  withProps(() => ({ _greetingClient: inject(GreetingClient) })),
  withResource((store) => ({
    greeting: store._greetingClient.greetingResource(store.name),
  })),
  withMethods((store) => ({
    load(name: string): void { ... },
    reload(): void { store._greetingReload(); },
  })),
  withDevtools('greetingDetail'),
);
```

- State that is driven by an event stream (the chat conversation) uses
  `withMethods` instead; see `ConversationDetailStore` in
  `apps/web/src/app/domains/chat/feature-chat/chat-page`. The thread history is
  ordinary HTTP state: `ThreadSearchStore` wraps the list in `withResource`
  and `ThreadDetailStore` writes through `withMutations`.

## Cached lists and local synchronization

- Do not patch a `withResource` value slice (`<name>Value`) to cache local
  changes. The toolkit puts the resource's own value signal into the store
  state, so a `patchState` on it writes into the resource (`status: 'local'`)
  and aborts a read in flight; the list would be lost until the next reload.
- Keep the cache in a `withLinkedState` slice instead: a `linkedSignal` whose
  `source` is the resource value. Local patches land in the slice; every new
  answer of the service (a reload, or a change of the request parameters)
  replaces it. Read the list once per session, apply every change the
  browser makes to the slice, and reload only for data the browser cannot
  know.
- Stores never patch each other. A store announces what it did through an
  `eventGroup` (`@ngrx/signals/events`) and the store that owns the cached
  list applies the event with `withReducer`; `injectDispatch` in `withProps`
  keeps the dispatcher private. Reducers stay pure: timestamps travel in the
  event payload.
- Reference: `threadEvents` (`apps/web/src/app/domains/chat/data/thread-events.ts`).
  `ConversationDetailStore` dispatches `started` and `touched`,
  `ThreadDetailStore` dispatches `renamed`, `removed` and `cleared` from the
  `onSuccess` hooks of its mutations, and `ThreadSearchStore` reduces them
  into its `threads` slice. `ChatCoordinator` reloads the list once per new
  conversation, after the first reply, for the title the AI service generates.
- A detail store may keep the entities it showed in this session for instant
  switching (`ConversationDetailStore._threads`): the conversation left
  behind is kept with the messages the agent held, `open` prefers a kept
  thread over a read, and the same `threadEvents` (and session invalidation)
  drop what the service no longer has.
- `withMutations` offers only `onSuccess` and `onError`; there are no
  optimistic-update or invalidation hooks. Dispatch from `onSuccess` so the
  cache reflects what the service confirmed.
- Persist a cached list to storage only through a data access client with a
  user-scoped key (see `UserPreferencesClient`), never by persisting a
  resource value slice with `withStorageSync`: the stored value would write
  into the resource on init and be replaced by its first answer.

## Smart and Dumb Components and Stores

- Only smart components and coordinators are permitted to use stores.
- Smart components use the following suffixes: `Page`, `Search`, `Detail`,
  `Edit`, `Overview` (e.g. `ChatPage`, `ThreadSearch`).
- Dumb components live in `ui/` or `ui-<name>/` folders or use the suffixes
  `Card` / `Pane`. They receive data via `input()` and report via `output()`.
- Components obtain data only from a store or from a coordinator that
  combines several stores — never directly from a data access service.
- No locality or AI-folder exception exists. UI cannot contain or reach stores,
  coordinators, clients, or smart components, even through helper re-exports.
- Provide catalog and review stores on their feature components. A repeated tool
  result and each review dialog must get independent state and cancellation.
- Smart components may own local filters/selection signals when they are only
  needed by that instance. A feature does not require a store merely to be smart.
- Vehicle features emit structured intentions; chat adapters own prompt building
  and draft/send behavior. UI never receives injected application actions.

## Forms

- Build forms with Angular Signal Forms (`form()` from
  `@angular/forms/signals`) in the smart component. The form model is a local
  `signal`/`linkedSignal`; the store receives only the submitted value.

- Dumb form fragments may accept a parent-owned `FieldTree` and render its
  controls. Importing `FormField` is allowed; constructing `form()` belongs in
  the smart component.
- Thread history mutations live in `ThreadDetailStore`; `ThreadSearchStore`
  owns reads/filtering and keeps the list as a cache that follows
  `threadEvents`. `ChatCoordinator` synchronizes the open conversation. The AI
  service owns the history, so the browser never writes it: a run persists
  itself server-side and reopening a thread reads it back.

## Authentication lifecycle

`auth/state/AuthSessionStore` owns login/logout mutations and verified session status.
`AuthSessionCoordinator` is the public workflow facade. `AuthLoginOverview` is reusable
Google sign-in dialog content; `AuthLogoutOverview` owns the logout action. Firebase
SDK users and tokens remain in `AuthSession`, outside NgRx state and devtools.
RxFire's `user()` stream drives gateway verification through `switchMap`.

`SessionContext` is the single session lifecycle writer. Its public `SESSION` token
exposes a read-only snapshot (`restoring`, `signed-out`, `verifying`, `signed-in`,
`error`), UID/generation scope, and observable transitions. A session becomes usable
only after `/auth/session` verifies the same SDK UID. A token refresh re-verifies
without changing the generation or resetting chat.

Identity changes and logout invalidate synchronously, before new account requests
can start. Typed NgRx `sessionEvents.invalidated` reducers clear each store's own
state; established handlers load that account's data. Use `withEventHandlers` for
side effects, `withReducer` for state, and `ignoreElements` for side-effect-only
streams. Stores never inject other stores. Lazy consumers also read `SESSION` on
initialization, since an event may have happened before they existed.

Capture the session scope before asynchronous work and check `isCurrent(scope)`
before applying or persisting results. The auth HTTP interceptor cancels gateway
requests on invalidation and rejects credentials resolved for an obsolete session.
Chat stops its AG-UI run, clears messages/selection/context, and disconnects runtime
metadata on invalidation. Never reload the document for login/logout.

The user domain owns profile/roles through `UserDetailStore`, and all browser
preferences (including theme) through `PreferencesDetailStore`.
`UserPreferencesCoordinator` connects that store to the design-system theme.
Preferences migrate the former per-UID configuration theme when no new theme exists;
subsequent writes use one preferences record. Roles are server-supplied data and
never editable or used to expose privileged UI. Storage remains UID-scoped; chat
owns conversation history and user owns preferences.

`ChatPage` retains an anonymous draft while the auth dialog is open. Only an
explicit Send intent resumes sending, once, after verification and runtime readiness.
Sidebar sign-in restores the draft without sending; cancelling clears send intent
while preserving text. Leaving a verified account clears the draft synchronously,
even if logout and the next login occur before an Angular effect runs.

Shell composes profile, auth, user preferences and chat history workflows. It closes
account/settings overlays when their authenticated owner is destroyed. Shared code
contains technical utilities, never this application composition.
