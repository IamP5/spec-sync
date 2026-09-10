import { randomUUID } from 'node:crypto';

import {
  MASTRA_RESOURCE_ID_KEY,
  type RequestContext,
} from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { RESOURCE_PREFIX } from '../identity';
import { requestSchema } from '../ingestion/extraction';
import { validateSourceUrl } from '../ingestion/source';
import {
  createResearch,
  readResearch,
  replayResearch,
} from '../research/client';
import {
  researchSummarySchema,
  summarizeResearch,
} from '../research/contracts';

function verifiedUid(requestContext: RequestContext | undefined): string {
  const resource = requestContext?.get(MASTRA_RESOURCE_ID_KEY);
  if (
    typeof resource !== 'string' ||
    !resource.startsWith(RESOURCE_PREFIX) ||
    resource.length === RESOURCE_PREFIX.length
  )
    throw new Error('Authentication required');
  return resource.slice(RESOURCE_PREFIX.length);
}

/** The request context is set by verified-token middleware, outside model-controlled arguments. */
export const researchVehicleSpecifications = createTool({
  id: 'researchVehicleSpecifications',
  description:
    'Start or join shared manufacturer-document research for a signed-in user. Requires an official approved source URL, brand, model and explicit Brazilian model year. The whole document is researched once for all users; requested configurations are a personal selection. Returns a compact progress summary and private request id. The browser fetches and displays full source evidence and draft claims. Draft claims need curator review before catalog publication.',
  inputSchema: requestSchema,
  outputSchema: researchSummarySchema,
  execute: async (request, context) => {
    const uid = verifiedUid(context?.requestContext);
    validateSourceUrl(request.sourceUrl);
    return summarizeResearch(
      await createResearch(
        uid,
        { id: randomUUID(), request },
        context?.abortSignal,
      ),
    );
  },
});

export const getVehicleResearch = createTool({
  id: 'getVehicleResearch',
  description:
    'Read a compact summary of the signed-in user’s existing research request: progress, configuration counts and warnings. Full evidence is displayed by the browser; use published configuration IDs with catalog tools for accepted facts. Use only a private request id returned by researchVehicleSpecifications, never a work id. The browser follows progress automatically; call only when asked for a status update.',
  inputSchema: z.object({ id: z.string().uuid() }),
  outputSchema: researchSummarySchema,
  execute: async ({ id }, context) =>
    summarizeResearch(
      await readResearch(
        verifiedUid(context?.requestContext),
        id,
        context?.abortSignal,
      ),
    ),
});

export const replayVehicleResearch = createTool({
  id: 'replayVehicleResearch',
  description:
    'Reinterpret a completed private research request with the active ontology and normalization rules. Reuses immutable capture and configuration identification; keeps earlier findings and history. Use when asked to apply new attributes or ontology mappings to existing research. This does not publish claims or activate proposals. Input is the user’s private request id, never a work id.',
  inputSchema: z.object({ id: z.string().uuid() }),
  outputSchema: researchSummarySchema,
  execute: async ({ id }, context) =>
    summarizeResearch(
      await replayResearch(
        verifiedUid(context?.requestContext),
        id,
        randomUUID(),
        context?.abortSignal,
      ),
    ),
});
