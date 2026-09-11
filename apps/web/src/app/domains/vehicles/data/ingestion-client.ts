import {
  HttpClient,
  HttpErrorResponse,
  httpResource,
} from '@angular/common/http';
import { DestroyRef, inject, Injectable, type Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, throwError } from 'rxjs';

import { SESSION } from '../../auth/api/session';
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
  private readonly session = inject(SESSION);

  /** One run; undefined request while there is no id or no key. */
  detailResource(
    id: Signal<string>,
    key: Signal<string>,
    researchId: () => string = () => '',
  ) {
    const resource = httpResource(
      () =>
        researchId()
          ? this.session.scope()
            ? { url: this.reviewUrl(researchId()) }
            : undefined
          : id() && key()
            ? {
                url: `/api/ingestions/${encodeURIComponent(id())}`,
                headers: { [KEY_HEADER]: key() },
              }
            : undefined,
      { parse: parseIngestion },
    );
    this.session.invalidated$
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => resource.value.set(undefined));
    return resource;
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

  source(id: string, key: string, researchId = '') {
    return this.http.get(
      researchId
        ? `${this.reviewUrl(researchId)}/source`
        : `/api/ingestions/${encodeURIComponent(id)}/source`,
      {
        headers: researchId ? {} : { [KEY_HEADER]: key },
        responseType: 'blob',
        observe: 'response',
      },
    );
  }

  create(id: string, request: IngestionRequest, key: string) {
    return this.write('', { id, request }, key);
  }

  publish(id: string, review: IngestionReview, key: string, researchId = '') {
    if (researchId)
      return this.http
        .post<unknown>(`${this.reviewUrl(researchId)}/publish`, { review })
        .pipe(
          map(parseIngestion),
          catchError((error: unknown) =>
            throwError(
              () =>
                new Error(
                  error instanceof HttpErrorResponse &&
                  typeof error.error?.error === 'string'
                    ? error.error.error
                    : $localize`Could not publish. Refresh the review and try again.`,
                ),
            ),
          ),
        );
    return this.write(`/${encodeURIComponent(id)}/publish`, { review }, key);
  }

  reject(id: string, key: string) {
    return this.write(`/${encodeURIComponent(id)}/reject`, {}, key);
  }

  private reviewUrl(id: string): string {
    return `/ai/chat/research/${encodeURIComponent(id)}/review`;
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
