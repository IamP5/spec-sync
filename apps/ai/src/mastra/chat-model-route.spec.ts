import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import {
  CHAT_EFFORT_PROPERTY,
  CHAT_MODEL_PROPERTY,
  CHAT_MODELS_PATH,
  chatModelRoutes,
  requestedRun,
  setChatModelContext,
} from './chat-model-route';
import { CHAT_EFFORT_KEY, CHAT_MODEL_KEY } from './models';

function runRequest(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost/copilotkit', {
    method,
    headers: { 'content-type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

describe('chat model route', () => {
  it('keeps the route path the web app relies on', () => {
    expect(CHAT_MODELS_PATH).toBe('/chat/models');
    expect(CHAT_MODEL_PROPERTY).toBe('model');
    expect(CHAT_EFFORT_PROPERTY).toBe('effort');
    expect(chatModelRoutes.map((route) => [route.path, route.method])).toEqual([
      ['/chat/models', 'GET'],
    ]);
  });

  it('reads the model and effort from the forwarded properties of a run envelope', async () => {
    await expect(
      requestedRun(
        runRequest({
          method: 'agent/run',
          body: { forwardedProps: { model: 'gpt-5.6-luna', effort: 'high' } },
        }),
      ),
    ).resolves.toEqual({ model: 'gpt-5.6-luna', effort: 'high' });
    await expect(
      requestedRun(
        runRequest({
          method: 'agent/run',
          body: { forwardedProps: { effort: 'low' } },
        }),
      ),
    ).resolves.toEqual({ model: undefined, effort: 'low' });
  });

  it('ignores other methods, envelopes without preferences and unreadable bodies', async () => {
    await expect(requestedRun(runRequest({ method: 'info' }))).resolves.toEqual(
      {},
    );
    await expect(
      requestedRun(runRequest({ method: 'agent/run', body: {} })),
    ).resolves.toEqual({});
    await expect(
      requestedRun(
        runRequest({
          method: 'agent/run',
          body: { forwardedProps: { model: 7, effort: '' } },
        }),
      ),
    ).resolves.toEqual({ model: undefined, effort: undefined });
    await expect(requestedRun(runRequest(undefined, 'GET'))).resolves.toEqual(
      {},
    );
    await expect(
      requestedRun(
        new Request('http://localhost/copilotkit', {
          method: 'POST',
          body: 'not json',
        }),
      ),
    ).resolves.toEqual({});
  });

  it('leaves the request body readable for the runtime', async () => {
    const request = runRequest({
      method: 'agent/run',
      body: { forwardedProps: { model: 'gemini-2.5-pro' } },
    });
    await requestedRun(request);
    await expect(request.json()).resolves.toMatchObject({
      method: 'agent/run',
    });
  });

  it('stores the model and effort in the request context under the agent keys', async () => {
    const requestContext = new RequestContext();
    const raw = runRequest({
      method: 'agent/run',
      body: { forwardedProps: { model: 'gemini-2.5-pro', effort: 'medium' } },
    });
    await setChatModelContext(
      { req: { raw } } as Parameters<typeof setChatModelContext>[0],
      requestContext,
    );
    expect(requestContext.get(CHAT_MODEL_KEY)).toBe('gemini-2.5-pro');
    expect(requestContext.get(CHAT_EFFORT_KEY)).toBe('medium');
  });

  it('serves the efforts next to the models', async () => {
    const route = chatModelRoutes[0];
    if (!route || !('handler' in route)) {
      throw new Error('Expected the model catalog route to have a handler');
    }
    const response = await route.handler(
      {
        json: (body: unknown) => body,
      } as unknown as Parameters<typeof route.handler>[0],
      async () => {
        throw new Error('The model catalog handler should return a response');
      },
    );
    expect(response).toMatchObject({
      defaultEffortId: 'auto',
      efforts: [
        { id: 'auto', label: 'Auto' },
        { id: 'low', label: 'Low' },
        { id: 'medium', label: 'Medium' },
        { id: 'high', label: 'High' },
      ],
    });
  });
});
