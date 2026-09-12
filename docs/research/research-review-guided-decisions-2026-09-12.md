# Research review as guided decisions inside the chat

Date: 2026-09-12. Decision: option C of the research → review prototype, the
second iteration (several configurations of one research, many
specifications), chosen by the user. This record supersedes the prototype
notes' "no variant has been approved" and their provisional A+B
recommendation; the prototype itself stays on the local branch
`codex/prototype-research-review` and is not part of the application.

## What ships

One research has one surface in a conversation: the card the real
`researchVehicleSpecifications` (or replay) call mounted. It follows the
research from capture to publication on its own (`VehicleResearchDetail`
polls the snapshot). When the draft is ready the journal header stays where
it is and a review strip appears under it with the counts that matter:
pre-approved, pending, published. Opening it condenses the journal to its
header and shows the guided review (`VehicleIngestionReviewDetail` in
`feature-ingestion`): configuration selector, identity confirmation, a
decision queue and one decision at a time with the candidates, their evidence
lines and the accepted catalog value beside them.

Pre-approval (`review-decisions.ts`): an attribute with exactly one evidenced
candidate that adds or changes catalog knowledge is selected from the start.
The reviewer decides only source conflicts (several evidenced candidates, one
must be chosen) and acknowledges unverified evidence (no candidate whose cited
lines support its value; the API refuses it anyway). Values already in the
catalog have nothing to publish. Unmapped observations stay in the evidence
drawer, outside publication.

Publication is partial: the API keeps every review a run published
(`ingestion.run.decisions`, migration V16) and refuses a second decision on an
attribute a configuration already published from the same draft
(`Ingestion.requireUnpublished`). A repeated identical request is a no-op.
The rest of the draft stays reviewable on the same surface; choices the
reviewer already made survive the revision their own publication creates
(`carryOverDecisions`), and a new draft hash drops them all.

Reasons: the review keeps one required reason; a configuration may add its
own (`ConfigurationReview.reason`, optional, ≤ 2000 characters), which the
API records on that configuration's selection decisions and identity note
instead of the review reason. Nothing is concatenated.

Completion delivery: `research-updates.ts` persists a plain assistant message
with typed `research-ready` metadata instead of a synthetic
`reviewVehicleResearch` invocation, so nothing invented replays to the model.
The transcript policy keeps the first surface per request id and turns later
calls into a note with a "Go to the research" action.

## Deviations from the mock, and why

- The mock asked for a reason per configuration and no review-level reason.
  The API keeps the review reason required and the configuration reason
  optional: the audit already records one reason per selection decision, and
  a reviewer publishing six configurations at once should not write six
  justifications for one decision.
- The mock reset on reload; so does the application. Durability of unsent
  choices across reloads was not requested and no new persistence was added.
  What is recovered after reopening is the authoritative state: the research,
  its draft and what was published.
- A typed review intent from the agent (`reviewVehicleResearch` while a
  surface exists) does not open the decisions remotely; it becomes a note
  pointing at the surface. Cross-card intent would need a chat-owned contract
  that was not designed here.
- The curator page (`VehicleIngestionRunDetail`) keeps its table review and
  no longer serves chat research.

## Verification

- API: ArchUnit, Spotless and the unit suite (domain invariants for the
  configuration reason and the republication rule). The JDBC publication
  path has no automated integration coverage in this repository; it was
  reviewed by reading, not executed against PostgreSQL here.
- AI: lint, strict type check, unit tests (delivery once per work, legacy
  messages recognised, the review route forwarding a configuration reason).
- Web: lint, tsarch, translation completeness, the unit suite including the
  pure decision model, the guided component (pre-approval, conflicts,
  acknowledgement, per-configuration identity and reason, partial
  publication, carry-over) and the transcript policy.
- Not verified here: real-model tool choice, a browser session publishing to
  a live catalog, reconnection while the tab is closed, and screen-reader
  behaviour beyond the ARIA roles and live regions the templates declare.
