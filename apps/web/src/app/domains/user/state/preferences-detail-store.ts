import { computed, inject } from '@angular/core';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import {
  Events,
  on,
  withEventHandlers,
  withReducer,
} from '@ngrx/signals/events';
import { ignoreElements, tap } from 'rxjs';

import { sessionEvents } from '../../auth/api/events';
import { SESSION } from '../../auth/api/session';
import {
  DEFAULT_PREFERENCES,
  initialsOf,
  Preferences,
} from '../data/preferences';
import { UserPreferencesClient } from '../data/user-preferences-client';
import type { LocaleId } from '../util/locale';

/** Browser-local user preferences, shared through the public preference coordinator. */
export const PreferencesDetailStore = signalStore(
  { providedIn: 'root' },

  withState<Preferences & { error: string }>({
    ...DEFAULT_PREFERENCES,
    error: '',
  }),

  withProps(() => {
    const preferencesClient = inject(UserPreferencesClient);
    return {
      _preferencesClient: preferencesClient,
      _session: inject(SESSION),
      /**
       * The language this document runs in. It is a constant rather than
       * state: translations are loaded once before bootstrap, so a new
       * language only takes effect on reload. It also survives a session
       * change, because it is not scoped to a user.
       */
      language: preferencesClient.loadLanguage(),
    };
  }),

  withComputed((store) => ({
    initials: computed(() => initialsOf(store.displayName())),
    hasName: computed(() => store.displayName().trim().length > 0),
  })),

  withMethods((store) => ({
    load(): void {
      patchState(
        store,
        store._session.authenticated()
          ? store._preferencesClient.load()
          : { ...DEFAULT_PREFERENCES },
      );
    },

    update(changes: Partial<Preferences>): void {
      if (!store._session.authenticated()) return;
      patchState(store, changes);
      const saved = store._preferencesClient.save({
        theme: store.theme(),
        displayName: store.displayName(),
        showActivity: store.showActivity(),
        mode: store.mode(),
        roleModels: store.roleModels(),
        effort: store.effort(),
      });
      patchState(store, {
        error: saved
          ? ''
          : $localize`Your browser could not save this preference.`,
      });
    },

    /**
     * Persists the language choice. The document keeps running in the old
     * language until it is reloaded, which the coordinator does.
     */
    setLanguage(language: LocaleId): boolean {
      const saved = store._preferencesClient.saveLanguage(language);
      patchState(store, {
        error: saved
          ? ''
          : $localize`Your browser could not save this preference.`,
      });
      return saved;
    },
  })),

  withReducer(
    on(sessionEvents.invalidated, () => ({
      ...DEFAULT_PREFERENCES,
      error: '',
    })),
  ),
  withEventHandlers((store, events = inject(Events)) => ({
    session: events.on(sessionEvents.established).pipe(
      tap(() => store.load()),
      ignoreElements(),
    ),
  })),
  withHooks({
    onInit(store) {
      store.load();
    },
  }),

  withDevtools('preferencesDetail'),
);
