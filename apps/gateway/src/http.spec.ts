import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { serve } from '@hono/node-server';
import { expect, it } from 'vitest';

import { createGateway } from './app.js';

it('streams across real Node HTTP sockets and cancels the upstream when the browser disconnects', async () => {
  let upstreamClosed!: () => void;
  const closed = new Promise<void>((resolve) => {
    upstreamClosed = resolve;
  });
  const upstream = createServer((request, response) => {
    expect(request.url).toBe('/copilotkit');
    expect(request.headers['x-serverless-authorization']).toBe(
      'Bearer workload',
    );
    expect(request.headers['x-specsync-token']).toBe('signed-token');
    expect(request.headers.cookie).toBeUndefined();
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.write('data: first\n\n');
    response.on('close', upstreamClosed);
  });
  await new Promise<void>((resolve) =>
    upstream.listen(0, '127.0.0.1', resolve),
  );
  const origin = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  const app = createGateway(
    {
      publicOrigin: 'http://localhost:3000',
      apiUrl: origin,
      aiUrl: origin,
      frontendOrigin: 'http://localhost:4200',
      projectId: 'test',
      cloudRunAuth: true,
    },
    {
      async verifyToken() {
        return {
          uid: 'test',
          email: 'test@example.com',
          roles: [],
          displayName: 'Test',
          photoUrl: null,
        };
      },
      async invocationToken() {
        return 'Bearer workload';
      },
    },
  );
  const gateway = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 });
  if (!gateway.listening)
    await new Promise<void>((resolve) => gateway.once('listening', resolve));
  const abort = new AbortController();
  try {
    const response = await fetch(
      `http://127.0.0.1:${(gateway.address() as AddressInfo).port}/ai/copilotkit`,
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer signed-token',
          origin: 'http://localhost:4200',
          'content-type': 'application/json',
        },
        body: '{}',
        signal: abort.signal,
      },
    );
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe(
      'data: first\n\n',
    );
    abort.abort();
    await closed;
  } finally {
    abort.abort();
    if ('closeAllConnections' in gateway) gateway.closeAllConnections();
    upstream.closeAllConnections();
    await Promise.all([
      new Promise<void>((resolve) => gateway.close(() => resolve())),
      new Promise<void>((resolve) => upstream.close(() => resolve())),
    ]);
  }
}, 10000);
