# Proposed ontology evolution for vehicle research

Status: the proposal, scoped terminology, revisioned activation, graph projection
and explicit saved-source replay are implemented. See
[implementation and validation](ontology-evolution-implementation.md) for the
actual contract and remaining limits, including explicit curator activation and
replay rather than automatic background ontology changes. The design below
records the intended broader evolution.

## Existing foundation

PostgreSQL owns `catalog.attribute_definition`, `attribute_alias`, evidenced
assertions and accepted specifications. The graph is a versioned projection of
that catalog. The extraction prompt currently permits only known attribute codes;
unknown concepts therefore survive only in the captured document evidence.
The API already owns deterministic numeric normalization and rejects unsupported
conversions. Extend these boundaries rather than giving an LLM direct database or
Cypher access.

## Stable meanings and manufacturer terminology

Keep stable, manufacturer-independent attribute IDs and codes. Store Ford's
preferred labels and observed aliases separately, scoped by brand, language,
market and, where evidenced, model/year or effective period. Preserve the exact
observed term and source anchor alongside a normalized lookup key. A Ford display
label must not redefine the meaning of a property for other manufacturers.

Suggested additions from the inspected Ford PDF:

| Observed Ford label   | Proposed canonical code | Value contract                                                 |
| --------------------- | ----------------------- | -------------------------------------------------------------- |
| Combustível           | `fuel_type`             | Controlled fuel vocabulary; preserve raw value                 |
| Capacidade de reboque | `towing_capacity`       | Number, kg; preserve towing conditions when stated             |
| Número de passageiros | `passenger_capacity`    | Nonnegative integer count with an explicit counting definition |
| Capacidade da caçamba | `cargo_bed_volume`      | Number, L; separate from payload and luggage volume            |

The final passenger definition must establish whether the count includes the
driver; do not assume equivalence with every manufacturer's seating label.
Missing towing conditions remain unknown, never silently assigned as braked or
unbraked. Fuel values should support combinations and qualifiers without treating
hybrid powertrain type as a fuel synonym.

Normalization has four separate responsibilities: vehicle identity, attribute
meaning, typed values/units, and display terminology. `F150` can resolve to
`F-150` in Ford context, but trim merges require identity evidence. Lariat Black,
Lariat Chrome and Tremor remain distinct. Branded packages and component features
also remain distinct; record package membership and evidence instead of creating
unsupported equivalence aliases.

## Proposed research flow

1. Read both known and unmapped observations. Each unmapped observation retains
   the original short label, raw value/unit, qualifiers, page/table/column anchor,
   source hash, configuration scope and reader revision. It remains useful and
   visible as an unmapped finding even before ontology activation.
2. Resolve against existing definitions, scoped aliases and value contracts.
   Exact normalized lookup runs first. An LLM can propose semantic matches or new
   concepts; it cannot establish equivalence by spelling similarity or its own
   confidence score.
3. Persist a proposal: add an alias, add an attribute, extend a value vocabulary,
   or flag a potential merge/split. Include the proposed definition, dimension,
   unit, value type, qualifiers, alternatives considered, supporting evidence and
   base ontology revision. Proposals are application data, not generated SQL or
   migrations.
4. Validate and activate through an API-owned policy. Automatically apply existing
   deterministic mappings. Permit new additive definitions/aliases to activate
   only under an explicitly configured rule whose evidence and semantic checks
   they satisfy. Ambiguous meanings, merges, unit/type changes and conflicting
   mappings remain proposals for a curator. Repeated sightings alone are not
   sufficient approval evidence.
5. Commit the new ontology revision and a projection event together in PostgreSQL.
   Apply that revision to Neo4j idempotently using fixed, parameterized statements.
   Retain projection lag/error status and replay support. Start by extending the
   existing revisioned snapshot projection; incremental projection can follow.
6. Reprocess only affected unmapped observations from their immutable captures.
   Create new interpretation revisions rather than rewriting old evidence or
   checkpoints. Publishing a vehicle assertion remains a separate decision from
   activating its attribute definition.

The reader currently paraphrases facts into English. Add explicit original-label
and original-value fields for terminology learning; an English paraphrase is not
evidence of Ford's preferred name. Keep the successful compact-facts PDF behavior
and avoid returning to full brochure transcription.

## Concurrency, versions and confidence

Multiple users researching the same novel concept should attach evidence to one
shared proposal. Use normalized candidate fingerprints for exact deduplication,
transactional uniqueness and a final semantic-duplicate check before activation.
Different proposed names for the same meaning can still collide; an LLM-generated
code is not a sufficient uniqueness key.

Pin ontology, normalization and reader revisions for each extraction attempt.
Include those revisions in reusable interpretation keys, while keeping original
source capture reusable. An in-flight run keeps its pinned ontology; activation
creates a targeted follow-up rather than mixing definitions within one run.

Keep source authority, reading quality, identity applicability, semantic mapping
and value normalization assessments separate. Report uncertain mappings and
unknown values explicitly. Calibrate any numeric confidence against reviewed
examples; do not use a model's self-reported confidence as an activation gate.

## First implementation and evaluation

First add the four missing definitions with reviewed meanings, then retain
unmapped observations and manufacturer terms in the extraction contract. Next add
proposal persistence, scoped resolution, revisioned API activation and graph
projection. Finally replay the saved Ford capture to fill the supported gaps,
without downloading or reading the PDF again unless original terminology needs
to be recovered from its retained bytes.

Evaluate on manufacturer-labeled examples with unknown concepts and competing
definitions. Essential cases include payload versus towing; bed versus luggage
volume; passenger-count semantics; braked versus unspecified towing; publication
date versus model year; CV versus HP; package versus feature; brand-scoped aliases;
wrong-trim values; concurrent duplicate proposals; and replay after ontology or
normalization changes. Measure false merges, incorrect mappings, missed novel
concepts, correct unit conversion, evidence validity and coverage gained after
activation. A graph write succeeding is not an ontology-quality evaluation.
