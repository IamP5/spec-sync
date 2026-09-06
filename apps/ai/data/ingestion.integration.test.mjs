import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import neo4j from 'neo4j-driver';
import { projectIngestion } from '../src/mastra/graph/ingestion-projection.mjs';
import { compose } from './database.mjs';
import { workspaceRoot, loadDataset, seedSql } from './foundation.mjs';

const database = `ingestion_it_${randomUUID().replaceAll('-', '')}`;
const reviewerKey = randomUUID() + randomUUID(),
  workerKey = randomUUID() + randomUUID();
let app, server, base, address, workerAddress;
let logs = '',
  projectFails = true,
  extracted = 0,
  graphDriver,
  projected;
const graphContainer = `specsync-ingestion-it-${randomUUID()}`;
function docker(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args);
    let out = '',
      err = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (err += chunk));
    child.on('error', reject);
    child.on('close', (code) =>
      code ? reject(new Error(err)) : resolve(out.trim()),
    );
  });
}
const digest = (value) => createHash('sha256').update(value).digest('hex');
const text =
  'SYNTHETIC TEST ONLY: Ford Ranger Test 2026 BR\nTorque: 60,0 kgf.m at 2000 rpm\nCamera: optional in test package\nPayload: —';
const source = {
  url: 'https://www.ford.com.br/synthetic-test-only',
  title: 'Synthetic ingestion integration fixture',
  mimeType: 'text/html',
  originalBase64: Buffer.from(text).toString('base64'),
  originalSha256: digest(text),
  text,
  textSha256: digest(text),
  parserVersion: 'synthetic-test-v1',
};
const request = {
  sourceUrl: source.url,
  brand: 'Ford',
  model: 'Ranger',
  name: 'Synthetic ingestion test',
  market: 'BR',
  modelYear: 2026,
  configurationId: null,
};
const draft = {
  source,
  identityLineStart: 1,
  identityLineEnd: 1,
  identityExcerpt: text.split('\n')[0],
  claims: [
    {
      attributeCode: 'torque_max',
      rawValue: '60,0',
      rawUnit: 'kgf.m',
      availability: null,
      listValue: null,
      qualifiers: { rpm: '2000' },
      lineStart: 2,
      lineEnd: 2,
      excerpt: text.split('\n')[1],
      locator: 'Synthetic line 2',
    },
    {
      attributeCode: 'camera_360',
      rawValue: 'optional',
      rawUnit: null,
      availability: 'OPTIONAL',
      listValue: null,
      qualifiers: { package: 'test package' },
      lineStart: 3,
      lineEnd: 3,
      excerpt: text.split('\n')[2],
      locator: 'Synthetic line 3',
    },
    {
      attributeCode: 'payload',
      rawValue: '—',
      rawUnit: 'kg',
      availability: null,
      listValue: null,
      qualifiers: {},
      lineStart: 4,
      lineEnd: 4,
      excerpt: text.split('\n')[3],
      locator: 'Synthetic line 4',
    },
  ],
};
const sql = (statement) =>
  compose(
    [
      'exec',
      '-T',
      'postgres',
      'psql',
      '-X',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'myuser',
      '-d',
      database,
    ],
    { input: statement },
  );
async function stop() {
  if (app && app.exitCode === null && app.signalCode === null) {
    const done = once(app, 'close');
    app.kill('SIGTERM');
    await done;
  }
}
async function start() {
  const jars = (await readdir(`${workspaceRoot}/apps/api/build/libs`)).filter(
    (name) => name.endsWith('.jar') && !name.endsWith('-plain.jar'),
  );
  assert.equal(jars.length, 1);
  logs = '';
  app = spawn(
    'java',
    [
      '-jar',
      `${workspaceRoot}/apps/api/build/libs/${jars[0]}`,
      '--server.address=127.0.0.1',
      '--server.port=0',
      '--spring.profiles.active=default',
      '--spring.docker.compose.enabled=false',
      '--spring.cloud.gcp.core.enabled=false',
      '--spring.cloud.gcp.sql.enabled=false',
      '--spring.cloud.gcp.pubsub.enabled=false',
      '--spring.cloud.gcp.storage.enabled=false',
      '--spring.cloud.gcp.project-id=ingestion-test',
      '--spring.ai.model.chat=none',
      `--spring.datasource.url=jdbc:postgresql://${address}/${database}`,
      '--spring.datasource.username=myuser',
      '--spring.datasource.password=secret',
    ],
    {
      cwd: `${workspaceRoot}/apps/api`,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        SPECSYNC_INGESTION_ENABLED: 'true',
        SPECSYNC_INGESTION_REVIEWER_KEY: reviewerKey,
        SPECSYNC_INGESTION_WORKER_KEY: workerKey,
        SPECSYNC_INGESTION_WORKER_URL: workerAddress,
      },
    },
  );
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Startup timed out: ${logs}`)),
      60000,
    );
    const finish = (error) => {
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };
    app.once('error', finish);
    app.once('exit', (code) =>
      finish(new Error(`API exited ${code}: ${logs}`)),
    );
    const collect = (chunk) => {
      logs = (logs + chunk).slice(-20000);
      const match = logs.match(/Tomcat started on port (\d+)/);
      if (match) {
        base = `http://127.0.0.1:${match[1]}`;
        finish();
      }
    };
    app.stdout.on('data', collect);
    app.stderr.on('data', collect);
  });
}
before(async () => {
  address = await compose(['port', 'postgres', '5432']);
  assert.match(address, /^127\.0\.0\.1:\d+$/);
  await compose(
    [
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'myuser',
      '-d',
      'mydatabase',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: `CREATE DATABASE ${database};` },
  );
  await docker([
    'run',
    '-d',
    '--rm',
    '--name',
    graphContainer,
    '-p',
    '127.0.0.1::7687',
    '-e',
    'NEO4J_AUTH=neo4j/ingestion-test',
    '-e',
    'NEO4J_server_memory_heap_max__size=256m',
    '-e',
    'NEO4J_server_memory_pagecache_size=128m',
    'neo4j:5.26-community',
  ]);
  const graphAddress = await docker(['port', graphContainer, '7687']);
  assert.match(graphAddress, /^127\.0\.0\.1:\d+$/);
  process.env.SPECSYNC_INGESTION_NEO4J_URI = `bolt://${graphAddress}`;
  process.env.SPECSYNC_INGESTION_NEO4J_USERNAME = 'neo4j';
  process.env.SPECSYNC_INGESTION_NEO4J_PASSWORD = 'ingestion-test';
  graphDriver = neo4j.driver(
    `bolt://${graphAddress}`,
    neo4j.auth.basic('neo4j', 'ingestion-test'),
    { maxTransactionRetryTime: 0, connectionTimeout: 2000 },
  );
  const graphDeadline = Date.now() + 60000;
  while (true) {
    try {
      await graphDriver.verifyConnectivity();
      break;
    } catch (error) {
      if (Date.now() > graphDeadline) throw error;
      await delay(500);
    }
  }
  server = createServer(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${workerKey}`) {
      res.writeHead(401).end();
      return;
    }
    let body = '';
    for await (const chunk of req) body += chunk;
    const input = JSON.parse(body);
    res.setHeader('content-type', 'application/json');
    if (req.url === '/internal/ingestion/extract') {
      extracted++;
      assert.equal(input.request.market, 'BR');
      res.end(JSON.stringify(draft));
    } else if (req.url === '/internal/ingestion/project') {
      assert.ok(input.snapshot.spec_assertion.length);
      if (projectFails)
        res.writeHead(503).end(JSON.stringify({ status: 'FAILED' }));
      else {
        try {
          await projectIngestion(input);
          projected = input;
          res.end(JSON.stringify({ status: 'CURRENT' }));
        } catch (error) {
          res.writeHead(503).end(JSON.stringify({ error: error.message }));
        }
      }
    } else res.writeHead(404).end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  workerAddress = `http://127.0.0.1:${server.address().port}`;
  await start();
  const data = await loadDataset();
  await sql(seedSql(data.dataset, data.digest));
});
after(async () => {
  await stop();
  if (graphDriver) await graphDriver.close();
  await docker(['rm', '-f', graphContainer]).catch(() => undefined);
  if (server) {
    server.closeAllConnections();
    server.close();
  }
  await compose(
    [
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'myuser',
      '-d',
      'mydatabase',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: `DROP DATABASE IF EXISTS ${database} WITH (FORCE);` },
  );
});
async function http(path, body, key = reviewerKey) {
  const response = await fetch(`${base}/api/ingestions${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key ? { 'X-Ingestion-Key': key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
async function waitFor(id, status, timeout = 45000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = await http(`/${id}`);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    if (result.body.result.status === status) return result.body.result;
    if (result.body.result.status === 'FAILED')
      throw new Error(`${JSON.stringify(result.body)} ${logs}`);
    await delay(300);
  }
  throw new Error(`Timed out waiting for ${status}: ${logs}`);
}
test(
  'durable drafts, evidence validation, reviewed publication, retries and isolation',
  { timeout: 150000 },
  async () => {
    const id = randomUUID();
    assert.equal((await http('', { id, request }, null)).status, 401);
    const created = await http('', { id, request });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    assert.equal((await http('', { id, request })).body.result.id, id);
    assert.equal(
      (await http('', { id, request: { ...request, name: 'different' } }))
        .status,
      422,
    );
    await stop();
    await start();
    let run = await waitFor(id, 'REVIEW');
    assert.equal(extracted, 1);
    assert.equal(run.draft.source.originalBase64, null);
    const original = await fetch(`${base}/api/ingestions/${id}/source`, {
      headers: { 'X-Ingestion-Key': reviewerKey },
    });
    assert.equal(original.status, 200);
    assert.equal(
      digest(Buffer.from(await original.arrayBuffer())),
      source.originalSha256,
    );
    assert.equal(
      (await fetch(`${base}/api/ingestions/${id}/source`)).status,
      401,
    );
    assert.equal(run.draft.claims[0].value, 588.399);
    assert.equal(run.draft.claims[1].availability, 'OPTIONAL');
    assert.ok(run.draft.claims[2].issues.length);
    assert.equal(
      await sql(
        "SELECT count(*) FROM catalog.vehicle_configuration WHERE name='Synthetic ingestion test'",
      ),
      '0',
    );
    const review = {
      draftHash: run.draftHash,
      baseRevision: run.baseRevision,
      selectedClaims: [0, 1],
      identityConfirmed: true,
      reason: 'Synthetic fixture verified for integration testing',
    };
    assert.equal(
      (
        await http(`/${id}/publish`, {
          review: { ...review, identityConfirmed: false },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await http(`/${id}/publish`, {
          review: { ...review, selectedClaims: [2] },
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await http(`/${id}/publish`, {
          review: { ...review, baseRevision: 999 },
        })
      ).status,
      422,
    );
    const published = await http(`/${id}/publish`, { review });
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.equal(published.body.result.status, 'PUBLISHED');
    assert.equal(published.body.result.projectionStatus, 'PENDING');
    assert.equal((await http(`/${id}/publish`, { review })).status, 200);
    assert.equal(
      await sql(
        `SELECT count(*) FROM ingestion.selection_decision WHERE run_id='${id}'`,
      ),
      '2',
    );
    assert.equal(
      await sql(
        `SELECT count(*) FROM ingestion.projection_event WHERE run_id='${id}'`,
      ),
      '1',
    );
    const catalog = await fetch(
      `${base}/api/vehicle-specifications?configurationId=${published.body.result.configurationId}`,
    );
    assert.equal(catalog.status, 200);
    const specs = await catalog.json();
    assert.equal(
      specs.rows.find((row) => row.attribute.code === 'torque_max').cells[0]
        .knowledgeStatus,
      'KNOWN',
    );
    assert.equal(
      specs.rows.find((row) => row.attribute.code === 'camera_360').cells[0]
        .observations[0].availability,
      'OPTIONAL',
    );
    await delay(12000);
    run = (await http(`/${id}`)).body.result;
    assert.equal(run.projectionStatus, 'PENDING');
    assert.ok(run.projectionError, 'Graph failure must remain visible');
    projectFails = false;
    const end = Date.now() + 40000;
    while (Date.now() < end) {
      run = (await http(`/${id}`)).body.result;
      if (run.projectionStatus === 'CURRENT') break;
      await delay(300);
    }
    assert.equal(run.projectionStatus, 'CURRENT');
    const graph = await graphDriver.executeQuery(
      'MATCH (c:SpecSyncCatalog:VehicleConfiguration {id:$id})-[:HAS_CELL]->(cell:SpecificationCell)-[:SELECTS]->(a:SpecAssertion) RETURN a.availability AS availability,a.value_number AS value',
      { id: run.configurationId },
    );
    assert.equal(graph.records.length, 2);
    assert.ok(
      graph.records.some((record) => record.get('availability') === 'OPTIONAL'),
    );
    await projectIngestion(projected);
    const stale = { ...projected, revision: projected.revision - 1 };
    if (stale.revision > 0) await projectIngestion(stale);
    const broken = structuredClone(projected);
    broken.revision++;
    broken.snapshot.brand.push({ ...broken.snapshot.brand[0] });
    await assert.rejects(() => projectIngestion(broken));
    const afterRollback = await graphDriver.executeQuery(
      "MATCH (p:SpecSyncCatalog:CatalogProjection {id:'catalog'}) RETURN p.ingestion_revision AS revision",
    );
    assert.equal(
      Number(afterRollback.records[0].get('revision')),
      projected.revision,
    );
    const beforeReplay = await sql(
      'SELECT jsonb_build_array((SELECT count(*) FROM catalog.spec_assertion),(SELECT count(*) FROM catalog.evidence),(SELECT count(*) FROM catalog.source_revision),(SELECT revision FROM ingestion.catalog_version))',
    );
    const replay = randomUUID();
    assert.equal((await http('', { id: replay, request })).status, 200);
    const replayRun = await waitFor(replay, 'REVIEW');
    const replayed = await http(`/${replay}/publish`, {
      review: {
        ...review,
        draftHash: replayRun.draftHash,
        baseRevision: replayRun.baseRevision,
      },
    });
    assert.equal(replayed.status, 200, JSON.stringify(replayed.body));
    assert.equal(replayed.body.result.projectionStatus, 'UNCHANGED');
    assert.equal(
      await sql(
        'SELECT jsonb_build_array((SELECT count(*) FROM catalog.spec_assertion),(SELECT count(*) FROM catalog.evidence),(SELECT count(*) FROM catalog.source_revision),(SELECT revision FROM ingestion.catalog_version))',
      ),
      beforeReplay,
    );
    await projectIngestion({ ...projected, revision: projected.revision + 1 });
    await projectIngestion(projected);
    const afterStale = await graphDriver.executeQuery(
      "MATCH (p:SpecSyncCatalog:CatalogProjection {id:'catalog'}) RETURN p.ingestion_revision AS revision",
    );
    assert.equal(
      Number(afterStale.records[0].get('revision')),
      projected.revision + 1,
    );
    const rejected = randomUUID();
    assert.equal(
      (
        await http('', {
          id: rejected,
          request: { ...request, name: 'Rejected synthetic' },
        })
      ).status,
      200,
    );
    assert.equal(
      (await http(`/${rejected}/reject`, {})).body.result.status,
      'REJECTED',
    );
    assert.equal((await http(`/${rejected}/publish`, { review })).status, 422);
    assert.equal(
      await sql(
        "SELECT count(*) FROM catalog.vehicle_configuration WHERE name='Rejected synthetic'",
      ),
      '0',
    );
  },
);
