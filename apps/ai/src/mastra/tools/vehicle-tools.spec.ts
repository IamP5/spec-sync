import { noopObserve } from '@mastra/core/tools';
import { afterEach, expect, it, vi } from 'vitest';

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
    { q: 'Ranger', limit: 20, offset: 0 },
    { observe: noopObserve },
  );
  expect(fetch).toHaveBeenCalledOnce();
  expect((fetch.mock.calls[0]?.[0] as URL).pathname).toBe(
    '/api/vehicle-configurations',
  );
});
