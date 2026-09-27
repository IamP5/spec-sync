import {
  HttpClient,
  HttpErrorResponse,
  httpResource,
} from '@angular/common/http';
import { DestroyRef, inject, Injectable, type Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, throwError } from 'rxjs';

import { SESSION } from '../../auth/api/session';
import { ingestionAccessMessage } from './ingestion-access';
import {
  type IngestionRequest,
  type IngestionReview,
  parseIngestion,
  parseIngestionList,
} from './ingestion-contracts';

/**
 * Curator imports and chat research reviews. The auth interceptor attaches
 * the signed-in user's ID token; the gateway forwards it to the API, which
 * authorises by the token's roles. Resources wait for a verified session.
 */
@Injectable({ providedIn: 'root' })
export class IngestionClient {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SESSION);

  /** One run; undefined request while there is no id or no signed-in session. */
  detailResource(id: Signal<string>, researchId: () => string = () => '') {
    const resource = httpResource(
      () =>
        !this.session.scope()
          ? undefined
          : researchId()
            ? { url: this.reviewUrl(researchId()) }
            : id()
              ? { url: `/api/ingestions/${encodeURIComponent(id())}` }
              : undefined,
      { parse: parseIngestion },
    );
    this.session.invalidated$
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => resource.value.set(undefined));
    return resource;
  }

  /** The curator's runs, newest first. `version` changes force a reload. */
  listResource(version: Signal<number>) {
    return httpResource(
      () =>
        this.session.scope()
          ? {
              url: '/api/ingestions',
              headers: { 'X-Refresh': String(version()) },
            }
          : undefined,
      { parse: parseIngestionList },
    );
  }

  source(id: string, researchId = '') {
    return this.http.get(
      researchId
        ? `${this.reviewUrl(researchId)}/source`
        : `/api/ingestions/${encodeURIComponent(id)}/source`,
      { responseType: 'blob', observe: 'response' },
    );
  }

  create(id: string, request: IngestionRequest) {
    return this.write('', { id, request });
  }

  publish(id: string, review: IngestionReview, researchId = '') {
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
    return this.write(`/${encodeURIComponent(id)}/publish`, { review });
  }

  reject(id: string) {
    return this.write(`/${encodeURIComponent(id)}/reject`, {});
  }

  private reviewUrl(id: string): string {
    return `/ai/chat/research/${encodeURIComponent(id)}/review`;
  }

  private write(path: string, body: unknown) {
    return this.http.post<unknown>(`/api/ingestions${path}`, body).pipe(
      map(parseIngestion),
      catchError((error: unknown) => {
        const access = ingestionAccessMessage(error);
        if (access) return throwError(() => new Error(access));
        if (error instanceof HttpErrorResponse) {
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
