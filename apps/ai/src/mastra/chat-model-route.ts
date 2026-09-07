import type { RequestContext } from '@mastra/core/request-context';
import { type ContextWithMastra, registerApiRoute } from '@mastra/core/server';

import {
  CHAT_EFFORT_KEY,
  CHAT_MODEL_KEY,
  chatEfforts,
  chatModels,
  DEFAULT_EFFORT_ID,
  modelId,
} from './models';

/**
 * Path of the model catalog route. The web app reaches it as
 * `/ai/chat/models` (nginx and `apps/web/proxy.conf.json` strip the `/ai`
 * prefix). Rename only together with `ChatModelClient` in apps/web.
 */
export const CHAT_MODELS_PATH = '/chat/models';

/**
 * Key of the CopilotKit `properties` (sent as AG-UI `forwardedProps`) that
 * carries the model the user picked. Part of the contract with
 * `ChatAgentClient` in apps/web.
 */
export const CHAT_MODEL_PROPERTY = 'model';

/** Key of the CopilotKit property that carries the picked reasoning effort. */
export const CHAT_EFFORT_PROPERTY = 'effort';

/** What the browser asked for with a run; each id is validated by `models.ts`. */
export interface RequestedRun {
  model?: string;
  effort?: string;
}

/**
 * Lists the models the chat can run on, so the browser only offers what this
 * service can actually serve (OpenAI only appears when its key is set), and
 * the reasoning efforts it can apply to them.
 */
export const chatModelRoutes = [
  registerApiRoute(CHAT_MODELS_PATH, {
    method: 'GET',
    handler: (c) =>
      c.json({
        defaultModelId: modelId,
        models: chatModels(),
        defaultEffortId: DEFAULT_EFFORT_ID,
        efforts: chatEfforts(),
      }),
  }),
];

/**
 * `setContext` hook of the CopilotKit route: reads the model and reasoning
 * effort the browser asked for from the run request and stores them in the
 * request context, where the chat agent's dynamic `model` and
 * `defaultOptions` pick them up (`chatModelFor`, `chatProviderOptionsFor`).
 *
 * CopilotKit posts a JSON envelope `{ method, body }` to the runtime route in
 * single-route mode; for `agent/run` the body is the AG-UI `RunAgentInput`
 * whose `forwardedProps` hold the client's `properties`. The body is read
 * from a clone, the runtime still parses the original. Anything unexpected
 * is ignored: the agent then runs on the default model.
 */
export async function setChatModelContext(
  c: ContextWithMastra,
  requestContext: RequestContext,
): Promise<void> {
  const { model, effort } = await requestedRun(c.req.raw);
  if (model) {
    requestContext.set(CHAT_MODEL_KEY, model);
  }
  if (effort) {
    requestContext.set(CHAT_EFFORT_KEY, effort);
  }
}

export async function requestedRun(request: Request): Promise<RequestedRun> {
  if (request.method !== 'POST') {
    return {};
  }
  try {
    const envelope: unknown = await request.clone().json();
    if (!isRecord(envelope) || envelope['method'] !== 'agent/run') {
      return {};
    }
    const body = envelope['body'];
    const props = isRecord(body) ? body['forwardedProps'] : undefined;
    return {
      model: stringProperty(props, CHAT_MODEL_PROPERTY),
      effort: stringProperty(props, CHAT_EFFORT_PROPERTY),
    };
  } catch {
    // Not JSON, or the body was already consumed: no preferences.
    return {};
  }
}

function stringProperty(props: unknown, key: string): string | undefined {
  const value = isRecord(props) ? props[key] : undefined;
  return typeof value === 'string' && value ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
