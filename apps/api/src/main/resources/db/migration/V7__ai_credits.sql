-- AI credits: what a signed-in user may still spend on model calls.
--
-- The wallet is an append-only ledger. Every entry is signed (grants positive, debits negative)
-- and the balance is their sum, so a charge is never a subtraction of a stored number and history
-- always explains the balance. Money is integer micro-reais (1 BRL = 1_000_000); no floating point
-- and no numeric ever enter this schema.
--
-- Every mutation locks credits.wallet FOR UPDATE first (see CreditsJdbcGateway), so admission,
-- charging and finishing are serialised per user. Replays are stopped by the schema itself:
-- ledger_entry.entry_key is unique and run_step is keyed by (run_id, step_key).
CREATE SCHEMA credits;

CREATE TABLE credits.wallet (
 uid text PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now()
);

-- Published rate card in micro-reais per million tokens, versioned per provider and model.
-- Prices are revised prospectively: a new row with the next version is inserted and the previous
-- one is deactivated, so runs charged yesterday keep pointing at what they were charged with.
CREATE TABLE credits.model_tariff (
 id uuid PRIMARY KEY,
 provider text NOT NULL,
 model_id text NOT NULL,
 version integer NOT NULL CHECK (version > 0),
 input_per_million bigint NOT NULL CHECK (input_per_million >= 0),
 cached_input_per_million bigint NOT NULL CHECK (cached_input_per_million >= 0),
 output_per_million bigint NOT NULL CHECK (output_per_million >= 0),
 effective_from timestamptz NOT NULL DEFAULT now(),
 active boolean NOT NULL DEFAULT true,
 UNIQUE (provider, model_id, version)
);
-- At most one active tariff prices a model, which is what lets the gateway resolve it by name.
CREATE UNIQUE INDEX model_tariff_active ON credits.model_tariff (provider, model_id) WHERE active;

-- One metered agent run: one chat turn on one model. The hold is reserved on admission and
-- shrinks with every charged step, so two runs racing for the last credits cannot both be admitted.
CREATE TABLE credits.run (
 id uuid PRIMARY KEY,
 uid text NOT NULL REFERENCES credits.wallet (uid),
 thread_id text,
 provider text NOT NULL,
 model_id text NOT NULL,
 tariff_version integer,
 status text NOT NULL CHECK (status IN ('OPEN', 'COMPLETED', 'STOPPED', 'FAILED', 'EXHAUSTED')),
 hold bigint NOT NULL DEFAULT 0 CHECK (hold >= 0),
 hold_expires_at timestamptz,
 charge bigint NOT NULL DEFAULT 0 CHECK (charge >= 0),
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 CHECK (status = 'OPEN' OR hold = 0)
);
CREATE INDEX run_by_wallet ON credits.run (uid, started_at DESC);
CREATE INDEX run_open_holds ON credits.run (uid, hold_expires_at) WHERE status = 'OPEN';

CREATE TABLE credits.ledger_entry (
 id uuid PRIMARY KEY,
 uid text NOT NULL REFERENCES credits.wallet (uid),
 -- Natural key of the movement ('grant:signup:<uid>', 'usage:<run>:<step>'): what makes every
 -- write idempotent under a retry or a concurrent duplicate request.
 entry_key text NOT NULL UNIQUE,
 kind text NOT NULL CHECK (kind IN ('GRANT', 'DEBIT', 'REFUND', 'ADJUSTMENT')),
 amount bigint NOT NULL CHECK (amount <> 0),
 run_id uuid REFERENCES credits.run (id),
 description text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((kind = 'DEBIT') = (amount < 0) OR kind IN ('REFUND', 'ADJUSTMENT'))
);
CREATE INDEX ledger_entry_by_wallet ON credits.ledger_entry (uid, created_at DESC);

-- A ledger is history, not state: a wrong entry is corrected by an ADJUSTMENT, never by an update.
CREATE FUNCTION credits.reject_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% is append-only; post a compensating entry instead', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER immutable_ledger_entry BEFORE UPDATE OR DELETE ON credits.ledger_entry
FOR EACH ROW EXECUTE FUNCTION credits.reject_ledger_mutation();

-- One charged step of a run, keyed by the step key the AI service assigns, so a replayed
-- onStepFinish returns the stored charge instead of debiting twice.
CREATE TABLE credits.run_step (
 run_id uuid NOT NULL REFERENCES credits.run (id),
 step_key text NOT NULL,
 provider text NOT NULL,
 model_id text NOT NULL,
 input_tokens bigint NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
 cached_input_tokens bigint NOT NULL DEFAULT 0 CHECK (cached_input_tokens >= 0),
 output_tokens bigint NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
 -- Recorded only: providers bill reasoning inside output_tokens.
 reasoning_tokens bigint NOT NULL DEFAULT 0 CHECK (reasoning_tokens >= 0),
 -- The provider reported no usage and the AI service supplied assumed counts.
 estimated boolean NOT NULL DEFAULT false,
 charge bigint NOT NULL DEFAULT 0 CHECK (charge >= 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (run_id, step_key)
);

-- Rate card v1, converted at R$ 5,00 per USD with no margin. Cached input is the provider's
-- context-cache read price. A price is seeded only when it was read from the provider's own
-- published page; an unpriced model is never offered and never charged.
--
-- Vertex Gemini 2.5: Google's standard text prices for a context up to 200K tokens, as recorded in
-- docs/ai-credits-implementation.md on 2026-09-07. Example: gemini-2.5-flash input is USD 0.30 per
-- 1M tokens -> R$ 1,50 -> 1_500_000 micro-reais.
--
-- OpenAI gpt-5.6-luna: standard processing tier, short context, read on 2026-09-07 from
-- https://developers.openai.com/api/docs/pricing (USD 0.20 input / 0.02 cached input / 1.20 output
-- per 1M tokens). Long-context calls on that model are priced higher by OpenAI; revisit this row
-- with a second tariff if the chat agent ever runs long contexts there.
--
-- Gemini 3.x read on 2026-09-07 from the model list at https://openrouter.ai/google, which is the
-- source the product owner named for these rates. Two caveats a later revision should settle:
-- OpenRouter publishes its own pass-through rates while this service calls Vertex AI directly, and
-- other trackers quote a lower Vertex direct rate for gemini-3.5-flash-lite (USD 0.15 / 1.25). The
-- higher figure is seeded, so a wrong guess costs the user allowance rather than SpecSync money.
-- OpenRouter lists no cache-read column, so cached input keeps Google's usual 25% of input, the
-- same ratio the 2.5 rows use. Batch variants are not seeded: no call here runs in batch mode.
INSERT INTO credits.model_tariff
    (id, provider, model_id, version, input_per_million, cached_input_per_million, output_per_million, active)
VALUES
    ('7c1b1a10-0000-4000-8000-000000000001', 'vertex', 'gemini-2.5-flash', 1, 1500000, 375000, 12500000, true),
    ('7c1b1a10-0000-4000-8000-000000000002', 'vertex', 'gemini-2.5-pro', 1, 6250000, 1562500, 50000000, true),
    ('7c1b1a10-0000-4000-8000-000000000003', 'vertex', 'gemini-2.5-flash-lite', 1, 500000, 125000, 2000000, true),
    ('7c1b1a10-0000-4000-8000-000000000004', 'openai', 'gpt-5.6-luna', 1, 1000000, 100000, 6000000, true),
    ('7c1b1a10-0000-4000-8000-000000000005', 'vertex', 'gemini-3.5-flash-lite', 1, 1500000, 375000, 12500000, true),
    ('7c1b1a10-0000-4000-8000-000000000006', 'vertex', 'gemini-3.5-flash', 1, 7500000, 1875000, 45000000, true),
    ('7c1b1a10-0000-4000-8000-000000000007', 'vertex', 'gemini-3.6-flash', 1, 3750000, 937500, 18750000, true),
    ('7c1b1a10-0000-4000-8000-000000000008', 'vertex', 'gemini-3.7-flash', 1, 3750000, 937500, 18750000, true),
    ('7c1b1a10-0000-4000-8000-000000000009', 'vertex', 'gemini-3.8-flash', 1, 3750000, 937500, 18750000, true),
    ('7c1b1a10-0000-4000-8000-00000000000a', 'vertex', 'gemini-3.1-flash-lite', 1, 1250000, 312500, 7500000, true),
    ('7c1b1a10-0000-4000-8000-00000000000b', 'vertex', 'gemini-3.1-pro-preview', 1, 10000000, 2500000, 60000000, true);
