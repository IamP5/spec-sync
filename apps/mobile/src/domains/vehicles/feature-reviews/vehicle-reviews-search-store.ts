import { queryOptions, useQuery } from '@tanstack/react-query';

import type { ReviewQuery } from '../data/vehicle-reviews';
import { loadRelatedReviews } from '../data/vehicle-reviews-client';

export const relatedReviewsQuery = (query: ReviewQuery) =>
  queryOptions({
    queryKey: [
      'vehicles',
      'reviews',
      query.attributeCode,
      query.configurationIds,
    ],
    queryFn: ({ signal }) => loadRelatedReviews(query, signal),
    // Failed configurations are part of the answer; retrying the whole
    // batch silently would hide them.
    retry: false,
  });

/**
 * Sheet-scoped review search (web `VehicleReviewsSearchStore`); requests
 * are cancelled when the sheet unmounts.
 */
export function useVehicleReviewsSearchStore(query: ReviewQuery) {
  const reviews = useQuery(relatedReviewsQuery(query));
  return {
    batch: reviews.data,
    // A retry reloads every vehicle, as the first request did.
    loading: reviews.isFetching,
    failed: reviews.isError,
    retry(): void {
      void reviews.refetch();
    },
  };
}
