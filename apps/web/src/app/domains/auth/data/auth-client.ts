import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  catchError,
  EMPTY,
  map,
  merge,
  Subject,
  switchMap,
  tap,
  withLatestFrom,
} from 'rxjs';
import { z } from 'zod';

import { SessionContext } from '../session/session-context';
import { AuthSession } from './auth-session';

@Injectable({ providedIn: 'root' })
export class AuthClient {
  private readonly auth = inject(AuthSession);
  private readonly context = inject(SessionContext);
  private readonly http = inject(HttpClient);
  private readonly retry = new Subject<void>();
  /** switchMap discards verification responses from an earlier SDK identity. */
  transitions() {
    return merge(
      this.auth.user$,
      this.retry.pipe(
        withLatestFrom(this.auth.user$),
        map(([, user]) => user),
      ),
    ).pipe(
      switchMap((user) => {
        const generation = this.context.begin(user?.uid ?? null);
        if (!user) return EMPTY;
        return this.http.get<unknown>('/auth/session').pipe(
          map((value) => z.object({ uid: z.string().min(1) }).parse(value)),
          tap((session) => {
            if (session.uid !== user.uid)
              throw new Error('Session identity mismatch.');
            this.context.establish(session.uid, generation);
          }),
          catchError(() => {
            this.context.reject(generation);
            return EMPTY;
          }),
        );
      }),
    );
  }
  login() {
    return this.auth.login();
  }
  async logout() {
    this.context.invalidate();
    try {
      await this.auth.logout();
    } catch (error) {
      this.retry.next();
      throw error;
    }
  }
  verifyAgain() {
    this.retry.next();
  }
}
