# Vehicle specification ingestion

The first ingestion slice supports one exact Brazilian configuration and one
manufacturer HTML page or PDF per run. Chat can discover official sources
and prepare the form. Open `/ingestion`, enter the curator key, submit the source,
review the draft, and publish selected claims.

## Local setup

The existing `ai:data-up` target initializes the catalog and graph. Start the API,
AI service, and web app with their normal Nx targets after configuring:

- `apps/api/.env.local` (ignored): `SPECSYNC_INGESTION_ENABLED=true`,
  `SPECSYNC_INGESTION_REVIEWER_KEY`, `SPECSYNC_INGESTION_WORKER_KEY`, and
  `SPECSYNC_INGESTION_WORKER_URL=http://127.0.0.1:4111`.
- `apps/ai/.env` (ignored): the same `SPECSYNC_INGESTION_WORKER_KEY`, plus
  `SPECSYNC_INGESTION_NEO4J_URI`, `SPECSYNC_INGESTION_NEO4J_USERNAME`,
  `SPECSYNC_INGESTION_NEO4J_PASSWORD`, and `SPECSYNC_INGESTION_NEO4J_DATABASE`.
  Use `docker compose port neo4j 7687` to obtain the local Bolt address.
- Both keys must be different random secrets of at least 32 characters. The API
  authenticates curator requests with `X-Ingestion-Key`; the AI routes require
  the worker key in a Bearer authorization header. Never enter these keys in chat.
- Existing Vertex ADC configuration remains required. No new model credentials
  are introduced. The reviewer key never needs to reach the AI service.

`apps/api/.env.local` contains Java properties in `NAME=value` form. Spring loads
it optionally from the API working directory. Environment values take precedence.
Ingestion stays disabled when the enable flag or required credentials are absent.
Production secrets must be supplied through environment configuration/Secret Manager.

The default source domains are `ford.com.br`, `toyota.com.br`, and `nissan.com.br`,
including their subdomains. `SPECSYNC_INGESTION_SOURCE_DOMAINS` can replace this
comma-separated allowlist with explicitly reviewed manufacturer/CDN domains.
Every redirect and pinned DNS address is checked. Private, metadata, and reserved
addresses are rejected. HTML capture removes executable content while preserving
text, table separators, headings and footnotes. PDFs are rendered to page images and visually transcribed with the configured
Vertex model. Embedded text alone misses some image-based specification tables,
including the Ranger brochure. The transcript retains page markers, table column
headers, symbols and footnotes. It is explicitly labeled as an AI transcript;
reviewers must compare it with the downloadable immutable original PDF. Missing
pages, incomplete generation and oversized output fail instead of being truncated.
Complex column layouts always require careful source review.

## Durable behavior

Spring Boot owns the PostgreSQL run queue and polls it while the API is running.
Work is claimed transactionally with a five-minute lease and a unique fencing
token. Source processing is bounded and retries up to three attempts; rejected
runs cannot be completed by a late worker. Closing the browser does not stop the
job. The URL identifies the run, so it can be reopened with the curator key.

Original bytes, captured text or visual transcript, checksums and parser/model version are stored in immutable
`ingestion.source_capture` rows. This first slice uses PostgreSQL for snapshots;
object storage is a later capacity optimization. Drafts are separate from catalog
observations, so existing catalog and graph tools cannot reveal unreviewed claims.

The extractor proposes raw claims. Java validates exact evidence ranges, presence
of raw values in the evidence, attribute types and availability, and performs
explicit unit conversions. Missing units, ranges, grouping ambiguity and unsupported
conversions remain validation issues. The form shows canonical units, raw values,
conditions, current catalog values, and the captured source.

A reviewer must confirm identity, select at most one claim per attribute, and
supply a reason. Publication checks the draft hash and current catalog revision.
A stale review fails and requires reloading the current values. Publication appends
immutable evidenced assertions, changes accepted selections, records decision
history, and inserts the graph outbox event in one transaction. Previous claims
are retained. Reusing a request UUID with different input fails. Repeating the
same source/claim publication reuses deterministic evidence and assertion IDs;
unchanged accepted selections create no new catalog revision.

The graph worker consumes a consistent PostgreSQL snapshot and atomically replaces
the catalog and review projections together. It uses a graph-side serialization
lock and revision guard; duplicate and stale deliveries cannot roll back a newer
projection. A failed rebuild leaves the old graph intact. Graph failure does not
undo PostgreSQL publication. The form distinguishes pending, current, and unchanged
projection states. Graph retrieval already requires catalog verification before
asserting current specifications.

## Current limits

- One source/configuration per run; up to 100 claims, 5 MB original bytes, 12 PDF
  pages, and 150,000 extracted characters. No truncation masquerades as complete
  coverage. Image-based PDF tables are supported through visual transcription. Unreadable
  content and unsupported sources remain unpublished.
- Existing approved attributes only. New concepts, package-definition editing,
  resolving vehicle aliases, model-wide batching and review/video ingestion
  are outside this slice. Package conditions remain claim qualifiers.
- Conflicting candidates are independently reviewable; the reviewer selects one
  or leaves them unpublished. There is no automatic conflict winner or UI command
  to publish a new `CONFLICTING` selection yet.
- The first access model is a single curator key, suitable for the private local
  app. Individual reviewer accounts and roles are needed for a multi-user rollout.
- The polling worker requires a continuously running API. A production Cloud Run
  rollout needs explicit always-allocated execution or the planned authenticated
  queue delivery/dispatcher. This change does not deploy cloud ingestion workers.
- Full graph rebuilds are bounded to a 20 MB request. Incremental projection and
  scheduled source refresh remain later milestones. Local maintenance tools remain
  restricted to Compose and never pick up ingestion writer credentials.

## Verification

Run normal checks with `npm run verify`. Run
`npm exec -- nx run ai:ingestion-integration` with Docker available for the ingestion
acceptance test. It creates and removes a dedicated PostgreSQL test database and a
separate temporary Neo4j container; it does not replace the development graph.
Only the extraction model is replaced by a clearly synthetic fixture. The test
exercises the actual API, migration, normalization, publication transaction,
projection implementation, recovery after API restart, duplicate publication,
rejected and invalid drafts, stale reviews, graph failure/retry, and graph rollback.
UI tests verify review requirements and clear selections after the catalog revision
changes. Source tests cover URL/network filtering and HTML evidence preservation. Transcript
tests reject missing pages and incomplete evidence; the integration test checks
that authenticated downloads return the exact captured bytes.
