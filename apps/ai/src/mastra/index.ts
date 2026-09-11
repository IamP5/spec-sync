import { fileURLToPath } from 'node:url';

import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';

import { specSyncAgent } from './agents/spec-sync-agent';
import { chatModelRoutes } from './chat-model-route';
import { chatRuntimeRoute } from './chat-runtime-route';
import { chatCreditsRoutes } from './credits/credits-route';
import { ingestionRoutes } from './ingestion/routes';
import { vehicleIngestionWorkflow } from './ingestion/workflow';
import { postgresStorage } from './memory';
import { researchRoutes } from './research/routes';
import { sharedVehicleResearchWorkflow } from './research/workflow';
import { chatThreadRoutes } from './threads/routes';

const production = process.env['NODE_ENV'] === 'production';

export { COPILOTKIT_PATH } from './chat-runtime-route';

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
 * Storage is Cloud SQL whenever SPECSYNC_MEMORY_DATABASE_URL is set: Mastra
 * memory owns the chat threads and messages of every signed-in user (decision
 * of 2026-09-07). Without that variable a LibSQL file serves local
 * development, and production runs without storage at all.
 *
 * Host and port come from the environment (`MASTRA_HOST`, `PORT`): Cloud Run
 * injects PORT and the Dockerfile sets MASTRA_HOST=0.0.0.0.
 */
export const mastra = new Mastra({
  agents: { [specSyncAgent.id]: specSyncAgent },
  // Bounded ingestion pipeline; the API owns run status, review and publication.
  workflows: {
    [vehicleIngestionWorkflow.id]: vehicleIngestionWorkflow,
    [sharedVehicleResearchWorkflow.id]: sharedVehicleResearchWorkflow,
  },
  storage:
    postgresStorage() ??
    (production
      ? undefined
      : new LibSQLStore({ id: 'ai-dev', url: devDatabase })),
  logger: new PinoLogger({
    name: 'ai',
    level: production ? 'info' : 'debug',
  }),
  server: {
    apiRoutes: [
      ...ingestionRoutes,
      ...researchRoutes,
      ...chatModelRoutes,
      ...chatThreadRoutes,
      ...chatCreditsRoutes,
      chatRuntimeRoute,
    ],
  },
  bundler: {
    // The CopilotKit runtime is not bundleable; `mastra build` installs it
    // into the output's node_modules instead.
    externals: ['@copilotkit/runtime', 'pdfjs-dist', '@napi-rs/canvas'],
  },
});
