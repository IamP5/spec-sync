import { computed, inject } from '@angular/core';
import {
  rxMutation,
  withDevtools,
  withMutations,
} from '@angular-architects/ngrx-toolkit';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { withEventHandlers } from '@ngrx/signals/events';
import { from } from 'rxjs';

import { AuthClient } from '../data/auth-client';
import { SessionContext } from '../session/session-context';

export const AuthSessionStore = signalStore(
  { providedIn: 'root' },
  withProps(() => ({
    _client: inject(AuthClient),
    _context: inject(SessionContext),
  })),
  withComputed(({ _context }) => ({
    status: computed(() => _context.snapshot().status),
    authenticated: _context.authenticated,
  })),
  withMutations(({ _client }) => ({
    login: rxMutation({ operation: (_: void) => from(_client.login()) }),
    logout: rxMutation({ operation: (_: void) => from(_client.logout()) }),
  })),
  withEventHandlers(({ _client }) => ({ session: _client.transitions() })),
  withDevtools('authSession'),
);
