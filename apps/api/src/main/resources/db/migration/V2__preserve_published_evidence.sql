-- Corrections append observations and change the accepted selection. Historical evidence
-- remains immutable so past comparisons never acquire silently edited source material.
CREATE FUNCTION catalog.reject_observation_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% is append-only; create a new observation or source revision', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER immutable_source_revision BEFORE UPDATE OR DELETE ON catalog.source_revision
FOR EACH ROW EXECUTE FUNCTION catalog.reject_observation_mutation();

CREATE TRIGGER immutable_evidence BEFORE UPDATE OR DELETE ON catalog.evidence
FOR EACH ROW EXECUTE FUNCTION catalog.reject_observation_mutation();

CREATE TRIGGER immutable_spec_assertion BEFORE UPDATE OR DELETE ON catalog.spec_assertion
FOR EACH ROW EXECUTE FUNCTION catalog.reject_observation_mutation();

CREATE TRIGGER immutable_assertion_evidence BEFORE UPDATE OR DELETE ON catalog.assertion_evidence
FOR EACH ROW EXECUTE FUNCTION catalog.reject_observation_mutation();

ALTER TABLE catalog.spec_assertion ADD CONSTRAINT list_values_are_strings
CHECK (value_type <> 'LIST' OR NOT jsonb_path_exists(value, '$[*] ? (@.type() != "string")'));

ALTER TABLE catalog.spec_assertion ADD CONSTRAINT text_values_are_not_blank
CHECK (value_type <> 'TEXT' OR btrim(value #>> '{}') <> '');

ALTER TABLE catalog.spec_assertion ADD CONSTRAINT raw_values_are_not_blank
CHECK (btrim(raw_value) <> '');
