# Vehicle data foundation

PostgreSQL owns the catalog. Neo4j is a rebuildable read projection. The first
dataset is a curated, read-only starting point for the comparison API and agent;
it does not perform web search or scrape manufacturer websites.

## Run locally

Requirements: the workspace Node/npm installation and a running Docker daemon
with Docker Compose. Java is needed to run the API, but not the data commands.

From the workspace root:

```sh
npm exec -- nx run api:data-up
```

This validates the fixtures, starts PostgreSQL 18 and Neo4j 5.26 Community,
applies Flyway migrations, seeds PostgreSQL, and projects its contents into
Neo4j. It is safe to repeat. Initial image downloads require network access;
the seed itself is entirely local.

Services bind to dynamically assigned loopback ports to avoid collisions with
other projects. The command prints the PostgreSQL address, Neo4j Browser URL,
and Bolt URL. Retrieve them again with:

```sh
npm exec -- nx run api:data-status
```

Local development credentials, also declared in `compose.yaml`:

| Service    | User     | Password         | Database     |
| ---------- | -------- | ---------------- | ------------ |
| PostgreSQL | `myuser` | `secret`         | `mydatabase` |
| Neo4j      | `neo4j`  | `specsync-local` | `neo4j`      |

In Neo4j Browser, use the printed Bolt address when connecting. These tools
intentionally target this workspace's local Compose services. They are not
deployment commands and do not accept a remote database URL.

Named Docker volumes preserve both databases between restarts. Stop the
services without deleting their data with `docker compose stop postgres neo4j`.
The existing Spring Boot Compose integration discovers the PostgreSQL port.
Neo4j is ignored by Spring Boot service connections; the API does not yet query it.

Individual steps:

| Nx target              | Action                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `api:data-migrate`     | Apply pending migrations to the running PostgreSQL service                            |
| `api:data-seed`        | Validate and import the immutable fixture revision                                    |
| `api:data-project`     | Replace the owned graph atomically from a PostgreSQL snapshot                         |
| `api:data-status`      | Show dataset counts, endpoints, and projection freshness                              |
| `api:data-test`        | Validate source fidelity, normalization and fixture invariants without Docker         |
| `api:data-integration` | Test migrations, idempotency, constraints and graph rollback against running services |

Mutation and integration targets are not cached. Run `data-up` before
`data-integration`; integration tests do not reset databases. Pure data tests
are registered in the API's fast checks. Docker integration tests are explicit
and are not part of the existing H2-based Spring context test suite.

## Dataset and provenance

`apps/api/data/curated-pickups.json` contains stable UUIDs, typed assertions,
accepted selections, and evidence references. The three Markdown snapshots in
`apps/api/data/sources/` are copied byte-for-byte from the supplied POC's
`_docs/specs/` directory. No access to the old checkout is needed after this copy.

The snapshots are compiled notes, not the original OEM PDFs. Their upstream
links are retained as references, not as evidence of an independent verification.
`captured_on` records when the notes were copied here; it is not the date the
manufacturer published a specification. Evidence includes an exact excerpt,
one-based line range and section/column locator, checked against the source hash.

The curated scope is five Brazilian MY2026 configurations:

- Ford Ranger Black 2.0 AT Diesel (provisional identity).
- Ford Ranger Limited 3.0 V6 AT Diesel.
- Toyota Hilux SRX Plus 2.8 AT Diesel.
- Nissan Frontier Platinum 2.3 AT Diesel.
- Nissan Frontier PRO-4X 2.3 AT Diesel.

This covers 21 attributes, 76 assertions, 76 evidence entries, and 105 matrix
cells: 72 known, 31 not reported in the curated subset, and two conflicting.
It is not a transcription of all rows or all trims in the source documents.
The Ranger Raptor is not in these three documents and is not seeded.

Important curation decisions:

- Ranger MY2026 identity is supported by the website-update section of the
  compiled notes, not inferred from the catalog publication month alone.
- Ranger Black's catalog table says `4x4`, whereas the website section says
  `4x2`. Both observations remain; the accepted cell selects neither. Its
  configuration identity remains `PROVISIONAL` until primary-source review.
- Hilux SRX Plus has a camera conflict: the explicit table marks its PVM camera
  absent, while the summary says it retains all SRX equipment, including PVM.
  Both interpretations are retained with evidence and neither is selected.
- Torque is stored in Nm. The exact conversion is `kgf.m × 9.80665`; original
  values, original units, and engine-speed qualifiers are retained. The
  additional decimal digits are conversion arithmetic, not increased accuracy.
- Frontier width and height have a PRO-4X-only footnote. Platinum does not
  inherit them. Unspecified mirror scope remains a separate attribute from
  width with or without mirrors.
- Ranger model-level payload ranges do not become invented trim-specific values.
- A dash in the Hilux drivetrain measurement row is ambiguous. It does not
  become equipment absence, and the first column is not propagated.
- The optional Limited package maps only ACC and the surround-view camera.
  These remain `OPTIONAL`. The package mapping is explicitly incomplete.
- Equipment concepts represent coarse capabilities, not exact functional
  equivalence. Stop-and-go, object detection and OEM terminology are qualifiers.
- Missing observations remain `NOT_REPORTED`, with a reason explaining the
  curation gap. This status does not imply the equipment is absent or that a
  complete search has failed.
- Price observations are undated references in BRL and explicitly not verified
  current prices. They must not be presented as today's price.

## Relational model

Flyway SQL lives under `apps/api/src/main/resources/db/migration/`. Both the
local Flyway container and Spring Boot use these migrations and the same
`public.flyway_schema_history` ledger. The container version matches the API's
Spring Boot-managed Flyway version. Hibernate uses schema validation, never
automatic schema mutation. Flyway is disabled for the database-free AOT profile
and existing H2 context tests; real database integration is tested separately.

All knowledge tables live in the `catalog` schema:

```text
brand -> vehicle_model -> vehicle_configuration
                              |
                         spec_assertion -> attribute_definition
                              |
                        assertion_evidence -> evidence -> source_revision

accepted_specification -> selects one assertion, or records a gap/conflict

vehicle_configuration -> configuration_package -> feature_package
                                                    |
                                               package_item -> attribute_definition
```

Attribute definitions declare `NUMBER`, `TEXT`, `LIST` or `AVAILABILITY` and
a canonical unit where appropriate. PostgreSQL enforces type compatibility,
valid value shape, and that an accepted assertion belongs to the correct
configuration/attribute pair. Publication requires non-rejected evidence;
conflicts require at least two evidenced assertions.

Source revisions, evidence, assertions and their evidence links are append-only.
Corrections create new observations; acceptance can be changed to select a new
observation. This milestone stores the current selection, not a history of
selection decisions or saved comparisons. Those belong to the next API slices.

`catalog.specification_matrix` is the read contract for the comparison slice.
It includes every configuration/attribute pair, even when no assertion exists.
Unknown and conflicting cells expose no selected value. Equipment absence is
represented separately as a known assertion with `availability = 'ABSENT'`.

Example PostgreSQL query:

```sql
SELECT configuration_name, attribute_code, value, unit,
       availability, knowledge_status, reason
FROM catalog.specification_matrix
WHERE attribute_code IN ('power_max', 'torque_max', 'camera_360')
ORDER BY configuration_name, attribute_code;
```

Connect with a SQL client using the printed port, or run psql inside Compose:

```sh
docker compose exec postgres psql -U myuser -d mydatabase
```

## Seed revisions

The importer validates exact source hashes, evidence excerpts, references and
value types before writing. An advisory lock serializes imports, and a single
transaction inserts the fixture. Repeated imports compare existing records
with the fixture and never overwrite them. `catalog.seed_dataset` records
the version and SHA-256 of the fixture bytes. Reusing a version with changed
content fails and rolls back.

The fixture and evidence snapshots are excluded from automatic formatting to
preserve their hashes. Do not edit a published fixture in place. New knowledge
requires a deliberate fixture/import revision with new observation IDs and,
when necessary, a new source revision. Updating accepted selections after this
bootstrap should be an explicit application command; rerunning the bootstrap
must not undo later curation.

## Neo4j projection

The projector reads all PostgreSQL tables in a single MVCC snapshot. It hashes
that snapshot, creates uniqueness constraints, then replaces only nodes bearing
the owned `SpecSyncCatalog` label in one Neo4j transaction. A failed transaction
leaves the previous graph intact. Do not attach independently managed data to
these projection nodes: their relationships are replaced during a rebuild.

`CatalogProjection.fingerprint` identifies the exact source snapshot. The
projector rechecks PostgreSQL after committing; if PostgreSQL changed in the
meantime, it reports that the graph is an older consistent snapshot. `data-status`
compares the hashes. There is no automatic synchronization in this milestone.
Run a single projection job at a time; add a durable projection coordinator and
outbox when online writes arrive. Full rebuilds are suitable for this small seed,
not a planned bulk-ingestion mechanism for a large production catalog.

Every configuration has `HAS_CELL` relationships to `SpecificationCell` nodes.
Only known cells have a `SELECTS` edge to an accepted `SpecAssertion`. The
`HAS_ASSERTION` relationship includes all observations, including conflicting
ones; it must not be used alone to report accepted specifications.

Nested values and qualifiers are preserved as JSON strings. Numeric, text and
list values also have `value_number`, `value_text` and `value_list` properties
for Cypher filtering. Units live on the attribute definition.

Compare accepted torque values:

```cypher
MATCH (c:SpecSyncCatalog:VehicleConfiguration)-[:HAS_CELL]->(cell:SpecificationCell)
MATCH (cell)-[:FOR_ATTRIBUTE]->(attribute:AttributeDefinition {code: 'torque_max'})
MATCH (cell)-[:SELECTS]->(fact:SpecAssertion)
RETURN c.name, fact.value_number AS torque, attribute.unit, fact.qualifiers_json;
```

Find an optional capability through a package:

```cypher
MATCH (c:SpecSyncCatalog:VehicleConfiguration)-[offering:HAS_PACKAGE]->(p:FeaturePackage)
MATCH (p)-[:BUNDLES]->(a:AttributeDefinition {code: 'adaptive_cruise'})
RETURN c.name, p.name, offering.availability;
```

Trace accepted observations to their evidence:

```cypher
MATCH (c:SpecSyncCatalog:VehicleConfiguration)-[:HAS_CELL]->(cell:SpecificationCell)
MATCH (cell)-[:SELECTS]->(fact:SpecAssertion)-[:SUPPORTED_BY]->(e:Evidence)
MATCH (e)-[:FROM_REVISION]->(source:SourceRevision)
RETURN c.name, fact.raw_value, e.excerpt, e.locator, source.path, e.line_start;
```

## Next slice

Add configuration search and the comparison use case behind Spring domain
gateways. Both chat and catalog will consume that API. Then add agent tools and
comparison cards. Scraping should eventually submit observations through an
application ingestion command rather than writing directly to either database.
