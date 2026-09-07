# AI Credits proposal for SpecSync

Researched 2026-09-07. Proposal only; no application code or configuration changed.

## Recommendation

Implement a SpecSync-owned BRL wallet in the existing Spring API and PostgreSQL/Cloud SQL database. Keep the current direct model integrations initially. Meter actual provider usage, authorize spending before calls, and settle the charge afterward. A gateway can help with provider routing later, but should not own the user-facing grant and balance policy.

Interpret the requested R$ 10,00 as a one-time promotional grant per new verified user, with no automatic renewal, expiry, payment collection, or top-up in the initial scope. These are proposed defaults, not additional requirements from the user. “Any model” means any supported, priced model in the server-controlled catalog.

## What already exists

Repository evidence, relative to the workspace root:

- `apps/ai/src/mastra/models.ts`: Gemini through Vertex with Application Default Credentials; optional OpenAI through Mastra's router; model and reasoning-effort selection. Models are currently configured through environment variables and unknown IDs fall back to a default. Billing needs a resolved, versioned, priced model record; unpriced selections must not run silently.
- `apps/ai/src/mastra/index.ts` and `identity.ts`: the CopilotKit route verifies a Firebase token and derives `user:<uid>`. Use this verified identity for spending, never a browser-supplied UID or balance.
- `apps/ai/src/mastra/agents/spec-sync-agent.ts`: up to 10 agent steps per run. One submitted message is not one model call.
- `apps/ai/src/mastra/memory.ts`: 40 recent messages and separate automatic title generation. History contributes to subsequent model inputs; title generation is another cost center.
- `apps/ai/src/mastra/tools/content-discovery-tool.ts`: a separate Gemini agent with Google Search grounding. Selecting OpenAI for the answer does not change this tool's model.
- `apps/ai/src/mastra/ingestion/`: identification, extraction, repair and PDF transcription calls. Decide ownership explicitly rather than accidentally charging the chat user's wallet.
- `apps/gateway/src/app.ts`: authenticated Hono gateway forwards the approved AI/browser routes and API routes. It does not implement credits.
- `apps/api/src/main/resources/db/migration/`: API-owned PostgreSQL persistence already exists. Wallet tables can use this database, separately from Mastra's memory schema. No additional database service is needed.

The wallet API must establish authenticated user identity for balance reads and authenticated AI-service authority for reservation/settlement. Existing gateway authentication alone does not establish a billing authorization contract inside Spring. Public callers must never gain a settlement or grant endpoint by passing through the gateway.

## Charging choices

| Choice                                         | Benefit                                                    | Tradeoff                                                                                                                       | Fit                                                       |
| ---------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Actual usage at a published rate per model     | Short/cheap calls spend less; supports model choice fairly | Variable message cost; needs token, cache, reasoning and tool accounting                                                       | Recommended                                               |
| Fixed BRL amount per message, varying by model | Price is known before sending; simple atomic debit         | Long conversations and multi-step calls cost more to serve than short ones; requires strict execution limits and cross-subsidy | Useful if predictability matters more than usage accuracy |
| Abstract points or model multipliers           | Simple allowance and plan packaging                        | Does not explain what R$ 10,00 buys unless conversion and charging rules are published                                         | Only if product changes its currency promise              |

For actual usage, separate **provider expense** from **customer debit**. The former measures your bill; the latter follows your disclosed tariff. They can differ due to FX, taxes, account discounts/free quotas, markup and refunds. Initially use no intentional margin for the promotional allowance, with a versioned BRL tariff and an explicit FX policy; track residual expense separately.

Illustrative formula: sum each disjoint billable usage category multiplied by its price, add explicitly chargeable tool costs, then apply the stored conversion/tariff policy. Normalize each provider's semantics: cached tokens can be a subset of input and reasoning tokens can be a subset of output. Adding them again would double-charge. Capture the actual provider/model served, not merely the user's requested label.

Use integer micro-reais (1 real = 1,000,000 units) or exact fixed-precision decimals. Grant R$ 10,00 as 10,000,000 micro-reais. Round only for display under a documented rule, preserving fractional-cent debits. Display “less than R$ 0,01” when needed instead of showing zero for a spendable positive balance.

## Architecture alternatives

| Approach                                                      | What it supplies                                                         | Main tradeoff                                                                                                  | Recommendation                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Own wallet + current direct providers                         | Full product policy, existing Vertex ADC, minimal infrastructure changes | You maintain pricing adapters and metering coverage                                                            | Start here                                               |
| Own wallet + managed multi-provider router such as OpenRouter | Broader model access, unified API and usage metadata                     | Another data processor/dependency, funding fees, provider feature differences; still need BRL wallet semantics | Consider if a broad catalog is a near-term requirement   |
| Own wallet + self-hosted LiteLLM                              | Centralized routing, usage/cost controls and key/user budgets            | Operate another service and its storage/cache; qualify deployed version and failure modes                      | Consider when multiple apps/providers need shared policy |
| Mastra TokenCostControl alone                                 | Convenient agent spending guard                                          | Approximate metrics, rolling windows, fail-open cases, no durable promotional ledger                           | Secondary guard only                                     |
| Stripe Billing credits                                        | Promotional/paid credit grants connected to metered invoices             | Invoice-oriented, asynchronous usage processing; not synchronous admission control                             | Add when selling credits/subscriptions                   |

Provider-specific claims, current Copilot behavior and official links are detailed in [the provider research](ai-credits-provider-research.md).

[Mastra's TokenCostControl documentation](https://mastra.ai/reference/processors/token-cost-control) explicitly calls its thresholds approximate because metrics are exported asynchronously. Queries and missing attribution can fail open; a nonpositive dynamic `maxCost` skips enforcement. It is unsuitable as the authoritative zero-balance gate. Its default aggregation window is seven days, which also differs from a lifetime signup grant.

## Enforcing the balance

Checking `balance > 0`, calling the model, then subtracting usage has a race: multiple tabs can all observe the same money. Final token costs are also unknown when a stream begins.

| Policy                                | At a small positive balance                                                                  | Who bears excess cost?                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Post-charge only                      | Admit a new message and deduct later                                                         | SpecSync; potentially many concurrent runs unless serialized                       |
| Reserve and settle with bounded calls | Reduce output/effort or require enough funds before calling                                  | Normally covered by reservation; SpecSync handles estimation or provider anomalies |
| Finish the final message              | Admit one bounded run while positive, block other runs, clamp debit to the remaining balance | SpecSync deliberately absorbs the last-run overrun                                 |

Recommend reservation and settlement. Explain insufficient credit for a selected model even if a small amount remains; offer a cheaper model or a shorter response. Do not silently switch models or reasoning effort. If the product instead requires every positive balance to permit a complete final response, choose and budget the final-message subsidy explicitly.

Suggested execution protocol:

1. Ensure one wallet and one signup-grant ledger entry for the verified UID. Use a unique grant key so concurrent first requests and retries cannot issue R$ 10,00 twice. Record signup eligibility/campaign rules; deleting a conversation must never reset eligibility.
2. Create an idempotent logical message/run record, bound to the UID and request contents. Scope keys server-side; a replay must neither generate again nor charge again. Distinguish genuine regenerations from transport retries and client-tool continuations.
3. Resolve the supported provider, model, effort, tariff version and tool permissions. Before the first billable operation, atomically reserve a bounded amount from the wallet. Available balance is posted balance minus open reservations. A conditional update or transaction with row locking prevents overspending by concurrent requests.
4. Bound input, output, reasoning, agent steps, retries and chargeable tools. Authorize each subsequent billable call against remaining reservation; extend it atomically only when funds are available. Include system prompts, history and tool schemas/results when estimating input. Use model-specific token counting/limits and conservative rates, without relying on cache hits or shared free quotas for safety.
5. Persist normalized usage and provider request IDs after each call. Settle once, release unused funds, and return the new balance. Keep operation records for nested agents and async work, so early completion of the outer stream cannot release funds already allocated to a child.
6. At zero available credit, reject new billable runs server-side. History, model browsing and cancellations remain available. The Angular composer mirrors the server state and renders typed insufficient-credit or temporarily-reserved errors.

Provider output limits are essential but not a universal invoice guarantee. Enforce each model's reasoning/output semantics and bound tool/retry fan-out. Once a provider has processed a call, aborting the client stream cannot retroactively undo its cost. A strict admission rule can prevent starting new spending without authorized funds; it cannot promise perfect real-time correspondence with a delayed provider invoice.

## Ledger and failure handling

Suggested API-owned records: wallet; immutable grant/debit/refund/adjustment entries; reservation; run and individual provider operation; versioned model tariff. Each operation records UID, logical run, actual provider/model, usage categories, source currency cost, tariff/FX version, charge and lifecycle state. Corrections append entries rather than editing historical debits.

- Do not hold a database transaction open for a stream. Reserve briefly, execute externally, settle briefly.
- Persist intent before provider dispatch. Retry settlement with the same operation ID. A failed settlement must not cause another generation.
- Network timeouts and missing final usage are uncertain outcomes, not evidence of zero cost. Keep the affected reservation pending, reconcile against retrievable provider usage, and apply a documented eventual adjustment policy.
- Reservation expiry alone is not permission to release money while a provider call might still be running. Use execution leases/fencing and a reconciler; unknown cost may require a capped estimated debit followed by an auditable correction.
- Stop/cancel charges completed or confirmed billable work and releases the confirmed unused remainder. Provider/platform failures can receive a separate goodwill refund; customer refund policy does not erase provider expense.
- Fail closed for new spending if wallet authorization is unavailable. Keep outstanding operations reconcilable across Cloud Run restarts and scale-to-zero.
- Chargeable retries are tracked individually, while a duplicated accounting event is ignored. Never debit both individual call usage and an aggregate that already includes those calls.

[Mastra's stream API](https://mastra.ai/reference/streaming/agents/stream) exposes step/final callbacks, pre-step preparation, cancellation and output limits. The installed `@mastra/core` also exposes `MastraModelOutput.totalUsage` in `node_modules/@mastra/core/dist/stream/base/output.d.ts`. These are integration points, not a guarantee that the CopilotKit adapter forwards every callback or that a parent's total includes every independent child/title/workflow call. Validate the exact installed adapter behavior with a small integration spike before choosing callback versus provider-wrapper instrumentation.

Recommended charging scope: user-requested chat and search-related model calls consume the user's allowance; automatic titles and curator ingestion use a separate SpecSync operating budget. Record all costs either way. Publish a simple search tariff or absorb shared grounding fees rather than letting a shared provider free quota make identical users' prices unpredictable.

## What R$ 10,00 could buy

Illustration only: 10,000 uncached text input tokens and 4,000 total billable output tokens per single model call, with **an assumed R$ 5,00/USD**, no margin, taxes, tools or extra calls. This is not a current FX quote or a promise about message counts.

| Model            | USD per million input/output tokens | BRL per illustrative call | Whole calls within R$ 10,00 |
| ---------------- | ----------------------------------- | ------------------------- | --------------------------- |
| Gemini 2.5 Flash | $0.30 / $2.50                       | R$ 0.065                  | 153                         |
| Gemini 2.5 Pro   | $1.25 / $10.00                      | R$ 0.2625                 | 38                          |

Prices are the published standard <=200K-context rates, checked 2026-09-07. Google's output price includes response and reasoning, and long-context rates and grounding charges can change the result. See [official model pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing). A multi-step SpecSync message may consume several calls, so these counts are not message estimates.

Keep the user's grant fixed in BRL. Version prices/FX for future operations without retroactively revaluing the wallet. Choose either a periodically published BRL rate card (predictable, SpecSync bears interim FX movement) or live FX conversion (closer to current expense, less predictable and dependent on another service). Prefer the published rate card initially. Invoice reconciliation should use actual provider billing currency/SKUs and negotiated rates when available.

## Delivery and acceptance

1. Validate metering for the current Gemini and OpenAI integrations through the actual AG-UI/CopilotKit flow: multi-step calls, reasoning, cache metadata, nested search, title generation, cancellation, error, retry and client-tool continuation.
2. Implement grant, ledger, reservations and reconciliation in API-owned persistence. Integrate Mastra authorization and accounting, preserving Vertex ADC and existing service boundaries.
3. Add balance, pending spend, model pricing hints and usage history to the UI. At exhaustion show “Seus créditos de IA acabaram”; at insufficient funds offer a cheaper/shorter option and explain the remaining amount. Keep existing conversations readable.
4. Add any additional supported models only when capability, pricing, limits and metering adapters have been verified. Add top-ups, payment webhooks and expiry/renewal rules separately if requested.

Acceptance scenarios must cover: exactly one grant under concurrent signup; two tabs spending the last funds; duplicate run and settlement requests; zero-credit direct HTTP calls; expensive/unpriced model rejection; partial streams and missing usage; process crash after provider dispatch; nested operation accounting; fractional cents; and tariff changes with old reservations still open. Reconcile aggregate recorded provider cost against billing reports and measure unexplained differences.

Track grant abuse as well: one grant per Firebase UID prevents duplicate application events but not one person creating several Google accounts. Preserve durable grant eligibility, use existing verified sign-in, add per-user run/rate limits and an overall promotional-spend circuit breaker. At 1,000 fully redeemed R$ 10,00 grants, the nominal promotional allowance is R$ 10,000; infrastructure and absorbed overhead are additional.

Before implementation, settle three product decisions: strict affordable-call admission versus subsidized final completion; published BRL tariff/FX and charged tool scope; and whether existing users also receive the signup grant. The recommendation above is viable without subscriptions or a payment provider.
