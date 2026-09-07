-- One source run now proposes and publishes claims for several configurations.
ALTER TABLE ingestion.run ADD COLUMN configuration_ids jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE ingestion.run SET configuration_ids = jsonb_build_object(request->>'name', configuration_id)
WHERE configuration_id IS NOT NULL AND request ? 'name';
UPDATE ingestion.run SET draft = jsonb_build_object(
 'source', draft->'source',
 'configurations', jsonb_build_array(jsonb_build_object(
   'name', request->>'name', 'identityLineStart', draft->'identityLineStart', 'identityLineEnd', draft->'identityLineEnd',
   'identityExcerpt', draft->'identityExcerpt', 'claims', draft->'claims', 'warnings', '[]'::jsonb)),
 'warnings', '[]'::jsonb)
WHERE draft IS NOT NULL AND draft ? 'claims';
UPDATE ingestion.run SET decision = jsonb_build_object(
 'draftHash', decision->'draftHash', 'baseRevision', decision->'baseRevision',
 'configurations', jsonb_build_array(jsonb_build_object(
   'configuration', 0, 'selectedClaims', decision->'selectedClaims', 'identityConfirmed', decision->'identityConfirmed')),
 'reason', decision->'reason')
WHERE decision IS NOT NULL AND decision ? 'selectedClaims';
UPDATE ingestion.run SET request = (request - 'name' - 'configurationId') || jsonb_build_object('configurations', jsonb_build_array(request->'name'))
WHERE request ? 'name';
ALTER TABLE ingestion.run DROP COLUMN configuration_id;
ALTER TABLE ingestion.selection_decision DROP CONSTRAINT selection_decision_run_id_attribute_id_key;
ALTER TABLE ingestion.selection_decision ADD CONSTRAINT selection_decision_run_configuration_attribute_key UNIQUE(run_id, configuration_id, attribute_id);
