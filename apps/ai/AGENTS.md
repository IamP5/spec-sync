<!-- BEGIN:mastra-agent-rules -->

# This is NOT the Mastra you know

Mastra evolves rapidly, so APIs, conventions, and recommended patterns may
differ from your training data. Invoke the `mastra` skill and consult the
relevant embedded documentation before writing any Mastra code. Heed
deprecation notices.

<!-- END:mastra-agent-rules -->

# SpecSync AI service (Mastra)

Node/TypeScript service built with [Mastra](https://mastra.ai) inside the Nx
workspace. It serves one chat agent routed through OpenRouter — Vertex AI is
kept only for Google Search grounding — and exposes it to the Angular app over
AG-UI through a CopilotKit runtime route. Paths below are relative to the
workspace root.

## Layout

```
apps/ai/
  src/mastra/
    index.ts          # Mastra registry: agents, storage, logger
    models.ts         # role registry: roles, modes, the auto heuristic, the OpenRouter router strings and the Vertex provider
    memory.ts         # Cloud SQL storage (@mastra/pg) and the chat agent's Memory
    identity.ts       # verifies the gateway's x-specsync-token and derives the memory resource id
    chat-model-route.ts # GET /chat/models (modes, roles, models, efforts) and the CopilotKit setContext hook
    threads/          # /chat/threads routes for the sidebar and the Mastra <-> AG-UI message converter
    credits/          # AI credits: wallet client, per-run admission and metering, GET /chat/credits
    agents/           # one file per agent (<name>-agent.ts)
    tools/            # server tools (<name>-tool.ts), vehicle catalog, graph retrieval, content discovery, ingestion
    skills/           # code-defined agent skills (createSkill), e.g. the ingestion procedure
    ingestion/        # vehicleIngestion workflow: capture, identification, extraction, worker routes, source discovery (site-index, linked-documents)
    graph/            # Neo4j retrieval and projection
  .env.example        # OPENROUTER_API_KEY, GOOGLE_VERTEX_*, GOOGLE_CLOUD_PROJECT, SPECSYNC_MEMORY_DATABASE_URL
  Dockerfile          # build with `nx build ai`, run .mastra/output on Cloud Run
  checks.mjs          # lint + typecheck (fast), test + build (full)
```

## Rules (red lines)

- Before changing user-facing tools, agent tool-selection instructions or
  AG-UI/A2UI result contracts, read the workspace-root
  `docs/adr/0001-agentic-ui-contracts.md`.

- Every model call goes through OpenRouter (`openrouter/<vendor>/<model>`,
  key from `OPENROUTER_API_KEY`) **except Google Search grounding**, which
  stays on Vertex AI because `vertex.tools.googleSearch({})` has no OpenRouter
  equivalent. That exception is deliberate and temporary; when grounding can
  be routed the Vertex provider leaves the codebase entirely. Model ids are
  the full OpenRouter path everywhere: tariffs, request context, preferences,
  UI.
- Vertex AI is reached through `@ai-sdk/google-vertex` with Application
  Default Credentials. Never add API keys, service-account JSON files or a
  `GOOGLE_APPLICATION_CREDENTIALS` path to code, `.env` files or Terraform.
  Mastra has no `vertex/...` router string; pass the AI SDK model instance.
  `OPENROUTER_API_KEY` is a normal secret: Secret Manager in the cloud,
  `apps/ai/.env` locally, never committed.
- The service persists chat memory to Cloud SQL by decision of 2026-09-07:
  Mastra owns the threads and messages of every signed-in user through
  `@mastra/memory` and `@mastra/pg`, in the `mastra` schema
  (`SPECSYNC_MEMORY_DATABASE_URL`, see `src/mastra/memory.ts`). Everything else
  stays stateless: no in-memory or on-disk state, any instance serves any run,
  scale to zero is unchanged. Without that variable a LibSQL file serves local
  development. Never add another persistent store without asking.
- Identity comes from the token, never from the network. `src/mastra/identity.ts`
  verifies the `x-specsync-token` the gateway forwards with `firebase-admin`
  and derives the memory resource id `user:<uid>` from it; the base64
  `x-specsync-user` header is display context only. The CopilotKit route and
  every `/chat/threads` route fail closed on an unverified run, and each thread
  route filters by the verified resource id server-side. Mastra's own
  `/api/memory` routes are never exposed; the gateway forwards only the browser
  contract.
- The HTTP surface is Mastra's own API, the `/chat/threads` routes and one
  CopilotKit runtime route, `/copilotkit` (`registerCopilotKit` from `@ag-ui/mastra/copilotkit`,
  registered through the Mastra `server.apiRoutes` option). It speaks AG-UI:
  every Mastra agent is wrapped by `@ag-ui/mastra`, which streams text, tool
  calls and tool results as AG-UI events and hands the frontend tools the
  browser advertises to the agent as client tools. The web app reaches it as
  `/ai/copilotkit`; nginx and `apps/web/proxy.conf.json` strip the `/ai`
  prefix. Register custom routes only through the Mastra `server` option,
  never a second HTTP server.
- Names are part of the contract with `apps/web`: agent id `chat`, route
  `/copilotkit`, the catalog route `/chat/models` and the `mode`,
  `roleModels`, `effort` and `locale` properties — plus `model`, kept for one release
  (`chat-model-route.ts`), the thread routes under
  `/chat/threads` (`threads/routes.ts`), the credits route `/chat/credits`
  (`credits/credits-route.ts`) and its error message format, vehicle tool names in
  `tools/vehicle-tools.ts`, ingestion tool names in `tools/ingestion-tools.ts`
  and the client tool `startVehicleIngestion` the agent instructions and skill
  refer to. The web client renders server tool results directly. Change names
  only together with the client.
- `models.ts` is the single role registry (see
  `docs/openrouter-model-routing.md`). Eight roles — `chat`, `discovery`,
  `vision`, `identification`, `contentDiscovery`, `extraction`, `title`,
  `router` — each resolve through `modelForRole(role, requestContext)`.
  `discovery` returns the Vertex provider instance; every other role returns
  an `openrouter/<id>` router string. A role resolved **without** a request
  context falls back to its default, which is what keeps the curator ingestion
  workflow and the thread titles on SpecSync's own budget rather than on a
  user's mode. A sub-agent therefore only follows the user's mode when its
  caller passes `requestContext` into `generate()`.
- The browser picks a **mode**, not a model: `velocity` / `normal` /
  `intelligent` / `auto`, sent as the CopilotKit property
  (AG-UI `forwardedProps`) `mode`, with optional per-role overrides in
  `roleModels`. `setChatModelContext` stores both in the request context.
  `auto` is resolved by a heuristic there — before admission — and pinned, so
  every role of the run agrees on one decision. The older `model` property is
  accepted for one release as a synonym for `roleModels.chat`. An override is
  ignored (never fatal) when it names a model outside `SPECSYNC_CHAT_MODELS`,
  one that cannot do the role's job, or one the wallet cannot price.
- The browser also sends the language its interface runs in
  (`forwardedProps.locale`, a BCP 47 tag). `setChatModelContext` stores it and
  the agent's instructions name that language, so a Portuguese interface gets a
  Portuguese answer whatever language the user types in. A tag `language.ts`
  does not know is ignored and the agent follows the conversation instead;
  adding a locale to the web app means adding it there too.
- The picked reasoning effort (`forwardedProps.effort`,
  `auto`/`low`/`medium`/`high` from `chatEfforts()`) becomes a Gemini thinking
  level (3.x) or thinking budget (2.5) or an OpenAI/Anthropic
  `reasoningEffort` (`chatProviderOptionsFor`); Gemini thought summaries stay
  on regardless. Mastra 1.64's OpenRouter model forwards only
  `providerOptions.openrouter` to the wire, so the same effort is emitted
  there as OpenRouter's own `reasoning` field as well — dropping that key
  silently disables reasoning control on every routed model.
- AI credits are on exactly while `SPECSYNC_CREDITS_SERVICE_KEY` (>= 32
  characters) is set; with it unset nothing in `src/mastra/credits/` runs and
  the chat behaves as before. When it is set the module **fails closed**: a run
  is admitted against the wallet the API owns before the first model call, and
  an unreachable wallet rejects the run rather than letting it run for free.
  The rejection is thrown from the agent's `model` resolver, the only point
  Mastra propagates unwrapped to the browser (`INSUFFICIENT_CREDITS: …` /
  `CREDITS_UNAVAILABLE: …`, parsed by apps/web). Each agent step is charged from
  `stopWhen`, the one hook Mastra 1.64 awaits between steps, and the loop stops
  after the step that exhausts the wallet — no error, the streamed text stays.
  Charged: the chat agent's own steps and the model calls of
  `discoverVehicleContent`, `discoverVehicleSpecificationSources` and
  `previewVehicleSource` — each at the tariff of **its own role**
  (`recordToolUsage` takes the role), so a PDF preview is priced as `vision`
  and grounding as the Vertex `discovery` model, not as the chat model. Not charged: thread titles, the curator ingestion
  workflow and Google Search grounding fees. A failed settlement is logged and
  swallowed; it must never abort a generation or repeat a step. The AI service
  stores no wallet state: the API owns the ledger.
- Keep `zod` on the same line as the workspace root (currently 3.25.x, the
  line `@ag-ui/mastra` and `@copilotkit/runtime` use). Two zod copies in one
  process break Mastra's OpenAPI generation at startup
  (`Non-representable type encountered: optional`).
- `@copilotkit/runtime` is listed in `bundler.externals`: `mastra build`
  installs it into the output's node_modules instead of bundling it.
- Secrets and configuration come from the environment. Locally they live in
  `apps/ai/.env` (git-ignored); in the cloud Terraform sets them on the
  Cloud Run service (`infra/environments/dev/main.tf`).

## Local development

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project <gcp-project-id>
cp apps/ai/.env.example apps/ai/.env   # then set the project id
npm exec -- nx dev ai                  # Studio + API on http://localhost:4111
```

The user account needs `roles/aiplatform.user` on the project. Keep
`GOOGLE_VERTEX_LOCATION=global` for Gemini 3.x models; a regional location
such as `us-central1` only serves the 2.5 family and answers 404 otherwise.
`OPENROUTER_API_KEY` is needed for every role but `discovery`; without it only
grounding and the catalog route work. `SPECSYNC_CHAT_MODELS` lists the models
the advanced per-role selector may offer (see `.env.example`). `nx serve web`
proxies `/ai` to the same server, so the chat page and Studio share one
process. The chat routes need a verified token, so a run only works through
the gateway; `docker compose up postgres` plus
`SPECSYNC_MEMORY_DATABASE_URL` gives the same Cloud SQL layout locally.
A stale ADC token shows up as `invalid_grant` in the stream; run the
login command again. Mastra allows one dev server per directory (lock in
`.mastra/dev.lock`); a stale one has to be stopped before `mastra dev` or
`mastra build` run again.

To probe the runtime route without the browser:

```bash
curl -s -X POST localhost:4111/copilotkit -H 'content-type: application/json' -d '{"method":"info"}'
```

## Checks

- Lint: `npm exec -- nx run ai:lint`; type check: `npm exec -- nx run ai:typecheck`
- Unit tests: `npm exec -- nx run ai:test` (Vitest; the Vertex env vars are
  stubbed in `vitest.config.mts`, no credentials needed)
- Bundle: `npm exec -- nx run ai:build` (writes `apps/ai/.mastra/output`)
- Everything: `npm run verify`
- The checks are declared in `apps/ai/checks.mjs`. The agent Stop hooks and
  the pre-commit hook run the fast ones whenever files under `apps/ai`
  changed. Fix the code; never weaken a rule to make a check pass.

## Deployment

`nx run ai:deploy` (`tools/deploy/ai.sh`) builds `apps/ai/Dockerfile` from the
workspace root, pushes `ai:<sha>` to Artifact Registry and swaps the image of
the `specsync-<env>-ai` Cloud Run service. Terraform owns the service, its
service account (`roles/aiplatform.user`) and the `GOOGLE_VERTEX_*` variables.
The Deploy workflow runs it when Nx reports `ai` as affected.
