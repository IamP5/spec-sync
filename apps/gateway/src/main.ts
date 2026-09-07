import { serve } from '@hono/node-server';

import { createGateway } from './app.js';
import { loadConfig } from './config.js';
import { createIdentityService } from './identity.js';

const config = loadConfig();
const app = createGateway(config, createIdentityService(config));
const server = serve({
  fetch: app.fetch,
  hostname: '0.0.0.0',
  port: Number(process.env['PORT'] ?? 3000),
});
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
