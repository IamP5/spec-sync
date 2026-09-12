-- Tier routing (2026-09-12): the composer's three tiers — Instant, Balanced, Deep — run the chat on
-- GPT 5.6 Luna / Luna / GPT 5.6 Sol, transcribe and identify on Gemini 3.8 Flash in every tier, and
-- ground Google Search on Vertex AI with Gemini 2.5 Flash / 3.8 Flash / 3.1 Pro. See
-- docs/openrouter-model-routing.md, "Tier revision".
--
-- Same lock discipline as V8: the application keeps writing while this runs.
SET LOCAL lock_timeout = '5s';

-- The models the tiers no longer name. Deactivated, never deleted: credits.run stamps the tariff
-- version that charged it, and deleting the row would cut a charged run loose from its price.
-- google/gemini-3.8-flash keeps its V8 row: vision and identification still run on it.
UPDATE credits.model_tariff
SET active = false
WHERE provider = 'openrouter'
  AND model_id IN ('google/gemini-3.5-flash-lite', 'google/gemini-3.1-pro-preview', 'anthropic/claude-sonnet-5')
  AND active;

-- Rate card rows for the two chat models, in micro-credits per million tokens. Generated from
-- OpenRouter's public catalog (GET https://openrouter.ai/api/v1/models, no key required) by
-- scripts/credits/openrouter-tariffs.mjs and taken verbatim from the snapshot it committed,
-- scripts/credits/openrouter-tariffs.json, fetched 2026-09-12. No price here was typed by hand:
-- regenerate with `node scripts/credits/openrouter-tariffs.mjs --sql V15` and diff.
--
-- OpenRouter publishes input_cache_read for both, so neither falls back to the 25%-of-input
-- convention. Both OpenAI models cache a repeated prompt prefix on their own from 1,024 tokens; the
-- AI service reports the cached count per step and the wallet charges it at cached_input_per_million.
INSERT INTO credits.model_tariff
    (id, provider, model_id, version, input_per_million, cached_input_per_million, output_per_million, active)
VALUES
    ('7c1b1a10-0001-4000-8000-000000000007', 'openrouter', 'openai/gpt-5.6-luna', 1, 20000000, 2000000, 120000000, true),
    ('7c1b1a10-0001-4000-8000-000000000008', 'openrouter', 'openai/gpt-5.6-sol', 1, 200000000, 20000000, 1000000000, true);

-- Google Search grounding still runs on Vertex AI directly (the `discovery` and `contentDiscovery`
-- roles) and is billed by Google under the bare model id, so the Gemini generations the Balanced and
-- Deep tiers ground with need their own active `vertex` rows next to the V8 row of gemini-2.5-flash.
-- Without them a grounding usage step would fall back to the run's chat tariff
-- (CreditsJdbcGateway.recordUsage) and be charged at the wrong price, silently.
--
-- Google publishes the same list price on Vertex and through OpenRouter, so these rows mirror the
-- OpenRouter catalog entry of the same model (same generator, same snapshot). Version 2: V7 seeded
-- version 1 of both and V8 deactivated them with the rest of the V7 card; UNIQUE (provider,
-- model_id, version) would reject a second version 1. Google's per-query grounding fee stays
-- absorbed by SpecSync; only the model tokens are charged.
INSERT INTO credits.model_tariff
    (id, provider, model_id, version, input_per_million, cached_input_per_million, output_per_million, active)
VALUES
    ('7c1b1a10-0001-4000-8000-000000000009', 'vertex', 'gemini-3.8-flash', 2, 75000000, 7500000, 375000000, true),
    ('7c1b1a10-0001-4000-8000-00000000000a', 'vertex', 'gemini-3.1-pro-preview', 2, 200000000, 20000000, 1200000000, true);
