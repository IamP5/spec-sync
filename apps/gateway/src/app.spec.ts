import { describe, expect, it, vi } from 'vitest';

import { createGateway } from './app.js';
import type { GatewayConfig } from './config.js';
import { loadConfig } from './config.js';
import type { IdentityService } from './identity.js';
import { rolesFromClaims } from './identity.js';

const config: GatewayConfig = {
  publicOrigin: 'https://app.example',
  apiUrl: 'https://api.run.app',
  aiUrl: 'https://ai.run.app',
  frontendOrigin: 'https://web.run.app',
  projectId: 'test',
  cloudRunAuth: true,
};
const user = {
  uid: 'alice',
  email: 'alice@example.com',
  roles: ['reviewer'],
  displayName: 'Alice',
  photoUrl: null,
};
function setup() {
  const identity: IdentityService = {
    verifyToken: vi.fn().mockImplementation(async (cookie) => {
      if (cookie !== 'valid') throw new Error('expired or revoked');
      return user;
    }),
    invocationToken: vi.fn().mockResolvedValue('Bearer workload-token'),
  };
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response('{"ok":true}', {
      headers: { 'content-type': 'application/json' },
    }),
  );
  return { app: createGateway(config, identity, fetcher), identity, fetcher };
}
const authorization = 'Bearer valid';

describe('gateway authentication and routing', () => {
  it('keeps health public but rejects missing, forged and revoked sessions before proxying', async () => {
    const { app, fetcher } = setup();
    expect((await app.request('/health')).status).toBe(200);
    for (const supplied of ['', 'Bearer forged']) {
      const response = await app.request('/api/vehicles', {
        headers: { authorization: supplied, 'x-specsync-user': 'admin' },
      });
      expect(response.status).toBe(401);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('redirects gateway navigation to the public frontend and never serves assets', async () => {
    const { app, fetcher } = setup();
    expect((await app.request('/')).headers.get('location')).toBe(
      config.frontendOrigin,
    );
    expect(
      (await app.request('/main.js', { headers: { authorization } })).status,
    ).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('allows preflight only for the configured frontend, including streamed AI calls', async () => {
    const { app, fetcher, identity } = setup();
    const response = await app.request('/ai/copilotkit', {
      method: 'OPTIONS',
      headers: {
        origin: config.frontendOrigin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      config.frontendOrigin,
    );
    expect(response.headers.get('access-control-allow-headers')).toContain(
      'Authorization',
    );
    expect(identity.verifyToken).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    const denied = await app.request('/user/me', {
      headers: { authorization, origin: 'https://evil.example' },
    });
    expect(denied.status).toBe(403);
    expect(denied.headers.get('access-control-allow-origin')).not.toBe(
      'https://evil.example',
    );
  });
  it('keeps the authenticated session separate from the user profile', async () => {
    const { app, fetcher } = setup();
    expect((await app.request('/auth/session')).status).toBe(401);
    const response = await app.request('/auth/session', {
      headers: { authorization },
    });
    expect(await response.json()).toEqual({ uid: user.uid });
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('returns verified roles and prevents shared caching', async () => {
    const { app } = setup();
    const response = await app.request('/user/me', {
      headers: { authorization },
    });
    expect(await response.json()).toEqual(user);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('replaces spoofed context, drops cookies and forwarding headers, and preserves curator credentials', async () => {
    const { app, fetcher, identity } = setup();
    await app.request('/api/ingestions?q=a%26b', {
      headers: {
        authorization,
        cookie: 'forged-cookie',
        'x-specsync-token': 'forged-token',
        'x-specsync-user': 'admin',
        'x-serverless-authorization': 'attacker',
        'x-forwarded-host': 'evil.example',
        'x-ingestion-key': 'curator-key',
      },
    });
    expect(identity.invocationToken).toHaveBeenCalledWith(config.apiUrl);
    const request = fetcher.mock.calls[0]![0] as Request;
    expect(request.url).toBe('https://api.run.app/api/ingestions?q=a%26b');
    const headers = request.headers;
    expect(headers.get('x-serverless-authorization')).toBe(
      'Bearer workload-token',
    );
    expect(
      JSON.parse(
        Buffer.from(headers.get('x-specsync-user')!, 'base64url').toString(),
      ),
    ).toEqual(user);
    expect(headers.get('x-specsync-token')).toBe('valid');
    expect(headers.has('cookie')).toBe(false);
    expect(headers.has('authorization')).toBe(false);
    expect(headers.has('x-forwarded-host')).toBe(false);
    expect(headers.get('x-ingestion-key')).toBe('curator-key');
    expect(request.redirect).toBe('manual');
  });
  it('streams AI bodies without waiting for completion and strips the prefix', async () => {
    const { app, fetcher } = setup();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
        c.enqueue(new TextEncoder().encode('data: first\n\n'));
      },
    });
    fetcher.mockResolvedValue(
      new Response(stream, {
        headers: {
          'content-type': 'text/event-stream',
          'content-encoding': 'gzip',
          'content-length': '100',
        },
      }),
    );
    const response = await app.request('/ai/copilotkit', {
      method: 'POST',
      headers: { authorization, origin: config.frontendOrigin },
      body: '{"method":"info"}',
    });
    const request = fetcher.mock.calls[0]![0] as Request;
    expect(request.url).toBe('https://ai.run.app/copilotkit');
    expect(request.method).toBe('POST');
    expect(await request.text()).toBe('{"method":"info"}');
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-length')).toBeNull();
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe(
      'data: first\n\n',
    );
    controller.close();
    expect((await reader.read()).done).toBe(true);
  });
  it('forwards cancellation to the upstream request', async () => {
    const { app, fetcher } = setup();
    const abort = new AbortController();
    await app.request(
      new Request('https://app.example/api/vehicles', {
        signal: abort.signal,
        headers: { authorization },
      }),
    );
    abort.abort();
    const request = fetcher.mock.calls[0]![0] as Request;
    expect(request.signal.aborted).toBe(true);
  });
  it('blocks internal AI surfaces, including encoded paths', async () => {
    const { app, fetcher } = setup();
    for (const path of [
      '/ai/internal/ingestion/extract',
      '/ai/api/agents',
      '/ai/%69nternal/ingestion/extract',
      '/ai//internal/ingestion/extract',
    ])
      expect(
        (await app.request(path, { headers: { authorization } })).status,
      ).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not follow upstream redirects or forward backend cookies', async () => {
    const { app, fetcher } = setup();
    fetcher.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://evil.example', 'set-cookie': 'unsafe=1' },
      }),
    );
    const response = await app.request('/api/vehicles', {
      headers: { authorization },
    });
    expect(response.status).toBe(502);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('preserves upstream errors while filtering backend cookies and transport headers', async () => {
    const { app, fetcher } = setup();
    fetcher.mockResolvedValue(
      new Response('{"error":"busy"}', {
        status: 503,
        headers: {
          'content-type': 'application/json',
          'retry-after': '30',
          'set-cookie': 'unsafe=1',
          'cache-control': 'public, max-age=3600',
          connection: 'keep-alive',
          'keep-alive': 'timeout=5',
        },
      }),
    );
    const response = await app.request('/api/vehicles', {
      headers: { authorization },
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'busy' });
    expect(response.headers.get('retry-after')).toBe('30');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('connection')).toBeNull();
    expect(response.headers.get('keep-alive')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('fails closed when workload credentials are unavailable', async () => {
    const { app, identity, fetcher } = setup();
    vi.mocked(identity.invocationToken).mockRejectedValue(
      new Error('ADC unavailable'),
    );
    expect(
      (await app.request('/api/vehicles', { headers: { authorization } }))
        .status,
    ).toBe(502);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('configuration and roles', () => {
  it('grants no implicit role and rejects malformed claims', () => {
    expect(rolesFromClaims(undefined)).toEqual([]);
    expect(rolesFromClaims(['reviewer', 'reviewer'])).toEqual(['reviewer']);
    for (const value of ['admin', ['ADMIN'], [1], Array(33).fill('admin')])
      expect(() => rolesFromClaims(value)).toThrow();
  });
  it('requires HTTPS and refuses an auth emulator in production', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
      }),
    ).toThrow('emulator');
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        PUBLIC_ORIGIN: 'http://localhost:3000',
      }),
    ).toThrow('HTTPS');
    expect(() =>
      loadConfig({ PUBLIC_ORIGIN: 'https://user:pass@example.com' }),
    ).toThrow('credentials');
  });
});
