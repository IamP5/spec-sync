# CopilotKit / AG-UI rendering audit

The main duplication is a reproducible history replay bug in the installed Mastra bridge. Separate presentation rules also turn empty searches and intermediate operations into unnecessary cards. Fix the transport before polishing the rendering.

The diagnosis below records the original behavior. The fix is now implemented in application code; validation results are recorded at the end. Dependencies and existing stored conversations remain unchanged. The companion reproduction harness uses synthetic records and makes no model calls or database writes.

## Browser evidence

Read through the user's Chrome extension on localhost:

| Conversation                                   | Observed behavior                                                                                                                                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comparativo Ford F-150 e RAM 1500 2026         | Two empty catalog panels; nine research-card instances. Later recovery/research calls also appear under the first user request.                                                                                         |
| Dados dos concorrentes chineses da Ford Ranger | Five catalog panels, four empty; two unsupported-source discovery cards; five content-discovery cards with zero items that nevertheless say links were discovered.                                                      |
| Ranger Black vs Limited BR 2026 comparison     | Five catalog failure panels across two user requests. The activity disclosures label these calls `Completed`, while their payloads report retrieval failure. No successful comparison was present in this conversation. |

The first-response DOM probe was run twice with the same result:

```text
FAIL: researchCards=5, duplicateResearchCards=1, emptyCatalogPanels=2
```

That probe compares the research adapters' rendered text within the first tool-rendering container. It establishes the symptom; the identity check below establishes its cause.

## 1. P1: replay copies later tool calls into earlier stored messages

Read-only inspection of the first conversation's local Mastra records found these exact duplicate identities:

| Tool-call ID   | Tool                            | Stored owners                                         |
| -------------- | ------------------------------- | ----------------------------------------------------- |
| `call_68985`   | `getVehicleResearch`            | First assistant and the recovery response             |
| `call_1889191` | `researchVehicleSpecifications` | First assistant and the recovery response             |
| `call_1429398` | `researchVehicleSpecifications` | First assistant and the subsequent PDF retry response |

There are 14 stored tool-call occurrences but only 11 distinct call IDs. The copied results in the first assistant are JSON strings; the original later results are objects, matching the AG-UI-to-Mastra replay conversion.

The mechanism is reproducible with installed `@ag-ui/mastra` 1.1.2:

1. Mastra stores a tool result inside an assistant's `tool-invocation` part. It does not store a separate row under the browser's result-message ID.
2. `MastraAgent.selectNewMessages` builds its known-ID set from stored message IDs and text-continuation IDs. Historical AG-UI tool-result message IDs are therefore considered new.
3. It re-includes the assistant messages that own those purportedly new results. The intervening user messages remain filtered out because their IDs are already stored.
4. The resulting input sequence is `assistant1 → result1 → assistant2 → result2 → newUser`.
5. Mastra's `MessageList` merges adjacent input assistant messages. The second tool call becomes part of the first assistant's record. Saving by ID updates that first record; the original second record remains in history.
6. The app's [history converter](../../apps/ai/src/mastra/threads/messages.ts) emits every stored occurrence without checking ownership across messages.
7. CopilotKit's installed `RenderToolCalls` loops over each message's calls. Its `track toolCall.id` applies within that loop, not across the transcript. It correctly renders both occurrences.

The existing [normalizeThread](../../apps/web/src/app/domains/chat/data/chat-agent.ts) addresses within-run continuation placement. It is not a cross-history deduplicator, and `ChatAgentClient.load()` resets its placement map.

### Minimal reproduction and candidate verification

From the repository root, with installed workspace dependencies and Node 24:

```sh
node docs/research/agui-history-repro.mjs
node docs/research/agui-history-repro.mjs --candidate
```

The first command intentionally exits 1:

```text
Selected replay messages: [a1, c1-result, a2, c2-result, u3]
Mastra input: a1[c1,c2], u3
Round-trip tool owners: c1→a1, c2→a1, c2→a2
AssertionError: A later tool call must not be copied into an earlier assistant message
```

The candidate exits 0:

```text
Selected replay messages: [u3]
Round-trip tool owners: c1→a1, c2→a2
PASS: completed results omitted; an unpersisted result survives.
```

The harness exercises the installed bridge selector, its real conversion function, Mastra's real `MessageList`, a simulated save-by-ID, and the application's actual history converter. Only memory retrieval is stubbed. The candidate proves the completed-result filtering mechanism for this minimal case; it is not a complete implementation or full streaming/HITL validation.

### Proposed transport fix

- Fix the bridge's new-message selection at the server boundary: consider a tool result persisted when its `toolCallId` matches a completed invocation in the verified user's recalled thread. Do not use the tool-result message ID as the persistence identity.
- Preserve new frontend/HITL results for invocations that are still unresolved. Pair those with their actual owning call; do not re-forward unrelated calls or collapse user-turn boundaries.
- Handle a request with no new input explicitly. The current fallback that forwards the entire history when the filtered set is empty can reintroduce replay corruption.
- Deliver through an application-owned adapter at the public bridge boundary, a maintained dependency patch, or a verified upstream release. Editing `node_modules` or merely changing the prompt is insufficient.
- Add a canonical history projection for existing affected conversations and a client-side ownership guard for display. Use a single owner per `toolCallId`, with paired results, across both load and live updates. Keep the raw audit evidence available.
- For the confirmed copied records, the later original occurrence is the correct owner. Do not generalize this into unconditional "first wins" or "last wins" for every transcript: compare invocation metadata, original turn boundaries, tool name/arguments and result state; surface conflicting duplicates rather than silently choosing one. Prefer a read projection before considering a separate stored-data repair.

Do not deduplicate execution by vehicle name or source URL: a new research interpretation, retry or follow-up can legitimately reuse either. Tool-call identity and research-request identity solve different problems.

## 2. P2: every matching call becomes a full card

[registerChatTools](../../apps/web/src/app/domains/chat/feature-chat/chat-page/chat-tools.ts) registers full research details for start, status and replay calls, and a full catalog for every configuration search. The [chat template](../../apps/web/src/app/domains/chat/feature-chat/chat-page/chat-page.html) renders all calls even when activity is hidden. The wildcard [ToolCallCard](../../apps/web/src/app/domains/chat/feature-chat/ui/tool-call-card.ts) leaves completed internal `skill` activity visible.

[ChatVehicleResearchDetail](../../apps/web/src/app/domains/chat/feature-chat/tool-adapters/chat-vehicle-research-detail.ts) takes only the result's request ID and opens a live feature. Repeated cards therefore converge on the same current state, regardless of their historical payload. Each [VehicleResearchDetail](../../apps/web/src/app/domains/vehicles/feature-research/vehicle-research-detail.ts) also owns a separate `ResearchDetailStore`. Active duplicates can create separate eight-second polling loops; this is a consequence of the code, not a measured network count from this audit.

Proposed presentation policy, computed in the chat feature/store before handing projected messages to CopilotKit:

| Tool outcome / intent                                           | Default transcript presentation                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Internal skill/concept lookup                                   | Activity disclosure; temporary progress while running                                                  |
| Empty catalog lookup                                            | Compact, query-specific empty state; no sorting, layout toggles or comparison controls                 |
| Catalog browsing or choosing ambiguous configurations           | Full interactive catalog with preserved selection and pagination                                       |
| Background search followed by a useful comparison/research card | Collapse the intermediate lookup into activity                                                         |
| Discovery returns sources                                       | Show relevant sources; collapse intermediate candidates after research starts, retaining source access |
| Discovery returns `EMPTY`                                       | Accurate compact empty state, grouped within the response for repeated attempts                        |
| Failure that needs action                                       | Visible failure with the vehicle/query and recovery action; retain diagnostic detail in activity       |
| Research start/replay                                           | Full card for the distinct research request                                                            |
| Status check during recovery                                    | Compact update/reference to existing research; the new replacement request gets its own full card      |
| User explicitly asks to open saved research                     | Full card in that response, even if an older response showed the same request                          |

Keep complete tool history for protocol and model context. Filter a display projection, not the agent's execution state. Keep deduplication out of dumb UI and `libs/ui`. Use the current chat feature, adapters and public vehicle feature APIs; no new domain or global mutable renderer registry is needed.

## 3. P2: empty discovery is labeled as success

[content-discovery-tool.ts](../../apps/ai/src/mastra/tools/content-discovery-tool.ts) computes `status: EMPTY` when there are no items, but always returns the message "External links discovered…". [KnowledgeResultCard](../../apps/web/src/app/domains/chat/feature-chat/ui/knowledge-result-card.ts) displays that message and only uses its empty fallback when the message is absent. Its title always says articles/blogs/videos were found.

Make result copy and headings depend on `status` and item count. Keep `EMPTY` separate from `ERROR`/`UNAVAILABLE`. Likewise, distinguish activity execution completion from business outcome: a completed lookup can fail or return no matches, and a completed research-start call can correctly leave an asynchronous job queued.

The five external searches in the Chinese-competitors response are distinct calls with different queries, not duplicate rendering of one identity. A bounded recovery policy should stop repeating equivalent empty discovery attempts, explain the remaining limitation, and ask for missing model-year scope when needed. This reduces unnecessary tool work, but cannot fix the history replay bug.

## Acceptance checks for implementation

- Replay at least three user turns containing server tool calls; no earlier assistant changes ownership after another turn is sent.
- Repeat with history reload between turns; one owner and one result per call ID; identical visible order before and after reload.
- Preserve unresolved frontend/HITL results, stop/regenerate behavior, continuation narration and failed results. Test no-new-input runs explicitly.
- For the affected F-150 history, remove the three copied call occurrences while preserving the genuine later calls and each distinct research request.
- Keep intentional reopening of saved research in later responses. Within one response, do not mount multiple live detail features for the same request unless the product explicitly calls for it.
- Empty catalogs have no unusable controls; five empty discovery attempts do not produce five success-styled cards. Meaningful failures remain visible.
- Keep nonempty catalog interactions, comparison cards, evidence disclosures, selection, curator confirmation and cancellation working.
- Add a transport regression at the bridge integration seam plus web transcript-level rendering tests, rather than only isolated adapter tests.
- Run the affected Nx tests and required lint, type and architecture checks after application changes. See the implementation validation below for executed checks.

CopilotKit documents `registerRenderToolCall` as selecting a component whenever a matching tool appears; it does not execute the tool or promise semantic deduplication. This matches the installed renderer's behavior. [Official API reference](https://docs.copilotkit.ai/reference/angular/functions/registerRenderToolCall).

## Implemented fix

- `HistorySafeMastraAgent` filters verified persisted history before invoking the installed bridge. It sends new input, preserves unresolved browser results with their owning call, supports regeneration, and treats an echo-only request as a no-op. Runtime cloning retains the adapter and request identity. Missing threads start with empty history; storage failures and resource mismatches fail closed.
- `chatRuntimeRoute` preserves the identity, model and credits context hooks while supplying the adapter through the public `registerCopilotKit` agents option. No dependency internals or generated files are patched.
- `canonicalHistory` removes equivalent repeated call IDs in the read projection, preferring the structured original over its serialized replay copy. Conflicting tool names, arguments or completed results raise an error. The same processor runs after Mastra memory loads, protecting the model context. Persisted audit records remain unchanged.
- The chat feature computes a separate presentation projection. Empty catalogs and repeated empty discovery receive compact summaries, internal calls remain in activity, and one live research detail mounts per request per user response. Intentional reopening in a later response remains visible. Candidate source links and warnings remain accessible in a disclosure.
- Empty content discovery now reports no links in both the tool payload and legacy-result renderer. Activity distinguishes `No matches`, `Failed` and `Completed`. The agent instructions limit empty external-content recovery to one materially different retry per vehicle/topic; this is model guidance, not a hard executor quota.
- Nonempty catalogs remain interactive. Background catalogs are not automatically hidden merely because a later comparison exists: their selection/pagination can still be useful.

### Validation

- Installed upstream reproduction still fails with `c2` merged into `a1`; the candidate harness passes. The failure assertion runs before the application's canonical read projection so repaired display cannot mask upstream corruption.
- Real Mastra integration: three successive AG-UI runs, a real Agent/tool loop, a real in-memory LibSQL store, and a deterministic mock provider. Each round adds exactly one call, executes the tool once, and preserves every previous call's owner. A fourth run injects the confirmed legacy serialized-copy corruption and verifies the provider receives each historical call once.
- Bridge regressions also cover echo-only input, regeneration, pending frontend results, cloning, cross-resource rejection, recall failure, and accepted/cancelled interrupt resumes.
- Angular tests exercise the real CopilotKit renderer through streamed AG-UI events, retaining activity while replacing an empty catalog with a summary. Presentation tests cover distinct research requests, explicit later reopening, failures, pending human confirmation, safe source links and retained warnings.
- Chrome extension inspection of the original F-150 chat: five live research panels instead of nine, zero full empty catalogs, two candidate-source disclosures, and the genuine later research requests in their original user turns.
- Full `npm run verify` completed successfully: web 279 tests, web architecture 65 tests, AI 312 tests, AI deterministic data/benchmark checks, API Spotless/ArchUnit/tests/bootJar, gateway lint/typecheck/tests/build, scripts tests, and web/AI production builds. Nx reused cached results where applicable.
- Live Chrome execution: `Saved Vehicle Research Validation`, conversation `81725678-c340-4085-aba3-9d59773b73df`. Four real model/tool runs: open saved Ford research, open saved RAM research, reload, explicitly reopen Ford, then search the Ford catalog. No research jobs were started or modified.
- Read-only SQL after the four live runs: **4 invocation occurrences, 4 distinct call IDs, 4 original assistant owners**. The first two owners remained unchanged after subsequent runs (`call_488938` → `84988469-8f25-4f24-b352-4479b06037c0`; `call_447947` → `c3982648-30f9-4bdb-96ce-c11dc1546643`).
- Final live DOM before and after reload: **3 research panels, 0 full catalog panels, 1 compact empty-catalog summary**. Activity retained all four calls and labeled the empty catalog `No matches`. Intentional Ford reopening remained visible in the third response.

### Remaining scope

This fixes history replay and presentation; it does not repair the original failed PDF ingestion or missing published catalog data. Existing stored copies are preserved for audit and canonicalized when read. A hard executor-enforced retry budget and automatic suppression of useful nonempty background catalogs are separate follow-ups. Pending confirmation/resume is covered by automated regressions; the live browser validation used read-only tools, not a curator mutation.

Final Chrome check of the Chinese-competitors history: one nonempty catalog retained; four empty catalogs became query summaries; five EMPTY content calls became one grouped summary; two EMPTY official-source calls became one summary retaining the unsupported-manufacturer warning.
