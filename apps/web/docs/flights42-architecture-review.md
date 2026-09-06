# Flights42 architecture reference review

Status: historical, non-binding research note. The proposal was subsequently
implemented; see [ADR-0005](adr/0005-composable-features-and-pure-ui.md) and the
binding [architecture rules](architecture-boundaries.md) for the current design.

Reference: `angular-architects/flights42`, branch `ai-arc`, inspected at commit
[`caaac81f414188d2ca7410a6e1e236d4a200e5e4`](https://github.com/angular-architects/flights42/tree/caaac81f414188d2ca7410a6e1e236d4a200e5e4),
on 2026-09-06. External links are pinned to that commit.

## Written rules compared with the proposal

| Proposal                                                | Relationship to Flights42                                                                                               | SpecSync decision                                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Separate workflows from presentational cards/panes      | Consistent with smart/store/client responsibilities, but Flights42 permits dumb components to consume colocated stores. | Remove the locality exception to satisfy the user's stricter UI requirement.                       |
| Keep application stores and coordinators outside UI     | Stricter than the reference, which prefers feature-local stores and permits lower-layer reuse.                          | UI remains presentational regardless of suffix or proximity; presentation signals are appropriate. |
| Let separate features compose public feature components | Departs from feature-slicing guidance and the active layer graph.                                                       | Define public entries, private implementations, and an acyclic dependency direction.               |
| Introduce vehicles beside chat                          | Compatible with isolation; this particular cut is our semantic judgment.                                                | Keep vehicle semantics together and expose selected integration contracts.                         |
| Keep CopilotKit and prompts in chat adapters            | Our integration decision. The reference instead also offers a privileged AI layer.                                      | Vehicle features expose typed inputs/events independent of chat runtime types.                     |

Sources: [state rules](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/docs/architecture-state-management.md#L3-L77),
[feature slicing](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/docs/architecture-boundaries.md#L48-L58),
[domain boundaries](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/docs/architecture-boundaries.md#L12-L22),
[active layer graph](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/sheriff.config.ts#L21-L34).

## Feature composition and domain APIs

Flights42 tags each `feature-<name>` folder as a module. Its rules move reused
same-domain code downward, and `type:feature` cannot import another feature
module. Composing smart components inside one feature module is different: their
subfolders do not establish independent enforcement boundaries.
[Module mapping](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/sheriff.config.ts#L5-L31).

Our requested model should permit selected public feature components/contracts
while keeping stores and internal components private. Alternatively, one
`feature-vehicles` containing catalog, comparison, reviews, and detail follows the
existing graph but gives them one enforcement boundary. Several modules should
represent useful ownership boundaries, not a one-component/one-feature rule.

The reference's `sheriff.config.api.ts` illustrates a public domain API able to
expose features as well as lower layers, with a specific consumer grant. This is
not active configuration: `sheriff.config.ts` has no API mapping. Both enable
barrel-less access; adding an `index.ts` alone does not establish private access
protection. SpecSync needs matching domain/layer permissions and checks.
[API example](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/sheriff.config.api.ts#L3-L55),
[active configuration](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/sheriff.config.ts#L3-L31).

## Standards to retain

Keep feature-local stores until concrete reuse requires moving them. Separate
search/list, detail/edit, UI state, and lookup responsibilities. Clients remain
stateless; components use stores/coordinators; stores never depend on stores.
Coordinators combine them. Preserve meaningful smart suffixes, input/output
components, OnPush, signals, and Signal Forms.
[State conventions](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/docs/architecture-state-management.md#L3-L73),
[client rules](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/docs/architecture-boundaries.md#L60-L69),
[component standards](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/AGENTS.md#L28-L45).

The reference describes root coordinators. SpecSync must retain independent
state per repeated chat tool result. Likewise, smart-component form ownership is
an existing SpecSync rule, not an explicit requirement in the reference state doc.

## Enforcement caveats

The four tsarch rules inspect imports classified by suffix/path: client access,
store access, store-to-store access, and dumb-to-smart imports. They do not directly
check workflow logic, prompt construction, form ownership, or coordinator access.
The locality filter accepts stores anywhere below the importer's folder. A smart
suffix under UI can match both smart and dumb classifications. `/ai/` bypasses
client/store checks, although Sheriff still constrains domain/layer imports.
[Access rules](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/arch/access-rules.spec.ts#L13-L70),
[locality implementation](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/arch/utils.ts#L27-L39).

Proposed SpecSync coverage should test UI access to stores/coordinators, smart
implementations under UI, feature-private imports, selected domain APIs, and
forbidden dependency cycles. Classify behavior too; renaming a component or
hiding workflow access behind a callback is insufficient.

## Domain judgment and limits

The reference's domain-review guidance prioritizes consistent domain language;
structural and historical coupling provide additional evidence. That supports
evaluating vehicle specifications/comparisons separately from conversation turns
and messages. It does not establish catalog and comparison as separate domains.
A knowledge/evidence domain needs independent semantics and workflows.
[Semantic criteria](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/.agents/skills/domain-boundaries-review/SKILL.md#L40-L69).

No forensic analysis or reference tests were run for this written-rules review.
Flights42 uses Angular 21/Hashbrown; SpecSync uses Angular 22/CopilotKit. This is
an architecture reference, not a dependency migration recipe.
[Reference dependencies](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/package.json#L36-L53).

## Implementation review and revised SpecSync plan

The following conclusions combine the inspected source with SpecSync's existing architecture and the user's requested stricter UI boundary. They are recommendations, not additional binding rules.

### Keep the container/view split, and preserve locality

`FlightSearch` injects its store and owns its filter form; `FlightCard` accepts a domain entity and selection inputs, then emits selection changes. This supports extracting `VehicleCatalogOverview`, `VehicleComparisonOverview`, and `VehicleReviewsSearch` from the current vehicle UI workflows. Domain-aware presentation is compatible with a dumb component.

A dumb component does not have to live in domain-level `ui/`: `PassengerCard` stays within `feature-booking`. Keep each extracted view local to its consuming feature until a second independent feature actually needs that view. Reusing a whole feature does not make its internal view shared.

Sources: [FlightSearch](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/src/app/domains/ticketing/feature-booking/flight-search/flight-search.ts#L15-L41), [FlightCard](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/src/app/domains/ticketing/ui/flight-card/flight-card.ts#L17-L29), [PassengerCard](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/src/app/domains/ticketing/feature-booking/passenger-card/passenger-card.ts#L16-L27).

### Compose features explicitly

The shell's `Dashboard` embeds `NextFlightsModule`, which exports `NextFlightsOverview`. This is working page composition; it does not demonstrate unrestricted imports between separate domain feature modules. The ticketing API export and the checkin consumer import are commented out. Use standalone entry components in SpecSync, retaining its existing standalone requirement.

For the user's requested feature-to-feature reuse, expose entry components and interaction contracts, prohibit imports of another feature's private stores, and enforce acyclic dependencies. Merely allowing the `type:feature` tag would not enforce privacy or cycle freedom.

Sources: [Dashboard](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/src/app/shell/dashboard/dashboard.ts#L1-L10), [NextFlightsModule](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/src/app/domains/ticketing/feature-next-flights/next-flights.module.ts#L10-L16), [ticketing API](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/src/app/domains/ticketing/api/index.ts#L1), [checkin consumer](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/src/app/domains/checkin/feature-checkin/checkin-page.ts#L24).

### Keep AI integration outside dumb views

Flights42 places Hashbrown tools, prompts, and widgets under `ticketing/ai`. Its flight widget injects a feature store and router. Its shared `AssistantChat` also injects a registry and sends messages, so the source does not consistently embody strict dumb-only UI.

Retaining CopilotKit adapters in SpecSync's chat feature is an intentional application-specific choice. Vehicle features should receive validated vehicle data or IDs and emit structured intentions such as comparison requests or selected evidence IDs. Chat integration owns draft/send behavior and runtime tool envelopes. A new `ai/` folder with broad access exceptions is unnecessary for this extraction.

Sources: [TicketingChatService](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/src/app/domains/ticketing/ai/ticketing-chat-service.ts#L19-L44), [FlightWidget](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/src/app/domains/ticketing/ai/widgets/flight-widget.ts#L85-L113), [AssistantChat](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/src/app/domains/shared/ui-assistant/assistant-chat/assistant-chat.ts#L22-L63).

### Keep form ownership and state lifetime precise

Dumb form fragments can accept a parent-owned `FieldTree`; importing `FormField` alone does not make a component smart. The owner creates the form, manages validation/submission, and interacts with its store. Preserve per-rendered-result and per-dialog stores in SpecSync rather than mechanically copying root-scoped stores. Introduce coordinators for actual orchestration across stores, not as wrappers around every component.

Sources: [FlightForm](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/src/app/domains/ticketing/feature-booking/advanced-flight-edit/flight-form/flight-form.ts#L1-L23), [FlightEdit](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/src/app/domains/ticketing/feature-booking/flight-edit/flight-edit.ts#L56-L85), [SummaryCoordinator](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/src/app/domains/ticketing/feature-booking/summary-page/summary-coordinator.ts#L1-L36), [scoped NextFlightsOverview](https://github.com/angular-architects/flights42/blob/caaac81f414188d2ca7410a6e1e236d4a200e5e4/src/app/domains/ticketing/feature-next-flights/next-flights-overview/next-flights-overview.ts#L7-L19).

### Account for the data-layer dependency before moving domains

`ChatAgentClient` calls `comparisonSelection` when restoring and updating AG-UI context; that helper validates the vehicle comparison schema. Moving all of `vehicle-comparison.ts` into a vehicles domain would therefore affect data access, not only UI.

Split message/protocol interpretation from vehicle comparison semantics. Define a narrowly allowed contract-only public surface for lower-layer consumers, or move the schema-dependent mapping above the data client into integration orchestration. Avoid broadly allowing a data client to import a mixed API that exports feature components. This is required design work before the domain migration, not a reason to place vehicle models in shared.

Local sources: [ChatAgentClient](../src/app/domains/chat/data/chat-agent-client.ts), [comparison helpers](../src/app/domains/chat/data/comparison-selection.ts), [Sheriff layers](../sheriff.config.ts).

### Recommended delivery order

1. Record strict dumb UI and controlled feature composition as deliberate SpecSync decisions; align the architecture docs and enforcement in the implementation change.
2. Finish the existing catalog extraction, then split comparison and reviews. Keep views local and stores scoped to their consumers.
3. Define each feature's entry component and typed events; register chat adapters instead of workflow-owning UI cards.
4. Resolve contract ownership and AG-UI context restoration, then introduce the proposed vehicles domain with catalog, comparison, and reviews as features. Keep conversations/history/preferences in chat. Defer a separate evidence domain pending independent workflows and vocabulary.
5. Validate architecture restrictions as well as multiple simultaneous tool results, retry/cancellation, shortlist and evidence selection, dialog focus restoration, draft-versus-send behavior, and reopening stored threads.

The review itself changed only this note. The subsequent implementation is recorded in ADR-0005.
