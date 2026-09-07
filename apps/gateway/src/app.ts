import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

import type { GatewayConfig } from './config.js';
import type { IdentityService } from './identity.js';
import { SESSION_SECONDS } from './identity.js';
import { forward } from './proxy.js';

export function createGateway(
  config: GatewayConfig,
  identity: IdentityService,
  fetcher: typeof fetch = fetch,
) {
  const app = new Hono();
  const secure = config.publicOrigin.startsWith('https:');
  const sessionName = secure ? '__Host-specsync-session' : 'specsync-session';
  const stateName = secure ? '__Host-specsync-oauth' : 'specsync-oauth';
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: 'Lax' as const,
    path: '/',
  };
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'private, no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('X-Frame-Options', 'DENY');
    if (secure) c.header('Strict-Transport-Security', 'max-age=31536000');
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) &&
      c.req.header('Origin') !== config.publicOrigin
    )
      return c.json({ error: 'Invalid request origin' }, 403);
    return next();
  });
  app.get('/health', (c) => c.text('ok'));
  app.get('/auth/login', (c) => {
    // Keep state and callback cookies on the configured browser origin, including
    // when the user arrives through Cloud Run's alternate default hostname.
    if (new URL(c.req.url).host !== new URL(config.publicOrigin).host)
      return c.redirect(`${config.publicOrigin}/auth/login`);
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    setCookie(c, stateName, `${state}.${verifier}`, {
      ...cookieOptions,
      maxAge: 600,
    });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: config.googleClientId,
      redirect_uri: `${config.publicOrigin}/auth/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    return c.redirect(url.toString());
  });
  app.get('/auth/callback', async (c) => {
    const [expected, verifier] = (getCookie(c, stateName) ?? '').split('.');
    deleteCookie(c, stateName, cookieOptions);
    const state = c.req.query('state');
    const code = c.req.query('code');
    if (
      !expected ||
      !verifier ||
      !state ||
      !code ||
      Buffer.byteLength(state) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(expected))
    )
      return c.json(
        { error: 'Invalid sign-in state. Start sign-in again.' },
        400,
      );
    try {
      const cookie = await identity.signIn(code, verifier);
      setCookie(c, sessionName, cookie, {
        ...cookieOptions,
        maxAge: SESSION_SECONDS,
      });
      return c.redirect('/');
    } catch {
      return c.json(
        { error: 'Google sign-in failed. Start sign-in again.' },
        401,
      );
    }
  });
  app.post('/auth/logout', (c) => {
    deleteCookie(c, sessionName, cookieOptions);
    return c.body(null, 204);
  });
  app.get('/auth/logout', (c) =>
    c.html(
      '<!doctype html><html lang="en"><title>Sign out</title><form method="post" action="/auth/logout"><button>Sign out of SpecSync</button></form></html>',
    ),
  );
  app.all('*', async (c) => {
    let user;
    try {
      const cookie = getCookie(c, sessionName);
      if (!cookie) throw new Error('Missing session');
      user = await identity.verifySession(cookie);
    } catch {
      deleteCookie(c, sessionName, cookieOptions);
      if (
        c.req.method === 'GET' &&
        c.req.header('Accept')?.includes('text/html')
      )
        return c.redirect('/auth/login');
      return c.json(
        { error: 'Authentication required', loginUrl: '/auth/login' },
        401,
      );
    }
    if (c.req.path === '/auth/me' && c.req.method === 'GET')
      return c.json(user);
    const path = c.req.path;
    let origin = config.webUrl;
    let upstreamPath = path;
    if (path === '/ai' || path.startsWith('/ai/')) {
      // Expose only the browser's AI contract, never Studio, workflows or worker endpoints.
      if (
        !(
          (path === '/ai/copilotkit' &&
            ['GET', 'POST'].includes(c.req.method)) ||
          (path === '/ai/chat/models' && c.req.method === 'GET')
        )
      )
        return c.json({ error: 'Not found' }, 404);
      origin = config.aiUrl;
      upstreamPath = path.slice(3);
    } else if (/^\/(api|v3\/api-docs|swagger-ui)(\/|$)/.test(path)) {
      origin = config.apiUrl;
    } else if (
      path.startsWith('/auth/') ||
      !['GET', 'HEAD'].includes(c.req.method)
    ) {
      return c.json({ error: 'Not found' }, 404);
    }
    try {
      const token = config.cloudRunAuth
        ? await identity.invocationToken(origin)
        : undefined;
      return await forward(
        c.req.raw,
        origin,
        upstreamPath,
        user,
        token,
        origin === config.webUrl ? undefined : getCookie(c, sessionName),
        fetcher,
      );
    } catch {
      return c.json({ error: 'Service unavailable' }, 502);
    }
  });
  app.onError((_error, c) => c.json({ error: 'Gateway request failed' }, 500));
  return app;
}
