import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  activeTariffs,
  CREDITS_SERVICE_KEY_ENV,
  creditsEnabled,
  fetchWallet,
  finishRun,
  openRun,
  reportUsage,
  resetTariffCache,
} from './credits-client';

const KEY = 'k'.repeat(48);

const WALLET = {
  uid: 'u-1',
  unit: 'CREDITS',
  balance: 7_320_000,
  available: 7_320_000,
  granted: 10_000_000,
  spent: 2_680_000,
  exhausted: false,
  models: [
    {
      provider: 'vertex',
      modelId: 'gemini-2.5-flash',
      tariffVersion: 1,
      inputPerMillion: 1_500_000,
      cachedInputPerMillion: 375_000,
      outputPerMillion: 12_500_000,
      minimumCharge: 18_500,
      affordable: true,
    },
  ],
  recentRuns: [
    {
      runId: 'r-1',
      startedAt: '2026-09-07T12:00:00Z',
      finishedAt: null,
      modelId: 'gemini-2.5-flash',
      status: 'COMPLETED',
      charge: 65_000,
    },
  ],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  resetTariffCache();
  fetcher.mockReset();
  vi.stubGlobal('fetch', fetcher);
  vi.stubEnv(CREDITS_SERVICE_KEY_ENV, KEY);
  vi.stubEnv('SPECSYNC_API_URL', 'http://api.test:8080');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('credits feature flag', () => {
  it('is on only for a key of at least 32 characters', () => {
    expect(creditsEnabled({})).toBe(false);
    expect(creditsEnabled({ [CREDITS_SERVICE_KEY_ENV]: 'too-short' })).toBe(
      false,
    );
    expect(creditsEnabled({ [CREDITS_SERVICE_KEY_ENV]: KEY })).toBe(true);
  });

  it('sends no request under the same key rule that disables the feature', async () => {
    vi.stubEnv(CREDITS_SERVICE_KEY_ENV, 'too-short');
    await expect(fetchWallet('u-1')).resolves.toEqual({
      status: 'UNAVAILABLE',
      message: 'The credits key is not set.',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('credits client', () => {
  it('calls the internal wallet endpoint with the service key', async () => {
    fetcher.mockResolvedValue(json(WALLET));
    await expect(fetchWallet('u 1')).resolves.toEqual({
      status: 'OK',
      value: WALLET,
    });
    const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      'http://api.test:8080/api/internal/ai-credits/wallets/u%201',
    );
    expect((init.headers as Record<string, string>)['authorization']).toBe(
      `Bearer ${KEY}`,
    );
    expect(init.redirect).toBe('error');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('posts the admission body and reports the hold', async () => {
    fetcher.mockResolvedValue(
      json({
        runId: 'r-1',
        hold: 65_000,
        balance: 7_320_000,
        available: 7_255_000,
        exhausted: false,
      }),
    );
    const result = await openRun('u-1', {
      runId: 'r-1',
      provider: 'vertex',
      modelId: 'gemini-2.5-flash',
      threadId: 't-1',
    });
    expect(result).toMatchObject({ status: 'OK', value: { hold: 65_000 } });
    const [, init] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      runId: 'r-1',
      provider: 'vertex',
      modelId: 'gemini-2.5-flash',
      threadId: 't-1',
    });
  });

  it('turns a 402 into a typed insufficient result', async () => {
    fetcher.mockResolvedValue(
      json(
        {
          type: 'about:blank',
          code: 'INSUFFICIENT_CREDITS',
          available: 120_000,
          minimumCharge: 185_000,
          cheaperModels: ['gemini-2.5-flash'],
        },
        402,
      ),
    );
    await expect(
      openRun('u-1', {
        runId: 'r-1',
        provider: 'vertex',
        modelId: 'gemini-2.5-pro',
      }),
    ).resolves.toEqual({
      status: 'INSUFFICIENT_CREDITS',
      available: 120_000,
      minimumCharge: 185_000,
      cheaperModels: ['gemini-2.5-flash'],
    });
  });

  it('treats a 402 that is not the wallet rejection as unavailable', async () => {
    // A proxy or a future problem type: never shown to the user as no credit.
    fetcher.mockResolvedValue(
      json({ type: 'about:blank', title: 'Payment Required' }, 402),
    );
    await expect(
      openRun('u-1', {
        runId: 'r-1',
        provider: 'vertex',
        modelId: 'gemini-2.5-pro',
      }),
    ).resolves.toEqual({
      status: 'UNAVAILABLE',
      message: 'The credits service answered 402.',
    });
  });

  it('reports every other failure as unavailable', async () => {
    fetcher.mockResolvedValue(json({ error: 'boom' }, 503));
    await expect(fetchWallet('u-1')).resolves.toMatchObject({
      status: 'UNAVAILABLE',
    });
    fetcher.mockRejectedValue(new Error('network down'));
    await expect(fetchWallet('u-1')).resolves.toMatchObject({
      status: 'UNAVAILABLE',
    });
    fetcher.mockResolvedValue(json({ unexpected: true }));
    await expect(fetchWallet('u-1')).resolves.toMatchObject({
      status: 'UNAVAILABLE',
    });
  });

  it('does not call the API without a key', async () => {
    vi.stubEnv(CREDITS_SERVICE_KEY_ENV, '');
    await expect(fetchWallet('u-1')).resolves.toMatchObject({
      status: 'UNAVAILABLE',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('charges a step and closes a run on their own paths', async () => {
    fetcher.mockResolvedValue(
      json({
        charge: 6_500,
        balance: 0,
        available: 0,
        exhausted: true,
      }),
    );
    await expect(
      reportUsage('u-1', 'r-1', {
        stepKey: 'step-1',
        provider: 'vertex',
        modelId: 'gemini-2.5-flash',
        inputTokens: 5_120,
        cachedInputTokens: 0,
        outputTokens: 640,
        reasoningTokens: 200,
        estimated: false,
      }),
    ).resolves.toMatchObject({ status: 'OK', value: { exhausted: true } });
    expect((fetcher.mock.calls[0]?.[0] as URL).pathname).toBe(
      '/api/internal/ai-credits/wallets/u-1/runs/r-1/usage',
    );

    fetcher.mockResolvedValue(json(WALLET));
    await expect(finishRun('u-1', 'r-1', 'EXHAUSTED')).resolves.toMatchObject({
      status: 'OK',
    });
    expect((fetcher.mock.calls[1]?.[0] as URL).pathname).toBe(
      '/api/internal/ai-credits/wallets/u-1/runs/r-1/finish',
    );
    expect(
      JSON.parse(String((fetcher.mock.calls[1]?.[1] as RequestInit).body)),
    ).toEqual({ status: 'EXHAUSTED' });
  });
});

describe('tariff cache', () => {
  const tariffs = { models: WALLET.models };

  it('reuses the list for a minute and then refreshes it', async () => {
    fetcher.mockResolvedValue(json(tariffs));
    await expect(activeTariffs(1_000)).resolves.toEqual(tariffs.models);
    await expect(activeTariffs(30_000)).resolves.toEqual(tariffs.models);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(activeTariffs(120_000)).resolves.toEqual(tariffs.models);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps the last good list when a refresh fails', async () => {
    fetcher.mockResolvedValueOnce(json(tariffs));
    await expect(activeTariffs(1_000)).resolves.toEqual(tariffs.models);
    fetcher.mockRejectedValue(new Error('down'));
    await expect(activeTariffs(120_000)).resolves.toEqual(tariffs.models);
  });

  it('reports nothing when it never read a list', async () => {
    fetcher.mockRejectedValue(new Error('down'));
    await expect(activeTariffs(1_000)).resolves.toBeUndefined();
  });
});
