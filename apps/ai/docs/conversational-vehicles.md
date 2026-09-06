# Conversational vehicle research

The `chat` agent is now the SpecSync vehicle assistant. The existing `/copilotkit`
route, AG-UI streaming, Vertex ADC authentication, Gemini model configuration,
headless Angular client and production statelessness are retained. Specification ingestion is available through a separate authenticated curator
workflow; see [vehicle ingestion](vehicle-ingestion.md). Server-side conversation
memory remains disabled in production.

## Retrieval responsibilities

- PostgreSQL: authoritative configuration search, single-vehicle specifications,
  comparison matrices, accepted claims, unresolved conflicts and source evidence.
- Neo4j: derived terminology, accepted equipment discovery with package paths,
  existing review passages and review-aspect relationships.
- Google grounding through the existing Vertex model: external article, blog,
  social post and video discovery. Only provider-returned source URLs are exposed.
  Discovery text is not treated as a quotation or ingested evidence. Search results
  do not guarantee media-type or configuration applicability; users can open links.

The agent has ten typed tools: `searchVehicleConfigurations`,
`listComparisonAttributes`, `getVehicleSpecifications`,
`compareVehicleConfigurations`, `resolveComparisonConcepts`,
`findConfigurationsByCapabilities`, `searchReviewEvidence`, `getRelatedReviews`,
`getEvidenceExcerpt`, and `discoverVehicleContent`. These retrieval tools are read-only. Additional specification-source discovery and
ingestion-form preparation tools never publish data. Graph tools connect directly from Mastra to Neo4j using the official JavaScript
driver and fixed parameterized Cypher. Spring Boot has no graph endpoints or Neo4j
connection. Tool names and result schemas remain unchanged.

Specification responses render directly as a wide Zard comparison matrix. An unscoped catalog request renders a dedicated interactive catalog; configuration searches used only to resolve named vehicles remain background work. The browser supports attribute search and an exact-value difference filter, keeping unknown and conflicting cells visible. Related reviews open in a dialog with vehicle/media/text filters and selectable evidence. A selection prepares an editable composer draft with evidence IDs; it never sends automatically or ingests content. See `apps/web/docs/comparison-experience.md` for the production catalog and version E comparison decisions and retrieval limits.
Accepted values are selected by `selectedObservationId`, never by observation order.
Source excerpts and original qualifiers remain available in expandable details.
Related review cards distinguish model scope, configuration scope, opinion kind,
conditions and source links. Video source links include a timestamp when provided.

The browser derives versioned comparison selection from successful tool results,
keeps it in AG-UI state, and passes it as scoped CopilotKit context for every run.
Saved tool results reconstruct the selection on reopening; regeneration derives it
from the retained messages. No selection is reconstructed from model prose. Obsolete tool calls in historical threads use the generic tool renderer. No new database-backed conversation memory is required.

## Local startup

From the repository root:

```sh
npm exec -- nx run ai:data-up
```

This migrates, seeds and projects the catalog and any existing review records.
Review content is deliberately empty initially. Alias seeding adds linguistic
synonyms, not unverified manufacturer functional equivalences.

In `apps/ai/.env`, set `SPECSYNC_API_URL=http://127.0.0.1:8080` for the
PostgreSQL catalog and configure direct graph access:

- `NEO4J_URI`: `bolt://` plus the port from `docker compose port neo4j 7687`.
- `NEO4J_USERNAME=neo4j`, `NEO4J_PASSWORD=specsync-local` for local Compose.
- `NEO4J_DATABASE=neo4j`.

For Aura, use its `neo4j+s://` URI and database credentials from Secret Manager.
Production requires verified TLS. Terraform supplies these secrets to the AI service
only. Aura management credentials (`AURA_CLIENT_ID`, `AURA_CLIENT_SECRET`) belong
only to Terraform and never reach either application runtime.

Start Spring Boot, Mastra and the web app:

```sh
npm exec -- nx run api:bootRun
npm exec -- nx dev ai
npm exec -- nx serve web
```

The driver pool is created lazily so a graph outage does not prevent catalog tools
from working. Every graph call uses a read transaction, a 15-second request deadline
and an 8-second transaction timeout; cancellation rolls back the transaction.
Sessions close after every call and the pool closes on service shutdown.
Graph failures return `UNAVAILABLE`, never an absence claim. The agent can execute
only the fixed retrieval operations; projection writes are not registered as tools.

Offline fixture and projection tooling now lives in `apps/ai/data`, with `ai:data-*`
Nx targets. PostgreSQL schema migrations remain owned by Spring Boot. These manual
maintenance targets deliberately use local Compose endpoints, ignoring Aura runtime
credentials, so tests and rebuilds cannot overwrite the cloud graph.

## Existing review data contract

Migrations create canonical tables for source revisions, chunks, aspects, attribute
relations, and observations. A stable `document_id` groups source revisions.
Configuration references must match the observation's model. Excerpt offsets are
zero-based and end-exclusive; database validation rejects spans outside the passage.
Only ACCEPTED observations are retrieved. Model-scoped observations are returned as
MODEL and must not be asserted for every trim or year.

`ai:data-project` projects those existing records under `SpecSyncReview`. It never
fetches content or creates observations. The catalog rebuild invalidates the review
projection marker before reconnecting the review graph. Each graph response carries
its projection fingerprint; this is a snapshot identifier, not a claim of current
PostgreSQL synchronization. Rebuild after canonical changes.

Free-text review search uses a full-text index with literal query tokens, candidate
expansion through accepted observations, and optional vector retrieval. Query vectors
are generated only when `SPECSYNC_REVIEW_EMBEDDING_MODEL` is set in the AI service.
Set `SPECSYNC_REVIEW_EMBEDDING_DIMENSIONS` in the AI service to the indexed dimensions.
Stored embeddings must use a single model and dimension. The vector index is created
when embedded chunks exist. A changed embedding model/dimension requires an explicit
index rebuild; no embeddings are generated during projection.

Lexical and vector rankings are combined using reciprocal-rank fusion; results are
then restricted through graph relationships. Candidate retrieval is capped, so a
filtered search is not an exhaustive claim about all possible matching sources.
Missing indexes, model mismatches and service failures must not become absence claims.
Quotes come from stored excerpt spans; translations must be labeled as translations.

## Verification

```sh
npm exec -- nx run ai:typecheck
npm exec -- nx run ai:test
npm exec -- nx run ai:graph-integration
npm exec -- nx run ai:build
npm exec -- nx run web:test
npm exec -- nx run web:test-arch
npm exec -- nx run web:build
npm exec -- nx run api:test
npm exec -- nx run ai:comparison-integration
npm exec -- nx run ai:data-integration
```

The catalog HTTP suite uses real PostgreSQL; `ai:graph-integration` exercises
Mastra retrieval against real local Neo4j. Review traversal tests
create clearly synthetic temporary graph nodes, test excerpts and configuration
isolation, and delete those nodes during suite cleanup. They are never demo content.

Suggested live conversation: compare Ranger Black and Limited in BR 2026 on power,
torque and camera; add transmission; ask for sources; discover configurations with
an optional camera; ask for related suspension reviews; discover external Ranger
review videos. An empty indexed review corpus must be reported honestly.

`ai:graph-smoke` is a read-only check of an existing deployed projection. Export
`NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, and `NEO4J_DATABASE` from Secret
Manager before running it. It never seeds or rebuilds the target database.

The [Neo4j JavaScript driver connection guide](https://neo4j.com/docs/javascript-manual/current/connect/)
describes Aura TLS URIs and driver lifecycle. The runtime caps its pool at ten
connections per Cloud Run instance; revise that cap together with service scaling
if graph concurrency grows.
