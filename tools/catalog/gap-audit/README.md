# Catalog gap audit workflow

`catalog-gap-audit` (`.claude/workflows/catalog-gap-audit.js`) sweeps the
official Brazilian sources of every model in the catalog, finds specifications
those sources report that the catalog does not know yet, detects conflicts and
source drift, and maps facts that fit no attribute into ontology proposals.
It never writes to PostgreSQL or Neo4j: the deliverable is a reviewed report
plus ready-to-paste manifest and alias snippets. Applying them follows the
documented dataset path (`tools/catalog/ford-brasil-2026/README.md`, the
competitors README, then `nx run ai:data-project`).

## Run

The script lives in `.claude/workflows/catalog-gap-audit.js`; Claude Code reads
that directory at session start, so after adding or editing it run
`/reload-skills` (or start a new session) before calling it by name. Until
then it can be launched with `scriptPath` instead of `name`.

```sh
# everything (53 models, ~250 agents; see cost below)
Workflow { name: "catalog-gap-audit", args: { stamp: "2026-09-16T21:00:00Z" } }

# pilot / partial
Workflow { name: "catalog-gap-audit", args: { stamp: "...", models: ["Ford/Territory", "Toyota/Hilux"] } }
```

`args`:

| key                  | default                               | meaning                                                            |
| -------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| `stamp`              | required                              | ISO timestamp recorded in captures (scripts cannot read the clock) |
| `models`             | all active models                     | `Brand/Model` keys to restrict the sweep                           |
| `outDir`             | `tools/catalog/gap-audit/out/<stamp>` | where every file below lands (`out/` is gitignored)                |
| `maxSourcesPerModel` | 6                                     | discovery cap; the workflow logs what it dropped                   |

## Stages, models and reasoning effort

| Stage      | Agents              | Model        | Effort       | Why this tier                                                                                                             |
| ---------- | ------------------- | ------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Export     | 1                   | haiku        | low          | Runs `export-catalog.mjs`; mechanical                                                                                     |
| Discover   | 1 per model         | opus         | medium       | Web lookup with judgment (which page is the official current version listing)                                             |
| Capture    | 1 per model         | sonnet       | medium       | Follows `CAPTURE.md`; fiddly but scripted, no domain judgment                                                             |
| Analyze    | 1 per model         | opus         | high         | Reads source text against the matrix; the core research step                                                              |
| Verify     | 1 per model         | opus         | medium       | Runs `verify-findings.mjs`, then refutes each surviving item through the "wrong column / wrong meaning / wrong unit" lens |
| Ontology   | 1                   | opus         | high         | Clusters concepts from all models into candidate attributes                                                               |
| Critique   | 2 per proposal      | opus         | high, medium | Duplicate-of-existing and definition/unit lenses, each a separate refuter                                                 |
| Synthesize | 1 report + 1 critic | opus, sonnet | high, medium | Writes the report and manifest snippets; a completeness critic lists what the run did not cover                           |

The split follows the standing rule for this workspace: research, judgment
and synthesis on Opus, mechanical stages on Sonnet/Haiku. No stage uses
Fable, so the workflow runs entirely on the cheaper tiers.

## Files and contracts

```
<outDir>/
  ontology.json            attributes + aliases + vocabulary + manufacturer terms
  models.json              index of swept models
  models/<slug>.json       configurations, accepted cells, known sources (with sha256)
  sources/<slug>.json      Discover output: official sources kept and dropped, with reasons
  captures/<slug>/<key>.txt|.meta.json   captured source text and original-bytes hash
  captures/<slug>/_capture.json          Capture output incl. failures
  findings/<slug>.json     Analyze output (schema below)
  verified/<slug>.json     findings + deterministic checks + refutation verdicts
  ontology-proposals.json  clustered concepts, with critique verdicts
  report.md                final report (pt-BR) with manifest/alias snippets
```

`findings/<slug>.json`:

```json
{
  "slug": "ford-territory",
  "captures": [
    {
      "key": "territory_pdf",
      "url": "...",
      "kind": "pdf",
      "sha256": "...",
      "matchesKnownHash": true
    }
  ],
  "fills": [
    {
      "configurationId": "uuid",
      "configurationName": "Titanium",
      "attribute": "displacement",
      "value": 1497,
      "rawValue": "Cilindrada (cm³): 1497",
      "excerpt": "Cilindrada (cm³) 1497",
      "captureKey": "territory_pdf",
      "locator": "Motor table, page 2"
    }
  ],
  "conflicts": [
    {
      "configurationId": "uuid",
      "attribute": "power_max",
      "catalogValue": 169,
      "sourceValue": 170,
      "excerpt": "...",
      "captureKey": "territory_pdf"
    }
  ],
  "concepts": [
    {
      "term": "Modos de direção",
      "description": "...",
      "suggestedCode": "steering_modes",
      "suggestedValueType": "LIST",
      "suggestedUnit": null,
      "exampleValue": ["Normal", "Sport"],
      "excerpt": "...",
      "captureKey": "territory_pdf",
      "configurationIds": ["uuid"]
    }
  ],
  "notes": ["page 1 is an image"]
}
```

Fills use `availability` instead of `value` for AVAILABILITY attributes.
`excerpt` must be a verbatim substring of the capture text (whitespace and
quote style are normalised); `verify-findings.mjs` rejects anything else.

## What makes the run checkable

- Every value traces to a capture file and a verbatim excerpt; the check is a
  script, not a model.
- Capture hashes are compared with the catalog's recorded source hashes, so
  "source changed since 2026-09-12" is a fact, not a guess.
- Fills are only accepted for cells the catalog marks NOT_REPORTED; a value for
  a KNOWN cell must be filed as a conflict with the current catalog value.
- Concepts are rejected when their term already resolves to an attribute via
  label or alias.
- Each surviving item is attacked by a refuter with a distinct failure lens.
- Critique verdicts carry an explicit disposition (`accept`, `revise` with the
  corrected definition, `reject`); an agent that dies on a transport error is
  retried once and, if still silent, logged as "no verdict" instead of being
  counted as a rejection.
- The workflow logs dropped sources, failed captures and skipped models; the
  completeness critic turns them into an explicit "Pendências" section.

## Cost

Per model: 4 agents (1 Sonnet, 3 Opus). Plus 1 Opus for clustering, 2 Opus
calls per proposal, 3 small agents. A full sweep of 53 models is roughly 250
agents; the Territory pilot (23 agents) used about 1.5M subagent tokens.
Pilot on a few models first.
