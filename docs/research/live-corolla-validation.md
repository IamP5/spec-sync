# Live Corolla research validation

Executed in Chrome against this worktree's local services on 2026-09-08
(America/Sao_Paulo). This used live model calls and the normal signed-in chat.
The starting catalog contained five Ranger, Frontier and Hilux configurations;
it contained no Corolla.

## Result

Research for Toyota Corolla XEi 2.0, Brazil, model year 2026 reached `REVIEW`.
Discovery selected Toyota's [official two-page brochure](https://media.toyota.com.br/5c3dfe71-fe07-4333-b5b2-f5fc72b717ad.pdf).
The cover explicitly states Corolla 2026. The source was also opened and visually
inspected in Chrome, independently of the model's transcription.

| Configuration        | Extracted claims | Claims with validation issues |
| -------------------- | ---------------: | ----------------------------: |
| Altis Hybrid Premium |               12 |                             0 |
| GLi HEV              |               10 |                             0 |
| Altis Premium        |               10 |                             0 |
| XEi                  |               11 |                             1 |
| Total                |               43 |                             1 |

The findings remain unreviewed. No catalog publication was performed. A lack of
validation issues is not a calibrated confidence score or proof of correctness.

## Browser and persistence checks

- Normal chat discovered the official document and called shared research
  directly, without first running a separate preview extraction.
- A second chat request for the same source displayed **Joined shared research**.
  PostgreSQL confirmed two private subscriptions and exactly one shared work.
  Both browser tabs ultimately displayed **Ready for review**, the same four
  configurations and source evidence. Both requests used the same signed-in
  account; cross-user isolation was not retested in this browser session.
- Reloading the first chat restored its conversation and running research.
  The history panel showed both saved requests.
- The GLi HEV extraction failed twice with missing structured model output.
  The existing queue recovered on attempt 3. The original capture,
  identification and other three configuration checkpoints retained their
  timestamps; only the missing configuration was recomputed.
- Work ran from `2026-09-09T01:56:38.919Z` to
  `2026-09-09T02:03:30.302Z`, about 6 minutes 51 seconds including retries.
- The browser exposed source revision hashes, reader version, evidence excerpts,
  line ranges, fuel/RPM qualifiers and the unresolved equipment issue.

Work ID: `7523e9b9-325e-4a1e-9de1-d4074acb7a20`.

Original PDF SHA-256:
`36d750d56e6babd1f5cb380719da1a40267a2d1bc7743c9daa4573e16c4aec52`.

Transcript SHA-256:
`738bf9530e80f98702af83cb6e23c4199ca7b4936540e18df016d4fb5688bce7`.

Reader: `specsync-visual-pdf-v3:google/gemini-3.8-flash`.

## Accuracy spot checks and remaining gaps

XEi findings matched the brochure on 175 cv at 6,600 rpm with ethanol,
21.3 kgf.m at 4,400 rpm with ethanol, 50 L fuel capacity, 4,630 mm length,
2,700 mm wheelbase, 1,780 mm width and 1,455 mm height. The API retained the
printed torque and normalized it to 208.881645 Nm. Width was correctly stored
with unspecified mirror scope. GLi HEV's extracted 43 L fuel capacity also
matched the brochure.

XEi adaptive cruise retained its source text but was flagged because equipment
availability was unresolved. It was not silently promoted to a standard feature.

The brochure also contains curb mass, trunk volume and towing capacity. These
attributes are absent from the current 21-attribute catalog contract, so they
were not extracted. GLi HEV omitted electric-motor output claims that the Altis
Hybrid Premium extraction did include. This is a coverage gap within the
existing power/torque attributes, separate from the missing attribute types.
Full specification coverage and model-to-model consistency still need evaluation.

## Hardening prompted by this test

The browser previously showed a terminal-sounding prior error during an active
retry. The result pane now distinguishes queued retries, active retry attempts
and terminal failures, and translates checkpoint keys into readable progress.
Source warnings and individual claim issues remain visible.

Extraction previously parsed an optional Mastra structured result as if it were
always present. The follow-up handling checks cancellation/deadlines and validates
the returned object explicitly, with bounded diagnostics for missing output.
It keeps the existing call limits, timeout and checkpoint retry policy.

The successful live run above completed through the pre-existing recovery path
before this extraction hardening. Regression tests cover the follow-up changes;
the paid research was not repeated merely to validate diagnostic handling.

## Regression verification

`VITEST_MAX_WORKERS=1 npm run verify -- --changed` passed after stopping the
development process for the Mastra production build. This included 244 web
tests, 65 web architecture checks, 226 AI tests, 22 benchmark tests, the API and
gateway checks, strict type checks and production builds. Existing unrelated
lint/build warnings remain. The new focused cases cover retry presentation,
missing extraction/repair results and cancellation/deadline precedence.
