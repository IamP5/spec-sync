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
  readonly signInError = computed(() => {
    const error: unknown = this.store.loginError();
    if (error) {
      const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string' &&
        /^auth\/[a-z-]{1,60}$/.test(error.code)
          ? error.code
          : undefined;
      if (code === 'auth/popup-blocked')
        return $localize`Google sign-in was blocked by this browser. Open SpecSync directly in Safari or Chrome and try again.`;
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      )
        return $localize`The Google sign-in window closed before sign-in finished. Please try again.`;
      if (code === 'auth/unauthorized-domain')
        return $localize`This address is not authorized for Google sign-in. Please contact the app administrator. (auth/unauthorized-domain)`;
      return code
        ? $localize`Google sign-in failed (${code}:code:). Please try again or share this code with support.`
        : $localize`Google sign-in could not finish. Please try again.`;
    }
    return this.status() === 'error'
      ? $localize`SpecSync could not verify your session with its server. Refresh the page and try again.`
      : undefined;
  });
  login() {
    this.store.login();
  }
  logout() {
    this.store.logout();
  }
}
