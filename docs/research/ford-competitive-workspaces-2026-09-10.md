# Runtime workspaces for Ford competitive analysts

Date: 2026-09-10. Implementation follow-up to the
[A2UI product analysis](a2ui-runtime-product-analysis-2026-09-10.md).

## User value

SpecSync now supports a persistent competitive-analysis surface for Ford employees
investigating a market question. The analyst chooses the Ford reference,
competitor configurations, market, model year and relevant measures. The agent
composes the views needed for that question from a bounded custom catalog and can
revise that same surface as the analyst interacts with it.

The entry suggestions use competitive benchmarking, evidence investigation,
competitor specification research and target exploration. They avoid presenting
the product as a consumer vehicle recommender.

| Experience                | Delivered behavior                                                                                                                                 | Evidence boundary                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adaptive benchmark        | One catalog for unresolved configurations, analyst brief, comparison and gaps, in a stacked or analysis layout.                                    | Exact configuration IDs and canonical attribute codes; missing scope requires input.                                                               |
| Conditional clarification | Local brief edits and shortlist choices apply together as one typed action.                                                                        | No guessed trim, baseline or target. The server verifies selections and the Ford reference.                                                        |
| Evidence investigation    | Click an unresolved cell to request evidence for its configuration and attribute; inspect source passages, scope and conditions.                   | Missing indexed reviews do not establish absence; review opinion does not become an accepted specification.                                        |
| Progressive research      | An existing private research request renders the native live feature. Completion becomes a persisted activity with an explicit review entry point. | Draft claims remain subject to human review/publication. No invented tool invocation.                                                              |
| Benchmark target scenario | An explicit target is compared with accepted numeric observations in their canonical unit.                                                         | Delta is reported value minus target, not advantage or rank. Missing/conflicting values remain unresolved; qualifiers and provenance stay visible. |

## Runtime composition and interaction

The agent calls `renderCompetitiveWorkspace` with a compact typed plan. It chooses
up to six panels, their stable IDs, titles, order, retrieval scope and one of two
layouts. The server retrieves authoritative data and compiles the plan into the
`urn:specsync:a2ui:competitive-analysis:1` catalog with the
`specsync.competitive-workspace.v1` envelope.

The supported native components are `AnalystBrief`, `VehicleSelection`,
`VehicleComparison`, `VehicleEvidence`, `EvidenceGaps`, `VehicleResearch` and
`TargetScenario`, under a declared `Row` or `Column`. Angular validates the whole
snapshot, component definitions, binding paths and operations before rendering.
The agent does not generate Angular source, arbitrary HTML, scripts or new
component types.

```mermaid
sequenceDiagram
    participant Analyst
    participant Angular
    participant Agent
    participant Tool
    participant Data as Authoritative services
    Analyst->>Angular: Apply brief / investigate gap / set target / retry panel
    Angular->>Agent: AG-UI run with typed workspaceAction
    Note over Agent: Verify owner, action and saved surface revision
    Agent->>Tool: renderCompetitiveWorkspace(typed plan, target)
    Tool->>Data: Retrieve requested facts or reuse explicit saved evidence
    Data-->>Tool: Typed source results
    Tool-->>Angular: Real tool result: complete validated revision
    Angular-->>Analyst: Update the same native surface; retain real history
```

Actions have a UUID, surface ID, expected revision, component ID, declared action
and schema-validated values. Persisted user-message metadata preserves the action
for interrupted-run retry. A subsequent ordinary prompt does not inherit it.
The original successful tool renderer hosts the current surface; later real tool
results remain visible as update receipts. Saved history restores the current
uncontested revision without another model call.

The server enforces the exact typed action even if the model proposes a different
plan. A panel retry retrieves that panel only. A gap investigation preserves
unrelated successful panels and targets the clicked gap. A scenario can reuse
the saved accepted observations for deterministic target arithmetic. These are
explicit action semantics, not response parsing or guessed frontend grouping.

## Failure behavior and practical limits

- Failed updates retain the previous successful surface. Targeted retries retain
  unaffected results. Failed panels and missing evidence remain distinct states.
- Stale, replayed, malformed and foreign-owner actions are rejected before a new
  model call. Regenerating an already-acknowledged action preserves its result.
- A run permits one update for a typed action. Public Mastra memory offers no
  compare-and-swap revision write; truly simultaneous cross-instance appends can
  still race. Fork detection preserves the last common revision and rejects
  further updates until the analyst starts a new analysis. This is conflict
  detection, not a claim of globally atomic or exactly-once persistence.
- Results are full snapshots delivered when the tool completes. The research
  feature polls its own progress; arbitrary panel-by-panel A2UI operation
  streaming and partial claim publication are not implemented.
- The renderer supports the pinned application catalog, not arbitrary A2UI
  catalogs, nested layouts or generated executable components. The older
  `renderVehicleWorkspace` profile remains available for compatibility.
- Scenarios do not supply unit conversions, costs, market-share forecasts,
  optimization scores or automatic recommendations. Different measurement
  conditions must be assessed in their displayed evidence context.

## Contract migration

The work also replaces the three patterns identified in the
[contract audit](agentic-ui-contract-audit-2026-09-10.md): inferred transcript
supersession, arbitrary knowledge-field presentation and synthetic research
review invocations. Dedicated schemas and documented historical decoders preserve
replay. Actual past calls are never rewritten.

## Verification

Verified on 2026-09-11:

- All 369 Angular tests and 65 architecture tests passed. Web/UI lint and the
  Angular production build passed. Existing dependency/build warnings remain.
- The AI unit suite, strict typecheck and lint passed, together with 12 data
  foundation tests, 27 benchmark tests and 4 local Neo4j integration tests.
  The full suite passed 416 tests; 30 focused tests passed after the final gap-ID
  fix. The final Mastra production bundle passed in an isolated Nx project copy,
  preserving the running development service and its output directory.
- Actual Mastra/LibSQL persistence with scripted model responses and the AG-UI
  bridge covers two revisions, saved actions, invalid ownership, stale/reused
  actions, parallel calls within a run and revision conflicts.
- Actual CopilotKit Angular rendering with scripted AG-UI events covers one
  surface across revisions and replay, brief actions, forwarded intent and
  persisted metadata, composer draft preservation, credit blocking and no action
  inheritance into an ordinary subsequent prompt.
- Targeted tests cover retained panels, accepted source observations, explicit
  targets, underscore-containing attribute codes, historical evidence decoding,
  link safety and directly rendered research completion.

The browser walkthrough could not run because the Mac was locked. The web app
and AI health endpoint returned HTTP 200; this does not verify an authenticated
live-model journey. Scripted integration verifies transport, interaction and
replay, not the production model's tool-selection accuracy. No new production
model quality or latency result is claimed.
