import { inject } from '@angular/core';
import {
  rxMutation,
  withDevtools,
  withMutations,
  withResource,
} from '@angular-architects/ngrx-toolkit';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { from } from 'rxjs';

import { AuthClient } from '../data/auth-client';

export const AuthSessionStore = signalStore(
  { providedIn: 'root' },
  withProps(() => ({ _client: inject(AuthClient) })),
  withComputed((store) => ({ ready: store._client.ready })),
  withResource((store) => ({ session: store._client.sessionResource() })),
  withMutations((store) => ({
    login: rxMutation({ operation: (_: void) => from(store._client.login()) }),
    logout: rxMutation({
      operation: (_: void) => from(store._client.logout()),
    }),
  })),
  withDevtools('authSession'),
);
