import { Injectable, resource, type Signal } from '@angular/core';

import {
  mergeReviewResults,
  type ReviewQuery,
  reviewResponseSchema,
} from './vehicle-reviews';

@Injectable({ providedIn: 'root' })
export class VehicleReviewsClient {
  relatedResource(query: Signal<ReviewQuery | undefined>) {
    return resource({
      params: query,
      loader: async ({ params, abortSignal }) => {
        const results = await Promise.all(
          params.configurationIds.map(async (configurationId) => {
            try {
              const search = new URLSearchParams({
                configurationId,
                attributeCode: params.attributeCode,
                limit: '30',
              });
              const response = await fetch(
                `/api/knowledge/related-reviews?${search}`,
                {
                  signal: AbortSignal.any([
                    abortSignal,
                    AbortSignal.timeout(15000),
                  ]),
                  headers: { Accept: 'application/json' },
                },
              );
              if (!response.ok) throw new Error('Review request failed');
              return {
                configurationId,
                response: reviewResponseSchema.parse(await response.json()),
              };
            } catch (error) {
              if (abortSignal.aborted) throw error;
              return { configurationId };
            }
          }),
        );
        return mergeReviewResults(results);
      },
    });
  }
}
