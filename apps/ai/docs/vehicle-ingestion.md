# Vehicle specification ingestion

One run imports one official manufacturer HTML page or PDF for one model and
model year in the Brazilian market, and proposes claims for one or more of
the configurations that document presents (a Ranger brochure lists every
version in one table). A curator confirms the identity of each
configuration, selects claims and publishes; nothing reaches the catalog
before that. The run can be started and reviewed on `/ingestion` or from the
chat, which renders the same review inside the transcript.

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
  the worker key in a Bearer authorization header. The curator key is entered
  in the browser only (ingestion page or chat card), is kept in memory for the
  page load and is never sent to the AI service. Never enter keys in chat.
- Existing Vertex ADC configuration remains required. No new model credentials
  are introduced.

`apps/api/.env.local` contains Java properties in `NAME=value` form. Spring loads
it optionally from the API working directory. Environment values take precedence.
Ingestion stays disabled when the enable flag or required credentials are absent.
Production secrets must be supplied through environment configuration/Secret Manager.

The default source domains are `ford.com.br`, `toyota.com.br`, and `nissan.com.br`,
including their subdomains. `SPECSYNC_INGESTION_SOURCE_DOMAINS` can replace this
comma-separated allowlist with explicitly reviewed manufacturer/CDN domains.
Every redirect and pinned DNS address is checked. Private, metadata, and reserved
addresses are rejected.

## Pipeline (Mastra workflow `vehicleIngestion`)

`apps/ai/src/mastra/ingestion/workflow.ts` is a bounded Mastra workflow the
API worker runs through `POST /internal/ingestion/extract`. It is registered
on the Mastra instance, so Studio shows every step and its inputs. Steps:

1. **capture-source** (`source.ts`). Downloads the document with the SSRF
   checks above. HTML capture removes executable content while preserving
   text, table separators, headings and footnotes. PDFs are rendered to page
   images and visually transcribed (`pdf-transcription.ts`) in batches of
   four pages with two batches in flight, up to 24 pages; embedded text alone
   misses image-based specification tables such as the Ranger brochure. Each
   batch is validated for page completeness and joined in page order. The
   transcript keeps page markers, column headers, symbols and footnotes and is
   labelled as an AI transcript; the immutable original stays downloadable.
   Captures are cached in memory for 15 minutes so a chat preview and the run
   that follows share one download and transcription.
2. **identify-configurations** (`identification.ts`). One structured call
   lists every configuration the document presents (printed name, powertrain
   summary, table column, identity evidence lines), the legend of
   availability symbols and the model-year statement. Requested names are
   matched to printed names by token overlap; an empty request selects
   everything the document presents, up to eight configurations. Requested
   configurations that are missing, extra configurations the source lists and
   a missing model-year statement become coverage warnings on the draft.
3. **extract-configuration** (`extraction.ts`, one `foreach` iteration per
   configuration, two in parallel). A structured call extracts claims for
   exactly one configuration, told which table column and legend belong to
   it. Every claim is then verified deterministically against the stored
   text: the line range must exist and contain the raw value (short markers
   such as `S`, `O` or `-` must match a whole cell or word), list items must
   be present, the attribute must be known and the availability a catalog
   value. Claims that fail get one repair round in which the model corrects
   only the listed line references; claims that still fail are dropped and
   counted in the configuration's warnings. Exact duplicates are removed.
   Conflicting candidates for one attribute are kept independently.
4. **assemble-draft**. Joins the source, the per-configuration drafts and the
   coverage report into the draft the API validates.

The chat agent does not run the workflow itself. Its tools are
`discoverVehicleSpecificationSources`, `previewVehicleSource` (capture plus
identification, no persistence) and `prepareVehicleIngestion` (form link
fallback).

Discovery combines three sources. Google Search grounding cites pages through
`vertexaisearch.cloud.google.com` redirect links, so `tools/grounding-links.ts`
reads the real URL from each redirect's `Location` header (that host only,
never followed) before the approved-domain check; without this step every
citation was rejected and discovery always came back empty. Search engines
rarely index the brochures themselves, so the tool then downloads up to four
of the discovered official pages through the same pinned-DNS downloader and
lists the PDF links they embed (`ingestion/linked-documents.ts`; markup and
embedded JSON, approved domains only, brochures named "ficha técnica" or
"catálogo" first). URLs printed in the model's answer are never used: they
are frequently invented. Because grounding cites a different handful of pages
on every call (and sometimes none on the approved domains), the tool also
reads the brand's own site index (`ingestion/site-index.ts`): the sitemap
announced in `robots.txt` (else `/sitemap.xml`, one index level deep) is
filtered to pages about the model, version-comparison pages first, and when a
site publishes no sitemap the known model-page paths of the approved domains
are probed. Site-index pages come before grounded ones. The downloader
identifies itself as `Mozilla/5.0 (compatible; SpecSync/1.0; ...)`; some
manufacturer sites answer 403 to user agents without the `Mozilla/5.0
(compatible; ...)` convention. The browser advertises
the client tool `startVehicleIngestion`: the agent calls it with the agreed
scope, the CopilotKit human-in-the-loop card shows the launch form, the
curator enters the key and starts the run, and only the run id and status go
back to the agent. The card then renders the persisted run (progress, evidence
review, publication), and the browser passes a credential-free summary of the
session's runs to the agent as context, so status questions need no tool.
The procedure lives in the agent skill `skills/vehicle-ingestion-skill.ts`
(`createSkill`, code-defined, no workspace filesystem needed in production).

## Durable behavior

Spring Boot owns the PostgreSQL run queue and polls it while the API is running.
Work is claimed transactionally with a five-minute lease and a unique fencing
token. Source processing is bounded and retries up to three attempts; rejected
runs cannot be completed by a late worker. Closing the browser does not stop the
job. The URL identifies the run, so it can be reopened with the curator key, and
`GET /api/ingestions` lists the curator's runs.

Original bytes, captured text or visual transcript, checksums and parser/model version are stored in immutable
`ingestion.source_capture` rows. This first slice uses PostgreSQL for snapshots;
object storage is a later capacity optimization. Drafts are separate from catalog
observations, so existing catalog and graph tools cannot reveal unreviewed claims.

The extractor proposes raw claims per configuration. Java validates exact evidence
ranges, presence of raw values in the evidence, attribute types and availability,
and performs explicit unit conversions with Brazilian notation (`1.200,5`,
`3.270`, decimal comma; `cm³`, `litros`, `kgf·m` spellings). Missing units,
ranges, grouping ambiguity and unsupported conversions remain validation issues.
The review shows, per configuration, the current catalog value beside each
proposal, the printed value, qualifiers, the evidence lines and whether the claim
is new, changed, unchanged or needs correction; conflicting candidates are grouped
and the reviewer picks at most one.

A reviewer must confirm identity for every configuration with a selection,
select at most one claim per attribute per configuration, and supply a reason.
Publication checks the draft hash and current catalog revision. A stale review
fails and requires reloading the current values. Publication appends immutable
evidenced assertions, changes accepted selections, records decision history per
configuration, and inserts the graph outbox event in one transaction. Previous
claims are retained. Reusing a request UUID with different input fails. Repeating
the same source/claim publication reuses deterministic evidence and assertion IDs;
unchanged accepted selections create no new catalog revision.

The graph worker consumes a consistent PostgreSQL snapshot and atomically replaces
the catalog and review projections together. It uses a graph-side serialization
lock and revision guard; duplicate and stale deliveries cannot roll back a newer
projection. A failed rebuild leaves the old graph intact. Graph failure does not
undo PostgreSQL publication. The form distinguishes pending, current, and unchanged
projection states. Graph retrieval already requires catalog verification before
asserting current specifications.

## Current limits

- One source per run; up to 8 configurations and 100 claims per configuration,
  5 MB original bytes, 24 PDF pages, and 150,000 extracted characters. No
  truncation masquerades as complete coverage. Unreadable content and
  unsupported sources remain unpublished.
- Existing approved attributes only. New concepts, package-definition editing,
  resolving vehicle aliases and review/video ingestion are outside this slice.
  Package conditions remain claim qualifiers.
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
- The workflow needs no Mastra storage: it never suspends. Studio traces of
  local runs use the development LibSQL store only.

## Verification

Run normal checks with `npm run verify`. Run
`npm exec -- nx run ai:ingestion-integration` with Docker available for the ingestion
acceptance test. It creates and removes a dedicated PostgreSQL test database and a
separate temporary Neo4j container; it does not replace the development graph.
Only the extraction worker is replaced by a clearly synthetic fixture. The test
exercises the actual API, migration, normalization, per-configuration publication,
projection implementation, recovery after API restart, duplicate publication,
rejected and invalid drafts, stale reviews, the run list, graph failure/retry, and
graph rollback. Unit tests cover claim verification and the repair pass,
configuration matching, transcript batch validation, URL/network filtering and
HTML evidence preservation on the AI side; the review flow, selection rules,
launch form and chat cards on the web side; and Brazilian number notation, review
invariants and request bounds on the API side.
