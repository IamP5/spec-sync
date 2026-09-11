# Runtime UI generation in SpecSync

Date: 2026-09-10. Analysis and proposed direction; no runtime changes in this review.

## Conclusion

SpecSync already supports **bounded runtime UI composition**. The agent can choose
the types, number, order, titles and retrieval scope of workspace panels. The
server obtains authoritative data, compiles the plan into an A2UI custom-catalog
snapshot, and Angular renders the declared components. The whole combination does
not have to be a screen that a developer designed in advance.

The individual components are developed in advance. A2UI describes an interface
using available components; it does not require generating and compiling new
Angular code. A compact DSL can express that composition just as deliberately as
raw A2UI JSON, with a smaller model output. Deterministic compilation of explicit
intent follows [ADR-0001](../adr/0001-agentic-ui-contracts.md).

Our present capability stops short of an adaptive workspace that changes in place
after each meaningful interaction. This is the most valuable next extension.

## What the articles establish

- [Runtime UI generation](https://www.angulararchitects.io/en/blog/a2ui-how-ai-generates-dynamic-uis-at-runtime/)
  separates component structure from bound data. The catalog defines the available
  vocabulary, and interaction can feed another agent response.
- [Integration with AG-UI](https://www.angulararchitects.io/en/blog/integrating-a2ui-with-ag-ui-in-angular/)
  shows how the UI description travels through the agent connection. A2UI describes
  the view; AG-UI supplies transport and run interaction. Using a tool result as
  the carrier is an explicit alternative in the article.
- [Custom catalogs](https://www.angulararchitects.io/en/blog/custom-catalogs-in-a2ui-your-own-components-for-ai-generated-uis/)
  let a renderer map domain components to application implementations. The useful
  freedom for SpecSync is choosing relevant vehicle views and their configuration,
  while retaining our evidence semantics and existing Angular interactions.
- [The DSL performance article](https://www.angulararchitects.io/en/blog/how-i-made-my-a2ui-dashboard-300-times-faster/)
  reduces model-generated structure through a compact intermediate language and
  deterministic conversion. Its fastest result also uses a cached DSL, avoiding
  model generation on that request. It does not establish a 300× improvement for
  a fresh SpecSync interaction.

The [official A2UI documentation](https://a2ui.org/) currently identifies v0.9.1 as
the production release, v0.9 as previous stable and v1.0 as a candidate. The
articles' earlier draft terminology is historical. SpecSync explicitly pins its
v0.9 application profile; adopting another protocol version is separate from
expanding the product's component vocabulary. See the accompanying
[source review](a2ui-runtime-sources-2026-09-10.md) for the detailed claims,
primary references and performance caveats.

The examples need adaptation before reuse. The AG-UI article's surface-ID
deduplication skips subsequent snapshots for that surface, so it is not a complete
update-in-place implementation. Current A2UI source also deprecates the catalog
extension API used in the tutorial. The published `@a2ui/angular` 0.10.6 package
declares Angular `^21.2.5` peers, while SpecSync uses Angular 22. Keep our native
renderer until a deliberately verified integration justifies replacing it; none
of these SDK details prevents extending our explicit application profile.

## Current implementation

| Concern      | What exists                                                                                         | Limit                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Agent intent | `renderVehicleWorkspace` accepts 1–4 typed panels: catalog, comparison, specifications and reviews. | No needs form, task criteria, chart or research-progress panel in this DSL.                                            |
| Composition  | Agent chooses panels, their order and bounded properties.                                           | Compiler always builds one root `Column`; the agent cannot compose rows, tabs or arbitrary nested layouts.             |
| Facts        | Server tools retrieve existing catalog/comparison/review data.                                      | More layout freedom cannot supply missing vehicle evidence or new calculation capabilities.                            |
| A2UI         | One self-contained `createSurface`, `updateComponents`, `updateDataModel` sequence.                 | Native application profile, not a general A2UI renderer or the upstream Angular SDK.                                   |
| Delivery     | CopilotKit registers the real tool result with the workspace component.                             | Panel retrieval completes before the snapshot is returned; there is no progressive A2UI operation stream.              |
| Interaction  | Native filtering, sorting, drawers, shared shortlist and follow-up actions work.                    | Follow-ups use our chat action/prompt path; there is no general typed A2UI action-feedback contract.                   |
| Updates      | Re-rendering a revised complete result is supported locally.                                        | Each server invocation creates a new surface UUID; no tool targets an existing surface for an agent-authored revision. |
| Replay       | Tool-result snapshots survive saved conversation replay.                                            | Restoring a snapshot is not a persisted, editable workspace with a revision/action lifecycle.                          |

Implementation anchors:
[tool](../../apps/ai/src/mastra/tools/vehicle-workspace-tool.ts),
[DSL](../../apps/ai/src/mastra/workspace/contracts.ts),
[compiler](../../apps/ai/src/mastra/workspace/compiler.ts),
[browser validation](../../apps/web/src/app/domains/chat/data/vehicle-workspace-contracts.ts),
[native renderer](../../apps/web/src/app/domains/chat/feature-chat/tool-adapters/chat-vehicle-workspace-overview.ts),
[CopilotKit registration](../../apps/web/src/app/domains/chat/feature-chat/chat-page/chat-tools.ts).

An ordinary request for BYD Shark and Ford Ranger still belongs to **one
multi-search catalog call**. An A2UI workspace becomes useful when the task needs
several different views together. The word “workspace” alone should not cause the
agent to create several catalogs or repeat a successful retrieval just for layout.

## Product opportunities, in recommended order

These are product recommendations inferred from the articles and repository, not
features that the articles or our current code already deliver.

| Experience                                        | What the agent composes at runtime                                                                                                                                                            | Existing foundation                                                                             | Required addition                                                                                                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Adaptive comparison**                           | Relevant attributes, comparison, supporting evidence and unresolved questions for the user's stated task. A towing conversation and a family-use conversation produce different compositions. | Resolved configuration IDs, canonical attributes, comparison cells, evidence and review tools.  | Criteria contract; typed evidence/gap panels; explicit surface revision and action loop.                                                                          |
| **Targeted clarification**                        | A compact choice panel only for unresolved year, trim or an important user preference; one catalog remains the vehicle selection component.                                                   | Multi-search catalog and shortlist; agent ambiguity instructions.                               | Validated choice/needs component; typed response including selected IDs and explicit unknown options.                                                             |
| **Evidence investigation**                        | A focused workspace for a contested specification: competing claims, conditions, source excerpts and remaining research questions.                                                            | `KNOWN`, `NOT_REPORTED`, `CONFLICTING`, observation IDs, source revisions and evidence drawers. | Dedicated evidence contracts and a declared conflict view; no generic field guessing or invented confidence score.                                                |
| **Research that becomes usable as it progresses** | Job progress, resolved versions, evidence gaps and a review action in one explicit workspace lifecycle.                                                                                       | Durable research snapshots, existing live research feature and human publication controls.      | Research panel type; persisted completion state/events; migration of synthetic tool invocations. Partial claim streaming requires an additional backend contract. |
| **Scenario comparison, later**                    | Inputs and result views for running-cost assumptions, charging access or ownership scenarios, selected only when relevant.                                                                    | Vehicle identity, typed specifications and dated source evidence.                               | A deterministic calculation service, validated user assumptions and suitable consumption/price data. This is not achievable by adding a chart component alone.    |

Start with adaptive comparison after resolving exact configurations. Conditional
clarification is part of that journey, rather than a generic questionnaire before
every answer. A focused specification answer can continue using the existing
single-result component.

## Example: the Shark/Ranger journey

1. User asks for the differences. The agent calls `searchVehicleConfigurations`
   once with both searches. The single catalog contains all returned versions;
   the agent preserves unresolved years/trims.
2. The user selects exact configurations and says “I need it for family use and
   occasional towing.” If a missing detail materially changes the comparison,
   the agent requests it through a bounded choice/input panel. Previously supplied
   details are retained.
3. The agent requests one composite workspace using those IDs and supported
   attributes. It includes the relevant comparison, evidence context and explicit
   unknowns. It preserves towing conditions and does not equate rated capability
   with suitability for every load or trip.
4. The user changes a priority or requests another attribute. That explicit
   interaction reaches the agent with the surface identity, revision and current
   selection. The agent calls the appropriate tool and revises that workspace.
   Native sorting or opening a source drawer remains a local interaction.
5. If an essential fact is missing, the agent can start the real research tool.
   Its declared job reference provides progress. Completion updates explicit
   research state or triggers a real agent continuation; it does not fabricate a
   review tool call. Draft evidence remains distinct from accepted catalog facts.

The user gets one evolving place to make the decision, with evidence close to the
comparison. This is a proposed experience; current follow-ups generally append new
tool-result cards.

## Contracts needed for the next slice

1. **Expand a bounded DSL.** Add stable panel IDs, a small approved composition
   vocabulary and domain-specific parameters. Let the agent select and combine
   panels; Angular owns responsive sizing and focus behavior. Avoid making every
   possible combination a named, hard-coded screen.
2. **Define surface revisions.** A new workspace creates a surface; an update
   names that surface and its expected revision. Keep the last valid view on
   failure, reject stale updates, and preserve genuine calls and results in
   history. Declare supersession explicitly. Use the existing server-owned memory
   boundary for durable replay rather than adding another store.
3. **Define typed actions.** Send an action name, surface/component IDs, revision
   and validated user values through our authenticated CopilotKit lifecycle.
   Distinguish local component behavior, direct authorized application actions,
   and actions that require agent reasoning. A slider does not need a model call
   on every movement; an explicit Apply can request recomposition.
4. **Preserve authoritative data.** The agent supplies IDs, criteria and retrieval
   intent. Server tools return the full typed view payload or an explicitly
   supported live-resource reference. Factual observations, units and provenance
   never become LLM-authored decoration.
5. **Make UI states contractual.** Loading, empty, partial, conflicting, failed
   and superseded states belong to each declared result/panel. Replace the
   [audited presentation heuristics](agentic-ui-contract-audit-2026-09-10.md)
   in the paths this work touches. Progressive research additionally needs the
   synthetic completion mechanism migrated.

A versioned complete snapshot with stable identity is a reasonable first delivery.
Incremental panel updates and a more general A2UI operation processor can follow
when measured latency or a concrete interaction needs them. Do not switch SDKs or
weaken protocol validation merely to claim broader A2UI support.

## Evaluation before broader rollout

- Exercise real model selection: ambiguous Shark/Ranger request, selected trims,
  a changed priority, an unsupported attribute and unavailable review evidence.
  Check that the agent calls the intended tool with complete, valid arguments.
- Keep integration coverage for real AG-UI events and CopilotKit dispatch, plus
  invalid catalogs, unauthorized references, stale revisions, cancellation and
  saved replay. Scripted events verify integration, not model judgment.
- Measure time to first usable panel and to completed view; DSL input/output
  tokens; retrieval time; schema-repair rate; duplicate calls and surfaces; and
  whether users finish comparison with fewer repeated selections and messages.
- Report cold model generation, reused plans and cached data separately. A cached
  layout must respect criteria and catalog/schema versions. Authoritative vehicle
  data needs its own freshness rules; replay of a historical snapshot must not be
  presented as a live market update.

No new latency benchmark, authenticated model evaluation or user study was run in
this review. The opportunities above are grounded design hypotheses to test.
