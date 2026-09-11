import { registerCopilotKit } from '@ag-ui/mastra/copilotkit';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { registerApiRoute } from '@mastra/core/server';

import { CHAT_AGENT_ID } from './agents/spec-sync-agent';
import { setChatModelContext } from './chat-model-route';
import { setChatCreditsContext } from './credits/credits-run';
import { requireVerifiedUser, setChatIdentityContext } from './identity';
import { HistorySafeMastraAgent } from './threads/history-safe-agent';

export const COPILOTKIT_PATH = '/copilotkit';

/** Per-request agents retain the verified identity through CopilotKit's clone lifecycle. */
export const chatRuntimeRoute = registerApiRoute(COPILOTKIT_PATH, {
  method: 'ALL',
  middleware: requireVerifiedUser,
  handler: async (c, next) => {
    const requestContext = c.get('requestContext');
    await setChatIdentityContext(c, requestContext);
    await setChatModelContext(c, requestContext);
    await setChatCreditsContext(c, requestContext);
    const resourceId = requestContext.get<
      typeof MASTRA_RESOURCE_ID_KEY,
      string
    >(MASTRA_RESOURCE_ID_KEY);
    if (!resourceId) throw new Error('Chat requires a verified resource.');
    const route = registerCopilotKit({
      path: COPILOTKIT_PATH,
      resourceId,
      agents: {
        [CHAT_AGENT_ID]: new HistorySafeMastraAgent({
          agentId: CHAT_AGENT_ID,
          agent: c.get('mastra').getAgentById(CHAT_AGENT_ID),
          requestContext,
          resourceId,
        }),
      },
    });
    if (!('handler' in route))
      throw new Error('CopilotKit did not provide a route handler.');
    return route.handler(c, next);
  },
});
