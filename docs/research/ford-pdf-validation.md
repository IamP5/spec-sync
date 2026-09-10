# Ford PDF reader validation

On 2026-09-09, the shared research workflow successfully read the same official
Ford PDF that had previously failed three attempts. The new run reached `REVIEW`
on attempt 1 with three configurations and 45 draft claims. This verifies recovery
of the reading path and a bounded comparison against the manufacturer's table;
it does not certify complete extraction or specification accuracy.

## Failure and reader change

The original visual transcription request ended with native provider reason
`RECITATION` and finish reason `error`, mapped by Mastra's OpenRouter adapter to
`other`. A subsequent prompt that narrowed
the requested content while still asking for selective verbatim transcription
also failed. The successful prompt asks for compact factual labels and values,
preserved table columns and qualifiers, and paraphrased equipment descriptions.
It avoids requesting reproduction of brochure prose.

A direct diagnostic call with that prompt succeeded in 33.2 seconds. The separate
shared workflow validation below then exercised normal source capture,
checkpointing, identification and extraction. The reader continues to reject
blocked or incomplete responses; it does not accept their partial text. Original
PDF bytes remain retained alongside the derived evidence text.

## Live run and provenance

In Chrome conversation `16e302ca-f426-4ca5-ae0e-09e367830c23`, the retry referred
to the earlier failed private request and requested all Brazilian 2026 F-150
configurations. The test message supplied no URL. The agent started fresh research using
the same [official Ford technical PDF](https://www.ford.com.br/content/dam/Ford/website-assets/latam/br/nameplate/2026/f-150/overview/pdf/fbr-f-150-ficha-tecnica.pdf).

- Private request: `17742c01-6a79-441f-ac83-ee79a9b18e35`.
- Work: `29c07c5e-47cb-4385-9dd5-1c4f07c3cf2e`, policy `br-v1`.
- Created: 11:09:01.696780 UTC; processing began at 11:09:05.309461 UTC.
- Completed: 11:11:13.629719 UTC, `REVIEW`, attempt 1, no error.
- Source: `application/pdf`, two pages, 1,875,610 retained original bytes.
- Parser: `specsync-visual-pdf-evidence-v4:google/gemini-3.8-flash`.
- Original SHA-256: `2c888070f2b5ac3561d21dacfddd110a4bfeb56deeb887f349dade30d58d11da`.
- Derived text SHA-256: `a63635d69dbb1ccec5d884597540f4a02db658ac1a9776762ec374da0be128cd`.

The capture checkpoint and final `ingestion.source_capture` record agree on the
URL, MIME type, parser version and both hashes. The original PDF hash also matches
the independently rendered source inspected for this comparison.

| Immutable checkpoint      | Committed at (UTC) |
| ------------------------- | ------------------ |
| `capture-source`          | 11:10:00.225092    |
| `identify-configurations` | 11:10:12.970303    |
| `extract-configuration-1` | 11:10:38.714383    |
| `extract-configuration-0` | 11:11:05.321345    |
| `extract-configuration-2` | 11:11:13.583008    |

The old PDF work `b38eba23-6b0f-4e20-a2ba-5d6c8306994a` remains `FAILED`, with
three attempts and zero checkpoints. The fresh request did not rewrite that
history or reuse the earlier HTML fallback's evidence.

## Table reading and draft coverage

The original rendered page 2 and the new capture were compared for the ten rows
below. All 30 selected cells match, with the three columns kept in their original
order. Power and torque retain their RPM qualifiers; height retains the
measurement point at the antenna base.

| Checked row            | LARIAT BLACK       | LARIAT CHROME      | TREMOR             | In final draft claims      |
| ---------------------- | ------------------ | ------------------ | ------------------ | -------------------------- |
| Maximum power          | 405 cv at 6000 rpm | 405 cv at 6000 rpm | 405 cv at 6000 rpm | Yes                        |
| Maximum torque         | 556 Nm at 4250 rpm | 556 Nm at 4250 rpm | 556 Nm at 4250 rpm | Yes                        |
| Fuel type              | Gasoline           | Gasoline           | Gasoline           | No corresponding attribute |
| Transmission           | 10-speed automatic | 10-speed automatic | 10-speed automatic | Yes                        |
| Passenger count        | 5                  | 5                  | 5                  | No corresponding attribute |
| Cargo bed volume       | 1495 L             | 1495 L             | 1495 L             | No corresponding attribute |
| Payload                | 740 kg             | 740 kg             | 671 kg             | Yes                        |
| Towing capacity        | 3492 kg            | 3492 kg            | 3945 kg            | No corresponding attribute |
| Height to antenna base | 1958 mm            | 1958 mm            | 2015 mm            | Yes                        |
| Wheelbase              | 3694 mm            | 3694 mm            | 3698 mm            | Yes                        |

Identification found exactly those three trims, each anchored to page 2. Each
draft contains 15 claims and zero validation issues. For the six checked rows
represented by allowed attributes, all 18 claims match the source values,
qualifiers and trim columns. Their locators explicitly name page 2, the table,
row and correct trim. The derived text places the performance heading at line 32
and the dimensions heading at line 41; the retained claim ranges include those
headings and their corresponding value rows.

The other 12 selected cells were read correctly but cannot become dedicated
claims under the current 21 catalog attribute definitions. There is no fuel-type,
towing-capacity, passenger-count or cargo-bed-volume attribute. `fuel_tank`
represents tank capacity, and `payload` represents vehicle payload; substituting
either would change the meaning. The worker passes these catalog definitions to
extraction, which permits only known attribute codes. This is a taxonomy coverage
limit, not an observed failure to read those rows or extract a supported
attribute. It is separate from the reading-stage result of this comparison.

## Applicability and verification limits

The PDF's publication date, September 2026, remains separate from model year.
`identify-configurations.modelYearNote` is null, and the final draft warns that
the source does not state a model year and requires applicability confirmation
before publication. The requested 2026 scope and URL path do not resolve that
uncertainty. These drafts were not published.

The manual check covers the selected table rows above. It does not audit every
equipment claim or prove complete document coverage. Zero validation issues means
the stored checks found none; it is not an accuracy score.

At completion, AI lint, type checking, 262 unit tests, 22 benchmark tests,
11 data tests and the production AI build passed. These automated checks support
implementation behavior; the live comparison supplies the separate source-based
evidence described above.
