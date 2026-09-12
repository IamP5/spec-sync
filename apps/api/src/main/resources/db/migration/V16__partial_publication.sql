-- A review may publish part of a draft and come back for the rest, so a run keeps every
-- publication it made, oldest first. `decision` stays the latest one for existing readers.
ALTER TABLE ingestion.run ADD COLUMN decisions jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE ingestion.run SET decisions = jsonb_build_array(decision) WHERE decision IS NOT NULL;
