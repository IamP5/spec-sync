# AI credits: implementation design and cross-app contract

Written 2026-09-07 from [the proposal](research/ai-credits-proposal.md) and the
exploration of the three apps. This document is the binding contract between
`apps/api`, `apps/ai`, `apps/gateway` and `apps/web` for the first release of
the wallet. Change a name here only together with every consumer.

## Product decisions (settled)

- Every signed-in user receives one promotional grant of **R$ 10,00** the
  first time the wallet is touched. Existing users receive it as well: the
  grant is created on first contact, not on sign-up, and it is idempotent.
- No renewal, expiry, top-up or payment in this release.
- Charging is **actual usage at a published BRL rate card** (no margin), per
  model, versioned. Prices are stored in the API and revised prospectively.
- **Strict admission**: a run starts only when the available balance covers a
  minimum useful answer on the selected model. Otherwise the run is rejected
  before the first model call with a typed error; the UI offers a cheaper
  model when one fits. Models are never switched silently.
- **Stop the current chat when credits run out**: after every agent step the
  step's usage is charged; when the wallet becomes exhausted the agent loop
  stops after that step (no error, the streamed text stays), and the browser
  shows the exhausted state and blocks new messages.
- The chat agent's own model calls are charged to the user. Automatic thread
  titles and the curator ingestion workflow run on SpecSync's operating
  budget and are not charged. Model calls made by tools inside a chat run
  (content discovery, source discovery, source preview) are charged to the run
  when their usage is available; Google Search grounding fees are absorbed.
- Money is stored as **integer micro-reais** (`1 real = 1_000_000`). The grant
  is `10_000_000`. The UI formats with `Intl.NumberFormat('pt-BR', { style:
'currency', currency: 'BRL' })` and shows "less than R$ 0,01" for a positive
  balance below one cent.
- UI copy stays in English like the rest of the app; amounts are BRL.

## Architecture

```
browser ─(Bearer id token)─► gateway ─► ai   GET  /chat/credits          (verified user → wallet view)
                                        ai   POST /copilotkit           (run: admit, meter, stop)
ai ─(service key + Cloud Run ID token)─► api  /api/internal/ai-credits/** (wallet, holds, usage, tariffs)
api ─► PostgreSQL schema `credits` (Flyway V7)
```

- The **API owns the wallet** (ledger, holds, tariffs) in a new `credits`
  schema. All wallet endpoints are internal and callable only by the AI
  service, which is the single place that verifies the user's Firebase token
  today (`apps/ai/src/mastra/identity.ts`). Spring therefore needs no Firebase
  dependency; it trusts the `uid` in the path only after the service key
  matched. In the cloud the API additionally requires the Cloud Run invoker
  identity (already granted to the `ai` service account).
- The **AI service** admits, meters and stops runs and exposes the read model
  to the browser under `/chat/credits` (same pattern as `/chat/threads`).
- The **gateway** allows `GET /ai/chat/credits` and nothing else new.
- The **web** app adds the credits client, store, pill, popover, account-menu
  row and exhausted/insufficient states inside the existing `chat` domain
  (no new domain, no Sheriff/tsarch changes).

### Feature flag

Credits are **enabled when `SPECSYNC_CREDITS_SERVICE_KEY` is set** (≥ 32
characters) on both the API (`specsync.credits.service-key`) and the AI
service. When unset the AI service neither meters nor blocks, `/chat/credits`
answers `{ "enabled": false }`, and the web hides every credits element. When
enabled and the wallet API is unreachable, the AI service **fails closed** for
new runs with `CREDITS_UNAVAILABLE`.

## API contract (`apps/api`, internal)

Base path `/api/internal/ai-credits`. Auth: header
`Authorization: Bearer <SPECSYNC_CREDITS_SERVICE_KEY>` compared in constant
time, min length 32, granting `ROLE_AI_CREDITS` through a dedicated
`@Order(1)` `SecurityFilterChain` scoped to that path (mirror
`IngestionConfiguration`). Everything is JSON. Amounts are `long` micro-reais.
Errors are RFC 9457 `ProblemDetail`.

### `GET /wallets/{uid}`

Ensures the wallet and the signup grant exist (idempotent, safe under
concurrency: `INSERT ... ON CONFLICT DO NOTHING` on the wallet row and on the
ledger entry with `entry_key = 'grant:signup:' || uid`). Returns the wallet
view:

```json
{
  "uid": "abc",
  "currency": "BRL",
  "balance": 7320000,
  "available": 7320000,
  "granted": 10000000,
  "spent": 2680000,
  "exhausted": false,
  "models": [
    {
      "provider": "vertex",
      "modelId": "gemini-2.5-flash",
      "tariffVersion": 1,
      "inputPerMillion": 1500000,
      "cachedInputPerMillion": 375000,
      "outputPerMillion": 12500000,
      "minimumCharge": 18500,
      "affordable": true
    }
  ],
  "recentRuns": [
    {
      "runId": "…",
      "startedAt": "2026-09-07T12:00:00Z",
      "finishedAt": "…",
      "modelId": "gemini-2.5-flash",
      "status": "COMPLETED",
      "charge": 65000
    }
  ]
}
```

- `balance` = sum of ledger entries (grants positive, debits negative). It can
  go slightly negative after the exhausting step; the UI clamps to zero.
- `available` = `balance` minus the sum of open holds whose `expires_at` is in
  the future. `exhausted` = `available <= 0`.
- `models` lists every **active** tariff (one per provider+modelId, latest
  version). `minimumCharge` = price of `4_000` uncached input tokens + `1_000`
  output tokens on that tariff; `affordable` = `available >= minimumCharge`.
- `recentRuns`: last 20 runs, newest first.

### `GET /tariffs`

`{ "models": [ …same objects as above without affordable… ] }`. Used by the AI
service to hide unpriced models from `/chat/models`.

### `POST /wallets/{uid}/runs`

Body `{ "runId": "<uuid or AG-UI runId>", "provider": "vertex", "modelId": "gemini-2.5-flash", "threadId": "…" }`.

Admission, atomic on the wallet row (`SELECT … FOR UPDATE`):

1. Ensure wallet + grant (as above).
2. Resolve the active tariff; none → `422` problem `type` `…/unpriced-model`.
3. `available < minimumCharge` → **`402`** problem with
   `"code": "INSUFFICIENT_CREDITS"`, `"available"`, `"minimumCharge"`,
   `"cheaperModels": ["gemini-2.5-flash"]` (active tariffs whose minimum fits).
4. Insert `credits.run` (status `OPEN`) and a hold of
   `min(available, holdCap)` where `holdCap` = price of `30_000` input +
   `8_000` output tokens; `expires_at = now() + 10 minutes`.
5. Idempotent: an existing run with the same `runId` for the same uid returns
   the existing state with `201`→`200`.

Response `{ "runId", "hold": 65000, "balance", "available", "exhausted": false }`.

### `POST /wallets/{uid}/runs/{runId}/usage`

Body:

```json
{
  "stepKey": "step-1",
  "provider": "vertex",
  "modelId": "gemini-2.5-flash",
  "inputTokens": 5120,
  "cachedInputTokens": 0,
  "outputTokens": 640,
  "reasoningTokens": 200,
  "estimated": false
}
```

- Idempotent on `(run_id, step_key)`: a replay returns the stored charge.
- Charge = `(inputTokens − cachedInputTokens) × inputPerMillion / 1e6 +
cachedInputTokens × cachedInputPerMillion / 1e6 + outputTokens ×
outputPerMillion / 1e6`, computed in integer arithmetic with ceiling per
  term. `reasoningTokens` is stored for the record only: providers bill it
  inside `outputTokens`. Missing/unknown usage arrives with `estimated: true`
  and the token counts the AI service assumes (see below).
- Inserts a `DEBIT` ledger entry and a `credits.run_step`, lowers the run's
  hold by the charge (not below zero), stamps the run with the tariff version.
- Response `{ "charge": 6500, "balance", "available", "exhausted" }`.
- Unknown run → `404`; run already finished → `409`.

### `POST /wallets/{uid}/runs/{runId}/finish`

Body `{ "status": "COMPLETED" | "STOPPED" | "FAILED" | "EXHAUSTED" }`. Releases
the remaining hold, closes the run, returns the wallet view. Idempotent.

### Persistence (`V7__ai_credits.sql`, schema `credits`)

- `wallet(uid text PK, created_at)`.
- `ledger_entry(id uuid PK, uid FK, entry_key text UNIQUE, kind CHECK IN
('GRANT','DEBIT','REFUND','ADJUSTMENT'), amount bigint /* signed */,
run_id uuid NULL, description text, created_at)`; append-only (`BEFORE
UPDATE OR DELETE` trigger raising, like `V2`).
- `run(id uuid PK, uid FK, thread_id text, provider text, model_id text,
tariff_version int NULL, status CHECK IN ('OPEN','COMPLETED','STOPPED',
'FAILED','EXHAUSTED'), hold bigint NOT NULL DEFAULT 0, hold_expires_at
timestamptz, charge bigint NOT NULL DEFAULT 0, started_at, finished_at)`.
- `run_step(run_id FK, step_key text, provider, model_id, input_tokens,
cached_input_tokens, output_tokens, reasoning_tokens, estimated bool,
charge bigint, created_at, PRIMARY KEY (run_id, step_key))`.
- `model_tariff(id uuid PK, provider text, model_id text, version int,
input_per_million bigint, cached_input_per_million bigint, output_per_million
bigint, effective_from timestamptz, active bool, UNIQUE (provider, model_id,
version))`.
- Seed (rate card v1, R$ 5,00 per USD, standard ≤200K-context text prices
  published by Google on 2026-09-07):

  | provider | modelId                | input      | cached input | output     |
  | -------- | ---------------------- | ---------- | ------------ | ---------- |
  | vertex   | gemini-2.5-flash       | 1_500_000  | 375_000      | 12_500_000 |
  | vertex   | gemini-2.5-pro         | 6_250_000  | 1_562_500    | 50_000_000 |
  | vertex   | gemini-2.5-flash-lite  | 500_000    | 125_000      | 2_000_000  |
  | vertex   | gemini-3.1-flash-lite  | 1_250_000  | 312_500      | 7_500_000  |
  | vertex   | gemini-3.1-pro-preview | 10_000_000 | 2_500_000    | 60_000_000 |
  | vertex   | gemini-3.5-flash-lite  | 1_500_000  | 375_000      | 12_500_000 |
  | vertex   | gemini-3.5-flash       | 7_500_000  | 1_875_000    | 45_000_000 |
  | vertex   | gemini-3.6-flash       | 3_750_000  | 937_500      | 18_750_000 |
  | vertex   | gemini-3.7-flash       | 3_750_000  | 937_500      | 18_750_000 |
  | vertex   | gemini-3.8-flash       | 3_750_000  | 937_500      | 18_750_000 |
  | openai   | gpt-5.6-luna           | 1_000_000  | 100_000      | 6_000_000  |

  The OpenAI row uses the standard short-context tier verified on OpenAI's
  pricing page on 2026-09-07 (long contexts are priced higher there; add a
  second tariff before offering them). The Gemini 3.x rows come from the model
  list at https://openrouter.ai/google, read on 2026-09-07, at the product
  owner's direction. Two caveats belong to a later revision: OpenRouter
  publishes its own pass-through rates while this service calls Vertex AI
  directly, and other trackers quote a lower Vertex direct rate for
  gemini-3.5-flash-lite (USD 0.15 / 1.25). Cached input keeps Google's usual
  25% of input because OpenRouter lists no cache-read column. Batch variants
  are not seeded. A model without an active tariff is never offered, so
  `VERTEX_MODEL` and `VERTEX_MODELS` must name priced models once the flag is
  on.

Money in the domain: a `Money` value object (record over `long` micro-reais)
with `of(long)`, `plus`, `minus`, `isPositive`, `max`; no `BigDecimal` in
storage. Use `NamedParameterJdbcTemplate` with `FOR UPDATE` on the wallet row
for every mutation, matching `IngestionJdbcGateway`; `@Transactional` sits on
the gateway adapter (ArchUnit forbids it elsewhere).

Domain errors: `InsufficientCreditsException extends DomainException`
(mapped to `402` with the extra properties above), `UnpricedModelException`
(`422`, problem type `/problems/unpriced-model`), `CreditRunNotFoundException`
(`404`) and `CreditRunClosedException` (`409`). The credits security chain is
`@Order(0)` because the ingestion chain already holds `@Order(1)`. A usage
step naming a model without an active tariff is charged at the run's own
tariff.

## AI service contract (`apps/ai`)

Module `src/mastra/credits/`:

- `credits-client.ts`: typed fetch client for the API contract above. Origin
  `SPECSYNC_API_URL`, headers `authorization: Bearer <key>` +
  `cloudRunHeaders(origin)`; 10 s timeout; zod-parsed responses. `enabled()`
  is true when `SPECSYNC_CREDITS_SERVICE_KEY` has at least 32 characters. A
  `422` unpriced-model answer is treated as `CREDITS_UNAVAILABLE` (such a
  model is never offered). An empty `cheaperModels` list yields the sentence
  "No cheaper model fits your remaining credits."
- `credits-run.ts`: a per-request `CreditsRun` object created in the
  CopilotKit `setContext` hook (after identity) and stored in the request
  context under `CREDITS_RUN_KEY`. It carries `uid`, the AG-UI `runId` and
  `threadId` read from the request body (`requestedRun` already parses that
  envelope), and memoises: `admit(provider, modelId)` (idempotent per request;
  throws `Error('INSUFFICIENT_CREDITS: …')` / `Error('CREDITS_UNAVAILABLE: …')`
  with a human message after the code), `recordStep(stepKey, usage)`
  (idempotent per step key, marks `exhausted` from the API response),
  `finish(status)`.
- `spec-sync-agent.ts`: `model` resolver becomes async and calls
  `admit(...)` with the **resolved** provider/model before returning the
  model (Mastra 1.64 awaits it and calls it once per step; admission is
  memoised per request). `defaultOptions` adds `stopWhen`, `onStepFinish` and
  `onFinish` next to the existing `maxSteps: 10`. Verified on 2026-09-07:
  Mastra does **not** await `onStepFinish` (it runs detached after `stopWhen`
  was already asked), but it does await `stopWhen` once per step with every
  finished step's usage. The charge that decides exhaustion is therefore
  settled inside `stopWhen`; `onStepFinish` charges the last step (which
  `stopWhen` never sees), both under the same idempotent `step-<n>` key.
  `onFinish.usage` is the run aggregate, so `onFinish` charges only when no
  step was charged, then calls `finish('EXHAUSTED' | 'COMPLETED')`. The
  behaviour with credits disabled is unchanged.
- Usage normalisation (`usage.ts`): accept the AI SDK v6 / Mastra usage shapes
  (`inputTokens`, `outputTokens`, `totalTokens`, `reasoningTokens`,
  `cachedInputTokens`, and any nested details) and produce the flat body
  above. Missing usage → `estimated: true` with `inputTokens: 8_000`,
  `outputTokens: 2_000`, `cachedInputTokens: 0`.
- Tool sub-agents (`content-discovery-tool.ts`, `ingestion-tools.ts`'
  source discovery and `previewVehicleSource`): when the run's `CreditsRun` is
  present in the tool execution context's request context, record their
  `result.usage` under step keys `tool-<toolName>-<n>`.
- `credits-route.ts`: `GET /chat/credits` with `middleware:
requireVerifiedUser`; returns `{ "enabled": false }` when disabled,
  otherwise the API wallet view for the verified uid (unchanged JSON, plus
  `"enabled": true`).
- `chat-model-route.ts` / `models.ts`: when credits are enabled, the catalog
  filters out models without an active tariff (cache the tariff list for 60 s;
  on fetch failure keep the previous list or return the unfiltered list and
  log). `resolveChatModel` must expose the resolved `{ provider, id }` so the
  admission uses what actually runs, including the default fallback.
- Error message format on the AG-UI stream (pre-run rejection, thrown from
  the model resolver): `INSUFFICIENT_CREDITS: Your AI credits (R$ 0,12) do not
cover a reply on Gemini 2.5 Pro. Available cheaper models: Gemini 2.5
Flash.` and `CREDITS_UNAVAILABLE: The credits service is unavailable. Try
again in a moment.` The web parses the leading code token.

## Gateway contract (`apps/gateway`)

Allow `GET /ai/chat/credits` in the AI allowlist in `src/app.ts`; add the
allowed and denied rows (`POST`, `/ai/chat/creditsx`) to `src/app.spec.ts`.

## Web contract (`apps/web`, inside `domains/chat`)

- `data/credits.ts` (zod schema of the `/ai/chat/credits` response, `Money`
  helpers `formatBrl(micro)`, `CREDITS_URL = '/ai/chat/credits'`) and
  `data/credits-client.ts` (`httpResource`, guest → `undefined`, like
  `ThreadClient`).
- `feature-chat/chat-page/credits-detail-store.ts` (`withResource`,
  `withDevtools('credits')`, resets on `sessionEvents.invalidated`, `reload()`);
  `ChatCoordinator` triggers `reload()` after every run finishes, stops or
  fails, and exposes `credits` read signals to `ChatPage`.
- Dumb UI in `feature-chat/ui/`:
  - `credits-pill.ts`: composer pill next to the run options picker, shows
    `R$ 7,32` with a thin progress bar (used share), tooltip "AI credits";
    opens `credits-popover` (Zard popover) with: title "AI credits", amount
    left of `R$ 10,00`, progress bar, "Used R$ 2,68", model price list in BRL
    per 1M tokens (input / output), and the last 5 runs (model, charge).
  - `credits-usage-card.ts`: the same summary as a compact row for the
    account menu (shell) — exported through `chat/api/features`.
- `ChatPage` states:
  - `exhausted` (available ≤ 0): destructive `z-alert` above the composer,
    "Your AI credits are used up. You can keep reading your conversations."
    Textarea, send button and picker are disabled; the pill shows `R$ 0,00`.
    If the last run ended and the balance is now exhausted, prepend "The reply
    was stopped because your credits ran out."
  - `insufficient` (run rejected with `INSUFFICIENT_CREDITS`): alert with the
    server text, plus a "Switch to <cheaper model>" button that sets the model
    preference and retries. `CREDITS_UNAVAILABLE` → alert "The credits
    service is unavailable. Try again in a moment." with Try again.
  - Credits disabled (`enabled: false`) or resource error: no pill, no
    alerts, chat behaves as today.
- `ChatAgentError` gains an optional parsed `credits` code taken from the
  RUN_ERROR message prefix; `FakeChatAgent.failedRun` is reused in specs.
- Specs: store (grant, reload after run, exhausted), page (pill text, alerts,
  disabled composer, cheaper-model retry), client parsing, `formatBrl`.

## Infrastructure (`infra/environments/dev`)

Add `random_password.credits_service_key` (48 chars) stored in Secret Manager
as `specsync-dev-credits-service-key`, injected as `SPECSYNC_CREDITS_SERVICE_KEY`
into the `ai` service and `SPECSYNC_CREDITS_SERVICE_KEY` into the `api`
service (`application-cloud.properties` maps it to
`specsync.credits.service-key`). Local development: same variable in
`apps/ai/.env` and `apps/api/.env.local`.

## Acceptance checks

- One grant per uid under concurrent first requests (unique `entry_key`).
- Two runs racing for the last funds: the second is rejected or bounded by
  the hold.
- Replayed `usage` and `finish` calls do not double-charge.
- Zero available credit: `POST /copilotkit` rejects before any model call;
  `/chat/threads` and `/chat/models` still work.
- Unpriced model is not offered and is rejected if requested.
- Credits disabled: no behavioural change anywhere.
- Web: pill formatting (`R$ 7,32`, `less than R$ 0,01`), exhausted state,
  cheaper-model retry, reload after run.
