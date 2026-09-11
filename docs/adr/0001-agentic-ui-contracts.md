# ADR-0001: Explicit agentic UI contracts

Status: Accepted — 2026-09-10

Scope: AI tools, AG-UI/CopilotKit integration, A2UI catalogs, and their Angular consumers.

## Context

A request comparing BYD Shark and Ford Ranger produced separate catalog cards.
The agent instructions and tool description required a separate search call for
each vehicle. A proposed frontend fix combined those tool results after the run.
That concealed an inadequate tool contract and made the browser decide which
interactions the agent should have requested. The user rejected that approach.

## Decision

The agent chooses the intended tool and supplies its complete, typed intent.
Tools retrieve authoritative facts and return the data required by their
registered components. AG-UI transports the actual calls/results; CopilotKit
dispatches each result to its registered renderer. Angular validates that
contract and renders it without reconstructing the agent's intended workflow.

For a multi-vehicle catalog, the agent calls `searchVehicleConfigurations` once:

```json
{ "searches": [{ "q": "BYD Shark" }, { "q": "Ford Ranger" }] }
```

The server executes the bounded searches, deduplicates configuration IDs, and
returns one catalog with all retrieved vehicles, explicit retrieval notices and
continuation queries. The model supplies search intent, never copied or invented
factual vehicle payloads. One tool result renders one catalog component.

### Required boundaries

- Fix tool granularity, schemas, descriptions, examples and agent instructions
  when the model chooses the wrong interaction. Add a regression for the tool
  call and its component contract; do not conceal the symptom in the transcript.
- Define dedicated or discriminated result schemas for user-facing components.
  Empty, partial, failed, loading and continuation states must be explicit.
- Keep the real tool invocation IDs, arguments and results in history. Do not
  invent assistant tool calls to mount a component. Background workflows use
  explicit lifecycle/state events or an actual agent continuation.
- Declare background-only versus user-facing tools at their registration or in
  a typed presentation contract. Do not derive visibility or supersession by
  scanning arbitrary neighboring messages, tool names or result fields.
- Use A2UI/DSL to express approved component intent and bindings. The server may
  compile a bounded DSL deterministically. A renderer may dispatch a declared
  catalog component; it may not invent panels from unrelated results or prose.
- Keep normal feature behavior in Angular: filtering, sorting, explicit
  selection, accessibility, pagination and authenticated actions. Those are
  declared component interactions, not an attempt to infer agent intent.

### Parsing that remains necessary

Decode AG-UI JSON and validate it against schemas. Reject invalid data, unsafe
links, unsupported catalog versions, bindings and components. Render Markdown
as text content; never extract commands or component data from it. A documented
transport adapter may repair event ordering or deduplicate the same invocation
ID without changing semantic results. Selection restoration may consume a
validated structured result or explicit user selection.

This decision prohibits semantic reconstruction, not JSON parsing. Asking a
model to repeat authoritative facts into another frontend tool is also not a
replacement for a suitable server result contract.

## Verification

Test the complete contract: requested tool arguments, authoritative result,
actual AG-UI tool events, CopilotKit component dispatch, failure/partial states,
continuations and saved replay. Assert that the browser has not merged calls or
fabricated results. Tests with a scripted model verify integration; report
separately whether real-model tool choice was evaluated.

## Consequences and migration

The multi-search catalog fixes the source contract. Historic conversations keep
their real recorded calls; they are not rewritten to appear compliant. A new
agent run is needed to obtain the new single-result catalog.

Existing presentation heuristics are documented in the
[contract audit](../research/agentic-ui-contract-audit-2026-09-10.md). They are
migration debt, not precedents for new work. Replace them with explicit contracts
and replay coverage before removing their current UX behavior. This ADR is an
agent/review rule; it does not claim static lint can verify model tool choice.
