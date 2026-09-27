import { gatewayJson } from '../../auth/api/session';
import {
  mergeReviewResults,
  type ReviewBatch,
  type ReviewQuery,
  reviewResponseSchema,
} from './vehicle-reviews';

/** Per-configuration lookups give up after this long; the others still count. */
const REVIEW_TIMEOUT_MS = 15000;

/**
 * Related reviews of one attribute for every configuration of a comparison.
 * A configuration whose lookup fails is reported as failed, not as empty
 * (web `VehicleReviewsClient.relatedResource`).
 */
export async function loadRelatedReviews(
  query: ReviewQuery,
  signal?: AbortSignal,
): Promise<ReviewBatch> {
  const results = await Promise.all(
    query.configurationIds.map(async (configurationId) => {
      const search = new URLSearchParams({
        configurationId,
        attributeCode: query.attributeCode,
        limit: '30',
      });
      const timeout = new AbortController();
      const abort = () => timeout.abort();
      signal?.addEventListener('abort', abort);
      const timer = setTimeout(abort, REVIEW_TIMEOUT_MS);
      try {
        signal?.throwIfAborted();
        const response = await gatewayJson(
          `/api/knowledge/related-reviews?${search}`,
          (value) => reviewResponseSchema.parse(value),
          { signal: timeout.signal },
        );
        return { configurationId, response };
      } catch (error) {
        if (signal?.aborted) throw error;
        return { configurationId };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
    }),
  );
  return mergeReviewResults(results);
}
