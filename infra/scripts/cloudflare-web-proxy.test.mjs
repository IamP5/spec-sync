import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../modules/cloudflare-web-proxy/worker.mjs';

const env = {
  ORIGIN: 'https://specsync-dev-web-example.a.run.app',
  PUBLIC_HOSTNAME: 'specsync.tubadev.com',
};

test('proxies deep links, query strings, method and body to the service hostname', async (t) => {
  const upstreamResponse = new Response('ok', {
    headers: { 'Cache-Control': 'no-store' },
  });
  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async (request, options) => {
      assert.equal(request.url, `${env.ORIGIN}/c/123?q=a%2Fb`);
      assert.equal(request.headers.get('Host'), new URL(env.ORIGIN).host);
      assert.equal(
        request.headers.get('X-Forwarded-Host'),
        env.PUBLIC_HOSTNAME,
      );
      assert.equal(request.headers.get('X-Forwarded-Proto'), 'https');
      assert.equal(request.headers.get('Authorization'), 'Bearer test-token');
      assert.equal(request.method, 'POST');
      assert.equal(await request.text(), 'payload');
      assert.equal(options.redirect, 'manual');
      assert.deepEqual(options.cf, { cacheTtlByStatus: { '400-599': -1 } });
      return upstreamResponse;
    },
  );

  const response = await worker.fetch(
    new Request(`https://${env.PUBLIC_HOSTNAME}/c/123?q=a%2Fb`, {
      method: 'POST',
      body: 'payload',
      headers: {
        Host: env.PUBLIC_HOSTNAME,
        Authorization: 'Bearer test-token',
        'X-Forwarded-Host': 'untrusted.example',
      },
    }),
    env,
  );
  assert.equal(response, upstreamResponse);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('redirects HTTP to HTTPS before contacting Cloud Run', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch');
  const response = await worker.fetch(
    new Request(`http://${env.PUBLIC_HOSTNAME}/c/123?q=1`),
    env,
  );
  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get('Location'),
    `https://${env.PUBLIC_HOSTNAME}/c/123?q=1`,
  );
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('rejects hostnames other than the configured public domain', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch');
  const response = await worker.fetch(
    new Request('https://unexpected.example/'),
    env,
  );
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(fetchMock.mock.callCount(), 0);
});

for (const location of [`${env.ORIGIN}/login?next=%2Fc`, '/login?next=%2Fc']) {
  test(`keeps origin redirects on the custom domain: ${location}`, async (t) => {
    t.mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response(null, {
          status: 302,
          headers: { Location: location, 'Cache-Control': 'no-store' },
        }),
    );
    const response = await worker.fetch(
      new Request(`https://${env.PUBLIC_HOSTNAME}/`),
      env,
    );
    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get('Location'),
      `https://${env.PUBLIC_HOSTNAME}/login?next=%2Fc`,
    );
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  });
}

test('passes external redirects to the browser without following them', async (t) => {
  const response = new Response(null, {
    status: 302,
    headers: { Location: 'https://accounts.google.com/' },
  });
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_, options) => {
    assert.equal(options.redirect, 'manual');
    return response;
  });
  assert.equal(
    await worker.fetch(new Request(`https://${env.PUBLIC_HOSTNAME}/`), env),
    response,
  );
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('passes through streaming bodies and upstream errors', async (t) => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('unavailable'));
      controller.close();
    },
  });
  const response = new Response(body, { status: 503 });
  t.mock.method(globalThis, 'fetch', async () => response);
  const result = await worker.fetch(
    new Request(`https://${env.PUBLIC_HOSTNAME}/`),
    env,
  );
  assert.equal(result.status, 503);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.equal(result.body, body);
  assert.equal(await result.text(), 'unavailable');
});

for (const status of [400, 404, 429, 500, 503]) {
  test(`prevents caching ${status} errors even when the origin marks them immutable`, async (t) => {
    t.mock.method(globalThis, 'fetch', async (_, options) => {
      assert.deepEqual(options.cf, { cacheTtlByStatus: { '400-599': -1 } });
      return new Response('upstream error', {
        status,
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
          'CDN-Cache-Control': 'max-age=31536000',
          'Cloudflare-CDN-Cache-Control': 'max-age=31536000',
          Expires: 'Wed, 09 Sep 2037 00:00:00 GMT',
          'Retry-After': '30',
        },
      });
    });
    const response = await worker.fetch(
      new Request(`https://${env.PUBLIC_HOSTNAME}/missing-00000000.js`),
      env,
    );
    assert.equal(response.status, status);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('CDN-Cache-Control'), null);
    assert.equal(response.headers.get('Cloudflare-CDN-Cache-Control'), null);
    assert.equal(response.headers.get('Expires'), null);
    assert.equal(response.headers.get('Retry-After'), '30');
    assert.equal(await response.text(), 'upstream error');
  });
}

test('preserves immutable caching and conditional responses for successful assets', async (t) => {
  for (const status of [200, 206, 304]) {
    const upstream = new Response(null, {
      status,
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
    const mock = t.mock.method(globalThis, 'fetch', async () => upstream);
    const response = await worker.fetch(
      new Request(`https://${env.PUBLIC_HOSTNAME}/main-ABCDEFGH.js`),
      env,
    );
    assert.equal(response, upstream);
    mock.mock.restore();
  }
});
