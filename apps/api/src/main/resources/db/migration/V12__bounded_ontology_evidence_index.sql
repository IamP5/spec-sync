-- Evidence may contain a large table excerpt; index its digest rather than the JSON document.
DO $$ DECLARE name text; BEGIN
 FOR name IN SELECT conname FROM pg_constraint WHERE conrelid='catalog.ontology_proposal_evidence'::regclass AND contype='u'
 LOOP EXECUTE format('ALTER TABLE catalog.ontology_proposal_evidence DROP CONSTRAINT %I',name); END LOOP;
END $$;
CREATE UNIQUE INDEX ontology_evidence_identity ON catalog.ontology_proposal_evidence
 (proposal_id,run_id,configuration_name,(md5(observation::text)));
