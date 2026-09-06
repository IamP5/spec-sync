import { afterEach, describe, expect, it, vi } from 'vitest';

import { type GraphQuery } from './connection';
import { literalSearch, retrieveGraph, retrieveKnowledge } from './retrieval';

const configurationId = 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1';
afterEach(() => vi.unstubAllEnvs());
function snapshotQuery(handler: GraphQuery = async () => []) {
  return vi.fn<GraphQuery>(async (cypher, params) => {
    if (cypher.includes('CatalogProjection'))
      return [{ version: 'catalog-v1' }];
    if (cypher.includes('ReviewProjection'))
      return [{ version: 'reviews-v1', embeddingModel: 'test-model' }];
    if (cypher.includes('RETURN {modelId:')) return [{ modelId: 'ranger' }];
    return handler(cypher, params);
  });
}

describe('direct graph retrieval', () => {
  it('keeps user text in parameters and preserves the output contract', async () => {
    const q = "x' DELETE n //";
    const query = snapshotQuery(async (cypher, params) => {
      expect(cypher).not.toContain(q);
      expect(params?.['q']).toBe(q);
      return [{ code: 'torque_max' }];
    });
    expect(await retrieveKnowledge(query, 'concepts', { q })).toMatchObject({
      status: 'OK',
      projectionVersion: 'catalog-v1',
      items: [{ code: 'torque_max' }],
    });
  });
  it.each([
    ['capabilities', {}],
    ['capabilities', { attributeCode: 'bad-code' }],
    ['capabilities', { attributeCode: 'camera_360', market: 'xx' }],
    ['reviews', { limit: 31 }],
    ['reviews', { embedding: [NaN] }],
    ['related-reviews', { configurationId }],
    ['evidence', { q: 'not-a-uuid' }],
  ] as const)(
    'rejects invalid %s selections before any query',
    async (operation, input) => {
      const query = snapshotQuery();
      await expect(
        retrieveKnowledge(query, operation, input),
      ).rejects.toThrow();
      expect(query).not.toHaveBeenCalled();
    },
  );
  it('does not turn missing projections or unconfigured connections into absence', async () => {
    expect(
      await retrieveKnowledge(async () => [], 'concepts', {}),
    ).toMatchObject({ status: 'UNAVAILABLE' });
    vi.stubEnv('NEO4J_URI', '');
    expect(await retrieveGraph('concepts', {})).toMatchObject({
      status: 'UNAVAILABLE',
      items: [],
    });
  });
  it('rejects results when the catalog changes during retrieval', async () => {
    let reads = 0;
    const query = snapshotQuery();
    const changing: GraphQuery = async (cypher, params) =>
      cypher.includes('CatalogProjection')
        ? [{ version: ++reads === 1 ? 'catalog-v1' : 'catalog-v2' }]
        : query(cypher, params);
    expect(await retrieveKnowledge(changing, 'concepts', {})).toMatchObject({
      status: 'UNAVAILABLE',
    });
  });
  it('checks review freshness for exact review evidence too', async () => {
    let reads = 0;
    const query = snapshotQuery(async () => [{ excerpt: 'exact quote' }]);
    const changing: GraphQuery = async (cypher, params) => {
      if (cypher.includes('SpecSyncCatalog:Evidence')) return [];
      if (cypher.includes('ReviewProjection'))
        return [{ version: ++reads === 1 ? 'r1' : 'r2' }];
      return query(cypher, params);
    };
    expect(
      await retrieveKnowledge(changing, 'evidence', { q: configurationId }),
    ).toMatchObject({ status: 'UNAVAILABLE' });
  });
  it('passes configuration/model scope into expansion and retains exact excerpts', async () => {
    const query = snapshotQuery(async (_cypher, params) => {
      expect(params).toMatchObject({
        configurationId,
        modelId: 'ranger',
        attributeCode: 'rear_suspension',
      });
      return [
        { excerpt: 'firm ride unloaded.', scope: 'MODEL', kind: 'OPINION' },
      ];
    });
    expect(
      await retrieveKnowledge(query, 'related-reviews', {
        configurationId,
        attributeCode: 'rear_suspension',
      }),
    ).toMatchObject({
      projectionVersion: 'catalog-v1/reviews-v1',
      items: [{ excerpt: 'firm ride unloaded.', scope: 'MODEL' }],
    });
  });
  it('fuses lexical and vector ranks before limiting observations', async () => {
    vi.stubEnv('SPECSYNC_REVIEW_EMBEDDING_MODEL', 'test-model');
    const query = snapshotQuery(async (cypher, params) => {
      if (cypher.includes('fulltext.queryNodes'))
        return [{ id: 'a' }, { id: 'b' }];
      if (cypher.includes('vector.queryNodes')) {
        expect(params?.['embedding']).toEqual([0.2, 0.3]);
        return [{ id: 'b' }, { id: 'c' }];
      }
      return [
        { id: '1', evidenceId: 'a' },
        { id: '2', evidenceId: 'b' },
        { id: '3', evidenceId: 'c' },
      ];
    });
    expect(
      await retrieveKnowledge(query, 'reviews', {
        q: 'ride',
        embedding: [0.2, 0.3],
        limit: 1,
      }),
    ).toMatchObject({ items: [{ id: '2', evidenceId: 'b' }] });
  });
  it('refuses mismatched embeddings and propagates missing index errors', async () => {
    vi.stubEnv('SPECSYNC_REVIEW_EMBEDDING_MODEL', 'wrong-model');
    expect(
      await retrieveKnowledge(snapshotQuery(), 'reviews', {
        q: 'ride',
        embedding: [0.2],
      }),
    ).toMatchObject({ status: 'UNAVAILABLE' });
    const query = snapshotQuery(async () => {
      throw new Error('Missing index');
    });
    await expect(
      retrieveKnowledge(query, 'reviews', { q: 'ride' }),
    ).rejects.toThrow('Missing index');
  });
  it('escapes fulltext operators while keeping multilingual terms', () => {
    expect(literalSearch('suspensão OR *:* "ride"')).toBe(
      '"suspensão" OR "OR" OR "ride"',
    );
    expect(literalSearch('***')).toBe('');
  });
  it('returns unavailable for a cancelled request', async () => {
    expect(
      await retrieveGraph('concepts', {}, AbortSignal.abort()),
    ).toMatchObject({ status: 'UNAVAILABLE' });
  });
});
