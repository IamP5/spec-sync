import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CHAT_RESOLVED_MODE_KEY } from '../models';
import type { CreditsResult } from './credits-client';

const openRun = vi.fn();
const reportUsage = vi.fn();
const finishRun = vi.fn();
let enabled = true;

vi.mock('./credits-client', () => ({
  creditsEnabled: () => enabled,
  openRun: (...args: unknown[]) => openRun(...args),
  reportUsage: (...args: unknown[]) => reportUsage(...args),
  finishRun: (...args: unknown[]) => finishRun(...args),
}));

let verified: { uid: string; resourceId: string } | undefined;

vi.mock('../identity', () => ({
  verifiedUserOf: () => Promise.resolve(verified),
  requireVerifiedUser: (_c: unknown, next: () => Promise<void>) => next(),
}));

const {
  CREDITS_RUN_KEY,
  CreditsRun,
  creditsRunOf,
  formatCredits,
  recordToolUsage,
  setChatCreditsContext,
} = await import('./credits-run');

function admitted(exhausted = false): CreditsResult<never> {
  return {
    status: 'OK',
    value: { runId: 'r-1', hold: 1, balance: 1, available: 1, exhausted },
  } as unknown as CreditsResult<never>;
}

function charged(exhausted: boolean): CreditsResult<never> {
  return {
    status: 'OK',
    value: { charge: 10, balance: 0, available: 0, exhausted },
  } as unknown as CreditsResult<never>;
}

function run() {
  return new CreditsRun('u-1', 'r-1', 't-1');
}

beforeEach(() => {
  enabled = true;
  verified = { uid: 'u-1', resourceId: 'user:u-1' };
  openRun.mockReset().mockResolvedValue(admitted());
  reportUsage.mockReset().mockResolvedValue(charged(false));
  finishRun
    .mockReset()
    .mockResolvedValue({ status: 'OK', value: { exhausted: false } });
});

describe('credit formatting', () => {
  it('formats micro-credits the way apps/web formats a balance', () => {
    expect(formatCredits(183_400_000)).toBe('183');
    expect(formatCredits(1_204_000_000)).toBe('1,204');
    expect(formatCredits(420_000)).toBe('0.42');
    expect(formatCredits(120_000)).toBe('0.12');
    expect(formatCredits(9_000)).toBe('less than 0.01');
    expect(formatCredits(0)).toBe('0');
    expect(formatCredits(-1)).toBe('0');
  });
});

describe('admission', () => {
  it('opens the run once per request whatever calls it', async () => {
    const credits = run();
    await Promise.all([
      credits.admit('vertex', 'gemini-2.5-flash'),
      credits.admit('vertex', 'gemini-2.5-flash'),
    ]);
    await credits.admit('vertex', 'gemini-2.5-flash');
    expect(openRun).toHaveBeenCalledTimes(1);
    expect(openRun).toHaveBeenCalledWith('u-1', {
      runId: 'r-1',
      provider: 'vertex',
      modelId: 'gemini-2.5-flash',
      threadId: 't-1',
    });
  });

  it('throws a credit-denominated, mode-aware message when the balance is too low', async () => {
    openRun.mockResolvedValue({
      status: 'INSUFFICIENT_CREDITS',
      available: 120_000,
      minimumCharge: 185_000,
      cheaperModels: ['openai/gpt-5.6-luna'],
    });
    // Luna serves both cheaper tiers, so both are named.
    await expect(
      run().admit('openrouter', 'openai/gpt-5.6-sol', 'intelligent'),
    ).rejects.toThrow(
      'INSUFFICIENT_CREDITS: Your AI credits (0.12) do not cover a reply in ' +
        'Deep mode. Instant mode, Balanced mode fits your remaining credits.',
    );
  });

  it('names a cheaper model that belongs to no tier by its own label', async () => {
    openRun.mockResolvedValue({
      status: 'INSUFFICIENT_CREDITS',
      available: 120_000,
      minimumCharge: 185_000,
      cheaperModels: ['google/gemini-3.8-flash'],
    });
    await expect(
      run().admit('openrouter', 'openai/gpt-5.6-sol', 'intelligent'),
    ).rejects.toThrow(/Gemini 3\.8 Flash fits your remaining credits\.$/);
  });

  it('names no cheaper mode when none fits', async () => {
    openRun.mockResolvedValue({
      status: 'INSUFFICIENT_CREDITS',
      available: 0,
      minimumCharge: 185_000,
      cheaperModels: [],
    });
    await expect(
      run().admit('openrouter', 'anthropic/claude-sonnet-5', 'intelligent'),
    ).rejects.toThrow(/No cheaper mode fits your remaining credits\.$/);
  });

  it('fails closed when the wallet cannot be reached', async () => {
    openRun.mockResolvedValue({ status: 'UNAVAILABLE', message: 'down' });
    await expect(run().admit('vertex', 'gemini-2.5-flash')).rejects.toThrow(
      'CREDITS_UNAVAILABLE: The credits service is unavailable. Try again in a moment.',
    );
  });
});

describe('metering', () => {
  it('charges a step once per key and joins a racing caller', async () => {
    const credits = run();
    await credits.admit('vertex', 'gemini-2.5-flash');
    await Promise.all([
      credits.recordStep('step-1', { inputTokens: 5, outputTokens: 6 }),
      credits.recordStep('step-1', { inputTokens: 5, outputTokens: 6 }),
    ]);
    await credits.recordStep('step-1', { inputTokens: 5, outputTokens: 6 });
    expect(reportUsage).toHaveBeenCalledTimes(1);
    expect(reportUsage).toHaveBeenCalledWith('u-1', 'r-1', {
      stepKey: 'step-1',
      provider: 'vertex',
      modelId: 'gemini-2.5-flash',
      inputTokens: 5,
      cachedInputTokens: 0,
      outputTokens: 6,
      reasoningTokens: 0,
      estimated: false,
    });
  });

  it('takes the exhausted flag from the charge', async () => {
    const credits = run();
    await credits.admit('vertex', 'gemini-2.5-flash');
    expect(credits.exhausted).toBe(false);
    reportUsage.mockResolvedValue(charged(true));
    await credits.recordStep('step-1', { inputTokens: 1, outputTokens: 1 });
    expect(credits.exhausted).toBe(true);
  });

  it('swallows a failed charge instead of aborting the run', async () => {
    const credits = run();
    await credits.admit('vertex', 'gemini-2.5-flash');
    reportUsage.mockResolvedValue({ status: 'UNAVAILABLE', message: 'down' });
    await expect(
      credits.recordStep('step-1', { inputTokens: 1, outputTokens: 1 }),
    ).resolves.toBeUndefined();
    expect(credits.exhausted).toBe(false);
  });

  it('does not charge anything before admission', async () => {
    await run().recordStep('step-1', { inputTokens: 1, outputTokens: 1 });
    expect(reportUsage).not.toHaveBeenCalled();
  });

  it('keys a step by the identity both hooks see, and counts the rest', () => {
    const credits = run();
    const step = { response: { id: 'resp-a' } };
    // `stopWhen` and `onStepFinish` are handed the same step object.
    expect(credits.stepKey(step)).toBe('step-resp-a');
    expect(credits.stepKey({ ...step })).toBe('step-resp-a');
    expect(credits.stepKey({ response: { id: 'resp-b' } })).toBe('step-resp-b');
    // Without an id the key falls back to a per-run counter.
    expect(credits.stepKey({})).toBe('step-1');
    expect(credits.stepKey(undefined)).toBe('step-2');
  });

  it('numbers tool calls apart from agent steps', () => {
    const credits = run();
    expect(credits.toolStepKey('previewVehicleSource')).toBe(
      'tool-previewVehicleSource-1',
    );
    expect(credits.toolStepKey('discoverVehicleContent')).toBe(
      'tool-discoverVehicleContent-2',
    );
  });

  it('waits for the charges still in flight before closing the run', async () => {
    const credits = run();
    await credits.admit('vertex', 'gemini-2.5-flash');
    const order: string[] = [];
    let settleUsage: (() => void) | undefined;
    reportUsage.mockImplementation(
      () =>
        new Promise((resolve) => {
          settleUsage = () => {
            order.push('usage');
            resolve(charged(false));
          };
        }),
    );
    finishRun.mockImplementation(() => {
      order.push('finish');
      return Promise.resolve({ status: 'OK', value: { exhausted: false } });
    });

    // The last step charges detached, exactly as `onStepFinish` does.
    void credits.recordStep('step-1', { inputTokens: 1, outputTokens: 1 });
    const closing = credits.finish('COMPLETED');
    await Promise.resolve();
    expect(finishRun).not.toHaveBeenCalled();

    settleUsage?.();
    await closing;
    // The wallet answers 409 for usage on a closed run: the charge must land first.
    expect(order).toEqual(['usage', 'finish']);
  });

  it('also waits for a charge a tool started while the run was closing', async () => {
    const credits = run();
    await credits.admit('vertex', 'gemini-2.5-flash');
    const order: string[] = [];
    let first: (() => void) | undefined;
    reportUsage.mockImplementation((_uid, _runId, body) => {
      const key = (body as { stepKey: string }).stepKey;
      if (key === 'step-1') {
        return new Promise((resolve) => {
          first = () => {
            order.push('step-1');
            // A tool charge that only starts once the first one settles.
            void credits.recordStep('tool-x-1', { inputTokens: 1 });
            resolve(charged(false));
          };
        });
      }
      order.push(key);
      return Promise.resolve(charged(false));
    });
    finishRun.mockImplementation(() => {
      order.push('finish');
      return Promise.resolve({ status: 'OK', value: { exhausted: false } });
    });

    void credits.recordStep('step-1', { inputTokens: 1 });
    const closing = credits.finish('COMPLETED');
    await Promise.resolve();
    first?.();
    await closing;
    expect(order).toEqual(['step-1', 'tool-x-1', 'finish']);
  });

  it('closes the run once', async () => {
    const credits = run();
    await credits.admit('vertex', 'gemini-2.5-flash');
    await credits.finish('COMPLETED');
    await credits.finish('EXHAUSTED');
    expect(finishRun).toHaveBeenCalledTimes(1);
    expect(finishRun).toHaveBeenCalledWith('u-1', 'r-1', 'COMPLETED');
  });

  it('does not close a run that was never admitted', async () => {
    await run().finish('FAILED');
    expect(finishRun).not.toHaveBeenCalled();
  });
});

describe('tool usage', () => {
  it('charges a sub-agent call at the tariff of its own role, not the chat one', async () => {
    const credits = run();
    // Deep runs the chat on Sol but transcribes on Gemini Flash; a preview
    // inside the run must be charged at the vision tariff.
    await credits.admit('openrouter', 'openai/gpt-5.6-sol', 'intelligent');
    const requestContext = new RequestContext();
    requestContext.set(CREDITS_RUN_KEY, credits);
    requestContext.set(CHAT_RESOLVED_MODE_KEY, 'intelligent');
    recordToolUsage(requestContext, 'previewVehicleSource', 'vision', {
      inputTokens: 3,
      outputTokens: 4,
    });
    recordToolUsage(
      requestContext,
      'discoverVehicleSpecificationSources',
      'discovery',
      { inputTokens: 1, outputTokens: 1 },
    );
    await Promise.resolve();
    expect(reportUsage).toHaveBeenCalledWith(
      'u-1',
      'r-1',
      expect.objectContaining({
        stepKey: 'tool-previewVehicleSource-1',
        provider: 'openrouter',
        modelId: 'google/gemini-3.8-flash',
      }),
    );
    // Grounding stays on Vertex, so it is charged against the Vertex tariff
    // of the Gemini generation the tier reads with.
    expect(reportUsage).toHaveBeenCalledWith(
      'u-1',
      'r-1',
      expect.objectContaining({
        stepKey: 'tool-discoverVehicleSpecificationSources-2',
        provider: 'vertex',
        modelId: 'gemini-3.1-pro-preview',
      }),
    );
  });

  it('never estimates a tool call that reported no usage', async () => {
    const credits = run();
    await credits.admit('vertex', 'gemini-2.5-flash');
    const requestContext = new RequestContext();
    requestContext.set(CREDITS_RUN_KEY, credits);
    recordToolUsage(
      requestContext,
      'discoverVehicleContent',
      'contentDiscovery',
      undefined,
    );
    recordToolUsage(undefined, 'discoverVehicleContent', 'contentDiscovery', {
      inputTokens: 1,
    });
    await Promise.resolve();
    expect(reportUsage).not.toHaveBeenCalled();
  });
});

describe('request context', () => {
  function context(body: unknown, headers = new Headers()) {
    return {
      req: {
        raw: new Request('http://localhost/copilotkit', {
          method: 'POST',
          headers: {
            ...Object.fromEntries(headers),
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        }),
      },
      get: () => undefined,
    } as unknown as Parameters<typeof setChatCreditsContext>[0];
  }

  it('stores a run carrying the AG-UI ids for the verified user', async () => {
    const requestContext = new RequestContext();
    await setChatCreditsContext(
      context({
        method: 'agent/run',
        body: { runId: 'agui-run', threadId: 'agui-thread' },
      }),
      requestContext,
    );
    const credits = creditsRunOf(requestContext);
    expect(credits).toBeInstanceOf(CreditsRun);
    expect(credits?.uid).toBe('u-1');
    expect(credits?.runId).toBe('agui-run');
    expect(credits?.threadId).toBe('agui-thread');
  });

  it('invents a run id when the envelope carries none', async () => {
    const requestContext = new RequestContext();
    await setChatCreditsContext(
      context({ method: 'agent/run', body: {} }),
      requestContext,
    );
    expect(creditsRunOf(requestContext)?.runId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('stores nothing when credits are disabled or the user is unverified', async () => {
    enabled = false;
    const disabled = new RequestContext();
    await setChatCreditsContext(context({ method: 'agent/run' }), disabled);
    expect(creditsRunOf(disabled)).toBeUndefined();

    enabled = true;
    verified = undefined;
    const anonymous = new RequestContext();
    await setChatCreditsContext(context({ method: 'agent/run' }), anonymous);
    expect(creditsRunOf(anonymous)).toBeUndefined();
  });

  it('ignores a request context that holds something else', () => {
    const requestContext = new RequestContext();
    requestContext.set(CREDITS_RUN_KEY, 'not a run');
    expect(creditsRunOf(requestContext)).toBeUndefined();
    expect(creditsRunOf(undefined)).toBeUndefined();
  });
});
