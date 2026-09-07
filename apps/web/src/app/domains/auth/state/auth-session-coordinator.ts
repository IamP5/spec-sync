import { computed, inject, Injectable } from '@angular/core';

import { AuthSessionStore } from './auth-session-store';

/** Public workflow facade; SDK credentials and the store stay private. */
@Injectable({ providedIn: 'root' })
export class AuthSessionCoordinator {
  private readonly store = inject(AuthSessionStore);
  readonly status = this.store.status;
  readonly authenticated = this.store.authenticated;
  readonly pending = computed(
    () =>
      this.store.loginIsPending() ||
      ['restoring', 'verifying'].includes(this.status()),
  );
  readonly error = computed(
    () =>
      this.store.loginError() ||
      this.store.logoutError() ||
      this.status() === 'error',
  );
  readonly logoutPending = this.store.logoutIsPending;
  login() {
    this.store.login();
  }
  logout() {
    this.store.logout();
  }
}
