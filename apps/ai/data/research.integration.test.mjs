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
const database = `research_it_${randomUUID().replaceAll('-', '')}`;
const serviceKey = randomUUID() + randomUUID();
const reviewerKey = randomUUID() + randomUUID();
const workerKey = randomUUID() + randomUUID();
const attempts = [];
let app, server, base, address, workerAddress;
let logs = '';
let databaseCreated = false;
const digest = (value) => createHash('sha256').update(value).digest('hex');
const text =
  'SYNTHETIC ONLY: Ranger Alpha and Beta BR 2026\nAlpha torque: 60,0 kgf.m\nBeta torque: 65,0 kgf.m';
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
  model: 'Ranger',
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
        SPECSYNC_RESEARCH_POLICY_VERSION: 'br-v1',
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
async function curate(workId, suffix = '', body) {
  const response = await fetch(`${base}/api/ingestions/${workId}${suffix}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ingestion-key': reviewerKey,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
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

test(
  'shares work, isolates subscriptions, fences attempts and resumes persisted checkpoints after a process crash',
  { timeout: 300000 },
  async () => {
    assert.equal(
      (await http(userPath('alice'), 'GET', undefined, 'wrong')).status,
      401,
    );
    const subscriptions = Array.from({ length: 12 }, (_, index) => ({
      uid: index % 2 ? 'bob' : 'alice',
      id: randomUUID(),
      request:
        index % 2
          ? {
              ...request,
              configurations: ['Beta'],
              sourceUrl: source.url + '#specs',
              brand: 'FORD',
              model: 'ranger',
            }
          : request,
    }));
    const results = await Promise.all(
      subscriptions.map(({ uid, id, request: input }) =>
        http(userPath(uid), 'POST', { id, request: input }),
      ),
    );
    for (const result of results)
      assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(new Set(results.map((result) => result.body.workId)).size, 1);
    assert.equal(
      results.filter((result) => result.body.disposition === 'CREATED').length,
      1,
    );
    const workId = results[0].body.workId;
    const alice = subscriptions[0],
      bob = subscriptions[1];
    // Private followers never become public profiles without an explicit sharing action.
    const alicePeople = userPath(alice.uid, alice.id) + '/interests';
    const bobPeople = userPath(bob.uid, bob.id) + '/interests';
    assert.deepEqual((await http(alicePeople)).body, {
      people: [],
      mine: null,
      hasMore: false,
    });
    assert.equal(
      (await http(userPath('mallory', alice.id) + '/interests')).status,
      422,
    );
    assert.equal(
      (
        await http(alicePeople, 'POST', {
          name: 'No consent',
          contactUrl: 'https://example.com',
        })
      ).status,
      400,
    );
    for (const contactUrl of [
      'javascript:alert(1)',
      'http://example.com',
      'https://user:secret@example.com',
    ]) {
      assert.equal(
        (
          await http(alicePeople, 'POST', {
            visible: true,
            name: 'Synthetic Alice',
            contactUrl,
          })
        ).status,
        422,
      );
    }
    const shared = await http(alicePeople, 'POST', {
      visible: true,
      name: 'Synthetic Alice',
      contactUrl: 'https://example.com/alice',
    });
    assert.equal(shared.status, 200, JSON.stringify(shared.body));
    assert.equal(shared.body.mine.isYou, true);
    const visibleToBob = (await http(bobPeople)).body;
    assert.deepEqual(visibleToBob, {
      people: [
        {
          name: 'Synthetic Alice',
          contactUrl: 'https://example.com/alice',
          isYou: false,
        },
      ],
      mine: null,
      hasMore: false,
    });
    assert.equal(
      (
        await http(userPath('mallory', alice.id) + '/interests', 'POST', {
          visible: false,
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await http(alicePeople, 'POST', {
          visible: true,
          name: 'Updated Alice',
          contactUrl: 'https://example.com/alice',
        })
      ).body.people.length,
      1,
    );
    assert.equal(
      (await http(bobPeople, 'POST', { visible: false })).body.people.length,
      1,
    );
    assert.deepEqual(
      (await http(alicePeople, 'POST', { visible: false })).body,
      { people: [], mine: null, hasMore: false },
    );
    assert.deepEqual((await http(bobPeople)).body.people, []);
    assert.deepEqual(results[0].body.request.configurations, ['Alpha']);
    assert.deepEqual(results[1].body.request.configurations, ['Beta']);
    assert.equal(await sql('SELECT count(*) FROM ingestion.run'), '1');
    const replay = await http(userPath(alice.uid), 'POST', {
      id: alice.id,
      request,
    });
    assert.equal(replay.status, 200);
    assert.equal(replay.body.workId, workId);
    assert.equal(
      (
        await http(userPath(alice.uid), 'POST', {
          id: alice.id,
          request: { ...request, modelYear: 2025 },
        })
      ).status,
      422,
    );
    for (const method of ['GET', 'DELETE']) {
      const denied = await http(userPath('mallory', alice.id), method);
      assert.ok([404, 422].includes(denied.status), JSON.stringify(denied));
    }
    const list = await http(userPath('alice'));
    assert.equal(list.body.requests.length, 6);
    assert.ok(
      list.body.requests.every(
        (item) => !('configurations' in item) && !('source' in item),
      ),
    );
    assert.ok(
      list.body.requests.every((item) =>
        subscriptions.some((sub) => sub.uid === 'alice' && sub.id === item.id),
      ),
    );
    assert.deepEqual((await http(userPath('mallory'))).body.requests, []);
    assert.equal(
      (await http(userPath('bob', bob.id), 'DELETE')).body.requestStatus,
      'CANCELLED',
    );
    assert.equal(
      (await http(userPath('alice', alice.id))).body.requestStatus,
      'ACTIVE',
    );

    await until(
      () => attempts,
      (value) => value.length === 1,
      'first extraction',
    );
    const first = attempts[0].input;
    assert.equal(first.workId, workId);
    assert.equal(first.policyVersion, 'br-v1');
    assert.deepEqual(
      first.request.configurations,
      [],
      'Document discovery must include siblings',
    );
    const checkpoint = { payload: JSON.stringify({ ...source, pageCount: 1 }) };
    const firstPath = attemptPath(first);
    assert.equal(
      (await http(`${firstPath}/heartbeat`, 'POST', {})).status,
      200,
    );
    assert.equal(
      (await http(`${firstPath}/checkpoints/capture-source`, 'PUT', checkpoint))
        .status,
      200,
    );
    assert.equal(
      (await http(`${firstPath}/checkpoints/capture-source`, 'PUT', checkpoint))
        .status,
      200,
    );
    assert.equal(
      (
        await http(`${firstPath}/checkpoints/capture-source`, 'PUT', {
          payload: '{}',
        })
      ).status,
      422,
    );
    assert.equal(
      (await http(userPath('alice', alice.id))).body.stage,
      'capture-source',
    );
    await stop('SIGKILL');
    attempts[0].response.destroy();
    await sql(
      `UPDATE ingestion.run SET lease_until=now()-interval '1 second' WHERE id='${workId}'`,
    );
    await start();
    assert.equal(
      (await http(`${firstPath}/heartbeat`, 'POST', {})).status,
      422,
    );
    const resumed = await http(userPath('carol'), 'POST', {
      id: randomUUID(),
      request,
    });
    assert.equal(resumed.body.workId, workId);
    await until(
      () => attempts,
      (value) => value.length === 2,
      'replacement extraction',
    );
    const second = attempts[1].input;
    assert.notEqual(second.attemptId, first.attemptId);
    assert.equal(second.workId, workId);
    const stored = await http(`${attemptPath(second)}/checkpoints`);
    assert.equal(stored.status, 200);
    assert.deepEqual(stored.body.checkpoints, [
      { key: 'capture-source', ...checkpoint },
    ]);
    assert.equal(
      (
        await http(`${firstPath}/checkpoints/identify-configurations`, 'PUT', {
          payload: '{}',
        })
      ).status,
      422,
    );
    assert.equal((await http(`${firstPath}/checkpoints`)).status, 422);
    assert.equal(
      (await http(`${attemptPath(second)}/heartbeat`, 'POST', {})).status,
      200,
    );
    attempts[1].response.setHeader('content-type', 'application/json');
    attempts[1].response.end(JSON.stringify(draft));
    const ready = await until(
      () => http(userPath('alice', alice.id)),
      (value) => value.body.status === 'REVIEW',
      'reviewable results',
    );
    assert.equal(ready.body.attempts, 2);
    assert.deepEqual(
      ready.body.configurations.map((item) => item.name),
      ['Alpha', 'Beta'],
    );
    assert.equal(ready.body.configurations[0].claims[0].value, 588.399);
    assert.equal(ready.body.source.originalSha256, source.originalSha256);
    assert.equal(ready.body.source.textSha256, source.textSha256);
    for (const forbidden of [
      'leaseToken',
      'leaseUntil',
      'owner',
      'uid',
      'subscribers',
      'draftHash',
      'baseRevision',
      'originalBase64',
      'text',
    ])
      assert.ok(
        !(forbidden in ready.body) && !(forbidden in ready.body.source),
        forbidden,
      );
    const other = await http(userPath('bob', subscriptions[3].id));
    assert.deepEqual(other.body.configurations, ready.body.configurations);
    assert.equal(
      attempts.length,
      2,
      'Only the crashed attempt and its replacement executed',
    );
    const reviewable = (await curate(workId)).body.result;
    const published = await curate(workId, '/publish', {
      review: {
        draftHash: reviewable.draftHash,
        baseRevision: reviewable.baseRevision,
        configurations: [0, 1].map((configuration) => ({
          configuration,
          selectedClaims: [0],
          identityConfirmed: true,
        })),
        reason: 'Synthetic shared research integration fixture only',
      },
    });
    assert.equal(published.status, 200, JSON.stringify(published.body));
    const reuse = await http(userPath('diana'), 'POST', {
      id: randomUUID(),
      request,
    });
    assert.equal(reuse.body.workId, workId);
    assert.equal(reuse.body.disposition, 'REUSED');
    await sql(
      `UPDATE ingestion.run SET updated_at=now()-interval '25 hours' WHERE id='${workId}'`,
    );
    const refreshed = await http(userPath('eric'), 'POST', {
      id: randomUUID(),
      request,
    });
    assert.equal(refreshed.status, 200, JSON.stringify(refreshed.body));
    assert.notEqual(refreshed.body.workId, workId);
    assert.equal(refreshed.body.disposition, 'CREATED');
    assert.equal((await http(userPath('alice', alice.id))).body.workId, workId);
    assert.equal(
      (await curate(refreshed.body.workId, '/reject', {})).status,
      200,
    );
    const replacement = await http(userPath('frank'), 'POST', {
      id: randomUUID(),
      request,
    });
    assert.equal(replacement.status, 200);
    assert.notEqual(replacement.body.workId, refreshed.body.workId);
  },
);

test('concurrent Ford F150 and F-150 requests join one canonical work scope', async () => {
  const results = await Promise.all(
    ['F150', 'F-150', 'f150', 'F-150'].map((model, index) =>
      http(userPath(`ford-alias-${index}`), 'POST', {
        id: randomUUID(),
        request: { ...request, model },
      }),
    ),
  );
  for (const result of results)
    assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(new Set(results.map((result) => result.body.workId)).size, 1);
  assert.equal(
    results.filter((result) => result.body.disposition === 'CREATED').length,
    1,
  );
  assert.equal(
    results.filter((result) => result.body.disposition === 'JOINED').length,
    3,
  );
  assert.deepEqual(
    results.map((result) => result.body.request.model),
    ['F150', 'F-150', 'f150', 'F-150'],
  );
});
