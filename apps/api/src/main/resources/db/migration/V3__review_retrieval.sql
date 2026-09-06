-- Read model foundation only. No acquisition, extraction or publication endpoint is provided.
CREATE TABLE catalog.attribute_alias (
 id uuid PRIMARY KEY, attribute_id uuid NOT NULL REFERENCES catalog.attribute_definition(id),
 term text NOT NULL, language text NOT NULL DEFAULT 'pt-BR', UNIQUE(attribute_id, term, language)
);
CREATE TABLE catalog.review_source_revision (
 id uuid PRIMARY KEY, document_id uuid NOT NULL, url text NOT NULL CHECK (url ~ '^https?://'),
 title text NOT NULL, author text, media_type text NOT NULL CHECK(media_type IN ('ARTICLE','BLOG','VIDEO','SOCIAL')),
 published_on date, captured_on date NOT NULL, sha256 text NOT NULL,
 UNIQUE(document_id,sha256)
);
CREATE TABLE catalog.review_chunk (
 id uuid PRIMARY KEY, source_revision_id uuid NOT NULL REFERENCES catalog.review_source_revision(id),
 text text NOT NULL CHECK(length(text)>0), locator text NOT NULL,
 start_seconds numeric, end_seconds numeric,
 embedding jsonb, embedding_model text,
 CHECK(start_seconds IS NULL OR start_seconds>=0),
 CHECK(end_seconds IS NULL OR start_seconds IS NOT NULL AND end_seconds>=start_seconds),
 CHECK((embedding IS NULL) = (embedding_model IS NULL)),
 CHECK(embedding IS NULL OR jsonb_typeof(embedding)='array')
);
CREATE TABLE catalog.review_aspect (
 id uuid PRIMARY KEY, code text NOT NULL UNIQUE, label text NOT NULL
);
CREATE TABLE catalog.review_aspect_attribute (
 aspect_id uuid NOT NULL REFERENCES catalog.review_aspect(id),
 attribute_id uuid NOT NULL REFERENCES catalog.attribute_definition(id),
 PRIMARY KEY(aspect_id,attribute_id)
);
CREATE TABLE catalog.review_observation (
 id uuid PRIMARY KEY, chunk_id uuid NOT NULL REFERENCES catalog.review_chunk(id),
 model_id uuid NOT NULL REFERENCES catalog.vehicle_model(id),
 configuration_id uuid REFERENCES catalog.vehicle_configuration(id),
 aspect_id uuid NOT NULL REFERENCES catalog.review_aspect(id),
 start_offset integer NOT NULL CHECK(start_offset>=0), end_offset integer NOT NULL CHECK(end_offset>start_offset),
 kind text NOT NULL CHECK(kind IN ('OPINION','MEASUREMENT','REPORTED_SPEC','OWNER_EXPERIENCE')),
 sentiment text CHECK(sentiment IN ('POSITIVE','NEGATIVE','NEUTRAL','MIXED')),
 conditions text, review_status text NOT NULL CHECK(review_status IN ('PENDING','ACCEPTED','REJECTED'))
);
CREATE FUNCTION catalog.validate_review_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.end_offset > (SELECT length(text) FROM catalog.review_chunk WHERE id=NEW.chunk_id) THEN
  RAISE EXCEPTION 'Review excerpt lies outside its source passage';
 END IF;
 IF NEW.configuration_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM catalog.vehicle_configuration WHERE id=NEW.configuration_id AND model_id=NEW.model_id) THEN
  RAISE EXCEPTION 'Review configuration does not belong to its model';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER review_observation_valid BEFORE INSERT OR UPDATE ON catalog.review_observation
 FOR EACH ROW EXECUTE FUNCTION catalog.validate_review_observation();
