# Conversational vehicle research

The `chat` agent is now the SpecSync vehicle assistant. The existing `/copilotkit`
route, AG-UI streaming, Vertex ADC authentication, Gemini model configuration,
headless Angular client and production statelessness are retained. No ingestion,
scraping, publication, or persisted server-side conversation workflow is included.

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
`getEvidenceExcerpt`, and `discoverVehicleContent`. All are read-only. Graph tools
use fixed parameterized queries behind Spring Boot; arbitrary Cypher is not exposed.

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
npm exec -- nx run api:data-up
```

This migrates, seeds and projects the catalog and any existing review records.
Review content is deliberately empty initially. Alias seeding adds linguistic
synonyms, not unverified manufacturer functional equivalences.

Set API environment variables before `npm exec -- nx run api:bootRun`:

- `NEO4J_HTTP_URL`: HTTP origin from `docker compose port neo4j 7474`, for example
  `http://127.0.0.1:56570` (ports can change).
- `NEO4J_USERNAME=neo4j`, `NEO4J_PASSWORD=specsync-local` for local Compose.

In `apps/ai/.env`, set `SPECSYNC_API_URL=http://127.0.0.1:8080`, retaining the
existing Vertex project/location and ADC setup. Then:

```sh
npm exec -- nx dev ai
npm exec -- nx serve web
```

The AI service defaults to localhost:8080 for local catalog access. Terraform now
supplies the deployed API URL. Cloud graph connectivity still requires a reachable
Neo4j deployment and corresponding API environment configuration; this change does
not provision or deploy a cloud graph. Graph errors return UNAVAILABLE and preserve
catalog-only functionality. Vertex access is required for conversation and external
search; API and UI fixture tests do not require model credentials.

## Existing review data contract

Migrations create canonical tables for source revisions, chunks, aspects, attribute
relations, and observations. A stable `document_id` groups source revisions.
Configuration references must match the observation's model. Excerpt offsets are
zero-based and end-exclusive; database validation rejects spans outside the passage.
Only ACCEPTED observations are retrieved. Model-scoped observations are returned as
MODEL and must not be asserted for every trim or year.

`api:data-project` projects those existing records under `SpecSyncReview`. It never
fetches content or creates observations. The catalog rebuild invalidates the review
projection marker before reconnecting the review graph. Each graph response carries
its projection fingerprint; this is a snapshot identifier, not a claim of current
PostgreSQL synchronization. Rebuild after canonical changes.

Free-text review search uses a full-text index with literal query tokens, candidate
expansion through accepted observations, and optional vector retrieval. Query vectors
are generated only when `SPECSYNC_REVIEW_EMBEDDING_MODEL` is set in the AI service.
Set the same model on the API and set
`SPECSYNC_REVIEW_EMBEDDING_DIMENSIONS` in the AI service to the indexed dimensions.
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
npm exec -- nx run ai:build
npm exec -- nx run web:test
npm exec -- nx run web:test-arch
npm exec -- nx run web:build
npm exec -- nx run api:test
npm exec -- nx run api:comparison-integration
npm exec -- nx run api:data-integration
```

The HTTP integration suite uses real PostgreSQL and Neo4j. Review traversal tests
create clearly synthetic temporary graph nodes, test excerpts and configuration
isolation, and delete those nodes in a `finally` block. They are never demo content.

Suggested live conversation: compare Ranger Black and Limited in BR 2026 on power,
torque and camera; add transmission; ask for sources; discover configurations with
an optional camera; ask for related suspension reviews; discover external Ranger
review videos. An empty indexed review corpus must be reported honestly.
