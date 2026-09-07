import { computed, inject } from '@angular/core';
import { withDevtools, withResource } from '@angular-architects/ngrx-toolkit';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import {
  Events,
  on,
  withEventHandlers,
  withReducer,
} from '@ngrx/signals/events';
import { ignoreElements, tap } from 'rxjs';

import { sessionEvents } from '../../auth/api/events';
import { PhotoClient } from '../data/photo-client';
import { UserProfileClient } from '../data/user-profile-client';

export const UserDetailStore = signalStore(
  { providedIn: 'root' },
  withProps(() => ({
    _client: inject(UserProfileClient),
    _photos: inject(PhotoClient),
  })),
  withResource((store) => ({ user: store._client.profileResource() })),
  withResource((store) => ({
    /** Decodes the profile photo before the account card shows the profile. */
    photo: store._photos.preloadResource(() => store.userValue()?.photoUrl),
  })),
  withComputed((store) => ({
    /**
     * True once the profile and, when it has one, its photo can be shown
     * together. The preload is matched by URL, so the transient states of the
     * photo resource between a profile change and its load never count.
     */
    ready: computed(() => {
      const user = store.userValue();
      if (!user) return false;
      if (!user.photoUrl) return true;
      return (
        store.photoValue()?.url === user.photoUrl ||
        store.photoStatus() === 'error'
      );
    }),
    /** True when the decoded photo, not the initials, should be rendered. */
    photoShown: computed(() => {
      const url = store.userValue()?.photoUrl;
      const photo = store.photoValue();
      return !!url && photo?.url === url && photo.shown;
    }),
  })),
  withReducer(on(sessionEvents.invalidated, () => ({ userValue: undefined }))),
  withEventHandlers((store, events = inject(Events)) => ({
    refresh: events.on(sessionEvents.refreshed).pipe(
      tap(() => store._userReload()),
      ignoreElements(),
    ),
  })),
  withDevtools('userDetail'),
);
