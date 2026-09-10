CREATE SCHEMA research;

-- A scope row is locked before choosing its current ingestion run. Different users' requests
-- never become the deduplication identity, and completed/rejected runs remain auditable.
CREATE TABLE research.scope (
    scope_key text PRIMARY KEY,
    identity jsonb NOT NULL,
    current_work_id uuid REFERENCES ingestion.run(id)
);

CREATE TABLE research.work (
    run_id uuid PRIMARY KEY REFERENCES ingestion.run(id),
    scope_key text NOT NULL REFERENCES research.scope(scope_key),
    policy_version text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE research.request (
    user_id text NOT NULL,
    id uuid NOT NULL,
    request jsonb NOT NULL,
    work_id uuid REFERENCES research.work(run_id),
    status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED')),
    disposition text CHECK (disposition IN ('CREATED', 'JOINED', 'REUSED')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, id)
);
CREATE INDEX research_request_user_created ON research.request(user_id, created_at DESC);
CREATE INDEX research_request_work ON research.request(work_id);

CREATE TABLE research.checkpoint (
    work_id uuid NOT NULL REFERENCES research.work(run_id),
    key text NOT NULL CHECK (key ~ '^[a-z0-9-]{1,100}$'),
    payload text NOT NULL CHECK (octet_length(payload) <= 12000000),
    sequence bigint GENERATED ALWAYS AS IDENTITY,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (work_id, key)
);

CREATE FUNCTION research.prevent_checkpoint_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Research checkpoints are immutable';
END;
$$;
CREATE TRIGGER immutable_research_checkpoint BEFORE UPDATE OR DELETE ON research.checkpoint
    FOR EACH ROW EXECUTE FUNCTION research.prevent_checkpoint_mutation();
