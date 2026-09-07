import { HttpClient } from '@angular/common/http';
import { inject, Injectable, resource, type Signal } from '@angular/core';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';

import {
  mergeReviewResults,
  type ReviewQuery,
  reviewResponseSchema,
} from './vehicle-reviews';

@Injectable({ providedIn: 'root' })
export class VehicleReviewsClient {
  private readonly http = inject(HttpClient);
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
              abortSignal.throwIfAborted();
              const response = await firstValueFrom(
                this.http
                  .get<unknown>(`/api/knowledge/related-reviews?${search}`, {
                    timeout: 15000,
                  })
                  .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
              );
              return {
                configurationId,
                response: reviewResponseSchema.parse(response),
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
