import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const manifestUrl = new URL('./manifest.mjs', import.meta.url);
const bytes = readFileSync(manifestUrl);
const { default: manifest } = await import(manifestUrl.href);
const digest = createHash('sha256').update(bytes).digest('hex');

const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const nullableLiteral = (value) =>
  value === null || value === undefined ? 'NULL' : literal(value);
const json = (value) => `${literal(JSON.stringify(value))}::jsonb`;
const uuid = (seed) => {
  const hex = createHash('sha256').update(`specsync:${seed}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

function validate() {
  assert.match(manifest.version, /^[a-z0-9-]+$/);
  assert.equal(manifest.brand, 'Ford');
  assert.match(manifest.capturedOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(manifest.sources.length > 0);
  assert.ok(manifest.attributes.length > 0);
  assert.ok(manifest.models.length > 0);

  const sources = new Map();
  for (const source of manifest.sources) {
    assert.match(source.sha256, /^[0-9a-f]{64}$/);
    assert.equal(source.provenance, 'PRIMARY_SOURCE');
    assert.ok(source.upstreamUrls.every((url) => url.startsWith('https://')));
    assert.ok(!sources.has(source.key));
    sources.set(source.key, source);
  }

  const attributes = new Map();
  for (const attribute of manifest.attributes) {
    assert.match(attribute.code, /^[a-z][a-z0-9_]*$/);
    assert.ok(
      ['NUMBER', 'TEXT', 'LIST', 'AVAILABILITY'].includes(attribute.valueType),
    );
    if (attribute.unit != null) assert.equal(attribute.valueType, 'NUMBER');
    assert.ok(!attributes.has(attribute.code));
    attributes.set(attribute.code, attribute);
  }

  const identities = new Set();
  for (const model of manifest.models) {
    for (const configuration of model.configurations) {
      const identity = `${model.name}/${configuration.name}/${configuration.market}/${configuration.modelYear}`;
      assert.ok(
        !identities.has(identity),
        `Duplicate configuration: ${identity}`,
      );
      identities.add(identity);
      assert.ok(sources.has(configuration.identity.source));
      const cells = new Set();
      for (const specification of configuration.specifications) {
        const attribute = attributes.get(specification.attribute);
        assert.ok(attribute, `Unknown attribute: ${specification.attribute}`);
        assert.ok(sources.has(specification.source));
        assert.ok(
          !cells.has(specification.attribute),
          `Duplicate cell: ${identity}/${specification.attribute}`,
        );
        cells.add(specification.attribute);
        if (attribute.valueType === 'AVAILABILITY') {
          assert.ok(
            ['STANDARD', 'OPTIONAL', 'ABSENT', 'NOT_APPLICABLE'].includes(
              specification.availability,
            ),
          );
          assert.equal(specification.value, undefined);
        } else if (attribute.valueType === 'LIST') {
          assert.ok(Array.isArray(specification.value));
          assert.ok(
            specification.value.every((item) => typeof item === 'string'),
          );
        } else if (attribute.valueType === 'NUMBER') {
          assert.equal(typeof specification.value, 'number');
          assert.ok(Number.isFinite(specification.value));
        } else {
          assert.equal(typeof specification.value, 'string');
          assert.ok(specification.value.length > 0);
        }
      }
    }
  }
  assert.equal(identities.size, manifest.expected.configurationCount);
  assert.equal(manifest.models.length, manifest.expected.modelCount);
}

const sourceId = (key) =>
  uuid(
    `source:${key}:${manifest.sources.find((source) => source.key === key).sha256}`,
  );
const evidenceId = (source, locator, excerpt) =>
  uuid(`evidence:${sourceId(source)}:${locator}:${excerpt}`);
const configurationLookup = (model, configuration) => `(
  SELECT c.id FROM catalog.vehicle_configuration c
  JOIN catalog.vehicle_model m ON m.id = c.model_id
  JOIN catalog.brand b ON b.id = m.brand_id
  WHERE b.name = ${literal(manifest.brand)} AND m.name = ${literal(model.name)}
    AND c.name = ${literal(configuration.name)} AND c.market = ${literal(configuration.market)}
    AND c.model_year = ${configuration.modelYear}
)`;

function sourceSql(source) {
  return `INSERT INTO catalog.source_revision
    (id,path,sha256,title,provenance,upstream_urls,captured_on,published_on)
  SELECT ${literal(sourceId(source.key))}::uuid, ${literal(source.path)}, ${literal(source.sha256)},
    ${literal(source.title)}, ${literal(source.provenance)}, ${json(source.upstreamUrls)},
    ${literal(source.capturedOn)}::date, ${nullableLiteral(source.publishedOn)}::date
  WHERE (SELECT run FROM _ford_import_guard)
  ON CONFLICT DO NOTHING;`;
}

function evidenceSql(evidence) {
  return `INSERT INTO catalog.evidence
    (id,source_revision_id,line_start,line_end,excerpt,locator)
  SELECT ${literal(evidenceId(evidence.source, evidence.locator, evidence.excerpt))}::uuid,
    ${literal(sourceId(evidence.source))}::uuid, 1, 1,
    ${literal(evidence.excerpt)}, ${literal(evidence.locator)}
  WHERE (SELECT run FROM _ford_import_guard)
  ON CONFLICT (id) DO NOTHING;`;
}

function attributeSql(attribute) {
  return `INSERT INTO catalog.attribute_definition
    (id,code,label,description,value_type,unit)
  SELECT ${literal(uuid(`attribute:${attribute.code}`))}::uuid, ${literal(attribute.code)},
    ${literal(attribute.label)}, ${literal(attribute.description)}, ${literal(attribute.valueType)},
    ${nullableLiteral(attribute.unit)}
  WHERE (SELECT run FROM _ford_import_guard)
  ON CONFLICT (code) DO NOTHING;`;
}

function assertionValue(attribute, specification) {
  if (attribute.valueType === 'AVAILABILITY')
    return ['NULL', literal(specification.availability)];
  return [json(specification.value), 'NULL'];
}

function configurationSql(model, configuration) {
  const identity = configuration.identity;
  const deterministicId = uuid(
    `configuration:${manifest.brand}:${model.name}:${configuration.name}:${configuration.market}:${configuration.modelYear}`,
  );
  const identityEvidenceId = evidenceId(
    identity.source,
    identity.locator,
    identity.excerpt,
  );
  const statements = [
    evidenceSql(identity),
    `INSERT INTO catalog.vehicle_configuration
      (id,model_id,name,market,model_year,identity_status,identity_evidence_id,identity_note)
    SELECT ${literal(deterministicId)}::uuid, m.id, ${literal(configuration.name)},
      ${literal(configuration.market)}, ${configuration.modelYear}, 'RESOLVED_FROM_PRIMARY_SOURCE',
      ${literal(identityEvidenceId)}::uuid, ${literal(identity.note)}
    FROM catalog.vehicle_model m
    JOIN catalog.brand b ON b.id = m.brand_id
    WHERE b.name = ${literal(manifest.brand)} AND m.name = ${literal(model.name)}
      AND (SELECT run FROM _ford_import_guard)
    ON CONFLICT DO NOTHING;`,
    `UPDATE catalog.vehicle_configuration
      SET identity_status = 'RESOLVED_FROM_PRIMARY_SOURCE',
          identity_evidence_id = ${literal(identityEvidenceId)}::uuid,
          identity_note = ${literal(identity.note)}
      WHERE id = ${configurationLookup(model, configuration)}
        AND (SELECT run FROM _ford_import_guard);`,
  ];

  for (const specification of configuration.specifications) {
    const attribute = manifest.attributes.find(
      (item) => item.code === specification.attribute,
    );
    const evidence = {
      source: specification.source,
      locator: specification.locator,
      excerpt: specification.excerpt,
    };
    const assertionId = uuid(
      `assertion:${manifest.version}:${model.name}:${configuration.name}:${configuration.market}:${configuration.modelYear}:${specification.attribute}:${JSON.stringify(specification.value ?? specification.availability)}:${specification.source}:${specification.locator}`,
    );
    const [value, availability] = assertionValue(attribute, specification);
    statements.push(
      evidenceSql(evidence),
      `INSERT INTO catalog.spec_assertion
        (id,configuration_id,attribute_id,value_type,value,availability,qualifiers,raw_value,review_status)
      SELECT ${literal(assertionId)}::uuid, ${configurationLookup(model, configuration)}, d.id,
        ${literal(attribute.valueType)}, ${value}, ${availability}, ${json(specification.qualifiers ?? {})},
        ${literal(specification.rawValue)}, 'VERIFIED'
      FROM catalog.attribute_definition d
      WHERE d.code = ${literal(attribute.code)} AND (SELECT run FROM _ford_import_guard)
      ON CONFLICT (id) DO NOTHING;`,
      `INSERT INTO catalog.assertion_evidence (assertion_id,evidence_id)
      SELECT ${literal(assertionId)}::uuid,
        ${literal(evidenceId(evidence.source, evidence.locator, evidence.excerpt))}::uuid
      WHERE (SELECT run FROM _ford_import_guard)
      ON CONFLICT DO NOTHING;`,
      `INSERT INTO catalog.accepted_specification
        (configuration_id,attribute_id,knowledge_status,assertion_id,reason)
      SELECT ${configurationLookup(model, configuration)}, d.id, 'KNOWN', ${literal(assertionId)}::uuid,
        ${literal('Selected from the current official Ford Brasil source captured on 2026-09-12.')}
      FROM catalog.attribute_definition d
      WHERE d.code = ${literal(attribute.code)} AND (SELECT run FROM _ford_import_guard)
      ON CONFLICT (configuration_id,attribute_id) DO UPDATE
        SET knowledge_status = EXCLUDED.knowledge_status,
            assertion_id = EXCLUDED.assertion_id,
            reason = EXCLUDED.reason;`,
    );
  }
  return statements.join('\n');
}

function generateSql() {
  validate();
  const lines = [
    'BEGIN;',
    'CREATE TEMP TABLE _ford_import_guard (run boolean NOT NULL) ON COMMIT DROP;',
    `INSERT INTO _ford_import_guard VALUES (NOT EXISTS (
      SELECT 1 FROM catalog.seed_dataset WHERE version = ${literal(manifest.version)}
    ));`,
    `DO $check$ BEGIN
      IF EXISTS (SELECT 1 FROM catalog.seed_dataset WHERE version = ${literal(manifest.version)} AND sha256 <> ${literal(digest)}) THEN
        RAISE EXCEPTION 'Ford Brasil dataset version exists with a different checksum';
      END IF;
    END $check$;`,
    ...manifest.sources.map(sourceSql),
    `INSERT INTO catalog.brand (id,name)
      SELECT ${literal(uuid(`brand:${manifest.brand}`))}::uuid, ${literal(manifest.brand)}
      WHERE (SELECT run FROM _ford_import_guard)
      ON CONFLICT (name) DO NOTHING;`,
    ...manifest.models.map(
      (model) => `INSERT INTO catalog.vehicle_model (id,brand_id,name)
        SELECT ${literal(uuid(`model:${manifest.brand}:${model.name}`))}::uuid, b.id, ${literal(model.name)}
        FROM catalog.brand b
        WHERE b.name = ${literal(manifest.brand)} AND (SELECT run FROM _ford_import_guard)
        ON CONFLICT (brand_id,name) DO NOTHING;`,
    ),
    ...manifest.attributes.map(attributeSql),
    `DO $attributes$ BEGIN
      IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(${json(
          manifest.attributes.map((attribute) => ({
            code: attribute.code,
            value_type: attribute.valueType,
            unit: attribute.unit ?? null,
          })),
        )} ) AS expected(code text,value_type text,unit text)
        JOIN catalog.attribute_definition actual USING (code)
        WHERE actual.value_type <> expected.value_type
           OR actual.unit IS DISTINCT FROM expected.unit
      ) THEN
        RAISE EXCEPTION 'Ford Brasil dataset conflicts with an existing attribute definition';
      END IF;
    END $attributes$;`,
    ...manifest.models.flatMap((model) =>
      model.configurations.map((configuration) =>
        configurationSql(model, configuration),
      ),
    ),
    ...manifest.supersessions.map((supersession) => {
      const targetModel = manifest.models.find(
        (model) => model.name === supersession.target.model,
      );
      const target = targetModel.configurations.find(
        (configuration) =>
          configuration.name === supersession.target.name &&
          configuration.modelYear === supersession.target.modelYear,
      );
      assert.ok(target);
      return `UPDATE catalog.vehicle_configuration
        SET superseded_by = ${configurationLookup(targetModel, target)}
        WHERE id = ${literal(supersession.configurationId)}::uuid
          AND superseded_by IS NULL AND (SELECT run FROM _ford_import_guard);`;
    }),
    `INSERT INTO catalog.seed_dataset (version,sha256)
      SELECT ${literal(manifest.version)}, ${literal(digest)}
      WHERE (SELECT run FROM _ford_import_guard);`,
    `WITH bumped AS (
      UPDATE ingestion.catalog_version SET revision = revision + 1
      WHERE id AND (SELECT run FROM _ford_import_guard)
      RETURNING revision
    )
    INSERT INTO ingestion.projection_event (revision,run_id)
      SELECT revision,NULL FROM bumped;`,
    'COMMIT;',
    `SELECT json_build_object(
      'models', count(DISTINCT m.id),
      'configurations', count(DISTINCT c.id),
      'knownSpecifications', count(DISTINCT (s.configuration_id,s.attribute_id)),
      'withImages', count(DISTINCT i.configuration_id)
    )
    FROM catalog.vehicle_configuration c
    JOIN catalog.vehicle_model m ON m.id=c.model_id
    JOIN catalog.brand b ON b.id=m.brand_id
    LEFT JOIN catalog.accepted_specification s ON s.configuration_id=c.id AND s.knowledge_status='KNOWN'
    LEFT JOIN catalog.vehicle_image i ON i.configuration_id=c.id
    WHERE b.name=${literal(manifest.brand)} AND c.superseded_by IS NULL;`,
  ];
  return lines.join('\n');
}

if (process.argv[2] !== 'sql') {
  throw new Error('Usage: node tools/catalog/ford-brasil-2026/import.mjs sql');
}

console.log(generateSql());
