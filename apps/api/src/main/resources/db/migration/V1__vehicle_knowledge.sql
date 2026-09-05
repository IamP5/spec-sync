CREATE SCHEMA catalog;

CREATE TABLE catalog.brand (
    id uuid PRIMARY KEY,
    name text NOT NULL UNIQUE CHECK (btrim(name) <> '')
);

CREATE TABLE catalog.vehicle_model (
    id uuid PRIMARY KEY,
    brand_id uuid NOT NULL REFERENCES catalog.brand(id),
    name text NOT NULL CHECK (btrim(name) <> ''),
    UNIQUE (brand_id, name)
);

CREATE TABLE catalog.source_revision (
    id uuid PRIMARY KEY,
    path text NOT NULL,
    sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    title text NOT NULL,
    provenance text NOT NULL CHECK (provenance IN ('CURATED_NOTES', 'PRIMARY_SOURCE')),
    upstream_urls jsonb NOT NULL CHECK (jsonb_typeof(upstream_urls) = 'array'),
    captured_on date NOT NULL,
    published_on date,
    UNIQUE (path, sha256)
);

CREATE TABLE catalog.evidence (
    id uuid PRIMARY KEY,
    source_revision_id uuid NOT NULL REFERENCES catalog.source_revision(id),
    line_start integer NOT NULL CHECK (line_start > 0),
    line_end integer NOT NULL CHECK (line_end >= line_start),
    excerpt text NOT NULL CHECK (btrim(excerpt) <> ''),
    locator text NOT NULL CHECK (btrim(locator) <> '')
);

CREATE TABLE catalog.vehicle_configuration (
    id uuid PRIMARY KEY,
    model_id uuid NOT NULL REFERENCES catalog.vehicle_model(id),
    name text NOT NULL CHECK (btrim(name) <> ''),
    market text NOT NULL CHECK (market ~ '^[A-Z]{2}$'),
    model_year integer CHECK (model_year BETWEEN 1900 AND 2200),
    identity_status text NOT NULL CHECK (identity_status IN ('RESOLVED_FROM_NOTES', 'PROVISIONAL')),
    identity_evidence_id uuid NOT NULL REFERENCES catalog.evidence(id),
    identity_note text NOT NULL,
    UNIQUE NULLS NOT DISTINCT (model_id, name, market, model_year)
);

CREATE TABLE catalog.attribute_definition (
    id uuid PRIMARY KEY,
    code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]*$'),
    label text NOT NULL,
    description text NOT NULL,
    value_type text NOT NULL CHECK (value_type IN ('NUMBER', 'TEXT', 'LIST', 'AVAILABILITY')),
    unit text,
    CHECK (unit IS NULL OR value_type = 'NUMBER'),
    UNIQUE (id, value_type)
);

CREATE TABLE catalog.spec_assertion (
    id uuid PRIMARY KEY,
    configuration_id uuid NOT NULL REFERENCES catalog.vehicle_configuration(id),
    attribute_id uuid NOT NULL,
    value_type text NOT NULL,
    value jsonb,
    availability text CHECK (availability IN ('STANDARD', 'OPTIONAL', 'ABSENT', 'NOT_APPLICABLE')),
    qualifiers jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(qualifiers) = 'object'),
    raw_value text NOT NULL,
    review_status text NOT NULL CHECK (review_status IN ('CURATED_FROM_NOTES', 'VERIFIED', 'REJECTED')),
    FOREIGN KEY (attribute_id, value_type) REFERENCES catalog.attribute_definition(id, value_type),
    UNIQUE (id, configuration_id, attribute_id),
    CHECK (
        (value_type = 'NUMBER' AND value IS NOT NULL AND jsonb_typeof(value) = 'number' AND availability IS NULL)
        OR (value_type = 'TEXT' AND value IS NOT NULL AND jsonb_typeof(value) = 'string' AND availability IS NULL)
        OR (value_type = 'LIST' AND value IS NOT NULL AND jsonb_typeof(value) = 'array' AND availability IS NULL)
        OR (value_type = 'AVAILABILITY' AND value IS NULL AND availability IS NOT NULL)
    )
);

CREATE TABLE catalog.assertion_evidence (
    assertion_id uuid NOT NULL REFERENCES catalog.spec_assertion(id),
    evidence_id uuid NOT NULL REFERENCES catalog.evidence(id),
    PRIMARY KEY (assertion_id, evidence_id)
);

CREATE TABLE catalog.accepted_specification (
    configuration_id uuid NOT NULL REFERENCES catalog.vehicle_configuration(id),
    attribute_id uuid NOT NULL REFERENCES catalog.attribute_definition(id),
    knowledge_status text NOT NULL CHECK (knowledge_status IN ('KNOWN', 'NOT_REPORTED', 'CONFLICTING')),
    assertion_id uuid,
    reason text NOT NULL CHECK (btrim(reason) <> ''),
    PRIMARY KEY (configuration_id, attribute_id),
    FOREIGN KEY (assertion_id, configuration_id, attribute_id)
        REFERENCES catalog.spec_assertion(id, configuration_id, attribute_id),
    CHECK ((knowledge_status = 'KNOWN') = (assertion_id IS NOT NULL))
);

-- Validate publication at commit so assertions and evidence can be inserted in one transaction.
CREATE FUNCTION catalog.validate_accepted_specification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.knowledge_status = 'KNOWN' AND NOT EXISTS (
        SELECT 1 FROM catalog.spec_assertion a
        JOIN catalog.assertion_evidence e ON e.assertion_id = a.id
        WHERE a.id = NEW.assertion_id AND a.review_status <> 'REJECTED'
    ) THEN
        RAISE EXCEPTION 'An accepted specification requires a non-rejected, evidenced assertion';
    END IF;
    IF NEW.knowledge_status = 'CONFLICTING' AND (
        SELECT count(DISTINCT a.id) FROM catalog.spec_assertion a
        JOIN catalog.assertion_evidence e ON e.assertion_id = a.id
        WHERE a.configuration_id = NEW.configuration_id AND a.attribute_id = NEW.attribute_id
            AND a.review_status <> 'REJECTED'
    ) < 2 THEN
        RAISE EXCEPTION 'A conflicting cell requires at least two evidenced assertions';
    END IF;
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER validate_accepted_specification
AFTER INSERT OR UPDATE ON catalog.accepted_specification
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION catalog.validate_accepted_specification();

CREATE TABLE catalog.feature_package (
    id uuid PRIMARY KEY,
    model_id uuid NOT NULL REFERENCES catalog.vehicle_model(id),
    name text NOT NULL,
    scope_note text NOT NULL,
    evidence_id uuid NOT NULL REFERENCES catalog.evidence(id)
);

CREATE TABLE catalog.package_item (
    package_id uuid NOT NULL REFERENCES catalog.feature_package(id),
    attribute_id uuid NOT NULL REFERENCES catalog.attribute_definition(id),
    qualifiers jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(qualifiers) = 'object'),
    evidence_id uuid NOT NULL REFERENCES catalog.evidence(id),
    PRIMARY KEY (package_id, attribute_id)
);

CREATE TABLE catalog.configuration_package (
    configuration_id uuid NOT NULL REFERENCES catalog.vehicle_configuration(id),
    package_id uuid NOT NULL REFERENCES catalog.feature_package(id),
    availability text NOT NULL CHECK (availability IN ('STANDARD', 'OPTIONAL')),
    evidence_id uuid NOT NULL REFERENCES catalog.evidence(id),
    PRIMARY KEY (configuration_id, package_id)
);

CREATE TABLE catalog.seed_dataset (
    version text PRIMARY KEY,
    sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX spec_assertion_cell_idx ON catalog.spec_assertion(configuration_id, attribute_id);
CREATE INDEX assertion_evidence_source_idx ON catalog.assertion_evidence(evidence_id);
CREATE INDEX configuration_model_idx ON catalog.vehicle_configuration(model_id);

-- Read contract for the next comparison slice. A missing cell is never equipment absence.
CREATE VIEW catalog.specification_matrix AS
SELECT c.id AS configuration_id, c.name AS configuration_name, c.market, c.model_year,
       d.id AS attribute_id, d.code AS attribute_code, d.label, d.value_type, d.unit,
       coalesce(s.knowledge_status, 'NOT_REPORTED') AS knowledge_status,
       coalesce(s.reason, 'No accepted observation is available.') AS reason,
       a.id AS assertion_id, a.value, a.availability, a.qualifiers,
       a.review_status
FROM catalog.vehicle_configuration c CROSS JOIN catalog.attribute_definition d
LEFT JOIN catalog.accepted_specification s ON s.configuration_id = c.id AND s.attribute_id = d.id
LEFT JOIN catalog.spec_assertion a ON a.id = s.assertion_id;
