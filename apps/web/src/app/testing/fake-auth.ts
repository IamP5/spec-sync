import { resource, signal } from '@angular/core';

import { AuthClient } from '../domains/auth/data/auth-client';

export function provideFakeAuth(authenticated = true) {
  return {
    provide: AuthClient,
    useValue: {
      ready: signal(true),
      sessionResource: () =>
        resource({
          defaultValue: authenticated ? { uid: 'alice' } : undefined,
          loader: async () => (authenticated ? { uid: 'alice' } : undefined),
        }),
      login: async () => undefined,
      logout: async () => undefined,
    },
  };
}
