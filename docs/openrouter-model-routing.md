# OpenRouter model routing, chat modes and AI Credits: cross-app contract

Written 2026-09-07. This document is the binding contract between `apps/ai`,
`apps/api`, `apps/gateway` and `apps/web` for the second release of the
credits feature. It supersedes the parts of
[`ai-credits-implementation.md`](ai-credits-implementation.md) it names; every
other rule there still holds. Change a name here only together with every
consumer.

Three things change at once, and they change together on purpose: the money
unit becomes a credit unit, the provider becomes OpenRouter, and the model
selector becomes a mode selector.

## Product decisions (settled)

### 1. OpenRouter is the model router

Every model call goes through OpenRouter **except Google Search grounding**,
which stays on Vertex AI with Application Default Credentials because
`vertex.tools.googleSearch({})` has no OpenRouter equivalent. This is a
deliberate, temporary exception; when grounding can be served through
OpenRouter the Vertex provider leaves the codebase entirely.

Mastra 1.64 already knows OpenRouter: `provider-registry.json` lists it with
358 models, `apiKeyEnvVar: OPENROUTER_API_KEY` and router strings of the form
`openrouter/<vendor>/<model>` (verified 2026-09-07 against
`node_modules/@mastra/core/dist/provider-registry.json`). No new dependency is
required. `@openrouter/ai-sdk-provider` is **not** added in this release.

Model ids are the full OpenRouter path — `google/gemini-3.5-flash`,
`anthropic/claude-sonnet-5` — everywhere: in the tariff table, in the request
context, in preferences, in the UI. The `provider` column becomes
`"openrouter"` for every routed model and stays `"vertex"` for grounding.

### 2. The unit is AI Credits, not reais

**1 credit = USD 0.01**, so 10,000 credits = USD 100. Money disappears from
the product surface: the UI shows credits and never a currency amount.

Storage keeps the same integer columns with a new meaning: **micro-credits**,
`1 credit = 1_000_000` micro-credits. One micro-credit is USD 1e-8, which
keeps the same headroom the micro-real unit had.

Conversion from the existing rate card is exact: the old seed used
R$ 5,00/USD, so `micro-credits = micro-reais × 20`.

The signup grant is **500 credits** (`500_000_000` micro-credits), USD 5,00 per
user. That is more than the previous R$ 10,00 grant was worth; the product
owner chose the rounder, more generous number on 2026-09-07 so a user has room
to try Intelligent. It is one constant (`Credits.SIGNUP_GRANT`).

### 3. Modes, not models

The composer offers four modes. A mode is a **map from role to model**, owned
by the AI service so it can be retuned without a web release.

| Mode               | `chat`                         | `vision`                        | `identification`               |
| ------------------ | ------------------------------ | ------------------------------- | ------------------------------ |
| `velocity`         | `google/gemini-3.5-flash-lite` | `google/gemini-3.5-flash-lite`  | `google/gemini-3.5-flash-lite` |
| `normal` (default) | `google/gemini-3.8-flash`      | `google/gemini-3.8-flash`       | `google/gemini-3.8-flash`      |
| `intelligent`      | `anthropic/claude-sonnet-5`    | `google/gemini-3.1-pro-preview` | `google/gemini-3.8-flash`      |
| `auto`             | routed per prompt, see below   | follows the routed mode         | follows the routed mode        |

`vision` stays on Gemini in every mode. PDF transcription is a tuned
structured-output prompt validated by `validateTranscript`; changing its model
is the highest-risk swap in this refactor and needs its own eval set first.
Intelligent buys a better reasoner, not a different transcriber.

Normal runs on `gemini-3.8-flash` rather than `gemini-3.5-flash` deliberately.
OpenRouter prices 3.5 Flash at USD 1.50 / 9.00 per million — close to frontier
rates — which made Intelligent only 1.2× Normal and gave the cost signal
nothing to show. The 3.8 Flash tier (USD 0.75 / 3.75, verified live on
2026-09-07) spreads the ladder to roughly 0.5× / 1× / 2.7×.

If a mode's model has no active tariff, that mode is **not offered** (same
rule that already hides unpriced models). `normal` must always be offerable;
if its model is unpriced the service falls back to the cheapest priced model
and logs.

### 4. Modes must show their cost impact

Every mode carries a **cost estimate in credits for a reference turn** of
8,000 uncached input + 1,500 output tokens on that mode's `chat` model,
computed from the live tariffs, plus its multiplier against `normal`. The
picker shows both on every mode row.

Switching to a mode that leaves fewer than 20 reference turns of balance asks
for confirmation first. The trigger is **affordability alone** — an earlier
draft also required the mode to cost more than 3× Normal, which on the real
rate card never fires, because Intelligent is 2.7× Normal. Users must never
discover the cost of Intelligent by running out.

### 5. Thread titles run on `openai/gpt-5.6-luna`

Replacing `VERTEX_TITLE_MODEL`. Titles stay on SpecSync's operating budget and
are not charged to the user.

## Roles

One registry replaces the six independent model choices in `apps/ai` today.

| Role               | Who calls it                       | Provider         | Mode-driven               | Charged to the user           |
| ------------------ | ---------------------------------- | ---------------- | ------------------------- | ----------------------------- |
| `chat`             | `spec-sync-agent`                  | OpenRouter       | yes                       | yes                           |
| `discovery`        | `ingestion-tools` source discovery | **Vertex (ADC)** | no                        | yes, at its own Vertex tariff |
| `vision`           | `pdf-transcription`                | OpenRouter       | yes                       | yes                           |
| `identification`   | `ingestion/identification`         | OpenRouter       | yes                       | yes                           |
| `contentDiscovery` | `content-discovery-tool`           | OpenRouter       | follows `chat`            | yes                           |
| `extraction`       | curator ingestion workflow         | OpenRouter       | **no** — operator setting | no                            |
| `title`            | `memory.ts` `generateTitle`        | OpenRouter       | no                        | no                            |
| `router`           | auto-mode classifier (later)       | OpenRouter       | no                        | yes                           |

`extraction` and `title` are deliberately outside the mode table. A user
picking Velocity must not degrade the curator's extraction, and a user picking
Intelligent must not spend SpecSync's own budget on a premium model for work
they are not paying for. `extraction` is configured by
`SPECSYNC_EXTRACTION_MODEL` (default `google/gemini-3.8-flash`).

Role resolution flows through `requestContext` exactly the way `chatModelFor`
does today, so a run's role assignment is decided once and pinned for the
whole run.

### Auto mode

Heuristic only in this release; no classifier model call. The decision is made
**once, before admission**, from the first user message of the run and the
thread state, and pinned into the request context:

- `intelligent` when the prompt is longer than 1,200 characters, or asks for a
  comparison across more than two vehicles, or the previous turn in the thread
  ended in a tool error.
- `velocity` when the prompt is shorter than 120 characters and the thread has
  made no ingestion tool call.
- `normal` otherwise.

The resolved mode reaches the browser through **the wallet, not the catalog**.
`GET /chat/models` is unauthenticated and shared between users, so a per-run,
per-user value cannot ride on it — its `resolvedMode` field is always `null`.
The wallet view is user-scoped and already refetched after every run, and each
recent run records the model it was charged at; the browser maps that model
back to the mode that names it (`modeOfRunModel` in `data/chat-model.ts`) and
the pill reads `Auto · Normal`. No new endpoint and no new AG-UI event.

A classifier-backed router is a later change and must fail closed to `normal`
when the wallet cannot cover its own call.

### Advanced configuration

Per-role overrides, stored next to the mode in the existing browser
preferences (`specsync.chat.preferences.v1`, `UserPreferencesClient`). A role
with no override follows the mode. Only the four billable, mode-driven roles
are user-configurable; `extraction`, `title` and `discovery` are not.

Overrides are filtered by capability: `vision` only offers models whose
`attachment` capability is true and `identification` only models with
`structuredOutput`, both read from
`node_modules/@mastra/core/dist/capabilities/openrouter.json`. An override
naming an unpriced or incapable model is ignored, and the role falls back to
the mode's model.

## AI service contract (`apps/ai`)

### `src/mastra/models.ts` → role registry

Replaces `VERTEX_MODEL`, `VERTEX_MODELS`, `OPENAI_MODELS`,
`VERTEX_TITLE_MODEL` and the module-level `export const gemini`.

```ts
export type ModelRole =
  | 'chat'
  | 'discovery'
  | 'vision'
  | 'identification'
  | 'contentDiscovery'
  | 'extraction'
  | 'title'
  | 'router';
export type ChatMode = 'velocity' | 'normal' | 'intelligent' | 'auto';

/** The model a role runs on for this request, as a Mastra router string. */
export function modelForRole(
  role: ModelRole,
  requestContext?: RequestContext,
): LanguageModel;

/** Provider and id the role actually resolves to; what the wallet is charged against. */
export function resolvedModelForRole(
  role: ModelRole,
  requestContext?: RequestContext,
): { provider: 'openrouter' | 'vertex'; id: string };
```

`discovery` always returns the Vertex provider instance and keeps
`vertex.tools.googleSearch({})` working unchanged. Its model is fixed at
`gemini-2.5-flash` (`SPECSYNC_DISCOVERY_MODEL` overrides it) and it is charged
under `provider = 'vertex'` with that bare model id, which therefore **needs
its own active tariff row**. Without one the usage step would silently fall
back to the run's chat tariff — the wrong price, quietly. Grounding _fees_
(Google's per-query search charge) stay absorbed as before; only the model
tokens are charged. Every other role returns
`` `openrouter/${id}` ``.

Called without a request context — the curator workflow, thread titles — a
role resolves to its default, never to a user's mode. That is what keeps the
operating budget separate.

`SPECSYNC_CHAT_MODELS` (comma-separated OpenRouter ids) lists the models the
advanced selector may offer; it defaults to the union of the models named in
the mode table.

Reasoning effort keeps its current contract (`auto` / `low` / `medium` /
`high`) but maps per vendor: `thinkingLevel` for `google/gemini-3*`,
`thinkingBudget` for `google/gemini-2.5*`, `reasoningEffort` for
`openai/*` and `anthropic/*`.

**An OpenRouter-routed model additionally needs
`providerOptions.openrouter.reasoning`.** An earlier draft of this document
said OpenRouter passes provider options through under the vendor's own key;
that was verified false on 2026-09-07 against Mastra 1.64, whose vendored
OpenRouter model reads only `providerOptions.openrouter` and drops
`.google` / `.openai` / `.anthropic` entirely, with no remapping in
`ModelRouterLanguageModel`. Emitting only the vendor key would make the effort
selector a silent no-op on every routed model. Emit both: the vendor key (which
a direct provider instance reads) and the `openrouter` key (which reaches the
wire). The Vertex `discovery` role, being a direct provider instance, keeps the
vendor key alone.

### `src/mastra/chat-model-route.ts`

`GET /chat/models` keeps its path and gains modes. New response:

```json
{
  "defaultModeId": "normal",
  "resolvedMode": null,
  "modes": [
    { "id": "velocity", "label": "Velocity",
      "description": "Fastest answers, lowest cost.",
      "chatModelId": "google/gemini-3.5-flash-lite",
      "estimatedCredits": 615000, "relativeCost": 0.5, "affordable": null },
    { "id": "normal", "label": "Normal", "…": "…" },
    { "id": "intelligent", "label": "Intelligent", "…": "…" },
    { "id": "auto", "label": "Auto",
      "description": "Picks a mode from your message.",
      "chatModelId": null, "estimatedCredits": null, "relativeCost": null,
      "affordable": true }
  ],
  "roles": [
    { "id": "chat", "label": "Chat", "models": ["google/gemini-3.5-flash", "…"] },
    { "id": "vision", "label": "Document reading", "models": ["…"] }
  ],
  "models": [ { "id": "google/gemini-3.5-flash", "label": "Gemini 3.5 Flash",
                "vendor": "google", "provider": "openrouter" } ],
  "defaultEffortId": "auto",
  "efforts": [ … unchanged … ]
}
```

- `estimatedCredits` is in micro-credits for the reference turn (8,000 input +
  1,500 output), so the web formats it with the same helper as a balance.
  Compute it from the live tariff; the number above is illustrative only. On
  the seeded card the three modes come out at 615,000 / 1,162,500 / 3,100,000
  micro-credits, i.e. 0.62 / 1.16 / 3.10 credits per message.
- `relativeCost` is `estimatedCredits / normal.estimatedCredits`, rounded to
  one decimal.
- `affordable` is **always `null` on the wire**. The route is unauthenticated
  and shared, so it cannot know a balance; the browser computes affordability
  from the wallet it already holds. The field stays in the payload only so the
  shape does not change if the route ever becomes user-scoped.
- `models` is only what the advanced selector needs. `defaultModelId` is
  **removed**; a client that sends no mode gets `normal`.

New forwarded properties, alongside the existing `model` and `effort`:

- `mode` — one of the four mode ids.
- `roleModels` — a `Record<ModelRole, string>` of advanced overrides, ignored
  for non-configurable roles.

`model` is kept for one release as a synonym for a `chat` role override so a
stale browser keeps working; the service maps it into `roleModels.chat`.

### `src/mastra/credits/credits-run.ts`

`recordToolUsage` must stop hardcoding `provider: 'vertex', modelId:
subAgentModelId`. It takes the **role** and charges
`resolvedModelForRole(role, requestContext)`. Call sites pass their role:
`previewVehicleSource` charges transcription under `vision` and identification
under `identification`; source discovery charges under `discovery`;
`content-discovery-tool` under `contentDiscovery`.

Admission is unchanged in shape: still inside the async model resolver, still
memoised per request, still the only place that can surface a readable
`RUN_ERROR`. It admits against the resolved `chat` model — which, in auto
mode, means the routing decision happens **before** `admit`.

The `INSUFFICIENT_CREDITS` message becomes credit-denominated and mode-aware:

```
INSUFFICIENT_CREDITS: Your AI credits (0.12) do not cover a reply in
Intelligent mode. Velocity mode fits your remaining credits.
```

`cheaperModels` from the API is mapped back to the modes those models belong
to; a model that belongs to no mode is reported by its own label.

### `src/mastra/memory.ts`

`generateTitle.model` becomes `openrouter/openai/gpt-5.6-luna`, overridable by
`SPECSYNC_TITLE_MODEL`. No request context, so it never follows a user's mode.

### Environment

| Variable                                           | Meaning                                          |
| -------------------------------------------------- | ------------------------------------------------ |
| `OPENROUTER_API_KEY`                               | required once any role routes through OpenRouter |
| `SPECSYNC_CHAT_MODELS`                             | advanced-selector catalog, optional              |
| `SPECSYNC_EXTRACTION_MODEL`                        | curator workflow model, optional                 |
| `SPECSYNC_TITLE_MODEL`                             | thread titles, optional                          |
| `GOOGLE_VERTEX_PROJECT` / `GOOGLE_VERTEX_LOCATION` | still required, grounding only                   |

Retired: `VERTEX_MODEL`, `VERTEX_MODELS`, `OPENAI_MODELS`,
`VERTEX_TITLE_MODEL`, `OPENAI_API_KEY`.

**The Vertex red line is unchanged**: no key, no service-account JSON, no
`GOOGLE_APPLICATION_CREDENTIALS` anywhere. `OPENROUTER_API_KEY` is a normal
secret and lives in Secret Manager, injected as an environment variable; it is
never committed.

## API contract (`apps/api`)

### Unit rename

`Money` → `CreditAmount`, same record over `long micros`, now micro-credits.
`MICROS_PER_REAL` → `MICROS_PER_CREDIT`. Every Javadoc that says "reais" says
"credits". `Credits.SIGNUP_GRANT` becomes `CreditAmount.of(500_000_000L)`.

The wallet view's `"currency": "BRL"` field becomes `"unit": "CREDITS"`. Every
other field name and status code in
[`ai-credits-implementation.md`](ai-credits-implementation.md) is unchanged —
only the meaning of the integers changes.

### `V8__openrouter_credits.sql`

1. Drop the `ledger_entry` append-only trigger, rescale every stored amount by
   `× 20` (`ledger_entry.amount`, `run.hold`, `run.charge`,
   `run_step.charge`), recreate the trigger. Existing local wallets keep their
   value.
2. `UPDATE credits.model_tariff SET active = false` for every existing row,
   **and rescale their three price columns by `× 20` as well**. Keeping the
   rows is what lets a historical run reconcile against the price it was
   charged with; leaving those prices in micro-reais while the charges become
   micro-credits would break that reconciliation by exactly 20×, with no
   column recording which unit a row is in. This is a re-denomination, not a
   prospective price revision.
3. Insert the OpenRouter rate card as version 1 rows with
   `provider = 'openrouter'` and the full OpenRouter model id.

### Rate card

**Do not invent prices.** Generate the seed from OpenRouter's public catalog:

```
GET https://openrouter.ai/api/v1/models
```

which needs no key and returns `pricing.prompt` / `pricing.completion` /
`pricing.input_cache_read` as USD **per token** strings. Convert with
`micro_credits_per_million = round_half_up(usd_per_token × 1e6 × 100 × 1e6)`.

Write the generator as `scripts/credits/openrouter-tariffs.mjs`, commit both
the script and the JSON snapshot it produced (`scripts/credits/
openrouter-tariffs.json`, with the fetch date), and generate the migration
from the snapshot. A price the API does not publish for a model — a missing
cache-read column — falls back to 25% of input, which is the convention the
previous rate card already used.

Seed exactly the models named in the mode table plus `SPECSYNC_CHAT_MODELS`,
**plus one `provider = 'vertex'` row for the `discovery` model**
(`gemini-2.5-flash`, at the `× 20` reference prices below, since it is billed
by Google directly and not through OpenRouter).
If the fetch fails, fall back to `× 20` of the existing rate card for the
Google and OpenAI rows and leave Anthropic unseeded — Intelligent mode then
simply is not offered, which is the correct degradation.

For reference, `× 20` of the current rows (micro-credits per million):

| model                           | input       | cached input | output        |
| ------------------------------- | ----------- | ------------ | ------------- |
| `google/gemini-2.5-flash`       | 30_000_000  | 7_500_000    | 250_000_000   |
| `google/gemini-2.5-flash-lite`  | 10_000_000  | 2_500_000    | 40_000_000    |
| `google/gemini-2.5-pro`         | 125_000_000 | 31_250_000   | 1_000_000_000 |
| `google/gemini-3.1-flash-lite`  | 25_000_000  | 6_250_000    | 150_000_000   |
| `google/gemini-3.1-pro-preview` | 200_000_000 | 50_000_000   | 1_200_000_000 |
| `google/gemini-3.5-flash-lite`  | 30_000_000  | 7_500_000    | 250_000_000   |
| `google/gemini-3.5-flash`       | 150_000_000 | 37_500_000   | 900_000_000   |
| `google/gemini-3.8-flash`       | 75_000_000  | 18_750_000   | 375_000_000   |
| `openai/gpt-5.6-luna`           | 20_000_000  | 2_000_000    | 120_000_000   |

## Gateway contract (`apps/gateway`)

No new routes. `GET /ai/chat/models` and `GET /ai/chat/credits` are already
allowed; confirm both in `src/app.spec.ts`.

## Web contract (`apps/web`, inside `domains/chat`)

### Credits display

`data/credits.ts`: `MICRO_PER_REAL` → `MICRO_PER_CREDIT`, `formatBrl` →
`formatCredits`, and the `currency` schema field → `unit`.

Formatting rules, `en-US` grouping, the word "credits" only where it is not
already implied by a label:

- `>= 1` credit: integer, grouped — `183`, `1,204`.
- `> 0` and `< 1`: two decimals — `0.42`.
- `> 0` and `< 0.01`: `less than 0.01`.
- `<= 0`: `0`.

The pill reads `183 credits` with the existing progress bar. The popover
header becomes "AI Credits", the amount line `183 of 200`, and the model price
list shows credits per 1M tokens instead of BRL.

### Mode picker

`RunOptionsPicker` becomes mode-first. The pill names the current mode
(`Normal`, or `Auto · Normal` once a run has resolved one). The panel shows
the four modes as radios with, on each row, the estimated cost —
`≈ 1.16 credits per message` — and, for anything above Normal, the multiplier
`3.2× Normal`. The effort track stays where it is.

An "Advanced" row at the bottom opens the per-role list: one selector per
configurable role, each defaulting to "Follow mode".

Switching to a mode that leaves the balance covering **fewer than 20
reference turns** shows a confirm step inside the panel: the estimated cost,
how many messages the balance covers at that rate, and Cancel / Switch.

The trigger is affordability alone, deliberately — an earlier draft also
required `relativeCost > 3`, which on the real rate card never fires, because
Intelligent costs only ~1.2× Normal. Do not add a multiplier condition; the
per-row estimate is what carries the cost signal, and the confirm step exists
for the case where the user is about to run out.

### Preferences

`Preferences` gains `mode: ChatMode` (default `'normal'`) and
`roleModels: Partial<Record<ModelRole, string>>` (default `{}`), persisted in
the same localStorage key with the same tolerant parsing. The existing `model`
field is read once and migrated into `roleModels.chat`, then dropped.

`ChatAgentClient` sends `mode` and `roleModels` as forwarded properties
alongside `effort`.

### Insufficient-credits recovery

The alert's action becomes "Switch to Velocity mode" (the cheapest mode that
fits) instead of "Switch to <model>", and sets the mode preference.

## Acceptance checks

- Grounding still works: `discoverVehicleSpecificationSources` returns citations
  resolved through the Vertex redirect, with no `OPENROUTER_API_KEY` involved.
- A chat turn in each mode charges the wallet at that mode's chat tariff, and a
  PDF preview inside it charges `vision` at the vision tariff — not the chat one.
- Thread titles produce no ledger entry.
- The curator ingestion workflow produces no ledger entry and ignores the mode.
- Mode estimates: `intelligent.relativeCost` > `normal` > `velocity`, and every
  estimate matches a hand-computed charge from the seeded tariff.
- The confirm step appears when switching to Intelligent on a nearly empty
  wallet and does not appear on a full one. It is driven by remaining turns,
  not by a cost multiplier.
- The `discovery` role's usage is charged at the `vertex` / `gemini-2.5-flash`
  tariff, not at the run's chat tariff.
- A stale browser sending only `model` still runs, on that model.
- An advanced override naming an unpriced model is ignored, not fatal.
- `V8` rescaling: a wallet holding the old R$ 10,00 grant reads `200` credits.
- Credits disabled: no behavioural change anywhere, modes still selectable,
  estimates hidden.
