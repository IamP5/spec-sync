import { type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';

import { AuthSession, WEB_CONFIG } from './domains/auth/data/auth-session';

/** Only our API paths receive credentials; arbitrary URLs remain untouched. */
export const gatewayInterceptor: HttpInterceptorFn = (request, next) => {
  if (!/^\/(api|ai|auth|user)(\/|$)/.test(request.url)) return next(request);
  const config = inject(WEB_CONFIG);
  const session = inject(AuthSession);
  return from(session.idToken()).pipe(
    switchMap((token) =>
      next(
        request.clone({
          url: `${config.gatewayUrl}${request.url}`,
          setHeaders: { Authorization: `Bearer ${token}` },
          credentials: 'omit',
          redirect: 'error',
        }),
      ),
    ),
  );
};
