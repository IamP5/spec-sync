import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { compose } from './database.mjs';
import { loadDataset, seedSql, workspaceRoot } from './foundation.mjs';

// This suite migrates an isolated local database and never calls a model or public site.
const database = `ontology_it_${randomUUID().replaceAll('-', '')}`;
const serviceKey = randomUUID() + randomUUID();
const reviewerKey = randomUUID() + randomUUID();
const workerKey = randomUUID() + randomUUID();
const attempts = [];
let app, server, base, address, workerAddress;
let logs = '';
let databaseCreated = false;
const digest = (value) => createHash('sha256').update(value).digest('hex');
const text =
  'SYNTHETIC ONLY: F-150 Alpha and Beta BR 2026\nAlpha torque: 60,0 kgf.m\nBeta torque: 65,0 kgf.m\nPontos de amarração: 6\nCapacidade de reboque: 3492 kg\nCapacidade fictícia: 12 kg';
const source = {
  url: 'https://www.ford.com.br/synthetic-research-only',
  title: 'Synthetic shared research fixture',
  mimeType: 'text/html',
  originalBase64: Buffer.from(text).toString('base64'),
  originalSha256: digest(text),
  text,
  textSha256: digest(text),
  parserVersion: 'synthetic-research-v1',
};
const request = {
  sourceUrl: source.url,
  brand: 'Ford',
  model: 'F-150',
  market: 'BR',
  modelYear: 2026,
  configurations: ['Alpha'],
};
const draft = {
  source,
  configurations: ['Alpha', 'Beta'].map((name, index) => ({
    name,
    identityLineStart: 1,
    identityLineEnd: 1,
    identityExcerpt: text.split('\n')[0],
    warnings: [],
    unmappedObservations: [
      {
        originalTerm: 'Pontos de amarração',
        rawValue: '6',
        sourceUnit: null,
        qualifiers: {},
        lineStart: 4,
        lineEnd: 4,
        excerpt: text.split('\n')[3],
        locator: 'Synthetic row 4',
        termOrigin: 'SOURCE_TEXT',
        proposal: {
          kind: 'ADD_ATTRIBUTE',
          attributeCode: null,
          proposedCode: 'cargo_tie_down_count',
          label: 'Pontos de amarração',
          definition:
            'Number of dedicated cargo tie-down anchor points in the bed.',
          valueType: 'NUMBER',
          unit: null,
          dimension: 'count',
          alternatives: ['Payload measures mass, not anchor count.'],
        },
      },
    ],
    claims: [
      {
        attributeCode: 'torque_max',
        rawValue: index ? '65,0' : '60,0',
        rawUnit: 'kgf.m',
        availability: null,
        listValue: null,
        qualifiers: {},
        lineStart: index + 2,
        lineEnd: index + 2,
        excerpt: text.split('\n')[index + 1],
        locator: `Synthetic line ${index + 2}`,
      },
    ],
  })),
  warnings: ['Synthetic fixture; coverage has not been certified.'],
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
async function until(read, accept, description, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await read();
    if (accept(result)) return result;
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${description}. API log: ${logs}`);
}
async function stop(signal = 'SIGTERM') {
  if (app && app.exitCode === null && app.signalCode === null) {
    const done = once(app, 'close');
    app.kill(signal);
    await done;
  }
}
async function start(policyVersion = 'br-v1') {
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
      '--spring.cloud.gcp.project-id=research-test',
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
        SPECSYNC_RESEARCH_SERVICE_KEY: serviceKey,
        SPECSYNC_RESEARCH_POLICY_VERSION: policyVersion,
      },
    },
  );
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => finish(new Error(`API startup timed out: ${logs}`)),
      120000,
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
      logs = (logs + chunk)
        .replace(
          /Using generated security password: [^\r\n]+/g,
          'Generated security password: [redacted]',
        )
        .slice(-20000);
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
async function http(path, method = 'GET', body, key = serviceKey) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const raw = await response.text();
  return { status: response.status, body: raw ? JSON.parse(raw) : null };
}
const userPath = (uid, id = '') =>
  `/api/internal/research/users/${uid}/requests${id ? `/${id}` : ''}`;
const attemptPath = (input) =>
  `/api/internal/research/works/${input.workId}/attempts/${input.attemptId}`;

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
  databaseCreated = true;
  server = createServer(async (req, res) => {
    if (req.url === '/internal/ingestion/project') {
      res.writeHead(503).end('{}');
      return;
    }
    if (
      req.url !== '/internal/research/extract' ||
      req.headers.authorization !== `Bearer ${serviceKey}`
    ) {
      res.writeHead(401).end('{}');
      return;
    }
    let body = '';
    for await (const chunk of req) body += chunk;
    attempts.push({ input: JSON.parse(body), response: res });
    // The test controls completion to exercise simultaneous joins and a crashed worker.
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  workerAddress = `http://127.0.0.1:${server.address().port}`;
  await start();
  const data = await loadDataset();
  await sql(seedSql(data.dataset, data.digest));
});
after(async () => {
  await stop('SIGKILL');
  if (server) {
    server.closeAllConnections();
    server.close();
  }
  if (!databaseCreated) return;
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

async function ontology(path = '', method = 'GET', body, key = reviewerKey) {
  const response = await fetch(base + '/api/ontology/proposals' + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-ingestion-key': key },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}
async function completeAttempt(index, payload = draft) {
  await until(
    () => attempts,
    (value) => value.length > index,
    'ontology extraction',
  );
  const attempt = attempts[index];
  for (const [key, value] of [
    ['capture-source', { ...payload.source, pageCount: 1 }],
    [
      'identify-configurations',
      { configurations: [], legend: {}, modelYearNote: null, notes: [] },
    ],
    [`extract-o${attempt.input.ontologyRevision}-0`, payload.configurations[0]],
  ]) {
    const saved = await http(
      `${attemptPath(attempt.input)}/checkpoints/${key}`,
      'PUT',
      { payload: JSON.stringify(value) },
    );
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
  }
  attempt.response.setHeader('content-type', 'application/json');
  attempt.response.end(
    JSON.stringify({
      ...payload,
      ontologyRevision: attempt.input.ontologyRevision,
      normalizationRevision: attempt.input.normalizationRevision,
      readerRevision: payload.source.parserVersion,
    }),
  );
}
test(
  'deduplicates evidenced ontology proposals, activates one revision and replays immutable sources',
  { timeout: 300000 },
  async () => {
    assert.equal((await ontology('', 'GET', undefined, 'wrong')).status, 401);
    const initial = await ontology();
    assert.equal(initial.status, 200);
    assert.equal(initial.body.revision, 1);
    const users = ['ontology-alice', 'ontology-bob'];
    const requests = await Promise.all(
      users.map((uid) =>
        http(userPath(uid), 'POST', { id: randomUUID(), request }),
      ),
    );
    requests.forEach((result) =>
      assert.equal(result.status, 200, JSON.stringify(result.body)),
    );
    assert.equal(requests[0].body.workId, requests[1].body.workId);
    const original = requests[0].body;
    await completeAttempt(0);
    const ready = await until(
      () => http(userPath(users[0], original.id)),
      (value) => value.body.status === 'REVIEW',
      'ontology findings',
    );
    assert.equal(ready.body.ontologyRevision, 1);
    assert.equal(ready.body.configurations[0].unmappedObservations.length, 1);
    const proposals = (await ontology()).body.proposals;
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].evidenceCount, 2);
    assert.equal(proposals[0].status, 'PENDING');
    assert.equal(
      await sql(
        "SELECT count(*) FROM catalog.attribute_definition WHERE code='cargo_tie_down_count'",
      ),
      '0',
    );
    const activate = () =>
      ontology(`/${proposals[0].id}/activate`, 'POST', {
        baseRevision: 1,
        reason:
          'Synthetic fixture: anchor count is separate from load mass; source row verified.',
      });
    const activated = await Promise.all(Array.from({ length: 5 }, activate));
    activated.forEach((result) =>
      assert.equal(result.status, 200, JSON.stringify(result.body)),
    );
    assert.equal((await ontology()).body.revision, 2);
    assert.equal(
      await sql(
        "SELECT count(*) FROM catalog.attribute_definition WHERE code='cargo_tie_down_count'",
      ),
      '1',
    );
    assert.equal(
      await sql(
        'SELECT count(*) FROM ingestion.projection_event WHERE ontology_revision=2',
      ),
      '1',
    );
    assert.equal(
      await sql('SELECT count(*) FROM catalog.ontology_proposal_evidence'),
      '2',
    );
    assert.equal(
      (await http(userPath(users[0], original.id))).body.ontologyRevision,
      1,
    );
    const replayIds = [randomUUID(), randomUUID()];
    const replay = await Promise.all(
      requests.map((result, index) =>
        http(userPath(users[index], result.body.id) + '/replay', 'POST', {
          id: replayIds[index],
        }),
      ),
    );
    replay.forEach((result) =>
      assert.equal(result.status, 200, JSON.stringify(result.body)),
    );
    assert.equal(replay[0].body.workId, replay[1].body.workId);
    assert.notEqual(replay[0].body.workId, original.workId);
    assert.equal(replay[0].body.ontologyRevision, 2);
    assert.equal(replay[0].body.replayedFromWorkId, original.workId);
    assert.equal(
      (
        await http(userPath('mallory', original.id) + '/replay', 'POST', {
          id: randomUUID(),
        })
      ).status,
      422,
    );
    await until(
      () => attempts,
      (value) => value.length === 2,
      'replay model attempt',
    );
    const checkpoints = (
      await http(`${attemptPath(attempts[1].input)}/checkpoints`)
    ).body.checkpoints;
    assert.deepEqual(checkpoints.map((item) => item.key).sort(), [
      'capture-source',
      'identify-configurations',
    ]);
    assert.equal(
      JSON.parse(
        checkpoints.find((item) => item.key === 'capture-source').payload,
      ).originalSha256,
      source.originalSha256,
    );
    assert.ok(
      attempts[1].input.attributes.some(
        (attribute) => attribute.code === 'cargo_tie_down_count',
      ),
    );
    assert.ok(
      !attempts[0].input.attributes.some(
        (attribute) => attribute.code === 'cargo_tie_down_count',
      ),
    );
    const replayDraft = structuredClone(draft);
    for (const configuration of replayDraft.configurations) {
      configuration.unmappedObservations = [];
      configuration.claims.push({
        attributeCode: 'cargo_tie_down_count',
        originalTerm: 'Pontos de amarração',
        rawValue: '6',
        rawUnit: null,
        availability: null,
        listValue: null,
        qualifiers: {},
        lineStart: 4,
        lineEnd: 4,
        excerpt: text.split('\n')[3],
        locator: 'Synthetic row 4',
      });
    }
    await completeAttempt(1, replayDraft);
    const replayReady = await until(
      () => http(userPath(users[0], replayIds[0])),
      (value) => value.body.status === 'REVIEW',
      'reinterpreted findings',
    );
    assert.equal(
      replayReady.body.configurations[0].claims.find(
        (claim) => claim.attributeCode === 'cargo_tie_down_count',
      ).value,
      6,
    );
    assert.equal(
      replayReady.body.configurations[0].unmappedObservations.length,
      0,
    );
    assert.equal(
      (await http(userPath(users[0], original.id))).body.configurations[0]
        .unmappedObservations.length,
      1,
    );
    assert.equal(
      await sql(
        `SELECT count(*) FROM research.checkpoint WHERE work_id='${original.workId}'`,
      ),
      '3',
    );
    // A proposal cannot alias towing to payload just because both values use kg.
    const conflictRequest = {
      ...request,
      sourceUrl: source.url + '?conflict=1',
    };
    const conflict = (
      await http(userPath(users[0]), 'POST', {
        id: randomUUID(),
        request: conflictRequest,
      })
    ).body;
    const conflictDraft = structuredClone(draft);
    conflictDraft.source = { ...source, url: conflictRequest.sourceUrl };
    for (const configuration of conflictDraft.configurations)
      configuration.unmappedObservations = [
        {
          originalTerm: 'Capacidade de reboque',
          rawValue: '3492',
          sourceUnit: 'kg',
          qualifiers: {},
          lineStart: 5,
          lineEnd: 5,
          excerpt: text.split('\n')[4],
          locator: 'Synthetic row 5',
          termOrigin: 'SOURCE_TEXT',
          proposal: {
            kind: 'ADD_ALIAS',
            attributeCode: 'payload',
            proposedCode: null,
            label: 'Capacidade de reboque',
            definition:
              'Candidate incorrectly equates towing capacity with payload.',
            valueType: 'NUMBER',
            unit: 'kg',
            dimension: 'mass',
            alternatives: [],
          },
        },
        {
          originalTerm: 'Capacidade fictícia',
          rawValue: '12',
          sourceUnit: 'kg',
          qualifiers: {},
          lineStart: 6,
          lineEnd: 6,
          excerpt: text.split('\n')[5],
          locator: 'Synthetic row 6',
          termOrigin: 'SOURCE_TEXT',
          proposal: {
            kind: 'ADD_ATTRIBUTE',
            attributeCode: null,
            proposedCode: 'payload',
            label: 'Synthetic incompatible payload',
            definition:
              'Synthetic conflicting definition of a dedicated test capacity.',
            valueType: 'NUMBER',
            unit: 'kg',
            dimension: 'mass',
            alternatives: [],
          },
        },
      ];
    await completeAttempt(2, conflictDraft);
    const conflictReady = await until(
      () => http(userPath(users[0], conflict.id)),
      (value) => value.body.status === 'REVIEW',
      'conflicting proposal',
    );
    assert.equal(
      conflictReady.body.configurations[0].claims.find(
        (claim) => claim.attributeCode === 'towing_capacity',
      ).value,
      3492,
    );
    assert.ok(
      !conflictReady.body.configurations[0].claims.some(
        (claim) => claim.attributeCode === 'payload',
      ),
    );
    const conflictProposal = (await ontology()).body.proposals.find(
      (item) => item.term === 'Capacidade fictícia',
    );
    assert.ok(conflictProposal);
    assert.equal(
      (
        await ontology(`/${conflictProposal.id}/activate`, 'POST', {
          baseRevision: 2,
          reason: 'Deliberate false-merge regression test.',
        })
      ).status,
      422,
    );
    assert.equal((await ontology()).body.revision, 2);
    const samePolicy = await http(
      userPath(users[0], original.id) + '/replay',
      'POST',
      {
        id: randomUUID(),
      },
    );
    assert.equal(samePolicy.status, 200);
    assert.equal(samePolicy.body.workId, replayReady.body.workId);
    await stop();
    await start('br-v2');
    const changedPolicy = await Promise.all(
      requests.map((result, index) =>
        http(userPath(users[index], result.body.id) + '/replay', 'POST', {
          id: randomUUID(),
        }),
      ),
    );
    changedPolicy.forEach((result) =>
      assert.equal(result.status, 200, JSON.stringify(result.body)),
    );
    assert.equal(changedPolicy[0].body.workId, changedPolicy[1].body.workId);
    assert.notEqual(changedPolicy[0].body.workId, replayReady.body.workId);
    assert.equal(changedPolicy[0].body.ontologyRevision, 2);
    await until(
      () => attempts,
      (value) => value.length === 4,
      'changed-policy extraction',
    );
    assert.equal(attempts[3].input.policyVersion, 'br-v2');
    const retained = (
      await http(`${attemptPath(attempts[3].input)}/checkpoints`)
    ).body.checkpoints;
    assert.deepEqual(retained, checkpoints);
    await completeAttempt(3, replayDraft);
    await until(
      () => http(userPath(users[0], changedPolicy[0].body.id)),
      (value) => value.body.status === 'REVIEW',
      'changed-policy results',
    );
    assert.deepEqual(
      (await http(userPath(users[0], replayIds[0]))).body.configurations,
      replayReady.body.configurations,
    );
  },
);
