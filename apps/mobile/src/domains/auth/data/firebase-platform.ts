import type { FirebaseApp } from 'firebase/app';
import {
  type Auth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';

import { secureAuthStorage } from './secure-auth-storage';

/**
 * Native Firebase Auth: the user survives restarts in the keychain. Google
 * sign-in runs through expo-auth-session (`google-sign-in.ts`), since the
 * popup flow needs a browser window.
 */
export function initializePlatformAuth(app: FirebaseApp): Auth {
  return initializeAuth(app, {
    persistence: getReactNativePersistence(secureAuthStorage),
  });
}

export const popupSignIn: ((auth: Auth) => Promise<void>) | undefined =
  undefined;
