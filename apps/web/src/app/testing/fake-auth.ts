import { TestBed } from '@angular/core/testing';
import { EMPTY } from 'rxjs';

import { AuthClient } from '../domains/auth/data/auth-client';
import { SessionContext } from '../domains/auth/session/session-context';

/** Deterministic verified identity, with the same real lifecycle events as production. */
export function provideFakeAuth(authenticated = true) {
  return [
    {
      provide: SessionContext,
      useFactory: () => {
        const session = new SessionContext();
        const generation = session.begin(authenticated ? 'alice' : null);
        if (authenticated) session.establish('alice', generation);
        return session;
      },
    },
    {
      provide: AuthClient,
      useValue: {
        transitions: () => EMPTY,
        login: async () => undefined,
        logout: async () => undefined,
      },
    },
  ];
}

export const testSession = () => TestBed.inject(SessionContext);
