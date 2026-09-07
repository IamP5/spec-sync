import {
  DestroyRef,
  inject,
  Injectable,
  InjectionToken,
  signal,
} from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  browserPopupRedirectResolver,
  browserSessionPersistence,
  GoogleAuthProvider,
  initializeAuth,
  onIdTokenChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';

export interface WebConfig {
  gatewayUrl: string;
  firebase: { apiKey: string; authDomain: string; projectId: string };
}
export const WEB_CONFIG = new InjectionToken<WebConfig>('webConfig');

/** Injectable SDK boundary keeps lifecycle tests independent of Firebase transport. */
export const AUTH_PROVIDER = new InjectionToken('authProvider', {
  factory: () => {
    const auth = initializeAuth(initializeApp(inject(WEB_CONFIG).firebase), {
      persistence: browserSessionPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
    return {
      auth,
      login: () => signInWithPopup(auth, new GoogleAuthProvider()),
      logout: () => signOut(auth),
      onTokenChanged: (next: (user: User | null) => void) =>
        onIdTokenChanged(auth, next),
    };
  },
});

/** SDK credential lifecycle. Tokens stay out of application stores and devtools. */
@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly provider = inject(AUTH_PROVIDER);
  private readonly auth = this.provider.auth;
  private readonly currentToken = signal<string | null>(null);
  private readonly restored = signal(false);
  readonly token = this.currentToken.asReadonly();
  readonly ready = this.restored.asReadonly();

  constructor() {
    const unsubscribe = this.provider.onTokenChanged(async (user) => {
      try {
        const token = user ? await user.getIdToken() : null;
        if (this.auth.currentUser === user) this.currentToken.set(token);
      } catch {
        this.currentToken.set(null);
      } finally {
        this.restored.set(true);
      }
    });
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  userId(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Sign in to continue.');
    return uid;
  }

  async idToken(): Promise<string> {
    await this.auth.authStateReady();
    const user = this.auth.currentUser;
    if (!user) throw new Error('Sign in to continue.');
    return user.getIdToken();
  }

  async login(): Promise<void> {
    await this.provider.login();
    // A new login must discard state from any previous account or revoked session.
    globalThis.location.reload();
  }

  async logout(): Promise<void> {
    await this.provider.logout();
    // Dispose conversation state, in-flight work and curator credentials together.
    globalThis.location.reload();
  }
}
