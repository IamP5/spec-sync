import { fileURLToPath } from 'node:url';

import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';

import { chatAgent } from './agents/chat-agent';

const production = process.env['NODE_ENV'] === 'production';

// The bundle runs as apps/ai/.mastra/output/index.mjs, so the dev database
// lands in the git-ignored .mastra folder. Neither a relative `file:` URL nor
// process.cwd() is reliable here: `mastra dev` changes into src/mastra/public
// and a relative database would be copied into the image as a public file.
const devDatabase = `file:${fileURLToPath(new URL('../dev.db', import.meta.url))}`;

/**
 * Mastra registry served by `mastra dev` (Studio on http://localhost:4111) and,
 * after `mastra build`, by `node .mastra/output/index.mjs` on Cloud Run.
 *
 * Storage is only attached outside production: Studio uses it for traces and
 * chat history while developing. The Cloud Run service is stateless; the
 * conversation lives in the browser (see apps/web, domain `chat`).
 *
 * Host and port come from the environment (`MASTRA_HOST`, `PORT`): Cloud Run
 * injects PORT and the Dockerfile sets MASTRA_HOST=0.0.0.0.
 */
export const mastra = new Mastra({
  agents: { [chatAgent.id]: chatAgent },
  storage: production
    ? undefined
    : new LibSQLStore({ id: 'ai-dev', url: devDatabase }),
  logger: new PinoLogger({
    name: 'ai',
    level: production ? 'info' : 'debug',
  }),
});
