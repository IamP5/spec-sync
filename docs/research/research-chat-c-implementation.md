# C research journal and drawers

Decision: use prototype C's journal embedded in the real chat, with Zard drawers
for evidence and voluntary community profiles. Keep prominent stage numbers,
version selection, and model headings without the boxed B workspace.

The throwaway UI is archived as a primary design source on
`codex/research-chat-prototype-archive`, commit
`cda922fd2bd57b2fb7cdf6534d7a9362b7744464`. That branch retains the prototype
files and their host integration for reference. The production host no longer
loads variants or fictional profiles. No implementation issue was supplied;
this document is the local context pointer.

## Live data and boundaries

The existing CopilotKit renderers recover the private research request ID from a
completed AG-UI tool result. ResearchDetailStore independently reads and polls
the authenticated durable research endpoint. Opening drawers does not invoke a
model, launch extraction, or restart shared work. Version selection survives
snapshot refreshes; source findings preserve competing claims, conditions,
unmapped observations and review warnings. Reliability is explicitly uncalibrated.

Evidence uses the same snapshot as the journal. Selecting a specification filters
the drawer to its version and attribute, opens the source excerpt, and retains a
way to show every source finding. Desktop uses the right drawer; screens below
768px use the bottom drawer. Zard owns focus, Escape, modal scrolling and restoration.

People are fetched only while the people drawer is open. Closing it aborts reads;
session invalidation clears the views and aborts pending requests. Separate
interest list and profile mutation stores exchange confirmed results through a
scoped event, without re-querying the model. Names and contact links never enter
the chat transcript or model context.

## Voluntary participation

Migration V13 adds `research.interest_profile`, keyed by research scope and user.
Private followers are never listed automatically. A user must supply a display
name, HTTPS contact URL, and explicit consent before sharing. They may update or
remove only their own profile. The same scope preserves participation across
source reinterpretations; this is not a global brand/model directory.

Browser GET/POST `/ai/chat/research/:id/interests` are allowlisted by the gateway,
verified by Mastra and forwarded to the private Java API with the verified owner.
Java checks ownership before reading or modifying a scope. Profiles are bounded
to 100 per response with a truncation indicator; the viewer's own profile is
returned independently. Links open externally with noreferrer/noopener, and the
application never sends a message or fetches the contact URL.

## Validation

- Web: 269 unit tests; lint; 65 architecture checks; production build.
- AI and gateway: unit tests, lint and strict type checks.
- Java: 155 tests including ArchUnit; Spotless.
- Docker PostgreSQL: research integration suite including private default,
  explicit consent, cross-user visibility, ownership isolation, invalid links,
  update idempotence and profile removal. The suite uses an isolated database.
- Chrome extension: persisted F-150 results in the existing chat, 56 mapped
  findings and three trims; direct power evidence; desktop side drawer and 390px
  mobile bottom drawer; version selection; opt-in form, persistence and removal
  of a temporary local profile. No new LLM research was needed for UI validation.

Development services remain available at web 4200, gateway 3000, API 8080 and
Mastra 4111. Migration V13 was applied to the local Docker database on API startup.
Production web build still reports the existing CopilotKit/CommonJS dependency
warnings. The Mastra production bundle was not run over the active dev output;
its source was checked through TypeScript, lint and tests.
