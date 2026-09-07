import { type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, takeUntil, tap, throwError } from 'rxjs';

import { WEB_CONFIG } from '../../shared/util-config';
import { isGatewayPath } from '../../shared/util-gateway';
import { AuthSession } from '../data/auth-session';
import { SessionContext } from '../session/session-context';

/** Credentials are restricted to our gateway; old sessions cannot finish requests. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isGatewayPath(request.url)) return next(request);
  const config = inject(WEB_CONFIG);
  const auth = inject(AuthSession);
  const session = inject(SessionContext);
  const verification = request.url === '/auth/session';
  const scope = session.scope();
  if (!verification && !scope)
    return throwError(() => new Error('Sign in to continue.'));
  const response = from(auth.idToken()).pipe(
    switchMap((token) => {
      if (!verification && (!scope || !session.isCurrent(scope)))
        throw new Error('Session changed.');
      return next(
        request.clone({
          url: `${config.gatewayUrl}${request.url}`,
          setHeaders: { Authorization: `Bearer ${token}` },
          credentials: 'omit',
          redirect: 'error',
        }),
      );
    }),
    tap({
      error: (error: unknown) => {
        if (
          !verification &&
          scope &&
          session.isCurrent(scope) &&
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          error.status === 401
        )
          session.invalidate('error');
      },
    }),
  );
  return verification
    ? response
    : response.pipe(takeUntil(session.invalidated$));
};
