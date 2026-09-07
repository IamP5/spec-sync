import {
  HttpClient,
  HttpErrorResponse,
  httpResource,
} from '@angular/common/http';
import { inject, Injectable, type Signal } from '@angular/core';
import { catchError, map, throwError } from 'rxjs';

import {
  type IngestionRequest,
  type IngestionReview,
  parseIngestion,
  parseIngestionList,
} from './ingestion-contracts';

const KEY_HEADER = 'X-Ingestion-Key';

@Injectable({ providedIn: 'root' })
export class IngestionClient {
  private readonly http = inject(HttpClient);

  /** One run; undefined request while there is no id or no key. */
  detailResource(id: Signal<string>, key: Signal<string>) {
    return httpResource(
      () =>
        id() && key()
          ? {
              url: `/api/ingestions/${encodeURIComponent(id())}`,
              headers: { [KEY_HEADER]: key() },
            }
          : undefined,
      { parse: parseIngestion },
    );
  }

  /** The curator's runs, newest first. `version` changes force a reload. */
  listResource(key: Signal<string>, version: Signal<number>) {
    return httpResource(
      () =>
        key()
          ? {
              url: '/api/ingestions',
              headers: { [KEY_HEADER]: key(), 'X-Refresh': String(version()) },
            }
          : undefined,
      { parse: parseIngestionList },
    );
  }

  source(id: string, key: string) {
    return this.http.get(`/api/ingestions/${encodeURIComponent(id)}/source`, {
      headers: { [KEY_HEADER]: key },
      responseType: 'blob',
      observe: 'response',
    });
  }

  create(id: string, request: IngestionRequest, key: string) {
    return this.write('', { id, request }, key);
  }

  publish(id: string, review: IngestionReview, key: string) {
    return this.write(`/${encodeURIComponent(id)}/publish`, { review }, key);
  }

  reject(id: string, key: string) {
    return this.write(`/${encodeURIComponent(id)}/reject`, {}, key);
  }

  private write(path: string, body: unknown, key: string) {
    return this.http
      .post<unknown>(`/api/ingestions${path}`, body, {
        headers: { [KEY_HEADER]: key },
      })
      .pipe(
        map(parseIngestion),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse) {
            if (error.status === 401 || error.status === 403)
              return throwError(
                () =>
                  new Error(
                    'Enter a valid curator key. Ingestion must be enabled on the server.',
                  ),
              );
            const detail: unknown = error.error?.detail;
            if (typeof detail === 'string')
              return throwError(() => new Error(detail));
          }
          return throwError(
            () =>
              new Error(
                'The request failed. Refresh the import before retrying.',
              ),
          );
        }),
      );
  }
}
