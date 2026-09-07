import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';

import { SessionContext } from '../session/session-context';

/** Protected routes wait for restoration and gateway verification. Chat stays public. */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(SessionContext).changes$.pipe(
    filter(({ status }) => status !== 'restoring' && status !== 'verifying'),
    take(1),
    map(({ scope }) => (scope ? true : router.parseUrl('/'))),
  );
};
