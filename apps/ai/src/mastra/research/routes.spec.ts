import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verified: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  read: vi.fn(),
  cancel: vi.fn(),
  replay: vi.fn(),
  run: vi.fn(),
  people: vi.fn(),
  saveInterest: vi.fn(),
}));
vi.mock('../identity', () => ({
  verifiedUserOf: mocks.verified,
  requireVerifiedUser: (_c: unknown, next: () => Promise<void>) => next(),
}));
vi.mock('./client', async (original) => ({
  ...(await original<typeof import('./client')>()),
  createResearch: mocks.create,
  listResearch: mocks.list,
  readResearch: mocks.read,
  cancelResearch: mocks.cancel,
  replayResearch: mocks.replay,
  listResearchInterests: mocks.people,
  saveResearchInterest: mocks.saveInterest,
}));
vi.mock('./workflow', () => ({ runSharedResearch: mocks.run }));
import { ResearchServiceError } from './client';
import { researchRoutes } from './routes';

const id = 'b0bf3b8d-12fb-45ae-83d4-5b41b61c559a';
const body = {
  id,
  request: {
    sourceUrl: 'https://ford.com.br/ranger.pdf',
    brand: 'Ford',
    model: 'Ranger',
    market: 'BR',
    modelYear: 2025,
    configurations: [],
  },
};
function handler(index: number) {
  const route = researchRoutes[index];
  if (!route || !('handler' in route)) throw new Error('Missing route');
  return route.handler as (c: unknown) => Promise<Response>;
}
function context(payload: unknown = body, resourceId = id) {
  return {
    header: vi.fn(),
    req: {
      raw: {
        headers: new Headers({ 'x-specsync-user': 'attacker' }),
        signal: new AbortController().signal,
      },
      text: () => Promise.resolve(JSON.stringify(payload)),
      param: () => resourceId,
      header: () => undefined,
    },
    json: (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), { status }),
  };
}
beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.verified.mockResolvedValue({
    uid: 'verified-user',
    resourceId: 'user:verified-user',
  });
  mocks.create.mockResolvedValue({ id });
  mocks.list.mockResolvedValue({ requests: [] });
  mocks.read.mockResolvedValue({ id });
  mocks.cancel.mockResolvedValue({ id, requestStatus: 'CANCELLED' });
});
afterEach(() => vi.unstubAllEnvs());

it('guards research browser routes and keeps the internal endpoint separate', () => {
  expect(researchRoutes.map((route) => [route.path, route.method])).toEqual([
    ['/chat/research', 'GET'],
    ['/chat/research', 'POST'],
    ['/chat/research/:id', 'GET'],
    ['/chat/research/:id', 'DELETE'],
    ['/chat/research/:id/replay', 'POST'],
    ['/internal/research/extract', 'POST'],
    ['/chat/research/:id/interests', 'GET'],
    ['/chat/research/:id/interests', 'POST'],
  ]);
  expect(
    researchRoutes.slice(0, 5).every((route) => 'middleware' in route),
  ).toBe(true);
});
it('forwards only the verified uid for create, list, read and cancellation', async () => {
  await handler(0)(context());
  await handler(1)(context({ ...body, uid: 'attacker' }));
  await handler(2)(context());
  await handler(3)(context());
  expect(mocks.list.mock.calls[0]?.[0]).toBe('verified-user');
  expect(mocks.create.mock.calls[0]?.slice(0, 2)).toEqual([
    'verified-user',
    body,
  ]);
  expect(mocks.read.mock.calls[0]?.slice(0, 2)).toEqual(['verified-user', id]);
  expect(mocks.cancel.mock.calls[0]?.slice(0, 2)).toEqual([
    'verified-user',
    id,
  ]);
});
it('rejects unverified users before contacting the API', async () => {
  mocks.verified.mockResolvedValue(undefined);
  for (let index = 0; index < 5; index++)
    expect((await handler(index)(context())).status).toBe(401);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.read).not.toHaveBeenCalled();
});
it('replays only for the verified owner and refuses malformed replay ids', async () => {
  const newId = 'b98e8caa-d7e5-4440-8a9c-f5c267ab3fb1';
  mocks.replay.mockResolvedValue({ id: newId });
  expect(
    (await handler(4)(context({ id: newId, uid: 'attacker' }))).status,
  ).toBe(200);
  expect(mocks.replay.mock.calls[0]?.slice(0, 3)).toEqual([
    'verified-user',
    id,
    newId,
  ]);
  expect((await handler(4)(context({ id: 'invalid' }))).status).toBe(400);
  expect(mocks.replay).toHaveBeenCalledOnce();
});
it('requires an explicit year and honors configured manufacturer domains', async () => {
  expect(
    (
      await handler(1)(
        context({
          ...body,
          request: { ...body.request, modelYear: undefined },
        }),
      )
    ).status,
  ).toBe(400);
  vi.stubEnv('SPECSYNC_INGESTION_SOURCE_DOMAINS', 'honda.com.br');
  expect((await handler(1)(context())).status).toBe(400);
  expect(
    (
      await handler(1)(
        context({
          ...body,
          request: {
            ...body.request,
            sourceUrl: 'https://www.honda.com.br/manual.pdf',
          },
        }),
      )
    ).status,
  ).toBe(200);
});
it('sanitizes private API errors and refuses malformed ids', async () => {
  mocks.read.mockRejectedValue(new ResearchServiceError(422));
  expect((await handler(2)(context())).status).toBe(404);
  expect((await handler(2)(context(body, 'not-a-uuid'))).status).toBe(400);
  mocks.create.mockRejectedValue(
    new Error('database password leaked by upstream'),
  );
  const result = await handler(1)(context());
  expect(result.status).toBe(503);
  await expect(result.json()).resolves.toEqual({
    error: 'Research service unavailable',
  });
});
it('keeps the research worker closed without its separate service key', async () => {
  expect((await handler(5)(context())).status).toBe(401);
  expect(mocks.run).not.toHaveBeenCalled();
});

it('keeps invalid create requests distinct from service outages without leaking backend text', async () => {
  mocks.create.mockRejectedValue(new ResearchServiceError(422));
  const response = await handler(1)(context());
  expect(response.status).toBe(422);
  await expect(response.json()).resolves.toEqual({
    error: 'Research request is invalid or unavailable for this configuration',
  });
});

it('marks user snapshots and authentication errors as non-cacheable', async () => {
  for (const route of researchRoutes.slice(0, 5)) {
    const c = context();
    const guarded = route as unknown as {
      middleware: (
        value: unknown,
        next: () => Promise<void>,
      ) => Promise<unknown>;
    };
    await guarded.middleware(c, async () => undefined);
    expect(c.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
  }
});

it('keeps consented contacts outside model calls and uses only the verified owner', async () => {
  mocks.people.mockResolvedValue({ people: [], mine: null, hasMore: false });
  mocks.saveInterest.mockResolvedValue({
    people: [],
    mine: null,
    hasMore: false,
  });
  expect((await handler(6)(context())).status).toBe(200);
  expect(mocks.people.mock.calls[0]?.slice(0, 2)).toEqual([
    'verified-user',
    id,
  ]);
  expect(
    (await handler(7)(context({ visible: false, uid: 'attacker' }))).status,
  ).toBe(200);
  expect(mocks.saveInterest.mock.calls[0]?.slice(0, 3)).toEqual([
    'verified-user',
    id,
    { visible: false },
  ]);
  for (const payload of [
    {},
    { visible: true, name: 'Alice', contactUrl: 'javascript:alert(1)' },
    { visible: true, name: 'Alice', contactUrl: '' },
  ]) {
    expect((await handler(7)(context(payload))).status).toBe(400);
  }
  mocks.verified.mockResolvedValue(undefined);
  expect((await handler(6)(context())).status).toBe(401);
  expect((await handler(7)(context({ visible: false }))).status).toBe(401);
  expect(mocks.run).not.toHaveBeenCalled();
});
