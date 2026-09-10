# Research-to-catalog handoff audit — 2026-09-10

The reported behavior is confirmed in chat `fb0d1e21-0cb7-4f89-bfb7-6acb34c47385`: importing the already researched BYD Shark 2025 created a separate extraction run for the same document. It did not perform another web source-discovery search at the import step. It repeated source preview, configuration identification and claim extraction instead of opening the existing draft for curation.

## Evidence and timeline

The Chrome extension was used to read the actual chat. Read-only queries against `mastra.mastra_messages`, `ingestion.run`, `ingestion.source_capture` and `research.checkpoint` established the tool calls and persisted outcomes. Times below are America/Sao_Paulo (UTC−03:00). Assistant-message timestamps group a model response's calls; run creation/completion timestamps come from the database.

| Time     | Action                                                                              | Persisted outcome                                                                                          |
| -------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 12:45    | `researchVehicleSpecifications`, BYD Shark 2025, `https://www.byd.com/br/car/shark` | Private request `13451c84-7527-4941-917e-81b1f9baac89`, shared work `c75e910d-76b2-4ea1-bd71-88b5d8c7feed` |
| 12:46:54 | Original extraction completed                                                       | REVIEW, one attempt, one configuration named `GS`, ten claims                                              |
| 12:49    | `getVehicleResearch`                                                                | Confirmed REVIEW for the original work; this was a read, not another extraction                            |
| 12:51    | User requested import; agent called `previewVehicleSource`                          | Same URL, vehicle and requested year; configuration identified again as `BYD SHARK GS`                     |
| 12:53:35 | Browser completed `startVehicleIngestion`                                           | New run `8ea35845-f502-4436-be76-7e092802088d`, without research-work linkage                              |
| 12:54:38 | New extraction completed                                                            | One attempt, ten claims, separate draft                                                                    |
| 12:57:52 | Curator published the new import                                                    | New run PUBLISHED; original research work still REVIEW                                                     |

The original work and the new import have identical captured source bytes and identical extracted evidence text:

```text
original_sha256 ccc4ad1953f6648c2d86e6afd284bfd8961872abe587a96e23b610591d3395cf
text_sha256     2d6bcba35565eac453b6d07ac6da40b3ca1dfa5b86ad6a4f43ae8b91162e1329
```

Their draft hashes differ. This establishes identical source content and distinct resulting drafts, rather than a changed source requiring fresh research. Both contain ten claims, but the independently identified configuration name differs (`GS` versus `BYD SHARK GS`).

A deterministic check over the captured tool trace was run with `node` and `node:assert/strict`. It selected the initial research, its REVIEW status, and the subsequent same-URL preview. The assertion that an existing reviewable research should not invoke source preview again failed:

```text
AssertionError: Importing an already reviewed research invoked source preview again for the same URL
exit code: 1
```

This is a historical trace check, not a regression test that claims the application has been fixed. No further import or publication was initiated for this audit.

## Cause

1. **Agent instructions route review back through extraction.** `apps/ai/src/mastra/agents/spec-sync-agent.ts:136` sends explicit draft-review/publication requests to the curator procedure. Steps 3–5 in `apps/ai/src/mastra/skills/vehicle-ingestion-skill.ts:24` require preview and a new `startVehicleIngestion` call, with no branch for an already completed research draft. The agent loaded this skill in the example chat before offering the import flow.
2. **The browser handoff loses research identity.** `apps/web/src/app/domains/chat/feature-chat/tool-adapters/vehicle-prompts.ts` constructs a source/brand/model/year/configuration prompt. The `startVehicleIngestion` contract has no existing research request/work identifier. `vehicle-ingestion-launch-edit.ts:154` creates a fresh UUID and calls the ingestion-create endpoint. Its idempotency handles retries of this form submission; it does not deduplicate against shared research.
3. **The backend creates a separate queued run.** `IngestionJdbcGateway.java:69` inserts by the supplied UUID. It does not look up the research's source/scope. `IngestionHttpGateway.java:72` chooses the ordinary ingestion extractor for runs without a research policy. `apps/ai/src/mastra/ingestion/workflow.ts:35` then performs capture, identification and extraction.
4. **The caches belong to different paths.** Shared research persists capture, identification and interpretation checkpoints (`apps/ai/src/mastra/research/workflow.ts:150`). Preview and ordinary ingestion instead share a short in-process capture cache (`apps/ai/src/mastra/ingestion/source.ts:353`). That cache can save a download/transcription between preview and import, but it does not reuse shared research checkpoints or avoid repeated identification/extraction. The original research calls `captureSource`, not `captureSourceCached`. Identical hashes alone do not establish whether a particular import download hit this cache.

This also explains the status discrepancy: publication updates the new ingestion run, while the private research request continues reading its original `workId`.

## Separate actions in the same chat

- The two `getVehicleResearch` status calls refer to the same original work. Multiple cards in the transcript do not mean multiple executions for those calls.
- The later `replayVehicleResearch` creates work `18699783-14a2-41ef-849b-659f1f1ab08e` and explicitly links it to the original work. It reuses saved capture/identification and generates a new interpretation. The persisted hashes are identical; the later draft has nine claims. This was associated with the user's request to revisit normalization and is distinct from the redundant import path. The tool run itself does not establish that ontology definitions were changed.
- The three later research calls target iCarros, Mobiauto and Webmotors, following the user's explicit request to extract all three sources. Those are separate source-scoped jobs, not accidental copies of the BYD document.

## Recommended correction

Use the existing research work as the curation run. The backend already stores shared research in `ingestion.run` with owner `curator` (`ResearchJdbcGateway.java:114`). The existing integration scenario in `apps/ai/data/research.integration.test.mjs:551` retrieves and publishes the same `workId` through the curator endpoint, then checks that later research reuses it. A second capture/extraction run is not required by the data model.

1. Add a **Review and publish** action to a completed research card, opening `/ingestion/<workId>` using the ID from the authenticated research snapshot. The existing curator page handles access, configuration selection, claim decisions and publication.
2. Give the agent an explicit existing-research review path: read the private request if needed and expose its review action. Do not call discovery, preview or `startVehicleIngestion` merely to publish a completed research.
3. Keep **Research another source** and **Reinterpret saved evidence** as separate explicit operations. Configuration selection for publication should happen on the existing draft, not trigger extraction again.
4. Add a behavioral regression test: starting with a REVIEW research, opening curation keeps the same work/run ID and source/draft hashes, issues no ingestion-create request and makes zero discovery/capture/identification/extraction calls. Publishing it should make that same private research report PUBLISHED. An already published work should open its result rather than start another run.

Existing independent imports should retain their audit trail. Automatically merging or republishing historical drafts is not necessary to fix the future handoff.

## Implemented correction

- `reviewVehicleResearch` resolves the user's existing private request and opens the saved shared draft. Agent instructions and the ingestion skill explicitly prohibit discovery, preview, standalone ingestion, or replay merely to import completed research.
- Authenticated `/chat/research/:id/review`, `/review/source`, and `/review/publish` routes resolve the active private subscription server-side to its existing `ingestion.run`. No browser curator key is required for this flow. Legacy standalone ingestion remains compatible with its existing credential mechanism.
- Publication keeps draft hash, catalog revision, identity confirmation, claim selection, and reason validation. Selection decisions record the verified reviewer's UID.
- The open chat checks completion every eight seconds while idle. A server-owned action persists a deterministic assistant message and `reviewVehicleResearch` result in Mastra memory, once per thread and shared work. It retries transient failures and catches up when the conversation is reopened; delivery is not a background push while the browser is closed. No fabricated user prompt, extra model invocation, or automatic publication occurs.
- The client appends only missing persisted messages, checks session/thread/transcript scope, and leaves an active response untouched. The render projection retains only the latest review card for each shared work while preserving protocol history.
- The review replaces the research comparison panel while open; returning to results restores that panel.

### Validation

The isolated PostgreSQL research integration suite passed: review/source/publication used the same work ID and source hash, the total run count did not change, no extra extraction attempt executed, and the two selection decisions recorded `alice`. Access through another user's private request was rejected. Unit tests cover authenticated routes, human-review inputs, completion idempotence across retries and concurrent tabs, cancelled/inaccessible subscriptions, switching conversations, and keyless review rendering.

### Live Chrome validation

On the example conversation, the completion endpoint delivered five assistant notifications for five distinct completed works. Each opened the existing evidence review directly. Reloading retained exactly five notifications and five review forms, with no errors or curator-key input. The historical standalone import now renders a link instead of remounting a credential prompt; a standalone import started in the current component still retains its live progress card.

The local database contained 22 ingestion runs before and after delivery, review loading, and reopening. The original BYD work `c75e910d-76b2-4ea1-bd71-88b5d8c7feed` remained `REVIEW`, with one extraction attempt and the same draft hash. No live catalog data was published during the browser check; publication was exercised only against the isolated synthetic integration database.

`npm run verify` completed successfully. Subsequent targeted checks passed after the final history-rendering adjustment: web lint, 285 tests, 65 architecture checks and production build; AI 332 tests; the research integration suite also passed with cancellation and reviewer attribution assertions. All four local services were left running (web 4200, gateway 3000, API 8080, AI 4111).

## GCP rollout configuration

The dev Terraform configuration now provisions distinct research and ingestion-worker secrets, grants only the API/AI workloads access, and enables shared research and graph publication. The API keeps one instance with CPU allocated outside requests so its scheduled PostgreSQL queue worker can claim and recover jobs. This incurs idle compute cost. The AI request timeout is 1,260 seconds for the bounded 20-minute worker attempt, with 1 GiB memory for document processing. Browser review continues to use Firebase identity; these workload secrets never reach the browser.
