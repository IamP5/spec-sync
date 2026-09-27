import type { FirebaseApp } from 'firebase/app';
import {
  type Auth,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  GoogleAuthProvider,
  initializeAuth,
  signInWithPopup,
} from 'firebase/auth';

/**
 * Firebase Auth in a browser, set up like the web app
 * (`apps/web/src/app/domains/auth/data/auth-session.ts`): the session ends
 * with the tab, and Google sign-in opens the Firebase popup.
 */
export function initializePlatformAuth(app: FirebaseApp): Auth {
  return initializeAuth(app, {
    persistence: browserSessionPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
}

export const popupSignIn: ((auth: Auth) => Promise<void>) | undefined = async (
  auth,
) => {
  await signInWithPopup(auth, new GoogleAuthProvider());
};
