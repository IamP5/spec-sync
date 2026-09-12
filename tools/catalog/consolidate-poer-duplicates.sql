BEGIN;

CREATE TEMP TABLE configuration_merge (
    duplicate_id uuid PRIMARY KEY,
    canonical_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO configuration_merge (duplicate_id, canonical_id) VALUES
    ('89ef7b7e-0d3a-4d16-9102-847a1c469b08', '12e2ae8a-41af-4672-b102-4fdbabb7fc36'),
    ('4864b1c4-09c6-4287-83ac-035e67c669fa', '034f5331-ed0e-479e-a2c6-3a665db151a9');

DO $$
BEGIN
    IF (SELECT count(*) FROM catalog.vehicle_configuration c
            JOIN configuration_merge m ON c.id IN (m.duplicate_id, m.canonical_id)) <> 4 THEN
        RAISE EXCEPTION 'Expected all four Poer configuration identities';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM configuration_merge x
        JOIN catalog.vehicle_configuration duplicate ON duplicate.id = x.duplicate_id
        JOIN catalog.vehicle_configuration canonical ON canonical.id = x.canonical_id
        WHERE duplicate.model_id <> canonical.model_id
            OR duplicate.market <> canonical.market
            OR duplicate.model_year IS DISTINCT FROM canonical.model_year
    ) THEN
        RAISE EXCEPTION 'Poer duplicate and canonical identities do not share model, market and model year';
    END IF;
END;
$$;

CREATE TEMP TABLE assertion_merge (
    old_id uuid PRIMARY KEY,
    new_id uuid NOT NULL UNIQUE,
    canonical_id uuid NOT NULL,
    attribute_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO assertion_merge (old_id, new_id, canonical_id, attribute_id)
SELECT
    assertion.id,
    md5('configuration-merge:' || assertion.id::text || ':' || merge.canonical_id::text)::uuid,
    merge.canonical_id,
    assertion.attribute_id
FROM configuration_merge merge
JOIN catalog.spec_assertion assertion ON assertion.configuration_id = merge.duplicate_id;

INSERT INTO catalog.spec_assertion (
    id, configuration_id, attribute_id, value_type, value, availability,
    qualifiers, raw_value, review_status
)
SELECT
    merge.new_id, merge.canonical_id, assertion.attribute_id,
    assertion.value_type, assertion.value, assertion.availability,
    assertion.qualifiers, assertion.raw_value, assertion.review_status
FROM assertion_merge merge
JOIN catalog.spec_assertion assertion ON assertion.id = merge.old_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog.assertion_evidence (assertion_id, evidence_id)
SELECT merge.new_id, evidence.evidence_id
FROM assertion_merge merge
JOIN catalog.assertion_evidence evidence ON evidence.assertion_id = merge.old_id
ON CONFLICT (assertion_id, evidence_id) DO NOTHING;

-- Preserve an existing canonical selection when both identities published the
-- same attribute; the copied assertion remains visible as supporting evidence.
INSERT INTO catalog.accepted_specification (
    configuration_id, attribute_id, knowledge_status, assertion_id, reason
)
SELECT
    merge.canonical_id,
    accepted.attribute_id,
    accepted.knowledge_status,
    CASE WHEN accepted.assertion_id IS NULL THEN NULL ELSE merge.new_id END,
    'Consolidated from superseded duplicate configuration. ' || accepted.reason
FROM configuration_merge configuration
JOIN catalog.accepted_specification accepted
    ON accepted.configuration_id = configuration.duplicate_id
LEFT JOIN assertion_merge merge
    ON merge.old_id = accepted.assertion_id
    AND merge.canonical_id = configuration.canonical_id
ON CONFLICT (configuration_id, attribute_id) DO NOTHING;

UPDATE catalog.vehicle_configuration duplicate
SET superseded_by = merge.canonical_id
FROM configuration_merge merge
WHERE duplicate.id = merge.duplicate_id
    AND duplicate.superseded_by IS DISTINCT FROM merge.canonical_id;

COMMIT;

SELECT json_build_object(
    'activeConfigurations', (
        SELECT count(*) FROM catalog.vehicle_configuration WHERE superseded_by IS NULL
    ),
    'supersededConfigurations', (
        SELECT count(*) FROM catalog.vehicle_configuration WHERE superseded_by IS NOT NULL
    ),
    'activeConfigurationsWithoutImages', (
        SELECT count(*)
        FROM catalog.vehicle_configuration configuration
        LEFT JOIN catalog.vehicle_image image ON image.configuration_id = configuration.id
        WHERE configuration.superseded_by IS NULL AND image.configuration_id IS NULL
    )
);
