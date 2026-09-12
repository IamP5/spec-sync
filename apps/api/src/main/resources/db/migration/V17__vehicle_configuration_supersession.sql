ALTER TABLE catalog.vehicle_configuration
    ADD COLUMN superseded_by uuid REFERENCES catalog.vehicle_configuration(id);

ALTER TABLE catalog.vehicle_configuration
    ADD CONSTRAINT vehicle_configuration_not_self_superseded
    CHECK (superseded_by IS NULL OR superseded_by <> id);

CREATE INDEX vehicle_configuration_active_idx
    ON catalog.vehicle_configuration(model_id, market, model_year)
    WHERE superseded_by IS NULL;

COMMENT ON COLUMN catalog.vehicle_configuration.superseded_by IS
    'Canonical configuration that replaces this catalog identity; superseded rows remain for audit history.';
