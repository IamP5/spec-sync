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
  webUrl: 'https://web.run.app',
  projectId: 'test',
  googleClientId: 'client',
  googleClientSecret: 'secret',
  identityApiKey: 'api-key',
  cloudRunAuth: true,
};
const user = { uid: 'alice', email: 'alice@example.com', roles: ['reviewer'] };
function setup() {
  const identity: IdentityService = {
    signIn: vi.fn().mockResolvedValue('session-token'),
    verifySession: vi.fn().mockImplementation(async (cookie) => {
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
const cookie = '__Host-specsync-session=valid';

describe('gateway authentication and routing', () => {
  it('keeps health public but rejects missing, forged and revoked sessions before proxying', async () => {
    const { app, fetcher } = setup();
    expect((await app.request('/health')).status).toBe(200);
    for (const supplied of ['', '__Host-specsync-session=forged']) {
      const response = await app.request('/api/vehicles', {
        headers: { cookie: supplied, 'x-specsync-user': 'admin' },
      });
      expect(response.status).toBe(401);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('sends document navigations through Google login', async () => {
    const { app } = setup();
    const response = await app.request('/', {
      headers: { accept: 'text/html' },
    });
    expect(response.headers.get('location')).toBe('/auth/login');
    const login = await app.request('https://app.example/auth/login');
    const url = new URL(login.headers.get('location')!);
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://app.example/auth/callback',
    );
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(login.headers.get('set-cookie')).toContain('HttpOnly');
    expect(login.headers.get('set-cookie')).toContain('Secure');
  });
  it('canonicalizes alternate Cloud Run hosts before setting OAuth state', async () => {
    const { app } = setup();
    const response = await app.request('https://alternate.run.app/auth/login');
    expect(response.headers.get('location')).toBe(
      'https://app.example/auth/login',
    );
    expect(response.headers.get('set-cookie')).toBeNull();
  });
  it('binds the OAuth callback to its browser, issues a secure session and clears state', async () => {
    const { app, identity } = setup();
    const login = await app.request('https://app.example/auth/login');
    const state = new URL(login.headers.get('location')!).searchParams.get(
      'state',
    );
    const response = await app.request(
      `/auth/callback?code=code&state=${state}`,
      {
        headers: { cookie: login.headers.get('set-cookie')!.split(';')[0]! },
      },
    );
    expect(identity.signIn).toHaveBeenCalledWith('code', expect.any(String));
    expect(response.status).toBe(302);
    expect(response.headers.get('set-cookie')).toContain(
      '__Host-specsync-session=session-token',
    );
    expect(response.headers.get('set-cookie')).toContain('SameSite=Lax');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('rejects missing or mismatched state without exchanging a code', async () => {
    const { app, identity } = setup();
    const response = await app.request(
      '/auth/callback?code=code&state=attacker',
    );
    expect(response.status).toBe(400);
    expect(identity.signIn).not.toHaveBeenCalled();
  });
  it('does not expose provider errors or secrets', async () => {
    const { app, identity } = setup();
    vi.mocked(identity.signIn).mockRejectedValue(
      new Error('secret google token'),
    );
    const response = await app.request('/auth/callback?code=code&state=state', {
      headers: { cookie: '__Host-specsync-oauth=state.verifier' },
    });
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain('secret google token');
  });
  it('requires the configured origin on cookie-authenticated mutations and logout', async () => {
    const { app, fetcher } = setup();
    const form = await app.request('/auth/logout');
    expect(form.headers.get('referrer-policy')).toBe('same-origin');
    for (const origin of ['', 'null', 'https://evil.example']) {
      expect(
        (
          await app.request('/ai/copilotkit', {
            method: 'POST',
            headers: { cookie, origin },
            body: '{}',
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await app.request('/auth/logout', {
            method: 'POST',
            headers: { cookie, origin },
          })
        ).status,
      ).toBe(403);
    }
    expect(fetcher).not.toHaveBeenCalled();
    const logout = await app.request('/auth/logout', {
      method: 'POST',
      headers: { origin: config.publicOrigin, cookie },
    });
    expect(logout.status).toBe(204);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('returns verified roles and prevents shared caching', async () => {
    const { app } = setup();
    const response = await app.request('/auth/me', { headers: { cookie } });
    expect(await response.json()).toEqual(user);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('replaces spoofed context, drops cookies and forwarding headers, and preserves curator credentials', async () => {
    const { app, fetcher, identity } = setup();
    await app.request('/api/ingestions?q=a%26b', {
      headers: {
        cookie,
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
    expect(headers.get('x-specsync-session')).toBe('valid');
    expect(headers.has('cookie')).toBe(false);
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
      headers: { cookie, origin: config.publicOrigin },
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
        headers: { cookie },
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
      expect((await app.request(path, { headers: { cookie } })).status).toBe(
        404,
      );
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
      headers: { cookie },
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
      headers: { cookie },
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
      (await app.request('/api/vehicles', { headers: { cookie } })).status,
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
