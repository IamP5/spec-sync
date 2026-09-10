# Shared vehicle research

The AI service verifies Firebase identity before calling the private research API. The API verifies `Authorization: Bearer <SPECSYNC_RESEARCH_SERVICE_KEY>` (at least 32 characters), then treats the user ID in the path as trusted. This key is separate from credits and curator keys. Cloud Run IAM supplies another gate when deployed.

The AI service owns the approved manufacturer-domain policy for discovery and downloading. Its downloader validates every redirect and pins a checked public address to prevent DNS rebinding. API request validation separately requires an HTTPS URL without embedded credentials; it does not maintain a second manufacturer allowlist. Adding a verified manufacturer domain therefore belongs to AI policy and deployment configuration.

The feature uses the existing PostgreSQL database and ingestion worker. Configure `SPECSYNC_INGESTION_ENABLED=true`, the existing worker URL/key, and the research service key on both services. `SPECSYNC_RESEARCH_POLICY_VERSION` defaults to `br-v1`; bump it when extraction policy changes so new requests do not join old-policy work. A disabled or unconfigured ingestion worker rejects new requests. No new persistent service is introduced.

The existing scheduler needs a continuously running API process with CPU available between HTTP requests. Cloud Run's request-based CPU allocation and scale-to-zero are not a durable dispatcher. Enable this foundation locally or on a deployment with that execution guarantee; deployment dispatch remains a separate rollout requirement.

## Request API

`/api/internal/research/users/{uid}/requests` accepts:

- `POST` with `{ "id": "<request UUID>", "request": { "sourceUrl", "brand", "model", "market": "BR", "modelYear", "configurations": [] }` to create or join.
- `GET` returns `{ "requests": [...] }`, newest first, at most 100. Entries contain request/work identity, disposition, original request, status, attempt, stage, and timestamps only. One metadata query reads the list; it never loads source captures or configuration claims.
- `GET /{id}` returns the user's private request snapshot.
- `DELETE /{id}` detaches this request and returns its snapshot. It does not stop work used by another request.

POST and per-request responses are flat snapshots with `id`, `workId`, `requestStatus`, `disposition`, the original `request`, ingestion `status`, `attempts`, `stage`, final `configurations`, `warnings`, `error`, source metadata/checksums, `configurationIds`, and timestamps. Configuration claims remain unreviewed until the existing curator publication process accepts them. Snapshots never include other users, lease tokens, raw captures, source text, review authority, or chat/wallet data. Unknown or other-user request IDs return the same generic domain error.

## Atomic reuse and recovery

V9 adds `research.scope`, `research.work`, `research.request`, and immutable `research.checkpoint` tables. A transaction first locks the `(user ID, request UUID)` row, validates its original payload, then locks the canonical scope row before choosing its work. The work identity includes normalized HTTPS source URL, case-folded brand/model, BR, explicit model year, and policy version. Fragments and default port 443 are removed; URL query order, escaped values, and path case are preserved. Requested trims belong to the private request, and the shared ingestion request has an empty trim list to extract sibling configurations.

Active QUEUED/PROCESSING/REVIEW work is joined. A PUBLISHED run is reused for 24 hours after its publication update. A failed/rejected or stale published run is replaced for new requests; old request subscriptions retain the old work. Repeating a request UUID never changes its work or reactivates a cancellation.

The normal ingestion queue remains the only attempt owner. A claimed shared run is sent to `/internal/research/extract` with its work ID, lease token as attempt ID, policy version, shared request, and catalog attributes. The shared request uses the research service key and a bounded 20-minute HTTP timeout. Existing curator extraction keeps its original route, key, and 260-second timeout.

Worker callbacks below `/api/internal/research/works/{workId}/attempts/{attemptId}` require the research key:

- `POST /heartbeat` renews a valid lease for five minutes and returns `{ "ok": true }`.
- `GET /checkpoints` returns `{ "checkpoints": [{ "key", "payload" }] }`.
- `PUT /checkpoints/{key}` with `{ "payload": "<JSON string>" }` writes one immutable checkpoint and returns `{ "ok": true }`.

Callbacks acquire the ingestion row lock, then verify token, PROCESSING status, and expiry against database wall-clock time. This second check rejects an attempt whose lease expired while it waited for a row lock. Completion and failure use the same fencing principle. A checkpoint retry must contain exactly the same payload; a different payload is rejected. Payloads are valid JSON strings of at most 12 MB, and keys match `[a-z0-9-]{1,100}`. Checkpoints belong to work and survive attempt/process restarts. The current snapshot stage is the most recently committed checkpoint key while processing; final states use the lower-case ingestion status.

## Verification

`npm exec -- nx run api:test` covers scope normalization, bounds, HTTP authentication, private response shape, and controller contracts. `npm exec -- nx run api:archTest` enforces the existing application boundaries. The `ai:research-integration` target exercises actual Flyway migrations and concurrent/restarted API processes against an isolated PostgreSQL database with a mock AI worker, without paid model calls.
