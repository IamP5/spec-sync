import { inject } from '@angular/core';
import { withDevtools, withResource } from '@angular-architects/ngrx-toolkit';
import { signalStore, withProps } from '@ngrx/signals';
import {
  Events,
  on,
  withEventHandlers,
  withReducer,
} from '@ngrx/signals/events';
import { ignoreElements, tap } from 'rxjs';

import { sessionEvents } from '../../auth/api/events';
import { UserProfileClient } from '../data/user-profile-client';

export const UserDetailStore = signalStore(
  { providedIn: 'root' },
  withProps(() => ({ _client: inject(UserProfileClient) })),
  withResource((store) => ({ user: store._client.profileResource() })),
  withReducer(on(sessionEvents.invalidated, () => ({ userValue: undefined }))),
  withEventHandlers((store, events = inject(Events)) => ({
    refresh: events.on(sessionEvents.refreshed).pipe(
      tap(() => store._userReload()),
      ignoreElements(),
    ),
  })),
  withDevtools('userDetail'),
);
