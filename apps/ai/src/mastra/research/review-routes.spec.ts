import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ user: vi.fn(), request: vi.fn() }));
vi.mock('../identity', () => ({
  verifiedUserOf: mocks.user,
  requireVerifiedUser: (_c: unknown, next: () => Promise<void>) => next(),
}));
vi.mock('./client', async (original) => ({
  ...(await original<typeof import('./client')>()),
  researchRequest: mocks.request,
}));
import { researchReviewRoutes } from './review-routes';

const id = 'b0bf3b8d-12fb-45ae-83d4-5b41b61c559a';
const review = {
  draftHash: 'hash',
  baseRevision: 5,
  reason: 'Reviewed evidence',
  configurations: [
    { configuration: 0, identityConfirmed: true, selectedClaims: [0] },
  ],
};
const context = (body: unknown = {}) => ({
  header: vi.fn(),
  req: {
    raw: {
      headers: new Headers({ 'x-specsync-user': 'forged' }),
      signal: new AbortController().signal,
    },
    param: () => id,
    text: async () => JSON.stringify(body),
  },
  json: (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status }),
  body: (body: ConstructorParameters<typeof Response>[0]) => new Response(body),
});
async function call(index: number, body?: unknown) {
  const route = researchReviewRoutes[index];
  if (!route || !('handler' in route)) throw new Error('Missing route');
  return (route.handler as (c: unknown) => Promise<Response>)(context(body));
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ uid: 'alice', resourceId: 'user:alice' });
  mocks.request.mockResolvedValue({ result: { id } });
});
it('uses verified identity and the private request for keyless review and publication', async () => {
  expect((await call(0)).status).toBe(200);
  expect(mocks.request.mock.calls[0]?.slice(0, 3)).toEqual([
    'GET',
    `/users/alice/requests/${id}/review`,
    undefined,
  ]);
  expect((await call(1, { review, uid: 'mallory' })).status).toBe(200);
  expect(mocks.request.mock.calls[1]?.slice(0, 3)).toEqual([
    'POST',
    `/users/alice/requests/${id}/review/publish`,
    { review },
  ]);
});
it('rejects anonymous access to every review surface before calling the API', async () => {
  mocks.user.mockResolvedValue(undefined);
  for (const index of [0, 1, 2])
    expect((await call(index, { review })).status).toBe(401);
  expect(mocks.request).not.toHaveBeenCalled();
});
it('rejects invalid human decisions and downloads the existing captured bytes', async () => {
  expect((await call(1, { review: { ...review, reason: '' } })).status).toBe(
    400,
  );
  expect(mocks.request).not.toHaveBeenCalled();
  mocks.request.mockResolvedValue({
    base64: Buffer.from('original source').toString('base64'),
    mimeType: 'application/pdf',
  });
  expect(await (await call(2)).text()).toBe('original source');
});
