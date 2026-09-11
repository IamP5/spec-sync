import { randomUUID } from 'node:crypto';

import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { RESOURCE_PREFIX } from '../identity';
import {
  competitivePlanSchema,
  competitiveRejectionSchema,
  competitiveWorkspaceInputSchema,
  competitiveWorkspaceOutputSchema,
} from '../workspace/competitive-contracts';
import {
  applyCompetitiveAction,
  CompetitiveActionError,
  competitiveActionOf,
  latestCompetitiveWorkspace,
  rejectCompetitiveAction,
} from '../workspace/competitive-history';
import { retrieveCompetitiveWorkspace } from '../workspace/competitive-retrieval';

export const renderCompetitiveWorkspace = createTool({
  id: 'renderCompetitiveWorkspace',
  description:
    'Build or update a Ford employee’s competitive market analysis workspace with up to six approved panels: one multi-search selection catalog, comparison, exact review evidence, evidence gaps, existing private research, or a numeric target scenario. Supply bounded retrieval intent, never factual payloads or UI code. The brief holds the analyst objective, explicitly known market/year, Ford baseline, selected configurations, canonical attributes and focus areas. Missing identity or attributes produce clarification controls rather than guessed selections. Comparison/gaps/scenarios reuse one authoritative request. Scenario targetValue is an explicit user assumption in the catalog unit; no default target, fabricated costs, winner or unsupported advantage. To update a saved workspace, supply target.surfaceId and target.baseRevision from its latest successful tool result. Preserve stable panel IDs. Typed workspace actions are validated server-side and their values take precedence. Research panels reference the user’s private requestId, not a work ID; they never start research or publish data.',
  inputSchema: competitiveWorkspaceInputSchema,
  outputSchema: z.union([
    competitiveWorkspaceOutputSchema,
    competitiveRejectionSchema,
  ]),
  execute: async (input, context) => {
    try {
      const resourceId = context?.requestContext?.get(MASTRA_RESOURCE_ID_KEY);
      const threadId = context?.agent?.threadId;
      if (
        typeof resourceId !== 'string' ||
        !resourceId.startsWith(RESOURCE_PREFIX) ||
        !threadId ||
        !context?.mastra ||
        (context.agent?.resourceId && context.agent.resourceId !== resourceId)
      )
        throw new Error(
          'Competitive analysis requires a verified conversation.',
        );
      const agent = context.mastra.getAgentById(
        context.agent?.agentId ?? 'chat',
      );
      const memory = await agent.getMemory({
        requestContext: context.requestContext,
      });
      if (!memory) throw new Error('Chat memory is unavailable.');
      const read = async () => {
        context.abortSignal?.throwIfAborted();
        const thread = await memory.getThreadById({ threadId });
        if (!thread || thread.resourceId !== resourceId)
          throw new Error('Chat thread does not belong to the verified user.');
        const history = await memory.recall({
          threadId,
          resourceId,
          perPage: false,
        });
        context.abortSignal?.throwIfAborted();
        return history.messages;
      };
      const action = competitiveActionOf(context.requestContext);
      if (action?.consumed)
        rejectCompetitiveAction(
          'ACTION_ALREADY_APPLIED',
          'A workspace action can produce only one update per run.',
          action.action.surfaceId,
        );
      // Reserve before awaiting history so parallel calls within this agent
      // step cannot both apply the same typed action.
      if (action) action.consumed = true;
      const target = action
        ? {
            surfaceId: action.action.surfaceId,
            baseRevision: action.action.expectedRevision,
          }
        : input.target;
      const messages = await read();
      if (target)
        latestCompetitiveWorkspace(
          messages,
          target.surfaceId,
          target.baseRevision,
        );
      const { target: _target, ...definition } = input;
      let plan = competitivePlanSchema.parse(definition);
      if (action) {
        plan = applyCompetitiveAction(plan, action);
      }
      const output = await retrieveCompetitiveWorkspace(plan, {
        uid: resourceId.slice(RESOURCE_PREFIX.length),
        surfaceId: target?.surfaceId ?? `competitive-${randomUUID()}`,
        baseRevision: target?.baseRevision ?? 0,
        ...(action
          ? {
              actionId: action.action.actionId,
              action: action.action,
              previous: action.previous,
            }
          : {}),
        signal: context.abortSignal,
      });
      // Recheck after retrieval. Public Mastra memory has no compare-and-swap;
      // simultaneous cross-instance appends are detected as forks on replay.
      if (target)
        latestCompetitiveWorkspace(
          await read(),
          target.surfaceId,
          target.baseRevision,
        );
      context.abortSignal?.throwIfAborted();
      return output;
    } catch (error) {
      if (context?.abortSignal?.aborted) throw error;
      if (error instanceof CompetitiveActionError) return error.rejection;
      throw error;
    }
  },
});
