import { afterEach, describe, expect, it, vi } from 'vitest';

import { retrieveGraph } from '../graph/retrieval';
import {
  retrieveReviewEvidence,
  retrieveTypedKnowledge,
} from './knowledge-results';
import { retrieveReviews } from './review-search';

vi.mock('../graph/retrieval', () => ({ retrieveGraph: vi.fn() }));
vi.mock('./review-search', () => ({ retrieveReviews: vi.fn() }));
afterEach(() => vi.resetAllMocks());

const envelope = {
  status: 'OK' as const,
  message: 'Indexed source evidence.',
  projectionVersion: 'c1/r1',
};
const review = {
  id: '00000000-0000-4000-8000-000000000001',
  evidenceId: '00000000-0000-4000-8000-000000000002',
  title: 'Road test',
  excerpt: 'The ride felt firm when unloaded.',
  scope: 'MODEL',
  conditions: 'unloaded',
  kind: 'OPINION',
  url: 'https://example.com/review',
  configurationId: null,
  modelId: 'ranger',
};

describe('typed knowledge tool results', () => {
  it('retains review applicability, conditions and source facts under an explicit result kind', async () => {
    vi.mocked(retrieveReviews).mockResolvedValue({
      ...envelope,
      items: [review],
    });
    const result = await retrieveReviewEvidence({ q: 'ride comfort' });
    expect(result).toEqual({ ...envelope, kind: 'reviews', items: [review] });
  });

  it('rejects malformed review records instead of deriving an evidence card from a title or label', async () => {
    vi.mocked(retrieveReviews).mockResolvedValue({
      ...envelope,
      items: [
        {
          title: 'A link',
          label: 'Looks like evidence',
          excerpt: 'Unscoped statement',
        },
      ],
    });
    await expect(retrieveReviewEvidence({})).rejects.toThrow();
  });

  it('keeps unavailable indexes distinguishable from empty evidence and honours cancellation', async () => {
    vi.mocked(retrieveReviews).mockResolvedValue({
      status: 'UNAVAILABLE',
      message: 'Index unavailable',
      projectionVersion: null,
      items: [],
    });
    expect(await retrieveReviewEvidence({})).toMatchObject({
      kind: 'reviews',
      status: 'UNAVAILABLE',
      items: [],
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      retrieveReviewEvidence({}, controller.signal),
    ).rejects.toThrow();
  });

  it('uses explicit query record types for specification and review excerpts', async () => {
    const specification = {
      recordType: 'specification-excerpt',
      evidenceId: review.evidenceId,
      title: 'Brochure',
      excerpt: 'Evidence text',
      locator: 'page 2',
      path: 'brochure.pdf',
      provenance: 'CURATED_NOTES',
      upstreamUrls: ['https://example.com/specs'],
    };
    vi.mocked(retrieveGraph).mockResolvedValue({
      ...envelope,
      items: [specification],
    });
    expect(
      await retrieveTypedKnowledge('evidence', { q: review.evidenceId }),
    ).toEqual({ ...envelope, kind: 'excerpts', items: [specification] });
    vi.mocked(retrieveGraph).mockResolvedValue({
      ...envelope,
      items: [{ ...review, recordType: 'review-passage' }],
    });
    expect(
      await retrieveTypedKnowledge('evidence', { q: review.evidenceId }),
    ).toMatchObject({
      kind: 'excerpts',
      items: [{ scope: 'MODEL', recordType: 'review-passage' }],
    });
    vi.mocked(retrieveGraph).mockResolvedValue({
      ...envelope,
      items: [{ ...specification, recordType: 'inferred' }],
    });
    await expect(
      retrieveTypedKnowledge('evidence', { q: review.evidenceId }),
    ).rejects.toThrow();
  });
});
