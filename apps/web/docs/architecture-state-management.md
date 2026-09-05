# Signal Store

_(derived from [ADR-0002](adr/0002-ngrx-signal-store-for-state.md))_

State is managed with the NgRx Signal Store (`@ngrx/signals`) and the NgRx
Toolkit (`@angular-architects/ngrx-toolkit`). These conventions are checked by
the tsarch tests in `apps/web/arch/`.

## Location of Stores

- Place new Signal Stores at the feature level whenever possible, co-located
  with the smart component that uses them (same folder).
- If a store is needed by additional features, move it down to a lower level
  of the same domain.
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
- A coordinator is a plain `@Injectable({ providedIn: 'root' })` service class
  — NOT a Signal Store. Use the suffix `Coordinator` and the file suffix
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

- State that is driven by an event stream or by local storage (the chat
  conversation, the thread history) uses `withMethods` instead; see
  `ConversationDetailStore` and `ThreadSearchStore` in
  `apps/web/src/app/domains/chat/feature-chat`.

## Smart and Dumb Components and Stores

- Only smart components and coordinators are permitted to use stores.
- Smart components use the following suffixes: `Page`, `Search`, `Detail`,
  `Edit`, `Overview` (e.g. `ChatPage`, `ThreadSearch`).
- Dumb components live in `ui/` or `ui-<name>/` folders or use the suffixes
  `Card` / `Pane`. They receive data via `input()` and report via `output()`.
- Components obtain data only from a store or from a coordinator that
  combines several stores — never directly from a data access service.
- Exception (locality): a dumb component MAY use a store that is co-located in
  the same folder or in a child folder of it.
- Exception (ai): files inside an `ai` layer (any `ai/` folder) are exempt
  from these access restrictions and may access stores and data access
  services directly.

## Forms

- Build forms with Angular Signal Forms (`form()` from
  `@angular/forms/signals`) in the smart component. The form model is a local
  `signal`/`linkedSignal`; the store receives only the submitted value.
