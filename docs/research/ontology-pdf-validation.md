# Ontology PDF reader validation

Validated 2026-09-09 against the retained original Ford F-150 PDF. The v5
reader tested here completed in one model call and preserved all four required original labels.
All 42 checked specification cells were correct. **Publication-date accuracy failed:**
the reader reported `09/2024`, while the visible page-1 footer says `9/2026`.
This is a successful document-reading and terminology test, not a complete accuracy pass.

## Source and execution

- Source: [Ford F-150 technical PDF](https://www.ford.com.br/content/dam/Ford/website-assets/latam/br/nameplate/2026/f-150/overview/pdf/fbr-f-150-ficha-tecnica.pdf).
- Retained work: `29c07c5e-47cb-4385-9dd5-1c4f07c3cf2e`.
- Read the original bytes from local Docker PostgreSQL `ingestion.source_capture`.
  No download, source replacement or research-checkpoint mutation occurred.
- Original: 2 pages, 1,875,610 bytes;
  SHA-256 `2c888070f2b5ac3561d21dacfddd110a4bfeb56deeb887f349dade30d58d11da`.
- Ran the unchanged v5 `pdf-transcription.ts` through a temporary esbuild
  module, retaining its normal image rendering, prompt, provider and completion guards.
- Parser: `specsync-visual-pdf-evidence-v5:google/gemini-3.8-flash`.
- Result: 36.312 seconds, one model call, 2,609 input / 4,424 output tokens.
- Output: 6,063 characters, 49 lines, both page markers, 19 original-term annotations.
- Evidence text SHA-256:
  `1134cb75b81e51ec3529ff88b5ff46abd99f2cf40282037989990da894e42846`.

## Table checks

Rendered both original pages with Poppler and visually checked the technical table.
The column order remained **LARIAT BLACK | LARIAT CHROME | TREMOR**.

| Canonical attribute  | Original label retained    | Black    | Chrome   | Tremor   |
| -------------------- | -------------------------- | -------- | -------- | -------- |
| `fuel_type`          | Combustível                | Gasolina | Gasolina | Gasolina |
| `towing_capacity`    | Capacidade de reboque (kg) | 3492 kg  | 3492 kg  | 3945 kg  |
| `passenger_capacity` | Número de passageiros      | 5        | 5        | 5        |
| `cargo_bed_volume`   | Capacidade da caçamba (L)  | 1495 L   | 1495 L   | 1495 L   |

These 12 cells passed. Ten further rows also passed (30 cells): power with RPM,
torque with RPM, height to antenna base, payload, length, wheelbase, both mirror
widths, curb weight and fuel-tank capacity. Payload remained 740 / 740 / 671 kg,
separate from towing. Tremor-specific dimensions were retained.

## Limits and follow-up

The tiny publication-date footer was misread despite correct table extraction.
The reader did not assert a model year. Neither the publication date nor the URL's
2026 segment establishes model-year applicability. A focused footer read or an
explicit uncertainty outcome is needed before using this metadata as verified evidence.

Original labels can include parenthesized units. For example, the exact observed
towing label includes `(kg)`, while the seeded terminology entry omits it. The
current strict term lookup therefore does not itself match that label variant;
semantic extraction can map it, and any deterministic suffix handling should also
validate the separately reported unit.

The source does not settle driver inclusion in its passenger count or towing
brake conditions. Those remain unknown. This run did not publish claims, activate
ontology proposals or measure end-to-end extraction quality. Temporary executable
probe files were removed; retained PDF, rendered pages and evidence/check metadata
remain inspectable only in the ignored `node_modules/.cache/ontology-pdf-validation/` directory.

## Containment added after this observation

Parser revision `specsync-visual-pdf-evidence-v6` now treats visually read publication
metadata as an unverified candidate. The prompt requests an explicit candidate row
and tells the reader to leave uncertain small text unreadable. Independently of
model compliance, transcript assembly marks recognized publication-date rows:

```text
Unverified publication-date candidate (not model-year evidence): Publication date: 09/2024
```

The raw candidate remains available for audit. Technical rows, column order and
original-term/value annotations remain unchanged. API provenance gates accept both
v5 and v6 original-label annotations; v4 English paraphrases remain derived text.
Regression tests cover the observed wrong candidate, recognized English/Portuguese
metadata labels, unchanged table annotations and distinct explicit model-year rows.

This contains the certainty error; it does not correct the misread date or prove
better reading accuracy. No additional live model call was made after this change.
The observed v5 result and its failed publication-date check above remain the
record of the actual PDF validation.
