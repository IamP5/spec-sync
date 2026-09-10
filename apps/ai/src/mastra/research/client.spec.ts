import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { workloadHeaders } = vi.hoisted(() => ({ workloadHeaders: vi.fn() }));
vi.mock('../catalog/cloud-run-auth', () => ({
  cloudRunHeaders: workloadHeaders,
}));
import { listResearch, readResearch, researchRequest } from './client';

const fetchMock = vi.fn();
beforeEach(() => {
  workloadHeaders
    .mockReset()
    .mockResolvedValue({ 'x-serverless-authorization': 'Bearer workload' });
  vi.stubEnv('SPECSYNC_RESEARCH_SERVICE_KEY', 'r'.repeat(32));
  vi.stubEnv('SPECSYNC_API_URL', 'https://api.example');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset().mockResolvedValue(new Response('{"ok":true}'));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('sends independent service and workload credentials only to the configured API', async () => {
  await researchRequest(
    'POST',
    '/users/user-a/requests',
    { id: 'test' },
    z.object({ ok: z.boolean() }),
  );
  expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
    'https://api.example/api/internal/research/users/user-a/requests',
  );
  expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
    redirect: 'error',
    headers: {
      authorization: `Bearer ${'r'.repeat(32)}`,
      'x-serverless-authorization': 'Bearer workload',
    },
  });
});
it('fails closed when the key is missing, too short, or the caller aborted', async () => {
  vi.stubEnv('SPECSYNC_RESEARCH_SERVICE_KEY', 'short');
  await expect(
    researchRequest('GET', '/users/a/requests', undefined, z.unknown()),
  ).rejects.toThrow('unavailable');
  vi.stubEnv('SPECSYNC_RESEARCH_SERVICE_KEY', 'r'.repeat(32));
  await expect(
    researchRequest(
      'GET',
      '/users/a/requests',
      undefined,
      z.unknown(),
      AbortSignal.abort(),
    ),
  ).rejects.toThrow('unavailable');
  expect(fetchMock).not.toHaveBeenCalled();
});
it('never discloses an API error body or forwards malformed results', async () => {
  fetchMock.mockResolvedValueOnce(
    new Response('private reviewer details', { status: 404 }),
  );
  await expect(
    researchRequest('GET', '/users/a/requests/x', undefined, z.unknown()),
  ).rejects.toThrow('Research request not found');
  fetchMock.mockResolvedValueOnce(new Response('{"unexpected":true}'));
  await expect(
    researchRequest(
      'GET',
      '/users/a/requests',
      undefined,
      z.object({ ok: z.boolean() }),
    ),
  ).rejects.toThrow('unavailable');
});

it('returns metadata-only history even while an API version still sends full snapshots', async () => {
  const metadata = {
    id: 'b0bf3b8d-12fb-45ae-83d4-5b41b61c559a',
    workId: 'b98e8caa-d7e5-4440-8a9c-f5c267ab3fb1',
    requestStatus: 'ACTIVE',
    disposition: 'JOINED',
    status: 'REVIEW',
    attempts: 1,
    stage: 'review',
    request: {
      sourceUrl: 'https://ford.com.br/specs',
      brand: 'Ford',
      model: 'Ranger',
      market: 'BR',
      modelYear: 2025,
      configurations: [],
    },
    createdAt: '2026-09-08T12:00:00Z',
    updatedAt: '2026-09-08T12:01:00Z',
  };
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        requests: [
          {
            ...metadata,
            configurations: [{ claims: [{ excerpt: 'private-evidence' }] }],
            warnings: ['warning'],
            error: 'private-error',
            source: { text: 'private-source' },
            configurationIds: {},
          },
        ],
      }),
    ),
  );
  await expect(listResearch('verified-user')).resolves.toEqual({
    requests: [metadata],
  });
});

it('aborts a stalled workload identity lookup before it can stall a lease callback', async () => {
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  workloadHeaders.mockImplementation(() => {
    started();
    return new Promise(() => undefined);
  });
  const controller = new AbortController();
  const pending = researchRequest(
    'POST',
    '/works/a/attempts/b/heartbeat',
    undefined,
    z.object({ ok: z.boolean() }),
    controller.signal,
  );
  const rejected = expect(pending).rejects.toThrow(
    'Research service unavailable',
  );
  await ready;
  controller.abort();
  await rejected;
  expect(fetchMock).not.toHaveBeenCalled();
});

it('keeps pre-ontology research readable when its normalization pin is null', async () => {
  const id = 'b0bf3b8d-12fb-45ae-83d4-5b41b61c559a';
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        id,
        workId: 'b98e8caa-d7e5-4440-8a9c-f5c267ab3fb1',
        requestStatus: 'ACTIVE',
        disposition: 'JOINED',
        status: 'REVIEW',
        attempts: 1,
        stage: 'review',
        ontologyRevision: 0,
        normalizationRevision: null,
        replayedFromWorkId: null,
        request: {
          sourceUrl: 'https://ford.com.br/specs',
          brand: 'Ford',
          model: 'F-150',
          market: 'BR',
          modelYear: 2026,
          configurations: [],
        },
        configurations: [],
        warnings: [],
        error: null,
        source: null,
        configurationIds: {},
        createdAt: '2026-09-08T12:00:00Z',
        updatedAt: '2026-09-08T12:01:00Z',
      }),
    ),
  );
  const result = await readResearch('verified-user', id);
  expect(result.normalizationRevision).toBeNull();
  expect(result.id).toBe(id);
});
