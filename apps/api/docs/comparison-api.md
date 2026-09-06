# Comparison API

The API reads PostgreSQL's published catalog and returns deterministic comparison
matrices for both the website and future agent tools. Neo4j and AI services are not
required for these endpoints. No catalog writes or live searches occur.

## Endpoints

All three endpoints allow anonymous GET requests. Other routes retain their
existing security policy.

| Endpoint                          | Parameters                                                                                                                                                                       | Response                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `GET /api/vehicle-configurations` | `q` (optional literal substring, max 100 characters), `market` (uppercase two-letter code), `modelYear` (1900–2200), `limit` (1–100, default 20), `offset` (0–100000, default 0) | `items`, `limit`, `offset`, `hasMore`                                       |
| `GET /api/comparison-attributes`  | None                                                                                                                                                                             | `items`: attribute ID, code, label, description, value type, canonical unit |
| `GET /api/comparisons`            | `configurationIds` (2–5 distinct UUIDs), `attributes` (optional, up to 50 distinct codes)                                                                                        | `configurations`, `rows`                                                    |

Lists accept comma-separated values or repeated query parameters. Omitted or empty
`attributes` selects all definitions, ordered by code. Explicit attribute and
configuration selections preserve caller order. Unknown IDs/codes fail the whole
request; the API never silently returns a partial selection.

Search matches brand, model and configuration name together, case-insensitively.
`%` and `_` are literal characters, not SQL wildcards. Market and model-year
filters are exact. Results have stable ordering by brand, model, configuration
name, market, year and UUID. An empty search result is HTTP 200 with an empty
`items` array. Pagination uses a lookahead row, without an expensive total count.

Malformed or missing query parameters return HTTP 400. Invalid selection sizes,
duplicates, unknown IDs/codes and invalid filter ranges return HTTP 422 with an
`errors` array. Both use `application/problem+json`.

## Reading a comparison

Each row contains an `attribute` and one `cell` per selected configuration. A cell
contains:

- `configurationId`, `knowledgeStatus`, and the curator's `reason`.
- `selectedObservationId`: the accepted observation for `KNOWN`, otherwise null.
- `observations`: non-rejected, evidenced claims for that configuration and
  attribute, ordered by UUID. Unselected observations may also appear; their
  presence does not make them accepted facts.

Each observation contains its `id`, typed `value`, `availability`, `qualifiers`,
`rawValue`, `reviewStatus`, and `evidence`. Evidence includes the exact excerpt and
line/section locator, source revision ID, SHA-256, title, repository-relative source
path, provenance, capture/publication dates and upstream reference URLs. Upstream
links were recorded in supplied notes and have not been independently verified.

| Knowledge state | Consumer behavior                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `KNOWN`         | Find the observation matching `selectedObservationId`; render its typed value and qualifiers.   |
| `NOT_REPORTED`  | Render unknown/missing. Do not infer equipment absence, even if unpublished observations exist. |
| `CONFLICTING`   | Present the competing observations and their evidence; do not select a value.                   |

`NUMBER` values are JSON numbers, decoded as `BigDecimal` in the adapter to
preserve decimal precision. `TEXT` values are strings and `LIST` values are string
arrays. `AVAILABILITY` values use the separate `availability` field (`STANDARD`,
`OPTIONAL`, `ABSENT`, `NOT_APPLICABLE`); their `value` is null.

Always retain qualifiers such as RPM, conversion metadata, package conditions,
dimension scope and price date limitations. The API does not rank vehicles or
label higher values as better. Differently scoped width definitions remain separate
rows. Optional items remain optional; this phase does not expose a package browser
or calculate a configured vehicle's price.

Configuration metadata includes brand, model, market, model year, identity status,
identity note and identity evidence ID. The Ranger Black's provisional identity
remains visible. The initial data also preserves its drivetrain conflict and the
Hilux camera conflict. Sources remain curated notes, not OEM-verified facts.

## Local use

Start the seeded databases, then run the API from the repository root:

```bash
npm exec -- nx run api:data-up
npm exec -- nx run api:bootRun
```

`bootRun` retains the project's normal local Google Cloud configuration. For an
isolated comparison test without cloud credentials, use the integration target
below; it disables unrelated cloud clients for its temporary API process.

Examples against the usual local API port:

```bash
curl 'http://localhost:8080/api/vehicle-configurations?q=Ranger&market=BR&modelYear=2026'
curl 'http://localhost:8080/api/comparison-attributes'
curl --get 'http://localhost:8080/api/comparisons' \
  --data-urlencode 'configurationIds=08e08761-a2e7-5ae5-b2ad-387e93829fb7,f94a2350-0a1a-5ad3-aef8-3c0c472c72a1' \
  --data-urlencode 'attributes=power_max,torque_max,drivetrain,camera_360'
```

The example compares the seeded Ranger Black and Limited. Applications should
resolve IDs through configuration search instead of hardcoding the fixture IDs.

## Architecture and verification

`CatalogGateway` returns plain domain read models. Three use cases validate and
serve searches, attribute definitions and comparisons. `CatalogJdbcGateway` uses
bound SQL parameters and maps persistence data at the boundary. Comparison reads
run within one read-only `REPEATABLE_READ` transaction so configuration metadata,
accepted selections, observations and evidence share the same database snapshot.
Queries are batched by selection; there is no query per cell.

Unit tests cover selection/filter invariants and use-case delegation. MVC slice
tests cover the public HTTP contract and security boundary. `CatalogJdbcGatewayIT`
uses the curated fixture and production view with H2 to test SQL mapping, ordering,
precision, provenance and conflict behavior without Docker. H2 does not validate
the PostgreSQL migration constraints.

```bash
npm exec -- nx run api:spotlessCheck
npm exec -- nx run api:archTest
npm exec -- nx run api:test
npm exec -- nx run api:comparison-integration
```

The integration target builds the boot jar and starts a temporary Java 25 API on a
random loopback port against this repository's already-seeded Compose PostgreSQL.
It tests actual HTTP serialization and error handling, then stops its API process.
It does not reset databases or require Neo4j. Use `api:data-integration` separately
for migration, publication constraints and graph projection checks.

The API's explicit Gradle task overrides hash the project's source and fixture
files (`inputs: ["default"]`). This is necessary because these targets delegate
dependencies to Gradle instead of declaring Nx dependency tasks; hashing only
outputs of nonexistent Nx dependencies could otherwise reuse stale results.

The next consumer phase can wrap configuration search and comparison as agent
tools and render the same rows in the traditional comparison page.
