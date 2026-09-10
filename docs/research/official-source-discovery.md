# Official source discovery

Vehicle research accepts a brand, model and requested Brazilian model year in
chat. The user does not need to know a manufacturer's document URL. Discovery
resolves an official source before the existing shared research job captures,
identifies and extracts it.

## Failure that motivated this change

The local conversation `2b69dd39-6c92-4943-97d3-ac9eb3ac45a0` requested a
comparison of the 2026 Ford F-150 and RAM, then allowed recent alternatives.
Ford discovery found official PDFs and model pages. Its PDF preview failed, and
an HTML preview did not establish the model year. RAM discovery returned empty
because the default approved hosts covered only Ford, Toyota and Nissan. The
assistant requested a RAM URL and curator input instead of starting shared
research. No shared research job was created by that conversation.

## Discovery and source access

The manufacturer registry now includes verified `ram.com.br` alongside the
existing Brazilian manufacturer domains. Known brand/model aliases resolve to a
canonical search scope, including Ford F150/F-150 and RAM Ram1500/1500. This is a
small explicit registry, not completed coverage of every manufacturer. Deployment
domain overrides remain authoritative; search cannot approve a new host.

Discovery checks bounded model paths and manufacturer sitemaps, reads candidate
pages, and follows their relevant specification links. Unusable sitemap entries
do not suppress fallback paths. Grounded search supplies another route when the
site paths do not yield a usable brochure. Partial source failures are retained
as warnings instead of becoming an unexplained empty result. Google citation
redirects have a bounded GET fallback when HEAD does not expose a redirect;
redirect targets are never fetched by the resolver.

PDF access probes use the same protected network path as capture and inspect GET
response headers without downloading or transcribing the PDF. Oversized PDFs are
ranked below accessible alternatives. The existing 5 MB capture limit remains.
Manufacturer HTML can contain useful specification data even when a brochure is
too large. RAM's model page also demonstrated why the HTML reader needs to retain
structured component content rather than only ordinary text nodes.

Every fetch retains the approved HTTPS host policy, public-address checks, pinned
DNS address and redirect validation. Finding a URL does not authorize another
domain. Executable page scripts are never evaluated by the deterministic reader.

## Research handoff and evidence

Ordinary requests, including “import into the catalog and compare,” start or join
`researchVehicleSpecifications` after discovery. They do not invoke curator
preview or ask for curator credentials. Discovery returns the canonical scope and
the original observed source URL. Shared document extraction still covers sibling
configurations within its existing bounds.

Source cards distinguish discovered candidates from verified facts. A year found
in a title or URL is a clue only. A successful access probe establishes neither
vehicle identity nor model-year applicability. The requested year is not silently
changed to match an older brochure. Document evidence and review must establish
applicability before publication.

Discovery still precedes the durable source-scoped join. Concurrent users can
repeat discovery itself, and alternate document URLs can create distinct work.
This change improves source resolution; it does not implement shared discovery,
cross-document entity resolution, calibrated confidence or automatic publication.

## Evaluation

Mocked discovery regressions exercise the actual discovery implementation with
controlled manufacturer pages and grounded results. They cover aliases, source
policy, linked documents, fallback behavior, access failures and unverified year
clues. UI regressions check warnings and applicability labels while preserving
legacy result rendering. These tests measure behavior under fixtures, not live
search recall or specification accuracy.

The extraction benchmark remains a separate evaluation: its inputs already
contain captured sources. A successful extraction score cannot establish that
discovery would find those sources. Live validation must begin with a vehicle-only
chat request and inspect the resulting discovery calls and shared research jobs.

## Live validation — 2026-09-09

Chrome conversation `16e302ca-f426-4ca5-ae0e-09e367830c23` began at
10:29:48 UTC with a vehicle-only request for all Brazilian 2026 Ford F150 and
RAM1500 configurations. Both catalog searches were empty. Discovery resolved
the canonical Ford/F-150 and RAM/1500 scopes and started shared research without
asking for document URLs or curator credentials. Ford inspected 11 pages with
three access failures and skipped grounded search; RAM inspected three pages
with one access failure and completed grounded search.

| Selected source                                                                                                                                      | Created → terminal (UTC) | Result                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| [RAM model HTML](https://www.ram.com.br/picapes/1500.html)                                                                                           | 10:30:28 → 10:32:15      | `REVIEW`, attempt 1, five checkpoints; three configurations, 42 claims, 12 validation issues     |
| [Ford technical PDF](https://www.ford.com.br/content/dam/Ford/website-assets/latam/br/nameplate/2026/f-150/overview/pdf/fbr-f-150-ficha-tecnica.pdf) | 10:30:28 → 10:36:32      | `FAILED`, three attempts, zero checkpoints; discovery succeeded but PDF capture failed           |
| [Ford comparison HTML](https://www.ford.com.br/picapes/f-150/compare-as-versoes/)                                                                    | 10:40:38 → 10:40:57      | `REVIEW`, attempt 1, five checkpoints; three configurations, nine claims, zero validation issues |

At 10:40:29 UTC, a test follow-up asked to continue Ford research through another official
source, again without providing a URL. The agent checked the failed request and
started the already discovered comparison page. The original failed PDF work
remained available. The conversation created three private requests and three
source-specific works in total; the fallback created no additional RAM work.

RAM's configuration claim/issue counts were 10/0, 16/6 and 16/6. Its year note
cited the embedded `versions-param-year: 2026` attribute. Ford's three comparison
configurations each had three claims and no validation issues, but its year note
was absent. The result explicitly warns that the source does not state a model
year and requires confirmation before publication. These are review drafts:
claim counts and zero validation issues do not establish factual accuracy,
complete specification coverage or Ford's applicability to 2026.

Both successful HTML captures retained parser version
`specsync-source-v2-embedded-html` and immutable provenance:

| Source          | Original SHA-256                                                   | Extracted text SHA-256                                             |
| --------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| RAM             | `ef2e2e262d73347ee59e1984e3586efa8eca75eaea3e8cc2aa9358425f59e949` | `fa3ac819c6c8e3b9aec3ed2d58ed26efe10d747687732c270e21259b23f6143a` |
| Ford comparison | `38227a622e13946b31dd19b4fe39ebc72d80e02effaadd12ae709e7769170286` | `686d3fc62968ec3ee77c01bb50992de2d64e30efa68f35ec0576c2555d842c31` |

The Ford fallback's private request is
`42822d17-7eb9-4cdb-bf32-0f22a692a9c1`, linked to work
`d836c41e-39dd-4bc8-a254-b6f35a091806`. The read-only validation checked stored
tool results, request/work records and checkpoint metadata; it did not publish
the drafts or run a specification accuracy evaluation.

The final `VITEST_MAX_WORKERS=1 npm run verify -- --changed` completed successfully,
including the affected applications' lint, type checks, architecture checks,
unit tests, benchmark regressions and production builds. The AI suite passed
253 tests and the web suite passed 248 tests. These automated checks complement
the live discovery test; they do not certify the extracted vehicle facts.

After verification, `npm run dev` restarted the local services. Web, API, Mastra
Studio and gateway returned HTTP 200 on their checked public endpoints. Reloading
the Chrome conversation preserved both completed HTML research drafts and the
failed Ford PDF request.

A subsequent reader fix successfully processed that same Ford PDF on its first
shared-work attempt, producing three configuration drafts and 45 claims. See
[Ford PDF validation](ford-pdf-validation.md) for the provider failure diagnosis,
the source-based table checks and the remaining catalog attribute coverage limits.
