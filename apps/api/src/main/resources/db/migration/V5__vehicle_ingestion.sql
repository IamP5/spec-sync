CREATE SCHEMA ingestion;
CREATE TABLE ingestion.catalog_version (id boolean PRIMARY KEY DEFAULT true CHECK (id), revision bigint NOT NULL DEFAULT 0);
INSERT INTO ingestion.catalog_version DEFAULT VALUES;
CREATE TABLE ingestion.run (
 id uuid PRIMARY KEY, owner_name text NOT NULL, request jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('QUEUED','PROCESSING','REVIEW','PUBLISHED','REJECTED','FAILED')),
 attempts integer NOT NULL DEFAULT 0, lease_token uuid, lease_until timestamptz,
 draft jsonb, draft_hash text, base_revision bigint, configuration_id uuid REFERENCES catalog.vehicle_configuration(id),
 decision jsonb, error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ingestion_work ON ingestion.run(status,created_at);
CREATE TABLE ingestion.source_capture (
 run_id uuid PRIMARY KEY REFERENCES ingestion.run(id), url text NOT NULL, title text NOT NULL,
 mime_type text NOT NULL, original_bytes bytea NOT NULL, original_sha256 text NOT NULL,
 text_content text NOT NULL, text_sha256 text NOT NULL, parser_version text NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_capture BEFORE UPDATE OR DELETE ON ingestion.source_capture
FOR EACH ROW EXECUTE FUNCTION catalog.reject_observation_mutation();
CREATE TABLE ingestion.selection_decision (
 id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES ingestion.run(id), reviewer text NOT NULL,
 configuration_id uuid NOT NULL REFERENCES catalog.vehicle_configuration(id), attribute_id uuid NOT NULL REFERENCES catalog.attribute_definition(id),
 previous_selection jsonb, assertion_id uuid NOT NULL REFERENCES catalog.spec_assertion(id), reason text NOT NULL,
 revision bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(run_id,attribute_id)
);
CREATE TRIGGER immutable_selection_decision BEFORE UPDATE OR DELETE ON ingestion.selection_decision
FOR EACH ROW EXECUTE FUNCTION catalog.reject_observation_mutation();
CREATE TABLE ingestion.projection_event (
 revision bigint PRIMARY KEY, run_id uuid NOT NULL REFERENCES ingestion.run(id), created_at timestamptz NOT NULL DEFAULT now(), applied_at timestamptz
);
CREATE TABLE ingestion.projection_state (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), lease_token uuid, lease_until timestamptz,
 applied_revision bigint NOT NULL DEFAULT 0, error text
);
INSERT INTO ingestion.projection_state DEFAULT VALUES;
ALTER TABLE catalog.vehicle_configuration DROP CONSTRAINT vehicle_configuration_identity_status_check;
ALTER TABLE catalog.vehicle_configuration ADD CONSTRAINT vehicle_configuration_identity_status_check
CHECK(identity_status IN ('RESOLVED_FROM_NOTES','PROVISIONAL','RESOLVED_FROM_PRIMARY_SOURCE'));
