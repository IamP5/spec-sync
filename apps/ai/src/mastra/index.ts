import { fileURLToPath } from 'node:url';

import { registerCopilotKit } from '@ag-ui/mastra/copilotkit';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';

import { CHAT_AGENT_ID, specSyncAgent } from './agents/spec-sync-agent';
import { chatModelRoutes, setChatModelContext } from './chat-model-route';
import { ingestionRoutes } from './ingestion/routes';
import { vehicleIngestionWorkflow } from './ingestion/workflow';

const production = process.env['NODE_ENV'] === 'production';

/**
 * Path of the CopilotKit runtime route. The web app reaches it as
 * `/ai/copilotkit` (nginx and `apps/web/proxy.conf.json` strip the `/ai`
 * prefix). Rename only together with `ChatAgentClient` in apps/web.
 */
export const COPILOTKIT_PATH = '/copilotkit';

// The bundle runs as apps/ai/.mastra/output/index.mjs, so the dev database
// lands in the git-ignored .mastra folder. Neither a relative `file:` URL nor
// process.cwd() is reliable here: `mastra dev` changes into src/mastra/public
// and a relative database would be copied into the image as a public file.
const devDatabase = `file:${fileURLToPath(new URL('../dev.db', import.meta.url))}`;

/**
 * Mastra registry served by `mastra dev` (Studio on http://localhost:4111) and,
 * after `mastra build`, by `node .mastra/output/index.mjs` on Cloud Run.
 *
 * Besides Mastra's own API the server exposes one CopilotKit runtime route.
 * It speaks AG-UI: every registered agent is wrapped by `@ag-ui/mastra`,
 * which turns the Mastra stream into AG-UI events (text chunks, tool calls,
 * tool results) and hands the frontend tools advertised by the browser to
 * the agent as client tools. The Angular app talks to it with
 * `@copilotkit/angular`.
 *
 * Storage is only attached outside production: Studio uses it for traces and
 * chat history while developing. The Cloud Run service is stateless; the
 * conversation lives in the browser (see apps/web, domain `chat`).
 *
 * Host and port come from the environment (`MASTRA_HOST`, `PORT`): Cloud Run
 * injects PORT and the Dockerfile sets MASTRA_HOST=0.0.0.0.
 */
export const mastra = new Mastra({
  agents: { [specSyncAgent.id]: specSyncAgent },
  // Bounded ingestion pipeline; the API owns run status, review and publication.
  workflows: { [vehicleIngestionWorkflow.id]: vehicleIngestionWorkflow },
  storage: production
    ? undefined
    : new LibSQLStore({ id: 'ai-dev', url: devDatabase }),
  logger: new PinoLogger({
    name: 'ai',
    level: production ? 'info' : 'debug',
  }),
  server: {
    apiRoutes: [
      ...ingestionRoutes,
      ...chatModelRoutes,
      registerCopilotKit({
        path: COPILOTKIT_PATH,
        // Memory scope for agents that have one; the chat agent has none.
        resourceId: CHAT_AGENT_ID,
        // The model the user picked travels as a CopilotKit property.
        setContext: setChatModelContext,
      }),
    ],
  },
  bundler: {
    // The CopilotKit runtime is not bundleable; `mastra build` installs it
    // into the output's node_modules instead.
    externals: ['@copilotkit/runtime', 'pdfjs-dist', '@napi-rs/canvas'],
  },
});
