import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const dataRoot = dirname(fileURLToPath(import.meta.url));
export const workspaceRoot = resolve(dataRoot, '../../..');
export const tableNames = [
  'brand',
  'vehicle_model',
  'source_revision',
  'evidence',
  'vehicle_configuration',
  'attribute_definition',
  'spec_assertion',
  'assertion_evidence',
  'accepted_specification',
  'feature_package',
  'package_item',
  'configuration_package',
];
export const sha256 = (text) => createHash('sha256').update(text).digest('hex');
export const sqlLiteral = (text) => {
  assert.equal(typeof text, 'string');
  assert(!text.includes('\0'), 'SQL text cannot contain a null byte');
  return `'${text.replaceAll("'", "''")}'`;
};

export async function loadDataset() {
  const bytes = await readFile(resolve(dataRoot, 'curated-pickups.json'));
  const dataset = JSON.parse(bytes.toString());
  const documents = {};
  for (const source of dataset.tables.source_revision) {
    assert(/^sources\/[a-z-]+\.md$/.test(source.path), 'Invalid source path');
    documents[source.path] = await readFile(
      resolve(dataRoot, source.path),
      'utf8',
    );
  }
  validateDataset(dataset, documents);
  return { dataset, digest: sha256(bytes) };
}

export function validateDataset(dataset, documents) {
  assert.match(dataset.version, /^[a-z0-9-]+$/);
  assert.deepEqual(Object.keys(dataset.tables).sort(), [...tableNames].sort());
  const t = dataset.tables;
  const maps = {};
  for (const table of tableNames) {
    assert(Array.isArray(t[table]), `Invalid table ${table}`);
    maps[table] = new Map();
    for (const row of t[table]) {
      if (!('id' in row)) continue;
      assert.match(
        row.id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      assert(!maps[table].has(row.id), `Duplicate ID in ${table}`);
      maps[table].set(row.id, row);
    }
  }
  const ref = (table, id) => {
    assert(maps[table].has(id), `Missing ${table} reference ${id}`);
    return maps[table].get(id);
  };
  for (const m of t.vehicle_model) ref('brand', m.brand_id);
  for (const s of t.source_revision) {
    assert.equal(
      sha256(documents[s.path]),
      s.sha256,
      `Source checksum mismatch: ${s.path}`,
    );
    assert.equal(
      s.provenance,
      'CURATED_NOTES',
      'This seed is based on supplied notes',
    );
  }
  for (const e of t.evidence) {
    const s = ref('source_revision', e.source_revision_id);
    assert(
      Number.isInteger(e.line_start) &&
        e.line_start > 0 &&
        e.line_end >= e.line_start,
    );
    assert.equal(
      documents[s.path]
        .split('\n')
        .slice(e.line_start - 1, e.line_end)
        .join('\n'),
      e.excerpt,
      `Evidence does not match source: ${e.id}`,
    );
  }
  for (const c of t.vehicle_configuration) {
    ref('vehicle_model', c.model_id);
    ref('evidence', c.identity_evidence_id);
    assert(/^[A-Z]{2}$/.test(c.market));
  }
  const evidenceByAssertion = new Map();
  for (const e of t.assertion_evidence) {
    ref('spec_assertion', e.assertion_id);
    ref('evidence', e.evidence_id);
    const ids = evidenceByAssertion.get(e.assertion_id) ?? new Set();
    assert(!ids.has(e.evidence_id), 'Duplicate assertion evidence');
    ids.add(e.evidence_id);
    evidenceByAssertion.set(e.assertion_id, ids);
  }
  for (const a of t.spec_assertion) {
    ref('vehicle_configuration', a.configuration_id);
    const definition = ref('attribute_definition', a.attribute_id);
    assert.equal(
      a.value_type,
      definition.value_type,
      'Assertion type differs from attribute',
    );
    assert(evidenceByAssertion.has(a.id), 'Every assertion requires evidence');
    assert.equal(a.review_status, 'CURATED_FROM_NOTES');
    if (a.value_type === 'NUMBER')
      assert(typeof a.value === 'number' && Number.isFinite(a.value));
    else if (a.value_type === 'TEXT')
      assert(typeof a.value === 'string' && a.value.length > 0);
    else if (a.value_type === 'LIST')
      assert(
        Array.isArray(a.value) && a.value.every((x) => typeof x === 'string'),
      );
    else {
      assert.equal(a.value_type, 'AVAILABILITY');
      assert.equal(a.value, null);
      assert(
        ['STANDARD', 'OPTIONAL', 'ABSENT', 'NOT_APPLICABLE'].includes(
          a.availability,
        ),
      );
    }
    if (a.value_type !== 'AVAILABILITY') assert.equal(a.availability, null);
  }
  const cells = new Set();
  for (const c of t.accepted_specification) {
    ref('vehicle_configuration', c.configuration_id);
    ref('attribute_definition', c.attribute_id);
    const key = `${c.configuration_id}/${c.attribute_id}`;
    assert(!cells.has(key), 'Duplicate accepted cell');
    cells.add(key);
    if (c.knowledge_status === 'KNOWN') {
      const a = ref('spec_assertion', c.assertion_id);
      assert.equal(
        a.configuration_id,
        c.configuration_id,
        'Accepted assertion belongs to another configuration',
      );
      assert.equal(
        a.attribute_id,
        c.attribute_id,
        'Accepted assertion belongs to another attribute',
      );
    } else {
      assert.equal(c.assertion_id, null);
      assert(['NOT_REPORTED', 'CONFLICTING'].includes(c.knowledge_status));
      if (c.knowledge_status === 'CONFLICTING') {
        assert(
          t.spec_assertion.filter(
            (a) =>
              a.configuration_id === c.configuration_id &&
              a.attribute_id === c.attribute_id,
          ).length >= 2,
        );
      }
    }
  }
  assert.equal(
    cells.size,
    t.vehicle_configuration.length * t.attribute_definition.length,
    'Seed matrix must be complete',
  );
  for (const p of t.feature_package) {
    ref('vehicle_model', p.model_id);
    ref('evidence', p.evidence_id);
  }
  for (const p of t.package_item) {
    ref('feature_package', p.package_id);
    assert.equal(
      ref('attribute_definition', p.attribute_id).value_type,
      'AVAILABILITY',
    );
    ref('evidence', p.evidence_id);
  }
  for (const p of t.configuration_package) {
    assert.equal(
      ref('vehicle_configuration', p.configuration_id).model_id,
      ref('feature_package', p.package_id).model_id,
    );
    assert(['STANDARD', 'OPTIONAL'].includes(p.availability));
    ref('evidence', p.evidence_id);
  }
}

export function seedSql(dataset, digest) {
  const inserts = tableNames
    .map((table) => {
      const json = sqlLiteral(JSON.stringify(dataset.tables[table]));
      return `INSERT INTO catalog.${table} SELECT * FROM jsonb_populate_recordset(NULL::catalog.${table}, ${json}::jsonb) ON CONFLICT DO NOTHING;
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(${json}::jsonb) expected
        WHERE NOT EXISTS (SELECT 1 FROM catalog.${table} actual WHERE to_jsonb(actual) = expected)) THEN
        RAISE EXCEPTION 'Seed conflicts with existing records in ${table}; no records were overwritten';
      END IF;`;
    })
    .join('\n');
  // Dollar quoting is only used for the fixed PL/pgSQL envelope. Dataset values cannot close it.
  const body = `BEGIN
    PERFORM pg_advisory_xact_lock(742191);
    IF EXISTS (SELECT 1 FROM catalog.seed_dataset WHERE version = ${sqlLiteral(dataset.version)} AND sha256 <> ${sqlLiteral(digest)}) THEN
      RAISE EXCEPTION 'Seed version already exists with a different checksum; create an explicit new revision';
    END IF;
    ${inserts}
    INSERT INTO catalog.seed_dataset(version, sha256) VALUES (${sqlLiteral(dataset.version)}, ${sqlLiteral(digest)}) ON CONFLICT DO NOTHING;
  END;`;
  let delimiter = '$seed$';
  while (body.includes(delimiter))
    delimiter = delimiter.replace('$seed', '$seed_');
  return `BEGIN;\nSET LOCAL standard_conforming_strings = on;\nDO ${delimiter}\n${body}\n${delimiter};\nCOMMIT;`;
}

export function snapshotSql() {
  const entries = [...tableNames, 'seed_dataset'].map(
    (name) =>
      `${sqlLiteral(name)}, (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) FROM catalog.${name} t)`,
  );
  // All tables are read in one PostgreSQL statement and therefore one consistent MVCC snapshot.
  return `SELECT jsonb_build_object(${entries.join(',')});`;
}

export function projectionStatements(snapshot, fingerprint) {
  const statements = [
    { statement: 'MATCH (p:SpecSyncReview:ReviewProjection) DELETE p' },
    { statement: 'MATCH (n:SpecSyncCatalog) DETACH DELETE n' },
  ];
  const node = (table, label, props) =>
    statements.push({
      statement: `UNWIND $rows AS row CREATE (n:SpecSyncCatalog:${label}) SET n = row`,
      parameters: { rows: snapshot[table].map(props) },
    });
  node('brand', 'Brand', (r) => r);
  node('vehicle_model', 'VehicleModel', (r) => r);
  node('vehicle_configuration', 'VehicleConfiguration', (r) => r);
  node('attribute_definition', 'AttributeDefinition', (r) => r);
  node('source_revision', 'SourceRevision', (r) => r);
  node('evidence', 'Evidence', (r) => r);
  // Neo4j properties cannot store nested maps. Preserve typed values and qualifiers as JSON.
  node('spec_assertion', 'SpecAssertion', ({ value, qualifiers, ...r }) => ({
    ...r,
    value_json: JSON.stringify(value),
    qualifiers_json: JSON.stringify(qualifiers),
    value_number: r.value_type === 'NUMBER' ? value : null,
    value_text: r.value_type === 'TEXT' ? value : null,
    value_list: r.value_type === 'LIST' ? value : null,
  }));
  node('feature_package', 'FeaturePackage', (r) => r);
  node('accepted_specification', 'SpecificationCell', (r) => ({
    ...r,
    id: `${r.configuration_id}/${r.attribute_id}`,
  }));
  const edge = (table, left, leftKey, rel, right, rightKey, props = '') =>
    statements.push({
      statement: `UNWIND $rows AS row MATCH (l:SpecSyncCatalog:${left} {id: row.${leftKey}})
      MATCH (r:SpecSyncCatalog:${right} {id: row.${rightKey}}) CREATE (l)-[e:${rel}]->(r) ${props}`,
      parameters: {
        rows: snapshot[table].map((r) => ({
          ...r,
          cell_id: `${r.configuration_id}/${r.attribute_id}`,
          qualifiers_json: JSON.stringify(r.qualifiers ?? {}),
        })),
      },
    });
  edge('vehicle_model', 'VehicleModel', 'id', 'MADE_BY', 'Brand', 'brand_id');
  edge(
    'vehicle_configuration',
    'VehicleModel',
    'model_id',
    'HAS_CONFIGURATION',
    'VehicleConfiguration',
    'id',
  );
  edge(
    'vehicle_configuration',
    'VehicleConfiguration',
    'id',
    'IDENTIFIED_BY',
    'Evidence',
    'identity_evidence_id',
  );
  edge(
    'spec_assertion',
    'VehicleConfiguration',
    'configuration_id',
    'HAS_ASSERTION',
    'SpecAssertion',
    'id',
  );
  edge(
    'spec_assertion',
    'SpecAssertion',
    'id',
    'FOR_ATTRIBUTE',
    'AttributeDefinition',
    'attribute_id',
  );
  edge(
    'assertion_evidence',
    'SpecAssertion',
    'assertion_id',
    'SUPPORTED_BY',
    'Evidence',
    'evidence_id',
  );
  edge(
    'evidence',
    'Evidence',
    'id',
    'FROM_REVISION',
    'SourceRevision',
    'source_revision_id',
  );
  edge(
    'accepted_specification',
    'VehicleConfiguration',
    'configuration_id',
    'HAS_CELL',
    'SpecificationCell',
    'cell_id',
  );
  edge(
    'accepted_specification',
    'SpecificationCell',
    'cell_id',
    'FOR_ATTRIBUTE',
    'AttributeDefinition',
    'attribute_id',
  );
  edge(
    'accepted_specification',
    'SpecificationCell',
    'cell_id',
    'SELECTS',
    'SpecAssertion',
    'assertion_id',
  );
  edge(
    'feature_package',
    'FeaturePackage',
    'id',
    'FOR_MODEL',
    'VehicleModel',
    'model_id',
  );
  edge(
    'feature_package',
    'FeaturePackage',
    'id',
    'SUPPORTED_BY',
    'Evidence',
    'evidence_id',
  );
  edge(
    'configuration_package',
    'VehicleConfiguration',
    'configuration_id',
    'HAS_PACKAGE',
    'FeaturePackage',
    'package_id',
    'SET e.availability = row.availability, e.evidence_id = row.evidence_id',
  );
  edge(
    'package_item',
    'FeaturePackage',
    'package_id',
    'BUNDLES',
    'AttributeDefinition',
    'attribute_id',
    'SET e.qualifiers_json = row.qualifiers_json, e.evidence_id = row.evidence_id',
  );
  statements.push({
    statement: `CREATE (p:SpecSyncCatalog:CatalogProjection {id: 'catalog', fingerprint: $fingerprint, seed_versions: $versions, projected_at: datetime()})`,
    parameters: {
      fingerprint,
      versions: snapshot.seed_dataset.map((r) => r.version),
    },
  });
  return statements;
}

export const projectionConstraints = [
  'Brand',
  'VehicleModel',
  'VehicleConfiguration',
  'AttributeDefinition',
  'SourceRevision',
  'Evidence',
  'SpecAssertion',
  'FeaturePackage',
  'SpecificationCell',
  'CatalogProjection',
].map((label) => ({
  statement: `CREATE CONSTRAINT specsync_${label.toLowerCase()}_id IF NOT EXISTS FOR (n:${label}) REQUIRE n.id IS UNIQUE`,
}));
