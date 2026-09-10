# Ontology evolution in the research harness

Implemented locally on 2026-09-09. PostgreSQL owns the ontology; Neo4j remains a
projection, and model output cannot execute database statements.

## Research behavior

Each new work item pins an ontology revision, numeric normalization revision,
attribute definitions, scoped terminology and controlled-value vocabulary. Ford
F150 and F-150 resolve to one model identity; trim names remain distinct. Legacy
saved work can have revision zero and an unknown normalization revision.

The document reader retains compact facts. Its v5/v6 PDF formats additionally
retain short original field labels and values, with page/table/column context.
The v6 reader explicitly marks recognized publication-date rows as unverified
visual candidates, after a live check found a misread footer. It does not correct
the underlying date-reading error or certify model year. Old visual captures
without original-label annotations retain their derived-text status.

Extraction keeps two separate outputs: mapped claims and unmapped observations.
Both retain source evidence. An unmapped observation can suggest an attribute,
alias, vocabulary extension, or a semantic question. Deterministic scoped lookup
wins over a conflicting model suggestion. Evidence checks validate line bounds
and the presence of labels, values and units in those lines. Locators retain
page/table/column descriptions, but these text checks do not independently prove
that the model chose the correct table column. Proposals retain candidate definitions,
typed units/dimensions, alternatives and immutable supporting observations.

The reviewed initial additions are `fuel_type`, `towing_capacity`,
`passenger_capacity` and `cargo_bed_volume`. Combined fuels remain combinations;
hybrid is not a fuel synonym. Passenger counts retain unknown driver inclusion,
and towing values retain unknown braking conditions unless the source states
them. Bed volume, luggage volume, payload and towing remain different meanings.

A deterministic omission check recovers explicit fuel cells from recognized
comparison tables when the model skips them. It requires an evidenced trim
header, selects that trim's exact column and accepts only pinned fuel vocabulary
values. Ambiguous headers and unfamiliar values do not produce inferred claims;
conflicting supported fuel rows remain separate findings for review. This is a
bounded table pattern, not a completeness guarantee for every document format.

## Activation and replay

`GET /api/ontology/proposals` returns the curator queue and revision/projection
status. `POST /api/ontology/proposals/{id}/activate` accepts a current
`baseRevision` and a review `reason`, with the existing curator authentication.

Concurrent identical observations share a proposal and attach separate evidence.
Activation serializes on the catalog authority, checks conflicting codes and
terms, numeric dimensions, vocabulary ambiguity and source-label provenance,
then commits one ontology revision and projection event in the same transaction.
Repeated activation is idempotent. Merge/split questions remain unresolved;
activation does not publish any vehicle specification.

The graph projects manufacturer terms separately from generic aliases, plus
ontology revisions, vocabulary values and proposal evidence. Queries require the
applicable manufacturer/model/market/year for scoped terms. A new definition
creates unknown specification cells; it does not imply absent equipment.

The browser's **Reinterpret saved source** action and `replayVehicleResearch`
agent tool create a new private subscription to shared work for the retained
source and current ontology. Replay has its own scope, separate from discovery
or fresh downloads. It copies capture and identification checkpoints, then runs
new extraction checkpoints. Previous drafts and evidence remain unchanged.
Multiple users replaying the same work/revision share the new work. Repeated
requests use an idempotency UUID; failed generations remain auditable and allow a
new retry.

Replay scope includes the configured research policy version as well as ontology,
normalization and reader revisions. Operators must bump
`SPECSYNC_RESEARCH_POLICY_VERSION` consistently in API and AI when changing model
or extraction policy. A new request under that policy creates a fresh
interpretation; retrying an existing private request UUID remains idempotent.

The extraction boundary also handles OpenRouter HTTP-200 responses containing
an upstream 429 error. It retries transient provider errors with bounded,
cancellable backoff and ownership checks, while terminal content blocks remain
terminal. Completed checkpoints survive worker retry.

New semantic definitions, aliases and vocabulary extensions currently require
curator activation. Existing deterministic mappings are automatic. Replay is an
explicit action after activation; automatic background replay scheduling and an
ontology-curation browser screen are not included. An old research card retains
its historical "Mapping proposed" findings even after activation; refreshing it
does not show later ontology decisions. Current decisions are available through
the curator queue, and replay produces a new interpretation. A failed replay
can be retried from the original completed research card.

## Evaluation and validation

Run these from the workspace root:

```sh
npm exec -- nx run ai:ontology-benchmark
npm exec -- nx run ai:ontology-integration
npm exec -- nx run ai:graph-integration
npm exec -- nx run ai:data-integration
```

The ontology benchmark executes the production TypeScript resolver and evidence
verifier against synthetic, versioned Brazilian terminology cases. It records
source-code hashes, predictions and separate Mastra gates for false merges,
scoped mappings, evidence, qualifiers, novel-concept retention and mapping
coverage gained. It is a contract benchmark, not a measurement of real PDF or
model accuracy. Its initial 15 cases pass with zero false merges, six gained
mappings and seven retained novel concepts.

The PostgreSQL integration uses an isolated database inside the local Docker
PostgreSQL service. It exercises multi-user joining, proposal/evidence
uniqueness, concurrent activation, pinned revisions, immutable-source replay,
coverage after activation, account isolation and rejected conflicting
attributes. Model responses are controlled synthetic fixtures. The Neo4j tests
exercise real scoped queries; the data integration checks migrations,
repeatability, projection rollback and equivalent knowledge states in both
stores.

Verification passed for API unit tests and architecture rules, AI unit and reader
regressions, web unit and architecture tests, gateway tests, lint, type checking,
formatting checks and application builds. Docker suites passed for ingestion,
shared research, ontology activation/replay, graph queries and data projection.
The shared-research suite additionally verifies that concurrent Ford `F150` and
`F-150` requests share one work item while preserving private request spelling.

For local development, `apps/ai/.env.example` now sets `NODE_ENV=development`:
Mastra's dev child otherwise defaults to production, which correctly rejects
the local Docker graph's unencrypted Bolt connection. Deployed services retain
the production TLS requirement.

Live Chrome results are recorded in [the validation report](ontology-live-validation.md).
The harness still
has its documented configuration/page/claim limits; neither extraction confidence
nor semantic proposals are calibrated accuracy probabilities.
