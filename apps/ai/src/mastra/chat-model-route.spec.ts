import { RequestContext } from '@mastra/core/request-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  autoModeSignals,
  CHAT_EFFORT_PROPERTY,
  CHAT_MODE_PROPERTY,
  CHAT_MODEL_PROPERTY,
  CHAT_MODELS_PATH,
  CHAT_ROLE_MODELS_PROPERTY,
  chatCatalog,
  chatModelRoutes,
  offeredChatModels,
  requestedRun,
  setChatModelContext,
} from './chat-model-route';
import {
  activeTariffs,
  CREDITS_SERVICE_KEY_ENV,
  resetTariffCache,
} from './credits/credits-client';
import {
  CHAT_EFFORT_KEY,
  CHAT_MODE_KEY,
  CHAT_RESOLVED_MODE_KEY,
  CHAT_ROLE_MODELS_KEY,
  chatModels,
} from './models';

function runRequest(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost/copilotkit', {
    method,
    headers: { 'content-type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

/** Micro-credits per million, as the seeded OpenRouter rate card states them. */
function tariff(modelId: string, input: number, output: number) {
  return {
    provider: 'openrouter',
    modelId,
    tariffVersion: 1,
    inputPerMillion: input,
    cachedInputPerMillion: input / 4,
    outputPerMillion: output,
    minimumCharge: 1,
  };
}

// The prices V8 actually seeds, so the expectations below double as the
// documented cost of a message in each mode.
const RATE_CARD = [
  tariff('google/gemini-3.5-flash-lite', 30_000_000, 250_000_000),
  tariff('google/gemini-3.8-flash', 75_000_000, 375_000_000),
  tariff('google/gemini-3.1-pro-preview', 200_000_000, 1_200_000_000),
  tariff('anthropic/claude-sonnet-5', 200_000_000, 1_000_000_000),
];

function stubTariffs(models: unknown[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ models }), {
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
}

describe('chat model route', () => {
  it('keeps the route path and the properties the web app relies on', () => {
    expect(CHAT_MODELS_PATH).toBe('/chat/models');
    expect(CHAT_MODE_PROPERTY).toBe('mode');
    expect(CHAT_ROLE_MODELS_PROPERTY).toBe('roleModels');
    expect(CHAT_MODEL_PROPERTY).toBe('model');
    expect(CHAT_EFFORT_PROPERTY).toBe('effort');
    expect(chatModelRoutes.map((route) => [route.path, route.method])).toEqual([
      ['/chat/models', 'GET'],
    ]);
  });

  it('reads the AG-UI run and thread ids the credits module bills against', async () => {
    await expect(
      requestedRun(
        runRequest({
          method: 'agent/run',
          body: { runId: 'agui-run', threadId: 'agui-thread' },
        }),
      ),
    ).resolves.toMatchObject({ runId: 'agui-run', threadId: 'agui-thread' });
  });

  it('reads the mode, the role overrides and the effort from the forwarded properties', async () => {
    await expect(
      requestedRun(
        runRequest({
          method: 'agent/run',
          body: {
            forwardedProps: {
              mode: 'intelligent',
              roleModels: { vision: 'google/gemini-3.8-flash', chat: '' },
              effort: 'high',
            },
          },
        }),
      ),
    ).resolves.toMatchObject({
      mode: 'intelligent',
      roleModels: { vision: 'google/gemini-3.8-flash' },
      effort: 'high',
    });
  });

  it('ignores other methods, envelopes without preferences and unreadable bodies', async () => {
    await expect(requestedRun(runRequest({ method: 'info' }))).resolves.toEqual(
      {},
    );
    await expect(
      requestedRun(runRequest({ method: 'agent/run', body: {} })),
    ).resolves.toMatchObject({ mode: undefined, roleModels: undefined });
    await expect(
      requestedRun(
        runRequest({
          method: 'agent/run',
          body: { forwardedProps: { mode: 7, roleModels: 'no', effort: '' } },
        }),
      ),
    ).resolves.toMatchObject({
      mode: undefined,
      roleModels: undefined,
      effort: undefined,
    });
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
      body: { forwardedProps: { mode: 'velocity' } },
    });
    await requestedRun(request);
    await expect(request.json()).resolves.toMatchObject({
      method: 'agent/run',
    });
  });
});

describe('request context', () => {
  async function contextOf(body: unknown): Promise<RequestContext> {
    const requestContext = new RequestContext();
    await setChatModelContext(
      { req: { raw: runRequest(body) } } as Parameters<
        typeof setChatModelContext
      >[0],
      requestContext,
    );
    return requestContext;
  }

  it('stores the mode, the overrides and the effort under the role registry keys', async () => {
    const requestContext = await contextOf({
      method: 'agent/run',
      body: {
        forwardedProps: {
          mode: 'intelligent',
          roleModels: { vision: 'google/gemini-3.8-flash' },
          effort: 'medium',
        },
      },
    });
    expect(requestContext.get(CHAT_MODE_KEY)).toBe('intelligent');
    expect(requestContext.get(CHAT_RESOLVED_MODE_KEY)).toBe('intelligent');
    expect(requestContext.get(CHAT_ROLE_MODELS_KEY)).toEqual({
      vision: 'google/gemini-3.8-flash',
    });
    expect(requestContext.get(CHAT_EFFORT_KEY)).toBe('medium');
  });

  it('maps a stale browser sending only `model` into a chat role override', async () => {
    const requestContext = await contextOf({
      method: 'agent/run',
      body: { forwardedProps: { model: 'google/gemini-3.5-flash-lite' } },
    });
    expect(requestContext.get(CHAT_ROLE_MODELS_KEY)).toEqual({
      chat: 'google/gemini-3.5-flash-lite',
    });
    expect(requestContext.get(CHAT_MODE_KEY)).toBe('normal');
  });

  it('lets an explicit chat override win over the compatibility property', async () => {
    const requestContext = await contextOf({
      method: 'agent/run',
      body: {
        forwardedProps: {
          model: 'google/gemini-3.5-flash-lite',
          roleModels: { chat: 'anthropic/claude-sonnet-5' },
        },
      },
    });
    expect(requestContext.get(CHAT_ROLE_MODELS_KEY)).toEqual({
      chat: 'anthropic/claude-sonnet-5',
    });
  });

  it('resolves and pins the auto mode before the run is admitted', async () => {
    const short = await contextOf({
      method: 'agent/run',
      body: {
        forwardedProps: { mode: 'auto' },
        messages: [{ role: 'user', content: 'Ranger price?' }],
      },
    });
    expect(short.get(CHAT_MODE_KEY)).toBe('auto');
    expect(short.get(CHAT_RESOLVED_MODE_KEY)).toBe('velocity');

    const comparison = await contextOf({
      method: 'agent/run',
      body: {
        forwardedProps: { mode: 'auto' },
        messages: [
          {
            role: 'user',
            content: 'Compare the Ranger, the Hilux and the S10',
          },
        ],
      },
    });
    expect(comparison.get(CHAT_RESOLVED_MODE_KEY)).toBe('intelligent');
  });

  it('defaults to normal when the browser sends no mode at all', async () => {
    const requestContext = await contextOf({ method: 'agent/run', body: {} });
    expect(requestContext.get(CHAT_MODE_KEY)).toBe('normal');
    expect(requestContext.get(CHAT_RESOLVED_MODE_KEY)).toBe('normal');
  });
});

describe('auto mode signals', () => {
  it('reads the last user message and the thread state off the run', () => {
    expect(
      autoModeSignals({
        messages: [
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'answer' },
          { role: 'tool', toolName: 'previewVehicleSource', content: '{}' },
          { role: 'user', content: [{ type: 'text', text: 'second' }] },
        ],
      }),
    ).toEqual({
      prompt: 'second',
      usedIngestionTool: true,
      previousTurnFailed: false,
    });
  });

  it('sees a failed previous turn in the last tool result', () => {
    expect(
      autoModeSignals({
        messages: [
          { role: 'tool', content: '{"status":"ERROR","message":"down"}' },
          { role: 'user', content: 'and now?' },
        ],
      }),
    ).toMatchObject({ previousTurnFailed: true });
    expect(autoModeSignals({})).toEqual({ prompt: '' });
  });
});

describe('catalog', () => {
  const KEY = 'k'.repeat(48);

  beforeEach(() => {
    // apps/ai/.env reaches the tests through Vite; pin the feature flag.
    vi.stubEnv(CREDITS_SERVICE_KEY_ENV, '');
    vi.stubEnv('SPECSYNC_CHAT_MODELS', '');
  });

  afterEach(() => {
    resetTariffCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('serves the modes, roles, models and efforts while credits are disabled', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const catalog = await chatCatalog();
    expect(catalog).toMatchObject({
      defaultModeId: 'normal',
      resolvedMode: null,
      defaultEffortId: 'auto',
    });
    expect(catalog.modes.map((mode) => mode.id)).toEqual([
      'velocity',
      'normal',
      'intelligent',
      'auto',
    ]);
    // Without a wallet there is nothing to price a reference turn with.
    for (const mode of catalog.modes) {
      expect(mode.estimatedCredits).toBeNull();
      expect(mode.relativeCost).toBeNull();
      expect(mode.affordable).toBeNull();
    }
    expect(catalog.models).toEqual(chatModels());
    expect(catalog.roles.map((role) => role.id)).toEqual([
      'chat',
      'vision',
      'identification',
      'contentDiscovery',
    ]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('prices the reference turn of every mode from the live tariffs', async () => {
    vi.stubEnv(CREDITS_SERVICE_KEY_ENV, KEY);
    stubTariffs(RATE_CARD);
    const { modes } = await chatCatalog();
    const byId = Object.fromEntries(modes.map((mode) => [mode.id, mode]));
    // 8,000 input + 1,500 output on the mode's chat model.
    expect(byId['velocity']?.estimatedCredits).toBe(
      30_000_000 * 0.008 + 250_000_000 * 0.0015,
    );
    expect(byId['normal']?.estimatedCredits).toBe(
      75_000_000 * 0.008 + 375_000_000 * 0.0015,
    );
    expect(byId['intelligent']?.estimatedCredits).toBe(
      200_000_000 * 0.008 + 1_000_000_000 * 0.0015,
    );
    // 0.62 / 1.16 / 3.10 credits a message on the seeded card.
    expect(byId['velocity']?.relativeCost).toBe(0.5);
    expect(byId['normal']?.relativeCost).toBe(1);
    expect(byId['intelligent']?.relativeCost).toBe(2.7);
    expect(byId['auto']?.chatModelId).toBeNull();
    // The route is unauthenticated, so it cannot know a balance.
    expect(byId['intelligent']?.affordable).toBeNull();
  });

  it('does not offer a mode whose model has no active tariff', async () => {
    vi.stubEnv(CREDITS_SERVICE_KEY_ENV, KEY);
    stubTariffs(
      RATE_CARD.filter(
        (entry) => entry.modelId !== 'anthropic/claude-sonnet-5',
      ),
    );
    const { modes, models } = await chatCatalog();
    expect(modes.map((mode) => mode.id)).toEqual([
      'velocity',
      'normal',
      'auto',
    ]);
    expect(models.map((model) => model.id)).not.toContain(
      'anthropic/claude-sonnet-5',
    );
  });

  it('keeps normal offerable on the cheapest priced model when its own is unpriced', async () => {
    vi.stubEnv(CREDITS_SERVICE_KEY_ENV, KEY);
    stubTariffs([RATE_CARD[0]]);
    const logged: string[] = [];
    const { modes } = await chatCatalog((message) => logged.push(message));
    const normal = modes.find((mode) => mode.id === 'normal');
    expect(normal?.chatModelId).toBe('google/gemini-3.5-flash-lite');
    expect(logged.join()).toContain('falls back to');
  });

  it('offers the unfiltered catalog when no tariff list could ever be read', async () => {
    vi.stubEnv(CREDITS_SERVICE_KEY_ENV, KEY);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    await expect(activeTariffs()).resolves.toBeUndefined();
    expect(offeredChatModels()).toEqual(chatModels());
    const { modes } = await chatCatalog();
    expect(modes.map((mode) => mode.id)).toEqual([
      'velocity',
      'normal',
      'intelligent',
      'auto',
    ]);
  });
});
