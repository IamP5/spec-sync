import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';

import { migrate, project, seed } from './cli.mjs';
import { neo4j, postgres } from './database.mjs';
import {
  loadDataset,
  projectionStatements,
  seedSql,
  sha256,
  snapshotSql,
  sqlLiteral,
} from './foundation.mjs';

let dataset;
let digest;
const snapshot = async () => JSON.parse(await postgres(snapshotSql()));
const graphMetadata = async () =>
  (
    await neo4j([
      {
        statement: `MATCH (p:SpecSyncCatalog:CatalogProjection {id: 'catalog'}) RETURN p.fingerprint, toString(p.projected_at)`,
      },
    ])
  )[0].data[0].row;

before(async () => {
  ({ dataset, digest } = await loadDataset());
  // The services must already be healthy (api:data-up). No destructive reset is performed.
  await migrate();
  await seed();
  await project();
});

test('migrations, seed and projection can be repeated without changing PostgreSQL facts', async () => {
  const before = await snapshot();
  await migrate();
  await seed();
  await project();
  assert.deepEqual(await snapshot(), before);
  assert.equal((await graphMetadata())[0], sha256(JSON.stringify(before)));
  assert.equal(
    await postgres(
      'SELECT count(*) FROM public.flyway_schema_history WHERE success;',
    ),
    '4',
  );
});

test('rejects altered seed versions without changing either database', async () => {
  const before = await snapshot();
  const graphBefore = await graphMetadata();
  await assert.rejects(
    postgres(seedSql(dataset, '0'.repeat(64))),
    /different checksum/,
  );
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(await graphMetadata(), graphBefore);
});

test('refuses to overwrite a curated row even when the caller reuses the original digest', async () => {
  const altered = structuredClone(dataset);
  altered.tables.brand[0].name = 'Not Ford';
  const before = await snapshot();
  await assert.rejects(
    postgres(seedSql(altered, digest)),
    /conflicts with existing records/,
  );
  assert.deepEqual(await snapshot(), before);
});

test('database rejects a numeric attribute containing a text value and rolls back', async () => {
  const before = await snapshot();
  const assertion = dataset.tables.spec_assertion.find(
    (a) => a.value_type === 'NUMBER',
  );
  await assert.rejects(
    postgres(`BEGIN;
    INSERT INTO catalog.spec_assertion
    SELECT '${randomUUID()}', configuration_id, attribute_id, value_type, '"not a number"'::jsonb,
      availability, qualifiers, raw_value, review_status
    FROM catalog.spec_assertion WHERE id = '${assertion.id}';
    COMMIT;`),
    /check constraint/,
  );
  assert.deepEqual(await snapshot(), before);
});

test('database rejects publishing an assertion from another configuration', async () => {
  const known = dataset.tables.accepted_specification.find(
    (c) => c.knowledge_status === 'KNOWN',
  );
  const wrong = dataset.tables.spec_assertion.find(
    (a) =>
      a.configuration_id !== known.configuration_id &&
      a.attribute_id === known.attribute_id,
  );
  const before = await snapshot();
  await assert.rejects(
    postgres(`BEGIN;
    UPDATE catalog.accepted_specification SET assertion_id = '${wrong.id}'
    WHERE configuration_id = '${known.configuration_id}' AND attribute_id = '${known.attribute_id}';
    COMMIT;`),
    /foreign key constraint/,
  );
  assert.deepEqual(await snapshot(), before);
});

test('publication requires evidence, and evidence cannot be silently edited or detached', async () => {
  const a = dataset.tables.spec_assertion[0];
  const id = randomUUID();
  const before = await snapshot();
  await assert.rejects(
    postgres(`BEGIN;
    INSERT INTO catalog.spec_assertion
    SELECT '${id}', configuration_id, attribute_id, value_type, value, availability, qualifiers, raw_value, review_status
    FROM catalog.spec_assertion WHERE id = '${a.id}';
    UPDATE catalog.accepted_specification SET assertion_id = '${id}'
    WHERE configuration_id = '${a.configuration_id}' AND attribute_id = '${a.attribute_id}';
    COMMIT;`),
    /requires a non-rejected, evidenced assertion/,
  );
  await assert.rejects(
    postgres(
      `UPDATE catalog.evidence SET excerpt = 'changed' WHERE id = '${dataset.tables.evidence[0].id}';`,
    ),
    /append-only/,
  );
  await assert.rejects(
    postgres(
      `DELETE FROM catalog.assertion_evidence WHERE assertion_id = '${a.id}';`,
    ),
    /append-only/,
  );
  assert.deepEqual(await snapshot(), before);
});

test('a failed graph replacement rolls back deletion, new nodes, and the version marker', async () => {
  const before = await graphMetadata();
  const current = await snapshot();
  const statements = projectionStatements(current, 'must-not-be-published');
  statements.push({
    statement: 'CREATE (:SpecSyncCatalog:Brand {id: $id})',
    parameters: { id: current.brand[0].id },
  });
  await assert.rejects(neo4j(statements), /ConstraintValidationFailed/);
  assert.deepEqual(await graphMetadata(), before);
  const count = await neo4j([
    {
      statement:
        'MATCH (c:SpecSyncCatalog:VehicleConfiguration) RETURN count(c)',
    },
  ]);
  assert.equal(count[0].data[0].row[0], current.vehicle_configuration.length);
});

test('matrix preserves conflict, missing data, and known equipment absence across both stores', async () => {
  const result = JSON.parse(
    await postgres(`SELECT jsonb_object_agg(knowledge_status, total) FROM (
    SELECT knowledge_status, count(*) AS total FROM catalog.specification_matrix GROUP BY knowledge_status
  ) counts;`),
  );
  assert.deepEqual(result, { KNOWN: 72, NOT_REPORTED: 31, CONFLICTING: 2 });
  const graph = await neo4j([
    {
      statement: `MATCH (c:SpecSyncCatalog:SpecificationCell)
      OPTIONAL MATCH (c)-[:SELECTS]->(a:SpecAssertion)
      RETURN c.knowledge_status, count(c), count(a) ORDER BY c.knowledge_status`,
    },
  ]);
  assert.deepEqual(
    graph[0].data.map((d) => d.row),
    [
      ['CONFLICTING', 2, 0],
      ['KNOWN', 72, 72],
      ['NOT_REPORTED', 31, 0],
    ],
  );
});

test('package traversal preserves optional availability and evidence', async () => {
  const result = await neo4j([
    {
      statement: `MATCH (c:SpecSyncCatalog:VehicleConfiguration)-[h:HAS_PACKAGE]->(p:FeaturePackage)-[b:BUNDLES]->(a:AttributeDefinition {code: 'adaptive_cruise'})
      MATCH (e:Evidence {id: b.evidence_id})-[:FROM_REVISION]->(s:SourceRevision)
      RETURN c.name, h.availability, b.qualifiers_json, s.provenance`,
    },
  ]);
  assert.equal(result[0].data.length, 1);
  const row = result[0].data[0].row;
  assert.equal(row[0], 'Limited 3.0 V6 AT Diesel');
  assert.equal(row[1], 'OPTIONAL');
  assert.equal(JSON.parse(row[2]).stop_and_go, true);
  assert.equal(row[3], 'CURATED_NOTES');
});

test('source-like SQL syntax remains literal data in a transaction', async () => {
  const text = "a quote ' and $seed$ and a backslash \\ and `command`";
  assert.equal(await postgres(`SELECT ${sqlLiteral(text)};`), text);
});
