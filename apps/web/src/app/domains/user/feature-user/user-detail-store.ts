import { inject } from '@angular/core';
import { withDevtools, withResource } from '@angular-architects/ngrx-toolkit';
import { signalStore, withProps } from '@ngrx/signals';

import { UserClient } from '../data/user-client';

export const UserDetailStore = signalStore(
  { providedIn: 'root' },
  withProps(() => ({ _client: inject(UserClient) })),
  withResource((store) => ({ user: store._client.profileResource() })),
  withDevtools('userDetail'),
);
