import {
  HttpClient,
  HttpErrorResponse,
  httpResource,
} from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, throwError } from 'rxjs';

import { SESSION } from '../../auth/api/session';
import {
  CHAT_THREADS_URL,
  ChatThread,
  ChatThreadSummary,
  parseThread,
  parseThreadList,
  parseThreadSummary,
} from './thread';

/**
 * Data access for the conversation history. Mastra memory in the AI service
 * owns threads and messages, scoped to the user the gateway verified, so
 * every call is an HTTP request through the `/ai` proxy. Reads go through
 * `httpResource` and writes through `HttpClient`, which puts both under the
 * auth interceptor's credentials and cancellation.
 */
@Injectable({ providedIn: 'root' })
export class ThreadClient {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SESSION);

  /** Every thread of the signed-in user without its messages, newest first. */
  listResource() {
    return httpResource(
      () => (this.session.scope() ? { url: CHAT_THREADS_URL } : undefined),
      { parse: parseThreadList, defaultValue: [] as ChatThreadSummary[] },
    );
  }

  /** One thread with its messages; undefined when it is gone or not the user's. */
  find(id: string): Observable<ChatThread | undefined> {
    return this.http.get<unknown>(this.url(id)).pipe(
      map(parseThread),
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === 404
          ? of(undefined)
          : throwError(() => error),
      ),
    );
  }

  rename(id: string, title: string): Observable<ChatThreadSummary> {
    return this.http
      .patch<unknown>(this.url(id), { title })
      .pipe(map(parseThreadSummary));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(this.url(id));
  }

  clear(): Observable<void> {
    return this.http.delete<void>(CHAT_THREADS_URL);
  }

  private url(id: string): string {
    return `${CHAT_THREADS_URL}/${encodeURIComponent(id)}`;
  }
}
