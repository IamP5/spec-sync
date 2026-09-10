# SpecSync extraction benchmark

This is the first executable slice of the [search harness design](../../../docs/research/specsync-search-harness-design.md). It scores source-text extraction with Mastra core function scorers, records reproducible JSON reports, and exits unsuccessfully when any case fails a required metric. The [Mastra evaluation research](../../../docs/research/mastra-evaluations-reference.md) explains the broader evaluation plan.

The default run is offline and makes no model calls:

```sh
npm exec -- nx run ai:benchmark-test
npm exec -- nx run ai:benchmark -- --report dist/benchmarks/synthetic.json
npm exec -- nx run ai:benchmark -- --help
```

## What is implemented

- A source-only deterministic parser for the explicitly synthetic TSV fixture format.
- A replay candidate that scores previously recorded predictions without rerunning their model.
- An explicitly selected OpenRouter Mastra Agent candidate with JSON output and local schema validation, numbered source lines, no memory/tools, one step, no automatic retries, token limits, and cancellation.
- Strict Zod 3 input/output validation, exact dataset/replay digest matching, bounded repetitions, source hashing, and per-trial pass/fail reporting.
- Nine deterministic gates: identity; claim precision/recall; configuration precision/recall; abstention precision/recall; complete evidence support; and output uniqueness.
- Offline regression tests for wrong trim/column/value/unit/qualifier/availability, forged revision, incomplete fuel/conflict evidence, empty predictions, duplicates, ambiguity, failures, timeouts, replay membership, and source mutation.

`createScorer` and `scorer.run` come from the installed `@mastra/core`; this slice does not add `@mastra/evals`. The benchmark runner owns repetition and error reporting. A production `vehicleIngestionWorkflow` benchmark adapter, stored Mastra experiments, automated PDF/OCR scoring, source discovery evaluation, and LLM judges remain subsequent work. Shared research deduplication is implemented and exercised separately by the Docker-backed `ai:research-integration` target.

## Fixtures and their limits

`fixtures/synthetic-br-v1.json` has nine fabricated contract cases: multi-trim pickup, older sedan, motorcycle, bus, heavy truck, ambiguous SUV model year, conflicting rows in one van document, an all-unknown source, and a vehicle-not-found source. Numbers and makes are deliberately fictional. Passing this suite validates the software contract; it does not estimate accuracy across Brazilian vehicles, manufacturers, body types, or model years.

`fixtures/ranger-notes-v1.json` contains a frozen Ranger notes excerpt from this repository: the original first 151 lines, with five configurations and ten power/torque claims in its explicitly chosen scope. It is `curated-notes` provenance, not a verified manufacturer document. Its excerpt does not state a model year. The gold therefore retains `modelYear: null` and asks for clarification before assigning a complete identity. Each fact requires both the numeric row and the engine row supporting its fuel qualifier. This fixture is available for replay and LLM extraction; the synthetic parser intentionally rejects ordinary text.

The requested identity filter is already provided to every candidate. Natural-language intent parsing is not measured. A candidate extracts every configuration in the stated source scope even if the request names only one trim. It returns the matching requested identities separately. Unknown model year, multiple matches, or no matches must not silently become a guessed identity.

## Run a model comparison

Set `OPENROUTER_API_KEY` in the invoking environment and set `MODEL` to a complete `openrouter/vendor/model` ID. The runner does not load app `.env` files or select a model implicitly. Its preflight checks the installed Mastra structured-output capability registry; this may lag the provider catalog. No model call occurs for `--help`, deterministic, or replay.

The following command makes model calls because it explicitly selects `openrouter`:

```sh
npm exec -- nx run ai:benchmark -- \
  --candidate openrouter \
  --model "$MODEL" \
  --dataset apps/ai/benchmarks/fixtures/ranger-notes-v1.json \
  --repeats 3 \
  --timeout-ms 60000 \
  --max-run-ms 180000 \
  --max-output-tokens 8192 \
  --report dist/benchmarks/ranger-model.json
```

Use a different explicit model and report path for each comparison. Candidate metadata records the model, prompt hash, and settings. Run the same source snapshot and budget for each model. Live evaluation is an extraction experiment over frozen text; it does not fetch manufacturer websites or call production ingestion routes. The model adapter has been verified offline through preflight and installed APIs; a successful provider-backed run still requires credentials and an explicit invocation.

This candidate deliberately injects the output schema into the system prompt and validates the returned JSON with Zod. Dynamic qualifier records are not supported by every provider's strict native JSON-schema subset. The report records this prompt-based schema policy; malformed output fails the trial. Native structured output can be a separate candidate once its model-facing schema is portable.

Run bounds are enforced: 1–10 repeats, at most 200 trials, at most 120 seconds per trial and 600 seconds per complete run, at most 16,384 output tokens per call, and at most 200,000 serialized input characters per case. Defaults are lower; `--help` lists them. A timeout cancels that candidate and skips remaining trials, which fail the report. JavaScript cancellation is cooperative; this runner does not forcibly terminate arbitrary blocking code in a separate process. Cost varies by the selected model and is not a dollar spend cap.

## Replay recorded predictions

A replay file has this shape:

```json
{
  "schemaVersion": 1,
  "datasetId": "specsync-synthetic-br",
  "datasetRevision": "v1",
  "datasetSha256": "<validated dataset digest from a report>",
  "predictions": {
    "<case-id>": {
      "resolution": { "status": "resolved", "vehicleIds": ["<variant-id>"] },
      "variants": [],
      "claims": [],
      "abstentions": []
    }
  }
}
```

Include every dataset case exactly once, with a complete prediction. Missing cases, extra cases, a stale digest, or a mismatched ID/revision fail before scoring. The example only illustrates the envelope; its empty arrays are not a passing prediction for a case with known facts.

```sh
npm exec -- nx run ai:benchmark -- \
  --candidate replay \
  --dataset apps/ai/benchmarks/fixtures/ranger-notes-v1.json \
  --replay /absolute/path/to/ranger-predictions.json \
  --report dist/benchmarks/ranger-replay.json
```

Replay reports measure replay/scoring latency, not the original model latency. Token usage, original model-call count and cost are `null` because the replay contract does not claim to preserve that telemetry. Repeating a replay is not an independent model sample.

## Scoring contract

An atomic claim binds its vehicle ID, field, exact raw value, unit, qualifiers, availability state, and evidence. JSON object key order is ignored; semantic values are not fuzzily matched. Expected evidence anchors are conjunctive: every listed anchor must be supplied. Alternative equivalent passages are not supported in this first contract. A cited row must exist verbatim at its source revision and line range, and its header/column must match the manually labeled claim. A correct number copied from another trim remains wrong even if the quote contains that number.

Duplicate claims cannot increase recall and fail the uniqueness gate. Precision and recall are independent: returning no facts fails when facts are known; a correctly empty negative case passes. Empty or wholly unknown documents are valid fixtures. Every required gate must score exactly 1 on every trial in this contract suite. Those thresholds are deliberate exact fixture assertions, not proposed production accuracy targets.

Confidence is nullable and defaults to `null` when omitted. The report distinguishes confidence coverage from its Brier diagnostic against fixture labels. It always marks confidence as uncalibrated. A missing confidence value is not turned into zero. Before any production reliability label, build a held-out, human-adjudicated corpus and measure calibration at meaningful coverage.

## Reports and extending the corpus

Reports include the dataset/source digests; executable source hashes; lockfile hash; Git commit and dirty state; Node/core versions; candidate/model/prompt metadata; budgets; every prediction and gate result; failed/skipped trials; per-trial timing; and available token/cost telemetry. Errors and missing data cannot be hidden by good averages. Aggregate scores describe only scored trials, while the overall pass decision includes all trials.

Deterministic execution reports measured zero model usage/cost. Live OpenRouter token usage is recorded when supplied by Mastra; absent values and unavailable provider cost remain `null`. Failed model calls may have incurred cost despite no returned usage. Add a provider cost adapter before treating the report as financial accounting.

Add a versioned JSON dataset using `contracts.mjs` and pass `--dataset`. Source formats are `synthetic-tsv-v1` and `text-v1`; provenance is explicitly `synthetic`, `curated-notes`, or `manufacturer-reviewed`. A provenance string is a curator assertion, not automatic source verification. Supply immutable text with SHA-256 and manually reviewed gold; do not derive expected labels from the candidate being measured. For manufacturer PDFs, label converted text/locators and the conversion revision before using `text-v1`; this contract does not yet encode page images or bounding boxes.

Keep new model/document-family groups out of the development fixture set when measuring generalization. The next useful benchmark expansion is a held-out manufacturer corpus with explicit field/variant denominators, OCR and table-layout errors, wrong-market/year sources, source conflicts, and measured latency/cost. The separate `ai:research-integration` suite exercises concurrent users, database ownership and recovery; `ai:ontology-integration` covers proposal activation and shared immutable-source replay.

## Ontology normalization evaluation

`fixtures/ontology-synthetic-br-v1.json` contains 15 explicitly fabricated ontology cases with source digests and separately labeled expected mappings. Familiar Ford terminology is used to exercise scoped rules; its numbers are not manufacturer-reviewed specifications. These are pre-extracted observations, so the suite measures deterministic normalization and evidence contracts, not LLM extraction or PDF reading accuracy.

`ontology-eval.mjs` bundles and executes the actual production `resolveTerm` and `verifyUnmappedObservations` functions. It records their source hashes and uses Mastra core scorers. Every gate must pass: zero false merges, known mapping recall, retention of novel concepts, evidence validity, configuration/value binding, qualifiers, coverage gained after mappings, and complete unique cases. The offline fixture retains seven unmapped concepts and gains six supported mappings after its simulated terminology revision. This does not activate database ontology or publish assertions.

Run `npm exec -- nx run ai:benchmark-test` for the complete benchmark regression suite, including ontology. Adversarial predictions test payload versus towing, bed versus luggage volume, unspecified driver/braking conditions, hybrid versus fuel, package versus component, another brand/model/year, wrong trim/value/unit, forged evidence, missing concepts and missed replay coverage. `F150` resolves to `F-150` only under the approved Ford identity rule; trim names are not merged. The executable `ontology-eval.mjs` also writes `dist/benchmarks/ontology-synthetic-br-v1.json` when invoked as the ontology benchmark target. No network or model generation runs in this evaluation.
