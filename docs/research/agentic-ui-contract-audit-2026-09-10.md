# Agentic UI contract audit

Date: 2026-09-10. Scope: Angular chat renderers, AI tools, conversation transport
and background research delivery. Decision: [ADR-0001](../adr/0001-agentic-ui-contracts.md).

## Source-contract correction

`apps/ai/src/mastra/tools/vehicle-tools.ts` and
`apps/ai/src/mastra/agents/spec-sync-agent.ts` explicitly instructed separate
searches per named vehicle. The catalog tool now accepts all requested searches
in one invocation, supplies one authoritative catalog, and carries notices and
continuation queries. The attempted browser aggregation was removed. No
historical calls are merged or rewritten.

## Remaining migration work

| Location                                                                 | Existing behavior                                                                                                                                                                                                                                              | Required direction                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/domains/chat/feature-chat/tool-presentation.ts`        | Hides internal tools, groups empty discoveries into authored summaries, replaces source cards when research starts, and suppresses research/review cards by inspecting neighboring calls and IDs. Raw history is retained, but presentation infers a workflow. | Explicit render policy plus typed empty/source states and surface identity or supersession. Preserve failure visibility and saved replay during migration. The empty-catalog summarizer has been removed; the registered catalog component now owns that state. |
| `apps/web/src/app/domains/chat/feature-chat/ui/knowledge-result-card.ts` | Accepts `Record<string, unknown>` items, chooses labels using title/name/label/code fallbacks, changes layout by field presence, and independently hides tools by name.                                                                                        | Dedicated or discriminated evidence, discovery and capability contracts; declare rendering at registration. Keep link safety and provenance checks.                                                                                                             |
| `apps/ai/src/mastra/threads/research-updates.ts`                         | Polls completed research and persists assistant text plus a synthetic `reviewVehicleResearch` invocation/result without executing that tool through an agent run. The browser then appends these persisted messages.                                           | Explicit persisted research-completion events/state with a declared component, or a real agent continuation that calls the review tool. Maintain ownership, idempotency and delivery after reopening.                                                           |

These findings are recorded, not fully migrated in this change. Replacing all
three requires coordinated contracts for research completion, evidence rendering
and historical conversations. The new rule prohibits extending those patterns.

## Patterns that are not the rejected approach

- `chat-tools.ts`: explicit tool-name-to-component registration is the intended
  CopilotKit dispatch mechanism. Permissive streaming argument handling must not
  replace validation of the final result.
- `parse-result.ts` and typed result schemas: decode and validate transport
  payloads; they do not infer UI intent from prose.
- `chat-agent.ts::normalizeThread`, `threads/messages.ts` and
  `threads/canonical-history.ts`: adapt documented Mastra/AG-UI representation,
  preserve real IDs and reject conflicting copies. Keep targeted protocol tests.
- `comparison-selection.ts`: restores explicit configuration/attribute selection
  from successful validated results. It does not generate facts or new calls.
- `workspace/compiler.ts` and `chat-vehicle-workspace-overview.ts`: the backend
  compiles an explicit DSL into a declared custom catalog. The local tool-shaped
  envelopes used to reuse adapters are not emitted as AG-UI calls or persisted.
  They can be simplified to typed feature inputs, but they do not infer panels
  from unrelated responses. Keep the approved catalog and binding validation.
- `chat-vehicle-research-detail.ts`: a validated job reference intentionally
  mounts a live research feature. A typed reference is sufficient when the
  component contract explicitly owns subsequent status/data loading.

No free-text answer-to-component extraction was found in the reviewed chat path.
HTML/PDF source extraction and automatic model-cost routing are different
concerns and were not treated as violations of this UI decision.

## Verification of the catalog correction

Web/UI lint, all 324 web tests, architecture tests and the Angular production
build passed. AI lint, typechecking and unit tests passed; the Mastra development
bundle also started successfully. Both local services returned HTTP 200.

Coverage includes multi-search retrieval, deduplication inside the server tool,
independent continuation scopes, bounded inputs, cancellation, partial/total
failure, one actual CopilotKit catalog renderer and saved replay of its result.
The integration test supplies scripted AG-UI events; live model tool choice was
not evaluated. Historical separate catalog calls remain separate.
