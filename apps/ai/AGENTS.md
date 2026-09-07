<!-- BEGIN:mastra-agent-rules -->

# This is NOT the Mastra you know

Mastra evolves rapidly, so APIs, conventions, and recommended patterns may
differ from your training data. Invoke the `mastra` skill and consult the
relevant embedded documentation before writing any Mastra code. Heed
deprecation notices.

<!-- END:mastra-agent-rules -->

# SpecSync AI service (Mastra)

Node/TypeScript service built with [Mastra](https://mastra.ai) inside the Nx
workspace. It serves one chat agent backed by Gemini on Vertex AI and exposes
it to the Angular app over AG-UI through a CopilotKit runtime route. Paths
below are relative to the workspace root.

## Layout

```
apps/ai/
  src/mastra/
    index.ts          # Mastra registry: agents, storage, logger
    models.ts         # Vertex AI provider (AI SDK), the Gemini default, the chat model catalog
    memory.ts         # Cloud SQL storage (@mastra/pg) and the chat agent's Memory
    identity.ts       # verifies the gateway's x-specsync-token and derives the memory resource id
    chat-model-route.ts # GET /chat/models and the CopilotKit setContext hook for the picked model and effort
    threads/          # /chat/threads routes for the sidebar and the Mastra <-> AG-UI message converter
    agents/           # one file per agent (<name>-agent.ts)
    tools/            # server tools (<name>-tool.ts), vehicle catalog, graph retrieval, content discovery, ingestion
    skills/           # code-defined agent skills (createSkill), e.g. the ingestion procedure
    ingestion/        # vehicleIngestion workflow: capture, identification, extraction, worker routes, source discovery (site-index, linked-documents)
    graph/            # Neo4j retrieval and projection
  .env.example        # GOOGLE_VERTEX_* , GOOGLE_CLOUD_PROJECT, SPECSYNC_MEMORY_DATABASE_URL
  Dockerfile          # build with `nx build ai`, run .mastra/output on Cloud Run
  checks.mjs          # lint + typecheck (fast), test + build (full)
```

## Rules (red lines)

- Vertex AI is reached through `@ai-sdk/google-vertex` with Application
  Default Credentials. Never add API keys, service-account JSON files or a
  `GOOGLE_APPLICATION_CREDENTIALS` path to code, `.env` files or Terraform.
  Mastra has no `vertex/...` router string; pass the AI SDK model instance.
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
  `/copilotkit`, the model catalog route `/chat/models` and the `model` and
  `effort` properties (`chat-model-route.ts`), the thread routes under
  `/chat/threads` (`threads/routes.ts`), vehicle tool names in
  `tools/vehicle-tools.ts`, ingestion tool names in `tools/ingestion-tools.ts`
  and the client tool `startVehicleIngestion` the agent instructions and skill
  refer to. The web client renders server tool results directly. Change names
  only together with the client.
- The chat agent's `model` is resolved per run (`chatModelFor` in
  `models.ts`): the browser sends the picked model id as a CopilotKit property
  (AG-UI `forwardedProps.model`), `setChatModelContext` stores it in the
  request context and the agent resolves it against `chatModels()`. Gemini ids
  run on the Vertex provider instance (ADC, see above); OpenAI ids run through
  Mastra's model router (`openai/<id>`, key from `OPENAI_API_KEY`) and are only
  offered while that variable is set. Unknown ids fall back to `VERTEX_MODEL`.
  The agent's `defaultOptions` are resolved the same way: the picked
  reasoning effort (`forwardedProps.effort`, `auto`/`low`/`medium`/`high`
  from `chatEfforts()`) becomes a Gemini thinking level (3.x) or thinking
  budget (2.5) or an OpenAI `reasoningEffort` (`chatProviderOptionsFor`);
  Gemini thought summaries stay on regardless.
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
`VERTEX_MODELS` lists the Gemini models offered in the chat's selector and
`OPENAI_MODELS` the OpenAI ones (see `.env.example`). `nx serve web`
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
