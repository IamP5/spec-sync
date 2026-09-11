# Agentic Angular: research workspaces

Reviewed all ten articles in Manfred Steyer's **Agentic UI with Angular** series on 2026-09-10 and applied the relevant patterns to SpecSync.

The subsequent [explicit agentic UI decision](../adr/0001-agentic-ui-contracts.md)
governs tool/component contracts. Catalog-only requests now use one multi-search
tool call containing all named vehicles; the browser does not merge separate
responses. The multi-panel DSL below remains available for explicit composite
workspaces.

## Series review

| Article                                                                                                                                              | Application to SpecSync                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [1. Understanding AG-UI](https://www.angulararchitects.io/en/blog/understanding-ag-ui-the-standard-for-agentic-user-interfaces/)                     | Keep ordinary vehicle workflows usable; give streamed work understandable progress labels.                                                                               |
| [2. AG-UI TypeScript SDK](https://www.angulararchitects.io/en/blog/ag-ui-in-practice-the-sdk-for-typescript/)                                        | Keep run, message and tool identities distinct; tolerate incomplete streamed arguments; let CopilotKit execute browser tools.                                            |
| [3. AG-UI end to end](https://www.angulararchitects.io/en/blog/ag-ui-in-practice-ag-ui-end-to-end-connecting-server-and-client/)                     | Keep the Mastra adapter and AG-UI boundary. Preserve the repository's existing server-owned memory and canonical history reconciliation.                                 |
| [4. Angular and CopilotKit](https://www.angulararchitects.io/en/blog/implementing-ag-ui-with-angular/)                                               | Keep feature-scoped tool registration and headless Angular rendering. Send actions through the existing CopilotKit application lifecycle.                                |
| [5. A2UI at runtime](https://www.angulararchitects.io/en/blog/a2ui-how-ai-generates-dynamic-uis-at-runtime/)                                         | Separate component structure from factual data; use a catalog of trusted components and explicit data bindings.                                                          |
| [6. A2UI over AG-UI](https://www.angulararchitects.io/en/blog/integrating-a2ui-with-ag-ui-in-angular/)                                               | Validate before rendering. Use the article's tool-result transport alternative so generated workspaces survive existing Mastra history replay.                           |
| [7. Custom catalogs](https://www.angulararchitects.io/en/blog/custom-catalogs-in-a2ui-your-own-components-for-ai-generated-uis/)                     | Reuse domain-specific Angular views. Pin an approved catalog locally and on the server; do not promote browser-supplied component descriptions into system instructions. |
| [8. DSL and performance](https://www.angulararchitects.io/en/blog/how-i-made-my-a2ui-dashboard-300-times-faster/)                                    | Let the model describe a small set of desired panels; fetch data and generate A2UI deterministically. Deduplicate identical reads within a request.                      |
| [9. MCP Apps](https://www.angulararchitects.io/en/blog/agentic-ui-with-mcp-apps-tool-results-as-interactive-widgets/)                                | Reserve remotely supplied widgets for a concrete third-party integration. SpecSync's own workflows belong in its native component catalog.                               |
| [10. Angular MCP Apps](https://www.angulararchitects.io/en/blog/mcp-apps-in-angular-with-copilotkit-rich-chat-interfaces-instead-of-text-responses/) | A headless transcript must explicitly render activity messages before adopting activity-based widgets. Do not assume SDK ingestion makes them visible.                   |

These are design choices inferred for this repository, not a verbatim port of the demo. In particular, SpecSync already persists conversations in Mastra memory; changing that ownership would break its established authentication and history contracts.

## Implemented interaction

An empty conversation offers **Build a research workspace**. Its current suggestion asks to show Ranger and Hilux together in one interactive catalog for Brazil, model year 2026. Catalog-only requests use one multi-search tool call. Users inspect configurations, select vehicles, open sourced specifications, and ask follow-up questions through the existing vehicle features. Mixed workspaces can also include catalog panels; those panels share a shortlist of up to five vehicles.

For resolved configurations, a workspace can combine comparison, specifications and indexed review evidence. Unknown facts and conflicting observations retain the existing domain presentation. No winner or confidence score is invented by the layout layer.

For the catalog-only example, `searchVehicleConfigurations` receives:

```json
{
  "searches": [
    {
      "q": "Ford Ranger",
      "market": "BR",
      "year": 2026
    },
    {
      "q": "Toyota Hilux",
      "market": "BR",
      "year": 2026
    }
  ]
}
```

For mixed workspaces, `renderVehicleWorkspace` accepts a compact, strictly validated DSL with a title and at most four panels. Catalog panels select a query and scope; comparison panels select 2–5 known configuration UUIDs; specifications select one UUID; reviews select an existing configuration and optional search terms. Comparison and specification panels require 1–12 explicit supported attribute codes, because the catalog API interprets an empty list as every attribute. The tool fetches all factual content from existing services. A failed panel does not hide successful panels. There is no model-authored HTML, factual result payload, executable expression, or arbitrary component name.

The backend builds a self-contained A2UI v0.9 operation sequence:

1. `createSurface` selects `urn:specsync:a2ui:vehicle-workspace:1`.
2. `updateComponents` declares one root `Column` with up to four `VehicleCatalog`, `VehicleComparison`, or `VehicleEvidence` children.
3. `updateDataModel` binds authoritative panel data at `/tiles/0` through `/tiles/3`.

The sequence travels in the ordinary AG-UI tool result. Mastra already stores those results, so reopening a conversation reconstructs its workspace without fetching facts again. Follow-up requests may fetch newer facts; replaying an old response shows its saved snapshot.

## Compatibility and boundaries

This is an explicitly bounded **custom catalog profile**, not a general A2UI renderer. It supports complete workspace snapshots, not arbitrary Basic Catalog components, expression evaluation, patch-only streams, `deleteSurface` messages, or third-party catalogs. Angular component destruction owns the local UI lifetime. Repeated transcript updates with unchanged result text retain parsed data identity; a revised complete result with the same surface ID is processed again.

The [A2UI v0.9 specification](https://a2ui.org/specification/v0.9-a2ui/) permits application catalogs, string catalog identifiers and the structure/data split used here. Both sides pin the same profile. The upstream specification now also lists v0.9.1 and a v1.0 candidate; protocol upgrades should be explicit, with fixtures for saved conversations.

At implementation time, npm reported `@a2ui/angular` 0.10.6 with Angular `^21.2.5` peers; this workspace uses Angular 22.1. The implementation therefore reuses native Angular components without forcing incompatible dependency peers. It also avoids the SDK's default A2UI action path, which would bypass SpecSync's authentication refresh, run settings and credit lifecycle.

Browser validation checks the exact catalog/version, operation ordering, surface consistency, component identifiers, child references, binding paths, panel kinds and domain result schemas. Both application schemas must evolve together. The renderer never fetches a catalog from the URI supplied in a result.

UI remains declarative. Existing smart vehicle features own their data and interactions; their dumb views receive inputs and emit intentions. Chat adapters turn those intentions into drafts or explicit sends through `CHAT_CARD_ACTIONS`. Sending from a card preserves an unrelated composer draft and respects current run, loading and credit state.

The underlying conversation lifecycle also guards against delayed authentication, cancelled runs and out-of-order history requests. Stale work cannot start or overwrite a newer conversation; shared-agent cleanup completes before another run starts. Tool activity uses readable progress labels and identifies partially completed workspaces.

## Extending the product

For another panel kind, define its bounded DSL input, server data source, approved catalog entry, validated result, and native feature adapter together. Use real provenance and domain semantics. Add negative contract tests and a saved-result rendering test before advertising the capability to the agent.

Use ordinary tools for a single search or comparison. Workspaces are for combined investigation or a user-requested dashboard; do not call tools twice merely to decorate data already displayed. No model-latency or token-reduction benchmark is claimed here. Measure end-to-end latency, generated DSL size, retry rate and payload size with representative workloads before claiming the article's speedups for SpecSync.

Cross-request caching and persisted custom layouts are not introduced. The AI service remains stateless outside its existing conversation memory. MCP Apps remain a separate integration decision; a future implementation needs resource validation, explicit activity rendering, lifecycle cleanup and the isolation required by the [official MCP Apps specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx).

## Verification

`npm run verify -- --changed` passed web/UI lint, 65 architecture tests, 321 web tests, the Angular production build, 12 AI data tests, 27 AI benchmark tests, AI lint/typechecking and 376 AI unit tests. Its final AI build was blocked by Mastra's protection for the existing development server.

The AI production build then passed with `NX_DAEMON=false npm exec -- nx run ai:build --skipNxCache` in an isolated temporary workspace using byte-identical AI sources, the installed dependencies and the same resolved build target. The running development server and its output remained intact. Existing lint and Angular dependency warnings remain.

Integration coverage includes actual CopilotKit tool rendering and saved conversation replay, malformed workspace results, partial failures, cross-panel shortlists, cancellation and thread navigation races. A signed-out browser smoke check confirmed the new workspace entry renders. An authenticated provider conversation was not exercised.
