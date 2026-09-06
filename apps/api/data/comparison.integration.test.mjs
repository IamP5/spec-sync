import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { compose, neo4j } from './database.mjs';
import { workspaceRoot } from './foundation.mjs';

let app;
let base;
let configurations;
let logs = '';

before(async () => {
  const graphAddress = await compose(['port', 'neo4j', '7474']);
  const address = await compose(['port', 'postgres', '5432']);
  assert.match(address, /^127\.0\.0\.1:\d+$/, 'Run api:data-up first');
  const jarDirectory = `${workspaceRoot}/apps/api/build/libs`;
  const jars = (await readdir(jarDirectory)).filter(
    (name) => name.endsWith('.jar') && !name.endsWith('-plain.jar'),
  );
  assert.equal(jars.length, 1, 'Expected one boot jar; run api:bootJar');
  app = spawn(
    'java',
    [
      '-jar',
      `${jarDirectory}/${jars[0]}`,
      '--server.address=127.0.0.1',
      '--server.port=0',
      `--specsync.knowledge.url=http://${graphAddress}`,
      '--specsync.knowledge.username=neo4j',
      '--specsync.knowledge.password=specsync-local',
      '--spring.profiles.active=default',
      '--spring.docker.compose.enabled=false',
      '--spring.cloud.gcp.core.enabled=false',
      '--spring.cloud.gcp.sql.enabled=false',
      '--spring.cloud.gcp.pubsub.enabled=false',
      '--spring.cloud.gcp.storage.enabled=false',
      '--spring.cloud.gcp.project-id=comparison-test',
      '--spring.ai.model.chat=none',
      `--spring.datasource.url=jdbc:postgresql://${address}/mydatabase`,
      '--spring.datasource.username=myuser',
      '--spring.datasource.password=secret',
    ],
    { cwd: `${workspaceRoot}/apps/api`, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`API startup timed out:\n${logs}`)),
      60000,
    );
    const finish = (error) => {
      clearTimeout(timeout);
      error ? reject(error) : resolve();
    };
    app.once('error', finish);
    app.once('exit', (code) =>
      finish(new Error(`API exited (${code}):\n${logs}`)),
    );
    const collect = (chunk) => {
      logs = (logs + chunk).slice(-24000);
      const match = logs.match(/Tomcat started on port (\d+)/);
      if (match) {
        base = `http://127.0.0.1:${match[1]}`;
        finish();
      }
    };
    app.stdout.on('data', collect);
    app.stderr.on('data', collect);
  });
  const result = await request('/api/vehicle-configurations?limit=100');
  assert.equal(result.status, 200, JSON.stringify(result.body));
  configurations = result.body.items;
});

after(async () => {
  if (!app || app.exitCode !== null || app.signalCode !== null) return;
  const closed = once(app, 'close');
  app.kill('SIGTERM');
  const timeout = setTimeout(() => app.kill('SIGKILL'), 10000);
  try {
    await closed;
  } finally {
    clearTimeout(timeout);
  }
});

async function request(path) {
  const response = await fetch(`${base}${path}`, {
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json();
  return {
    status: response.status,
    body,
    contentType: response.headers.get('content-type'),
  };
}
function id(version) {
  return configurations.find((c) => c.name.includes(version)).id;
}
function url(ids, attributes) {
  const query = new URLSearchParams({ configurationIds: ids.join(',') });
  if (attributes) query.set('attributes', attributes.join(','));
  return `/api/comparisons?${query}`;
}

test('searches and paginates the PostgreSQL catalog over HTTP', async () => {
  assert.equal(configurations.length, 5);
  const first = await request(
    '/api/vehicle-configurations?q=ranger&market=BR&modelYear=2026&limit=1',
  );
  const second = await request(
    '/api/vehicle-configurations?q=ranger&limit=1&offset=1',
  );
  assert.equal(first.status, 200);
  assert.equal(first.body.hasMore, true);
  assert.equal(second.body.hasMore, false);
  assert.notEqual(first.body.items[0].id, second.body.items[0].id);
  const literal = await request('/api/vehicle-configurations?q=%25');
  assert.deepEqual(literal.body.items, []);
});

test('returns complete ordered rows and all evidence for conflicting claims', async () => {
  const ids = [id('SRX'), id('Black')];
  const result = await request(url(ids, ['camera_360', 'drivetrain']));
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.deepEqual(
    result.body.configurations.map((c) => c.id),
    ids,
  );
  assert.deepEqual(
    result.body.rows.map((r) => r.attribute.code),
    ['camera_360', 'drivetrain'],
  );
  for (const cell of [
    result.body.rows[0].cells[0],
    result.body.rows[1].cells[1],
  ]) {
    assert.equal(cell.knowledgeStatus, 'CONFLICTING');
    assert.equal(cell.selectedObservationId, null);
    assert.equal(cell.observations.length, 2);
    for (const observation of cell.observations) {
      assert.ok(observation.evidence.length > 0);
      assert.equal(observation.evidence[0].provenance, 'CURATED_NOTES');
      assert.match(observation.evidence[0].sha256, /^[a-f0-9]{64}$/);
    }
  }
  assert.equal(result.body.rows[1].cells[0].knowledgeStatus, 'NOT_REPORTED');
});

test('serializes numeric values, qualifiers and optional equipment without coercion', async () => {
  const result = await request(
    url([id('SRX'), id('Limited')], ['torque_max', 'camera_360']),
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.rows[0].attribute.unit, 'Nm');
  assert.equal(result.body.rows[0].cells[0].observations[0].value, 499.158485);
  assert.ok(
    Object.keys(result.body.rows[0].cells[0].observations[0].qualifiers).length,
  );
  const cell = result.body.rows[1].cells[1];
  assert.equal(cell.knowledgeStatus, 'KNOWN');
  assert.equal(
    cell.observations.find((o) => o.id === cell.selectedObservationId)
      .availability,
    'OPTIONAL',
  );
});

test('lists attributes and expands omitted selection to all 21 rows', async () => {
  const attributes = await request('/api/comparison-attributes');
  assert.equal(attributes.status, 200);
  assert.equal(attributes.body.items.length, 21);
  const result = await request(url([id('Black'), id('Limited')]));
  assert.equal(result.status, 200);
  assert.equal(result.body.rows.length, 21);
  assert.ok(result.body.rows.every((row) => row.cells.length === 2));
});

test('returns problem details for malformed, invalid and unknown selections', async () => {
  for (const [path, status] of [
    ['/api/comparisons', 400],
    ['/api/comparisons?configurationIds=bad-uuid', 400],
    [url([id('Black')]), 422],
    [url([id('Black'), id('Black')]), 422],
    [url([id('Black'), '00000000-0000-0000-0000-000000000000']), 422],
    [url([id('Black'), id('Limited')], ['invented']), 422],
    ['/api/vehicle-configurations?limit=0', 422],
    ['/api/vehicle-configurations?modelYear=bad', 400],
  ]) {
    const response = await request(path);
    assert.equal(
      response.status,
      status,
      `${path}: ${JSON.stringify(response.body)}`,
    );
    assert.match(response.contentType, /application\/problem\+json/);
  }
});

test('single-vehicle specifications retain every attribute and source', async () => {
  const result = await request(
    `/api/vehicle-specifications?configurationId=${configurations[0].id}`,
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.configurations.length, 1);
  assert.equal(result.body.rows.length, 21);
});
test('graph discovers accepted optional camera with package evidence', async () => {
  const result = await request(
    '/api/knowledge/capabilities?attributeCode=camera_360',
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.status, 'OK', JSON.stringify(result.body));
  const limited = result.body.items.find(
    (i) => i.configurationId === 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1',
  );
  assert.equal(limited.availability, 'OPTIONAL');
  assert.ok(limited.packages.length);
  assert.ok(limited.evidenceIds.length);
  assert.ok(
    !result.body.items.some(
      (i) => i.configurationId === 'c28c64e4-801a-5d29-b4c2-083a888a79f3',
    ),
  );
  const standard = await request(
    '/api/knowledge/capabilities?attributeCode=camera_360&includeOptional=false',
  );
  assert.ok(
    !standard.body.items.some(
      (i) => i.configurationId === limited.configurationId,
    ),
  );
});
test('graph terminology preserves code and rejects malformed filters', async () => {
  const result = await request('/api/knowledge/concepts?q=torque_max');
  assert.equal(result.body.status, 'OK');
  assert.equal(result.body.items[0].code, 'torque_max');
  assert.equal(
    (await request('/api/knowledge/capabilities?attributeCode=bad-code'))
      .status,
    422,
  );
});
test('review traversal returns exact scoped excerpts without treating related opinion as specification evidence', async () => {
  const marker = 'specsync-review-http-test';
  const config = 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1';
  try {
    await neo4j([
      {
        statement: `
 MATCH (configuration:SpecSyncCatalog:VehicleConfiguration {id:$config})
 MATCH (attribute:SpecSyncCatalog:AttributeDefinition {code:'rear_suspension'})
 CREATE (source:SpecSyncReview:SourceRevision {test_run:$marker,id:'test-source',title:'Synthetic review test fixture',url:'https://example.com/test-review',media_type:'ARTICLE'})
 CREATE (chunk:SpecSyncReview:ContentChunk {test_run:$marker,id:'11111111-1111-4111-8111-111111111111',text:'Test: firm ride unloaded.',locator:'Test paragraph'})-[:FROM_REVISION]->(source)
 CREATE (aspect:SpecSyncReview:ReviewAspect {test_run:$marker,id:'test-aspect'})-[:RELATES_TO]->(attribute)
 CREATE (observation:SpecSyncReview:ReviewObservation {test_run:$marker,id:'test-observation',configuration_id:$config,model_id:configuration.model_id,review_status:'ACCEPTED',start_offset:6,end_offset:25,kind:'OPINION',conditions:'unloaded'})-[:ABOUT]->(aspect)
 CREATE (observation)-[:SUPPORTED_BY]->(chunk)`,
        parameters: { marker, config },
      },
    ]);
    const related = await request(
      `/api/knowledge/related-reviews?configurationId=${config}&attributeCode=rear_suspension`,
    );
    assert.equal(related.body.status, 'OK', JSON.stringify(related.body));
    const item = related.body.items.find((i) => i.id === 'test-observation');
    assert.equal(item.excerpt, 'firm ride unloaded.');
    assert.equal(item.scope, 'CONFIGURATION');
    assert.equal(item.kind, 'OPINION');
    const other = await request(
      '/api/knowledge/related-reviews?configurationId=08e08761-a2e7-5ae5-b2ad-387e93829fb7&attributeCode=rear_suspension',
    );
    assert.ok(!other.body.items.some((i) => i.id === 'test-observation'));
    const excerpt = await request(
      '/api/knowledge/evidence/11111111-1111-4111-8111-111111111111',
    );
    assert.equal(excerpt.body.items[0].excerpt, item.excerpt);
    const lexical = await request(
      `/api/knowledge/reviews?q=firm&configurationId=${config}`,
    );
    assert.equal(lexical.body.status, 'OK', JSON.stringify(lexical.body));
  } finally {
    await neo4j([
      {
        statement:
          'MATCH (n:SpecSyncReview {test_run:$marker}) DETACH DELETE n',
        parameters: { marker },
      },
    ]);
  }
});
