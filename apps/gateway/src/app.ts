import { Hono } from 'hono';
import { cors } from 'hono/cors';

import type { GatewayConfig } from './config.js';
import type { IdentityService } from './identity.js';
import { forward } from './proxy.js';

export function createGateway(
  config: GatewayConfig,
  identity: IdentityService,
  fetcher: typeof fetch = fetch,
) {
  const app = new Hono();
  app.use(
    '*',
    cors({
      origin: config.frontendOrigin,
      allowMethods: [
        'GET',
        'HEAD',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
      ],
      allowHeaders: [
        'Authorization',
        'Content-Type',
        'X-Ingestion-Key',
        'X-Refresh',
        'Last-Event-ID',
      ],
      exposeHeaders: ['Content-Disposition', 'Retry-After'],
      maxAge: 3600,
    }),
  );
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'private, no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('X-Frame-Options', 'DENY');
    if (config.publicOrigin.startsWith('https:'))
      c.header('Strict-Transport-Security', 'max-age=31536000');
    const origin = c.req.header('Origin');
    if (origin && origin !== config.frontendOrigin)
      return c.json({ error: 'Invalid request origin' }, 403);
    return next();
  });
  app.get('/health', (c) => c.text('ok'));
  app.get('/', (c) => c.redirect(config.frontendOrigin));
  app.all('*', async (c) => {
    let user;
    const token = c.req
      .header('Authorization')
      ?.match(/^Bearer ([^\s]+)$/i)?.[1];
    try {
      if (!token) throw new Error('Missing token');
      user = await identity.verifyToken(token);
    } catch {
      c.header('WWW-Authenticate', 'Bearer');
      return c.json({ error: 'Authentication required' }, 401);
    }
    if (c.req.path === '/auth/session' && c.req.method === 'GET')
      return c.json({ uid: user.uid });
    if (c.req.path === '/user/me' && c.req.method === 'GET')
      return c.json(user);
    const path = c.req.path;
    let origin: string;
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
    } else {
      return c.json({ error: 'Not found' }, 404);
    }
    try {
      const workloadToken = config.cloudRunAuth
        ? await identity.invocationToken(origin)
        : undefined;
      return await forward(
        c.req.raw,
        origin,
        upstreamPath,
        user,
        workloadToken,
        token,
        fetcher,
      );
    } catch {
      return c.json({ error: 'Service unavailable' }, 502);
    }
  });
  app.onError((_error, c) => c.json({ error: 'Gateway request failed' }, 500));
  return app;
}
