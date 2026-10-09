import type { FirebaseApp } from 'firebase/app';
import {
  type Auth,
  getAuth,
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
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(secureAuthStorage),
    });
  } catch (error) {
    // Fast Refresh re-runs this module while the app keeps its Auth instance.
    if (isAlreadyInitialized(error)) return getAuth(app);
    throw error;
  }
}

function isAlreadyInitialized(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'auth/already-initialized'
  );
}

export const popupSignIn: ((auth: Auth) => Promise<void>) | undefined =
  undefined;
