import { inject, Injectable, InjectionToken } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  browserPopupRedirectResolver,
  browserSessionPersistence,
  GoogleAuthProvider,
  initializeAuth,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { user } from 'rxfire/auth';
import { shareReplay } from 'rxjs';

import { WEB_CONFIG } from '../../shared/util-config';

/** SDK objects and credentials remain private to the authentication transport. */
export const AUTH_PROVIDER = new InjectionToken('authProvider', {
  factory: () => {
    const auth = initializeAuth(initializeApp(inject(WEB_CONFIG).firebase), {
      persistence: browserSessionPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
    return {
      auth,
      user$: user(auth),
      login: () => signInWithPopup(auth, new GoogleAuthProvider()),
      logout: () => signOut(auth),
    };
  },
});

@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly provider = inject(AUTH_PROVIDER);
  readonly user$ = this.provider.user$.pipe(
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  async idToken(): Promise<string> {
    await this.provider.auth.authStateReady();
    const user = this.provider.auth.currentUser;
    if (!user) throw new Error('Sign in to continue.');
    const token = await user.getIdToken();
    if (this.provider.auth.currentUser !== user)
      throw new Error('Session changed.');
    return token;
  }
  async login(): Promise<void> {
    await this.provider.login();
  }
  async logout(): Promise<void> {
    await this.provider.logout();
  }
}
