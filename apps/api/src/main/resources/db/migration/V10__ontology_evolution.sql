CREATE TABLE catalog.ontology_revision (
 revision bigint PRIMARY KEY, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO catalog.ontology_revision(revision,reason) VALUES(1,'Reviewed fuel, towing, passenger count and cargo bed concepts');

INSERT INTO catalog.attribute_definition(id,code,label,description,value_type,unit) VALUES
 ('ac000000-0000-0000-0000-000000000001','fuel_type','Combustível','Energy carriers explicitly reported by the source; combinations are supported. Hybrid is a powertrain type, not a fuel.','LIST',NULL),
 ('ac000000-0000-0000-0000-000000000002','towing_capacity','Capacidade de reboque','Maximum reported towing mass; braking and test conditions must remain qualified or UNKNOWN. Never payload.','NUMBER','kg'),
 ('ac000000-0000-0000-0000-000000000003','passenger_capacity','Número de passageiros','Nonnegative integer occupant count as reported. driverIncluded must be YES, NO or UNKNOWN; unknown must not be interpreted as total seats.','NUMBER',NULL),
 ('ac000000-0000-0000-0000-000000000004','cargo_bed_volume','Capacidade da caçamba','Cargo bed volume. Separate from payload mass and enclosed luggage volume.','NUMBER','L');

CREATE TABLE catalog.attribute_value (
 attribute_id uuid NOT NULL REFERENCES catalog.attribute_definition(id), code text NOT NULL,
 aliases jsonb NOT NULL DEFAULT '[]', introduced_revision bigint NOT NULL REFERENCES catalog.ontology_revision(revision),
 PRIMARY KEY(attribute_id,code)
);
INSERT INTO catalog.attribute_value(attribute_id,code,aliases,introduced_revision) VALUES
 ('ac000000-0000-0000-0000-000000000001','GASOLINE','["gasoline","gasolina"]',1),
 ('ac000000-0000-0000-0000-000000000001','ETHANOL','["ethanol","etanol","álcool"]',1),
 ('ac000000-0000-0000-0000-000000000001','DIESEL','["diesel"]',1),
 ('ac000000-0000-0000-0000-000000000001','CNG','["cng","gnv","gás natural veicular"]',1),
 ('ac000000-0000-0000-0000-000000000001','LPG','["lpg","glp"]',1),
 ('ac000000-0000-0000-0000-000000000001','ELECTRICITY','["electricity","eletricidade"]',1),
 ('ac000000-0000-0000-0000-000000000001','HYDROGEN','["hydrogen","hidrogênio"]',1);

CREATE TABLE catalog.manufacturer_term (
 id uuid PRIMARY KEY, attribute_id uuid NOT NULL REFERENCES catalog.attribute_definition(id),
 term text NOT NULL, term_key text NOT NULL, brand text NOT NULL, market text NOT NULL,
 language text NOT NULL, model text NOT NULL DEFAULT '', model_year integer NOT NULL DEFAULT 0,
 source_sha256 text NOT NULL, locator text NOT NULL, introduced_revision bigint NOT NULL REFERENCES catalog.ontology_revision(revision),
 UNIQUE(term_key,brand,market,language,model,model_year)
);
INSERT INTO catalog.manufacturer_term(id,attribute_id,term,term_key,brand,market,language,model,source_sha256,locator,introduced_revision)
SELECT id,id,label,CASE code WHEN 'fuel_type' THEN 'combustivel' WHEN 'towing_capacity' THEN 'capacidade de reboque' WHEN 'passenger_capacity' THEN 'numero de passageiros' ELSE 'capacidade da cacamba' END,
 'ford','BR','pt-BR','f-150','2c888070f2b5ac3561d21dacfddd110a4bfeb56deeb887f349dade30d58d11da','Ford F-150 technical table, page 2; reviewed source label',1
FROM catalog.attribute_definition WHERE code IN ('fuel_type','towing_capacity','passenger_capacity','cargo_bed_volume');

CREATE TABLE catalog.ontology_proposal (
 id uuid PRIMARY KEY, fingerprint text NOT NULL UNIQUE,
 kind text NOT NULL CHECK(kind IN ('ADD_ATTRIBUTE','ADD_ALIAS','EXTEND_VOCABULARY','REVIEW_SEMANTICS')),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACTIVATED')),
 brand text NOT NULL, model text NOT NULL, market text NOT NULL, language text NOT NULL, model_year integer NOT NULL,
 term text NOT NULL, term_key text NOT NULL, term_origin text NOT NULL,
 attribute_code text, proposed_code text, label text, definition text NOT NULL, value_type text NOT NULL,
 unit text, dimension text, alternatives jsonb NOT NULL DEFAULT '[]',
 base_revision bigint NOT NULL, activated_revision bigint REFERENCES catalog.ontology_revision(revision),
 reason text, reviewed_by text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE catalog.ontology_proposal_evidence (
 id uuid PRIMARY KEY, proposal_id uuid NOT NULL REFERENCES catalog.ontology_proposal(id),
 run_id uuid NOT NULL REFERENCES ingestion.run(id), configuration_name text NOT NULL,
 source_sha256 text NOT NULL, reader_revision text NOT NULL, observation jsonb NOT NULL,
 UNIQUE(proposal_id,run_id,configuration_name,observation)
);
CREATE TRIGGER immutable_ontology_evidence BEFORE UPDATE OR DELETE ON catalog.ontology_proposal_evidence
FOR EACH ROW EXECUTE FUNCTION catalog.reject_observation_mutation();
ALTER TABLE ingestion.run ADD COLUMN ontology_context jsonb;
ALTER TABLE research.work ADD COLUMN replayed_from_work_id uuid REFERENCES research.work(run_id);
CREATE UNIQUE INDEX research_replay_revision ON research.work(replayed_from_work_id,scope_key) WHERE replayed_from_work_id IS NOT NULL;
ALTER TABLE ingestion.projection_event ALTER COLUMN run_id DROP NOT NULL;
ALTER TABLE ingestion.projection_event ADD COLUMN ontology_revision bigint REFERENCES catalog.ontology_revision(revision);
UPDATE ingestion.catalog_version SET revision=revision+1;
INSERT INTO ingestion.projection_event(revision,ontology_revision) SELECT revision,1 FROM ingestion.catalog_version;
