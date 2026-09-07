# AI credits: provider and billing research

Retrieved: 2026-09-07. Scope: official public documentation; this is research, not an implementation or a guarantee of provider invoice accuracy. The repository had app-specific architecture notes but no shared research directory; this cross-app note establishes `docs/research/`.

## What “like GitHub Copilot” means today

GitHub switched from premium requests with model multipliers to token-based usage billing on June 1, 2026; some existing annual subscriptions remain on the legacy system. New architecture should copy the token-cost model, not assume each user message has one fixed model multiplier. [GitHub billing transition](https://docs.github.com/en/copilot/reference/copilot-billing/request-based-billing-legacy/what-changed-with-billing)

One GitHub AI credit equals US$0.01. Plans include monthly allowances. [GitHub Copilot billing](https://docs.github.com/en/billing/concepts/product-billing/github-copilot-billing)

Individual allowances reset monthly without carryover; users can upgrade, authorize additional usage, or wait after exhausting their allowance. Model choice and workload size affect depletion. This differs from SpecSync's requested **one-time R$10 grant and no new messages at zero**. Monthly renewal or paid top-ups should be separate future product decisions. [Individual usage billing](https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals)

## Options

| Approach                                    | What it supplies                                                                                                         | Main tradeoff and fit                                                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Own wallet + current direct providers       | Product-owned BRL balance, grants, transaction history and admission policy; provider usage supplies settlement evidence | Best initial fit when existing providers cover the intended catalog. More work maintaining rates and usage normalization, fewer new operational dependencies.        |
| Own wallet + OpenRouter                     | Broad model routing, consolidated provider payment, returned request cost                                                | Faster catalog expansion; additional vendor and routing dependency, USD economics, credit purchase fees, provider-specific capabilities still require qualification. |
| Own wallet + LiteLLM                        | Self-hosted model gateway, virtual keys, end-user budgets and spend tracking                                             | Stronger control and reusable gateway policy, but another service plus persistence/cache to operate. Useful when provider breadth or teams justify it.               |
| Stripe credits and meters + local admission | Promotional/paid credit grants, metered invoices and payment integration                                                 | Useful when selling credits/subscriptions; does not replace synchronous local wallet enforcement. Unnecessary initial payment infrastructure for a free grant.       |

These are architectural judgments. Provider capabilities and limitations supporting them follow.

### Direct Google Cloud / Vertex AI

Google offers managed partner models as well as Gemini, so “direct Vertex” does not mean “Gemini only.” Availability is a curated catalog with model-specific enablement and supported endpoints. Do not promise arbitrary models solely because a name is selectable. [Partner models](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/partner-models/use-partner-models)

Prompt token counting supports preflight estimates. For multimodal inputs, Google explicitly says token estimates can differ from final billing usage; accurate usage arrives after execution in response metadata. Consequently, counting tokens before generation is not a final debit receipt. [Count Tokens API](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/get-token-count)

Current example standard rates per million tokens, for text and at most 200k input tokens: Gemini 2.5 Flash US$0.30 input / US$2.50 output; Gemini 2.5 Pro US$1.25 / US$10. Output includes response and reasoning. Cached-input and other modality/tool charges differ. These examples illustrate cost spread, not a recommendation to adopt these older model versions. [Google pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)

Google now supports spend-cap budgets for eligible services, including the platform formerly named Vertex AI. They are scoped to one project and one service, use monthly gross estimated costs, and let in-flight requests finish. They are an additional project safeguard, not per-SpecSync-user balances. [Cloud spend caps](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps)

### OpenRouter

OpenRouter exposes a unified API and passes through provider inference prices; it currently charges 5.5% with a US$0.80 minimum when purchasing credits. Its base currency is USD. BYOK has separate terms: first one million monthly requests free, then a fee of 5% of equivalent provider pricing. [OpenRouter FAQ](https://openrouter.ai/docs/faq)

Responses include usage and charged cost, with cached/reasoning breakdowns where available. Streaming delivers usage in the final SSE message. Generation IDs support later usage retrieval, useful for reconciling interrupted streams. An early client disconnect therefore cannot be interpreted as zero cost. [Usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting)

Management APIs create/update keys with USD limits and optional reset schedules; a null reset enables a lifetime limit. Keeping a per-user key on the server provides a second control boundary. The reviewed docs do not establish a strict BRL reservation contract across concurrent requests and all provider charges: retain local authoritative admission and validate the chosen provider's behavior. [API key management](https://openrouter.ai/docs/guides/overview/auth/management-api-keys), [Update limits](https://openrouter.ai/docs/api/api-reference/api-keys/update-keys)

### LiteLLM

Current documentation supports end-user budgets and says budget reservation is enabled by default: estimate maximum cost, reserve before provider execution, settle actual cost afterward. Explicit output limits improve reservation bounds. Routes without token pricing and batch submissions have reservation limitations. Disabling reservations permits concurrent overspend. Enable `fail_closed_budget_enforcement` for degraded-cache protection; database-less deployments do not enforce these budgets. Zero-priced models bypass budget checks, which conflicts with SpecSync's “no messages at zero” requirement unless the application blocks them first. [LiteLLM budgets](https://docs.litellm.ai/docs/proxy/users)

Inference: qualify a pinned LiteLLM release with concurrency and failure tests before treating it as a financial control; current docs alone do not establish every routed model's accounting behavior. Product grants, BRL policy, refunds and durable user-facing receipts still belong to the application wallet.

### Stripe

Stripe credit grants support promotional and prepaid use. They apply to subscription items using metered prices and matching currency, not arbitrary one-off invoice items; application occurs at invoice finalization. The implementation guide requires a meter, price and subscription and is marked public preview on retrieval. [Billing credits](https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits), [Implementation guide](https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits/implementation-guide)

Meter events process asynchronously, so summaries and upcoming invoices may lag submitted usage. Inference: an API request that checks Stripe's balance before forwarding a prompt is insufficient for an atomic hard stop. Use a local wallet for admission and export billing events asynchronously when paid credits are introduced. [Recording usage](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api)

## BRL pricing policy

Recommendation: define credits as a nontransferable product usage allowance denominated in BRL, with one idempotent R$10 grant per eligible new user. Keep sub-cent precision internally; display localized reais. Store provider cost separately from the user charge, including the model, price version, exchange-rate version and all usage components.

Two workable policies:

- Published BRL model rates, revised prospectively: stable user expectations, with FX/provider-price risk borne by SpecSync between revisions.
- Provider cost multiplied by a versioned FX rate and disclosed margin: closer cost recovery, but less predictable depletion. Never retroactively change already settled debits.

Google's local-currency conversion rates are set at the start of each month and available in billing exports. A public spot USD/BRL quote need not match Google's billed conversion or OpenRouter payment costs. [Google currency policy](https://docs.cloud.google.com/billing/docs/resources/currency)

Illustration only, assuming R$5/US$ and no fees/margin: 10,000 input + 2,000 output tokens cost R$0.04 on the Flash example and R$0.1625 on the Pro example. Thus R$10 buys roughly 250 or 61 such single calls. These are not messages-per-user forecasts: history, tools, reasoning and multiple agent calls can materially increase a single message's cost.

## Recommendation for SpecSync

Own the wallet in Spring API/PostgreSQL and start with existing direct providers. Treat model delivery and wallet accounting as separate choices; OpenRouter or LiteLLM can be added later without migrating the user balance.

Use atomic reservations before each paid call/step, bounded output and tool execution, followed by idempotent settlement from actual usage. Release unused reservations only when execution is known to have ended; reconcile ambiguous cancellation/failure rather than refunding automatically. Deny new messages at zero in the server and UI. Provider cost can exceed an estimate unless every charge is bounded: to promise a nonnegative user balance, SpecSync must either reject insufficiently funded work or explicitly absorb any residual overage.

A tiny positive balance might not fund the chosen model's minimum useful answer. Product wording should explain insufficient credits for that request and allow selection of a cheaper available model. Do not silently send a more expensive fallback, and do not bypass the zero-balance rule using free models.
