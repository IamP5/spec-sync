# Ontology harness: local validation

Executed on 2026-09-09 against this worktree's Docker PostgreSQL 18 and Neo4j
5.26, with browser actions through the Chrome extension. Research remained in
review; these checks did not publish vehicle specifications.

## A new vehicle, without an input URL

In [the Maverick chat](http://localhost:4200/c/e7de821e-c98b-41ed-9d99-c0cc6229c5f3),
requested Ford Maverick, Brazil, model year 2026, all configurations, asking the
harness to check the catalog and discover official sources itself. The catalog
lookup returned no configurations. Discovery selected Ford's
[official comparison page](https://www.ford.com.br/picapes/maverick/versoes/compare/).

Work `71e6978b-2278-4815-9d65-cfca0b5f9965` reached `REVIEW` on its first attempt:

| Configuration   | Price, BRL | Power                       | Torque             |
| --------------- | ---------- | --------------------------- | ------------------ |
| Maverick Black  | 219900     | 253 cv at 5500 rpm          | 380 Nm at 3000 rpm |
| Maverick Tremor | 239900     | 253 cv at 5500 rpm          | 380 Nm at 3000 rpm |
| Maverick Hybrid | 239900     | 194 cv combined at 5600 rpm | 210 Nm at 4000 rpm |

Chrome displayed all three sibling configurations, nine findings, original
labels such as `Potência` and `Torque`, source link, SHA-256, ontology revision
`1`, and normalization revision `numeric-v3`. The Hybrid power retained the
combined-power qualifier; its torque retained the source footnote.

The source does not explicitly establish model year 2026. The review warning
requires applicability confirmation before publication. This is an overview
page with three facts per configuration, **not complete Maverick specifications**.
No unmapped observations arose from these nine facts.

- Reader: `specsync-source-v2-embedded-html`.
- Original SHA-256: `2bcb89ec646cbd3f784d33897c815bbccde5955881bc3f60bb1a040f175664e5`.
- Evidence SHA-256: `8d057eeb8725df5ea915cc6a2718c5b51560b3cdf0c740642c223689c7bf862a`.

## Retained Ford F-150 source

The browser's **Reinterpret saved source** action was exercised from
[the F-150 chat](http://localhost:4200/c/16e302ca-f426-4ca5-ae0e-09e367830c23).
Its original work `29c07c5e-47cb-4385-9dd5-1c4f07c3cf2e` retains the official
two-page PDF, original digest
`2c888070f2b5ac3561d21dacfddd110a4bfeb56deeb887f349dade30d58d11da`, and
the prior v4 reader evidence. Replay copies capture and identification; it does
not download or reread this PDF.

The initial replay `1a9ce187-5ae2-4c53-a874-a66b98577439` failed after three
worker attempts. Lariat Black and Tremor extraction checkpoints survived; Lariat
Chrome repeatedly failed. A bounded diagnostic reproduced **HTTP 200 with an
embedded provider error code 429**; Mastra exposed this as an empty `other`
completion. This was a rate limit, not a PDF download or native content block.

Extraction now recognizes the embedded error and waits with cancellable,
bounded backoff, honoring `Retry-After` and checking work ownership. It retains
the same model and safety checks. Deterministic regressions exercise retry
recovery, exhaustion, cancellation, malformed diagnostics, and terminal blocked
partial responses. A subsequent isolated call on the exact retained Lariat
Chrome input completed with 18 claims and four unmapped observations; it did not
alter research records.

The next browser replay, work `7584feb0-005c-408e-88db-64a1124c3aa9`, reached
`REVIEW` on its first worker attempt. PostgreSQL confirmed byte-for-byte equality
of its capture and identification checkpoint payloads with the original work.
Chrome displayed 55 mapped findings and nine observations awaiting mapping across
Lariat Black, Lariat Chrome and Tremor. The unresolved concepts were folded-mirror
width, curb weight and selectable drive-mode count. These labels were correctly
marked as derived from the old reader's interpretation, not original Ford labels.

The coverage check exposed an omission: the explicit `Fuel | Gasolina | Gasolina |
Gasolina` row produced a fuel claim for Tremor only. Thus this successful run
covered ten of the twelve expected cells for the four newly added attributes.
Completion alone was not counted as complete field coverage. This prompted a
deterministic, column-bound omission check using the pinned fuel vocabulary.

Replay scope also now includes the configured extraction policy version. Updating
that policy must create a fresh interpretation even when ontology, numeric rules
and source bytes are unchanged. The local API and AI were both advanced to
`br-v2` for this change; prior results remain available.

The final Chrome replay, work `22d88fbb-4f75-4f24-bab9-b15449d553dd` and private
request `7818ee48-1b38-4814-a454-f71bf430b029`, reached `REVIEW` on its first
attempt under `br-v2`. Its capture and identification payloads again match the
original exactly. No PDF download or reading was repeated.

| Configuration | Fuel                | Towing, kg | Passenger count | Bed volume, L |
| ------------- | ------------------- | ---------- | --------------- | ------------- |
| Lariat Black  | Gasolina → GASOLINE | 3492       | 5               | 1495          |
| Lariat Chrome | Gasolina → GASOLINE | 3492       | 5               | 1495          |
| Tremor        | Gasolina → GASOLINE | 3945       | 5               | 1495          |

All twelve target cells are present and normalized. Driver inclusion and towing
brake conditions remain `UNKNOWN`. Payload remains separately 740 / 740 / 671 kg.
The final result contains 56 mapped findings (18 / 19 / 19) and nine unresolved
observations. A previously proposed Lariat Black `drivetrain` claim was not
recaptured; the original interpretation remains intact. This is a remaining
extraction-recall gap, so the run is not a complete-document accuracy pass.

The final result was opened with `getVehicleResearch` in the chat and survived a
page reload. Chrome showed `Gasolina` as the fuel value for all three trims,
original evidence, correct capacity values and unresolved findings. The
**Your vehicle research** disclosure below the chat header also exposes saved
requests. A rendering regression was fixed so LIST claims display their printed
items instead of a source heading such as `Fuel`; revisioned extraction stage
keys now retain the readable extraction-progress label.

The separate [PDF validation](ontology-pdf-validation.md) checks the current
reader's original-label extraction against rendered original pages. It records
both correct specification cells and the observed publication-date error.

## Database and evaluation checks

The running development database applied migrations V1–V12. PostgreSQL and Neo4j
both report ontology revision `1`; the projection has no outstanding error.
The four Ford terms point to distinct canonical definitions in the graph, with
brand `ford`, model `f-150`, market `BR`, and retained source provenance.

The automated Docker integration suites use isolated test databases or graph
containers. They exercise real transactions and projections with synthetic model
responses: shared subscriptions, lease takeover and stale-worker fencing,
concurrent proposal activation, idempotency, account isolation, scoped term
queries, source reuse, immutable prior interpretations, and coverage after
activation. These checks do not establish general extraction accuracy.

The offline ontology benchmark passes 15 cases with zero false merges, six
newly resolved mappings, and seven retained novel concepts. Its fixtures are
synthetic and its report is `dist/benchmarks/ontology-synthetic-br-v1.json`.

Final checks included 298 AI tests, 155 API tests, 30 API architecture rules,
the full web suite plus the final 14-case pane regression, web architecture
checks, gateway checks, lint, type checks, formatting and builds. The updated
Docker ontology suite also restarts the API with a changed policy, verifies that
two users join a new replay, and confirms earlier results remain unchanged.
The web, API, AI service, gateway and both Docker databases were left running.
