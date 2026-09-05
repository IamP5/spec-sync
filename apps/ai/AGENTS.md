# SpecSync AI service (Mastra)

Node/TypeScript service built with [Mastra](https://mastra.ai) inside the Nx
workspace. It serves one chat agent backed by Gemini on Vertex AI and streams
replies to the Angular app. Paths below are relative to the workspace root.

## Layout

```
apps/ai/
  src/mastra/
    index.ts          # Mastra registry: agents, storage (dev only), logger
    models.ts         # Vertex AI provider (AI SDK) + the Gemini model
    agents/           # one file per agent (<name>-agent.ts)
    tools/            # tools shared by agents (<name>-tool.ts), empty for now
  .env.example        # GOOGLE_VERTEX_PROJECT / GOOGLE_VERTEX_LOCATION
  Dockerfile          # build with `nx build ai`, run .mastra/output on Cloud Run
  checks.mjs          # lint + typecheck (fast), test + build (full)
```

## Rules (red lines)

- Vertex AI is reached through `@ai-sdk/google-vertex` with Application
  Default Credentials. Never add API keys, service-account JSON files or a
  `GOOGLE_APPLICATION_CREDENTIALS` path to code, `.env` files or Terraform.
  Mastra has no `vertex/...` router string; pass the AI SDK model instance.
- The Cloud Run service is stateless. Attach storage or memory only for local
  development (guarded by `NODE_ENV !== 'production'` in `src/mastra/index.ts`)
  unless the user asks for persistent memory, which then goes to Cloud SQL via
  `@mastra/pg`.
- The HTTP surface is Mastra's own (`/api/agents/<id>/stream`, Server-Sent
  Events). The web app reaches it under the `/ai` prefix, which nginx and
  `apps/web/proxy.conf.json` strip. Register custom routes only through the
  Mastra `server` option, never a second HTTP server.
- Agent ids are part of the contract with `apps/web` (the chat page streams
  from the agent with id `chat`). Rename only together with the web client.
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
such as `us-central1` only serves the 2.5 family and answers 404 otherwise. `nx serve web`
proxies `/ai` to the same server, so the chat page and Studio share one
process. A stale ADC token shows up as `invalid_grant` in the stream; run the
login command again.

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
