import { beforeEach, describe, expect, it, vi } from 'vitest';

let verified: { uid: string; resourceId: string } | undefined;

vi.mock('../identity', () => ({
  verifiedUserOf: () => Promise.resolve(verified),
  requireVerifiedUser: (_c: unknown, next: () => Promise<void>) => next(),
}));

let enabled = true;
const fetchWallet = vi.fn();

vi.mock('./credits-client', () => ({
  creditsEnabled: () => enabled,
  fetchWallet: (...args: unknown[]) => fetchWallet(...args),
}));

const { CHAT_CREDITS_PATH, chatCreditsRoutes } = await import(
  './credits-route'
);

const WALLET = {
  uid: 'u-1',
  unit: 'CREDITS',
  balance: 7_320_000,
  available: 7_320_000,
  granted: 10_000_000,
  spent: 2_680_000,
  exhausted: false,
  models: [],
  recentRuns: [],
};

function handler() {
  const route = chatCreditsRoutes[0];
  if (!route || !('handler' in route)) {
    throw new Error('Expected the credits route to have a handler');
  }
  return route.handler as (c: unknown) => Promise<Response>;
}

function context() {
  return {
    req: { raw: { headers: new Headers() } },
    json: (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  };
}

beforeEach(() => {
  enabled = true;
  verified = { uid: 'u-1', resourceId: 'user:u-1' };
  fetchWallet.mockReset().mockResolvedValue({ status: 'OK', value: WALLET });
});

describe('chat credits route', () => {
  it('keeps the path and the verified-user guard the web app relies on', () => {
    expect(CHAT_CREDITS_PATH).toBe('/chat/credits');
    expect(
      chatCreditsRoutes.map((route) => [route.path, route.method]),
    ).toEqual([['/chat/credits', 'GET']]);
    // The route fails closed on an unverified run, like every /chat route.
    expect(
      (chatCreditsRoutes[0] as { middleware?: unknown }).middleware,
    ).toBeDefined();
  });

  it('serves the wallet of the verified user with the enabled flag', async () => {
    const response = await handler()(context());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      enabled: true,
      ...WALLET,
    });
    expect(fetchWallet).toHaveBeenCalledWith('u-1');
  });

  it('answers disabled without touching the wallet', async () => {
    enabled = false;
    const response = await handler()(context());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enabled: false });
    expect(fetchWallet).not.toHaveBeenCalled();
  });

  it('reports an unreachable wallet as 503, never as an empty one', async () => {
    fetchWallet.mockResolvedValue({ status: 'UNAVAILABLE', message: 'down' });
    const response = await handler()(context());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Credits service unavailable',
    });
  });

  it('refuses a run whose token did not verify', async () => {
    verified = undefined;
    const response = await handler()(context());
    expect(response.status).toBe(401);
    expect(fetchWallet).not.toHaveBeenCalled();
  });
});
