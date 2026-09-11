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

## Migration completed in the Ford analyst workspace change

| Location                      | Previous behavior                                                                        | Current contract                                                                                                                                                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tool-presentation.ts`        | Inferred summaries and supersession from adjacent calls, result fields and research IDs. | Declared background tool policy and exact invocation-ID deduplication only. Every independent user-facing result remains visible, including empty results and failures.                                                                        |
| `knowledge-result-card.ts`    | Guessed labels and layout from arbitrary fields.                                         | The registered operation selects a dedicated result schema. Reviews, concepts, capabilities and excerpts have explicit discriminators; exact historical schemas remain readable. Unsafe links and unsupported payloads are rejected.           |
| `threads/research-updates.ts` | Synthesized a review tool invocation to mount the review UI.                             | Persists an explicit research-completion data part, transported as an AG-UI activity and rendered directly. Ownership checks, deterministic completion IDs and replay remain covered. Existing historical invocations are retained as history. |

The revisioned competitive workspace adds a separate explicit projection of one
declared surface. It does not merge independent tool calls. See the
[implementation report](ford-competitive-workspaces-2026-09-10.md) for lifecycle
limits and verification. The earlier catalog verification below remains a record
of the original audit, not the test count for this implementation.

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
