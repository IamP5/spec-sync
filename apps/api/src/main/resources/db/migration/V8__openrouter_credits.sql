-- OpenRouter model routing: the wallet's unit becomes AI credits and the rate card becomes
-- OpenRouter's public catalog.
--
-- 1 credit is USD 0.01 and 1 credit is 1_000_000 micro-credits, so a micro-credit is USD 1e-8 and
-- keeps exactly the headroom the micro-real unit had. The columns do not change; their meaning
-- does. The conversion is exact because the V7 seed used R$ 5,00 per USD: micro-credits =
-- micro-reais x 20. See docs/openrouter-model-routing.md, "API contract".

-- The application keeps writing while this runs, so fail fast instead of queueing: without a
-- timeout the ACCESS EXCLUSIVE lock below waits behind any in-flight wallet transaction and every
-- new request piles up behind it. Flyway runs a PostgreSQL migration in one transaction, so the
-- setting lives exactly as long as this migration.
SET LOCAL lock_timeout = '5s';

-- The ledger is append-only by trigger, so rescaling history means lifting the guard for the length
-- of this statement. DDL is transactional on PostgreSQL and DROP TRIGGER takes ACCESS EXCLUSIVE on
-- the table, so a concurrent session either waits for this migration or sees the trigger back in
-- place; there is no window in which an unguarded UPDATE could slip through.
DROP TRIGGER immutable_ledger_entry ON credits.ledger_entry;

UPDATE credits.ledger_entry SET amount = amount * 20;

CREATE TRIGGER immutable_ledger_entry BEFORE UPDATE OR DELETE ON credits.ledger_entry
FOR EACH ROW EXECUTE FUNCTION credits.reject_ledger_mutation();

-- The open runs' reservations and every run's settled charge are the same amounts in the new unit.
-- Multiplying by 20 preserves zero and sign, so CHECK (hold >= 0), CHECK (charge >= 0) and
-- CHECK (status = 'OPEN' OR hold = 0) all still hold.
UPDATE credits.run SET hold = hold * 20, charge = charge * 20 WHERE hold <> 0 OR charge <> 0;

UPDATE credits.run_step SET charge = charge * 20 WHERE charge <> 0;

-- The V7 rate card priced Vertex and OpenAI models directly, in micro-reais. Every call now routes
-- through OpenRouter under its full model id, so none of those rows prices anything any more. They
-- are deactivated rather than deleted: credits.run stamps the tariff version that charged it, and
-- deleting the row would cut a charged run loose from the price it was charged at.
--
-- Their price columns are rescaled with everything else. This is a re-denomination, not a price
-- revision: the charges pointing at these rows became micro-credits above, so leaving the prices in
-- micro-reais would break `charge = tokens x price / 1e6` for every historical run by exactly 20x,
-- with no column saying which unit a row is in. Same amount of money, new unit, on both sides.
UPDATE credits.model_tariff
SET input_per_million = input_per_million * 20,
    cached_input_per_million = cached_input_per_million * 20,
    output_per_million = output_per_million * 20,
    active = false
WHERE active;

-- Rate card v1 for OpenRouter, in micro-credits per million tokens. Generated from OpenRouter's
-- public catalog (GET https://openrouter.ai/api/v1/models, no key required) by
-- scripts/credits/openrouter-tariffs.mjs and taken verbatim from the snapshot it committed,
-- scripts/credits/openrouter-tariffs.json, fetched 2026-09-07. No price here was typed by hand:
-- regenerate with `node scripts/credits/openrouter-tariffs.mjs --sql` and diff.
--
-- Conversion: micro_credits_per_million = round_half_up(usd_per_token x 1e6 x 100 x 1e6), computed
-- on the decimal strings the catalog publishes so no double ever rounds a price.
--
-- Seeded models are exactly the ones the mode table names, which is also the default of
-- SPECSYNC_CHAT_MODELS: velocity runs on google/gemini-3.5-flash-lite, normal on
-- google/gemini-3.8-flash, intelligent adds anthropic/claude-sonnet-5 for chat and
-- google/gemini-3.1-pro-preview for vision. A model without an active tariff is never offered and
-- never charged, which is the intended degradation.
--
-- Normal is 3.8 Flash rather than 3.5 Flash on purpose: OpenRouter prices 3.5 Flash at USD 1.50 /
-- 9.00 per million, which left Intelligent only 1.2x Normal and gave the picker's cost signal
-- nothing to show. See docs/openrouter-model-routing.md, "Modes, not models".
--
-- OpenRouter publishes input_cache_read for all four, so none of them falls back to the 25%-of-input
-- convention the previous card used.
INSERT INTO credits.model_tariff
    (id, provider, model_id, version, input_per_million, cached_input_per_million, output_per_million, active)
VALUES
    ('7c1b1a10-0001-4000-8000-000000000001', 'openrouter', 'google/gemini-3.5-flash-lite', 1, 30000000, 3000000, 250000000, true),
    ('7c1b1a10-0001-4000-8000-000000000006', 'openrouter', 'google/gemini-3.8-flash', 1, 75000000, 7500000, 375000000, true),
    ('7c1b1a10-0001-4000-8000-000000000003', 'openrouter', 'google/gemini-3.1-pro-preview', 1, 200000000, 20000000, 1200000000, true),
    ('7c1b1a10-0001-4000-8000-000000000004', 'openrouter', 'anthropic/claude-sonnet-5', 1, 200000000, 20000000, 1000000000, true);

-- Google Search grounding is the one call this product still makes outside OpenRouter, because
-- `vertex.tools.googleSearch({})` has no OpenRouter equivalent. The `discovery` role therefore runs
-- on Vertex AI directly and is billed by Google, so it needs its own active row under the `vertex`
-- provider and the bare model id. Without it a discovery usage step would fall back to the run's own
-- chat tariff (CreditsJdbcGateway.recordUsage) and be charged at the wrong price, silently.
--
-- Not from the OpenRouter catalog: these are the V7 Vertex prices for the same model in the new
-- unit (micro-reais x 20 at the R$ 5,00/USD the V7 card used). Google's per-query grounding fee
-- stays absorbed by SpecSync; only the model tokens are charged.
--
-- Version 2, not 1: V7 already seeded (vertex, gemini-2.5-flash, 1) and UNIQUE (provider, model_id,
-- version) would reject a second version 1. Which is the right shape anyway — this genuinely is the
-- next version of that model's tariff, and the deactivated version 1 keeps pricing the runs it
-- charged.
INSERT INTO credits.model_tariff
    (id, provider, model_id, version, input_per_million, cached_input_per_million, output_per_million, active)
VALUES
    ('7c1b1a10-0001-4000-8000-000000000005', 'vertex', 'gemini-2.5-flash', 2, 30000000, 7500000, 250000000, true);
