import { noopObserve } from '@mastra/core/tools';
import { afterEach, expect, it, vi } from 'vitest';

import {
  catalogSearchInputSchema,
  searchCatalog,
} from '../catalog/catalog-search';
import { type GraphQuery } from '../graph/connection';
import {
  findConfigurationsByCapabilities,
  getEvidenceExcerpt,
  getRelatedReviews,
  resolveComparisonConcepts,
  searchReviewEvidence,
  searchVehicleConfigurations,
} from './vehicle-tools';

vi.mock('../graph/connection', () => ({
  withGraphRead: async (operation: (query: GraphQuery) => Promise<unknown>) =>
    operation(async (cypher) => {
      if (cypher.includes('CatalogProjection')) return [{ version: 'c1' }];
      if (cypher.includes('ReviewProjection')) return [{ version: 'r1' }];
      if (cypher.includes('RETURN {modelId:')) return [{ modelId: 'm1' }];
      return [];
    }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('routes all five graph tools directly without calling Spring', async () => {
  vi.stubEnv('SPECSYNC_REVIEW_EMBEDDING_MODEL', '');
  const fetch = vi.fn(() => {
    throw new Error('Unexpected HTTP catalog call');
  });
  vi.stubGlobal('fetch', fetch);
  const configurationId = 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1';
  const context = {
    observe: noopObserve,
    abortSignal: new AbortController().signal,
  };
  const results = await Promise.all([
    resolveComparisonConcepts.execute?.({ q: 'torque', limit: 10 }, context),
    findConfigurationsByCapabilities.execute?.(
      { attributeCode: 'camera_360', includeOptional: true, limit: 10 },
      context,
    ),
    searchReviewEvidence.execute?.({ q: '', limit: 10 }, context),
    getRelatedReviews.execute?.(
      { configurationId, attributeCode: 'rear_suspension', limit: 10 },
      context,
    ),
    getEvidenceExcerpt.execute?.({ evidenceId: configurationId }, context),
  ]);
  for (const result of results)
    expect(result).toMatchObject({ status: 'EMPTY' });
  expect(fetch).not.toHaveBeenCalled();
});
it('continues using the authoritative API for catalog operations', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ items: [], limit: 20, offset: 0, hasMore: false }),
      ),
    );
  vi.stubGlobal('fetch', fetch);
  await searchVehicleConfigurations.execute?.(
    { searches: [{ q: 'Ranger', limit: 20, offset: 0 }] },
    { observe: noopObserve },
  );
  expect(fetch).toHaveBeenCalledOnce();
  expect((fetch.mock.calls[0]?.[0] as URL).pathname).toBe(
    '/api/vehicle-configurations',
  );
});

it('returns both vehicles from one tool call with independent continuation scopes and no duplicated IDs', async () => {
  const ranger = {
    id: 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1',
    primaryImage: {
      url: `https://storage.googleapis.com/specsync-dev-vehicle-images/vehicles/primary/${'a'.repeat(64)}/ranger.jpg`,
      sha256: 'a'.repeat(64),
      width: 1280,
      height: 509,
      altText: 'Ford Ranger',
      matchScope: 'ILLUSTRATIVE',
      sourcePageUrl: 'https://www.ford.com.br/',
    },
    brand: 'Ford',
    model: 'Ranger',
    name: 'Limited',
    market: 'BR',
    modelYear: 2026,
    identityStatus: 'PROVISIONAL',
    identityNote: 'Check year',
    identityEvidenceId: null,
  };
  const shark = {
    ...ranger,
    id: 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a2',
    brand: 'BYD',
    model: 'Shark',
    name: 'GS',
    modelYear: 2025,
  };
  const fetch = vi.fn(
    async (url: URL) =>
      new Response(
        JSON.stringify({
          items:
            url.searchParams.get('q') === 'Shark' ? [shark, ranger] : [ranger],
          limit: 6,
          offset: Number(url.searchParams.get('offset')),
          hasMore: url.searchParams.get('q') === 'Ranger',
        }),
      ),
  );
  vi.stubGlobal('fetch', fetch);
  const rangerQuery = {
    q: 'Ranger',
    market: 'BR',
    modelYear: 2026,
    limit: 6,
    offset: 4,
  };
  const result = await searchVehicleConfigurations.execute?.(
    {
      searches: [
        { q: 'Shark', market: 'BR', modelYear: 2025, limit: 6, offset: 0 },
        rangerQuery,
        rangerQuery,
      ],
    },
    { observe: noopObserve },
  );
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(result).toMatchObject({
    status: 'OK',
    items: [shark, ranger],
    nextSearches: [{ ...rangerQuery, offset: 5 }],
    hasMore: true,
  });
});

it('lists a brand lineup in search order, the broad brand query last, in one result without duplicates', async () => {
  let sequence = 0;
  const configuration = (model: string, name: string) => ({
    id: `f94a2350-0a1a-5ad3-aef8-${String(++sequence).padStart(12, '0')}`,
    primaryImage: null,
    brand: 'Ford',
    model,
    name,
    market: 'BR',
    modelYear: 2026,
    identityStatus: 'VERIFIED',
    identityNote: null,
    identityEvidenceId: null,
  });
  const ranger = configuration('Ranger', 'Limited');
  const f150 = configuration('F-150', 'Lariat');
  const territory = configuration('Territory', 'Titanium');
  const maverick = configuration('Maverick', 'Lariat');
  const mustang = configuration('Mustang', 'Dark Horse');
  const bronco = configuration('Bronco Sport', 'Wildtrak');
  const byQuery: Record<string, unknown[]> = {
    'Ford Ranger': [ranger],
    'Ford F-150': [f150],
    'Ford Territory': [territory],
    'Ford Maverick': [maverick],
    'Ford Mustang': [mustang],
    Ford: [bronco, f150, maverick, mustang, ranger, territory],
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: URL) =>
        new Response(
          JSON.stringify({
            items: byQuery[url.searchParams.get('q') ?? ''] ?? [],
            limit: 20,
            offset: 0,
            hasMore: url.searchParams.get('q') === 'Ford',
          }),
        ),
    ),
  );
  const searches = [
    'Ford Ranger',
    'Ford F-150',
    'Ford Territory',
    'Ford Maverick',
    'Ford Mustang',
    'Ford',
  ].map((q) => ({ q, market: 'BR', limit: 20, offset: 0 }));
  expect(catalogSearchInputSchema.safeParse({ searches }).success).toBe(true);
  const result = await searchVehicleConfigurations.execute?.(
    { searches },
    { observe: noopObserve },
  );
  expect(result).toMatchObject({
    status: 'OK',
    items: [ranger, f150, territory, maverick, mustang, bronco],
    hasMore: true,
    // The browser pages the rest of the lineup itself; the agent never calls again.
    nextSearches: [{ q: 'Ford', market: 'BR', limit: 20, offset: 6 }],
    notices: [],
  });
});

it('preserves successful configurations while explicitly reporting failed and empty queries', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL) =>
      url.searchParams.get('q') === 'Ranger'
        ? new Response('', { status: 503 })
        : new Response(
            JSON.stringify({ items: [], limit: 20, offset: 0, hasMore: false }),
          ),
    ),
  );
  const result = await searchVehicleConfigurations.execute?.(
    {
      searches: [
        { q: 'Shark', limit: 20, offset: 0 },
        { q: 'Ranger', limit: 20, offset: 0 },
      ],
    },
    { observe: noopObserve },
  );
  expect(result).toMatchObject({
    status: 'PARTIAL',
    items: [],
    notices: [
      'No configurations found for Shark.',
      'Ranger: Catalog request failed (503).',
    ],
  });
});

it('keeps total failure distinct from an empty catalog', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('', { status: 503 })),
  );
  expect(
    await searchVehicleConfigurations.execute?.(
      { searches: [{ q: 'Ranger', limit: 20, offset: 0 }] },
      { observe: noopObserve },
    ),
  ).toMatchObject({ status: 'ERROR', retryable: true });
});

it('bounds complete search intent and rejects cancelled runs before retrieval', async () => {
  expect(catalogSearchInputSchema.safeParse({ q: 'Ranger' }).success).toBe(
    false,
  );
  expect(catalogSearchInputSchema.safeParse({ searches: [] }).success).toBe(
    false,
  );
  expect(
    catalogSearchInputSchema.safeParse({
      searches: Array.from({ length: 9 }, () => ({ q: 'Ranger' })),
    }).success,
  ).toBe(false);
  expect(
    catalogSearchInputSchema.safeParse({
      searches: [{ q: 'Ranger', limit: 21 }],
    }).success,
  ).toBe(false);
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  await expect(
    searchCatalog(
      { searches: [{ q: 'Ranger', limit: 20, offset: 0 }] },
      AbortSignal.abort(),
    ),
  ).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
